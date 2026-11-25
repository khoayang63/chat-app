import { useState } from "react";
import {
  MAX_MESSAGE_LENGTH,
  MESSAGE_COUNTER_THRESHOLD,
  countCharacters,
  normalizeMessageBody,
} from "../../shared/types";

interface Props {
  disabled?: boolean;
  placeholder: string;
  onSend: (body: string) => Promise<void>;
}

const OVER_LIMIT_COPY =
  "Tin nhắn vượt quá 4.000 ký tự. Vui lòng rút ngắn rồi gửi lại.";

export function Composer({ disabled = false, placeholder, onSend }: Props) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const body = normalizeMessageBody(value);
  const count = countCharacters(body);
  const overLimit = count > MAX_MESSAGE_LENGTH;
  const showCounter = count >= MESSAGE_COUNTER_THRESHOLD;
  const alertMessage = overLimit ? OVER_LIMIT_COPY : error;

  async function submit() {
    if (!body || overLimit || busy || disabled) return;
    setBusy(true);
    setError(null);
    try {
      await onSend(body);
      setValue("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gửi tin thất bại · Kiểm tra kết nối và thử lại.",
      );
    } finally {
      setBusy(false);
    }
  }

  const describedBy = showCounter ? "composer-hint composer-count" : "composer-hint";

  return (
    <div className="composer-wrap">
      {alertMessage ? (
        <div className="composer-error" role="alert">
          {alertMessage}
        </div>
      ) : null}
      <div className="composer">
        <textarea
          rows={1}
          value={value}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-invalid={overLimit || undefined}
          aria-describedby={describedBy}
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
          disabled={disabled || busy || count === 0 || overLimit}
        >
          {busy ? "Đang gửi…" : "Gửi"}
        </button>
      </div>
      <div className="composer-meta">
        <span id="composer-hint" className="composer-hint">
          Enter để gửi · Shift + Enter để xuống dòng
        </span>
        {showCounter ? (
          <span
            id="composer-count"
            className={`composer-count${overLimit ? " over-limit" : ""}`}
          >
            {count}/{MAX_MESSAGE_LENGTH}
          </span>
        ) : null}
      </div>
    </div>
  );
}
