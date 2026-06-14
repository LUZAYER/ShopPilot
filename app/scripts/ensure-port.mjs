#!/usr/bin/env node
/**
 * Ensure a TCP port is free before starting a dev server.
 *
 *   node scripts/ensure-port.mjs 3000
 *
 * Strategy:
 *   1. Try to bind to the port.
 *   2. If it succeeds, exit 0.
 *   3. If EADDRINUSE, find the PID(s) using the port and kill them.
 *   4. Wait briefly and retry once. If still busy, exit 1.
 *
 * Works on Linux + macOS (uses lsof when available, falls back to
 * /proc/net/tcp + fuser).
 */
import { createServer } from "node:net";
import { execSync } from "node:child_process";
import process from "node:process";

const port = Number(process.argv[2] ?? process.env.PORT ?? 3000);
if (!Number.isFinite(port) || port <= 0 || port > 65535) {
  console.error(`[ensure-port] invalid port: ${process.argv[2]}`);
  process.exit(1);
}

const log = (msg) => console.log(`[ensure-port:${port}] ${msg}`);

function tryBind() {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", (err) => {
      srv.close();
      resolve({ ok: false, code: err.code });
    });
    srv.once("listening", () => {
      srv.close(() => resolve({ ok: true }));
    });
    srv.listen(port, "0.0.0.0");
  });
}

function findPidsOnPort(p) {
  const pids = new Set();
  // Try lsof first (Linux + macOS).
  try {
    const out = execSync(`lsof -ti tcp:${p} -sTCP:LISTEN`, {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
    for (const line of out.split(/\s+/).filter(Boolean)) {
      const n = Number(line);
      if (Number.isFinite(n)) pids.add(n);
    }
    if (pids.size > 0) return pids;
  } catch {
    // lsof missing or returned nothing — fall through.
  }
  // Fallback: fuser (Linux).
  try {
    const out = execSync(`fuser ${p}/tcp 2>/dev/null`, {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
    for (const m of out.matchAll(/\b(\d+)\b/g)) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) pids.add(n);
    }
  } catch {
    // fuser missing — last resort, just return empty.
  }
  return pids;
}

function killPids(pids) {
  // Never kill ourselves or our parent shell.
  const self = process.pid;
  const filtered = [...pids].filter((p) => p !== self && p !== process.ppid);
  if (filtered.length === 0) return false;
  for (const pid of filtered) {
    try {
      log(`killing pid ${pid}`);
      process.kill(pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
  return true;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 1. Try to bind.
  let res = await tryBind();
  if (res.ok) {
    log("port is free");
    process.exit(0);
  }
  if (res.code !== "EADDRINUSE") {
    log(`bind failed: ${res.code}`);
    process.exit(1);
  }

  // 2. Port is busy — find the owner(s).
  log("port is in use, identifying owner");
  const pids = findPidsOnPort(port);
  if (pids.size === 0) {
    log("EADDRINUSE but no PID found (port may be in TIME_WAIT); waiting 2s");
    await sleep(2000);
    res = await tryBind();
    if (res.ok) {
      log("port is now free");
      process.exit(0);
    }
    log("port still busy after wait — exit 1");
    process.exit(1);
  }

  killPids(pids);

  // 3. Wait for the OS to release the socket, then retry.
  await sleep(1000);
  res = await tryBind();
  if (res.ok) {
    log("port released");
    process.exit(0);
  }

  // 4. Last try: force-kill anything still listening.
  const pids2 = findPidsOnPort(port);
  for (const pid of pids2) {
    try {
      log(`force-killing pid ${pid}`);
      process.kill(pid, "SIGKILL");
    } catch {
      /* gone */
    }
  }
  await sleep(800);
  res = await tryBind();
  if (res.ok) {
    log("port released after force-kill");
    process.exit(0);
  }
  log("port still busy after force-kill — exit 1");
  process.exit(1);
}

main().catch((e) => {
  console.error(`[ensure-port:${port}] fatal`, e);
  process.exit(1);
});
