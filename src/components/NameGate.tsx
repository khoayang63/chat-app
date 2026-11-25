import { useState } from "react";
import type { FormEvent } from "react";
import type { User } from "../../shared/types";
import { getMe } from "../api";
import { MAX_NAME_LENGTH } from "../../shared/types";

interface Props {
  initialName: string;
  onReady: (user: User) => void;
}

export function NameGate({ initialName, onReady }: Props) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a display name to continue.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await getMe(trimmed);
      onReady(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="brand-mark">P</div>
        <h1>PTIT Messaging</h1>
        <p className="muted">
          Pick a display name to join the internal chat. No account or password needed for this MVP.
        </p>
        <form onSubmit={submit} className="gate-form">
          <label htmlFor="display-name">Display name</label>
          <input
            id="display-name"
            autoFocus
            value={name}
            maxLength={MAX_NAME_LENGTH}
            placeholder="e.g. Minh Tran"
            onChange={(event) => setName(event.target.value)}
          />
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Joining…" : "Enter chat"}
          </button>
        </form>
        <p className="fineprint">Your name is stored in this browser only (localStorage).</p>
      </div>
    </div>
  );
}
