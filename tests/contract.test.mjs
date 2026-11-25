import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_MESSAGE_LENGTH,
  MESSAGE_COUNTER_THRESHOLD,
  MAX_NAME_LENGTH,
  MAX_ROOM_NAME_LENGTH,
  MIN_NAME_LENGTH,
  MIN_ROOM_NAME_LENGTH,
  countCharacters,
  isMentionFor,
  normalizeMessageBody,
} from "../shared/types.ts";

// These assertions encode the PTI-40 addendum contract independently of the
// server/client implementation, so drift in shared constants fails loudly.

test("contract: message limit 4000 and counter threshold 3600", () => {
  assert.equal(MAX_MESSAGE_LENGTH, 4000);
  assert.equal(MESSAGE_COUNTER_THRESHOLD, 3600);
  assert.ok(MESSAGE_COUNTER_THRESHOLD < MAX_MESSAGE_LENGTH);
});

test("contract: message length counts Unicode code points, 4000 ok / 4001 rejected", () => {
  const asciiAtLimit = "x".repeat(MAX_MESSAGE_LENGTH);
  const asciiOver = "x".repeat(MAX_MESSAGE_LENGTH + 1);
  assert.equal(countCharacters(asciiAtLimit), 4000);
  assert.ok(countCharacters(asciiAtLimit) <= MAX_MESSAGE_LENGTH);
  assert.ok(countCharacters(asciiOver) > MAX_MESSAGE_LENGTH);

  const emojiAtLimit = "😀".repeat(MAX_MESSAGE_LENGTH);
  const emojiOver = "😀".repeat(MAX_MESSAGE_LENGTH + 1);
  assert.equal(emojiAtLimit.length, 8000, "UTF-16 length is double the code-point count");
  assert.equal(countCharacters(emojiAtLimit), 4000);
  assert.ok(countCharacters(emojiAtLimit) <= MAX_MESSAGE_LENGTH);
  assert.ok(countCharacters(emojiOver) > MAX_MESSAGE_LENGTH);

  // The counter becomes visible at 3600, not before.
  assert.equal(countCharacters("y".repeat(3599)) >= MESSAGE_COUNTER_THRESHOLD, false);
  assert.equal(countCharacters("y".repeat(3600)) >= MESSAGE_COUNTER_THRESHOLD, true);
});

test("contract: display name is 2-32 and room name is 2-40", () => {
  assert.equal(MIN_NAME_LENGTH, 2);
  assert.equal(MAX_NAME_LENGTH, 32);
  assert.equal(MIN_ROOM_NAME_LENGTH, 2);
  assert.equal(MAX_ROOM_NAME_LENGTH, 40);
  assert.notEqual(MAX_NAME_LENGTH, MAX_ROOM_NAME_LENGTH, "the two limits stay separate");
});

test("contract: normalizeMessageBody trims before length counting", () => {
  assert.equal(normalizeMessageBody("  hello  "), "hello");
  assert.equal(normalizeMessageBody("\n\t hi \n"), "hi");
  assert.equal(countCharacters(normalizeMessageBody("   ")), 0);
  const padded = ` ${"x".repeat(MAX_MESSAGE_LENGTH)} `;
  assert.equal(countCharacters(normalizeMessageBody(padded)), MAX_MESSAGE_LENGTH);
});

test("contract: isMentionFor requires a token boundary and is case-insensitive", () => {
  assert.equal(isMentionFor("hello @Alice", "Alice"), true);
  assert.equal(isMentionFor("@Alice hi", "Alice"), true);
  assert.equal(isMentionFor("hi @alice", "Alice"), true);
  assert.equal(isMentionFor("hi @Alice, ok", "Alice"), true);
  assert.equal(isMentionFor("@Minh Trần ơi", "Minh Trần"), true);

  assert.equal(isMentionFor("hi@Alice", "Alice"), false, "no boundary before @");
  assert.equal(isMentionFor("hi @Alicex", "Alice"), false, "name must end at a boundary");
  assert.equal(isMentionFor("Alice", "Alice"), false, "bare name is not a mention");
  assert.equal(isMentionFor("email@Alice.com", "Alice"), false);
  assert.equal(isMentionFor("", "Alice"), false);
});
