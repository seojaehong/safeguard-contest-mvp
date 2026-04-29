import { NextRequest, NextResponse } from "next/server";
import { fetchWeatherSignal } from "@/lib/weather";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const question = request.nextUrl.searchParams.get("question")?.trim() || "";
  if (!question) {
    return NextResponse.json(
      { ok: false, message: "question query is required" },
      { status: 400 }
    );
  }

  try {
    const weather = await fetchWeatherSignal(question);
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
