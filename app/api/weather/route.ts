import { NextRequest, NextResponse } from "next/server";
import { fetchWeatherSignal } from "@/lib/weather";
import { createRateLimiter } from "@/lib/rate-limit";
import { enforceRateLimit } from "@/lib/api-guard";
import {
  isOverCharBudget,
  publicWorkBudgetExceeded,
  PUBLIC_WEATHER_QUESTION_MAX_CHARS
} from "@/lib/public-work-budget";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
const inFlightWeather = new Map<string, Promise<Awaited<ReturnType<typeof fetchWeatherSignal>>>>();

function normalizeWeatherQuestion(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function fetchCoalescedWeather(question: string) {
  const key = normalizeWeatherQuestion(question).toLowerCase();
  const existing = inFlightWeather.get(key);
  if (existing) return existing;
  const pending = fetchWeatherSignal(question).finally(() => {
    inFlightWeather.delete(key);
  });
  inFlightWeather.set(key, pending);
  return pending;
}

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, limiter);
  if (limited) return limited;

  const question = request.nextUrl.searchParams.get("question")?.trim() || "";
  if (!question) {
    return NextResponse.json(
      { ok: false, message: "question query is required" },
      { status: 400 }
    );
  }
  if (isOverCharBudget(question, PUBLIC_WEATHER_QUESTION_MAX_CHARS)) {
    return publicWorkBudgetExceeded("question exceeds the public weather work budget", PUBLIC_WEATHER_QUESTION_MAX_CHARS);
  }

  try {
    const weather = await fetchCoalescedWeather(question);
    return NextResponse.json({ ok: true, weather });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("weather route failed", error);
    return NextResponse.json(
      { ok: false, message },
      { status: 502 }
    );
  }
}
