import { NextRequest, NextResponse } from "next/server";
import { runSearch } from "@/lib/search";
import { summarizeLegalSourceMix } from "@/lib/legal-sources";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";
  const results = await runSearch(q);
  return NextResponse.json({
    q,
    count: results.length,
    results,
    sourceMix: summarizeLegalSourceMix(results)
  });
}
