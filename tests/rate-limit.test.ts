import { describe, expect, test } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  test("allows requests under the limit", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    expect(limiter.check("1.2.3.4", 0).allowed).toBe(true);
    expect(limiter.check("1.2.3.4", 1_000).allowed).toBe(true);
    expect(limiter.check("1.2.3.4", 2_000).allowed).toBe(true);
  });

  test("blocks the request over the limit and reports retryAfterSeconds", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    limiter.check("1.2.3.4", 0);
    limiter.check("1.2.3.4", 1_000);
    const blocked = limiter.check("1.2.3.4", 2_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(58);
  });

  test("resets after the window passes", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.check("1.2.3.4", 0);
    expect(limiter.check("1.2.3.4", 30_000).allowed).toBe(false);
    expect(limiter.check("1.2.3.4", 60_001).allowed).toBe(true);
  });

  test("tracks keys independently", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("b", 0).allowed).toBe(true);
    expect(limiter.check("a", 1_000).allowed).toBe(false);
  });

  test("evicts expired entries to bound memory", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });
    limiter.check("a", 0);
    limiter.check("b", 0);
    limiter.check("c", 5_000);
    expect(limiter.size()).toBe(1);
  });
});
