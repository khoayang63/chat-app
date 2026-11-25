# PTIT Chat — Usability & Visual QA Checklist (MVP)

Use this checklist before marking PTI-34 / the messaging MVP ready for release.  
References: `design/wireframes.html` (visual baseline), `design/DESIGN-SPEC.md`, `design/tokens.css`.

Severity: **Blocker** = prevents use or fails WCAG AA; **Major** = confusing or visibly broken; **Minor** = polish.

## 0. How to review

- Open `design/wireframes.html` directly in a browser from disk. Verify it renders with network disabled: no external fonts, CDNs, images, or scripts.
- Toggle tabs: Danh sách phòng, Khung chat, Tin nhắn trực tiếp, Trạng thái. All four must render without console errors.
- Compare the implemented app at 1440px against the wireframe; then resize per section E.
- Test with keyboard only, then with a screen reader (NVDA or VoiceOver), then at 200% zoom.

## 1. First run and display name

- [ ] First visit shows the name gate; returning visit skips it and restores the saved name.
- [ ] Name is trimmed; 2–32 characters accepted; empty/whitespace keeps CTA disabled.
- [ ] CTA enables immediately when valid; Enter submits from the field.
- [ ] Invalid input shows inline text, not color alone, and is announced.
- [ ] After submit, the gate is gone, focus lands in a sensible place, and the app is usable.
- [ ] Reload preserves the name and demo content.
- [ ] If local storage is unavailable, the app still works and shows a clear notice.

## 2. Room list and navigation

- [ ] Channels show hash icons; DMs show avatars; active item has accent-soft background and accent text.
- [ ] Unread counts display as numerals; mentions display `@`; read rooms display no badge.
- [ ] Hover and active states are distinguishable (not only by color intensity).
- [ ] Long room names truncate with ellipsis; badge stays visible; layout does not shift.
- [ ] Selecting a room updates the header, thread, and composer placeholder.
- [ ] Active room is exposed via `aria-current`; unread count is in the accessible name.
- [ ] Sidebar scrolls independently; the app shell itself does not scroll.
- [ ] 20+ rooms still scroll smoothly and the footer stays pinned.

## 3. Message layout

- [ ] Consecutive messages from the same sender within 5 minutes group: one avatar, one name, tightened bubbles.
- [ ] A new sender, a 5-minute gap, a day divider, or a system notice starts a new group.
- [ ] Timestamps render as 24h `HH:mm` and use `<time datetime>`.
- [ ] Day dividers read "Hôm nay", "Hôm qua", then a date; rules align and do not wrap awkwardly.
- [ ] Own messages are right aligned with accent bubbles; others are left aligned with surface bubbles.
- [ ] Own and other bubbles also differ by alignment, not color alone.
- [ ] Max width 560px; long words/URLs wrap; whitespace/newlines preserved.
- [ ] Avatar sizes and spacing match tokens (40px in thread, 32px footer, 24px stack).
- [ ] Reactions, attachments, and receipts (if shipped) align under the bubble without breaking grouping.
- [ ] System notices are centered and do not look like user messages.

## 4. Composer and sending

- [ ] Send is disabled for empty/whitespace-only input and enabled otherwise.
- [ ] Enter sends once; Shift+Enter adds a newline; Enter during IME composition does not send.
- [ ] Composer grows with content up to 140px, then scrolls; send stays visible.
- [ ] After send, input clears, focus stays in the composer, and the new bubble appears at the bottom.
- [ ] Optimistic message shows a pending state; acknowledgement clears it.
- [ ] Failed send keeps the text, shows a retry affordance, and raises a toast; retry succeeds after reconnect.
- [ ] Focus-within ring is visible and does not clip inside the composer.
- [ ] Auto-scroll only when near the bottom; otherwise the "Tin nhắn mới" affordance appears.
- [ ] 4,000-character limit enforced; counter appears from 3,600.

## 5. Unread and realtime

- [ ] Incoming message in the open, focused room does not increment its unread count.
- [ ] Incoming message elsewhere increments the correct room/DM count.
- [ ] Opening a room clears its unread count; returning to the tab clears as specified.
- [ ] Mentions show `@` and replace the numeric count.
- [ ] A message from another user appears without a full-page reload.
- [ ] Two tabs/windows stay consistent enough for the demo (no duplicate send, no lost message).
- [ ] Typing indicator appears after the delay and disappears after idle; it does not stack.

## 6. Room creation

- [ ] Both `+` entry points open the create-room modal.
- [ ] Name validation: 2–40 characters, trimmed, unique case-insensitive.
- [ ] Duplicate name shows "Tên phòng đã tồn tại." below the field and is announced.
- [ ] Submit disabled while invalid or in flight; double submit cannot create two rooms.
- [ ] Success closes the modal, selects the new room, focuses the composer, and shows the created notice.
- [ ] Cancel and Escape close the modal and return focus to the trigger.
- [ ] Clicking the backdrop does not discard entered text without warning.

## 7. Empty, loading, error, offline

- [ ] Empty room shows icon, title, body, and a CTA; composer remains available.
- [ ] Empty DM names the person; empty people picker has copy.
- [ ] Loading skeleton matches the layout, uses `aria-busy`, and does not shift into content.
- [ ] Load error is an alert, offers retry, and retry actually refetches.
- [ ] Offline banner appears, pending messages remain marked, and reconnect flushes the queue oldest-first.
- [ ] "Đã kết nối lại" appears briefly and does not stack with the error toast.
- [ ] Toasts auto-dismiss (≈6s), are dismissible, and do not cover the composer send button.

## 8. Responsive and layout

- [ ] 1440px: sidebar 288px, thread centered at ≤760px, composer aligned.
- [ ] 1280px: no overlap, badges visible, header actions fit.
- [ ] 1024px: sidebar 240px; labels truncate gracefully.
- [ ] 768px: sidebar becomes a drawer with scrim; Escape/scrim closes; focus is trapped and restored.
- [ ] 390px: single pane; back navigation returns to the room list; composer sticky above safe area.
- [ ] 320px: no horizontal scroll; bubbles wrap; header actions collapse to an overflow menu.
- [ ] 200% zoom: content reflows, no clipped buttons, no double scrollbars.
- [ ] Long conversation: only the thread scrolls; header and composer stay fixed.

## 9. Visual QA

- [ ] No default browser styling on buttons, inputs, or lists.
- [ ] All colors, spacing, radii, and type sizes resolve from `tokens.css` (spot-check computed styles).
- [ ] 4px spacing rhythm holds; vertical rhythm between groups is consistent.
- [ ] Dark theme (`data-theme="dark"`) has no unreadable text, invisible borders, or mismatched bubble contrast.
- [ ] Own bubble and accent buttons use the accent pair; no stray indigo shades.
- [ ] Borders are 1px and consistent; shadows are subtle and do not muddy the canvas.
- [ ] Avatars are circular, initials centered, presence dots have a surface ring.
- [ ] Icons are optically aligned with text and share stroke weight.
- [ ] Hover, active, focused, and disabled states exist for every control.
- [ ] No layout shift when badges, timestamps, or the typing indicator appear.
- [ ] Empty/loading/error states look intentional, not like broken UI.

## 10. Accessibility

- [ ] Normal text ≥4.5:1; large text ≥3:1; UI boundaries and focus ring ≥3:1.
- [ ] Verify accent-on-soft, muted-on-background, and subtle timestamps in both themes.
- [ ] Every interactive element is reachable by Tab in a logical order.
- [ ] `:focus-visible` is clearly visible and never removed without replacement.
- [ ] Icon-only buttons have `aria-label`; the send button changes label/state when disabled.
- [ ] Thread is a labeled `role="log"` with `aria-live="polite"`; only new messages are announced.
- [ ] Unread/mention states are not conveyed by color alone.
- [ ] Modals trap focus, close on Escape, and restore focus to the trigger.
- [ ] Errors use `role="alert"` and include an action.
- [ ] Reduced motion stops typing dots, shimmer, spinner, and screen transitions.
- [ ] Text remains readable at 200% zoom and with Windows High Contrast forced colors.
- [ ] No keyboard trap; no focus lost after send, room switch, or modal close.
- [ ] Meaningful `alt`/labels for icons and attachments; decorative SVGs are hidden.

## 11. Copy and content

- [ ] Vietnamese diacritics render correctly; no mojibake in names, rooms, or messages.
- [ ] Placeholders name the destination ("#thiết kế", "Minh Anh").
- [ ] Empty/error copy says what happened and what to do next.
- [ ] No exclamation marks, blame, or internal jargon in user-facing strings.
- [ ] Timestamps and dates follow the spec (24h, Hôm nay/Hôm qua/dd-MM-yyyy).
- [ ] Truncation never cuts a critical action label.

## 12. Sign-off

| Area | Owner | Result | Notes |
|---|---|---|---|
| Design spec + tokens | UI/UX |  |  |
| Visual QA desktop | UI/UX |  |  |
| Responsive | UI/UX + Full-Stack |  |  |
| Functional states | QA |  |  |
| Accessibility | QA + UI/UX |  |  |
| Release readiness | DevOps |  |  |

Release gate: zero Blocker items, no open Major items in sections 3, 4, 7, 8, or 10.  
Log defects in the issue with screen, viewport, steps, expected vs actual, and a screenshot.
