import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PUBLIC_LEGAL_SEARCH_QUERY_MAX_CHARS,
  PUBLIC_SAFETY_REFERENCE_FILTER_MAX_CHARS,
  PUBLIC_SAFETY_REFERENCE_QUERY_MAX_CHARS,
} from "@/lib/public-work-budget";

const mocks = vi.hoisted(() => ({
  runSearch: vi.fn(),
  searchSafetyReferences: vi.fn(),
}));

vi.mock("@/lib/search", () => ({
  runSearch: mocks.runSearch,
}));

vi.mock("@/lib/safety-reference-catalog-server", () => ({
  searchSafetyReferences: mocks.searchSafetyReferences,
}));

function request(path: string, ip: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: { "x-forwarded-for": ip },
  });
}

describe("public search work budgets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runSearch.mockResolvedValue([]);
    mocks.searchSafetyReferences.mockResolvedValue({
      ok: true,
      configured: true,
      query: "비계",
      items: [],
      count: 0,
      retrievalMode: "rest-ilike",
      vectorSearch: { enabled: false, attempted: false, ok: false },
      message: "조회 완료",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("fails closed before provider work when distributed limiter configuration is partial", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const legal = await import("@/app/api/search/route");
    const safety = await import("@/app/api/safety-reference/search/route");

    const legalResponse = await legal.GET(request("/api/search?q=산업안전", "198.51.100.8"));
    const safetyResponse = await safety.GET(request("/api/safety-reference/search?q=비계", "198.51.100.9"));

    expect(legalResponse.status).toBe(503);
    expect(safetyResponse.status).toBe(503);
    expect(mocks.runSearch).not.toHaveBeenCalled();
    expect(mocks.searchSafetyReferences).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it("reports distributed admission control on successful route responses", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    const distributedFetch = vi.fn(async () => Response.json({ result: [1, 59_000] }));
    vi.stubGlobal("fetch", distributedFetch);
    const legal = await import("@/app/api/search/route");
    const safety = await import("@/app/api/safety-reference/search/route");

    const legalResponse = await legal.GET(request("/api/search?q=산업안전", "198.51.100.6"));
    const safetyResponse = await safety.GET(request("/api/safety-reference/search?q=비계", "198.51.100.7"));

    expect(legalResponse.status).toBe(200);
    expect(safetyResponse.status).toBe(200);
    expect(legalResponse.headers.get("X-SafeClaw-Rate-Limit")).toBe("distributed");
    expect(safetyResponse.headers.get("X-SafeClaw-Rate-Limit")).toBe("distributed");
    expect(distributedFetch).toHaveBeenCalledTimes(2);
    expect(mocks.runSearch).toHaveBeenCalledTimes(1);
    expect(mocks.searchSafetyReferences).toHaveBeenCalledTimes(1);
  });

  it("rejects oversized legal queries before provider fan-out", async () => {
    const { GET } = await import("@/app/api/search/route");
    const query = "법".repeat(PUBLIC_LEGAL_SEARCH_QUERY_MAX_CHARS + 1);
    const response = await GET(request(`/api/search?q=${encodeURIComponent(query)}`, "198.51.100.10"));
    const body = await response.json() as { code: string; limit: number };

    expect(response.status).toBe(413);
    expect(body).toMatchObject({
      code: "PUBLIC_WORK_BUDGET_EXCEEDED",
      limit: PUBLIC_LEGAL_SEARCH_QUERY_MAX_CHARS,
    });
    expect(mocks.runSearch).not.toHaveBeenCalled();
  });

  it("rejects oversized safety queries and filters before catalog work", async () => {
    const { GET } = await import("@/app/api/safety-reference/search/route");
    const oversizedQuery = "위험".repeat(PUBLIC_SAFETY_REFERENCE_QUERY_MAX_CHARS);
    const queryResponse = await GET(request(
      `/api/safety-reference/search?q=${encodeURIComponent(oversizedQuery)}`,
      "198.51.100.11",
    ));
    const oversizedFilter = "source".repeat(PUBLIC_SAFETY_REFERENCE_FILTER_MAX_CHARS);
    const filterResponse = await GET(request(
      `/api/safety-reference/search?q=비계&sourceId=${encodeURIComponent(oversizedFilter)}`,
      "198.51.100.12",
    ));

    expect(queryResponse.status).toBe(413);
    expect(filterResponse.status).toBe(413);
    expect(mocks.searchSafetyReferences).not.toHaveBeenCalled();
  });

  it("coalesces equivalent concurrent legal and safety lookups", async () => {
    const legal = await import("@/app/api/search/route");
    const safety = await import("@/app/api/safety-reference/search/route");
    let resolveLegal: (value: []) => void = () => undefined;
    let resolveSafety: (value: {
      ok: true;
      configured: true;
      query: string;
      items: [];
      count: 0;
      retrievalMode: "rest-ilike";
      vectorSearch: { enabled: false; attempted: false; ok: false };
      message: string;
    }) => void = () => undefined;
    mocks.runSearch.mockImplementationOnce(() => new Promise<[]>((resolve) => {
      resolveLegal = resolve;
    }));
    mocks.searchSafetyReferences.mockImplementationOnce(() => new Promise((resolve) => {
      resolveSafety = resolve;
    }));

    const legalFirst = legal.GET(request("/api/search?q=산업안전", "198.51.100.13"));
    const legalSecond = legal.GET(request("/api/search?q=산업안전", "198.51.100.14"));
    const safetyFirst = safety.GET(request("/api/safety-reference/search?q=비계", "198.51.100.15"));
    const safetySecond = safety.GET(request("/api/safety-reference/search?q=비계", "198.51.100.16"));
    await vi.waitFor(() => {
      expect(mocks.runSearch).toHaveBeenCalledTimes(1);
      expect(mocks.searchSafetyReferences).toHaveBeenCalledTimes(1);
    });
    resolveLegal([]);
    resolveSafety({
      ok: true,
      configured: true,
      query: "비계",
      items: [],
      count: 0,
      retrievalMode: "rest-ilike",
      vectorSearch: { enabled: false, attempted: false, ok: false },
      message: "조회 완료",
    });
    await Promise.all([legalFirst, legalSecond, safetyFirst, safetySecond]);

    expect(mocks.runSearch).toHaveBeenCalledTimes(1);
    expect(mocks.searchSafetyReferences).toHaveBeenCalledTimes(1);
  });

  it("rate limits repeated public searches before provider work", async () => {
    const legal = await import("@/app/api/search/route");
    const safety = await import("@/app/api/safety-reference/search/route");
    const legalIp = "198.51.100.20";
    const safetyIp = "198.51.100.21";

    for (let index = 0; index < 30; index += 1) {
      expect((await legal.GET(request(`/api/search?q=법령-${index}`, legalIp))).status).toBe(200);
      expect((await safety.GET(request(`/api/safety-reference/search?q=안전-${index}`, safetyIp))).status).toBe(200);
    }
    const blockedLegal = await legal.GET(request("/api/search?q=blocked", legalIp));
    const blockedSafety = await safety.GET(request("/api/safety-reference/search?q=blocked", safetyIp));

    expect(blockedLegal.status).toBe(429);
    expect(blockedSafety.status).toBe(429);
    expect(mocks.runSearch).toHaveBeenCalledTimes(30);
    expect(mocks.searchSafetyReferences).toHaveBeenCalledTimes(30);
  });
});
