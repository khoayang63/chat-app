# PTIT Messaging MVP — Test Plan

- **Issue:** PTI-36 — [QA] Test suite, test plan and release sign-off for messaging MVP
- **Parent:** PTI-33 — Internal messaging web app for PTIT
- **Owner:** QA & Test Engineer
- **Status:** Active — automated gate green (12/12); UI/UX verification pending (see `TEST-REPORT.md`)
- **Last updated:** 2026-11-25

## 1. Purpose and scope

This plan covers quality verification of the PTIT internal messaging MVP delivered in this workspace:

- Node 20+ / Express / Socket.IO / SQLite (`better-sqlite3`) backend in `server/`.
- Vite / React / TypeScript frontend in `src/`, with design tokens in `design/tokens.css` and the visual baseline in `design/wireframes.html`.
- Shared payload types and limits in `shared/types.ts`.

In scope:

1. **API integration** — bootstrap endpoints (`/api/health`, `/api/me`, `/api/users`, `/api/rooms`, `/api/messages`), room creation and normalization, message history ordering and the 50-message limit, request validation.
2. **Realtime** — genuine Socket.IO behavior with real `socket.io-client` sockets: two clients in one room, no cross-room leakage, DM isolation, acknowledgement validation.
3. **Persistence** — messages, rooms, and users survive a server restart against the same SQLite file.
4. **UI states and usability** — manual/browser checklist for layout, states, keyboard send, responsive behavior, and accessibility basics (`MANUAL-CHECKLIST.md`), with static conformance review against `design/USABILITY-CHECKLIST.md` and `design/DESIGN-SPEC.md`.
5. **Build health** — TypeScript typecheck and production build.

Out of scope (explicitly not tested or certified here):

- Authentication, accounts, authorization, session security (product explicitly ships without auth for the MVP).
- Attachments, reactions, message editing/deletion, read receipts, typing indicators, search, push/offline delivery.
- Performance, load, soak, and fuzzing beyond basic boundary validation.
- Full cross-browser/device lab, real screen-reader sessions, and manual color-contrast measurement (checklist items are provided but were not executed in this automated run).
- Deployment, Docker image build, and production infrastructure.
- Security penetration testing and dependency supply-chain audit.

## 2. System under test

```
Browser (Vite/React) ──HTTP/WS──> Express + Socket.IO (server/index.ts)
                                         │
                                         ├── SQLite via better-sqlite3 (server/db.ts)
                                         └── shared/types.ts (limits, DM key rules)
```

- Rooms and DMs share the same message store; `messages.room_id` XOR `messages.dm_key` is enforced by a CHECK constraint.
- History is the **latest 50** messages returned **oldest first**.
- Server-side validation is authoritative; client validation is convenience only.
- DM key contract: `dm:<userIdA>:<userIdB>` with sorted IDs.

## 3. Environments

| Environment | Runtime | Purpose |
| --- | --- | --- |
| Automated QA host | Windows 11, Node **v22.19.0**, npm 10.9.3, tsx 4.23.15, socket.io 4.8.4, better-sqlite3 11.10.0 | Local execution of this plan |
| CI target | Ubuntu, Node **20** (`.github/workflows/ci.yml`) | Install, typecheck, build, test |
| Test database | Fresh temporary SQLite file per test file under `os.tmpdir()` | Isolation from developer data |
| Test server | Child process `node --import tsx server/index.ts`, ephemeral port on `127.0.0.1` | Real HTTP + WebSocket, no mocks |

The suite never reads or writes `./data/ptit.db`. Each test file starts its own server with a unique `DB_PATH`, `PORT`, and `CLIENT_ORIGIN`.

## 4. Test approach

The project already configures `node:test` through `tsx`; that runner is retained. Vitest is **not** added because a runner exists and the acceptance criterion is a runnable `npm test`.

| Layer | Tool | What is real |
| --- | --- | --- |
| API integration | `node:test` + global `fetch` | Express server and SQLite are real |
| Realtime | `node:test` + `socket.io-client` | Two or more independent WebSocket sockets against a real Socket.IO server |
| Persistence | `node:test` + process restart | Server is killed and restarted against the same DB file |
| Static checks | `tsc --noEmit`, `vite build` | Full TypeScript and production build |
| UI/manual | Human browser session | Not executed by this automated QA run (see report) |

## 5. How to run

From the repository root:

```bash
npm ci
npm test
```

Expected result: **12 tests, 12 pass, 0 fail**. The suite takes about 3–5 seconds.

> **Windows agent-host note (ENV-01).** In this Paperclip environment npm is configured with Git Bash as `script-shell` (`npm_config_script_shell=C:\Program Files\Git\bin\bash.exe`) while `PATH` is passed in Windows `;` form, so the shell cannot resolve `node` and **every** npm script exits 127. This is a host/npm configuration defect, not a project defect. Use either:
>
> ```powershell
> npm test --script-shell=cmd.exe
> ```
>
> or run the runner directly:
>
> ```powershell
> node --import tsx --test tests/api.test.mjs tests/realtime.test.mjs tests/persistence.test.mjs
> ```
>
> CI on Ubuntu uses the default POSIX shell and is unaffected. Full reproduction is in `TEST-REPORT.md` (ENV-01).

Useful commands:

```bash
npm run typecheck   # tsc --noEmit
npm run build       # production frontend build into dist/
npm run dev         # API + Vite for manual testing
```

## 6. Test matrix

### 6.1 Automated — API integration (`tests/api.test.mjs`)

| ID | Scenario | Expected |
| --- | --- | --- |
| API-01 | `GET /api/health` | `200 {"ok":true}` |
| API-02 | `GET /api/rooms` on a fresh DB | `dev`, `general`, `random`, sorted, with id/name/ISO createdAt |
| API-03 | `GET /api/me?name=  Alice  ` then `name=alice` | Name trimmed; same user ID; original casing kept |
| API-04 | `/api/users` after upsert | Includes the created user |
| API-05 | `/api/me` missing/blank/control/41-char name | `400` with an error message |
| API-06 | `/api/me` exactly 40 chars | `200` (documented upper limit) |
| API-07 | `POST /api/rooms {"name":"  #QA Room  JS  "}` | `201`, name normalized to `qa-room-js` |
| API-08 | Duplicate room, including `#` and different casing | `409 already exists` |
| API-09 | Malformed room names (`""`, `"   "`, `"#"`, `"!!"`, `"hello world!"`, 31 chars) | `400` |
| API-10 | Room name exactly 30 chars and with `_` | `201` |
| API-11 | `GET /api/messages` with neither/both `roomId` and `dmKey` | `400` |
| API-12 | `GET /api/messages?roomId=<unknown>` | `404` |
| API-13 | `GET /api/messages?dmKey=not-a-dm-key` | `400` |
| API-14 | Empty room and empty DM history | `200` with `[]` |
| API-15 | 60 messages then history | Latest 50 only, `msg-10`…`msg-59`, oldest first, non-decreasing timestamps, unique IDs |

### 6.2 Automated — Realtime (`tests/realtime.test.mjs`)

| ID | Scenario | Expected |
| --- | --- | --- |
| RT-01 | Two real sockets join the same room; one sends | Both receive the same `new_message` ID; sender ack `{ok:true}`; body trimmed |
| RT-02 | Sender + peer in `#general`, third socket in `#random` | Only `#general` sockets receive; `#random` history does not contain the message |
| RT-03 | Two separate DM pairs (`A↔B`, `C↔D`) | Only the sending pair receives; other DM history stays empty; DM is not in room history |
| RT-04 | Empty/whitespace bodies | Ack `{ok:false}` with "empty" error; nothing persisted |
| RT-05 | 2,001-character body | Ack `{ok:false}` with the 2,000 limit in the error |
| RT-06 | Exactly 2,000-character body | Ack `{ok:true}` and persisted |
| RT-07 | Unknown sender ID | Ack `{ok:false}` "unknown sender" |
| RT-08 | Missing sender name | Ack `{ok:false}` |
| RT-09 | Both `roomId` and `dmKey`; invalid room; invalid dmKey; no target; `null` payload | Ack `{ok:false}`; nothing persisted |

### 6.3 Automated — Persistence (`tests/persistence.test.mjs`)

| ID | Scenario | Expected |
| --- | --- | --- |
| PERS-01 | Create room and users, send two messages, kill server, restart on same DB | Room, users, and both messages still present in order; existing user keeps ID/name |
| PERS-02 | Send a third message after restart | Succeeds; history becomes 3 in order (DB remains writable) |

### 6.4 Manual/UI — browser verification (`MANUAL-CHECKLIST.md`)

| ID | Area | Maps to design checklist |
| --- | --- | --- |
| M-01 | First run, name gate, reload persistence | `USABILITY-CHECKLIST` §1 |
| M-02 | Room list, active state, long names, sidebar scroll | §2 |
| M-03 | Message grouping, day dividers, timestamps, own/other bubbles, wrapping | §3 |
| M-04 | Composer: disabled send, Enter/Shift+Enter, IME, growth, focus, pending/retry, scroll | §4 |
| M-05 | Realtime with two browser profiles, unread/mention behavior | §5 |
| M-06 | Room creation modal, validation, duplicate, cancel/Escape, focus restore | §6 |
| M-07 | Empty/loading/error/offline states, reconnect, toasts | §7 |
| M-08 | Responsive 1440/1280/1024/768/390/320 and 200% zoom | §8 |
| M-09 | Visual/token consistency, dark theme | §9 |
| M-10 | Keyboard order, focus visible, `aria-current`, `role="log"`, icon labels, contrast, reduced motion | §10 |
| M-11 | Vietnamese copy, placeholders, timestamps, truncation | §11 |

## 7. Test data and isolation

- Each test file gets a unique DB path (`ptit-<label>-<pid>-<timestamp>-<random>.db`) and an ephemeral port via a `listen(0)` probe.
- Room names and message bodies are unique per test to avoid order-dependent collisions.
- Tests never depend on seeded message data; only the three seeded rooms are assumed.
- Sockets are explicitly disconnected and child servers killed in `finally`/`after` hooks; temp DB, `-wal`, and `-shm` files are removed.
- Negative realtime assertions use a 400–600 ms no-event window after a confirmed `join_room` ack.

## 8. Entry and exit criteria

**Entry:** backend and frontend build; `server/index.ts` starts with a writable `DB_PATH`; `socket.io-client` installed.

**Exit (automated gate):**

- `npm ci` completes from a clean checkout.
- `npm test` reports 0 failures (or every failure is logged as a defect with reproduction).
- `npm run typecheck` and `npm run build` pass.
- Realtime tests use at least two independent sockets; no socket mocks.

**Exit (release gate per `design/USABILITY-CHECKLIST.md` §12):**

- Zero Blocker items.
- No open Major items in design-checklist sections 3, 4, 7, 8, or 10.
- Manual checklist executed and signed by QA + UI/UX.
- Any accepted deviation is recorded with owner and follow-up issue.

## 9. Defect severity

| Severity | Definition |
| --- | --- |
| Blocker | Prevents use, prevents the test/release command from running, data loss, or fails WCAG AA on core flow. |
| Major | Required behavior missing or visibly broken; spec/design contract violated; no workaround in normal use. |
| Minor | Polish, copy, or a mismatch with a low-impact workaround. |

Defects are recorded in `TEST-REPORT.md` with reproduction steps and references. This plan treats environment failures separately from product defects.

## 10. Deliverables and traceability

| Artifact | Purpose |
| --- | --- |
| `tests/helpers.mjs` | Real server/socket lifecycle, ephemeral ports/DBs, HTTP helpers |
| `tests/api.test.mjs` | API integration, validation, history ordering/limit |
| `tests/realtime.test.mjs` | Real Socket.IO broadcast/isolation/validation |
| `tests/persistence.test.mjs` | Restart persistence |
| `TEST-PLAN.md` | This plan |
| `MANUAL-CHECKLIST.md` | Browser/UI/a11y verification steps |
| `TEST-REPORT.md` | Actual results, defects, release recommendation |

PTI-36 acceptance mapping:

- Runnable `npm test` from a clean checkout → verified in `TEST-REPORT.md` §5; host workaround documented (ENV-01).
- Genuine two-socket realtime → RT-01/02/03 use independent `socket.io-client` connections.
- Honest reporting → `TEST-REPORT.md` §8 lists what was not verified and open UI defects.
