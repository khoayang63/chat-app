import "dotenv/config";
import express from "express";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { Server as SocketServer } from "socket.io";
import {
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_ROOM_NAME_LENGTH,
  MIN_NAME_LENGTH,
  MIN_ROOM_NAME_LENGTH,
  countCharacters,
  isDmKey,
  isMentionFor,
  normalizeMessageBody,
} from "../shared/types";
import type {
  JoinRoomPayload,
  Message,
  MessageActivity,
  SendMessageAck,
  SendMessagePayload,
} from "../shared/types";
import {
  createRoom,
  findRoomByNameKey,
  getRoomById,
  insertMessage,
  listMessages,
  listRooms,
  listUsers,
  upsertUser,
  userExists,
} from "./db";

const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const app = express();
app.use(express.json({ limit: "64kb" }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", CLIENT_ORIGIN);
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

function parseDisplayName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  if (countCharacters(name) < MIN_NAME_LENGTH || countCharacters(name) > MAX_NAME_LENGTH) {
    return null;
  }
  if (/[\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

function parseRoomName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/\s+/g, "-");
  const length = countCharacters(name);
  if (length < MIN_ROOM_NAME_LENGTH || length > MAX_ROOM_NAME_LENGTH) return null;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) return null;
  return name;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const name = parseDisplayName(req.query.name);
  if (!name) {
    res.status(400).json({
      error: `Tên cần từ ${MIN_NAME_LENGTH} đến ${MAX_NAME_LENGTH} ký tự.`,
    });
    return;
  }
  res.json(upsertUser(name));
});

app.get("/api/users", (_req, res) => {
  res.json({ users: listUsers() });
});

app.get("/api/rooms", (_req, res) => {
  res.json({ rooms: listRooms() });
});

app.post("/api/rooms", (req, res) => {
  const name = parseRoomName(req.body?.name);
  if (!name) {
    res.status(400).json({
      error: `Tên phòng cần từ ${MIN_ROOM_NAME_LENGTH} đến ${MAX_ROOM_NAME_LENGTH} ký tự.`,
    });
    return;
  }
  if (findRoomByNameKey(name)) {
    res.status(409).json({ error: "Tên phòng đã tồn tại." });
    return;
  }
  res.status(201).json(createRoom(name));
});

app.get("/api/messages", (req, res) => {
  const roomId = typeof req.query.roomId === "string" ? req.query.roomId : undefined;
  const dmKey = typeof req.query.dmKey === "string" ? req.query.dmKey : undefined;

  if (Boolean(roomId) === Boolean(dmKey)) {
    res.status(400).json({ error: "Provide exactly one of roomId or dmKey." });
    return;
  }
  if (roomId && !getRoomById(roomId)) {
    res.status(404).json({ error: "Room not found." });
    return;
  }
  if (dmKey && !isDmKey(dmKey)) {
    res.status(400).json({ error: "Invalid dmKey." });
    return;
  }

  res.json({ messages: listMessages({ roomId, dmKey }) });
});

const distDir = path.resolve("dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
      next();
      return;
    }
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[server] unhandled error:", err);
  res.status(500).json({ error: "Internal server error." });
});

const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
});

function channelFor(target: { roomId?: unknown; dmKey?: unknown }): string | null {
  if (typeof target.roomId === "string" && target.roomId && !target.dmKey) {
    return getRoomById(target.roomId) ? `room:${target.roomId}` : null;
  }
  if (typeof target.dmKey === "string" && target.dmKey && !target.roomId) {
    return isDmKey(target.dmKey) ? `dm:${target.dmKey}` : null;
  }
  return null;
}

function broadcastPresence(channel: string): void {
  const online = io.sockets.adapter.rooms.get(channel)?.size ?? 0;
  io.to(channel).emit("presence", { channel, online });
}

io.on("connection", (socket) => {
  const channels = new Set<string>();

  socket.on("join_room", (payload: JoinRoomPayload, ack?: (result: unknown) => void) => {
    const channel = channelFor(payload ?? {});
    if (!channel) {
      ack?.({ ok: false, error: "Invalid room or DM target." });
      return;
    }
    for (const existing of channels) {
      socket.leave(existing);
      channels.delete(existing);
      broadcastPresence(existing);
    }
    socket.join(channel);
    channels.add(channel);
    broadcastPresence(channel);
    ack?.({ ok: true, channel });
  });

  socket.on("leave_room", () => {
    for (const existing of channels) {
      socket.leave(existing);
      channels.delete(existing);
      broadcastPresence(existing);
    }
  });

  socket.on(
    "send_message",
    (payload: SendMessagePayload, ack?: (result: SendMessageAck) => void) => {
      if (!payload || typeof payload !== "object") {
        ack?.({ ok: false, error: "Invalid message payload." });
        return;
      }
      const { roomId, dmKey, senderId, senderName } = payload;
      const body = normalizeMessageBody(typeof payload.body === "string" ? payload.body : "");
      const target = { roomId: roomId ?? undefined, dmKey: dmKey ?? undefined };
      const channel = channelFor(target);

      if (!channel) {
        ack?.({ ok: false, error: "Message must target a valid room or DM." });
        return;
      }
      if (!body) {
        ack?.({ ok: false, error: "Tin nhắn không được để trống." });
        return;
      }
      if (countCharacters(body) > MAX_MESSAGE_LENGTH) {
        ack?.({
          ok: false,
          error: "Tin nhắn vượt quá 4.000 ký tự. Vui lòng rút ngắn rồi gửi lại.",
        });
        return;
      }
      if (typeof senderId !== "string" || !userExists(senderId)) {
        ack?.({ ok: false, error: "Unknown sender. Re-enter your display name." });
        return;
      }
      if (typeof senderName !== "string" || !senderName.trim()) {
        ack?.({ ok: false, error: "Sender name is required." });
        return;
      }

      try {
        const message: Message = insertMessage({
          roomId: typeof roomId === "string" && roomId ? roomId : null,
          dmKey: typeof dmKey === "string" && dmKey ? dmKey : null,
          senderId,
          senderName: senderName.trim(),
          body,
        });
        io.to(channel).emit("new_message", message);
        const activity: MessageActivity = {
          id: message.id,
          roomId: message.roomId,
          dmKey: message.dmKey,
          senderId: message.senderId,
          senderName: message.senderName,
          createdAt: message.createdAt,
          mentions: listUsers()
            .filter((user) => isMentionFor(message.body, user.name))
            .map((user) => user.id),
        };
        io.emit("message_activity", activity);
        ack?.({ ok: true, message });
      } catch (error) {
        console.error("[socket] failed to persist message:", error);
        ack?.({ ok: false, error: "Could not save message. Please retry." });
      }
    },
  );

  socket.on("disconnect", () => {
    for (const channel of channels) {
      broadcastPresence(channel);
    }
    channels.clear();
  });
});

server.listen(PORT, () => {
  console.log(`[server] PTIT messaging API listening on http://localhost:${PORT}`);
});
