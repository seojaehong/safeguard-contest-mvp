import { NextRequest, NextResponse } from "next/server";
import { runSearch } from "@/lib/search";
import { summarizeLegalSourceMix } from "@/lib/legal-sources";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  applyPublicRateLimitHeader,
  checkPublicRateLimit,
  publicRateLimitResponse,
} from "@/lib/public-distributed-rate-limit";
import {
  isOverCharBudget,
  publicWorkBudgetExceeded,
  PUBLIC_LEGAL_SEARCH_QUERY_MAX_CHARS,
} from "@/lib/public-work-budget";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
const inFlightSearches = new Map<string, ReturnType<typeof runSearch>>();

function normalizeSearchQuery(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function runCoalescedSearch(query: string): ReturnType<typeof runSearch> {
  const key = normalizeSearchQuery(query).toLowerCase();
  const existing = inFlightSearches.get(key);
  if (existing) return existing;
  const pending = runSearch(query).finally(() => {
    inFlightSearches.delete(key);
  });
  inFlightSearches.set(key, pending);
  return pending;
}

export async function GET(request: NextRequest) {
  const rateLimit = await checkPublicRateLimit({
    request,
    namespace: "legal-search",
    limit: 30,
    windowMs: 60_000,
    instanceLimiter: limiter,
  });
  const limited = publicRateLimitResponse(rateLimit);
  if (limited) return limited;

  const q = normalizeSearchQuery(request.nextUrl.searchParams.get("q") || "");
  if (isOverCharBudget(q, PUBLIC_LEGAL_SEARCH_QUERY_MAX_CHARS)) {
    return applyPublicRateLimitHeader(publicWorkBudgetExceeded(
      "q exceeds the public legal search work budget",
      PUBLIC_LEGAL_SEARCH_QUERY_MAX_CHARS,
    ), rateLimit);
  }

  const results = await runCoalescedSearch(q);
  return applyPublicRateLimitHeader(NextResponse.json({
    q,
    count: results.length,
    results,
    sourceMix: summarizeLegalSourceMix(results)
  }), rateLimit);
}
