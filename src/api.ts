import type { Message, Room, User } from "../shared/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export function getMe(name: string): Promise<User> {
  return request<User>(`/api/me?name=${encodeURIComponent(name)}`);
}

export async function getRooms(): Promise<Room[]> {
  const data = await request<{ rooms: Room[] }>("/api/rooms");
  return data.rooms;
}

export async function getUsers(): Promise<User[]> {
  const data = await request<{ users: User[] }>("/api/users");
  return data.users;
}

export function createRoom(name: string): Promise<Room> {
  return request<Room>("/api/rooms", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function getMessages(target: {
  roomId?: string;
  dmKey?: string;
}): Promise<Message[]> {
  const params = new URLSearchParams();
  if (target.roomId) params.set("roomId", target.roomId);
  if (target.dmKey) params.set("dmKey", target.dmKey);
  const data = await request<{ messages: Message[] }>(`/api/messages?${params.toString()}`);
  return data.messages;
}
