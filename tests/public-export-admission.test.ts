import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createConcurrencyGuard } from "@/lib/rate-limit";
import {
  getPublicDistributedAdmissionReadiness,
  withPublicDocumentExportAdmission,
} from "@/lib/public-distributed-rate-limit";

function postRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "198.51.100.44",
    },
    body: "not-json",
  });
}

describe("public export aggregate admission", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reports production export readiness without exposing distributed credentials", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(getPublicDistributedAdmissionReadiness({
      environment: { VERCEL_ENV: "production" },
      requireDistributedInProduction: true,
    })).toEqual({
      mode: "unavailable",
      ready: false,
      reason: "distributed_limiter_unavailable",
    });
    expect(getPublicDistributedAdmissionReadiness({
      environment: {
        UPSTASH_REDIS_REST_TOKEN: "secret-token",
        UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
        VERCEL_ENV: "production",
      },
      requireDistributedInProduction: true,
    })).toEqual({
      mode: "distributed",
      ready: true,
      reason: "distributed_configured",
    });

    const { GET: pdfReadiness } = await import("@/app/api/export/pdf/route");
    const response = await pdfReadiness();
    const payload = await response.json() as {
      admission: Record<string, unknown>;
      message: string;
    };
    expect(response.status).toBe(200);
    expect(payload.admission).toEqual({
      mode: "unavailable",
      ready: false,
      reason: "distributed_limiter_unavailable",
    });
    expect(JSON.stringify(payload)).not.toContain("secret-token");
    expect(payload.message).toContain("temporarily locked");
  });

  it("keeps non-production export readiness on the bounded instance path", () => {
    expect(getPublicDistributedAdmissionReadiness({
      environment: {},
      requireDistributedInProduction: true,
    })).toEqual({
      mode: "instance",
      ready: true,
      reason: "instance_fallback",
    });
    expect(getPublicDistributedAdmissionReadiness({
      environment: { UPSTASH_REDIS_REST_URL: "https://example.upstash.io" },
      requireDistributedInProduction: true,
    })).toEqual({
      mode: "unavailable",
      ready: false,
      reason: "distributed_limiter_misconfigured",
    });
  });

  it("fails every expensive export route closed before parsing when distributed configuration is partial", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const [{ POST: hwp }, { POST: xlsx }, { POST: pdf }, { GET: hwpxTemplate }] = await Promise.all([
      import("@/app/api/export/hwp/route"),
      import("@/app/api/export/xlsx/route"),
      import("@/app/api/export/pdf/route"),
      import("@/app/api/export/hwpx-template/route"),
    ]);

    const responses = await Promise.all([
      hwp(postRequest("/api/export/hwp")),
      xlsx(postRequest("/api/export/xlsx")),
      pdf(postRequest("/api/export/pdf")),
      hwpxTemplate(new NextRequest("http://localhost/api/export/hwpx-template?kind=risk-assessment", {
        headers: { "x-forwarded-for": "198.51.100.44" },
      })),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(503);
      expect(response.headers.get("X-SafeClaw-Rate-Limit")).toBe("distributed");
      expect(response.headers.get("X-SafeClaw-Work-Unit")).toBe("document-export");
      await expect(response.json()).resolves.toMatchObject({
        code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      });
    }
    expect(error).toHaveBeenCalledTimes(4);
    error.mockRestore();
  });

  it("uses one distributed namespace for all export formats", async () => {
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
    const [{ POST: hwp }, { POST: xlsx }, { POST: pdf }, { GET: hwpxTemplate }] = await Promise.all([
      import("@/app/api/export/hwp/route"),
      import("@/app/api/export/xlsx/route"),
      import("@/app/api/export/pdf/route"),
      import("@/app/api/export/hwpx-template/route"),
    ]);

    const responses = [
      await hwp(postRequest("/api/export/hwp")),
      await xlsx(postRequest("/api/export/xlsx")),
      await pdf(postRequest("/api/export/pdf?format=html")),
      await hwpxTemplate(new NextRequest("http://localhost/api/export/hwpx-template", {
        headers: { "x-forwarded-for": "198.51.100.44" },
      })),
    ];

    expect(rateKeys).toHaveLength(4);
    expect(rateKeys.every((key) => /^safeclaw:public-rate:document-export:[a-f0-9]{32}$/u.test(key))).toBe(true);
    expect(concurrencyKeys).toHaveLength(8);
    expect(concurrencyKeys.every((key) => key === "safeclaw:public-concurrency:document-export")).toBe(true);
    for (const response of responses) {
      expect(response.headers.get("X-SafeClaw-Rate-Limit")).toBe("distributed");
      expect(response.headers.get("X-SafeClaw-Work-Unit")).toBe("document-export");
    }
  });

  it("enforces one distributed concurrency lease across export requests", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    const owners = new Set<string>();
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body)) as unknown[];
      const script = String(command[1]);
      if (script.includes("INCR")) return Response.json({ result: [1, 59_000] });
      if (script.includes("ZADD")) {
        if (owners.size >= 2) return Response.json({ result: [0, owners.size] });
        owners.add(String(command[7]));
        return Response.json({ result: [1, owners.size] });
      }
      owners.delete(String(command[4]));
      return Response.json({ result: 1 });
    }));

    let releaseFirst: () => void = () => undefined;
    let releaseSecond: () => void = () => undefined;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const secondGate = new Promise<void>((resolve) => { releaseSecond = resolve; });
    const request = (ip: string) => new NextRequest("http://localhost/api/export/pdf", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
    });
    const first = withPublicDocumentExportAdmission(request("198.51.100.61"), async () => {
      await firstGate;
      return new Response("first");
    });
    const second = withPublicDocumentExportAdmission(request("198.51.100.62"), async () => {
      await secondGate;
      return new Response("second");
    });
    await vi.waitFor(() => expect(owners.size).toBe(2));

    const busy = await withPublicDocumentExportAdmission(
      request("198.51.100.63"),
      async () => new Response("third"),
    );
    expect(busy.status).toBe(503);
    await expect(busy.json()).resolves.toMatchObject({ code: "PUBLIC_EXPORT_CONCURRENCY_LIMIT" });

    releaseFirst();
    releaseSecond();
    await Promise.all([first, second]);
    expect(owners.size).toBe(0);
  });

  it("fails closed without starting export work when the distributed limiter is unavailable", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const work = vi.fn(async () => new Response("should not run"));

    const response = await withPublicDocumentExportAdmission(
      new NextRequest("http://localhost/api/export/pdf", {
        method: "POST",
        headers: { "x-forwarded-for": "198.51.100.45" },
      }),
      work,
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("X-SafeClaw-Work-Unit")).toBe("document-export");
    await expect(response.json()).resolves.toMatchObject({
      code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
    });
    expect(work).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it("does not fall back to process-local concurrency in production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const work = vi.fn(async () => new Response("should not run"));

    const response = await withPublicDocumentExportAdmission(
      new NextRequest("http://localhost/api/export/pdf", {
        method: "POST",
        headers: { "x-forwarded-for": "198.51.100.46" },
      }),
      work,
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "PUBLIC_EXPORT_CONCURRENCY_LIMIT" });
    expect(work).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
  });

  it("applies the shared in-process concurrency lease around export work", async () => {
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
    const request = (ip: string) => new NextRequest("http://localhost/api/export/pdf", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
    });

    const first = withPublicDocumentExportAdmission(request("198.51.100.51"), firstWork);
    const second = withPublicDocumentExportAdmission(request("198.51.100.52"), secondWork);
    await vi.waitFor(() => {
      expect(firstWork).toHaveBeenCalledOnce();
      expect(secondWork).toHaveBeenCalledOnce();
    });

    const busy = await withPublicDocumentExportAdmission(
      request("198.51.100.53"),
      async () => new Response("third"),
    );
    expect(busy.status).toBe(503);
    await expect(busy.json()).resolves.toMatchObject({
      code: "PUBLIC_EXPORT_CONCURRENCY_LIMIT",
    });

    releaseFirst();
    await expect(first).resolves.toMatchObject({ status: 200 });
    const afterRelease = await withPublicDocumentExportAdmission(
      request("198.51.100.54"),
      async () => new Response("after-release"),
    );
    expect(afterRelease.status).toBe(200);
    releaseSecond();
    await expect(second).resolves.toMatchObject({ status: 200 });
  });

  it("bounds in-process concurrency and releases capacity exactly once", () => {
    const guard = createConcurrencyGuard(2);
    const first = guard.tryAcquire();
    const second = guard.tryAcquire();

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(guard.active()).toBe(2);
    expect(guard.tryAcquire()).toBeNull();

    first?.();
    first?.();
    expect(guard.active()).toBe(1);
    const third = guard.tryAcquire();
    expect(third).not.toBeNull();
    expect(guard.active()).toBe(2);
    second?.();
    third?.();
    expect(guard.active()).toBe(0);
  });
});
