import { useEffect, useRef } from "react";
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
  onSend: (body: string) => Promise<void>;
  onDismissError: () => void;
}

const connectionLabel: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  online: "Connected",
  offline: "Disconnected",
};

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function ChatPane({
  active,
  me,
  messages,
  loading,
  error,
  connection,
  online,
  onSend,
  onDismissError,
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
  const placeholder = isDm ? `Message ${active.peer.name}` : `Message #${active.room.name}`;

  return (
    <main className="chat">
      <header className="chat-header">
        <div className="chat-title">
          <h2>{titleFor(active)}</h2>
          <span className="chat-sub">{subtitleFor(active)}</span>
        </div>
        <div className="chat-status">
          {!isDm && online > 0 ? <span className="online-count">{online} online</span> : null}
          <span className={`conn conn-${connection}`}>
            <span className="conn-dot" />
            {connectionLabel[connection]}
          </span>
        </div>
      </header>

      {error ? (
        <div className="banner error" role="alert">
          <span>{error}</span>
          <button type="button" className="link-btn" onClick={onDismissError}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="messages" aria-live="polite">
        {loading ? (
          <div className="messages-empty">
            <span className="spinner" /> Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div className="messages-empty">
            <div className="empty-emoji" aria-hidden>
              #
            </div>
            <h3>{isDm ? `This is the start of your conversation with ${active.peer.name}.` : `Welcome to #${active.room.name}.`}</h3>
            <p>Messages are saved and appear instantly for everyone in this conversation.</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const own = message.senderId === me.id;
            const previous = messages[index - 1];
            const newDay = !previous || dayLabel(previous.createdAt) !== dayLabel(message.createdAt);
            const grouped =
              !newDay &&
              previous?.senderId === message.senderId &&
              new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() <
                5 * 60 * 1000;

            return (
              <div key={message.id}>
                {newDay ? <div className="day-divider">{dayLabel(message.createdAt)}</div> : null}
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
                      <span className="bubble-text">{message.body}</span>
                      <span className="bubble-time">{timeLabel(message.createdAt)}</span>
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
