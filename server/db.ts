import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Message, Room, User } from "../shared/types";

const dbPath = path.resolve(process.env.DB_PATH ?? "./data/ptit.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
    dm_key TEXT,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    CHECK ((room_id IS NOT NULL AND dm_key IS NULL) OR (room_id IS NULL AND dm_key IS NOT NULL))
  );

  CREATE INDEX IF NOT EXISTS idx_messages_room ON messages (room_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_messages_dm ON messages (dm_key, created_at);
`);

interface UserRow {
  id: string;
  name: string;
  created_at: string;
}

interface RoomRow {
  id: string;
  name: string;
  created_at: string;
}

interface MessageRow {
  id: string;
  room_id: string | null;
  dm_key: string | null;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
}

function toUser(row: UserRow): User {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

function toRoom(row: RoomRow): Room {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    roomId: row.room_id,
    dmKey: row.dm_key,
    senderId: row.sender_id,
    senderName: row.sender_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

const seedRooms = ["general", "random", "dev"];
const insertRoomStmt = db.prepare(
  "INSERT INTO rooms (id, name, name_key, created_at) VALUES (?, ?, ?, ?)",
);
for (const name of seedRooms) {
  const exists = db.prepare("SELECT 1 FROM rooms WHERE name_key = ?").get(name);
  if (!exists) {
    insertRoomStmt.run(randomUUID(), name, name, new Date().toISOString());
  }
}

export function upsertUser(rawName: string): User {
  const name = rawName.trim();
  const key = name.toLowerCase();
  const existing = db.prepare("SELECT * FROM users WHERE name_key = ?").get(key) as
    | UserRow
    | undefined;
  if (existing) return toUser(existing);

  const user: User = { id: randomUUID(), name, createdAt: new Date().toISOString() };
  db.prepare("INSERT INTO users (id, name, name_key, created_at) VALUES (?, ?, ?, ?)").run(
    user.id,
    user.name,
    key,
    user.createdAt,
  );
  return user;
}

export function listUsers(): User[] {
  const rows = db
    .prepare("SELECT * FROM users ORDER BY name COLLATE NOCASE ASC")
    .all() as UserRow[];
  return rows.map(toUser);
}

export function listRooms(): Room[] {
  const rows = db
    .prepare("SELECT * FROM rooms ORDER BY name COLLATE NOCASE ASC")
    .all() as RoomRow[];
  return rows.map(toRoom);
}

export function getRoomById(id: string): Room | undefined {
  const row = db.prepare("SELECT * FROM rooms WHERE id = ?").get(id) as RoomRow | undefined;
  return row ? toRoom(row) : undefined;
}

export function createRoom(name: string): Room {
  const room: Room = { id: randomUUID(), name, createdAt: new Date().toISOString() };
  db.prepare("INSERT INTO rooms (id, name, name_key, created_at) VALUES (?, ?, ?, ?)").run(
    room.id,
    room.name,
    room.name.toLowerCase(),
    room.createdAt,
  );
  return room;
}

export function findRoomByNameKey(nameKey: string): Room | undefined {
  const row = db.prepare("SELECT * FROM rooms WHERE name_key = ?").get(nameKey) as
    | RoomRow
    | undefined;
  return row ? toRoom(row) : undefined;
}

export function insertMessage(input: {
  roomId: string | null;
  dmKey: string | null;
  senderId: string;
  senderName: string;
  body: string;
}): Message {
  const message: Message = {
    id: randomUUID(),
    roomId: input.roomId,
    dmKey: input.dmKey,
    senderId: input.senderId,
    senderName: input.senderName,
    body: input.body,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO messages (id, room_id, dm_key, sender_id, sender_name, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    message.id,
    message.roomId,
    message.dmKey,
    message.senderId,
    message.senderName,
    message.body,
    message.createdAt,
  );
  return message;
}

export function listMessages(target: { roomId?: string; dmKey?: string }, limit = 50): Message[] {
  const rows = target.roomId
    ? (db
        .prepare(
          "SELECT * FROM messages WHERE room_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
        )
        .all(target.roomId, limit) as MessageRow[])
    : (db
        .prepare(
          "SELECT * FROM messages WHERE dm_key = ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
        )
        .all(target.dmKey, limit) as MessageRow[]);
  return rows.reverse().map(toMessage);
}

export function userExists(id: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM users WHERE id = ?").get(id));
}
