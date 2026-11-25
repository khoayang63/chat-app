# PTIT Messaging MVP — Test Report

- **Issue:** PTI-36 — [QA] Test suite, test plan and release sign-off for messaging MVP
- **Parent:** PTI-33 — Internal messaging app for PTIT
- **Tester:** QA & Test Engineer (PTIT)
- **Date:** 2026-11-25
- **Build under test:** workspace snapshot at `ee4772bb-…` (no git repository in the workspace, so no commit hash is available)
- **Verdict:** **Automated gate PASS — 12/12 tests green.** **Product release sign-off: NO-GO under the stated design gate; CONDITIONAL GO for an internal demo only.** Four Major UI/UX gaps and one accessibility gap are open (see §7). The backend, realtime delivery, validation, and persistence are verified by real tests.

## 1. Summary

| Area | Result |
| --- | --- |
| Clean install (`npm ci`, 213 packages) | PASS (with host workaround ENV-01) |
| Automated suite (12 tests) | **PASS — 12 passed, 0 failed** |
| Typecheck (`tsc --noEmit`) | PASS |
| Production build (`vite build`) | PASS (65 modules, 200.73 kB JS) |
| Realtime uses real Socket.IO sockets | PASS (two or more independent `socket.io-client` connections) |
| Persistence across server restart | PASS |
| Manual/browser UI + accessibility session | **NOT RUN** in this automated run |
| Release recommendation | **NO-GO for release as specified; CONDITIONAL GO for internal demo** (§9) |

The automated acceptance criteria from PTI-36 are met on the CI-equivalent environment. The remaining NO-GO is driven by unimplemented design requirements and accessibility semantics, not by failing backend tests.

## 2. Artifacts delivered

| File | Purpose |
| --- | --- |
| `tests/helpers.mjs` | Real server lifecycle, ephemeral ports, temp DB, HTTP/socket helpers |
| `tests/api.test.mjs` | 7 API integration/validation/history tests |
| `tests/realtime.test.mjs` | 4 realtime broadcast/isolation/validation tests |
| `tests/persistence.test.mjs` | 1 restart-persistence test |
| `TEST-PLAN.md` | Scope, environments, matrix, how to run, exit criteria |
| `MANUAL-CHECKLIST.md` | Human/browser verification script |
| `TEST-REPORT.md` | This report |
| `package.json` | `test` script now runs the full suite via `node --import tsx --test …` |

The previous `tests/smoke.test.mjs` was replaced by the scenario suite (its bootstrap, room, message, and DM cases are covered, with stronger assertions).

## 3. Environment

| Item | Value |
| --- | --- |
| OS | Windows 11 Home 10.0.26100 |
| Node.js | v22.19.0 (local). CI target is Node 20; see §8 limitation. |
| npm | 10.9.3 |
| tsx | 4.23.15 |
| socket.io / socket.io-client | 4.8.4 / 4.8.1 |
| better-sqlite3 | 11.10.0 |
| Database | Fresh temp SQLite file per test file (`os.tmpdir()`), never `data/ptit.db` |
| Server | Real child process `node --import tsx server/index.ts` on an ephemeral `127.0.0.1` port |

## 4. Automated results — 12/12 pass

Command (host workaround explained in ENV-01):

```powershell
npm test --script-shell=cmd.exe
```

Raw tail:

```text
# tests 12
# pass 12
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3596.2922
```

| ID | Test | Result |
| --- | --- | --- |
| API-01…03 | Health, seeded rooms, `/api/me` upsert/trim/case-insensitivity | PASS |
| API-04 | `/api/users` includes the user | PASS |
| API-05/06 | Name rejection (missing/blank/control/41 chars) and 40-char boundary | PASS |
| API-07/08 | Room creation normalization (`#QA Room JS` → `qa-room-js`) and duplicate `409` | PASS |
| API-09/10 | Malformed/oversized room names rejected; 30-char and `_` accepted | PASS |
| API-11…14 | Message-target validation (`400`/`404`, empty histories) | PASS |
| API-15 | 60 messages → latest 50, oldest first, correct order and unique IDs | PASS |
| RT-01 | Two real sockets in one room both receive the same message; ack `ok`; body trimmed | PASS |
| RT-02 | No cross-room leakage (third socket in `#random` gets nothing; no history leak) | PASS |
| RT-03 | DM isolation between `A↔B` and `C↔D`; DM not written to room history | PASS |
| RT-04…09 | Empty/whitespace/2,001-char rejection, 2,000-char boundary, unknown sender, missing name, both/invalid/no target, `null` payload | PASS |
| PERS-01/02 | Room/user/messages survive kill+restart in order; DB remains writable | PASS |

Notable evidence of “genuine” realtime:

- `tests/realtime.test.mjs` creates independent `io(base, { transports: ["websocket"], forceNew: true })` sockets and asserts the **same `new_message` ID** arrives on both.
- Negative cases attach a `new_message` listener before sending and fail if an event arrives from another room/DM, with a 400–600 ms window after a confirmed join ack.
- No Socket.IO server or client is mocked.

Persistence evidence:

- The test kills the API child process, relaunches it on a new port with the **same `DB_PATH`**, and asserts the created room, user identity, and two messages are present in order. A third message is then sent successfully.

## 5. Clean-checkout verification

Performed in a separate copy of the workspace (no `node_modules`, `dist`, or `data`):

```powershell
npm ci --script-shell=cmd.exe
# added 213 packages, and audited 214 packages in 7s
# found 0 vulnerabilities

npm test --script-shell=cmd.exe
# tests 12 / pass 12 / fail 0
```

This satisfies the “clean checkout” intent of the acceptance criterion (npm `ci` installs exactly the lockfile). The plain command on this host is affected by ENV-01 below.

## 6. Static checks

| Command | Result |
| --- | --- |
| `npm run typecheck --script-shell=cmd.exe` | PASS (no diagnostics) |
| `npm run build --script-shell=cmd.exe` | PASS (65 modules; `index-CO8qBmcd.js` 200.73 kB, CSS 15.56 kB) |

Not run locally: Docker image build/compose validation (declared in `.github/workflows/ci.yml`, not part of PTI-36).

## 7. Defects

Severity follows `design/USABILITY-CHECKLIST.md` and `TEST-PLAN.md` §9. Environment defects are separated from product defects.

### ENV-01 — npm scripts cannot resolve `node` on this agent host — Blocker (environment, not product)

- **Status:** Open, external to the repo. Workaround verified.
- **Reproduction:**
  ```powershell
  npm test
  ```
  ```text
  > node --import tsx --test tests/api.test.mjs tests/realtime.test.mjs tests/persistence.test.mjs
  /usr/bin/bash: line 1: node: command not found
  ```
  Exit code **127**. The same failure occurs for `npm run typecheck` (`tsc: command not found`).
- **Cause:** The harness sets `npm_config_script_shell=C:\Program Files\Git\bin\bash.exe`, while `PATH` is passed in Windows `;`-delimited form. Git Bash expects `:`, so it cannot resolve `node` or `node_modules/.bin`, regardless of the project’s script contents.
- **Expected:** `npm test` runs the suite.
- **Actual:** Every npm script fails before running.
- **Verification of workaround:** `npm test --script-shell=cmd.exe` → 12/12 pass; direct `node --import tsx --test …` → 12/12 pass.
- **Impact:** Local acceptance command on this Windows agent host only. Ubuntu CI uses the default POSIX shell and is unaffected.
- **Owner:** Platform/DevOps (npm config or PATH translation in the harness). Not fixable portably from `package.json`; a committed `.npmrc` cannot override an environment variable and a Windows-only shell would break Linux CI.

### QA-01 — Original `npm test` ran only four smoke checks — Fixed

- **Status:** Fixed by QA.
- **Before:** `tsx --test tests/smoke.test.mjs` (4 coarse tests).
- **After:** `node --import tsx --test tests/api.test.mjs tests/realtime.test.mjs tests/persistence.test.mjs` (12 scenario tests, real sockets, persistence restart).
- **Note:** `node --import tsx` also removes a second PATH dependency on the `tsx` shim.

### UI-01 — Responsive/mobile layouts not implemented — Major

- **Status:** Open. **Blocks release gate section 8.**
- **Where:** `src/styles.css:221` (fixed `grid-template-columns: var(--sidebar-width) minmax(0,1fr)`), `src/styles.css:794` (only a `max-width: 760px` sidebar-width tweak).
- **Reproduction:** Open the app at 768 px and 390 px. The sidebar remains a fixed column beside the chat; there is no overlay drawer/scrim, no single-pane view, and no back navigation. At 390 px the chat column is extremely narrow. At 768 px the required drawer + focus trap is absent.
- **Expected (design §7):** 768–1023 px overlay drawer with scrim/Escape/focus restore; <768 px full-screen list + full-screen thread with back button and sticky composer.
- **Actual:** Two persistent columns at all widths; only the sidebar width changes below 760 px.

### UI-02 — Unread and mention badges are missing — Major

- **Status:** Open. Unread indicators are listed as required MVP behavior in `design/DESIGN-SPEC.md` §1.
- **Where:** `src/components/Sidebar.tsx:103-119` (room rows have no badge); `src/App.tsx` has no unread state or clear-on-open logic.
- **Reproduction:** With two profiles, send a message to a non-active room. The sidebar row shows no count/`@`; opening the room has nothing to clear.
- **Expected:** Numeric unread badge, `@` for mentions, `aria-current`, accessible name including the count; no color-only signal.
- **Actual:** No unread state exists anywhere.

### UI-03 — No optimistic/pending state, offline queue, retry, or toast — Major

- **Status:** Open. **Blocks release gate sections 4 and 7.**
- **Where:** `src/App.tsx:211` throws `"Not connected — reconnecting…"` when the socket is offline; `src/components/Composer.tsx:27-29` only shows an inline error and keeps text; `src/components/ChatPane.tsx:133` renders only final bubbles (no pending/failed variant).
- **Reproduction:** DevTools → Network → Offline. Type and send. An inline error appears; no optimistic bubble, no queued retry, no toast, no reconnect flush, no “Đã kết nối lại” message. On reconnect the text must be re-sent manually.
- **Expected (design §4.3/§4.6):** optimistic bubble with pending indicator, ack replaces pending, failure keeps bubble + “Gửi lại” + toast, offline banner and oldest-first queue flush on reconnect.
- **Actual:** Blocking send only; error message; no queue/pending/retry/toast.

### UI-04 — Message-length contract is inconsistent (4,000 vs 2,000 vs 2,100) — Major

- **Status:** Open, cross-team decision needed.
- **Where:** `design/DESIGN-SPEC.md:84` (max 4,000; counter from 3,600), `shared/types.ts:52` (`MAX_MESSAGE_LENGTH = 2000`), `README.md:56` (2,000), `src/components/Composer.tsx:45` (`maxLength = MAX_MESSAGE_LENGTH + 100`).
- **Reproduction:** Paste 2,001 characters and send. The server rejects with “Message must be at most 2000 characters”; the UI allowed typing it. Messages of 2,001–4,000 characters that the design promises cannot be sent.
- **Expected:** One limit everywhere, with the counter at the documented threshold.
- **Actual:** Design says 4,000; server enforces 2,000; composer permits 2,100 input before erroring. Automated tests encode the implemented 2,000 contract (RT-05/06) and will need updating if the product changes.

### A11Y-01 — Core accessibility semantics/state missing — Major

- **Status:** Open. **Blocks release gate section 10.**
- **Where/examples:**
  - Thread: `src/components/ChatPane.tsx:96` has `aria-live="polite"` but no `role="log"`, no accessible label.
  - Active conversation: room/DM buttons have no `aria-current` (`src/components/Sidebar.tsx:108-116`).
  - Icon-only `+` buttons rely on `title`, not `aria-label` (`src/components/Sidebar.tsx:74-84`, `125-136`).
  - Timestamps are `<span>` + locale string, not `<time datetime>` (`src/components/ChatPane.tsx:135`); day labels are English.
  - Loading state has no `aria-busy` (`src/components/ChatPane.tsx:97-100`).
  - Error banner has `role="alert"` (good) but only “Dismiss”, no retry action.
- **Reproduction:** Keyboard/screen-reader pass per `MANUAL-CHECKLIST.md` §10; inspect the accessibility tree.
- **Expected (design §10):** labeled `role="log"` region, `aria-current` on active rows, labeled icon buttons, `aria-busy`, `<time datetime>`, focus restoration for overlays.
- **Actual:** Partial semantics only; several required attributes absent.

### UI-05 — UI copy is English, design mandates Vietnamese — Major

- **Status:** Open.
- **Where:** `src/components/NameGate.tsx:40-59`, `src/components/Sidebar.tsx:65/73/123/147/202`, `src/components/ChatPane.tsx:79/92/99/106`; compare `design/DESIGN-SPEC.md:316-354`.
- **Reproduction:** Open the app. All labels, placeholders, empty states, and errors are English; the specified microcopy is Vietnamese.
- **Expected:** Vietnamese copy table in design §11 (with diacritics).
- **Actual:** English throughout. Day labels also use “Today/Yesterday” rather than “Hôm nay/Hôm qua”.

### UI-06 — Name gate accepts a 1-character name; limits differ from design — Minor

- **Status:** Open.
- **Where:** `src/components/NameGate.tsx:19-22` only checks non-empty; `server/index.ts:51` allows up to 40; design §4.1 says 2–32.
- **Reproduction:** Enter `A` and submit. Accepted. Enter 33–40 characters. Accepted.
- **Expected:** Trimmed 2–32 characters, inline announced error.
- **Actual:** 1–40 accepted.

### UI-07 — Auto-scroll always jumps to the newest message — Minor

- **Status:** Open.
- **Where:** `src/components/ChatPane.tsx:58-62` calls `scrollIntoView` on every message-count change.
- **Reproduction:** Scroll up in a long room while another user sends a message; the view is forced to the bottom.
- **Expected (design §4.3):** auto-scroll only within ~100 px of the bottom; otherwise show “Tin nhắn mới”.
- **Actual:** Always scrolls.

### UI-08 — Load-error retry/search/state parity missing — Major

- **Status:** Open. **Blocks release gate section 7.**
- **Where:** `src/components/ChatPane.tsx:87-94` error banner offers only “Dismiss”; no retry/refetch control. No search field exists in `src/components/Sidebar.tsx` despite design §5.1.
- **Reproduction:** Stop the API, reload a conversation → error banner with no retry. Look for the “Tìm phòng hoặc người” field → absent.
- **Expected:** `role="alert"` error with a working retry/refetch, plus the search field (visual if search is not shipped).
- **Actual:** Dismiss-only; search absent.

### UI-09 — Room creation is an inline form, not the specified modal — Minor

- **Status:** Open.
- **Where:** `src/components/Sidebar.tsx:87-101`.
- **Reproduction:** Click `+` in the Rooms header. An inline input opens; there is no modal, backdrop, Escape handling, or focus restore.
- **Expected (design §4.4):** modal with focus trap, Escape/cancel return focus, untouched-backdrop close rule.
- **Actual:** Inline form; server-side duplicate/validation still works (API-08/09).

### VIS-01 — Dark theme is not exposed — Minor

- **Status:** Open.
- **Where:** `src/main.tsx:5` imports `design/tokens.css`, but there is no theme switch or `data-theme` use in app code.
- **Reproduction:** Look for a theme control; none.
- **Expected:** Tokens support both themes; visual QA requires a dark-theme spot-check.
- **Actual:** Light theme only by default. Manual attribute override can still be used for token checks.

## 8. What was verified vs. not verified

Verified (real execution):

- API bootstrap, room creation/normalization/duplicates, message-target validation.
- History ordering and the 50-message cap with 60 seeded real messages.
- Socket.IO: two independent sockets in one room, no cross-room leakage, DM-pair isolation.
- Server-side validation for empty, whitespace, 2,001-char, unknown sender, missing sender, invalid/both/no target, and `null` payloads.
- Persistence of rooms, users, and messages across a real process restart; DB remains writable.
- Typecheck and production build.
- Clean install from the lockfile in a separate copy.

Not verified (explicitly out of this run):

- Manual browser/UI behavior, visual fidelity, responsive breakpoints, and dark theme (no browser/screen-reader session here). `MANUAL-CHECKLIST.md` provides the steps; static review findings above anticipate several failures.
- Real screen-reader announcements (NVDA/VoiceOver), color-contrast measurement, 200% zoom, Windows High Contrast.
- Multiple browsers/devices and touch behavior.
- Node 20 runtime locally: only Node 22.19.0 was installed. The suite uses APIs available in Node 20 (`node:test`, `fetch`, `--import`, `Array.prototype.at`), and CI is configured for Node 20, but the Node 20 job was not executed in this workspace.
- Docker build/compose, deployment, load/performance, security testing, and auth (out of scope).
- UI realtime tested manually with two browser profiles; only protocol-level realtime was automated.

## 9. Release recommendation and sign-off

**Automated release gate: PASS.** The messaging backend is functional, validated, and durable under restart; realtime isolation is genuinely exercised.

**Product release gate (`design/USABILITY-CHECKLIST.md` §12): NOT MET.** Open Major items touch gate sections 4 (UI-03), 7 (UI-03/UI-08), 8 (UI-01), and 10 (A11Y-01), plus required-product gaps in unread indicators (UI-02) and the length contract (UI-04).

**Recommendation:**

- **NO-GO for a release described as matching the PTIT design spec.**
- **CONDITIONAL GO for a small internal demo/pilot**, provided stakeholders explicitly accept: English copy, no unread badges, no offline queue/pending/retry, responsive layouts below 1024 px, and reduced accessibility semantics. These should be tracked as follow-up work, not treated as “done”.
- Before any wider release: fix UI-01, UI-02, UI-03, UI-04, A11Y-01 (and UI-08), re-run `npm test`, then execute `MANUAL-CHECKLIST.md` and attach evidence.

| Sign-off area | Owner | Result |
| --- | --- | --- |
| Backend API, validation, history | QA | **PASS** (7 tests) |
| Realtime (rooms/DMs/isolation) | QA | **PASS** (4 tests) |
| Persistence | QA | **PASS** (1 test) |
| Build/typecheck | QA | **PASS** |
| Visual QA / responsive | UI/UX + Full-Stack | **NOT VERIFIED** — Major gaps found statically (UI-01, UI-05, VIS-01) |
| Functional UI states | QA | **NOT VERIFIED manually** — Major gaps (UI-02, UI-03, UI-08) |
| Accessibility | QA + UI/UX | **NOT VERIFIED manually** — Major gap (A11Y-01) |
| Release readiness | QA | **NO-GO** (conditional internal demo only) |
| Local command execution | Platform/DevOps | **BLOCKED by ENV-01** on this host; workaround verified |

## 10. Re-run instructions

After any fix:

```powershell
npm ci --script-shell=cmd.exe          # or plain npm ci on a normal host/CI
npm test --script-shell=cmd.exe        # expect 12/12
npm run typecheck --script-shell=cmd.exe
npm run build --script-shell=cmd.exe
```

Then execute `MANUAL-CHECKLIST.md` in a browser with two profiles and record results in §12 of that file. Update this report with the new run, including any changed defect states. Automated results are honest only for the code snapshot tested here; they do not certify UI behavior.
