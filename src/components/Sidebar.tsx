import { useMemo, useState, type FormEvent } from "react";
import type { DmPeer, Room, User } from "../../shared/types";
import type { ActiveConversation } from "../types";
import { Avatar } from "./Avatar";

interface Props {
  me: User;
  rooms: Room[];
  users: User[];
  dmPeers: DmPeer[];
  active: ActiveConversation | null;
  onSelectRoom: (room: Room) => void;
  onSelectDm: (peer: DmPeer) => void;
  onCreateRoom: (name: string) => Promise<void>;
  onChangeName: () => void;
}

export function Sidebar({
  me,
  rooms,
  users,
  dmPeers,
  active,
  onSelectRoom,
  onSelectDm,
  onCreateRoom,
  onChangeName,
}: Props) {
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomError, setRoomError] = useState<string | null>(null);
  const [roomBusy, setRoomBusy] = useState(false);
  const [pickingUser, setPickingUser] = useState(false);
  const [search, setSearch] = useState("");

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((user) => user.id !== me.id)
      .filter((user) => !q || user.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, me.id, search]);

  async function submitRoom(event: FormEvent) {
    event.preventDefault();
    if (roomBusy) return;
    setRoomBusy(true);
    setRoomError(null);
    try {
      await onCreateRoom(roomName);
      setRoomName("");
      setCreatingRoom(false);
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : "Could not create room.");
    } finally {
      setRoomBusy(false);
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark sm">P</span>
        <div>
          <div className="brand-title">PTIT Chat</div>
          <div className="brand-sub">Internal messaging</div>
        </div>
      </div>

      <nav className="sidebar-scroll">
        <section className="sidebar-section">
          <div className="section-heading">
            <span>Rooms</span>
            <button
              type="button"
              className="icon-btn"
              title="Create room"
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
                maxLength={30}
                placeholder="new-room"
                onChange={(event) => setRoomName(event.target.value)}
              />
              <button type="submit" className="btn small" disabled={roomBusy}>
                {roomBusy ? "…" : "Add"}
              </button>
            </form>
          ) : null}
          {roomError ? <p className="form-error small">{roomError}</p> : null}

          <ul className="nav-list">
            {rooms.map((room) => {
              const selected = active?.kind === "room" && active.room.id === room.id;
              return (
                <li key={room.id}>
                  <button
                    type="button"
                    className={`nav-item${selected ? " active" : ""}`}
                    onClick={() => onSelectRoom(room)}
                  >
                    <span className="hash">#</span>
                    <span className="nav-label">{room.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="sidebar-section">
          <div className="section-heading">
            <span>Direct Messages</span>
            <button
              type="button"
              className="icon-btn"
              title="New direct message"
              onClick={() => {
                setCreatingRoom(false);
                setPickingUser((open) => !open);
              }}
            >
              +
            </button>
          </div>

          {pickingUser ? (
            <div className="user-picker">
              <input
                autoFocus
                value={search}
                placeholder="Search people…"
                onChange={(event) => setSearch(event.target.value)}
              />
              <ul className="picker-list">
                {candidates.length === 0 ? (
                  <li className="picker-empty">No other users yet.</li>
                ) : (
                  candidates.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        className="picker-item"
                        onClick={() => {
                          onSelectDm({ id: user.id, name: user.name });
                          setPickingUser(false);
                          setSearch("");
                        }}
                      >
                        <Avatar name={user.name} size="sm" />
                        <span>{user.name}</span>
                        {dmPeers.some((peer) => peer.id === user.id) ? (
                          <span className="picker-existing">open</span>
                        ) : null}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}

          <ul className="nav-list">
            {dmPeers.length === 0 ? (
              <li className="nav-empty">No conversations yet. Use + to start one.</li>
            ) : (
              dmPeers.map((peer) => {
                const selected = active?.kind === "dm" && active.peer.id === peer.id;
                return (
                  <li key={peer.id}>
                    <button
                      type="button"
                      className={`nav-item${selected ? " active" : ""}`}
                      onClick={() => onSelectDm(peer)}
                    >
                      <Avatar name={peer.name} size="sm" />
                      <span className="nav-label">{peer.name}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </section>
      </nav>

      <div className="sidebar-footer">
        <Avatar name={me.name} self />
        <div className="identity">
          <div className="identity-name">{me.name}</div>
          <div className="identity-hint">local profile</div>
        </div>
        <button type="button" className="link-btn" onClick={onChangeName}>
          Change
        </button>
      </div>
    </aside>
  );
}
