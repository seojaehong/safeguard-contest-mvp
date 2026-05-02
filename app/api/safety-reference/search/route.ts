import { NextRequest, NextResponse } from "next/server";
import { readSafetyReferenceLimit, searchSafetyReferences } from "@/lib/safety-reference-catalog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";
  const limit = readSafetyReferenceLimit(request.nextUrl.searchParams.get("limit"));
  const itemType = request.nextUrl.searchParams.get("itemType") || undefined;
  const sourceId = request.nextUrl.searchParams.get("sourceId") || undefined;
  const riskTag = request.nextUrl.searchParams.get("riskTag") || undefined;

  const result = await searchSafetyReferences({
    query,
    limit,
    itemType,
    sourceId,
    riskTag
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
