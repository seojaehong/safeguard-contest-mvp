import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PUBLIC_PHOTO_ANALYSIS_ADMISSION_POLICY,
  withPublicPhotoAnalysisAdmission
} from "@/lib/public-distributed-rate-limit";

function request(ip: string) {
  return new NextRequest("http://localhost/api/input-photos/hazard-analysis", {
    method: "POST",
    headers: { "x-forwarded-for": ip }
  });
}

describe("photo analysis aggregate admission", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the shared distributed photo-analysis namespace", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    const rateKeys: string[] = [];
    const concurrencyKeys: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body)) as unknown[];
      const script = String(command[1]);
      if (script.includes("INCR")) {
        rateKeys.push(String(command[3]));
        return Response.json({ result: [1, 59_000] });
      }
      concurrencyKeys.push(String(command[3]));
      return Response.json({ result: script.includes("ZADD") ? [1, 1] : 1 });
    }));

    const responses = await Promise.all([
      withPublicPhotoAnalysisAdmission(request("198.51.100.71"), async () => new Response("dedicated")),
      withPublicPhotoAnalysisAdmission(request("198.51.100.72"), async () => new Response("improvement"))
    ]);

    expect(rateKeys).toHaveLength(2);
    expect(rateKeys.every((key) => /^safeclaw:public-rate:photo-analysis:[a-f0-9]{32}$/u.test(key))).toBe(true);
    expect(concurrencyKeys).toHaveLength(4);
    expect(concurrencyKeys.every((key) => key === "safeclaw:public-concurrency:photo-analysis")).toBe(true);
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.headers.get("X-SafeClaw-Rate-Limit")).toBe("distributed");
      expect(response.headers.get("X-SafeClaw-Work-Unit")).toBe(PUBLIC_PHOTO_ANALYSIS_ADMISSION_POLICY.workUnit);
    }
  });

  it("bounds shared instance concurrency and releases capacity", async () => {
    let releaseFirst: () => void = () => undefined;
    let releaseSecond: () => void = () => undefined;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const secondGate = new Promise<void>((resolve) => { releaseSecond = resolve; });
    const firstWork = vi.fn(async () => {
      await firstGate;
      return new Response("first");
    });
    const secondWork = vi.fn(async () => {
      await secondGate;
      return new Response("second");
    });

    const first = withPublicPhotoAnalysisAdmission(request("198.51.100.73"), firstWork);
    const second = withPublicPhotoAnalysisAdmission(request("198.51.100.74"), secondWork);
    await vi.waitFor(() => {
      expect(firstWork).toHaveBeenCalledOnce();
      expect(secondWork).toHaveBeenCalledOnce();
    });

    const busy = await withPublicPhotoAnalysisAdmission(
      request("198.51.100.75"),
      async () => new Response("third")
    );
    expect(busy.status).toBe(503);
    await expect(busy.json()).resolves.toMatchObject({ code: "PHOTO_ANALYSIS_CONCURRENCY_LIMIT" });

    releaseFirst();
    await expect(first).resolves.toMatchObject({ status: 200 });
    const afterRelease = await withPublicPhotoAnalysisAdmission(
      request("198.51.100.76"),
      async () => new Response("after-release")
    );
    expect(afterRelease.status).toBe(200);
    releaseSecond();
    await expect(second).resolves.toMatchObject({ status: 200 });
  });

  it("fails closed before work when distributed configuration is partial", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const work = vi.fn(async () => new Response("should-not-run"));

    const response = await withPublicPhotoAnalysisAdmission(request("198.51.100.77"), work);

    expect(response.status).toBe(503);
    expect(response.headers.get("X-SafeClaw-Work-Unit")).toBe("photo-analysis");
    await expect(response.json()).resolves.toMatchObject({ code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE" });
    expect(work).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it("fails closed in production when distributed admission is absent", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const work = vi.fn(async () => new Response("should-not-run"));

    const response = await withPublicPhotoAnalysisAdmission(request("198.51.100.78"), work);

    expect(response.status).toBe(503);
    expect(response.headers.get("X-SafeClaw-Rate-Limit")).toBe("distributed");
    expect(response.headers.get("X-SafeClaw-Work-Unit")).toBe("photo-analysis");
    await expect(response.json()).resolves.toMatchObject({
      code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
    });
    expect(work).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});
