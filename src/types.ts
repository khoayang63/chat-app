import { dmKeyFor, type DmPeer, type Message, type Room } from "../shared/types";

export type ActiveConversation =
  | { kind: "room"; room: Room }
  | { kind: "dm"; peer: DmPeer };

export type ConnectionStatus = "connecting" | "online" | "offline";

export type Theme = "light" | "dark";

export type Layout = "desktop" | "tablet" | "mobile";

export interface UnreadEntry {
  count: number;
  mention: boolean;
}

export type UnreadMap = Record<string, UnreadEntry>;

export interface ChatTarget {
  roomId?: string;
  dmKey?: string;
  channel: string;
}

export function targetFor(active: ActiveConversation, meId: string): ChatTarget {
  if (active.kind === "room") {
    return { roomId: active.room.id, channel: `room:${active.room.id}` };
  }
  const key = dmKeyFor(meId, active.peer.id);
  return { dmKey: key, channel: `dm:${key}` };
}

export function roomConversationKey(roomId: string): string {
  return `room:${roomId}`;
}

export function dmConversationKey(peerId: string): string {
  return `dm:${peerId}`;
}

export function conversationKeyFor(active: ActiveConversation): string {
  return active.kind === "room"
    ? roomConversationKey(active.room.id)
    : dmConversationKey(active.peer.id);
}

export function peerIdFromDmKey(dmKey: string, meId: string): string | null {
  const parts = dmKey.split(":");
  if (parts.length !== 3 || parts[0] !== "dm") return null;
  if (parts[1] === meId) return parts[2];
  if (parts[2] === meId) return parts[1];
  return null;
}

export function messageActivityConversationKey(
  activity: Pick<Message, "roomId" | "dmKey">,
  meId: string,
): string | null {
  if (activity.roomId) return roomConversationKey(activity.roomId);
  if (activity.dmKey) {
    const peerId = peerIdFromDmKey(activity.dmKey, meId);
    return peerId ? dmConversationKey(peerId) : null;
  }
  return null;
}

export function titleFor(active: ActiveConversation): string {
  return active.kind === "room" ? `#${active.room.name}` : active.peer.name;
}

export function subtitleFor(active: ActiveConversation): string {
  return active.kind === "room"
    ? "Phòng · mọi người có thể tham gia"
    : "Tin nhắn trực tiếp";
}

export function messageMatches(
  message: { roomId: string | null; dmKey: string | null },
  active: ActiveConversation,
  meId: string,
): boolean {
  return active.kind === "room"
    ? message.roomId === active.room.id
    : message.dmKey === targetFor(active, meId).dmKey;
}
