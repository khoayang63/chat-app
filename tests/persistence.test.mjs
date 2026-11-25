import assert from "node:assert/strict";
import fs from "node:fs";
import { after, test } from "node:test";
import {
  closeSocket,
  connectSocket,
  createUser,
  emitAck,
  joinChannel,
  postJson,
  removeDbFiles,
  requestJson,
  startServer,
  tempDbPath,
  unique,
} from "./helpers.mjs";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let activeServer = null;

after(async () => {
  if (activeServer) {
    await activeServer.stop();
    removeDbFiles(activeServer.dbPath);
  }
});

test("persistence: rooms, users and messages survive a server restart", async () => {
  const dbPath = tempDbPath("persist");
  const roomName = unique("persist");

  let server = await startServer({ dbPath, label: "persist" });
  activeServer = server;

  let room;
  let alice;
  try {
    const roomRes = await postJson(server.base, "/api/rooms", { name: roomName });
    assert.equal(roomRes.status, 201);
    room = roomRes.body;

    alice = await createUser(server.base, "Persist Alice");
    const bob = await createUser(server.base, "Persist Bob");

    const socket = await connectSocket(server.base);
    try {
      await joinChannel(socket, { roomId: room.id });
      for (const [sender, body] of [
        [alice, "before restart one"],
        [bob, "before restart two"],
      ]) {
        const ack = await emitAck(socket, "send_message", {
          roomId: room.id,
          senderId: sender.id,
          senderName: sender.name,
          body,
        });
        assert.equal(ack.ok, true);
      }
    } finally {
      await closeSocket(socket);
    }

    const before = await requestJson(server.base, `/api/messages?roomId=${room.id}`);
    assert.equal(before.body.messages.length, 2);
  } finally {
    await server.stop();
    activeServer = null;
  }

  assert.ok(fs.existsSync(dbPath), "the SQLite database file exists on disk");
  await delay(300);

  server = await startServer({ dbPath, label: "persist-restart" });
  activeServer = server;
  try {
    const health = await requestJson(server.base, "/api/health");
    assert.equal(health.status, 200);

    const rooms = await requestJson(server.base, "/api/rooms");
    assert.ok(
      rooms.body.rooms.some((entry) => entry.id === room.id && entry.name === roomName),
      "the created room survives the restart",
    );

    const me = await requestJson(server.base, "/api/me?name=persist%20alice");
    assert.equal(me.status, 200);
    assert.equal(me.body.id, alice.id, "existing users keep their identity after restart");
    assert.equal(me.body.name, "Persist Alice");

    const history = await requestJson(server.base, `/api/messages?roomId=${room.id}`);
    assert.equal(history.status, 200);
    assert.deepEqual(
      history.body.messages.map((message) => message.body),
      ["before restart one", "before restart two"],
      "messages are restored in original order",
    );
    assert.equal(history.body.messages[0].senderName, "Persist Alice");

    const socket = await connectSocket(server.base);
    try {
      await joinChannel(socket, { roomId: room.id });
      const ack = await emitAck(socket, "send_message", {
        roomId: room.id,
        senderId: alice.id,
        senderName: alice.name,
        body: "after restart",
      });
      assert.equal(ack.ok, true);
    } finally {
      await closeSocket(socket);
    }

    const afterRestart = await requestJson(server.base, `/api/messages?roomId=${room.id}`);
    assert.deepEqual(
      afterRestart.body.messages.map((message) => message.body),
      ["before restart one", "before restart two", "after restart"],
      "the restored database remains writable",
    );
  } finally {
    await server.stop();
    activeServer = null;
    removeDbFiles(dbPath);
  }
});
