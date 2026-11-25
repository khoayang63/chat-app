import { useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import {
  MAX_ROOM_NAME_LENGTH,
  MIN_ROOM_NAME_LENGTH,
  countCharacters,
  type DmPeer,
  type Room,
  type User,
} from "../../shared/types";
import type { ActiveConversation, Theme, UnreadEntry, UnreadMap } from "../types";
import { dmConversationKey, roomConversationKey } from "../types";
import { Avatar } from "./Avatar";

interface Props {
  me: User;
  rooms: Room[];
  users: User[];
  dmPeers: DmPeer[];
  active: ActiveConversation | null;
  unread: UnreadMap;
  theme: Theme;
  isDrawerOverlay: boolean;
  sidebarRef: RefObject<HTMLElement>;
  onSelectRoom: (room: Room) => void;
  onSelectDm: (peer: DmPeer) => void;
  onCreateRoom: (name: string) => Promise<void>;
  onChangeName: () => void;
  onToggleTheme: () => void;
  onCloseDrawer: () => void;
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}

function UnreadBadge({ state }: { state: UnreadEntry | undefined }) {
  if (!state || state.count <= 0) return null;
  const mention = state.mention;
  return (
    <span
      className="unread-badge"
      data-kind={mention ? "mention" : "count"}
      aria-hidden="true"
    >
      {mention ? "@" : state.count > 99 ? "99+" : state.count}
    </span>
  );
}

function rowLabel(name: string, state: UnreadEntry | undefined, isRoom: boolean): string {
  const base = isRoom ? `#${name}` : name;
  if (!state || state.count <= 0) return base;
  return state.mention
    ? `${base}, ${state.count} tin chưa đọc, có tin nhắn nhắc đến bạn`
    : `${base}, ${state.count} tin chưa đọc`;
}

export function Sidebar({
  me,
  rooms,
  users,
  dmPeers,
  active,
  unread,
  theme,
  isDrawerOverlay,
  sidebarRef,
  onSelectRoom,
  onSelectDm,
  onCreateRoom,
  onChangeName,
  onToggleTheme,
  onCloseDrawer,
}: Props) {
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomError, setRoomError] = useState<string | null>(null);
  const [roomBusy, setRoomBusy] = useState(false);
  const [pickingUser, setPickingUser] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState("");
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const dmTriggerRef = useRef<HTMLButtonElement | null>(null);

  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

  const candidates = useMemo(() => {
    const q = fold(peopleSearch.trim());
    return users
      .filter((user) => user.id !== me.id)
      .filter((user) => !q || fold(user.name).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, me.id, peopleSearch]);

  const foldedQuery = fold(query.trim());
  const matchesName = (name: string) =>
    !foldedQuery || fold(name).includes(foldedQuery) || fold(`#${name}`).includes(foldedQuery);

  const filteredRooms = useMemo(
    () => (foldedQuery ? rooms.filter((room) => matchesName(room.name)) : rooms),
    [rooms, foldedQuery],
  );
  const filteredDms = useMemo(
    () => (foldedQuery ? dmPeers.filter((peer) => matchesName(peer.name)) : dmPeers),
    [dmPeers, foldedQuery],
  );
  const noResults =
    foldedQuery.length > 0 && filteredRooms.length === 0 && filteredDms.length === 0;

  async function submitRoom(event: FormEvent) {
    event.preventDefault();
    if (roomBusy) return;
    const normalized = roomName.trim().replace(/^#+/, "").replace(/\s+/g, "-");
    const length = countCharacters(normalized);
    if (length < MIN_ROOM_NAME_LENGTH || length > MAX_ROOM_NAME_LENGTH) {
      setRoomError(
        `Tên phòng cần từ ${MIN_ROOM_NAME_LENGTH} đến ${MAX_ROOM_NAME_LENGTH} ký tự.`,
      );
      return;
    }
    setRoomBusy(true);
    setRoomError(null);
    try {
      await onCreateRoom(roomName);
      setRoomName("");
      setCreatingRoom(false);
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : "Không tạo được phòng.");
    } finally {
      setRoomBusy(false);
    }
  }

  const drawerProps = isDrawerOverlay
    ? {
        role: "dialog" as const,
        "aria-modal": true,
        "aria-label": "Danh sách hội thoại",
      }
    : {};

  return (
    <aside id="sidebar" className="sidebar" ref={sidebarRef} aria-label="Danh sách hội thoại">
      <div className="sidebar-inner" {...drawerProps}>
      <div className="sidebar-brand">
        <span className="brand-mark sm">P</span>
        <div>
          <div className="brand-title">PTIT Chat</div>
          <div className="brand-sub">Không gian nội bộ</div>
        </div>
        {isDrawerOverlay ? (
          <button
            type="button"
            className="icon-btn drawer-close"
            aria-label="Đóng danh sách hội thoại"
            onClick={onCloseDrawer}
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
      </div>

      <nav className="sidebar-scroll" aria-label="Điều hướng hội thoại">
        <div className="sidebar-search" role="search">
          <span className="search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            ref={searchInputRef}
            id="sidebar-search"
            type="search"
            value={query}
            placeholder="Tìm phòng hoặc người"
            aria-label="Tìm phòng hoặc người"
            aria-keyshortcuts="Control+K Meta+K"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.preventDefault();
                event.stopPropagation();
                setQuery("");
              }
            }}
          />
          <kbd aria-hidden="true">{isMac ? "⌘K" : "Ctrl K"}</kbd>
        </div>

        {noResults ? (
          <p className="search-empty" role="status">
            Không tìm thấy phòng hoặc người phù hợp.
          </p>
        ) : (
          <>
            <section className="sidebar-section" aria-labelledby="rooms-heading">
              <div className="section-heading" id="rooms-heading">
                <span>Phòng</span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Tạo phòng"
                  title="Tạo phòng"
                  onClick={() => {
                    setPickingUser(false);
                    setCreatingRoom((open) => !open);
                  }}
                >
                  +
                </button>
              </div>

              {creatingRoom ? (
                <form className="inline-form" onSubmit={submitRoom}>
                  <input
                    autoFocus
                    value={roomName}
                    placeholder="ten-phong"
                    aria-label="Tên phòng"
                    onChange={(event) => setRoomName(event.target.value)}
                  />
                  <button type="submit" className="btn small" disabled={roomBusy}>
                    {roomBusy ? "…" : "Tạo"}
                  </button>
                </form>
              ) : null}
              {roomError ? <p className="form-error small">{roomError}</p> : null}

              <ul className="nav-list">
                {filteredRooms.map((room) => {
                  const selected = active?.kind === "room" && active.room.id === room.id;
                  const state = unread[roomConversationKey(room.id)];
                  return (
                    <li key={room.id}>
                      <button
                        type="button"
                        className={`nav-item${selected ? " active" : ""}`}
                        data-conversation-key={roomConversationKey(room.id)}
                        aria-current={selected ? "page" : undefined}
                        aria-label={rowLabel(room.name, state, true)}
                        onClick={() => onSelectRoom(room)}
                      >
                        <span className="hash" aria-hidden="true">
                          #
                        </span>
                        <span className="nav-label">{room.name}</span>
                        <UnreadBadge state={state} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="sidebar-section" aria-labelledby="dms-heading">
              <div className="section-heading" id="dms-heading">
                <span>Tin nhắn trực tiếp</span>
                <button
                  ref={dmTriggerRef}
                  type="button"
                  className="icon-btn"
                  aria-label="Bắt đầu trò chuyện riêng"
                  title="Bắt đầu trò chuyện riêng"
                  onClick={() => {
                    setCreatingRoom(false);
                    setPickingUser((open) => !open);
                  }}
                >
                  +
                </button>
              </div>

              {pickingUser ? (
                <div
                  className="user-picker"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      setPickingUser(false);
                      setPeopleSearch("");
                      dmTriggerRef.current?.focus();
                    }
                  }}
                >
                  <input
                    autoFocus
                    value={peopleSearch}
                    placeholder="Tìm người…"
                    aria-label="Tìm người"
                    onChange={(event) => setPeopleSearch(event.target.value)}
                  />
                  <ul className="picker-list">
                    {candidates.length === 0 ? (
                      <li className="picker-empty">Chưa có ai khác trong không gian này.</li>
                    ) : (
                      candidates.map((user) => (
                        <li key={user.id}>
                          <button
                            type="button"
                            className="picker-item"
                            onClick={() => {
                              onSelectDm({ id: user.id, name: user.name });
                              setPickingUser(false);
                              setPeopleSearch("");
                            }}
                          >
                            <Avatar name={user.name} size="sm" />
                            <span>{user.name}</span>
                            {dmPeers.some((peer) => peer.id === user.id) ? (
                              <span className="picker-existing">đang mở</span>
                            ) : null}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ) : null}

              <ul className="nav-list">
                {filteredDms.length === 0 ? (
                  normalizedEmptyState(foldedQuery)
                ) : (
                  filteredDms.map((peer) => {
                    const selected = active?.kind === "dm" && active.peer.id === peer.id;
                    const state = unread[dmConversationKey(peer.id)];
                    return (
                      <li key={peer.id}>
                        <button
                          type="button"
                          className={`nav-item${selected ? " active" : ""}`}
                          data-conversation-key={dmConversationKey(peer.id)}
                          aria-current={selected ? "page" : undefined}
                          aria-label={rowLabel(peer.name, state, false)}
                          onClick={() => onSelectDm(peer)}
                        >
                          <Avatar name={peer.name} size="sm" />
                          <span className="nav-label">{peer.name}</span>
                          <UnreadBadge state={state} />
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </section>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <Avatar name={me.name} self />
        <div className="identity">
          <div className="identity-name">{me.name}</div>
          <div className="identity-hint">Hồ sơ cục bộ</div>
        </div>
        <button
          type="button"
          className="theme-toggle"
          aria-pressed={theme === "dark"}
          aria-label={theme === "dark" ? "Tắt giao diện tối" : "Bật giao diện tối"}
          title={theme === "dark" ? "Tắt giao diện tối" : "Bật giao diện tối"}
          onClick={onToggleTheme}
        >
          <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
        </button>
        <button type="button" className="link-btn" onClick={onChangeName}>
          Đổi tên
        </button>
      </div>
      </div>
    </aside>
  );
}

function normalizedEmptyState(foldedQuery: string) {
  if (foldedQuery) return null;
  return <li className="nav-empty">Chưa có cuộc trò chuyện. Dùng + để bắt đầu.</li>;
}
