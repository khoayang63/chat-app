# PTI-40 Addendum — Binding hardening decisions (responsive, badges, length, a11y, search, copy, dark theme)

Status: Ready for implementation
Owner: UI/UX Designer
Parent issue: PTI-40
This issue: PTI-41
Consumers: PTI-42 (implementation), PTI-43 (QA), PTI-44 (visual/a11y review)
Sources of truth: `design/DESIGN-SPEC.md`, `design/tokens.css`, `design/USABILITY-CHECKLIST.md`, `TEST-REPORT.md` section 7, current `src/`.

This addendum is **binding**. Where it is silent, `DESIGN-SPEC.md` wins. Where the current code disagrees with this file, this file wins for PTI-40 scope. Do not leave a listed decision to developer interpretation.

**Current-state note (read before coding):** at authoring time the `src/` tree was the pre-hardening MVP: `MAX_MESSAGE_LENGTH = 2000`, `MAX_NAME_LENGTH = 40`, `MAX_ROOM_NAME_LENGTH = 30`, only a `max-width: 760px` tweak, no unread badges, no drawer, no `<time datetime>`, no `aria-current`, no `aria-label` on icon buttons, no `role="log"`, no dark toggle, and English microcopy. If implementation has already moved past that baseline, this file is still the contract for PTI-40 scope.

Relative paths only. Do not edit `design/` files from PTI-42; token changes are not required (this addendum uses existing tokens). Do not implement the explicitly deferred items at the end.

---

## 0. Shared constants and helpers (single source of truth)

Add to `shared/types.ts` and import from both client and server. Do not duplicate numbers or rules elsewhere.

```ts
export const MAX_MESSAGE_LENGTH = 4000;
export const MESSAGE_COUNTER_THRESHOLD = 3600; // counter becomes visible at >= this value

export const MIN_NAME_LENGTH = 2;
export const MAX_NAME_LENGTH = 32;

export const MIN_ROOM_NAME_LENGTH = 2;
export const MAX_ROOM_NAME_LENGTH = 40;

/** Canonical send/storage rule: leading and trailing whitespace is removed. */
export function normalizeMessageBody(raw: string): string {
  return raw.trim();
}

/**
 * Canonical length rule: count Unicode code points, not UTF-16 code units.
 * 4,000 emoji count as 4,000, not 8,000. Used identically by client and server.
 */
export function countCharacters(value: string): number {
  return Array.from(value).length;
}

/** True when `body` contains an @mention of `name` (case-insensitive, Unicode-aware). */
export function isMentionFor(body: string, name: string): boolean {
  const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return false;
  return new RegExp(`(^|\\s)@${escaped}(?=$|\\s|[.,!?;:])`, "iu").test(body);
}
```

Rules:
- There is exactly one display-name limit (2–32) under `MIN_NAME_LENGTH`/`MAX_NAME_LENGTH`; do not add a second alias.
- The message body is validated/sent/stored as `normalizeMessageBody(raw)`; `countCharacters(normalized)` is the only length number shown or enforced.
- Existing `README.md` references to 2,000 must be updated to 4,000 in PTI-42.
- Tests RT-05/RT-06 must move to the 4,000 boundary: 4,000 accepts, 4,001 rejects, both by code points.

---

## 1. Responsive layout (UI-01)

### 1.1 Breakpoints (literal values; CSS variables cannot drive media queries)

| Range | Layout | Sidebar | Conversation |
|---|---|---|---|
| `>= 1280px` | two-pane | `288px` fixed | fluid, thread/composer max `760px` |
| `1024px – 1279.98px` | two-pane | `240px` fixed | fluid, side padding `20–24px` |
| `768px – 1023.98px` | drawer | `300px` overlay + scrim | full width, thread max `760px` |
| `< 768px` | single pane | full-screen list | full-screen thread + back |

Use exactly these media queries and delete the current `@media (max-width: 760px)` block in `src/styles.css` (it is not a design breakpoint).

```css
@media (min-width: 1024px) { /* two-pane */ }
@media (min-width: 1024px) and (max-width: 1279.98px) { :root { --sidebar-width: 240px; } }
@media (min-width: 768px) and (max-width: 1023.98px) { /* drawer */ }
@media (max-width: 767.98px) { /* single pane */ }
```

At `200%` zoom the effective CSS viewport falls under `768px`; the `<768px` rules must therefore be the reflow path. No JS zoom handling.

### 1.2 DOM / state contract

`App` owns layout state and sets `data-*` attributes on the root `.app` element so CSS is the only layout switch:

- `data-layout="desktop" | "tablet" | "mobile"` — from `matchMedia` listeners on the two breakpoints (`(min-width:1024px)` and `(min-width:768px)`). Update on `change`, not on every resize tick.
- `data-drawer="open" | "closed"` — tablet only.
- `data-pane="list" | "thread"` — mobile only.

Required nodes and hooks:

- `.sidebar` — add `id="sidebar"`, `<aside>` wrapping `<nav aria-label="Điều hướng hội thoại">`.
- `.chat` — `<main>`; when the tablet drawer is open it must be `inert` and `aria-hidden="true"` (set `element.inert = true` via ref; React 18 typings may not expose the prop).
- `.app-scrim` — `<div className="app-scrim" aria-hidden="true" />`, rendered only on tablet when drawer is open.
- `.menu-btn` — icon-only button at the start of `.chat-header`, `aria-label="Mở danh sách hội thoại"`, `aria-expanded={drawerOpen}`, `aria-controls="sidebar"`. Visible only on tablet.
- `.back-btn` — icon-only button at the start of `.chat-header`, `aria-label="Quay lại danh sách hội thoại"`. Visible only on mobile while `data-pane="thread"`.
- `.drawer-close` — icon-only button inside the tablet drawer header, `aria-label="Đóng danh sách hội thoại"`.

Sidebar content order: brand header (existing) → **search** (section 7) → Rooms → Direct messages → footer (theme toggle + identity).

### 1.3 Two-pane (`>= 1024px`)

- `.app { display: grid; grid-template-columns: var(--sidebar-width) minmax(0, 1fr); height: 100dvh; overflow: hidden; }`
- Sidebar and conversation each scroll independently; `body` never scrolls. Keep `min-width: 0; min-height: 0` on the conversation column.
- `1024–1279.98px`: sidebar `240px`; `.nav-label` already truncates with ellipsis — keep it and add `min-width: 0` to the flex row. Footer must not wrap.

### 1.4 Tablet drawer (`768px – 1023.98px`)

- `.app { grid-template-columns: minmax(0, 1fr); }`
- `.sidebar { position: fixed; inset: 0 auto 0 0; width: 300px; max-width: calc(100vw - 48px); transform: translateX(-100%); transition: transform var(--duration-base) var(--ease-standard); z-index: var(--z-modal); }`
- `.app[data-drawer="open"] .sidebar { transform: translateX(0); }`
- `.app-scrim { position: fixed; inset: 0; background: var(--color-overlay); z-index: var(--z-overlay); }`
- Scrim click and `Escape` close the drawer and restore focus to `.menu-btn`.
- Focus trap while open: save `document.activeElement`; focus `#sidebar-search` (or the first focusable element); on `Tab`/`Shift+Tab`, wrap between the first and last focusable descendant; on close restore the saved element. Never move focus behind the scrim.
- `aria-modal="true"` and `role="dialog"` must be on an inner drawer wrapper **only while the drawer is an overlay** (add `role="dialog" aria-modal="true" aria-label="Danh sách hội thoại"`; remove those attributes/role on desktop, where it is a normal `<aside>`). Do not hard-code `aria-modal` on the always-present `<aside>`.
- Selecting a room/DM at tablet closes the drawer and moves focus to the conversation heading (or composer on a fine pointer). Do not leave focus inside a hidden off-canvas sidebar.

### 1.5 Mobile single pane (`< 768px`)

- `.app { grid-template-columns: minmax(0, 1fr); }`
- `.app[data-pane="list"] .chat { display: none; }`
- `.app[data-pane="thread"] .sidebar { display: none; }`
- No active conversation => `data-pane="list"`. Selecting a room/DM sets `data-pane="thread"` and shows `.back-btn`.
- Back button sets `data-pane="list"` and restores focus to the row that opened the thread. Exact fallback if that row no longer exists: focus `#sidebar-search`; if that is unavailable, focus the first room row button.
- Do **not** auto-focus the composer when opening a thread on touch (`pointer: coarse`); it opens the keyboard over the thread. Move focus to the conversation heading (`tabIndex={-1}`) so screen readers announce it. Desktop keeps composer auto-focus.
- Composer is the last flex child of `.chat` below the independently scrolling `.messages` region:
  - `.chat { height: 100dvh; min-height: 0; }`
  - `.messages { flex: 1 1 auto; min-height: 0; overflow-y: auto; }`
  - `.composer-wrap { flex: none; position: sticky; bottom: 0; background: var(--color-bg); padding-bottom: calc(12px + env(safe-area-inset-bottom)); }`
- Header at `<= 480px`: hide the `online-count` text, keep the connection pill; truncate `.chat-title h2`; never let header actions push the title off-screen (`min-width: 0` + `flex: none` on actions).

### 1.6 320px / no horizontal scroll

- Bubbles: `max-width: min(680px, 85%)` under `<768px` (spec mobile max 85%), `overflow-wrap: anywhere`, `word-break: break-word`.
- All flex/grid children that contain text get `min-width: 0`; `.nav-label` keeps `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`.
- `.app`, `.sidebar`, `.chat`, `.composer-wrap`, `.messages` must not exceed `100%` width. Do not "fix" overflow only with `body { overflow-x: hidden }`; remove the cause.
- Verify at exactly `320px` with a long unbroken URL and a 4,000-character word run: no horizontal scrollbar on `html`, `body`, `.messages`, `.chat`.
- Long content remains selectable; no `overflow: hidden` on `.bubble-text` that would clip text.

### 1.7 Touch targets

- Fine pointer: icon buttons `34×34px` (spec IconButton), nav rows `36px`.
- `@media (pointer: coarse)`, and always at `<= 1023.98px`: every interactive control has a hit area of at least `40×40px` (prefer `44×44px`); nav rows `min-height: 44px`; send button `min-height: 40px; min-width: 44px`.
- Visible glyph may stay 18–20px; the hit area is what must grow (padding/min-size), never a layout-shifting transform.
- The 26px `.icon-btn` in current `styles.css` is a defect; replace with the sizes above.

### 1.8 Z-index and motion

- Scrim `var(--z-overlay)`, drawer `var(--z-modal)`, toast `var(--z-toast)`.
- Drawer transition uses `--duration-base`/`--ease-standard`; under `prefers-reduced-motion: reduce` the drawer appears/disappears with no transform animation.

---

## 2. Unread and mention badges (UI-02)

### 2.1 Data flow (required; current server only notifies the joined channel)

The client joins only the active conversation, so it cannot see activity elsewhere. Add a body-free activity event:

- In `server/index.ts`, after `io.to(channel).emit("new_message", message)`, also emit to every connected client. Compute mentioned user ids server-side (the server already imports `listUsers`; add `isMentionFor` to the `shared/types` import):
  ```ts
  const mentions = listUsers()
    .filter((user) => isMentionFor(message.body, user.name))
    .map((user) => user.id);
  io.emit("message_activity", {
    id: message.id,
    roomId: message.roomId,
    dmKey: message.dmKey,
    senderId: message.senderId,
    senderName: message.senderName,
    createdAt: message.createdAt,
    mentions,
  });
  ```
- Add `MessageActivity` to `shared/types.ts` as `Omit<Message, "body"> & { mentions: string[] }`. The activity event must never include `body` (DM content stays out of unrelated clients); only the mentioned user ids are shared. This lets `@` work for non-active conversations without leaking message text. This is a local demo trade-off: the event reveals that a conversation received a message and which users were mentioned, not its content. If a future task adds auth/user channels, replace the global emit with per-recipient delivery; do not expand this scope now.

### 2.2 Client state

- `type UnreadEntry = { count: number; mention: boolean }`
- `const [unread, setUnread] = useState<Record<string, UnreadEntry>>({})`
- Conversation key:
  - room: `room:${room.id}`
  - DM: `dm:${peer.id}` (resolve the peer from `dmKey` by taking the `dm:` segment that is not `me.id`)
- Initial state is empty on load (session-only). Do not invent persisted unread; `DESIGN-SPEC.md` section 12 persistence is out of PTI-40 scope and PTI-40 does not require reload persistence. State this in the implementation comment.

### 2.3 Increment rule

On `message_activity`:
1. Ignore if `senderId === me.id`.
2. Compute the entry key; ignore if the room/DM is not present in the sidebar data.
3. Let `isActive` = key equals the active conversation key.
4. Let `isAttentive` = `document.visibilityState === "visible" && document.hasFocus()`.
5. If `isActive && isAttentive`, do **not** increment (the open, focused room is being read).
6. Otherwise increment `count`, and set `mention = true` when `activity.mentions.includes(me.id)`.
   - Mention detection is identical in the sidebar and the active thread; `@` is not limited to the open conversation. No message body is needed on the client to update a non-active row.
   - The server-side rule uses `isMentionFor(body, user.name)` from section 0; it is case-insensitive and Unicode-aware, and requires the mention to start at the beginning of the body or after whitespace and end at the body end or before whitespace/punctuation.
7. Do not reorder rooms or DMs when counts change (`DESIGN-SPEC.md` section 9).

### 2.4 Clear rule

Clear a key only when **both** are true: the conversation is active, and `document.visibilityState === "visible"` and `document.hasFocus()`.

- On selecting a conversation, clear after paint (`requestAnimationFrame`) only if attentive.
- Add `window.addEventListener("focus", clearActive)` and `document.addEventListener("visibilitychange", clearActive)`; remove them on cleanup.
- When the tab/window is blurred, incoming messages for the open room still increment unread. On refocus, clear the active conversation.
- Keep focus/visibility listeners independent of socket lifecycle.

### 2.5 Badge visuals

- Markup: `<span className="unread-badge" data-kind="count|mention">` inside the row button, after the label; `flex: none`. Do not let the label push the badge (label already ellipsizes).
- Number: `min-width: 20px; height: 20px; padding: 0 6px; border-radius: var(--radius-full); background: var(--color-unread-bg); color: var(--color-unread-text); font-size: var(--text-2xs); font-weight: var(--weight-bold); line-height: 20px; text-align: center; font-variant-numeric: tabular-nums;`
- Mention: identical geometry, content `@`, `data-kind="mention"`, background `var(--color-mention-bg)`, color `var(--color-mention-text)`.
- Count display: `count > 99 ? "99+" : String(count)`; aria-label always carries the true count.
- Precedence: mention (`@`) replaces the numeric count. Never render both.
- No badge when `count === 0` and no mention.
- Contrast: `--color-unread-text` on `--color-unread-bg` is the accent pair — light white on `#4338ca` = 7.9:1, dark white on `#4f46e5` = 6.3:1 (spec section 8.1). Do not introduce new colors.
- Non-color signal: the visible numeral or `@` is the signal; the badge must never be an empty colored dot.
- No layout shift: reserve badge space via `margin-left: auto` and `flex: none`; the label truncates first.

### 2.6 Accessible name

The row `<button>` gets an explicit `aria-label`; do not rely on the visual `@`/number being concatenated:

- Room with count: `#${room.name}, ${count} tin chưa đọc`
- Room with mention: `#${room.name}, ${count} tin chưa đọc, có tin nhắn nhắc đến bạn`
- Room with neither: `#${room.name}`
- DM with count: `${peer.name}, ${count} tin chưa đọc`
- DM with mention: `${peer.name}, ${count} tin chưa đọc, có tin nhắn nhắc đến bạn`
- DM with neither: `${peer.name}`

Active row: `aria-current="page"` (and keep the same label). Add `aria-current` to both room and DM buttons.

---

## 3. Message length (UI-04)

- One constant: `MAX_MESSAGE_LENGTH = 4000`; counter threshold `3600`; both from `shared/types.ts`.
- Counting rule (section 0): normalize with `trim()`, then count Unicode code points. Client and server must call the same helpers. Emoji count as one each.
- Server `send_message`:
  ```ts
  const body = normalizeMessageBody(typeof payload.body === "string" ? payload.body : "");
  if (!body) {
    ack({ ok: false, error: "Tin nhắn không được để trống." });
    return;
  }
  if (countCharacters(body) > MAX_MESSAGE_LENGTH) {
    ack({ ok: false, error: "Tin nhắn vượt quá 4.000 ký tự. Vui lòng rút ngắn rồi gửi lại." });
    return;
  }
  ```
- Client `Composer`:
  - Remove the `MAX_MESSAGE_LENGTH + 100` hack. Remove the `maxLength` attribute entirely — HTML `maxLength` counts UTF-16 code units and would block emoji before 4,000 code points. Enforce in code.
  - `const count = countCharacters(value.trim())`.
  - Send is disabled when `count === 0 || count > 4000 || busy || disabled`.
  - Do not truncate or rewrite the user's text when over the limit; keep the text and show the error/disabled state.
  - Counter: render `<span id="composer-count" className="composer-count">` only when `count >= 3600`, text `${count}/4000` (plain slash, group as `4.000` only in prose copy, not the live counter to avoid locale ambiguity). Apply `.over-limit` when `count > 4000`.
  - Textarea: `aria-describedby` includes `composer-hint` and `composer-count` while the counter is visible; `aria-invalid={count > 4000}`.
  - Error copy when over limit: `Tin nhắn vượt quá 4.000 ký tự. Vui lòng rút ngắn rồi gửi lại.` Render in the composer error region with `role="alert"` once, not on every keystroke. Do not use a live region for the counter itself.
- Preserve newlines (`white-space: pre-wrap`) and wrap long tokens (`overflow-wrap: anywhere`).
- Update `README.md` (2,000 → 4,000, counter 3,600) and the tests to the 4,000 boundary.
- No separate "server error" wording: keep the client and server copy identical (above).

---

## 4. Display name and room name lengths

- Display name: trimmed `2–32` code points, client and server.
  - `parseDisplayName` in `server/index.ts`: trim; reject if `countCharacters(name) < 2 || countCharacters(name) > 32`; keep the control-character rejection.
  - `/api/me` error: `Tên cần từ 2 đến 32 ký tự.` (same string as the client inline error)
  - `NameGate`: local validity is the same rule (`countCharacters(trimmed)`), not `String.length`; the submit button is disabled until valid. Do not rely on the input's `maxLength` to enforce Unicode names: omit `maxLength` or set a loose code-unit guard (2× the limit), then validate with `countCharacters`. Show the inline error on blur and on submit. Wire `aria-invalid` and `aria-describedby="name-error"`; the error element is `role="alert"`.
  - On submit, send the trimmed name.
- Room name: trimmed `2–40` code points after existing normalization (lowercase slug). Keep `MAX_ROOM_NAME_LENGTH = 40`.
  - Errors: `Tên phòng cần từ 2 đến 40 ký tự.` and duplicate `Tên phòng đã tồn tại.`
  - Inline form uses the same rule and error strings; do not silently accept 1-character names.
- Do not conflate the two limits; they are separate constants.

---

## 5. Dark theme (minor scope item, required for the visual QA gate)

### 5.1 Persistence and no flash

- Storage key: `ptit.theme`, values exactly `"light"` or `"dark"`. Default `light` when absent/invalid. Do not auto-follow `prefers-color-scheme`; the persisted choice is authoritative after load.
- Set `document.documentElement.dataset.theme` to the stored value (`tokens.css` uses `:root[data-theme="dark"]`). Light is written explicitly as `data-theme="light"`.
- **Anti-FOUC:** make the static `<html>` element `data-theme="light"` and add a blocking inline script plus a background-only style in `index.html` `<head>` before the module entry and before any stylesheet that could paint:
  ```html
  <meta name="color-scheme" content="light dark" />
  <style>
    html { background: #f4f5f8; }
    html[data-theme="dark"] { background: #0e1116; }
  </style>
  <script>
    try {
      var t = localStorage.getItem("ptit.theme");
      document.documentElement.dataset.theme = t === "dark" ? "dark" : "light";
    } catch (e) {
      document.documentElement.dataset.theme = "light";
    }
  </script>
  ```
  The two inline background values mirror `--color-bg` only to prevent a white flash before `tokens.css` loads; they are not a second palette. Keep them in sync with `tokens.css`.
- React `useState` initializes from the same key and a `useEffect` persists changes. Do not wait for an effect to apply the initial theme.

### 5.2 Toggle control

- Place in `.sidebar-footer`, before the change-name action, `40×40px` hit area, icon-only (`moon` for dark available, `sun` for light available; glyph may be a CSS/Unicode mark).
- `aria-label`: `"Bật giao diện tối"` when currently light, `"Tắt giao diện tối"` when currently dark.
- `aria-pressed={theme === "dark"}`.
- `title` mirrors the `aria-label`. Visible tooltip/label is optional; the accessible name is mandatory.
- Keyboard: Enter/Space toggles; focus-visible ring uses the token ring.

### 5.3 Dark-theme defects to fix in current CSS (required, not optional)

These are real contrast/visual bugs when `data-theme="dark"` is enabled; fix them in `src/styles.css`:

1. `.chat-header { background: rgba(255, 255, 255, 0.86); }` — hard-coded light translucency paints a white bar in dark mode. Replace with a theme-aware value, e.g. `background: color-mix(in srgb, var(--color-surface) 86%, transparent);` with a preceding `background: var(--color-surface);` fallback. Keep `backdrop-filter` only if the fallback is opaque.
2. `.nav-item.active { color: var(--color-accent-hover); }` — in dark, `#4338ca` on `#211f45` is not the intended accessible pair. Use `color: var(--color-accent-text);` (light `#4338ca` on `#eef1ff` = 7.0:1 per spec; dark `#a5b4fc` on `#211f45` is the token's designed pair). Apply the same token to `.nav-item.active .hash`.
3. `.bubble-own .bubble-time { color: rgba(255, 255, 255, 0.72); }` — reduced-opacity white on the accent bubble risks falling under 4.5:1. Use `color: var(--color-bubble-own-text);` at full opacity (7.9:1 light / 6.3:1 dark) and rely on font size/letter-spacing for de-emphasis. Do not lower opacity.
4. `.gate` hard-codes light radial gradients (`#eef2ff`, `#f5f3ff`) — visible bright patches in dark mode. Replace with token-driven gradients, e.g. `radial-gradient(... , color-mix(in srgb, var(--color-accent-soft) 70%, transparent), transparent)`, or add `:root[data-theme="dark"] .gate { background: var(--color-surface); }`. The gate must not flash a light card in dark mode.
5. `.brand-mark` gradient ends at `#8b5cf6` with white 16px text (`.brand-mark.sm`); white on `#8b5cf6` is below 4.5:1 for small bold text. Darken the gradient end to `#6d28d9` (or use `--color-accent`/`--color-accent-hover`) so small text clears 4.5:1 in both themes; re-check with a contrast tool.
6. `.composer:focus-within { border-color: var(--color-border-strong); }` — spec section 5.4 requires an accent border plus the focus ring. Use `border-color: var(--color-accent);` in addition to `box-shadow: var(--shadow-focus);`.
7. `.picker-item:hover { background: var(--color-surface); }` and `.btn:hover:not(:disabled) { background: var(--color-surface); }` are invisible on a surface background. Use `var(--color-surface-hover)` so hover is perceptible in both themes.

### 5.4 Contrast verification

Re-verify after the change with a contrast tool for both themes: body text, muted meta, subtle timestamps, unread badge, mention badge, focus ring vs adjacent surface, own-bubble text/meta, danger text on danger-soft, success text on success-soft. Minimums: 4.5:1 normal text, 3:1 large text and UI boundaries/focus. The spec-provided ratios are the baseline; do not weaken a token to "make it look softer".

---

## 6. Accessibility map (A11Y-01)

Implement every row; this is the review checklist for PTI-44.

| Surface | Required markup / behavior |
|---|---|
| Thread | `<div className="messages" role="log" aria-live="polite" aria-relevant="additions" aria-label={threadLabel} aria-busy={loading ? "true" : undefined}>` — remove the bare `aria-live`-only container. `threadLabel` is `Tin nhắn trong #{room}` for a room and `Tin nhắn trực tiếp với {name}` for a DM. |
| Conversation heading | `<h2 id="conversation-heading">`; on mobile give it `tabIndex={-1}` so opening a thread announces it. |
| Loading | The thread wrapper carries `aria-busy="true"` while loading; the loading text is a `role="status"` (polite) node `Đang tải tin nhắn…`; spinner `aria-hidden="true"`. |
| Load error | `role="alert"` banner with visible title/body and two actions: `Thử lại` (primary retry) and `Đóng` (dismiss). Retry must actually refetch (section 7). Do not ship a dismiss-only error. |
| Sidebar nav | `<nav aria-label="Điều hướng hội thoại">`; section headings are real text (they may stay `<div>` visually but each section gets an `aria-labelledby` heading id). |
| Active row | `aria-current="page"` on the active room/DM button. |
| Icon-only buttons | Every one has `aria-label`: create room `Tạo phòng`; new DM `Bắt đầu trò chuyện riêng`; drawer open/close; back; theme toggle. `title` is not a substitute. |
| Timestamps | `<time dateTime={message.createdAt} title={full}>HH:mm</time>`; 24-hour `HH:mm` via `Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })`. Do not use the host default locale (current `toLocaleTimeString(undefined, …)` can emit 12-hour AM/PM). |
| Day dividers | `<time dateTime={yyyy-mm-dd} aria-label={full Vietnamese date}>Hôm nay</time>` etc. Labels: `Hôm nay`, `Hôm qua`, else `dd/MM/yyyy`; full aria-label e.g. `Thứ Tư, 25/11/2026`. |
| Grouped sender | When sender name is visually hidden for a grouped message, include a `.sr-only` `${senderName}: ` prefix in the message so screen readers do not lose attribution. |
| Own vs other | Keep right/left alignment in addition to color; do not convey ownership by color alone. |
| Focus-visible | Global: `:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }`; never `outline: none` without a replacement. Ensure the ring is not clipped by `overflow: hidden` parents (sidebar rows, header buttons, composer). |
| Reduced motion | `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; scroll-behavior: auto !important; } }`; spinner/typing/scroll become static/instant. |
| Keyboard | Tab order: sidebar search/actions/rows → header actions → thread → composer. Room rows are real `<button>`s (already true). `Escape` closes drawer/people picker and returns focus to the trigger. |
| IME | Keep the `event.nativeEvent.isComposing` guard on Enter. |
| Touch | Section 1.7 sizes; do not shrink labels to make room. |
| Names | Unread/mention labels per section 2.6; presence must have text where space allows and an `aria-label` when dot-only. |

Add a `.sr-only` utility (clip, 1px, absolute, no layout) for grouped-sender prefixes and any visually hidden labels.

---

## 7. Search and retry (UI-08)

### 7.1 Search

- Add a search field in the sidebar below the brand/header:
  - Container `<div role="search">`, input `id="sidebar-search"`, `type="search"`, `placeholder="Tìm phòng hoặc người"`, `aria-label="Tìm phòng hoặc người"`, `aria-keyshortcuts="Control+K Meta+K"`.
  - Visible hint `<kbd>Ctrl K</kbd>` (use `⌘K` only when `navigator.platform` indicates macOS; never show both by default).
  - Height `36px` desktop, `44px` at `<= 1023.98px`; background `--color-surface-sunken`; magnifier icon `aria-hidden`.
- Filtering is client-side and case/diacritic-insensitive, including Vietnamese `đ`:
  ```ts
  const fold = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .toLowerCase();
  ```
  Match `fold(room.name)` and `fold(peer.name)`; also match `#${name}`. Empty query shows all. Do not change server order or reorder on unread.
- `Ctrl`/`Cmd+K` on `window` focuses the input and selects its text; prevent the browser default. Only bind while the app shell is mounted (after the name gate). If the field is hidden by the responsive state, first open the tablet drawer or switch mobile to `data-pane="list"` (next frame), then focus.
- `Escape` while the input is focused clears the query and keeps focus; `Escape` at shell level still closes the drawer/picker.
- Empty result: render `role="status"` text `Không tìm thấy phòng hoặc người phù hợp.` in place of both lists; do not show two separate empty messages.
- Search must not clear or alter unread badges, and must be reachable on mobile in `data-pane="list"`.

### 7.2 Load-error retry

- `App` already owns the conversation load effect. Add a `reloadNonce` state and include it in the effect dependency list. Add a `listReloadNonce` state to the rooms/users refresh effect.
- `onRetry`: `setError(null); setReloadNonce(n => n + 1); setListReloadNonce(n => n + 1);` — the effects must refetch the active conversation **and** rooms/users, then clear the error on success. Do not merely hide the banner.
- Retry button is a real `<button>` labelled `Thử lại`; keep `Đóng` as a secondary dismiss. While retrying, disable the button, set `aria-busy="true"`, and show `Đang thử lại…`.
- Keep the previous messages while retrying. Only replace them after a successful fetch; do not blank the thread on a retry failure.
- The retry must not clear the composer text, unread state, or the current selection.

---

## 8. Vietnamese microcopy (new and current strings)

Use these exact strings. Replace the current English UI. Keep diacritics; do not use mojibake or ASCII fallbacks. Tone: short, neutral, no exclamation marks.

### 8.1 Current strings to replace

| Location | New copy |
|---|---|
| Brand sub | `Không gian nội bộ` |
| Rooms section | `Phòng` |
| Direct messages section | `Tin nhắn trực tiếp` |
| Create-room aria | `Tạo phòng` |
| New-DM aria | `Bắt đầu trò chuyện riêng` |
| Room create placeholder | `ten-phong` |
| Room create submit | `Tạo` |
| DM empty list | `Chưa có cuộc trò chuyện. Dùng + để bắt đầu.` |
| People picker placeholder | `Tìm người…` |
| People picker empty | `Chưa có ai khác trong không gian này.` |
| People picker existing | `đang mở` |
| Identity hint | `Hồ sơ cục bộ` |
| Change-name action | `Đổi tên` |
| Connection labels | `Đang kết nối…` / `Đã kết nối` / `Mất kết nối` |
| Online count | `{n} đang hoạt động` |
| Room subtitle | `Phòng · mọi người có thể tham gia` |
| DM subtitle | `Tin nhắn trực tiếp` |
| Room composer placeholder | `Nhắn gửi tới #{room}` |
| DM composer placeholder | `Nhắn cho {name}` |
| Composer hint | `Enter để gửi · Shift + Enter để xuống dòng` |
| Send button | `Gửi` / busy `Đang gửi…` |
| Empty room title | `Chưa có tin nhắn` |
| Empty room body | `Đây là khởi đầu của #{room}. Gửi lời chào đầu tiên để mở màn cuộc trò chuyện.` |
| Empty DM title | `Bắt đầu trò chuyện với {name}` |
| Empty DM body | `Tin nhắn được lưu và hiển thị ngay cho mọi người trong cuộc trò chuyện này.` |
| Loading | `Đang tải tin nhắn…` |
| Load error banner | `Không tải được tin nhắn. Kiểm tra kết nối rồi thử lại.` |
| Load error actions | `Thử lại` / `Đóng` |
| Restoring profile | `Đang khôi phục hồ sơ…` |
| Idle pane title | `Chưa có cuộc trò chuyện` |
| Idle pane body | `Chọn một phòng hoặc bắt đầu tin nhắn trực tiếp từ thanh bên.` |
| Name gate title | `Chào mừng đến PTIT Chat` |
| Name gate body | `Chọn tên hiển thị để bắt đầu. Không cần đăng nhập, dữ liệu chỉ lưu trên máy bạn.` |
| Name label | `Tên hiển thị` |
| Name placeholder | `Ví dụ: Minh Trần` |
| Name CTA | `Vào không gian làm việc` / busy `Đang vào…` |
| Name helper | `Bạn có thể đổi tên sau trong phần cài đặt.` |
| Name fineprint | `Tên chỉ được lưu trong trình duyệt này (localStorage).` |

### 8.2 New strings for this addendum

| Context | Copy |
|---|---|
| Name error (2–32) | `Tên cần từ 2 đến 32 ký tự.` |
| Search placeholder / aria | `Tìm phòng hoặc người` |
| Search empty | `Không tìm thấy phòng hoặc người phù hợp.` |
| Search shortcut hint | `Ctrl K` (macOS: `⌘K`) |
| Retry in progress | `Đang thử lại…` |
| Theme toggle, light state aria | `Bật giao diện tối` |
| Theme toggle, dark state aria | `Tắt giao diện tối` |
| Drawer open aria | `Mở danh sách hội thoại` |
| Drawer close aria | `Đóng danh sách hội thoại` |
| Drawer dialog label | `Danh sách hội thoại` |
| Back aria | `Quay lại danh sách hội thoại` |
| Thread label (room) | `Tin nhắn trong #{room}` |
| Thread label (DM) | `Tin nhắn trực tiếp với {name}` |
| Unread room aria | `#{name}, {count} tin chưa đọc` |
| Mention room aria | `#{name}, {count} tin chưa đọc, có tin nhắn nhắc đến bạn` |
| Unread DM aria | `{name}, {count} tin chưa đọc` |
| Mention DM aria | `{name}, {count} tin chưa đọc, có tin nhắn nhắc đến bạn` |
| Day today / yesterday | `Hôm nay` / `Hôm qua` |
| Day full aria (example) | `Thứ Tư, 25/11/2026` |
| Over-limit composer error | `Tin nhắn vượt quá 4.000 ký tự. Vui lòng rút ngắn rồi gửi lại.` |
| Room name error (2–40) | `Tên phòng cần từ 2 đến 40 ký tự.` |
| Room duplicate | `Tên phòng đã tồn tại.` |
| Send failure inline | `Gửi tin thất bại · Kiểm tra kết nối và thử lại.` |

Empty state, error, and helper copy must be paired with a visible icon or text label, never color alone.

---

## 9. Acceptance mapping (what PTI-44 will check)

| PTI-40 item | Binding section | Pass condition |
|---|---|---|
| UI-01 responsive | 1 | 1280 (288px), 1024 (240px), 768 (300px drawer + scrim + Escape + focus restore), 390/320 (single pane + back + sticky composer), no horizontal scroll at 320 |
| UI-02 unread/mention | 2 | Numeric pill, `@` precedence, clear only visible+focused, aria-label with count, no reorder, no color-only |
| UI-04 length | 0, 3 | Shared 4,000 code-point rule, counter at 3,600, no +100, server/client copy identical, README/tests updated |
| A11Y-01 | 6 | role=log+label, aria-current, labeled icon buttons, `<time datetime>`, Vietnamese day labels, aria-busy, role=alert + working retry |
| UI-08 search/retry | 7 | Client filter rooms+DMs, Ctrl/Cmd+K, empty state, retry refetches |
| Name limit | 4 | 2–32 client+server, inline announced error; room 2–40 |
| Dark theme | 5 | Persisted toggle, no FOUC, `data-theme`, aria-pressed, dark contrast, current-CSS defects fixed |
| Copy | 8 | Vietnamese strings above, 24h time, `Hôm nay`/`Hôm qua`/`dd/MM/yyyy` |
| Touch targets | 1.7 | >=40px (44 preferred) on touch and <=1023.98px |
| Focus-visible | 6 | 2px ring, 2px offset, never removed |

### Explicitly out of scope (do not implement in PTI-42)

- UI-03 optimistic/pending/offline queue/toast/retry state machine.
- UI-07 scroll-position-aware "Tin nhắn mới" affordance.
- UI-09 create-room modal (the inline form stays).
- Read receipts, attachments, reactions, typing indicator, presence member stacks.
- Persisting unread across reloads; per-user socket identity/auth.

---

## 10. Handoff notes and risks

- The server activity event (2.1) is the only backend change this addendum requires; keep it body-free and separate from `new_message`.
- Do not edit `design/` files; this addendum and the existing tokens are sufficient. If a new token is genuinely unavoidable, raise it to the PM rather than editing `design/tokens.css`.
- Expect PTI-42 to touch `shared/types.ts`, `server/index.ts`, `src/App.tsx`, `src/components/Sidebar.tsx`, `ChatPane.tsx`, `Composer.tsx`, `NameGate.tsx`, `src/styles.css`, `index.html`, `README.md`, and tests.
- Windows host: PTI-42 must run `npm run typecheck --script-shell=cmd.exe`, `npm run build --script-shell=cmd.exe`, and `npm test --script-shell=cmd.exe` (ENV-01).
- PTI-43/PTI-44 will treat the acceptance table in section 9 and `design/USABILITY-CHECKLIST.md` sections 8–10 as the review gate.
