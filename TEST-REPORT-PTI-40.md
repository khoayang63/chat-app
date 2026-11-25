# PTI-40 Hardening — Independent QA Verification & Release Sign-off

- **Issue:** PTI-43 — [PTI-40] QA verification and release sign-off for messaging hardening; re-verification **PTI-46** — Final QA re-verification and release verdict after fixes
- **Parent:** PTI-40 — [Hardening] Messaging MVP
- **Artifact under test:** commit `40797d3` ("PTI-42: harden responsive UI, unread badges, 4k length, a11y and search") plus binding `design/PTI-40-ADDENDUM.md`, and the fix commit `7a60b5d` ("PTI-45: fix drawer focus restore, 760px thread cap, dark contrast + minors")
- **Tester:** QA & Test Engineer (PTIT)
- **Date:** 2026-11-25 (re-verification in §8)
- **Verdict:** **GO for release** — the prior **NO-GO** (Major D-01 plus Minor D-02/D-03/D-04 and UI M1/M2/L1/L3) is superseded by the PTI-45 fix pass, independently re-verified in §8 with no open blocking defects. History is retained in §1–§7.

## 1. Commands (exact results)

Run in the workspace root with the documented Windows workaround:

| Command | Result |
| --- | --- |
| `npm run typecheck --script-shell=cmd.exe` | **PASS** (`tsc --noEmit`, exit 0, no diagnostics) |
| `npm run build --script-shell=cmd.exe` | **PASS** (66 modules; `index-3ZmhEDpp.css` 20.21 kB, `index-D-B6csJl.js` 212.17 kB) |
| `npm test --script-shell=cmd.exe` | **PASS 18/18** (exit 0) |

Suite breakdown: `tests/contract.test.mjs` 5, `tests/api.test.mjs` 7, `tests/realtime.test.mjs` 5, `tests/persistence.test.mjs` 1.

Raw tail:

```text
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

QA added `tests/contract.test.mjs` (length/name/mention contract pinned independently of the implementation) and prepended it to the `test` script in `package.json`. No application code was modified.

## 2. Scope verification

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Typecheck / build / tests | **PASS** | Section 1 |
| 2 | Length contract: 4000 everywhere, 4001 rejected, counter at 3600, README, boundary tests | **PASS** | `shared/types.ts` exposes `MAX_MESSAGE_LENGTH=4000`, `MESSAGE_COUNTER_THRESHOLD=3600`, `countCharacters` (code points); server uses them; `Composer` removed `maxLength`/`+100`, counts `trim()`ed code points, counter `>=3600`, send disabled over limit; `README.md` says 4000 and counter 3600. Tests assert 4000 accepted / 4001 rejected for ASCII **and** emoji (8000 UTF-16 units), and counter off at 3599 / on at 3600. |
| 3 | Display name 2-32 client + server, trimmed | **PASS** | `MIN/MAX_NAME_LENGTH 2/32` used by `parseDisplayName` and `NameGate` (code points, trimmed, disabled submit + inline `role="alert"`). API test rejects 1 and 33, accepts 2 and 32. Room name kept separate at 2-40. |
| 4 | Responsive 1024/768/320, drawer/scrim/Escape/focus restore, single pane + back, sticky composer, no horizontal overflow | **FAIL (partial)** | Real headless Chrome 158 (CDP) at 320/800/1024/1280: 288px sidebar at 1280, 240px at 1200/1024; mobile single-pane list↔thread swap + back; composer `position: sticky`; `documentElement.scrollWidth === innerWidth` (320) on both panes; tablet drawer opens with scrim, `chat.inert=true`, `aria-hidden=true`, `role="dialog"`, focus moves to search; Escape/close/scrim all close the drawer. **But focus restore fails on every close path** (active element becomes `BODY`, not `.menu-btn`). See D-01. |
| 5 | Unread/mention badges | **PASS** | Real second Socket.IO client sent to non-active `#general`: badge `1` (`data-kind="count"`, aria `#general, 1 tin chưa đọc`); mention message produced `@` (`data-kind="mention"`, aria `... có tin nhắn nhắc đến bạn`); sidebar order unchanged; badge cleared on open only when the window was focused (`document.hasFocus()`); when unfocused it correctly stayed. `aria-hidden` badge, full text on the row button. Session-only state, no reorder, no color-only signal. |
| 6 | A11Y semantics + keyboard | **PASS (except D-01)** | Thread `role="log"` + Vietnamese `aria-label`, `aria-live="polite"`, `aria-busy` while loading; active row `aria-current="page"`; all icon buttons have Vietnamese `aria-label`; timestamps and day dividers are `<time datetime>` (5/5 in-browser); load error is `role="alert"` with `Thử lại` (refetch) + `Đóng`; Ctrl/Cmd+K focuses search, Escape clears/ closes; grouped sender has `.sr-only` prefix; global `:focus-visible`, reduced-motion block. Drawer focus restore is D-01. |
| 7 | UI-08 search + retry | **PASS** | In-browser: query hides both lists and shows `Không tìm thấy phòng hoặc người phù hợp.` (`role="status"`); Ctrl+K focuses `#sidebar-search`; filter is accent/diacritic-insensitive incl. `đ`. Retry increments both conversation and list nonces, keeps existing messages, disables the button with `aria-busy` while retrying, and re-fetches on failure. |
| 8 | Vietnamese copy §11 + dark theme | **PASS** | All §8/§11 strings present (name gate, sidebar, search, composer, errors, connection, day labels, empty states, unread/mention ARIA). `data-theme` toggles light↔dark, persists in `ptit.theme` across reload, `aria-pressed`/label flip correctly; anti-FOUC inline script in `index.html`. Token contrast math: all pairs pass except light `success` on `success-soft` = **4.488:1** (D-03). |
| 9 | Regression: rooms, DMs, realtime, persistence | **PASS** | 18/18 tests green; `message_activity` is body-free and reaches clients outside the conversation; no cross-room/DM leakage; persistence across restart. |

### Browser/static review limits

- Verified with headless Chrome 158 via the DevTools Protocol (layout widths, computed styles, focus, DOM/ARIA, theme, search, unread with a real second Socket.IO client).
- Not verified: NVDA/VoiceOver announcements, real touch hardware/IME, 200% zoom, Windows High Contrast, multi-browser rendering, and pixel-level contrast. Token contrast was computed from `design/tokens.css`.
- Long unbroken 4,000-character runs at 320px were not exercised in the browser; the CSS uses `overflow-wrap:anywhere`/`min-width:0` and the measured 320px shell had no horizontal scroll.

## 3. Defects

### D-01 — Tablet drawer does not restore focus to the trigger — **Major** (A11Y/UI-01) — **FIXED in 7a60b5d; PASS in §8**

- **Expected (addendum §1.4; USABILITY-CHECKLIST §8/§10):** Escape, scrim click, and the drawer close button close the drawer and restore focus to `.menu-btn` (`.menu-btn`, `Mở danh sách hội thoại`).
- **Actual:** all three paths leave `document.activeElement === BODY`. Reproduced with real CDP mouse clicks and a real `Escape` key event (not synthetic `element.click()`), with focus emulation enabled; after opening, focus correctly moves to `#sidebar-search`, but no close path returns it.
- **Cause:** the drawer focus-trap effect restores focus in its cleanup, while the `.chat` `inert` attribute is still set by the preceding effect; the menu button (inside `.chat`) is therefore not focusable at that moment, and focus falls to `BODY`. The saved-focus capture can also observe `BODY` after `inert` blurs the trigger. The `?? menuButtonRef.current` fallback never runs because the saved value is `BODY`.
- **Impact:** keyboard/screen-reader users lose their place after closing the navigation drawer. Blocks the responsive/a11y release gate.
- **Suggested fix (small, PTI-42 owner):** clear `inert` in the inert effect's cleanup (or restore focus in `requestAnimationFrame` after it clears), and prefer restoring directly to `menuButtonRef.current` for the overlay trigger. Overlay selection already moves focus to the conversation heading and is unaffected.

### D-02 — Mention badge CSS selector never matches — **Minor** — **FIXED in 7a60b5d; PASS in §8**

- `Sidebar` renders `<span className="unread-badge" data-kind="mention">`, but CSS targets `.unread-badge.mention`. The mention rule is dead. Currently masked because `--color-mention-bg/text` equal the unread tokens in both themes; the visible `@` is still correct. Fix selector to `.unread-badge[data-kind="mention"]` to keep the contract when tokens diverge.

### D-03 — Light-theme success pill contrast 4.488:1 — **Minor** — **FIXED in 7a60b5d; PASS in §8**

- `.conn-online` uses `--color-success` (#15803d) on `--color-success-soft` (#e7f6ec) = **4.488:1**, marginally below 4.5:1 for normal text. Pre-existing token pair, not introduced by PTI-42. Dark theme passes (8.86:1). Adjust the token pair or use larger/bolder text.

### D-04 — Desktop composer autofocus not implemented — **Minor** — **FIXED in 7a60b5d; PASS in §8**

- Addendum §1.5 says desktop keeps composer auto-focus when opening a thread. `Composer` has no `autoFocus` and no focus-on-open path (deliberately avoided on touch). Low impact; no acceptance-table item depends on it.

## 4. Deferrals confirmed (not regressions)

- **UI-03** (optimistic/pending/offline queue/toast/retry) — explicitly deferred by PTI-41 §“out of scope” and PTI-42. Current behavior still blocks offline sends with an inline error; no new regression.
- **UI-07** (scroll-position-aware “Tin nhắn mới”) — explicitly deferred; `ChatPane` still scrolls to the newest message. No new regression.
- **UI-09** (create-room modal) — explicitly deferred; room creation remains an inline form. No new regression.
- Also deferred per addendum: read receipts, attachments, reactions, typing, presence stacks, persisted unread, per-user socket auth.

## 5. Release recommendation (historical, pre-fix — superseded by §8)

| Area | Result |
| --- | --- |
| Typecheck / build / automated suite | **PASS** |
| Length contract (4000/3600, code points) | **PASS** |
| Display name 2-32, room 2-40 | **PASS** |
| Responsive layouts, single pane, sticky composer, 320 overflow | **PASS** |
| Drawer scrim/Escape/inert/focus trap/restore | **FAIL — D-01 focus restore** |
| Unread/mention model and ARIA | **PASS** (D-02 cosmetic selector) |
| A11Y semantics and keyboard | **PASS except drawer restore** |
| Search + retry | **PASS** |
| Vietnamese copy + dark theme | **PASS** (D-03 marginal contrast) |
| Backend/realtime/persistence regressions | **PASS** |

**Final verdict: NO-GO.** The release gate requires no open Major item in responsive/accessibility sections, and D-01 is an explicit, reproducible failure of required drawer focus restoration. It is a localized fix; re-run the three commands, the added contract tests, and the drawer focus check, then QA can re-issue sign-off. D-02/D-03/D-04 are Minor and may be fixed alongside.

## 6. Re-run instructions

```powershell
npm run typecheck --script-shell=cmd.exe
npm run build --script-shell=cmd.exe
npm test --script-shell=cmd.exe          # expect 18/18
```

Then re-check in a browser at 768–1023px: open the drawer, press Escape / click the scrim / click the close button, and assert `document.activeElement` is `.menu-btn`.

## 7. Browser evidence (key values, headless Chrome 158 via CDP)

```text
320px list:   layout=mobile, pane=list, chat=display:none, docScrollWidth=320, innerWidth=320
320px thread: pane=thread, sidebar=display:none, composer=sticky, docScrollWidth=320,
              role=log, aria-label="Tin nhắn trong #dev"
800px tablet: menu visible; open -> scrim=true, chat.inert=true, aria-hidden=true,
              role=dialog, aria-modal=true, focus=#sidebar-search
1280px:       sidebar=288px; 1200px: 240px; 1024px: 240px; menu hidden
Theme:        light -> click -> dark (stored "dark", aria-pressed=true) -> reload -> dark
Search:       "zzzz-no-match" -> status "Không tìm thấy phòng hoặc người phù hợp.", 0 rows
Ctrl+K:       focus=#sidebar-search
Unread:       count badge "1", aria "#general, 1 tin chưa đọc";
              mention -> "@", aria "#general, 2 tin chưa đọc, có tin nhắn nhắc đến bạn";
              order unchanged; open while focused -> badge cleared
A11Y:         role=log, aria-live=polite, aria-current=page on active row,
              4/4 icon buttons labelled, 5/5 <time> with datetime
Focus close:  Escape / scrim / close-button -> document.activeElement = BODY (defect D-01)
```

## 8. Re-verification after PTI-45 fix — commit `7a60b5d` (PTI-46)

Independent re-audit of the fix pass, run from the fixed tree. QA did not modify application code. The only test-side change remains the prior QA addition `tests/contract.test.mjs` and its `package.json` script entry; `7a60b5d` does not touch tests.

### 8.1 Commands (exact results)

| Command | Result |
| --- | --- |
| `npm run typecheck --script-shell=cmd.exe` | **PASS** (`tsc --noEmit`, exit 0, no diagnostics) |
| `npm run build --script-shell=cmd.exe` | **PASS** (66 modules; `index-Cs42aIMF.css` 20.54 kB, `index-hD3_d7YQ.js` 212.46 kB) |
| `npm test --script-shell=cmd.exe` | **PASS 18/18** (exit 0) |

Suite breakdown: `tests/contract.test.mjs` 5, `tests/api.test.mjs` 7, `tests/realtime.test.mjs` 5, `tests/persistence.test.mjs` 1.

```text
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

No test weakening: `git show --stat 7a60b5d` changed only `design/tokens.css`, `src/App.tsx`, `src/components/Sidebar.tsx`, `src/styles.css` (47 insertions, 12 deletions). No test file was altered.

### 8.2 Per-defect results

| Defect | Result | Evidence (fixed tree) |
| --- | --- | --- |
| **D-01** drawer focus restore | **PASS** | At 800×900 the drawer opened with `role=dialog`, `aria-modal=true`, `chat.inert=true`, focus on `#sidebar-search`. Real CDP input: `Escape`, scrim click, and `.drawer-close` click each closed the drawer and left `document.activeElement` = `.icon-btn.menu-btn` (`aria-expanded` false). |
| **D-02** mention selector | **PASS** | Injected `.unread-badge[data-kind="mention"]` computes `background-color` equal to `--color-mention-bg` in both themes (light `rgb(67,56,202)`, dark `rgb(79,70,229)`); the dead `.unread-badge.mention` rule is gone. |
| **D-03** success pill contrast | **PASS** | Light `.conn-online`: `#15803d` on `#eaf8ef` = **4.579:1** (was 4.488:1). Dark: `#4ade80` on `#12291c` = **8.864:1**. |
| **D-04** desktop composer focus | **PASS** | At 1280 the initial load focuses `.composer textarea`; selecting a different room (`#random`) also focuses the composer textarea after paint. Touch/mobile heading behavior unchanged. |
| **M1** 760px thread/composer cap | **PASS** | 1280: chat 992, `.messages`/`.composer-wrap` **760** wide, computed `max-width: 760px`, center delta **0 px**, header 992 (full-bleed). 1440: chat 1152, both **760**, center delta **0 px**, header 1152. |
| **M2** dark `.link-btn` contrast | **PASS** | `.link-btn` computed color equals `--color-accent-text`. Light: 7.903:1 on surface, 6.915:1 on danger-soft. Dark: **8.758:1** on surface, **8.529:1** on danger-soft. The real error-banner `Đóng` measured **8.529:1** on the banner background. |
| **L1** footer one line at 1024 | **PASS** | 240px sidebar; `.identity-hint` = one client rect, `white-space: nowrap`, `text-overflow: ellipsis`, footer horizontal overflow **0 px**. |
| **L3** drawer role only while open | **PASS** | Closed: no `role`, no `aria-modal`, `aria-hidden="true"` on `.sidebar-inner`. Open: `role=dialog`, `aria-modal=true`, `aria-hidden` removed, chat inert. |
| **L5** (optional) heading focus ring | **PASS** | `#conversation-heading:focus` replaces the full focus ring with a subtle inset surface while keeping `tabIndex={-1}`; not an acceptance gate. |

### 8.3 Regression results

| Area | Result | Evidence |
| --- | --- | --- |
| A11Y semantics | **PASS** | `role=log`, `aria-live=polite`, Vietnamese thread label, `aria-current=page` on active row, all icon buttons labelled (`Tạo phòng`, `Bắt đầu trò chuyện riêng`, menu, back). |
| Length contract UI | **PASS** | 4001 code points → send disabled, counter `4001/4000`, `aria-invalid=true`; 4000 → send enabled, counter `4000/4000`. Backend 4000/4001 contract tests green. |
| Search | **PASS** | `zzzz-no-match` → 0 rows + `role=status` “Không tìm thấy phòng hoặc người phù hợp.”; `Ctrl+K` focuses `#sidebar-search`. |
| Unread/mention badges | **PASS** | Real second Socket.IO user: non-active `#random` badge `1` (`data-kind=count`, aria `#random, 1 tin chưa đọc`); mention becomes `@` with aria `... có tin nhắn nhắc đến bạn`; opening focused room clears the badge; order unchanged. |
| Load-error retry | **PASS** | Network-blocked `/api/messages` produced `role=alert` with `Thử lại` + `Đóng`; unblocking + retry refetched and rendered the message, banner cleared. |
| Backend realtime/persistence | **PASS** | 18/18 suite (realtime body-free `message_activity`, room/DM isolation; restart persistence). |

### 8.4 Browser evidence (headless Chrome via CDP, production build)

All 32 checks passed (`total=32 pass=32 fail=0`).

```text
M1 1280: chat=992, messages=760 (max-width 760px), composer=760, centerDelta=0, header=992
M1 1440: chat=1152, messages=760, composer=760, centerDelta=0, header=1152
D-01 open:   drawer=open, role=dialog, aria-modal=true, chat.inert=true, focus=#sidebar-search
D-01 escape: drawer=closed, active=.icon-btn.menu-btn
D-01 scrim:  drawer=closed, active=.icon-btn.menu-btn
D-01 close:  drawer=closed, active=.icon-btn.menu-btn
L3 closed:   role=null, aria-modal=null, aria-hidden=true
M2 dark:     link 8.758:1 surface / 8.529:1 danger-soft; pill 8.864:1
D-03 light:  pill 4.579:1
D-04:        initial active=TEXTAREA in .composer; switch #dev->#random active=TEXTAREA
Badges:      "1" -> "@"; aria includes count + mention phrase; cleared on open while focused
Retry:       role=alert -> Thử lại -> 1 bubble, alert cleared
```

### 8.5 Residual notes (non-blocking)

- `design/tokens.css` light `--color-success-soft` moved `#e7f6ec` → `#eaf8ef` to clear D-03. Functionally verified; the addendum §10 guardrail (“do not edit `design/`”) was aimed at PTI-42, so the UI owner should simply acknowledge this value-only change in PTI-47.
- Rooms are returned alphabetically (`dev`, `general`, `random`), so the default `rooms[0]` is `#dev`. D-04 is verified on a real conversation switch, not by re-selecting the already-active room.
- Verification used headless Chrome via CDP and computed token/rendered colors. Not re-run: NVDA/VoiceOver announcements, physical touch/IME, 200% zoom, Windows High Contrast, pixel-level contrast sampling.
- PTI-47 (UI/UX re-review) and PTI-48 (DevOps clean-install/CI) are separate company gates; they do not change this QA verdict.

### 8.6 Final verdict

**GO for release.** All previously blocking defects (Major D-01, Minor D-02/D-03/D-04, Medium M1/M2, Low L1/L3) are fixed in `7a60b5d` and independently re-verified; typecheck, production build, and the full 18-test suite are green with no test weakening. No open defect blocks the PTI-40 release gate.
