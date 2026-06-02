type Bucket = {
  count: number;
  resetAt: number;
};

type Limit = {
  id: string;
  max: number;
  windowMs: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

export function checkRateLimit(
  identifier: string,
  limits: Limit[],
  now = Date.now()
): RateLimitResult {
  let retryAfterSec = 0;

  for (const limit of limits) {
    const key = `${limit.id}:${identifier}`;
    const existing = buckets.get(key);
    const bucket =
      existing && existing.resetAt > now
        ? existing
        : { count: 0, resetAt: now + limit.windowMs };

    if (bucket.count >= limit.max) {
      retryAfterSec = Math.max(retryAfterSec, Math.ceil((bucket.resetAt - now) / 1000));
      buckets.set(key, bucket);
      continue;
    }

    bucket.count += 1;
    buckets.set(key, bucket);
  }

  if (retryAfterSec > 0) {
    return { ok: false, retryAfterSec };
  }

  return { ok: true };
}

export function clearRateLimits(): void {
  buckets.clear();
}

export const loginRateLimits: Limit[] = [
  { id: "auth/login/60s", max: 5, windowMs: 60_000 },
  { id: "auth/login/5m", max: 11, windowMs: 5 * 60_000 }
];

export const otpRequestRateLimits: Limit[] = [
  { id: "auth/otp/request/60s", max: 6, windowMs: 60_000 },
  { id: "auth/otp/request/5m", max: 10, windowMs: 5 * 60_000 }
];
