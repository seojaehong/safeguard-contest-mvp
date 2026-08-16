import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PUBLIC_SAFETY_REFERENCE_STATUS_ADMISSION_POLICY,
  withPublicSafetyReferenceStatusAdmission,
} from "@/lib/public-distributed-rate-limit";

function request(ip: string) {
  return new NextRequest("http://localhost/api/safety-reference/status", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("safety-reference status aggregate admission", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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

    const first = withPublicSafetyReferenceStatusAdmission(request("198.51.100.81"), firstWork);
    const second = withPublicSafetyReferenceStatusAdmission(request("198.51.100.82"), secondWork);
    await vi.waitFor(() => {
      expect(firstWork).toHaveBeenCalledOnce();
      expect(secondWork).toHaveBeenCalledOnce();
    });

    const busy = await withPublicSafetyReferenceStatusAdmission(
      request("198.51.100.83"),
      async () => new Response("third"),
    );
    expect(busy.status).toBe(503);
    await expect(busy.json()).resolves.toMatchObject({ code: "SAFETY_REFERENCE_STATUS_CONCURRENCY_LIMIT" });

    releaseFirst();
    await expect(first).resolves.toMatchObject({ status: 200 });
    releaseSecond();
    await expect(second).resolves.toMatchObject({ status: 200 });
  });

  it("fails closed in production when distributed admission is absent", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const work = vi.fn(async () => new Response("should-not-run"));

    const response = await withPublicSafetyReferenceStatusAdmission(request("198.51.100.84"), work);

    expect(response.status).toBe(503);
    expect(response.headers.get("X-SafeClaw-Work-Unit")).toBe(
      PUBLIC_SAFETY_REFERENCE_STATUS_ADMISSION_POLICY.workUnit,
    );
    await expect(response.json()).resolves.toMatchObject({ code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE" });
    expect(work).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
