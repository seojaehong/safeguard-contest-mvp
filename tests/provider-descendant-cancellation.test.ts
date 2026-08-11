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
    const [weather, work24, education, kosha, openApi] = await Promise.all([
      import("@/lib/weather"),
      import("@/lib/work24"),
      import("@/lib/kosha-education"),
      import("@/lib/kosha"),
      import("@/lib/kosha-openapi"),
    ]);
    const controller = new AbortController();
    const pending = Promise.all([
      weather.fetchWeatherSignal("서울 외벽 고소작업", controller.signal),
      work24.fetchTrainingRecommendations("서울 외국인 안전교육", controller.signal),
      education.fetchKoshaEducationRecommendations("외국인 근로자 안전교육", controller.signal),
      kosha.fetchKoshaReferences("외벽 고소작업", controller.signal),
      openApi.fetchKoshaOpenApiEvidence("건설업 추락 재해", controller.signal),
    ]);
    await vi.waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(5));
    const reason = new Error("caller disconnected");
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(signals.length).toBeGreaterThanOrEqual(5);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
});
