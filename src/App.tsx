import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { DmPeer, Message, Room, SendMessageAck, User } from "../shared/types";
import { createRoom, getMe, getMessages, getRooms, getUsers } from "./api";
import { ChatPane } from "./components/ChatPane";
import { NameGate } from "./components/NameGate";
import { Sidebar } from "./components/Sidebar";
import type { ActiveConversation, ConnectionStatus } from "./types";
import { messageMatches, targetFor } from "./types";

const NAME_KEY = "ptit.displayName";
const DM_KEY = "ptit.dmPeers";

function readDmPeers(): DmPeer[] {
  try {
    const raw = localStorage.getItem(DM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is DmPeer =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as DmPeer).id === "string" &&
        typeof (item as DmPeer).name === "string",
    );
  } catch {
    return [];
  }
}

export default function App() {
  const [me, setMe] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dmPeers, setDmPeers] = useState<DmPeer[]>(readDmPeers);
  const [active, setActive] = useState<ActiveConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionStatus>("connecting");
  const [online, setOnline] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const activeRef = useRef<ActiveConversation | null>(null);
  const loadSeq = useRef(0);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const stored = localStorage.getItem(NAME_KEY);
    if (!stored) {
      setBooting(false);
      return;
    }
    let cancelled = false;
    getMe(stored)
      .then((user) => {
        if (!cancelled) setMe(user);
      })
      .catch(() => {
        localStorage.removeItem(NAME_KEY);
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (me) localStorage.setItem(NAME_KEY, me.name);
  }, [me]);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;

    async function refresh() {
      try {
        const [nextRooms, nextUsers] = await Promise.all([getRooms(), getUsers()]);
        if (cancelled) return;
        setRooms(nextRooms);
        setUsers(nextUsers);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load chat data.");
        }
      }
    }

    void refresh();
    const timer = setInterval(refresh, 20_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [me]);

  useEffect(() => {
    if (!me) return;
    setDmPeers((prev) => {
      const next = prev.map((peer) => {
        const fresh = users.find((user) => user.id === peer.id);
        return fresh ? { id: fresh.id, name: fresh.name } : peer;
      });
      return next.length === prev.length && next.every((peer, i) => peer.name === prev[i].name)
        ? prev
        : next;
    });
  }, [users]);

  useEffect(() => {
    localStorage.setItem(DM_KEY, JSON.stringify(dmPeers));
  }, [dmPeers]);

  useEffect(() => {
    if (!active && rooms.length > 0) {
      setActive({ kind: "room", room: rooms[0] });
    }
  }, [rooms, active]);

  useEffect(() => {
    if (!me) return;
    const socket = io({ path: "/socket.io" });
    socketRef.current = socket;
    setConnection("connecting");

    socket.on("connect", () => {
      setConnection("online");
      const current = activeRef.current;
      if (current) {
        const target = targetFor(current, me.id);
        socket.emit(
          "join_room",
          { roomId: target.roomId, dmKey: target.dmKey },
          (result: { ok: boolean }) => {
            if (!result?.ok) setError("Could not join this conversation.");
          },
        );
      }
    });

    socket.on("disconnect", () => setConnection("offline"));
    socket.on("connect_error", () => setConnection("offline"));

    socket.on("new_message", (message: Message) => {
      const current = activeRef.current;
      if (!current || !messageMatches(message, current, me.id)) return;
      setMessages((prev) =>
        prev.some((existing) => existing.id === message.id) ? prev : [...prev, message],
      );
    });

    socket.on("presence", (payload: { channel: string; online: number }) => {
      const current = activeRef.current;
      if (!current) return;
      if (payload.channel === targetFor(current, me.id).channel) {
        setOnline(payload.online);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [me]);

  useEffect(() => {
    if (!me || !active) return;
    const requestId = ++loadSeq.current;
    setLoading(true);
    setError(null);
    setOnline(0);

    const target = targetFor(active, me.id);
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit(
        "join_room",
        { roomId: target.roomId, dmKey: target.dmKey },
        (result: { ok: boolean; error?: string }) => {
          if (!result?.ok) setError(result?.error ?? "Could not join this conversation.");
        },
      );
    }

    getMessages({ roomId: target.roomId, dmKey: target.dmKey })
      .then((history) => {
        if (loadSeq.current !== requestId) return;
        setMessages(history);
      })
      .catch((err) => {
        if (loadSeq.current !== requestId) return;
        setMessages([]);
        setError(err instanceof Error ? err.message : "Could not load messages.");
      })
      .finally(() => {
        if (loadSeq.current === requestId) setLoading(false);
      });
  }, [me, active]);

  async function handleSend(body: string): Promise<void> {
    const socket = socketRef.current;
    const current = activeRef.current;
    if (!me || !current) throw new Error("Select a conversation first.");
    if (!socket?.connected) throw new Error("Not connected — reconnecting…");

    const target = targetFor(current, me.id);
    await new Promise<void>((resolve, reject) => {
      socket.timeout(8000).emit(
        "send_message",
        {
          roomId: target.roomId,
          dmKey: target.dmKey,
          senderId: me.id,
          senderName: me.name,
          body,
        },
        (timeoutError: Error | null, response?: SendMessageAck) => {
          if (timeoutError) {
            reject(new Error("Server did not respond. Please try again."));
            return;
          }
          if (!response?.ok) {
            reject(new Error(response?.error ?? "Message could not be sent."));
            return;
          }
          if (response.message) {
            const value = response.message;
            setMessages((prev) =>
              prev.some((existing) => existing.id === value.id) ? prev : [...prev, value],
            );
          }
          resolve();
        },
      );
    });
  }

  async function handleCreateRoom(name: string): Promise<void> {
    const room = await createRoom(name);
    setRooms((prev) =>
      prev.some((existing) => existing.id === room.id)
        ? prev
        : [...prev, room].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setActive({ kind: "room", room });
  }

  function handleSelectDm(peer: DmPeer) {
    setDmPeers((prev) =>
      prev.some((existing) => existing.id === peer.id)
        ? prev.map((existing) => (existing.id === peer.id ? peer : existing))
        : [...prev, peer].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setActive({ kind: "dm", peer });
  }

  function handleChangeName() {
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(DM_KEY);
    setDmPeers([]);
    setMe(null);
    setActive(null);
    setMessages([]);
    setError(null);
    setOnline(0);
  }

  if (booting) {
    return (
      <div className="gate">
        <div className="gate-card centered">
          <span className="spinner large" />
          <p className="muted">Restoring your profile…</p>
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <NameGate
        initialName={localStorage.getItem(NAME_KEY) ?? ""}
        onReady={(user) => {
          setMe(user);
        }}
      />
    );
  }

  return (
    <div className="app">
      <Sidebar
        me={me}
        rooms={rooms}
        users={users}
        dmPeers={dmPeers}
        active={active}
        onSelectRoom={(room) => setActive({ kind: "room", room })}
        onSelectDm={handleSelectDm}
        onCreateRoom={handleCreateRoom}
        onChangeName={handleChangeName}
      />
      {active ? (
        <ChatPane
          active={active}
          me={me}
          messages={messages}
          loading={loading}
          error={error}
          connection={connection}
          online={online}
          onSend={handleSend}
          onDismissError={() => setError(null)}
        />
      ) : (
        <main className="chat chat-idle">
          <div className="messages-empty">
            <h3>No conversations yet</h3>
            <p>Select a room or start a direct message from the sidebar.</p>
          </div>
        </main>
      )}
    </div>
  );
}
