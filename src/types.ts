import type { DmPeer, Room } from "../shared/types";

export type ActiveConversation =
  | { kind: "room"; room: Room }
  | { kind: "dm"; peer: DmPeer };

export type ConnectionStatus = "connecting" | "online" | "offline";

export interface ChatTarget {
  roomId?: string;
  dmKey?: string;
  channel: string;
}

export function targetFor(active: ActiveConversation, meId: string): ChatTarget {
  if (active.kind === "room") {
    return { roomId: active.room.id, channel: `room:${active.room.id}` };
  }
  const key = `dm:${[meId, active.peer.id].sort().join(":")}`;
  return { dmKey: key, channel: `dm:${key}` };
}

export function titleFor(active: ActiveConversation): string {
  return active.kind === "room" ? `#${active.room.name}` : active.peer.name;
}

export function subtitleFor(active: ActiveConversation): string {
  return active.kind === "room" ? "Room · everyone can join" : "Direct message";
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
