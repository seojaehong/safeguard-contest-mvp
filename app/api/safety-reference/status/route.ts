import { NextResponse } from "next/server";
import { getSafetyReferenceStats } from "@/lib/safety-reference-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getSafetyReferenceStats();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
