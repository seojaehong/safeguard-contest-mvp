import { NextRequest, NextResponse } from "next/server";
import { summarizeLegalSourceMix } from "@/lib/legal-sources";
import {
  applyPublicRateLimitHeader,
} from "@/lib/public-distributed-rate-limit";
import { applyPublicSearchWorkHeaders } from "@/lib/public-search-admission";
import { runPublicLegalSearchOperation } from "@/lib/public-search-operation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const operation = await runPublicLegalSearchOperation({
    request,
    query: request.nextUrl.searchParams.get("q") || "",
  });
  if (!operation.ok) return operation.response;
  const { query, rateLimit, results } = operation;
  return applyPublicSearchWorkHeaders(applyPublicRateLimitHeader(NextResponse.json({
    q: query,
    count: results.length,
    results,
    sourceMix: summarizeLegalSourceMix(results)
  }), rateLimit), "legal");
}
