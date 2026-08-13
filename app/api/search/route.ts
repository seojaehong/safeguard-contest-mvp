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
type InFlightSearch = {
  controller: AbortController;
  consumers: number;
  settled: boolean;
  promise: ReturnType<typeof runSearch>;
};

const inFlightSearches = new Map<string, InFlightSearch>();

function normalizeSearchQuery(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function waitForSearch<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abort);
    });
  });
}

async function runCoalescedSearch(query: string, signal: AbortSignal) {
  const key = normalizeSearchQuery(query).toLowerCase();
  let entry = inFlightSearches.get(key);
  if (!entry) {
    const controller = new AbortController();
    let createdEntry: InFlightSearch;
    const promise = runSearch(query, controller.signal).finally(() => {
      createdEntry.settled = true;
      if (inFlightSearches.get(key) === createdEntry) inFlightSearches.delete(key);
    });
    createdEntry = { controller, consumers: 0, settled: false, promise };
    void createdEntry.promise.catch(() => undefined);
    inFlightSearches.set(key, createdEntry);
    entry = createdEntry;
  }

  entry.consumers += 1;
  try {
    return await waitForSearch(entry.promise, signal);
  } finally {
    entry.consumers -= 1;
    if (entry.consumers === 0 && !entry.settled) {
      entry.controller.abort(new Error("all legal-search request consumers disconnected"));
    }
  }
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

  const results = await runCoalescedSearch(q, request.signal);
  return applyPublicRateLimitHeader(NextResponse.json({
    q,
    count: results.length,
    results,
    sourceMix: summarizeLegalSourceMix(results)
  }), rateLimit);
}
