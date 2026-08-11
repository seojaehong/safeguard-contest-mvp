import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { acquirePublicAskWorkLease } from "@/lib/public-ask-admission";

describe("public ask weighted concurrency admission", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("VERCEL_ENV", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("weights distributed leases by actual AI mode", async () => {
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

    const enhancedLeases = await Promise.all(Array.from({ length: 6 }, () => acquirePublicAskWorkLease("enhanced")));
    expect(enhancedLeases.every(Boolean)).toBe(true);
    expect(activeUnits.size).toBe(12);
    await expect(acquirePublicAskWorkLease("full")).resolves.toBeNull();

    await Promise.all(enhancedLeases.map((lease) => lease?.release()));
    const fullLease = await acquirePublicAskWorkLease("full");
    expect(fullLease?.weight).toBe(12);
    expect(activeUnits.size).toBe(12);
    await fullLease?.release();
    expect(activeUnits.size).toBe(0);
  });

  it("keeps template mode outside provider concurrency capacity", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const lease = await acquirePublicAskWorkLease("template");

    expect(lease?.weight).toBe(0);
    await expect(lease?.release()).resolves.toBeUndefined();
  });

  it("preserves weighted instance admission until distributed production configuration is activated", async () => {
    vi.stubEnv("VERCEL_ENV", "production");

    const lease = await acquirePublicAskWorkLease("enhanced");
    expect(lease?.weight).toBe(2);
    await lease?.release();
  });
});
