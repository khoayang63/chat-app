# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage: install dependencies (including tsx, which `npm start` uses)
# and build the Vite frontend.
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 ships prebuilt binaries for Node 20 on linux/amd64, but keep a
# C/C++ toolchain around so npm can fall back to node-gyp when needed.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Runtime stage: production-ish local image, app served by Express on :4000.
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=4000 \
    DB_PATH=/app/data/ptit.db \
    CLIENT_ORIGIN=http://localhost:4000

WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/tsconfig.json ./

# The named volume inherits this directory's ownership on first use, so the
# non-root `node` user can create the SQLite file and its WAL sidecars.
RUN mkdir -p /app/data && chown -R node:node /app/data

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "start"]
