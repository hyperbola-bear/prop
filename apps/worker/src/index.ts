import { closeDb } from "./db";
import { startHealthServer } from "./health";
import { startEmailQueueDrain } from "./tasks/email";
import { startExpiryTick } from "./tasks/expiry";
import { type StopTask } from "./ticker";
import { readConfig } from "./config";

const config = readConfig();

const stops: StopTask[] = [
  startExpiryTick({ intervalMs: 60_000 }),
  startEmailQueueDrain({ intervalMs: 5 * 60_000 }),
  startHealthServer({ port: config.healthPort })
];

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    console.log(`[worker] ${signal}: shutdown already in progress`);
    return;
  }

  shuttingDown = true;
  console.log(`[worker] ${signal}: stopping`);

  try {
    await Promise.all(stops.map((stop) => stop()));
    await closeDb();
    console.log("[worker] shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error("[worker] shutdown failed", error);
    process.exit(1);
  }
}

process.on("SIGTERM", (signal) => {
  void shutdown(signal);
});

process.on("SIGINT", (signal) => {
  void shutdown(signal);
});
