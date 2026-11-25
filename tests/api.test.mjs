import assert from "node:assert/strict";
import { after, before, test } from "node:test";
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
  unique,
} from "./helpers.mjs";

// Values are asserted as literals on purpose: the suite encodes the documented
// contract (README + design spec) and must fail if the backend silently drifts.
const MAX_MESSAGE_LENGTH = 2000;
const MAX_NAME_LENGTH = 40;
const MAX_ROOM_NAME_LENGTH = 30;

let server;

before(async () => {
  server = await startServer({ label: "api" });
});

after(async () => {
  await server.stop();
  removeDbFiles(server.dbPath);
});

test("bootstrap: health, seeded rooms and public API shape", async () => {
  const health = await requestJson(server.base, "/api/health");
  assert.equal(health.status, 200);
  assert.deepEqual(health.body, { ok: true });

  const roomsRes = await requestJson(server.base, "/api/rooms");
  assert.equal(roomsRes.status, 200);
  assert.ok(Array.isArray(roomsRes.body.rooms));
  const names = roomsRes.body.rooms.map((room) => room.name);
  assert.deepEqual(names, ["dev", "general", "random"], "seeded rooms, sorted by name");
  for (const room of roomsRes.body.rooms) {
    assert.equal(typeof room.id, "string");
    assert.ok(room.id.length > 0);
    assert.equal(typeof room.name, "string");
    assert.ok(!Number.isNaN(Date.parse(room.createdAt)), "createdAt is an ISO timestamp");
  }
});

test("bootstrap: /api/me upserts, trims and is case-insensitive", async () => {
  const first = await requestJson(server.base, `/api/me?name=${encodeURIComponent("  Alice  ")}`);
  assert.equal(first.status, 200);
  assert.equal(first.body.name, "Alice");
  const id = first.body.id;
  assert.equal(typeof id, "string");

  const again = await requestJson(server.base, "/api/me?name=alice");
  assert.equal(again.status, 200);
  assert.equal(again.body.id, id, "same identity for a case-insensitive name");
  assert.equal(again.body.name, "Alice", "original casing is preserved");

  const users = await requestJson(server.base, "/api/users");
  assert.equal(users.status, 200);
  assert.ok(users.body.users.some((user) => user.id === id && user.name === "Alice"));
});

test("bootstrap: /api/me rejects missing, empty, control and oversized names", async () => {
  const missing = await requestJson(server.base, "/api/me");
  assert.equal(missing.status, 400);
  assert.ok(missing.body.error);

  for (const raw of ["", "   ", "bad\u0001name", "n".repeat(MAX_NAME_LENGTH + 1)]) {
    const res = await requestJson(server.base, `/api/me?name=${encodeURIComponent(raw)}`);
    assert.equal(res.status, 400, `name ${JSON.stringify(raw)} must be rejected`);
  }

  const atLimit = await requestJson(
    server.base,
    `/api/me?name=${encodeURIComponent("n".repeat(MAX_NAME_LENGTH))}`,
  );
  assert.equal(atLimit.status, 200, "a name at the documented limit is accepted");
  assert.equal(atLimit.body.name.length, MAX_NAME_LENGTH);
});

test("rooms: creation normalizes names and rejects duplicates", async () => {
  const created = await postJson(server.base, "/api/rooms", { name: "  #QA Room  JS  " });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, "qa-room-js");
  assert.ok(created.body.id);

  const duplicate = await postJson(server.base, "/api/rooms", { name: "QA ROOM JS" });
  assert.equal(duplicate.status, 409);
  assert.match(duplicate.body.error, /already exists/i);

  const withHashDuplicate = await postJson(server.base, "/api/rooms", { name: "#qa-room-js" });
  assert.equal(withHashDuplicate.status, 409);

  const rooms = await requestJson(server.base, "/api/rooms");
  assert.ok(rooms.body.rooms.some((room) => room.name === "qa-room-js"));
});

test("rooms: creation validates malformed and oversized names", async () => {
  const invalidNames = ["", "   ", "#", "!!", "hello world!", "a".repeat(MAX_ROOM_NAME_LENGTH + 1)];
  for (const name of invalidNames) {
    const res = await postJson(server.base, "/api/rooms", { name });
    assert.equal(res.status, 400, `room name ${JSON.stringify(name)} must be rejected`);
  }

  const missingBody = await requestJson(server.base, "/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(missingBody.status, 400);

  const atLimit = await postJson(server.base, "/api/rooms", { name: "r".repeat(MAX_ROOM_NAME_LENGTH) });
  assert.equal(atLimit.status, 201, "a room name at the documented limit is accepted");

  const underscore = await postJson(server.base, "/api/rooms", { name: unique("qa_room") });
  assert.equal(underscore.status, 201);
});

test("messages: target validation (exactly one of roomId/dmKey)", async () => {
  const rooms = (await requestJson(server.base, "/api/rooms")).body.rooms;
  const room = rooms.find((entry) => entry.name === "general");
  assert.ok(room);

  const none = await requestJson(server.base, "/api/messages");
  assert.equal(none.status, 400);

  const both = await requestJson(server.base, `/api/messages?roomId=${room.id}&dmKey=dm:a:b`);
  assert.equal(both.status, 400);

  const unknownRoom = await requestJson(server.base, "/api/messages?roomId=does-not-exist");
  assert.equal(unknownRoom.status, 404);

  const badDm = await requestJson(server.base, "/api/messages?dmKey=not-a-dm-key");
  assert.equal(badDm.status, 400);

  const emptyDm = await requestJson(server.base, "/api/messages?dmKey=dm:user-a:user-b");
  assert.equal(emptyDm.status, 200);
  assert.deepEqual(emptyDm.body.messages, []);

  const emptyRoom = await requestJson(server.base, `/api/messages?roomId=${room.id}`);
  assert.equal(emptyRoom.status, 200);
  assert.deepEqual(emptyRoom.body.messages, []);
});

test("messages: history returns the latest 50 in oldest-first order", async () => {
  const roomRes = await postJson(server.base, "/api/rooms", { name: unique("history") });
  assert.equal(roomRes.status, 201);
  const room = roomRes.body;
  const alice = await createUser(server.base, "History Alice");

  const socket = await connectSocket(server.base);
  try {
    await joinChannel(socket, { roomId: room.id });
    for (let index = 0; index < 60; index += 1) {
      const body = `msg-${String(index).padStart(2, "0")}`;
      const ack = await emitAck(socket, "send_message", {
        roomId: room.id,
        senderId: alice.id,
        senderName: alice.name,
        body,
      });
      assert.equal(ack.ok, true, `send #${index} should succeed`);
    }
  } finally {
    await closeSocket(socket);
  }

  const history = await requestJson(server.base, `/api/messages?roomId=${room.id}`);
  assert.equal(history.status, 200);
  const bodies = history.body.messages.map((message) => message.body);
  assert.equal(bodies.length, 50, "the endpoint caps history at 50 messages");
  assert.equal(bodies[0], "msg-10");
  assert.equal(bodies.at(-1), "msg-59");
  for (let index = 0; index < 50; index += 1) {
    assert.equal(bodies[index], `msg-${String(index + 10).padStart(2, "0")}`);
  }
  for (let index = 1; index < history.body.messages.length; index += 1) {
    const previous = Date.parse(history.body.messages[index - 1].createdAt);
    const current = Date.parse(history.body.messages[index].createdAt);
    assert.ok(current >= previous, "timestamps are non-decreasing (oldest first)");
  }

  const ids = new Set(history.body.messages.map((message) => message.id));
  assert.equal(ids.size, 50, "message ids are unique");
});
