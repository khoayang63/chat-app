# PTIT Chat — UI/UX Design Spec (MVP)

Status: Ready for implementation handoff  
Owner: UI/UX Designer  
Parent issue: PTI-33 · This issue: PTI-34  
Related files: `design/tokens.css`, `design/wireframes.html`, `design/USABILITY-CHECKLIST.md`

## 1. Overview

PTIT Chat is a desktop-first web messaging MVP for internal PTIT teams. Users pick a display name (no login), browse rooms and direct messages, and chat in near real time. The demo is local-first: data is persisted on the device, while realtime delivery is provided by the app server when connected.

### Goals

- Fast path from opening the app to reading and sending a message.
- A room list that stays scannable with unread and mention signals.
- Clear message ownership, sender grouping, and timestamps.
- Honest states: empty, loading, offline, send failure, retry.
- A small, reusable token set the Full-Stack Developer can drop in.

### Non-goals for this MVP

- Authentication, accounts, profiles, avatars upload.
- Threads, reactions beyond the visual pattern, file uploads as a required feature, search across history, notifications.
- Mobile apps. Web must still be usable down to 320px, but desktop is the reference.

Attachments, reactions, and read receipts are shown in the wireframe as visual patterns. Treat them as optional for v1; the required MVP behavior is text messaging, room creation, unread indicators, and states.

## 2. Design principles

1. Conversation first. Chrome never competes with messages: one accent color, neutral surfaces, 760px reading column.
2. Obvious state. Every unread, pending, failed, empty, and loading state has a visible and announced form.
3. Calm density. 36px sidebar rows, 14px base text, generous line height. Dense enough for work, never cramped.
4. Accessible by default. AA contrast, visible focus, keyboard send, no color-only meaning.
5. Token-driven. No hard-coded colors, spacing, radii, or type sizes in feature code.

## 3. Information architecture

```
App shell
├── Sidebar (288px)
│   ├── Workspace header (PTIT Chat + create room)
│   ├── Search field (rooms + people)
│   ├── Rooms section (public channels)
│   ├── Direct messages section
│   └── Current user footer
└── Conversation pane (fluid)
    ├── Conversation header (room/DM identity, members, actions)
    ├── Message thread (max 760px, scrolls)
    └── Composer (max 760px, sticky at bottom)
```

Navigation is single-level: select a room or DM in the sidebar, the conversation pane swaps. There is no separate settings area in the MVP; the footer settings button is a placeholder and may be omitted.

## 4. User flows

### 4.1 First run — choose a display name

1. App reads local storage. If no display name exists, render the name gate over the app shell (or as the only screen).
2. Name gate shows product mark, title, one-line explanation, text field, primary CTA, and a helper line.
3. Name is trimmed; valid when 2–32 characters. CTA is disabled until valid.
4. Enter submits. Persist name locally, seed demo content (recommended: `#chung` with one welcome message), then open the room list with `#chung` selected.
5. Focus moves to the composer or the first room item; the name gate is removed from the DOM.
6. Returning users skip the gate entirely.

Failure/edge cases: storage unavailable — continue in memory and show a subtle toast "Không lưu được dữ liệu trên trình duyệt này." Empty/whitespace input keeps CTA disabled. Names may repeat; this is a local demo.

### 4.2 Read a room and clear unread

1. Sidebar shows each room with name and unread count. Mentions use an `@` badge instead of a count.
2. Selecting a room marks it active (accent-soft background) and opens the thread at the latest message.
3. Opening the conversation clears its unread count after the thread is visible and the window is focused.
4. Incoming messages in the open, focused room append and do not increment unread for that room.
5. Incoming messages elsewhere increment counts; the sidebar stays scroll-stable, no reorder in v1.

### 4.3 Send a message

1. Composer receives focus when a conversation opens on desktop. Placeholder names the destination.
2. Send is disabled when the trimmed value is empty or only whitespace.
3. Enter sends; Shift+Enter inserts a newline. Never send while an IME composition is active.
4. On send, append an optimistic own bubble with a pending indicator. Clear the input, keep focus.
5. On server acknowledgement, replace pending with sent state.
6. On failure, keep the message visible with a "Gửi lại" action and show an error toast with retry. The text is not lost.
7. Auto-scroll to the new message only if the user is within ~100px of the bottom; otherwise show a "Tin nhắn mới" jump affordance.
8. Maximum 4,000 characters; show a counter from 3,600. Newlines preserved; long words wrap.

### 4.4 Create a room

1. Entry points: `+` in workspace header and `+` in the Rooms section header.
2. Modal: title "Tạo phòng", name field, optional description, primary "Tạo phòng", secondary "Hủy".
3. Name rules: trimmed, 2–40 characters, unique case-insensitive. Lowercase slug recommended; display the name without `#`.
4. Validate inline below the field on blur and on submit. Duplicate name: "Tên phòng đã tồn tại."
5. Submit disabled while invalid or in flight. On success: close modal, select the new room, release focus to the composer, show system notice "Bạn đã tạo phòng #ten-phong".
6. On cancel/Escape: close, return focus to the trigger. Clicking the backdrop closes only when the form is untouched.

### 4.5 Start a direct message

1. `+` in the DM section opens a people picker with search.
2. Selecting a person opens the DM; if a conversation exists, reuse it.
3. New DM with no messages shows empty state: "Bắt đầu trò chuyện với {tên}" plus composer.
4. Empty state for no people: "Chưa có ai khác trong không gian này."

### 4.6 Connection loss and recovery

1. When realtime disconnects, show a compact banner above the thread: "Mất kết nối — đang thử lại…" with a retry action. Composer remains usable and queues messages locally.
2. Pending messages remain visually marked until acknowledged.
3. On reconnect, flush the queue oldest-first and show "Đã kết nối lại" for 3 seconds.
4. A failed send raises a toast with "Thử lại"; the bubble also keeps its retry affordance.

## 5. Screens

Wireframe reference: `design/wireframes.html` tabs 1–3, plus the state gallery.

### 5.1 App shell and room list (screen 1)

- Sidebar 288px, full height, surface background, 1px right border.
- Header 64px: 34px product mark, product name, "Không gian nội bộ", 34px create button.
- Search field 36px, 12px inset, sunken surface, magnifier icon, `Ctrl K` hint. Placeholder "Tìm phòng hoặc người".
- Section label 11px, semibold, uppercase, 0.08em tracking, muted; trailing 22px add button.
- Room row 36px: 16px hash icon (channels) or 24px avatar (DMs), 13px label, trailing badge. Hover surface-hover, active accent-soft with accent text.
- Unread number badge: 20px min, pill, accent background, 11px bold. Mention badge shows `@`.
- Footer 64px: 32px avatar, name 13px semibold, "Trực tuyến" with 7px green dot, settings icon.
- Conversation header mirrors room identity: 32px hash tile or 40px avatar, 16px semibold title, 12px meta ("8 thành viên · 3 đang hoạt động" / "Đang hoạt động").
- Member stack: 24px avatars overlapped by 7px with 2px surface border, then "+N".
- The thread is centered at 760px; background is `--color-bg` while header, sidebar, and composer sit on `--color-surface`.

### 5.2 Chat thread (screen 2)

- Day divider: 11px uppercase, centered between two 1px rules, 16px top and 24px bottom margin.
- System notice: centered pill, surface background, 1px border, 12px muted, optional 13px icon.
- Message group: 40px avatar column + content, 10px gap, 10px top padding.
- First message in a group shows sender (13px semibold) and `HH:mm` timestamp (11px, tabular numerals, muted-subtle).
- Consecutive messages from the same sender within 5 minutes, with no day change, are grouped: avatar and meta hidden, bubble top corners restored, 2px gap.
- Other bubble: surface background, 1px border, text `#141821`, radius 12px with 4px top-left corner, 8px 12px padding, max 560px, shadow-xs.
- Own bubble: accent background, white text, right aligned, radius 12px with 4px top-right corner, no border, subtle accent shadow.
- All bubbles: 14px text, 1.65 line height, anywhere wrapping. Group separation 10px; within-group 2px.
- Optional reaction chips: 23px pills, 12px icon + count; active uses accent-soft.
- Optional attachment card: 36px file tile, name 13px semibold, "Markdown · 12 KB" 11px muted, download icon.
- Typing indicator: three 5px dots in a 26px bubble, 12px label "Minh Anh đang nhập…"; delayed 400ms after last keystroke, hidden after 3s idle.
- Thread is a `role="log"` region with `aria-live="polite"`; new messages are announced without re-announcing history.

### 5.3 Direct message (screen 3)

- Same shell; header uses a 40px avatar with 10px presence dot, name, "Đang hoạt động".
- No member stack, no hash icon, no member count.
- DM read receipts are optional: below the latest own message show a check icon + "Đã xem · 10:42". Group rooms omit receipts.
- Composer focus state is visible: accent border plus 2px focus ring (3px translucent halo).
- Empty DM: centered avatar, "Bắt đầu trò chuyện với Minh Anh", one line of guidance, composer remains available.

### 5.4 Composer

- Container max 760px, centered, 12px top and 16px bottom padding.
- Surface background, 1px strong border, radius 14px, shadow-sm. Focus-within: accent border + `--shadow-focus`.
- Textarea min-height 44px, grows to 140px max, then scrolls. 14px text, 1.5 line height.
- Toolbar: 30px icon buttons (attach, emoji optional) left; hint "Enter để gửi · Shift + Enter để xuống dòng" right; 34px accent send button.
- Send disabled: surface-active background, muted icon, not-allowed cursor, `aria-disabled` or native `disabled`.
- 40px minimum touch target on touch devices; 16px horizontal inset on mobile.

### 5.5 States (screen 4 in wireframe)

- First run name gate.
- Empty room: 48px icon tile, title, one-line body, primary CTA.
- Loading: skeleton rows with 36px circle, three lines, one 54px bubble; 14px spinner + "Đang tải tin nhắn…". `aria-busy="true"`.
- Error: card with 3px danger left border, alert icon, title, body, "Thử lại" + "Xem chi tiết". `role="alert"`.
- Composer focus/disabled.
- Unread and mention badges; send failure toast.

## 6. Component inventory

| Component | Anatomy | States / variants | Notes |
|---|---|---|---|
| AppShell | Sidebar + conversation pane | default, drawer (tablet) | Flex row, full height |
| WorkspaceHeader | Mark, name, sub, create button | default | 64px tall |
| SearchField | Icon, placeholder, shortcut hint | idle, focus, with value | Visual only unless search ships |
| SidebarSection | Label, add button | default | Uppercase 11px label |
| RoomListItem | Icon/avatar, name, badge | default, hover, active, unread, mention | 36px row, button element |
| UnreadBadge | Count or `@` | number, mention, muted | Never color-only |
| Avatar | Initials, optional presence | sm 24, md 32, lg 40 | 6 tint pairs |
| PresenceDot | 10px dot with surface ring | online, offline (dot removed) | Decorative + text label |
| MemberStack | Overlapped avatars + `+N` | default | Max 4 visible |
| ChatHeader | Identity, meta, actions | channel, DM | Actions are icon buttons |
| DayDivider | Rules + date label | today, yesterday, date | Announce full date |
| SystemNotice | Icon + inline message | info, pin | Centered pill |
| MessageGroup | Avatar column + body | other, own, continued | Grouping rules 5.2 |
| MessageBubble | Text container | other, own, continued | 560px max |
| MessageMeta | Sender + time | first in group only | `<time>` element |
| AttachmentCard | File tile, name, size, download | default | Optional |
| ReactionChip | Icon + count | default, active | Optional |
| ReadReceipt | Check + "Đã xem" + time | sent, seen | DM only, optional |
| TypingIndicator | Dots + label | active | Reduced-motion safe |
| Composer | Textarea + toolbar + send | idle, focus, disabled send, multiline | IME-safe Enter |
| EmptyState | Icon tile, title, body, CTA | room, DM, search | Max 330px |
| SkeletonThread | Rows of shimmer blocks | loading | Static under reduced motion |
| ErrorState | Alert, title, body, actions | load error, send error | `role="alert"` |
| Toast | Icon, title, body, action | error, success | 6s, dismissible |
| Modal | Backdrop, title, body, footer | room create, people picker | Focus trap + restore |
| TextField | Label, input, hint/error | idle, focus, error, disabled | Error below field |
| Button | Label + optional icon | primary, ghost, sm | 38px / 32px |
| IconButton | 34px square, 18px icon | default, hover, pressed | `aria-label` required |
| NameGate | Mark, title, body, field, CTA | valid, invalid, submitting | First run only |

## 7. Layout and responsive behavior

Desktop-first; the wireframe targets ≥1024px.

| Breakpoint | Sidebar | Conversation | Notes |
|---|---|---|---|
| ≥1280px | 288px fixed | Fluid, thread max 760px | Reference layout |
| 1024–1279px | 240px fixed | Fluid, 20–24px side padding | Sidebar labels truncate |
| 768–1023px | 300px overlay drawer | Full width, thread max 760 | Hamburger in header, scrim behind drawer |
| <768px | Full-screen list | Full-screen thread | Single pane; back button; composer sticky with safe-area inset |

Rules:
- Only one vertical scroll region per pane; body does not scroll the app shell.
- Minimum supported width 320px, no horizontal scroll. Bubbles max 85% on mobile.
- Touch targets ≥40px (44px preferred) on touch layouts.
- At 200% zoom the one-pane mobile layout applies; no content clipped.
- Safe-area insets respected above the mobile keyboard/composer.

## 8. Design tokens

Source of truth: `design/tokens.css`. Semantic names only in feature code. Both themes define the same names.

### 8.1 Color

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-bg` | `#f4f5f8` | `#0e1116` | App canvas, thread background |
| `--color-surface` | `#ffffff` | `#161a20` | Sidebar, header, composer, cards |
| `--color-surface-sunken` | `#eceef3` | `#10141a` | Search field, inset wells |
| `--color-surface-hover` | `#f0f2f6` | `#1f2530` | Hover rows and buttons |
| `--color-surface-active` | `#e7eaf1` | `#262d3a` | Pressed, disabled fill |
| `--color-border` | `#e3e6ec` | `#2a3040` | Standard borders |
| `--color-border-strong` | `#cdd2dc` | `#3a4254` | Inputs, secondary buttons |
| `--color-text` | `#141821` | `#e9ecf2` | Primary text |
| `--color-text-muted` | `#5c6575` | `#a2abb9` | Secondary text, meta |
| `--color-text-subtle` | `#626b7a` | `#828c9a` | Timestamps, hints (still AA) |
| `--color-accent` | `#4338ca` | `#4f46e5` | Primary actions, active, own bubble |
| `--color-accent-hover` | `#3730a3` | `#4338ca` | Hover |
| `--color-accent-soft` | `#eef1ff` | `#211f45` | Active row, selected states |
| `--color-accent-contrast` | `#ffffff` | `#ffffff` | Text on accent |
| `--color-focus-ring` | `#6366f1` | `#818cf8` | Focus outline |
| `--color-bubble-other-bg` | `#ffffff` | `#1c212a` | Other bubble |
| `--color-bubble-own-bg` | `#4338ca` | `#4f46e5` | Own bubble |
| `--color-success` | `#15803d` | `#4ade80` | Online, success |
| `--color-danger` | `#b91c1c` | `#f87171` | Errors |
| `--color-warning` | `#b45309` | `#fbbf24` | Warnings |

Contrast checks (light theme): text on surface 17.8:1, muted 5.9:1, subtle 5.4:1, white on accent 7.9:1, accent text on accent-soft 7.0:1. Dark theme: text 14.8:1, muted 7.5:1, subtle 5.1:1, white on accent 6.3:1. Focus ring is ≥3:1 against adjacent surfaces. Re-verify after any token change.

### 8.2 Typography

System font stack with Vietnamese support (`Segoe UI`, system-ui, Noto Sans, sans-serif). No external font loading.

| Token | Size | Typical usage |
|---|---|---|
| `--text-2xs` | 11px | Timestamps, badges, uppercase labels, hints |
| `--text-xs` | 12px | Meta, helper text, small buttons |
| `--text-sm` | 13px | Sidebar rows, sender name, buttons |
| `--text-base` | 14px | Message body, inputs |
| `--text-md` | 15px | Workspace name |
| `--text-lg` | 16px | Conversation title |
| `--text-xl` | 20px | Modal titles |
| `--text-2xl` | 24px | Name gate title (optional) |

Line heights: tight 1.2 (titles), normal 1.5 (UI), relaxed 1.65 (messages). Weights 400/500/600/700. Tracking: -0.01em on headings, 0.08em on uppercase labels.

### 8.3 Spacing

4px base scale: `--space-0-5` 2px, `1` 4px, `1-5` 6px, `2` 8px, `2-5` 10px, `3` 12px, `4` 16px, `5` 20px, `6` 24px, `8` 32px, `10` 40px, `12` 48px, `16` 64px. Only token values; no arbitrary margins.

### 8.4 Radius, elevation, motion

- Radius: 4, 6, 8, 12, 16, 20, full (`--radius-xs`…`--radius-2xl`, `--radius-full`). Bubbles use `--radius-bubble` (12) with one 4px corner; composer `--radius-composer` (14); modals 16; avatars full.
- Shadows: xs for bubbles/chips, sm for composer/inputs, md for cards, lg for app frame/modals, focus for the 3px ring.
- Motion: 140ms fast, 200ms base, 300ms slow, standard ease `cubic-bezier(0.2, 0, 0, 1)`. No entrance animation on messages beyond a 120ms fade if desired.
- Reduced motion: disable typing dots, shimmer motion, spinner rotation, screen transitions.

### 8.5 Layout tokens

`--sidebar-width` 288px, `--sidebar-width-compact` 240px, `--topbar-height` 64px, `--thread-max-width` 760px, `--composer-max-width` 760px, avatar 24/32/40, controls 32/36/40, icons 16/18/20.

## 9. Interaction details

- Message grouping window: 5 minutes, same author, same day. A system notice or day divider breaks the group.
- Timestamps: 24-hour `HH:mm`, `title` includes the full date/time. Day labels: "Hôm nay", "Hôm qua", then `dd/MM/yyyy`.
- Ordering: oldest at top, newest at bottom. Initial scroll is to bottom without animation. New message scroll is smooth only when the user is near the bottom.
- Unread: counts are per room/DM. Mark read on open + focus. Mentions replace the count with `@` in the sidebar. Do not reorder rooms in v1.
- Optimistic send: bubble appears immediately; pending state uses reduced opacity plus a small clock/check affordance; failure adds a text "Gửi lại" action. Never silently drop text.
- Presence: dot plus text where space allows; dot alone has an accessible label.
- Long content: URLs and long tokens wrap; message max width 560px; newlines preserved.
- Selection: sidebar rows are buttons with `aria-current` for the active conversation. Message text is selectable.
- Hover reveals row actions (optional) without shifting layout.
- Escape closes modals and the people picker; focus returns to the trigger.
- Window focus/blur drives unread clearing and optional title count.

## 10. Accessibility requirements (WCAG 2.1 AA)

- Contrast: normal text ≥4.5:1, large text ≥3:1, UI boundaries and focus indicators ≥3:1. Tokens above are chosen to pass; verify with a contrast tool after changes.
- Focus: every interactive element has a visible `:focus-visible` outline (2px accent ring, 2px offset) or the composer's focus-within ring. Never remove focus outlines.
- Keyboard:
  - Tab/Shift+Tab move through sidebar, header actions, thread, composer.
  - Enter sends; Shift+Enter newline. Enter inside the name/room field submits the form.
  - Escape closes modal/picker and restores focus.
  - Ctrl/Cmd+K may focus search; optional but recommended.
  - Room list rows are reachable and activatable with Enter/Space.
- Semantics: sidebar `nav` with a label; conversation header is a heading; thread is `role="log"` with `aria-live="polite"`; toasts use `role="alert"`; loading uses `aria-busy`; errors use `role="alert"`.
- Accessible names: icon-only buttons require `aria-label`; unread rows include the count in the name ("kỹ thuật, 12 tin chưa đọc"); mention rows announce the mention; presence dots have text.
- Do not rely on color: unread uses count/`@`, errors pair color with icon + text, own/other bubbles are also aligned differently.
- IME: do not send on Enter while `compositionstart` is active.
- Screen reader announcements: incoming message "Minh Anh: {text}". Avoid announcing your own optimistic message twice; announce failure via toast.
- Reduced motion honored globally. Loading skeletons remain static.
- Zoom/reflow: usable at 200% and down to 320px without horizontal scrolling or clipped actions.
- Attachments: readable name and size as text; download button labeled with the file name.
- Time elements use `<time datetime="…">`.

## 11. Content and microcopy (Vietnamese)

| Context | Copy |
|---|---|
| Name gate title | Chào mừng đến PTIT Chat |
| Name gate body | Chọn tên hiển thị để bắt đầu. Không cần đăng nhập, dữ liệu chỉ lưu trên máy bạn. |
| Name label | Tên hiển thị |
| Name CTA | Vào không gian làm việc |
| Name helper | Bạn có thể đổi tên sau trong phần cài đặt. |
| Name error | Tên cần từ 2 đến 32 ký tự. |
| Search placeholder | Tìm phòng hoặc người |
| Room composer placeholder | Nhắn gì đó tới #{room} |
| DM composer placeholder | Nhắn cho {name} |
| Composer hint | Enter để gửi · Shift + Enter để xuống dòng |
| Empty room title | Chưa có tin nhắn |
| Empty room body | Đây là khởi đầu của #{room}. Gửi lời chào đầu tiên để mở màn cuộc trò chuyện. |
| Empty room CTA | Gửi tin nhắn |
| Empty DM title | Bắt đầu trò chuyện với {name} |
| Loading | Đang tải tin nhắn… |
| Load error title | Không tải được tin nhắn |
| Load error body | Kết nối bị gián đoạn. Tin nhắn bạn đã gửi vẫn được giữ và sẽ gửi lại khi có mạng. |
| Load error actions | Thử lại / Xem chi tiết |
| Offline banner | Mất kết nối — đang thử lại… |
| Reconnected | Đã kết nối lại |
| Send failure toast | Gửi tin thất bại · Kiểm tra kết nối và thử lại. |
| Retry action | Thử lại |
| New messages pill | Tin nhắn mới |
| Room modal title | Tạo phòng |
| Room name label | Tên phòng |
| Room name hint | 2–40 ký tự, không dấu cách ở đầu/cuối. |
| Room duplicate error | Tên phòng đã tồn tại. |
| Room create CTA | Tạo phòng |
| Cancel | Hủy |
| Created notice | Bạn đã tạo phòng #{room} |
| Typing | {name} đang nhập… |
| Seen receipt | Đã xem · {time} |
| Empty people picker | Chưa có ai khác trong không gian này. |

Tone: short, neutral, no blame, no exclamation marks. Use Vietnamese diacritics consistently.

## 12. Implementation handoff

- Import `design/tokens.css` once at the app root (`<link rel="stylesheet" href="design/tokens.css">` or copy the variables into the global stylesheet). Do not duplicate hex values in components.
- Set `data-theme="dark"` on `<html>` to opt into dark tokens; light is the default. `color-scheme` is already declared per theme.
- Suggested class/component mapping follows the inventory in section 6. Feature code should use semantic classes, not inline colors.
- The wireframe is a visual reference, not production markup. Recreate behavior with the app's framework; keep the DOM semantics (`nav`, `role="log"`, `<time>`, labeled icon buttons).
- Layout skeleton: `display:flex` app shell; sidebar flex-none 288px; conversation `flex:1; min-width:0`; thread scrolls; composer flex-none. Use `min-width:0` to prevent overflow.
- Focus ring: use `:focus-visible` with the token ring or a 2px outline; composer uses `:focus-within`.
- Persist: display name, rooms, messages, unread state. Suggested local keys: `ptit.displayName`, `ptit.rooms`, `ptit.messages`, `ptit.unread`. Local-first; server sync may reconcile later.
- Room names: normalize for uniqueness (trim + lowercase comparison) but display the user's casing.
- Seed data recommendation: one room `#chung` with a welcome system notice, so the first screen is never fully empty.
- Definition of done: all three screens implemented, states in the QA checklist pass, keyboard send works, contrast and focus verified, tokens only.

### Assumptions and open questions

- Realtime transport is owned by Full-Stack (WebSocket or polling). The UI only needs pending/sent/failed states.
- Attachment UI is optional; if uploads are out of scope, remove the paperclip button rather than shipping a dead control.
- Read receipts are optional and DM-only.
- Room privacy, member management, and message editing are out of scope for this MVP.
- The name gate is local-only; no identity verification.

## 13. Deliverables

| File | Purpose |
|---|---|
| `design/DESIGN-SPEC.md` | This spec: flows, screens, components, tokens, accessibility, handoff |
| `design/tokens.css` | Reusable light/dark CSS custom properties |
| `design/wireframes.html` | Self-contained HTML mock: room list, chat thread, DM, state gallery |
| `design/USABILITY-CHECKLIST.md` | QA checklist for states, layout, and accessibility |
