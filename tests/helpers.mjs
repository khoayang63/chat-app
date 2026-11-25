import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { io } from "socket.io-client";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function unique(prefix) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix}-${suffix}`.slice(0, 30);
}

export function tempDbPath(label = "test") {
  return path.join(
    os.tmpdir(),
    `ptit-${label}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
  );
}

export function removeDbFiles(dbPath) {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.rmSync(`${dbPath}${suffix}`, { force: true });
    } catch {
      // Windows may hold the handle for a moment after process exit.
    }
  }
}

export function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForHealth({ base, child, logs, timeoutMs = 30000 }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (child.exitCode !== null) {
      throw new Error(`server exited before becoming healthy (code ${child.exitCode}):\n${logs()}`);
    }
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return;
    } catch {
      // Not listening yet.
    }
    if (Date.now() > deadline) {
      throw new Error(`server did not become healthy within ${timeoutMs}ms:\n${logs()}`);
    }
    await delay(150);
  }
}

export async function startServer({ dbPath, port, label = "test" } = {}) {
  const resolvedPort = port ?? (await getFreePort());
  const resolvedDb = dbPath ?? tempDbPath(label);
  const base = `http://127.0.0.1:${resolvedPort}`;

  const child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(resolvedPort),
      DB_PATH: resolvedDb,
      CLIENT_ORIGIN: base,
      NODE_ENV: "test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  const handle = {
    base,
    port: resolvedPort,
    dbPath: resolvedDb,
    child,
    logs: () => output,
    async stop() {
      await stopChild(child);
    },
  };

  await waitForHealth({ base, child, logs: handle.logs });
  return handle;
}

export function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // Already gone.
      }
      resolve();
    }, 5000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    try {
      child.kill();
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
}

export async function requestJson(base, pathname, init) {
  const res = await fetch(`${base}${pathname}`, init);
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body, headers: res.headers };
}

export function postJson(base, pathname, payload) {
  return requestJson(base, pathname, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function createUser(base, name) {
  const res = await requestJson(base, `/api/me?name=${encodeURIComponent(name)}`);
  if (res.status !== 200) {
    throw new Error(`createUser(${name}) failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export function dmKeyFor(userA, userB) {
  return `dm:${[userA, userB].sort().join(":")}`;
}

export function connectSocket(base) {
  const socket = io(base, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    timeout: 10000,
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error("socket connect timed out"));
    }, 10000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      socket.disconnect();
      reject(error);
    });
  });
}

export async function closeSocket(socket) {
  if (!socket) return;
  socket.disconnect();
  await delay(10);
}

export function emitAck(socket, event, payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} ack timed out`)), timeoutMs);
    socket.emit(event, payload, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

export async function joinChannel(socket, target) {
  const result = await emitAck(socket, "join_room", target);
  if (!result?.ok) {
    throw new Error(`join_room failed: ${JSON.stringify(result)}`);
  }
  return result;
}

export function nextNewMessage(socket, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("new_message", onMessage);
      reject(new Error("timed out waiting for new_message"));
    }, timeoutMs);
    function onMessage(message) {
      clearTimeout(timer);
      socket.off("new_message", onMessage);
      resolve(message);
    }
    socket.on("new_message", onMessage);
  });
}

export function expectNoNewMessage(socket, windowMs = 400) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("new_message", onMessage);
      resolve();
    }, windowMs);
    function onMessage(message) {
      clearTimeout(timer);
      socket.off("new_message", onMessage);
      reject(new Error(`received unexpected new_message: ${JSON.stringify(message)}`));
    }
    socket.on("new_message", onMessage);
  });
}
