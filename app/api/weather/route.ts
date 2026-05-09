import { NextRequest, NextResponse } from "next/server";
import { fetchWeatherSignal } from "@/lib/weather";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const questionParam = searchParams.get("question")?.trim() || "";
  const location = searchParams.get("location")?.trim() || "";
  const lat = searchParams.get("lat")?.trim() || searchParams.get("latitude")?.trim() || "";
  const lon = searchParams.get("lon")?.trim() || searchParams.get("lng")?.trim() || searchParams.get("longitude")?.trim() || "";
  const question = questionParam || deriveWeatherQuestion(location, lat, lon);

  if (!question) {
    return NextResponse.json(
      { ok: false, message: "question or location query is required" },
      { status: 400 }
    );
  }

  try {
    const weather = await fetchWeatherSignal(question);
    return NextResponse.json({ ok: true, query: question, weather });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("weather route failed", error);
    return NextResponse.json(
      { ok: false, message },
      { status: 502 }
    );
  }
}

function deriveWeatherQuestion(location: string, lat: string, lon: string) {
  if (location) {
    return `${location} 현장 현재 날씨`;
  }

  if (lat && lon) {
    return `위도 ${lat}, 경도 ${lon} 현장 현재 날씨`;
  }

  return "";
}
