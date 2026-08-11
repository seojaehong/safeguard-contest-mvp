import { NextRequest, NextResponse } from "next/server";
import { fetchWeatherSignal, getWeatherWorkKey } from "@/lib/weather";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  applyPublicRateLimitHeader,
  checkPublicRateLimit,
  publicRateLimitResponse,
} from "@/lib/public-distributed-rate-limit";
import {
  isOverCharBudget,
  publicWorkBudgetExceeded,
  PUBLIC_WEATHER_QUESTION_MAX_CHARS
} from "@/lib/public-work-budget";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
type InFlightWeather = {
  controller: AbortController;
  consumers: number;
  settled: boolean;
  promise: Promise<Awaited<ReturnType<typeof fetchWeatherSignal>>>;
};

const inFlightWeather = new Map<string, InFlightWeather>();

function waitForWeather<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abort);
    });
  });
}

async function fetchCoalescedWeather(question: string, signal: AbortSignal) {
  const key = getWeatherWorkKey(question);
  let entry = inFlightWeather.get(key);
  if (!entry) {
    const controller = new AbortController();
    let createdEntry: InFlightWeather;
    const promise = fetchWeatherSignal(question, controller.signal).finally(() => {
      createdEntry.settled = true;
      if (inFlightWeather.get(key) === createdEntry) inFlightWeather.delete(key);
    });
    createdEntry = { controller, consumers: 0, settled: false, promise };
    void createdEntry.promise.catch(() => undefined);
    inFlightWeather.set(key, createdEntry);
    entry = createdEntry;
  }

  entry.consumers += 1;
  try {
    return await waitForWeather(entry.promise, signal);
  } finally {
    entry.consumers -= 1;
    if (entry.consumers === 0 && !entry.settled) {
      entry.controller.abort(new Error("all weather request consumers disconnected"));
    }
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await checkPublicRateLimit({
    request,
    namespace: "public-weather",
    limit: 30,
    windowMs: 60_000,
    instanceLimiter: limiter,
  });
  const limited = publicRateLimitResponse(rateLimit);
  if (limited) return limited;

  const question = request.nextUrl.searchParams.get("question")?.trim() || "";
  if (!question) {
    return NextResponse.json(
      { ok: false, message: "question query is required" },
      { status: 400 }
    );
  }
  if (isOverCharBudget(question, PUBLIC_WEATHER_QUESTION_MAX_CHARS)) {
    return applyPublicRateLimitHeader(
      publicWorkBudgetExceeded("question exceeds the public weather work budget", PUBLIC_WEATHER_QUESTION_MAX_CHARS),
      rateLimit,
    );
  }

  try {
    const weather = await fetchCoalescedWeather(question, request.signal);
    return applyPublicRateLimitHeader(NextResponse.json({ ok: true, weather }), rateLimit);
  } catch (error) {
    request.signal.throwIfAborted();
    const message = error instanceof Error ? error.message : String(error);
    console.error("weather route failed", error);
    return NextResponse.json(
      { ok: false, message },
      { status: 502 }
    );
  }
}
