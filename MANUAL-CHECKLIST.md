# PTIT Messaging MVP — Manual QA Checklist

- **Issue:** PTI-36 · **Companion:** `TEST-PLAN.md`, `TEST-REPORT.md`
- **Reference:** `design/USABILITY-CHECKLIST.md`, `design/DESIGN-SPEC.md`, `design/wireframes.html`
- **Status:** **NOT EXECUTED** by the automated QA run on 2026-11-25 (no browser/screen-reader session available). This file is the ready-to-run script for a human/UI session.
- **Rule:** record each result as **PASS / FAIL / N/A** with viewport, browser, and a screenshot for every FAIL. Link defect IDs to `TEST-REPORT.md`.

## 0. Setup

1. From the repo root run `npm run dev` (API on `:4000`, Vite on `:5173`) or `npm run build && npm start` for the production-ish build.
2. Open `http://localhost:5173` in Chrome/Edge. Keep DevTools Console and Network open; fail the session on any uncaught error or failed `/api`/`socket.io` request.
3. Prepare a second identity: a second browser profile or a normal + incognito window (separate `localStorage`).
4. To test first run: DevTools → Application → Local Storage → delete `ptit.displayName` and `ptit.dmPeers`, then reload.
5. To reset data: stop the server, delete `data/ptit.db*`, restart. This clears users/rooms/messages.
6. For each section, mark the box and note deviations. Reference IDs (M-xx / UI-xx / A11Y-xx) come from `TEST-PLAN.md` and `TEST-REPORT.md`.

## 1. First run and display name (M-01)

- [ ] First visit shows the name gate, not the chat shell. **(Expected PASS by design; not yet verified)**
- [ ] Name is trimmed; entering spaces only keeps the app from proceeding.
- [ ] Enter submits from the field; the primary button also submits.
- [ ] Reload after joining skips the gate and restores the saved name.
- [ ] "Change" in the sidebar footer returns to the gate and clears DM peers.
- [ ] Invalid input shows readable inline text, not color alone.
- [ ] With storage disabled/blocked, the app still works and shows a clear notice (design spec §4.1).
- [ ] **Known spec mismatch (UI-06):** design requires 2–32 characters; implementation accepts 1 character and the server accepts up to 40. Record actual behavior.

## 2. Room list and navigation (M-02)

- [ ] Seeded rooms `#dev`, `#general`, `#random` are visible with hash icons.
- [ ] Selected room/DM has a visually distinct active state and the header/title/placeholder update.
- [ ] Hover and active states are distinguishable by more than color intensity.
- [ ] A long room name truncates with ellipsis without shifting the badge/layout.
- [ ] Sidebar scrolls independently; the app shell does not scroll; footer stays pinned.
- [ ] With 20+ rooms (create several), scrolling is smooth and the footer remains visible.
- [ ] Active item exposes `aria-current` (design requirement). **Expected FAIL — no `aria-current` is implemented (A11Y-01).**
- [ ] Unread/mention badges appear and update. **Expected FAIL — unread state is not implemented (UI-02).**
- [ ] Search field “Tìm phòng hoặc người” is present. **Expected FAIL — no search field exists (UI-08).**

## 3. Message thread (M-03)

- [ ] Send several messages and verify oldest-at-top, newest-at-bottom ordering.
- [ ] Consecutive messages from one sender within 5 minutes group under one avatar/name.
- [ ] A different sender, a >5-minute gap, or a day change starts a new group.
- [ ] Day dividers render ("Hôm nay"/"Hôm qua"/date per spec) and do not wrap awkwardly. **Current UI uses "Today"/"Yesterday"/locale date (UI-05).**
- [ ] Own messages are right aligned with accent bubbles; others left aligned with surface bubbles; both readable.
- [ ] Long words/URLs wrap; newlines and internal whitespace are preserved; bubble max width holds.
- [ ] Timestamps are 24h `HH:mm` and use `<time datetime>`. **Expected FAIL — current render uses a `<span>` and locale time (A11Y-01/UI-05).**
- [ ] Only the thread scrolls on a long conversation; header and composer stay fixed.
- [ ] Text is selectable; avatar/name/timestamp do not overlap the bubble.
- [ ] Empty room state appears with title/body guidance and the composer remains usable.

## 4. Composer and keyboard sending (M-04)

- [ ] Send is disabled for empty/whitespace-only input and enabled otherwise.
- [ ] **Enter sends exactly one message; Shift+Enter inserts a newline.**
- [ ] Enter during IME composition does not send (test Vietnamese IME if available).
- [ ] After send, input clears, focus stays in the composer, and the bubble appears at the bottom.
- [ ] Composer grows with content up to its limit and then scrolls; the send button stays visible.
- [ ] Sending while disconnected keeps the text and shows an error; no silent loss. **Current behavior shows an error but does not queue or retry (UI-03).**
- [ ] Pending/optimistic state appears before the server ack and resolves to sent. **Expected FAIL — no pending state (UI-03).**
- [ ] Failed send keeps the bubble/text with a visible retry action and toast. **Expected FAIL — error text only, no retry affordance (UI-03).**
- [ ] Auto-scroll only when near the bottom; otherwise a "new messages" affordance appears. **Expected FAIL — always scrolls to bottom (UI-07).**
- [ ] Character limit behavior matches the documented contract. **Known conflict (UI-04): design says 4,000; server rejects >2,000; composer allows typing 2,100 then errors.**
- [ ] Error messages use `role="alert"` (composer errors and thread error banner).

## 5. Realtime with two clients (M-05)

1. Window A: join as "Alice", open `#general`.
2. Window B (second profile): join as "Bob", open `#general`.
3. Send from A; verify B receives without refresh, and vice versa.
4. Put B in `#random`; send from A in `#general`; verify B receives nothing.
5. Start a DM A↔B from both sides; send; verify only the DM thread updates.
6. Open a third DM pair (C↔D in another profile pair) and verify isolation.

- [ ] Message from another user appears without a full-page reload.
- [ ] No duplicate bubble for the sender; no lost message for the peer.
- [ ] No cross-room or cross-DM leakage in the UI.
- [ ] Presence/online count updates in the header (if shipped) without layout shift.
- [ ] Unread behavior in the non-active room follows the design. **Expected FAIL — unread counters not implemented (UI-02).**
- [ ] Reconnect after toggling offline (DevTools → Network → Offline) shows a clear state and recovers.

## 6. Room creation and DMs (M-06)

- [ ] The `+` control next to Rooms opens a creation UI. **Current implementation is an inline form, not the specified modal (UI-09).**
- [ ] Name is trimmed; `#` and internal spaces are handled; duplicate names are rejected case-insensitively with a readable message.
- [ ] Invalid names are blocked; the server also rejects them (covered automatically by API-07…API-10).
- [ ] Double submit cannot create two rooms (button busy state).
- [ ] Success closes the form, selects the new room, and the composer is usable.
- [ ] Escape/cancel closes the creation UI and restores focus to the trigger. **Expected FAIL — no modal/focus management (UI-09).**
- [ ] DM `+` opens the people picker, search filters users, selecting a user opens/reuses the DM.
- [ ] Empty people picker shows helpful copy; empty DM names the person and keeps the composer available.

## 7. Empty, loading, error, and offline states (M-07)

- [ ] Empty room shows an intentional empty state; composer remains available. **(Expected PASS)**
- [ ] Empty DM names the person; empty people picker has copy.
- [ ] Loading shows a spinner/skeleton with `aria-busy` and no layout jump. **Current loading is text + spinner; no `aria-busy` (A11Y-01).**
- [ ] Load error is an alert with a **retry** action that refetches. **Expected FAIL — banner only offers Dismiss (UI-08).**
- [ ] Offline banner appears with retry guidance; pending messages remain marked; reconnect flushes oldest-first. **Expected FAIL — no queue/banner flow (UI-03).**
- [ ] “Đã kết nối lại” confirmation appears briefly and does not stack with error toasts.
- [ ] Toasts auto-dismiss (~6s), are dismissible, and do not cover the send button. **Expected FAIL — no toast system (UI-03/UI-08).**

## 8. Responsive and layout (M-08)

Use DevTools device toolbar and check the widths below. Screenshot any overlap, clipping, horizontal scrollbar, or inaccessible control.

- [ ] **1440px:** sidebar ~288px, thread readable, composer aligned; header actions fit.
- [ ] **1280px:** no overlap; labels/badges visible; header actions fit.
- [ ] **1024px:** sidebar ~240px; labels truncate gracefully with no overflow.
- [ ] **768px:** sidebar becomes an overlay drawer with scrim; Escape/scrim closes; focus is trapped/restored. **Expected FAIL — only the sidebar width changes; no drawer (UI-01).**
- [ ] **390px:** single pane with back navigation to the room list; composer sticky above the safe area. **Expected FAIL — sidebar + chat remain side by side (UI-01).**
- [ ] **320px:** no horizontal scroll; bubbles wrap; header actions collapse to overflow.
- [ ] **200% zoom:** content reflows with no clipped buttons or double scrollbars.
- [ ] Only the thread scrolls; header/composer stay fixed.

## 9. Visual QA (M-09)

- [ ] No default browser styling leaks on buttons, inputs, lists, or scrollbars.
- [ ] Colors/spacing/radii/type resolve from `design/tokens.css` (spot-check computed styles).
- [ ] 4px spacing rhythm holds; vertical rhythm is consistent between groups.
- [ ] Accent is used for primary actions/own bubbles only; no stray indigo shades.
- [ ] Borders are consistent 1px; shadows are subtle and do not muddy the canvas.
- [ ] Avatars are circular with centered initials; presence dots (if any) have a surface ring.
- [ ] Hover/active/focus/disabled states exist for every control.
- [ ] No layout shift when badges/timestamps appear.
- [ ] Dark theme (`data-theme="dark"`) has readable text/borders and correct bubble contrast. **Not exposed by the app UI; verify by setting the attribute manually (VIS-01).**
- [ ] Empty/loading/error states look intentional, not broken.

## 10. Accessibility basics (M-10)

- [ ] Tab order is logical: sidebar → header → thread → composer; no keyboard trap.
- [ ] `:focus-visible` is clearly visible on every control (2px ring / composer focus-within).
- [ ] Icon-only controls have accessible names (`aria-label` or equivalent). **Current `+` buttons rely on `title` only (A11Y-01).**
- [ ] Active room/DM exposes `aria-current`. **Expected FAIL (A11Y-01).**
- [ ] Thread is `role="log"` with `aria-live="polite"` and a label; only new messages are announced. **Only `aria-live` exists (A11Y-01).**
- [ ] Screen reader announces incoming message as "Sender: text"; own optimistic message is not double-announced.
- [ ] Errors use `role="alert"` and include an action.
- [ ] Unread/mention and own/other messages are not conveyed by color alone.
- [ ] Modals/pickers trap focus, close on Escape, restore focus. **Only the people picker exists as a popover; verify focus behavior (UI-09).**
- [ ] Contrast: normal text ≥4.5:1, large text ≥3:1, focus/UI boundaries ≥3:1 (spot-check with a contrast tool).
- [ ] Reduced motion stops spinner/shimmer/typing animation (if present).
- [ ] Usable at 200% zoom and Windows High Contrast forced-colors mode.

## 11. Copy and content (M-11)

- [ ] Vietnamese diacritics render correctly (names, rooms, messages) with no mojibake.
- [ ] Placeholders name the destination (`#phòng`, person name).
- [ ] Empty/error copy says what happened and what to do next.
- [ ] Timestamps follow spec (24h; Hôm nay/Hôm qua/dd-MM-yyyy). **Current UI is English (UI-05).**
- [ ] Truncation never cuts a critical action label.
- [ ] **Known spec mismatch (UI-05):** the design mandates Vietnamese microcopy; the shipped UI is English throughout.

## 12. Verification summary to fill in

| Section | Result | Tester | Date | Evidence / defect IDs |
| --- | --- | --- | --- | --- |
| 1 First run |  |  |  |  |
| 2 Room list |  |  |  |  |
| 3 Thread |  |  |  |  |
| 4 Composer |  |  |  |  |
| 5 Realtime |  |  |  |  |
| 6 Rooms/DMs |  |  |  |  |
| 7 States |  |  |  |  |
| 8 Responsive |  |  |  |  |
| 9 Visual |  |  |  |  |
| 10 Accessibility |  |  |  |  |
| 11 Copy |  |  |  |  |

**Sign-off rule:** zero Blocker items; no open Major items in sections 3, 4, 7, 8, or 10 of `design/USABILITY-CHECKLIST.md`. Any accepted deviation needs an owner, a follow-up issue, and QA acknowledgment.
