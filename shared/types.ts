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

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_NAME_LENGTH = 40;
export const MAX_ROOM_NAME_LENGTH = 30;

export function dmKeyFor(userA: string, userB: string): string {
  return `dm:${[userA, userB].sort().join(":")}`;
}

export function isDmKey(value: string): boolean {
  return /^dm:[^:]+:[^:]+$/.test(value);
}
