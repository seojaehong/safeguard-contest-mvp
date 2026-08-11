import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_WEATHER_QUESTION_MAX_CHARS } from "@/lib/public-work-budget";

type WeatherRouteSignal = {
  source: "kma";
  mode: "live" | "fallback";
  locationLabel: string;
  summary: string;
  actions: string[];
  detail: string;
  signals: unknown[];
};

const mocks = vi.hoisted(() => ({
  fetchWeatherSignal: vi.fn()
}));

vi.mock("@/lib/weather", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/weather")>();
  return {
    ...actual,
    fetchWeatherSignal: mocks.fetchWeatherSignal
  };
});

function weatherRequest(question: string, ipSuffix: number, signal?: AbortSignal): NextRequest {
  const url = new URL("http://localhost/api/weather");
  url.searchParams.set("question", question);
  return new NextRequest(url, {
    headers: {
      "x-forwarded-for": `198.51.100.${ipSuffix}`
    },
    signal
  });
}

describe("weather route public work budget", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.clearAllMocks();
    mocks.fetchWeatherSignal.mockResolvedValue({
      source: "kma",
      mode: "live",
      locationLabel: "서울",
      summary: "맑음",
      actions: ["작업 전 기상 확인"],
      detail: "mock weather",
      signals: []
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("fails closed before weather work when distributed admission is misconfigured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { GET } = await import("@/app/api/weather/route");

    const response = await GET(weatherRequest("서울 옥외 폭염 작업", 9));

    expect(response.status).toBe(503);
    expect(response.headers.get("X-SafeClaw-Rate-Limit")).toBe("distributed");
    expect(mocks.fetchWeatherSignal).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("requires durable admission in production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { GET } = await import("@/app/api/weather/route");

    const response = await GET(weatherRequest("서울 옥외 폭염 작업", 8));

    expect(response.status).toBe(503);
    expect(mocks.fetchWeatherSignal).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("rejects oversized questions before upstream weather fan-out", async () => {
    const { GET } = await import("@/app/api/weather/route");
    const response = await GET(weatherRequest("서울 폭염 ".repeat(PUBLIC_WEATHER_QUESTION_MAX_CHARS), 10));
    const body = await response.json() as { code: string; limit: number };

    expect(response.status).toBe(413);
    expect(body).toMatchObject({
      code: "PUBLIC_WORK_BUDGET_EXCEEDED",
      limit: PUBLIC_WEATHER_QUESTION_MAX_CHARS
    });
    expect(mocks.fetchWeatherSignal).not.toHaveBeenCalled();
  });

  it("coalesces equivalent in-flight weather lookups", async () => {
    const { GET } = await import("@/app/api/weather/route");
    let resolveWeather: (value: WeatherRouteSignal) => void = () => undefined;
    mocks.fetchWeatherSignal.mockImplementationOnce(() => new Promise<WeatherRouteSignal>((resolve) => {
      resolveWeather = resolve;
    }));

    const first = GET(weatherRequest("서울 옥외 폭염 작업", 11));
    const second = GET(weatherRequest("서울 야외 고온 작업 기상 확인", 12));
    await vi.waitFor(() => expect(mocks.fetchWeatherSignal).toHaveBeenCalledTimes(1));
    resolveWeather?.({
      source: "kma",
      mode: "live",
      locationLabel: "서울",
      summary: "폭염",
      actions: ["작업중지 기준 공유"],
      detail: "mock coalesced weather",
      signals: []
    });
    const [firstResponse, secondResponse] = await Promise.all([first, second]);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(mocks.fetchWeatherSignal).toHaveBeenCalledTimes(1);
  });

  it("keeps shared weather work alive until the final consumer disconnects", async () => {
    const { GET } = await import("@/app/api/weather/route");
    let providerSignal: AbortSignal | undefined;
    mocks.fetchWeatherSignal.mockImplementationOnce((_question: string, signal?: AbortSignal) => {
      providerSignal = signal;
      return new Promise<WeatherRouteSignal>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    });
    const firstController = new AbortController();
    const secondController = new AbortController();
    const first = GET(weatherRequest("서울 옥외 폭염 작업", 13, firstController.signal));
    const second = GET(weatherRequest("서울 야외 고온 작업 기상 확인", 14, secondController.signal));
    await vi.waitFor(() => expect(mocks.fetchWeatherSignal).toHaveBeenCalledTimes(1));

    const firstReason = new Error("first caller disconnected");
    firstController.abort(firstReason);
    await expect(first).rejects.toBe(firstReason);
    expect(providerSignal?.aborted).toBe(false);

    const secondReason = new Error("final caller disconnected");
    secondController.abort(secondReason);
    await expect(second).rejects.toBe(secondReason);
    expect(providerSignal?.aborted).toBe(true);
  });
});
