import { describe, expect, it, vi } from "vitest";

import {
  checkPublicRateLimit,
  publicRateLimitResponse,
} from "@/lib/public-distributed-rate-limit";
import { createRateLimiter } from "@/lib/rate-limit";

function request(ip = "203.0.113.41"): Request {
  return new Request("https://www.safeclaw.kr/api/search?q=test", {
    headers: { "x-forwarded-for": ip },
  });
}

function options(overrides: Partial<Parameters<typeof checkPublicRateLimit>[0]> = {}) {
  return {
    request: request(),
    namespace: "legal-search",
    limit: 2,
    windowMs: 60_000,
    instanceLimiter: createRateLimiter({ limit: 2, windowMs: 60_000 }),
    environment: {},
    ...overrides,
  };
}

describe("public distributed rate limit", () => {
  it("keeps an explicit instance fallback when distributed configuration is absent", async () => {
    const input = options();

    expect(await checkPublicRateLimit(input)).toMatchObject({
      allowed: true,
      mode: "instance",
      reason: "instance_fallback",
    });
    expect(await checkPublicRateLimit(input)).toMatchObject({ allowed: true, mode: "instance" });
    expect(await checkPublicRateLimit(input)).toMatchObject({ allowed: false, mode: "instance" });
  });

  it("uses one atomic distributed counter and never sends the raw client IP", async () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body)) as unknown[];
      expect(command[0]).toBe("EVAL");
      expect(command[2]).toBe("1");
      expect(String(command[3])).toMatch(/^safeclaw:public-rate:legal-search:[a-f0-9]{32}$/u);
      expect(String(command[3])).not.toContain("203.0.113.41");
      return Response.json({ result: [1, 59_500] });
    });

    const decision = await checkPublicRateLimit(options({
      environment: {
        UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "test-token",
      },
      fetchImpl,
    }));

    expect(decision).toEqual({ allowed: true, mode: "distributed", reason: "distributed" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-token");
    expect(init?.cache).toBe("no-store");
  });

  it("returns a distributed 429 with the Redis TTL after the shared limit", async () => {
    const decision = await checkPublicRateLimit(options({
      environment: {
        UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "test-token",
      },
      fetchImpl: async () => Response.json({ result: [3, 12_001] }),
    }));
    const response = publicRateLimitResponse(decision);

    expect(decision).toMatchObject({
      allowed: false,
      mode: "distributed",
      reason: "distributed",
      retryAfterSeconds: 13,
    });
    expect(response?.status).toBe(429);
    expect(response?.headers.get("X-SafeClaw-Rate-Limit")).toBe("distributed");
  });

  it("fails closed before provider work when distributed configuration is partial", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchImpl = vi.fn();

    const decision = await checkPublicRateLimit(options({
      environment: { UPSTASH_REDIS_REST_URL: "https://example.upstash.io" },
      fetchImpl,
    }));
    const response = publicRateLimitResponse(decision);

    expect(decision.reason).toBe("distributed_limiter_misconfigured");
    expect(response?.status).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("fails closed when the distributed counter cannot be verified", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const decision = await checkPublicRateLimit(options({
      environment: {
        UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "test-token",
      },
      fetchImpl: async () => new Response("unavailable", { status: 503 }),
    }));
    const response = publicRateLimitResponse(decision);

    expect(decision.reason).toBe("distributed_limiter_unavailable");
    expect(response?.status).toBe(503);
    expect(response?.headers.get("Retry-After")).toBe("5");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
