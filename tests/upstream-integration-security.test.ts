import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Weather and KOSHA upstream integration security", () => {
  it("bounds every weather response before parsing", async () => {
    vi.stubEnv("DATA_GO_KR_SERVICE_KEY", "test-service-key");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", {
      status: 200,
      headers: { "content-length": String(1_048_577) },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { fetchWeatherSignal } = await import("@/lib/weather");

    const result = await fetchWeatherSignal("서울 실내 작업");

    expect(result.mode).toBe("fallback");
    expect(result.detail).not.toContain("1048576-byte response limit");
    expect(error).toHaveBeenCalledWith(
      "weather provider request failed",
      expect.objectContaining({ error: expect.any(Error) }),
    );
    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls.every(([, init]) => init?.redirect === "manual")).toBe(true);
  });

  it("does not fetch a private configurable erythemal UV endpoint", async () => {
    vi.stubEnv("DATA_GO_KR_SERVICE_KEY", "test-service-key");
    vi.stubEnv("KIER_ERYTHEMAL_UV_ENDPOINT", "https://127.0.0.1/internal");
    vi.stubEnv("SAFECLAW_UPSTREAM_ALLOWED_ORIGINS", "https://127.0.0.1");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { fetchWeatherSignal } = await import("@/lib/weather");

    const result = await fetchWeatherSignal("서울 옥외 폭염 작업");
    const erythemal = result.signals.find((item) => item.endpoint === "실시간 홍반자외선");

    expect(erythemal?.mode).toBe("fallback");
    expect(erythemal?.detail).not.toContain("public addresses");
    expect(error).toHaveBeenCalledWith(
      "weather provider request failed",
      expect.objectContaining({ endpoint: "실시간 홍반자외선", error: expect.any(Error) }),
    );
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("127.0.0.1"))).toBe(false);
  });

  it("keeps raw failures server-side across every weather provider fallback", async () => {
    vi.stubEnv("DATA_GO_KR_SERVICE_KEY", "test-service-key");
    const upstreamDiagnostic = "upstream-secret-diagnostic";
    const fetchMock = vi.fn(async () => {
      throw new Error(upstreamDiagnostic);
    });
    vi.stubGlobal("fetch", fetchMock);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { fetchWeatherSignal } = await import("@/lib/weather");

    const result = await fetchWeatherSignal("서울 옥외 폭염 작업");

    expect(result.mode).toBe("fallback");
    expect(result.signals).toHaveLength(8);
    expect(result.signals.every((signal) => signal.mode === "fallback")).toBe(true);
    expect(result.signals.every((signal) => signal.detail.endsWith("연결 점검이 필요합니다."))).toBe(true);
    expect(JSON.stringify(result)).not.toContain(upstreamDiagnostic);
    const providerFailureLogs = error.mock.calls.filter(([message]) => message === "weather provider request failed");
    expect(providerFailureLogs).toHaveLength(8);
    expect(providerFailureLogs.every(([, context]) => {
      if (!context || typeof context !== "object" || !("error" in context)) return false;
      return context.error instanceof Error && context.error.message === upstreamDiagnostic;
    })).toBe(true);
  });

  it("rejects an oversized KOSHA response and keeps bounded fallback evidence", async () => {
    vi.stubEnv("DATA_GO_KR_SERVICE_KEY", "test-service-key");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", {
      status: 200,
      headers: { "content-length": String(2_097_153) },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchAccidentCases } = await import("@/lib/accident-cases");

    const result = await fetchAccidentCases("서울 비계 추락 작업", {
      retryCount: 0,
      requestTimeoutMs: 500,
    });

    expect(result.mode).toBe("fallback");
    expect(result.detail).toContain("2097152-byte response limit");
    expect(fetchMock.mock.calls.every(([, init]) => init?.redirect === "manual")).toBe(true);
  });

  it("uses HTTPS and bounds every KOSHA OpenAPI response before parsing", async () => {
    vi.stubEnv("DATA_GO_KR_SERVICE_KEY", "test-service-key");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", {
      status: 200,
      headers: { "content-length": String(1_048_577) },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchKoshaOpenApiEvidence } = await import("@/lib/kosha-openapi");

    const result = await fetchKoshaOpenApiEvidence("서울 건설업 비계 추락 작업");

    expect(result.mode).toBe("fallback");
    expect(result.detail).toContain("1048576-byte response limit");
    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls.every(([input]) => new URL(String(input)).protocol === "https:")).toBe(true);
    expect(fetchMock.mock.calls.every(([, init]) => init?.redirect === "manual")).toBe(true);
  });

  it("never sends the relay token to a rejected private proxy", async () => {
    vi.stubEnv("DATA_GO_KR_SERVICE_KEY", "test-service-key");
    vi.stubEnv("KOSHA_ACCIDENT_PROXY_URL", "https://169.254.169.254/latest");
    vi.stubEnv("KOSHA_ACCIDENT_PROXY_TOKEN", "must-not-leave-process");
    vi.stubEnv("SAFECLAW_UPSTREAM_ALLOWED_ORIGINS", "https://169.254.169.254");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchAccidentCases } = await import("@/lib/accident-cases");

    const result = await fetchAccidentCases("서울 비계 추락 작업", {
      retryCount: 0,
      requestTimeoutMs: 500,
    });

    expect(result.detail).toContain("relay 보안 검증 실패");
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("169.254.169.254"))).toBe(false);
    expect(fetchMock.mock.calls.some(([, init]) => {
      const headers = new Headers(init?.headers);
      return headers.get("x-safeguard-secret") === "must-not-leave-process";
    })).toBe(false);
  });
});
