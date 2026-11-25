# PTIT Messaging (MVP)

Small internal messaging web app for PTIT: realtime rooms and direct messages.

- **Backend:** Node.js 20+, Express, Socket.IO, SQLite via `better-sqlite3`
- **Frontend:** Vite + React + TypeScript
- **Single command local startup:** `npm install && npm run dev`

## Quick start

```bash
npm install
cp .env.example .env        # optional; defaults work out of the box
npm run dev
```

Open http://localhost:5173, enter a display name, and start chatting. The API/socket server listens on http://localhost:4000 and Vite proxies `/api` and `/socket.io` to it.

### Run commands

| Command             | What it does                                                        |
| ------------------- | ------------------------------------------------------------------- |
| `npm run dev`       | Starts API server (`tsx watch`) and Vite dev server together.       |
| `npm run build`     | Builds the frontend into `dist/`.                                   |
| `npm start`         | Runs the API server (also serves `dist/` when it exists).           |
| `npm run typecheck` | Type-checks frontend, server, and shared code with `tsc --noEmit`.   |
| `npm test`          | Full API, realtime and persistence suite (`node:test` via `tsx`).   |

Production-ish local run:

```bash
npm run build
npm start   # http://localhost:4000 serves the built UI and API
```

## Docker

```bash
docker compose up --build   # http://localhost:4000
```

Two-stage `Dockerfile` (UI build + non-root runtime), persistent SQLite in the `ptit-messaging-data` volume, healthcheck against `/api/health`. Reset with `docker compose down -v`.

Full runbook: **[OPS.md](OPS.md)** — ports, environment variables, database reset, troubleshooting (port conflicts, `better-sqlite3` rebuilds), and the CI workflow (`.github/workflows/ci.yml`, Node 20).

## Database

SQLite file location is controlled by `DB_PATH` (default `./data/ptit.db`, resolved from the repo root). The folder and schema are created automatically on first start, and the default rooms `#general`, `#random`, `#dev` are seeded. Delete the `data/` files to reset local state.

## Configuration

Copy `.env.example` to `.env`:

```ini
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
DB_PATH=./data/ptit.db
```

## Features

1. **Identity** – display-name entry stored in `localStorage` (2–32 characters); no passwords or real auth (explicitly out of scope for this MVP).
2. **Rooms** – seeded default channels plus room creation; anyone can join any room.
3. **Direct messages** – start a DM with any user from the users list; DM threads persist in the sidebar.
4. **Realtime messaging** – messages persist to SQLite, then broadcast over Socket.IO to everyone in the room/DM. Opening a conversation loads the latest 50 messages in order.
5. **Validation** – non-empty bodies, max 4000 characters (counter shown from 3600), room-name rules, and friendly error responses/acks.
6. **UI** – responsive layout (two panes, tablet drawer, single-pane mobile), sidebar search (`Ctrl/Cmd+K`), unread and mention badges, Vietnamese copy, light/dark theme persisted in `localStorage`, accessible `role="log"` thread with `<time datetime>`, chat bubbles with timestamps, Enter to send / Shift+Enter for newline, auto-scroll, sends acknowledged by the server, and a connection status pill.

The UI uses the shared design tokens in `design/tokens.css` (light and dark themes) plus app styles in `src/styles.css`.

## API

| Method | Path                                   | Description                                        |
| ------ | -------------------------------------- | -------------------------------------------------- |
| GET    | `/api/me?name=`                        | Upsert and return the user for a display name.     |
| GET    | `/api/users`                           | List known users.                                  |
| GET    | `/api/rooms`                           | List rooms.                                        |
| POST   | `/api/rooms`                           | Create a room: `{ "name": "design" }`.             |
| GET    | `/api/messages?roomId=`                | Last 50 room messages, oldest first.               |
| GET    | `/api/messages?dmKey=`                 | Last 50 DM messages, oldest first.                 |
| GET    | `/api/health`                          | Health check.                                      |

`dmKey` format: `dm:<userIdA>:<userIdB>` with the two user IDs sorted (see `shared/types.ts#dmKeyFor`).

## Socket.IO events

| Event          | Direction       | Payload                                                                 |
| -------------- | --------------- | ----------------------------------------------------------------------- |
| `join_room`    | client → server | `{ roomId }` or `{ dmKey }`; ack `{ ok, channel? , error? }`             |
| `leave_room`   | client → server | none                                                                    |
| `send_message` | client → server | `{ roomId?, dmKey?, senderId, senderName, body }`; ack `{ ok, message?, error? }` |
| `new_message`  | server → client | `{ id, roomId, dmKey, senderId, senderName, body, createdAt }`          |
| `message_activity` | server → client | `{ id, roomId, dmKey, senderId, senderName, createdAt }` (no body; drives unread badges) |
| `presence`     | server → client | `{ channel, online }` (members currently in that room/DM)               |

## Project structure

```
server/          Express + Socket.IO server, SQLite access (db.ts)
src/             React app, components, styles
shared/types.ts  Shared payload/types and DM key helpers
tests/           Automated API, realtime and persistence tests
data/            SQLite database files (gitignored)
```

## Out of scope

- Real authentication / accounts / permissions
- File uploads, reactions, editing/deleting messages
- Push notifications and offline delivery (reopening a conversation reloads its history)

