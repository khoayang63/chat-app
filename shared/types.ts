export interface User {
  id: string;
  name: string;
  createdAt: string;
}

export interface Room {
  id: string;
  name: string;
  createdAt: string;
}

export interface Message {
  id: string;
  roomId: string | null;
  dmKey: string | null;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

export type MessageActivity = Omit<Message, "body"> & { mentions: string[] };

export interface DmPeer {
  id: string;
  name: string;
}

export interface JoinRoomPayload {
  roomId?: string;
  dmKey?: string;
}

export interface SendMessagePayload {
  roomId?: string | null;
  dmKey?: string | null;
  senderId: string;
  senderName: string;
  body: string;
}

export interface SendMessageAck {
  ok: boolean;
  message?: Message;
  error?: string;
}

export interface PresencePayload {
  channel: string;
  online: number;
}

export const MAX_MESSAGE_LENGTH = 4000;
export const MESSAGE_COUNTER_THRESHOLD = 3600;

export const MIN_NAME_LENGTH = 2;
export const MAX_NAME_LENGTH = 32;

export const MIN_ROOM_NAME_LENGTH = 2;
export const MAX_ROOM_NAME_LENGTH = 40;

/** Canonical send/storage rule: leading and trailing whitespace is removed. */
export function normalizeMessageBody(raw: string): string {
  return raw.trim();
}

/**
 * Canonical length rule: count Unicode code points, not UTF-16 code units.
 * 4,000 emoji count as 4,000, not 8,000. Used identically by client and server.
 */
export function countCharacters(value: string): number {
  return Array.from(value).length;
}

/** True when `body` contains an @mention of `name` (case-insensitive, Unicode-aware). */
export function isMentionFor(body: string, name: string): boolean {
  const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return false;
  return new RegExp(`(^|\\s)@${escaped}(?=$|\\s|[.,!?;:])`, "iu").test(body);
}

export function dmKeyFor(userA: string, userB: string): string {
  return `dm:${[userA, userB].sort().join(":")}`;
}

export function isDmKey(value: string): boolean {
  return /^dm:[^:]+:[^:]+$/.test(value);
}
