export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface RateLimiter {
  check(key: string, now?: number): RateLimitResult;
  size(): number;
}

export interface ConcurrencyGuard {
  active(): number;
  tryAcquire(): (() => void) | null;
}

interface WindowEntry {
  windowStart: number;
  count: number;
}

/**
 * Fixed-window in-memory rate limiter.
 * Per-instance only (serverless: per warm lambda) — a soft cost/abuse guard,
 * not a distributed quota.
 */
export function createRateLimiter(options: { limit: number; windowMs: number }): RateLimiter {
  const { limit, windowMs } = options;
  const entries = new Map<string, WindowEntry>();

  function evictExpired(now: number) {
    for (const [key, entry] of entries) {
      if (now - entry.windowStart >= windowMs) entries.delete(key);
    }
  }

  return {
    check(key: string, now: number = Date.now()): RateLimitResult {
      evictExpired(now);
      const entry = entries.get(key);
      if (!entry) {
        entries.set(key, { windowStart: now, count: 1 });
        return { allowed: true };
      }
      if (entry.count < limit) {
        entry.count += 1;
        return { allowed: true };
      }
      const retryAfterSeconds = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      return { allowed: false, retryAfterSeconds };
    },
    size(): number {
      return entries.size;
    },
  };
}

export function createConcurrencyGuard(limit: number): ConcurrencyGuard {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error("Concurrency limit must be a positive safe integer");
  }

  let activeCount = 0;
  return {
    active(): number {
      return activeCount;
    },
    tryAcquire(): (() => void) | null {
      if (activeCount >= limit) return null;
      activeCount += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        activeCount -= 1;
      };
    },
  };
}
