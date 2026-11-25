# OPS — local run, Docker and CI

Operational runbook for the PTIT messaging MVP (Node 20 + Express + Socket.IO + SQLite, Vite + React frontend in one repo).

## Ports and URLs

| What | Where |
| --- | --- |
| Vite dev UI (`npm run dev`) | http://localhost:5173 |
| API + Socket.IO (`npm run dev`) | http://localhost:4000 (proxied by Vite) |
| Built app (`npm start`, Docker) | http://localhost:4000 |
| Health endpoint | http://localhost:4000/api/health (`{"ok":true}`) |

## Prerequisites

- Node.js 20+ and npm 10+ (`node -v`, `npm -v`)
- Docker Desktop / Docker Engine with Compose v2 for the container path (`docker compose version`)

## Local development

```bash
npm install
cp .env.example .env     # optional; the defaults in the code work as-is
npm run dev
```

`npm run dev` runs `tsx watch server/index.ts` and Vite together (see `scripts/dev.mjs`). Vite proxies `/api` and `/socket.io` (including WebSocket upgrades) to `http://localhost:4000`.

Use `http://localhost:5173` rather than `http://127.0.0.1:5173`: the Vite dev server binds to `localhost` (which can resolve to the IPv6 loopback `::1`), so the IPv4 literal may not answer.

## Production-ish local run

```bash
npm install
npm run build
npm start          # http://localhost:4000 serves dist/ and the API
```

Notes:

- `npm start` runs the TypeScript server through `tsx`, so `node_modules` (including dev dependencies) must be present. There is no separate `tsc` emit step (`tsconfig.json` has `noEmit: true`).
- `npm start` only serves the UI if `dist/` exists; run `npm run build` first.
- `PORT` and `DB_PATH` are read from the environment or `.env` at startup.

## Environment variables

Copy `.env.example` to `.env` and adjust as needed:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Express + Socket.IO listen port. |
| `DB_PATH` | `./data/ptit.db` | SQLite file; relative paths resolve from the repo root. |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin for the API and Socket.IO (`http://localhost:4000` when the same server also serves the UI). |
| `BACKEND_ORIGIN` | `http://localhost:4000` | Build-time/dev proxy target used only by `vite.config.ts`. |

## Database

- Local file: `./data/ptit.db` plus `ptit.db-wal` and `ptit.db-shm` (WAL mode is enabled).
- The `data/` directory, schema, and seeded rooms `#general`, `#random`, `#dev` are created on first start. The folder is gitignored.
- Docker: named volume `ptit-messaging-data` mounted at `/app/data`, so the database survives `docker compose down` and image rebuilds.

### Reset local data

Stop the server first, then:

```powershell
# Windows PowerShell
Remove-Item -LiteralPath .\data\ptit.db, .\data\ptit.db-wal, .\data\ptit.db-shm -ErrorAction SilentlyContinue
```

```bash
# macOS / Linux
rm -f data/ptit.db data/ptit.db-wal data/ptit.db-shm
```

### Reset container data

```bash
docker compose down -v          # removes the container and the ptit-messaging-data volume
docker compose up --build       # fresh DB is created and seeded
```

`docker volume rm ptit-messaging-data` also works when the stack is stopped.

## Docker

```bash
docker compose up --build       # build + run in the foreground, http://localhost:4000
docker compose up -d --build    # same, detached
docker compose ps               # status (should show "healthy")
docker compose logs -f app      # follow logs
docker compose down             # stop and remove the container, keep the DB volume
docker compose config           # validate the compose file without running it
docker build -t ptit-messaging:local .   # image only
```

The `Dockerfile` is a two-stage build:

1. `build` (`node:20-bookworm-slim`): installs Python + build tools so `better-sqlite3` can fall back to `node-gyp` if no prebuilt binary is available, runs `npm ci` (all dependencies), then `npm run build`.
2. `runtime`: copies `node_modules`, `dist/`, `server/`, `shared/`, `scripts/` and runs as the non-root `node` user with `npm start`. Exposes `4000`, and defines a `HEALTHCHECK` that calls `/api/health` with Node's built-in `fetch` (no `curl` needed).

`.dockerignore` keeps `node_modules`, `dist`, `data`, `.git`, tests and design screenshots out of the build context; `design/tokens.css` is kept because `src/main.tsx` imports it.

## CI

`.github/workflows/ci.yml` runs on every push and pull request:

- job `check` (Node 20, `ubuntu-latest`): `npm ci` → `npm run lint --if-present` → `npm run typecheck` → `npm run build` → `npm test`. Node is cached via `actions/setup-node`.
- job `docker`: `docker compose config --quiet` and `docker build -t ptit-messaging:ci .`.

No linter is configured in this repo yet, so the lint step is a no-op today. Once a `lint` script exists in `package.json` it runs automatically and fails the job on lint errors. Tests fail the job because `npm test` exits non-zero (`tsx --test tests/smoke.test.mjs`).

Reproduce CI locally:

```bash
npm ci
npm run lint --if-present
npm run typecheck
npm run build
npm test
```

## Troubleshooting

### Port already in use

Symptoms: `EADDRINUSE` from the API, or Vite falls back to `5174`.

```powershell
Get-NetTCPConnection -LocalPort 4000,5173 -State Listen | Select-Object LocalPort,OwningProcess
Stop-Process -Id <pid>
```

```bash
lsof -i :4000 -i :5173        # macOS / Linux
```

Alternatively set `PORT=4100` in `.env` **and** update `CLIENT_ORIGIN` / `BACKEND_ORIGIN` accordingly. For Docker the host port is fixed in `docker-compose.yml` (`"4000:4000"`); change the left-hand side if 4000 is taken.

### better-sqlite3 native module errors

Symptoms: `ERR_DLOPEN_FAILED`, `NODE_MODULE_VERSION` mismatch, or `Could not locate the bindings file`, usually after switching Node majors or copying `node_modules` between machines.

```bash
npm rebuild better-sqlite3
# if there is no prebuilt binary for your platform:
npm rebuild better-sqlite3 --build-from-source   # needs Python 3, make, a C++ toolchain
```

Cleanest fallback:

```bash
rm -rf node_modules
npm ci
```

On Windows, `npm rebuild better-sqlite3 --build-from-source` requires Visual Studio Build Tools with the "Desktop development with C++" workload. Inside Docker the image already installs `python3 make g++`.

### Windows: `tsc: command not found` inside `npm run ...`

Observed on a Windows host whose npm `script-shell` is Git Bash:

```powershell
npm config get script-shell   # e.g. C:\Program Files\Git\bin\bash.exe
```

npm does not prepend the Windows `node_modules\.bin` path in a form Git Bash understands, so scripts cannot find local binaries. Fix by using cmd as the script shell:

```powershell
npm config set script-shell "C:\Windows\System32\cmd.exe"
```

or per command: `npm --script-shell cmd run typecheck`. This is a host npm configuration issue, not a repo issue; CI (Ubuntu) is unaffected.

### Container unhealthy / healthcheck failing

```bash
docker inspect --format "{{json .State.Health}}" ptit-messaging
docker compose logs app
```

Common causes: port/paths overridden incorrectly, or the DB volume mounted without write permission. Keep `DB_PATH=/app/data/ptit.db` so it stays on the writable named volume.

### `npm ci` fails in CI with lockfile errors

`package-lock.json` and `package.json` are out of sync. Run `npm install` locally and commit the updated lockfile; CI uses `npm ci` and refuses to modify it.

### Data written by Docker is not visible in `./data`

Docker uses the named volume `ptit-messaging-data`, not the repo's `./data` folder. Inspect it with:

```bash
docker volume inspect ptit-messaging-data
docker run --rm -it -v ptit-messaging-data:/data alpine sh -c "ls -l /data"
```

## Verification log (2026-11-25)

Executed from a clean workspace state on Windows 11, Node v22.19.0, npm 10.9.3, Docker 28.5.2 / Compose v2.40.3:

| Check | Result |
| --- | --- |
| `npm install` | Pass (0 vulnerabilities) |
| `npm run typecheck` | Pass |
| `npm test` (4 smoke tests) | Pass |
| `npm run build` | Pass (`dist/index.html`, JS + CSS assets emitted) |
| `npm run build && npm start` with `PORT=4100` | Pass; `/api/health` → `{"ok":true}`, `/` → 200 with `#root`, seeded rooms present |
| `npm run dev` | Pass; Vite on :5173 and API on :4000, `/api/health` through the Vite proxy |
| `docker compose config` | Pass |
| `docker build .` | Pass |
| `docker compose up -d --build` | Pass; container reports `healthy` |
| Container API/UI | Pass; `/api/health` ok, `/` 200, SQLite files owned by `node` in `/app/data` |
| Persistence | Pass; user created before `docker compose restart` still present afterwards |

Node 22 (local host) is used for local checks; CI and the Docker image pin Node 20 per the acceptance criteria. No lint script exists yet, so no lint was executed.
