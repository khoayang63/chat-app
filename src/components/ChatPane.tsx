import { useEffect, useRef, type RefObject } from "react";
import type { Message, User } from "../../shared/types";
import type { ActiveConversation, ConnectionStatus } from "../types";
import { subtitleFor, titleFor } from "../types";
import { Avatar } from "./Avatar";
import { Composer } from "./Composer";

interface Props {
  active: ActiveConversation;
  me: User;
  messages: Message[];
  loading: boolean;
  error: string | null;
  connection: ConnectionStatus;
  online: number;
  drawerOpen: boolean;
  retrying: boolean;
  chatRef: RefObject<HTMLElement>;
  menuButtonRef: RefObject<HTMLButtonElement>;
  onSend: (body: string) => Promise<void>;
  onDismissError: () => void;
  onRetry: () => void;
  onOpenSidebar: () => void;
  onBack: () => void;
}

const connectionLabel: Record<ConnectionStatus, string> = {
  connecting: "Đang kết nối…",
  online: "Đã kết nối",
  offline: "Mất kết nối",
};

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const fullDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

interface DayInfo {
  label: string;
  isoDate: string;
  fullLabel: string;
}

function dayInfo(iso: string): DayInfo {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  let label: string;
  if (sameDay(date, today)) label = "Hôm nay";
  else if (sameDay(date, yesterday)) label = "Hôm qua";
  else label = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  return {
    label,
    isoDate: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    fullLabel: fullDateFormatter.format(date),
  };
}

function timeLabel(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

function fullTimeLabel(iso: string): string {
  return `${fullDateFormatter.format(new Date(iso))} ${timeLabel(iso)}`;
}

export function ChatPane({
  active,
  me,
  messages,
  loading,
  error,
  connection,
  online,
  drawerOpen,
  retrying,
  chatRef,
  menuButtonRef,
  onSend,
  onDismissError,
  onRetry,
  onOpenSidebar,
  onBack,
}: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastCount = useRef(0);

  useEffect(() => {
    const behavior = messages.length !== lastCount.current ? "smooth" : "auto";
    bottomRef.current?.scrollIntoView({ block: "end", behavior });
    lastCount.current = messages.length;
  }, [messages, active]);

  useEffect(() => {
    lastCount.current = 0;
  }, [active]);

  const isDm = active.kind === "dm";
  const placeholder = isDm ? `Nhắn cho ${active.peer.name}` : `Nhắn gửi tới #${active.room.name}`;
  const threadLabel = isDm
    ? `Tin nhắn trực tiếp với ${active.peer.name}`
    : `Tin nhắn trong #${active.room.name}`;

  return (
    <main className="chat" ref={chatRef}>
      <header className="chat-header">
        <button
          ref={menuButtonRef}
          type="button"
          className="icon-btn menu-btn"
          aria-label="Mở danh sách hội thoại"
          aria-expanded={drawerOpen}
          aria-controls="sidebar"
          onClick={onOpenSidebar}
        >
          <span aria-hidden="true">☰</span>
        </button>
        <button
          type="button"
          className="icon-btn back-btn"
          aria-label="Quay lại danh sách hội thoại"
          onClick={onBack}
        >
          <span aria-hidden="true">←</span>
        </button>
        <div className="chat-title">
          <h2 id="conversation-heading" tabIndex={-1}>
            {titleFor(active)}
          </h2>
          <span className="chat-sub">{subtitleFor(active)}</span>
        </div>
        <div className="chat-status">
          {!isDm && online > 0 ? (
            <span className="online-count">{online} đang hoạt động</span>
          ) : null}
          <span className={`conn conn-${connection}`} role="status" aria-live="polite">
            <span className="conn-dot" aria-hidden="true" />
            {connectionLabel[connection]}
          </span>
        </div>
      </header>

      {error || retrying ? (
        <div className="banner error" role="alert" aria-busy={retrying}>
          <div className="banner-text">
            <strong>{retrying ? "Đang thử lại…" : "Không tải được tin nhắn"}</strong>
            {retrying ? null : <span>Kiểm tra kết nối rồi thử lại.</span>}
          </div>
          <div className="banner-actions">
            <button
              type="button"
              className="btn small"
              onClick={onRetry}
              disabled={retrying}
            >
              {retrying ? "Đang thử lại…" : "Thử lại"}
            </button>
            <button type="button" className="link-btn" onClick={onDismissError}>
              Đóng
            </button>
          </div>
        </div>
      ) : null}

      <div
        className="messages"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={threadLabel}
        aria-busy={loading ? "true" : undefined}
      >
        {loading && messages.length === 0 ? (
          <div className="messages-empty">
            <span className="spinner" aria-hidden="true" />
            <span role="status">Đang tải tin nhắn…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="messages-empty">
            <div className="empty-emoji" aria-hidden="true">
              #
            </div>
            <h3>
              {isDm ? `Bắt đầu trò chuyện với ${active.peer.name}` : "Chưa có tin nhắn"}
            </h3>
            <p>
              {isDm
                ? "Tin nhắn được lưu và hiển thị ngay cho mọi người trong cuộc trò chuyện này."
                : `Đây là khởi đầu của #${active.room.name}. Gửi lời chào đầu tiên để mở màn cuộc trò chuyện.`}
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const own = message.senderId === me.id;
            const previous = messages[index - 1];
            const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
            const grouped =
              !newDay &&
              previous?.senderId === message.senderId &&
              new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() <
                5 * 60 * 1000;
            const day = newDay ? dayInfo(message.createdAt) : null;

            return (
              <div key={message.id}>
                {day ? (
                  <time
                    className="day-divider"
                    dateTime={day.isoDate}
                    aria-label={day.fullLabel}
                  >
                    {day.label}
                  </time>
                ) : null}
                <div className={`message-row${own ? " own" : ""}${grouped ? " grouped" : ""}`}>
                  {own ? null : grouped ? (
                    <span className="avatar-spacer" />
                  ) : (
                    <Avatar name={message.senderName} size="sm" />
                  )}
                  <div className="message-body">
                    {!own && !grouped ? (
                      <div className="message-sender">{message.senderName}</div>
                    ) : null}
                    <div className={`bubble${own ? " bubble-own" : ""}`}>
                      {grouped ? (
                        <span className="sr-only">{message.senderName}: </span>
                      ) : null}
                      <span className="bubble-text">{message.body}</span>
                      <time
                        className="bubble-time"
                        dateTime={message.createdAt}
                        title={fullTimeLabel(message.createdAt)}
                      >
                        {timeLabel(message.createdAt)}
                      </time>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <Composer placeholder={placeholder} onSend={onSend} />
    </main>
  );
}
