import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  closeSocket,
  connectSocket,
  createUser,
  dmKeyFor,
  emitAck,
  expectNoNewMessage,
  joinChannel,
  nextNewMessage,
  removeDbFiles,
  requestJson,
  startServer,
  unique,
} from "./helpers.mjs";

let server;

before(async () => {
  server = await startServer({ label: "realtime" });
});

after(async () => {
  await server.stop();
  removeDbFiles(server.dbPath);
});

async function seededRoom(base, name) {
  const rooms = (await requestJson(base, "/api/rooms")).body.rooms;
  const found = rooms.find((room) => room.name === name);
  assert.ok(found, `seed room #${name} must exist`);
  return found;
}

test("realtime: two clients in the same room both receive the message", async () => {
  const general = await seededRoom(server.base, "general");
  const alice = await createUser(server.base, "RT Alice");
  const bob = await createUser(server.base, "RT Bob");

  const aliceSocket = await connectSocket(server.base);
  const bobSocket = await connectSocket(server.base);
  try {
    await joinChannel(aliceSocket, { roomId: general.id });
    await joinChannel(bobSocket, { roomId: general.id });

    const aliceInbox = nextNewMessage(aliceSocket);
    const bobInbox = nextNewMessage(bobSocket);

    const ack = await emitAck(aliceSocket, "send_message", {
      roomId: general.id,
      senderId: alice.id,
      senderName: alice.name,
      body: "  hello room  ",
    });
    assert.equal(ack.ok, true);
    assert.equal(ack.message.body, "hello room", "body is trimmed");

    const [aliceMessage, bobMessage] = await Promise.all([aliceInbox, bobInbox]);
    assert.equal(aliceMessage.id, ack.message.id, "sender receives its own broadcast");
    assert.equal(bobMessage.id, ack.message.id, "second client receives the same message");
    assert.equal(bobMessage.roomId, general.id);
    assert.equal(bobMessage.senderName, "RT Alice");
  } finally {
    await closeSocket(aliceSocket);
    await closeSocket(bobSocket);
  }
});

test("realtime: no cross-room leakage", async () => {
  const general = await seededRoom(server.base, "general");
  const random = await seededRoom(server.base, "random");
  const alice = await createUser(server.base, "Leak Alice");

  const sender = await connectSocket(server.base);
  const sameRoomPeer = await connectSocket(server.base);
  const otherRoomPeer = await connectSocket(server.base);
  try {
    await joinChannel(sender, { roomId: general.id });
    await joinChannel(sameRoomPeer, { roomId: general.id });
    await joinChannel(otherRoomPeer, { roomId: random.id });

    const senderInbox = nextNewMessage(sender);
    const peerInbox = nextNewMessage(sameRoomPeer);
    const noLeak = expectNoNewMessage(otherRoomPeer, 600);

    const ack = await emitAck(sender, "send_message", {
      roomId: general.id,
      senderId: alice.id,
      senderName: alice.name,
      body: `room-only-${unique("msg")}`,
    });
    assert.equal(ack.ok, true);

    const [received] = await Promise.all([senderInbox, peerInbox, noLeak]);
    assert.equal(received.id, ack.message.id);

    const otherHistory = await requestJson(server.base, `/api/messages?roomId=${random.id}`);
    assert.equal(otherHistory.status, 200);
    assert.ok(
      !otherHistory.body.messages.some((message) => message.id === ack.message.id),
      "message must not leak into the other room's history",
    );
  } finally {
    await closeSocket(sender);
    await closeSocket(sameRoomPeer);
    await closeSocket(otherRoomPeer);
  }
});

test("realtime: DM isolation between two conversation pairs", async () => {
  const alice = await createUser(server.base, "DM Alice");
  const bob = await createUser(server.base, "DM Bob");
  const carol = await createUser(server.base, "DM Carol");
  const dave = await createUser(server.base, "DM Dave");

  const abKey = dmKeyFor(alice.id, bob.id);
  const cdKey = dmKeyFor(carol.id, dave.id);
  assert.notEqual(abKey, cdKey);

  const abSocket = await connectSocket(server.base);
  const cdSocket = await connectSocket(server.base);
  try {
    await joinChannel(abSocket, { dmKey: abKey });
    await joinChannel(cdSocket, { dmKey: cdKey });

    const abInbox = nextNewMessage(abSocket);
    const noLeak = expectNoNewMessage(cdSocket, 600);

    const ack = await emitAck(abSocket, "send_message", {
      dmKey: abKey,
      senderId: alice.id,
      senderName: alice.name,
      body: "private hello",
    });
    assert.equal(ack.ok, true);
    assert.equal(ack.message.dmKey, abKey);
    assert.equal(ack.message.roomId, null);

    const [received] = await Promise.all([abInbox, noLeak]);
    assert.equal(received.id, ack.message.id);

    const abHistory = await requestJson(server.base, `/api/messages?dmKey=${encodeURIComponent(abKey)}`);
    assert.equal(abHistory.body.messages.length, 1);
    assert.equal(abHistory.body.messages[0].body, "private hello");

    const cdHistory = await requestJson(server.base, `/api/messages?dmKey=${encodeURIComponent(cdKey)}`);
    assert.deepEqual(cdHistory.body.messages, [], "the other DM pair stays empty");

    const general = await seededRoom(server.base, "general");
    const roomHistory = await requestJson(server.base, `/api/messages?roomId=${general.id}`);
    assert.ok(
      !roomHistory.body.messages.some((message) => message.id === ack.message.id),
      "a DM is not written into room history",
    );
  } finally {
    await closeSocket(abSocket);
    await closeSocket(cdSocket);
  }
});

test("realtime: message_activity reaches clients outside the conversation without a body", async () => {
  const general = await seededRoom(server.base, "general");
  const random = await seededRoom(server.base, "random");
  const bob = await createUser(server.base, "Activity Bob");

  const watcher = await connectSocket(server.base);
  const sender = await connectSocket(server.base);
  try {
    await joinChannel(watcher, { roomId: general.id });
    await joinChannel(sender, { roomId: random.id });

    const activityPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        watcher.off("message_activity", onActivity);
        reject(new Error("timed out waiting for message_activity"));
      }, 3000);
      function onActivity(activity) {
        if (activity.roomId !== random.id) return;
        clearTimeout(timer);
        watcher.off("message_activity", onActivity);
        resolve(activity);
      }
      watcher.on("message_activity", onActivity);
    });

    const ack = await emitAck(sender, "send_message", {
      roomId: random.id,
      senderId: bob.id,
      senderName: bob.name,
      body: "@Activity Bob ping",
    });
    assert.equal(ack.ok, true);

    const activity = await activityPromise;
    assert.equal(activity.id, ack.message.id);
    assert.equal(activity.roomId, random.id);
    assert.equal(activity.senderId, bob.id);
    assert.ok(activity.mentions.includes(bob.id), "server computed mention user ids");
    assert.equal("body" in activity, false, "activity must not leak the message body");
    assert.equal(activity.body, undefined);

    const noMessage = expectNoNewMessage(watcher, 300);
    await noMessage;
  } finally {
    await closeSocket(watcher);
    await closeSocket(sender);
  }
});

test("realtime: validation acks for empty, oversized and malformed messages", async () => {
  const general = await seededRoom(server.base, "general");
  const alice = await createUser(server.base, "Validation Alice");
  const socket = await connectSocket(server.base);
  try {
    await joinChannel(socket, { roomId: general.id });

    const base = { roomId: general.id, senderId: alice.id, senderName: alice.name };

    for (const body of ["", "   ", "\n\t  "]) {
      const ack = await emitAck(socket, "send_message", { ...base, body });
      assert.equal(ack.ok, false, `empty body ${JSON.stringify(body)} must be rejected`);
      assert.match(ack.error, /trống/i);
    }

    const oversized = await emitAck(socket, "send_message", {
      ...base,
      body: "x".repeat(4001),
    });
    assert.equal(oversized.ok, false);
    assert.match(oversized.error, /4\.000/);

    const atLimit = await emitAck(socket, "send_message", {
      ...base,
      body: "y".repeat(4000),
    });
    assert.equal(atLimit.ok, true, "exactly 4000 characters must be accepted");
    assert.equal(atLimit.message.body.length, 4000);

    const emojiAtLimit = await emitAck(socket, "send_message", {
      ...base,
      body: "😀".repeat(4000),
    });
    assert.equal(emojiAtLimit.ok, true, "4000 emoji code points must be accepted");
    assert.equal(Array.from(emojiAtLimit.message.body).length, 4000);
    assert.equal(
      emojiAtLimit.message.body.length,
      8000,
      "the UTF-16 length is larger than the code-point limit",
    );

    const emojiOver = await emitAck(socket, "send_message", {
      ...base,
      body: "😀".repeat(4001),
    });
    assert.equal(emojiOver.ok, false, "4001 emoji code points must be rejected");
    assert.match(emojiOver.error, /4\.000/);

    const unknownSender = await emitAck(socket, "send_message", {
      ...base,
      senderId: "00000000-0000-0000-0000-000000000000",
      body: "hi",
    });
    assert.equal(unknownSender.ok, false);
    assert.match(unknownSender.error, /unknown sender/i);

    const missingSenderName = await emitAck(socket, "send_message", {
      roomId: general.id,
      senderId: alice.id,
      body: "hi",
    });
    assert.equal(missingSenderName.ok, false);
    assert.match(missingSenderName.error, /sender name/i);

    const bothTargets = await emitAck(socket, "send_message", {
      ...base,
      dmKey: dmKeyFor(alice.id, alice.id),
      body: "hi",
    });
    assert.equal(bothTargets.ok, false);
    assert.match(bothTargets.error, /valid room or DM/i);

    const badRoom = await emitAck(socket, "send_message", {
      ...base,
      roomId: "not-a-room",
      body: "hi",
    });
    assert.equal(badRoom.ok, false);

    const badDm = await emitAck(socket, "send_message", {
      ...base,
      roomId: undefined,
      dmKey: "dm:only-one-segment",
      body: "hi",
    });
    assert.equal(badDm.ok, false);

    const noTarget = await emitAck(socket, "send_message", {
      senderId: alice.id,
      senderName: alice.name,
      body: "hi",
    });
    assert.equal(noTarget.ok, false);

    const nullPayload = await emitAck(socket, "send_message", null);
    assert.equal(nullPayload.ok, false);
    assert.match(nullPayload.error, /invalid/i);

    const history = await requestJson(server.base, `/api/messages?roomId=${general.id}`);
    const rejectedBodies = history.body.messages.map((message) => message.body);
    assert.ok(!rejectedBodies.includes("hi"), "rejected messages are never persisted");
    assert.ok(
      rejectedBodies.filter((body) => body.startsWith("y")).length === 1,
      "only the boundary message is persisted",
    );
  } finally {
    await closeSocket(socket);
  }
});
