export type StopTask = () => Promise<void>;

type TickerOptions = {
  name: string;
  intervalMs: number;
  runOnStart?: boolean;
  run: () => Promise<void>;
};

export function startTicker({
  name,
  intervalMs,
  runOnStart = true,
  run
}: TickerOptions): StopTask {
  let stopped = false;
  let inFlight: Promise<void> | null = null;

  const tick = () => {
    if (stopped) return;
    if (inFlight) {
      console.log(`[worker] ${name}: previous tick still running; skipping`);
      return;
    }

    inFlight = run()
      .catch((error) => {
        console.error(`[worker] ${name}: tick failed`, error);
      })
      .finally(() => {
        inFlight = null;
      });
  };

  const timer = setInterval(tick, intervalMs);
  if (runOnStart) {
    setTimeout(tick, 0);
  }

  return async () => {
    stopped = true;
    clearInterval(timer);
    if (inFlight) {
      console.log(`[worker] ${name}: waiting for in-flight tick`);
      await inFlight;
    }
    console.log(`[worker] ${name}: stopped`);
  };
}
