#!/usr/bin/env node

import { spawn } from "node:child_process";

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: forward-signals <command> [...args]");
  process.exit(64);
}

const child = spawn(command, args, {
  detached: process.platform !== "win32",
  env: process.env,
  stdio: "inherit"
});

let childExited = false;
let forwarding = false;

child.on("exit", (code, signal) => {
  childExited = true;
  if (signal) {
    process.exit(128 + (signal === "SIGINT" ? 2 : signal === "SIGTERM" ? 15 : 0));
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(`[forward-signals] failed to start ${command}:`, error);
  process.exit(1);
});

function forward(signal) {
  if (childExited || forwarding) {
    return;
  }
  forwarding = true;

  try {
    if (process.platform === "win32") {
      child.kill(signal);
    } else if (child.pid) {
      process.kill(-child.pid, signal);
    }
  } catch (error) {
    console.error(`[forward-signals] failed to forward ${signal}:`, error);
  }

  setTimeout(() => {
    if (childExited) {
      return;
    }
    try {
      if (process.platform === "win32") {
        child.kill("SIGKILL");
      } else if (child.pid) {
        process.kill(-child.pid, "SIGKILL");
      }
    } catch {
      // The child may already have exited.
    }
  }, 5_000).unref();
}

process.on("SIGINT", () => forward("SIGINT"));
process.on("SIGTERM", () => forward("SIGTERM"));
