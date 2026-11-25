import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const children = [];
let shuttingDown = false;

function start(args) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (signal) {
      console.error(`[dev] process ${child.pid} stopped (${signal}).`);
    } else if (code !== 0) {
      console.error(`[dev] process ${child.pid} exited with code ${code}.`);
    }
    shutdown(code ?? 1);
  });
  return child;
}

function stopChild(child) {
  if (child.killed || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  child.kill("SIGTERM");
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) stopChild(child);
  setTimeout(() => process.exit(code), 300);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start(["--watch", "--import", "tsx", "server/index.ts"]);
start([path.join(root, "node_modules", "vite", "bin", "vite.js")]);
