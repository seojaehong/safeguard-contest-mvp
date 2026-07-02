import { describe, expect, test } from "vitest";
import { getClientIp, enforceRateLimit } from "@/lib/api-guard";
import { createRateLimiter } from "@/lib/rate-limit";

function req(headers: Record<string, string>): Request {
  return new Request("https://www.safeclaw.kr/api/ask", { headers });
}

describe("getClientIp", () => {
  test("uses first entry of x-forwarded-for", () => {
    expect(getClientIp(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  test("falls back to x-real-ip", () => {
    expect(getClientIp(req({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
  });

  test("returns 'unknown' when no headers present", () => {
    expect(getClientIp(req({}))).toBe("unknown");
  });
});

describe("enforceRateLimit", () => {
  test("returns null while under the limit", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    expect(enforceRateLimit(req({ "x-real-ip": "1.1.1.1" }), limiter)).toBeNull();
    expect(enforceRateLimit(req({ "x-real-ip": "1.1.1.1" }), limiter)).toBeNull();
  });

  test("returns 429 JSON response with Retry-After when over the limit", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    enforceRateLimit(req({ "x-real-ip": "2.2.2.2" }), limiter);
    const res = enforceRateLimit(req({ "x-real-ip": "2.2.2.2" }), limiter);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(res!.headers.get("Retry-After")).toMatch(/^\d+$/);
    const body = await res!.json();
    expect(typeof body.error).toBe("string");
  });
});
