import { afterEach, describe, expect, it, vi } from "vitest";

import type { SearchResult } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  searchLawGo: vi.fn(),
  searchLawGoPrecedents: vi.fn(),
  searchKoreanLawMcp: vi.fn(),
}));

vi.mock("@/lib/lawgo", () => ({
  getDetail: vi.fn(),
  searchAll: mocks.searchLawGo,
  searchLawGoPrecedents: mocks.searchLawGoPrecedents,
}));

vi.mock("@/lib/korean-law-mcp", () => ({
  getKoreanLawMcpDetail: vi.fn(),
  getKoreanLawMcpStatus: vi.fn(() => ({ enabled: false, configured: false, keySource: "none" })),
  isKoreanLawMcpId: vi.fn(() => false),
  searchKoreanLawMcp: mocks.searchKoreanLawMcp,
}));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("provider request lifetimes", () => {
  it("aborts a timed-out legal provider request before retrying", async () => {
    vi.useFakeTimers();
    let firstAttemptAborted = false;
    const result: SearchResult = {
      id: "lawgo-law-1",
      type: "law",
      title: "산업안전보건법",
      summary: "법령 검색 결과",
      sourceLabel: "Law.go",
      sourceSystem: "lawgo",
    };

    mocks.searchLawGo
      .mockImplementationOnce((_query: string, signal?: AbortSignal) => new Promise<SearchResult[]>((_, reject) => {
        signal?.addEventListener("abort", () => {
          firstAttemptAborted = true;
          reject(signal.reason);
        }, { once: true });
      }))
      .mockImplementationOnce(async () => {
        expect(firstAttemptAborted).toBe(true);
        return [result];
      });
    mocks.searchKoreanLawMcp.mockResolvedValue([]);
    mocks.searchLawGoPrecedents.mockResolvedValue([]);

    const { searchLegalSources } = await import("@/lib/legal-sources");
    const pending = searchLegalSources("산업안전");
    await vi.advanceTimersByTimeAsync(5_400);
    const results = await pending;

    expect(results).toContainEqual(result);
    expect(mocks.searchLawGo).toHaveBeenCalledTimes(2);
    expect(mocks.searchLawGo.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal);
  });

  it("propagates caller cancellation without starting a legal retry", async () => {
    const controller = new AbortController();
    mocks.searchLawGo.mockImplementationOnce((_query: string, signal?: AbortSignal) =>
      new Promise<SearchResult[]>((_, reject) => {
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      })
    );
    mocks.searchKoreanLawMcp.mockResolvedValue([]);
    mocks.searchLawGoPrecedents.mockResolvedValue([]);

    const { searchLegalSources } = await import("@/lib/legal-sources");
    const pending = searchLegalSources("산업안전", controller.signal);
    const reason = new Error("caller disconnected");
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(mocks.searchLawGo).toHaveBeenCalledTimes(1);
  });

  it("aborts a stalled safety-reference RPC and preserves the REST fallback", async () => {
    vi.useFakeTimers();
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
    vi.stubEnv("SAFETY_REFERENCE_VECTOR_SEARCH", "0");
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal) signals.push(init.signal);
      if (fetchMock.mock.calls.length === 1) {
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
        });
      }
      return Promise.resolve(Response.json([]));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { searchSafetyReferences } = await import("@/lib/safety-reference-catalog");
    const pending = searchSafetyReferences({ query: "비계 추락", limit: 3 });
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await pending;

    expect(signals[0]?.aborted).toBe(true);
    expect(signals.slice(1).length).toBeGreaterThan(0);
    expect(signals.slice(1).every((signal) => !signal.aborted)).toBe(true);
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(result).toMatchObject({
      ok: true,
      retrievalMode: "rest-ilike",
      count: 0,
    });
  });

  it("stops safety-reference fallback work when the caller disconnects", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
    vi.stubEnv("SAFETY_REFERENCE_VECTOR_SEARCH", "0");
    const controller = new AbortController();
    const fetchMock = vi.fn((_: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        if (init?.signal?.aborted) {
          reject(init.signal.reason);
          return;
        }
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { searchSafetyReferences } = await import("@/lib/safety-reference-catalog");
    const pending = searchSafetyReferences({
      query: "비계 추락",
      limit: 3,
      signal: controller.signal,
    });
    const reason = new Error("caller disconnected");
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
