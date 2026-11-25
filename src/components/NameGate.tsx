import { useState } from "react";
import type { FormEvent } from "react";
import {
  MAX_NAME_LENGTH,
  MIN_NAME_LENGTH,
  countCharacters,
  type User,
} from "../../shared/types";
import { getMe } from "../api";

interface Props {
  initialName: string;
  onReady: (user: User) => void;
}

export function NameGate({ initialName, onReady }: Props) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const length = countCharacters(trimmed);
  const valid = length >= MIN_NAME_LENGTH && length <= MAX_NAME_LENGTH;
  const message =
    error ??
    (touched && !valid
      ? `Tên cần từ ${MIN_NAME_LENGTH} đến ${MAX_NAME_LENGTH} ký tự.`
      : null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!valid) {
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await getMe(trimmed);
      onReady(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể vào không gian làm việc.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="brand-mark">P</div>
        <h1>Chào mừng đến PTIT Chat</h1>
        <p className="muted">
          Chọn tên hiển thị để bắt đầu. Không cần đăng nhập, dữ liệu chỉ lưu trên máy bạn.
        </p>
        <form onSubmit={submit} className="gate-form">
          <label htmlFor="display-name">Tên hiển thị</label>
          <input
            id="display-name"
            autoFocus
            value={name}
            placeholder="Ví dụ: Minh Trần"
            aria-invalid={message ? true : undefined}
            aria-describedby="name-error"
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setTouched(true)}
          />
          {message ? (
            <p id="name-error" className="form-error" role="alert">
              {message}
            </p>
          ) : null}
          <button type="submit" className="btn primary" disabled={busy || !valid}>
            {busy ? "Đang vào…" : "Vào không gian làm việc"}
          </button>
        </form>
        <p className="fineprint">
          Tên chỉ được lưu trong trình duyệt này (localStorage).
        </p>
      </div>
    </div>
  );
}
