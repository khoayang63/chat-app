import { useState } from "react";
import { MAX_MESSAGE_LENGTH } from "../../shared/types";

interface Props {
  disabled?: boolean;
  placeholder: string;
  onSend: (body: string) => Promise<void>;
}

export function Composer({ disabled = false, placeholder, onSend }: Props) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const body = value.trim();
    if (!body || busy || disabled) return;
    if (body.length > MAX_MESSAGE_LENGTH) {
      setError(`Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSend(body);
      setValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="composer-wrap">
      {error ? (
        <div className="composer-error" role="alert">
          {error}
        </div>
      ) : null}
      <div className="composer">
        <textarea
          rows={1}
          value={value}
          maxLength={MAX_MESSAGE_LENGTH + 100}
          placeholder={placeholder}
          disabled={disabled || busy}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <button
          type="button"
          className="btn primary send-btn"
          onClick={() => void submit()}
          disabled={disabled || busy || !value.trim()}
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
      <div className="composer-meta">
        <span>Enter to send · Shift+Enter for a new line</span>
        {value.length > MAX_MESSAGE_LENGTH * 0.9 ? (
          <span className={value.length > MAX_MESSAGE_LENGTH ? "over-limit" : ""}>
            {value.length}/{MAX_MESSAGE_LENGTH}
          </span>
        ) : null}
      </div>
    </div>
  );
}
