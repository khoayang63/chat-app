import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  type DmPeer,
  type Message,
  type MessageActivity,
  type Room,
  type SendMessageAck,
  type User,
} from "../shared/types";
import { createRoom, getMe, getMessages, getRooms, getUsers } from "./api";
import { ChatPane } from "./components/ChatPane";
import { NameGate } from "./components/NameGate";
import { Sidebar } from "./components/Sidebar";
import type {
  ActiveConversation,
  ConnectionStatus,
  Layout,
  Theme,
  UnreadMap,
} from "./types";
import {
  conversationKeyFor,
  dmConversationKey,
  messageActivityConversationKey,
  messageMatches,
  peerIdFromDmKey,
  roomConversationKey,
  targetFor,
} from "./types";

const NAME_KEY = "ptit.displayName";
const DM_KEY = "ptit.dmPeers";
const THEME_KEY = "ptit.theme";

type Pane = "list" | "thread";

function readDmPeers(): DmPeer[] {
  try {
    const raw = localStorage.getItem(DM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is DmPeer =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as DmPeer).id === "string" &&
        typeof (item as DmPeer).name === "string",
    );
  } catch {
    return [];
  }
}

function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function initialLayout(): Layout {
  if (window.matchMedia("(min-width: 1024px)").matches) return "desktop";
  if (window.matchMedia("(min-width: 768px)").matches) return "tablet";
  return "mobile";
}

function isAttentive(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

export default function App() {
  const [me, setMe] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dmPeers, setDmPeers] = useState<DmPeer[]>(readDmPeers);
  const [active, setActive] = useState<ActiveConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionStatus>("connecting");
  const [online, setOnline] = useState(0);
  const [unread, setUnread] = useState<UnreadMap>({});
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [layout, setLayout] = useState<Layout>(initialLayout);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pane, setPane] = useState<Pane>("list");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [listReloadNonce, setListReloadNonce] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const activeRef = useRef<ActiveConversation | null>(null);
  const loadSeq = useRef(0);
  const lastLoadKeyRef = useRef<string | null>(null);
  const roomsRef = useRef<Room[]>([]);
  const dmPeersRef = useRef<DmPeer[]>([]);
  const seenMessages = useRef<Set<string>>(new Set());
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const chatRef = useRef<HTMLElement>(null);
  const savedFocusRef = useRef<HTMLElement | null>(null);
  const lastOpenedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    dmPeersRef.current = dmPeers;
  }, [dmPeers]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Storage can be unavailable; the theme still applies for this session.
    }
  }, [theme]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const tablet = window.matchMedia("(min-width: 768px)");
    function update() {
      setLayout(desktop.matches ? "desktop" : tablet.matches ? "tablet" : "mobile");
    }
    update();
    desktop.addEventListener("change", update);
    tablet.addEventListener("change", update);
    return () => {
      desktop.removeEventListener("change", update);
      tablet.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    const chat = chatRef.current;
    if (!chat) return;
    const overlay = layout === "tablet" && drawerOpen;
    (chat as HTMLElement & { inert: boolean }).inert = overlay;
    if (overlay) chat.setAttribute("aria-hidden", "true");
    else chat.removeAttribute("aria-hidden");
  }, [layout, drawerOpen, active]);

  useEffect(() => {
    if (!drawerOpen || layout !== "tablet") return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    savedFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    function focusables(): HTMLElement[] {
      return Array.from(
        sidebar?.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("disabled") && element.offsetParent !== null);
    }

    const search = document.getElementById("sidebar-search");
    (search ?? focusables()[0])?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const target = savedFocusRef.current ?? menuButtonRef.current;
      target?.focus();
    };
  }, [drawerOpen, layout]);

  useEffect(() => {
    const stored = localStorage.getItem(NAME_KEY);
    if (!stored) {
      setBooting(false);
      return;
    }
    let cancelled = false;
    getMe(stored)
      .then((user) => {
        if (!cancelled) setMe(user);
      })
      .catch(() => {
        localStorage.removeItem(NAME_KEY);
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (me) localStorage.setItem(NAME_KEY, me.name);
  }, [me]);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;

    async function refresh() {
      try {
        const [nextRooms, nextUsers] = await Promise.all([getRooms(), getUsers()]);
        if (cancelled) return;
        setRooms(nextRooms);
        setUsers(nextUsers);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không tải được dữ liệu trò chuyện.");
        }
      }
    }

    void refresh();
    const timer = setInterval(refresh, 20_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [me, listReloadNonce]);

  useEffect(() => {
    if (!me) return;

    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (layout === "tablet") setDrawerOpen(true);
        if (layout === "mobile") setPane("list");
        requestAnimationFrame(() => {
          const input = document.getElementById("sidebar-search") as HTMLInputElement | null;
          input?.focus();
          input?.select();
        });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [me, layout]);

  useEffect(() => {
    if (!me) return;
    setDmPeers((prev) => {
      const next = prev.map((peer) => {
        const fresh = users.find((user) => user.id === peer.id);
        return fresh ? { id: fresh.id, name: fresh.name } : peer;
      });
      return next.length === prev.length && next.every((peer, i) => peer.name === prev[i].name)
        ? prev
        : next;
    });
  }, [users, me]);

  useEffect(() => {
    localStorage.setItem(DM_KEY, JSON.stringify(dmPeers));
  }, [dmPeers]);

  useEffect(() => {
    if (!active && rooms.length > 0) {
      setActive({ kind: "room", room: rooms[0] });
    }
  }, [rooms, active]);

  useEffect(() => {
    if (!me) return;
    const socket = io({ path: "/socket.io" });
    socketRef.current = socket;
    setConnection("connecting");

    socket.on("connect", () => {
      setConnection("online");
      const current = activeRef.current;
      if (current) {
        const target = targetFor(current, me.id);
        socket.emit(
          "join_room",
          { roomId: target.roomId, dmKey: target.dmKey },
          (result: { ok: boolean }) => {
            if (!result?.ok) setError("Không thể tham gia cuộc trò chuyện này.");
          },
        );
      }
    });

    socket.on("disconnect", () => setConnection("offline"));
    socket.on("connect_error", () => setConnection("offline"));

    socket.on("new_message", (message: Message) => {
      const current = activeRef.current;
      const matchesActive = Boolean(current && messageMatches(message, current, me.id));
      if (!matchesActive || seenMessages.current.has(message.id)) return;
      seenMessages.current.add(message.id);

      setMessages((prev) =>
        prev.some((existing) => existing.id === message.id) ? prev : [...prev, message],
      );

      if (current && isAttentive()) {
        const key = conversationKeyFor(current);
        setUnread((prev) => {
          if (!prev[key]) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    });

    socket.on("message_activity", (activity: MessageActivity) => {
      if (activity.senderId === me.id) return;
      const key = messageActivityConversationKey(activity, me.id);
      if (!key) return;

      const peerId = activity.dmKey ? peerIdFromDmKey(activity.dmKey, me.id) : null;
      const known = activity.roomId
        ? roomsRef.current.some((room) => room.id === activity.roomId)
        : Boolean(peerId && dmPeersRef.current.some((peer) => peer.id === peerId));
      if (!known) return;

      const current = activeRef.current;
      const isActive = Boolean(current && conversationKeyFor(current) === key);
      if (isActive && isAttentive()) {
        setUnread((prev) => {
          if (!prev[key]) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
        return;
      }

      const mentioned = activity.mentions.includes(me.id);
      setUnread((prev) => ({
        ...prev,
        [key]: {
          count: (prev[key]?.count ?? 0) + 1,
          mention: prev[key]?.mention || mentioned,
        },
      }));
    });

    socket.on("presence", (payload: { channel: string; online: number }) => {
      const current = activeRef.current;
      if (!current) return;
      if (payload.channel === targetFor(current, me.id).channel) {
        setOnline(payload.online);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [me]);

  useEffect(() => {
    if (!me || !active) return;
    const key = conversationKeyFor(active);

    function maybeClear() {
      if (!isAttentive()) return;
      setUnread((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }

    const frame = requestAnimationFrame(maybeClear);
    window.addEventListener("focus", maybeClear);
    document.addEventListener("visibilitychange", maybeClear);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("focus", maybeClear);
      document.removeEventListener("visibilitychange", maybeClear);
    };
  }, [me, active]);

  useEffect(() => {
    if (!me || !active) return;
    const requestId = ++loadSeq.current;
    const conversationKey = conversationKeyFor(active);
    if (lastLoadKeyRef.current !== conversationKey) {
      lastLoadKeyRef.current = conversationKey;
      setMessages([]);
    }
    setLoading(true);
    setError(null);
    setOnline(0);

    const target = targetFor(active, me.id);
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit(
        "join_room",
        { roomId: target.roomId, dmKey: target.dmKey },
        (result: { ok: boolean; error?: string }) => {
          if (!result?.ok) setError(result?.error ?? "Không thể tham gia cuộc trò chuyện này.");
        },
      );
    }

    getMessages({ roomId: target.roomId, dmKey: target.dmKey })
      .then((history) => {
        if (loadSeq.current !== requestId) return;
        setMessages(history);
      })
      .catch((err) => {
        if (loadSeq.current !== requestId) return;
        setError(err instanceof Error ? err.message : "Không tải được tin nhắn.");
      })
      .finally(() => {
        if (loadSeq.current === requestId) {
          setLoading(false);
          setRetrying(false);
        }
      });
  }, [me, active, reloadNonce]);

  async function handleSend(body: string): Promise<void> {
    const socket = socketRef.current;
    const current = activeRef.current;
    if (!me || !current) throw new Error("Hãy chọn một cuộc trò chuyện trước.");
    if (!socket?.connected) throw new Error("Mất kết nối — đang thử lại…");

    const target = targetFor(current, me.id);
    await new Promise<void>((resolve, reject) => {
      socket.timeout(8000).emit(
        "send_message",
        {
          roomId: target.roomId,
          dmKey: target.dmKey,
          senderId: me.id,
          senderName: me.name,
          body,
        },
        (timeoutError: Error | null, response?: SendMessageAck) => {
          if (timeoutError) {
            reject(new Error("Máy chủ không phản hồi. Vui lòng thử lại."));
            return;
          }
          if (!response?.ok) {
            reject(new Error(response?.error ?? "Gửi tin thất bại · Kiểm tra kết nối và thử lại."));
            return;
          }
          if (response.message) {
            const value = response.message;
            setMessages((prev) =>
              prev.some((existing) => existing.id === value.id) ? prev : [...prev, value],
            );
          }
          resolve();
        },
      );
    });
  }

  function focusConversationHeading() {
    if (layout === "desktop") return;
    requestAnimationFrame(() => {
      document.getElementById("conversation-heading")?.focus();
    });
  }

  async function handleCreateRoom(name: string): Promise<void> {
    const room = await createRoom(name);
    setRooms((prev) =>
      prev.some((existing) => existing.id === room.id)
        ? prev
        : [...prev, room].sort((a, b) => a.name.localeCompare(b.name)),
    );
    lastOpenedKeyRef.current = roomConversationKey(room.id);
    setMessages([]);
    setActive({ kind: "room", room });
    setDrawerOpen(false);
    setPane("thread");
    focusConversationHeading();
  }

  function handleSelectRoom(room: Room) {
    lastOpenedKeyRef.current = roomConversationKey(room.id);
    setMessages([]);
    setActive({ kind: "room", room });
    setDrawerOpen(false);
    setPane("thread");
    focusConversationHeading();
  }

  function handleSelectDm(peer: DmPeer) {
    setDmPeers((prev) =>
      prev.some((existing) => existing.id === peer.id)
        ? prev.map((existing) => (existing.id === peer.id ? peer : existing))
        : [...prev, peer].sort((a, b) => a.name.localeCompare(b.name)),
    );
    lastOpenedKeyRef.current = dmConversationKey(peer.id);
    setMessages([]);
    setActive({ kind: "dm", peer });
    setDrawerOpen(false);
    setPane("thread");
    focusConversationHeading();
  }

  function handleBack() {
    setPane("list");
    requestAnimationFrame(() => {
      const key = lastOpenedKeyRef.current;
      const row = key
        ? document.querySelector<HTMLElement>(`[data-conversation-key="${key}"]`)
        : null;
      const fallback =
        document.getElementById("sidebar-search") ??
        document.querySelector<HTMLElement>('[data-conversation-key^="room:"]');
      (row ?? fallback)?.focus();
    });
  }

  function handleRetry() {
    setRetrying(true);
    setError(null);
    setReloadNonce((value) => value + 1);
    setListReloadNonce((value) => value + 1);
  }

  function handleChangeName() {
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(DM_KEY);
    setDmPeers([]);
    setMe(null);
    setActive(null);
    setMessages([]);
    setError(null);
    setOnline(0);
    setUnread({});
    setDrawerOpen(false);
    setPane("list");
    setRetrying(false);
  }

  if (booting) {
    return (
      <div className="gate">
        <div className="gate-card centered">
          <span className="spinner large" /> <p className="muted">Đang khôi phục hồ sơ…</p>
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <NameGate
        initialName={localStorage.getItem(NAME_KEY) ?? ""}
        onReady={(user) => {
          setMe(user);
        }}
      />
    );
  }

  return (
    <div
      className="app"
      data-layout={layout}
      data-drawer={drawerOpen ? "open" : "closed"}
      data-pane={pane}
    >
      <Sidebar
        me={me}
        rooms={rooms}
        users={users}
        dmPeers={dmPeers}
        active={active}
        unread={unread}
        theme={theme}
        isDrawerOverlay={layout === "tablet"}
        sidebarRef={sidebarRef}
        onSelectRoom={handleSelectRoom}
        onSelectDm={handleSelectDm}
        onCreateRoom={handleCreateRoom}
        onChangeName={handleChangeName}
        onToggleTheme={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
        onCloseDrawer={() => setDrawerOpen(false)}
      />
      {layout === "tablet" && drawerOpen ? (
        <div
          className="app-scrim"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}
      {active ? (
        <ChatPane
          active={active}
          me={me}
          messages={messages}
          loading={loading}
          error={error}
          connection={connection}
          online={online}
          drawerOpen={drawerOpen}
          retrying={retrying}
          chatRef={chatRef}
          menuButtonRef={menuButtonRef}
          onSend={handleSend}
          onDismissError={() => setError(null)}
          onRetry={handleRetry}
          onOpenSidebar={() => setDrawerOpen(true)}
          onBack={handleBack}
        />
      ) : (
        <main className="chat chat-idle" ref={chatRef}>
          <div className="messages-empty">
            <h3>Chưa có cuộc trò chuyện</h3>
            <p>Chọn một phòng hoặc bắt đầu tin nhắn trực tiếp từ thanh bên.</p>
          </div>
        </main>
      )}
    </div>
  );
}
