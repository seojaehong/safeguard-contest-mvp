import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  acquirePublicSearchWorkLease,
  checkPublicSearchProviderAdmission,
  PublicSearchAdmissionError,
} from "@/lib/public-search-admission";

describe("public search weighted provider admission", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("VERCEL_ENV", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shares weighted distributed capacity across legal, safety, and weather work", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    const activeUnits = new Set<string>();
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body)) as unknown[];
      const script = String(command[1]);
      if (script.includes("ZADD")) {
        const capacity = Number(command[5]);
        const owner = String(command[7]);
        const weight = Number(command[9]);
        if (activeUnits.size + weight > capacity) {
          return Response.json({ result: [0, activeUnits.size] });
        }
        for (let index = 1; index <= weight; index += 1) activeUnits.add(`${owner}:${index}`);
        return Response.json({ result: [1, activeUnits.size] });
      }
      const owner = String(command[4]);
      const weight = Number(command[5]);
      for (let index = 1; index <= weight; index += 1) activeUnits.delete(`${owner}:${index}`);
      return Response.json({ result: weight });
    }));

    const legal = await acquirePublicSearchWorkLease("legal");
    const safetyFirst = await acquirePublicSearchWorkLease("safety-reference");
    const safetySecond = await acquirePublicSearchWorkLease("safety-reference");
    expect(activeUnits.size).toBe(12);
    await expect(acquirePublicSearchWorkLease("weather")).rejects.toMatchObject({
      code: "PUBLIC_SEARCH_CONCURRENCY_LIMIT",
    });

    await Promise.all([legal.release(), safetyFirst.release(), safetySecond.release()]);
    expect(activeUnits.size).toBe(0);
  });

  it("requires distributed rate and concurrency admission in production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const request = new Request("https://www.safeclaw.kr/api/search?q=산업안전", {
      headers: { "x-forwarded-for": "203.0.113.90" },
    });

    await expect(checkPublicSearchProviderAdmission(request, "legal")).resolves.toMatchObject({
      allowed: false,
      mode: "distributed",
      reason: "distributed_limiter_unavailable",
    });
    await expect(acquirePublicSearchWorkLease("legal")).rejects.toBeInstanceOf(
      PublicSearchAdmissionError,
    );
    error.mockRestore();
  });
});
