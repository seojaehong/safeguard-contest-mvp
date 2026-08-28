import { afterEach, describe, expect, test, vi } from "vitest";
import { getClientIp, enforceRateLimit } from "@/lib/api-guard";
import { createRateLimiter } from "@/lib/rate-limit";

function req(headers: Record<string, string>): Request {
  return new Request("https://www.safeclaw.kr/api/ask", { headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

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

  test("prefers the Vercel-authenticated client IP over a spoofed forwarded chain", () => {
    expect(getClientIp(req({
      "x-vercel-forwarded-for": "203.0.113.21",
      "x-forwarded-for": "198.51.100.77, 10.0.0.1",
    }))).toBe("203.0.113.21");
  });

  test("fails closed in production when Vercel client identity is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    expect(getClientIp(req({ "x-forwarded-for": "198.51.100.77" }))).toBe("unknown");
  });

  test("uses a configured trusted proxy chain outside Vercel", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("SAFECLAW_TRUST_PROXY_HEADERS", "true");
    expect(getClientIp(req({ "x-forwarded-for": "8.8.8.8, 10.0.0.1" }))).toBe("8.8.8.8");
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
