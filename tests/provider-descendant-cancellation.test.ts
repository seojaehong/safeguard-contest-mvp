import { afterEach, describe, expect, it, vi } from "vitest";

function stalledFetch(signals: AbortSignal[]) {
  return vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_, reject) => {
      const signal = init?.signal;
      if (!signal) {
        reject(new Error("provider request did not receive an AbortSignal"));
        return;
      }
      signals.push(signal);
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    })
  );
}

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Ask enrichment descendant cancellation", () => {
  it("stops KMA, Work24, and every KOSHA enrichment branch on caller abort", async () => {
    vi.stubEnv("DATA_GO_KR_SERVICE_KEY", "test-service-key");
    vi.stubEnv("PUBLIC_DATA_API_KEY", "");
    vi.stubEnv("WORK24_AUTH_KEY", "test-work24-key");
    const signals: AbortSignal[] = [];
    const fetchMock = stalledFetch(signals);
    vi.stubGlobal("fetch", fetchMock);
    const [weather, work24, education, kosha, openApi, accidentCases] = await Promise.all([
      import("@/lib/weather"),
      import("@/lib/work24"),
      import("@/lib/kosha-education"),
      import("@/lib/kosha"),
      import("@/lib/kosha-openapi"),
      import("@/lib/accident-cases"),
    ]);
    const controller = new AbortController();
    const pending = Promise.all([
      weather.fetchWeatherSignal("서울 외벽 고소작업", controller.signal),
      work24.fetchTrainingRecommendations("서울 외국인 안전교육", controller.signal),
      education.fetchKoshaEducationRecommendations("외국인 근로자 안전교육", controller.signal),
      kosha.fetchKoshaReferences("외벽 고소작업", controller.signal),
      openApi.fetchKoshaOpenApiEvidence("건설업 추락 재해", controller.signal),
      accidentCases.fetchAccidentCases("건설업 지붕 추락 작업", {
        signal: controller.signal,
        retryCount: 0,
        requestTimeoutMs: 5_000,
      }),
    ]);
    await vi.waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(6));
    const reason = new Error("caller disconnected");
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(signals.length).toBeGreaterThanOrEqual(6);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
});

describe("Work24 response budget", () => {
  it("falls back without parsing an oversized upstream response", async () => {
    vi.stubEnv("WORK24_AUTH_KEY", "test-work24-key");
    const work24 = await import("@/lib/work24");
    const fetchMock = vi.fn(async () => new Response(
      "x".repeat(work24.WORK24_RESPONSE_MAX_BYTES + 1),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await work24.fetchTrainingRecommendations("서울 외국인 안전교육");

    expect(result.mode).toBe("fallback");
    expect(result.recommendations).toEqual([]);
    expect(result.detail).toBe("고용24 사업주훈련 연결 점검이 필요합니다.");
    expect(JSON.stringify(result)).not.toContain(`${work24.WORK24_RESPONSE_MAX_BYTES}-byte response limit`);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("work24"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("gives each upstream request an independent timeout while preserving fallback", async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv("WORK24_AUTH_KEY", "test-work24-key");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const signals: AbortSignal[] = [];
      const fetchMock = stalledFetch(signals);
      vi.stubGlobal("fetch", fetchMock);
      const work24 = await import("@/lib/work24");

      const pending = work24.fetchTrainingRecommendations("서울 외국인 안전교육");
      await Promise.resolve();
      expect(fetchMock).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(work24.WORK24_REQUEST_TIMEOUT_MS);
      const result = await pending;

      expect(signals).toHaveLength(2);
      expect(signals.every((signal) => signal.aborted)).toBe(true);
      expect(signals.every((signal) => signal.reason instanceof Error
        && signal.reason.message === `Work24 request timeout after ${work24.WORK24_REQUEST_TIMEOUT_MS}ms`)).toBe(true);
      expect(result.mode).toBe("fallback");
      expect(result.recommendations).toEqual([]);
      expect(result.detail).toBe("고용24 사업주훈련 연결 점검이 필요합니다.");
      expect(JSON.stringify(result)).not.toContain(`Work24 request timeout after ${work24.WORK24_REQUEST_TIMEOUT_MS}ms`);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("work24"));
      warn.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Law.go response budget", () => {
  it("falls back without parsing an oversized detail response", async () => {
    vi.stubEnv("LAWGO_OC", "test-lawgo-client");
    const lawgo = await import("@/lib/lawgo");
    const cancel = vi.fn();
    const fetchMock = vi.fn(async () => new Response(
      new ReadableStream<Uint8Array>({ cancel }),
      {
        status: 200,
        headers: { "Content-Length": String(lawgo.LAWGO_RESPONSE_MAX_BYTES + 1) },
      },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await lawgo.getDetail("lawgo-prec-1");

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      "Failed to fetch Law.go detail response",
      expect.objectContaining({
        message: `Law.go detail response exceeded the ${lawgo.LAWGO_RESPONSE_MAX_BYTES}-byte response limit`,
      }),
    );
    error.mockRestore();
  });
});
