import { NextRequest, NextResponse } from "next/server";
import {
  buildPublicSafetyReferenceItem,
  readSafetyReferenceLimit,
} from "@/lib/safety-reference-catalog";
import { searchSafetyReferences } from "@/lib/safety-reference-catalog-server";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  applyPublicRateLimitHeader,
  checkPublicRateLimit,
  publicRateLimitResponse,
} from "@/lib/public-distributed-rate-limit";
import {
  isOverCharBudget,
  publicWorkBudgetExceeded,
  PUBLIC_SAFETY_REFERENCE_FILTER_MAX_CHARS,
  PUBLIC_SAFETY_REFERENCE_QUERY_MAX_CHARS,
} from "@/lib/public-work-budget";
import {
  acquirePublicSearchWorkLease,
  applyPublicSearchWorkHeaders,
  checkPublicSearchProviderAdmission,
  publicSearchAdmissionErrorResponse,
} from "@/lib/public-search-admission";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
type InFlightSearch = {
  controller: AbortController;
  consumers: number;
  settled: boolean;
  promise: ReturnType<typeof searchSafetyReferences>;
};

const inFlightSearches = new Map<string, InFlightSearch>();

function normalizeSearchValue(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function isOversizedFilter(value: string | undefined): boolean {
  return value !== undefined
    && isOverCharBudget(value, PUBLIC_SAFETY_REFERENCE_FILTER_MAX_CHARS);
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

async function searchCoalesced(
  input: Parameters<typeof searchSafetyReferences>[0],
  signal: AbortSignal,
) {
  const key = JSON.stringify(input);
  let entry = inFlightSearches.get(key);
  if (!entry) {
    const controller = new AbortController();
    let createdEntry: InFlightSearch;
    const promise = (async () => {
      const lease = await acquirePublicSearchWorkLease("safety-reference");
      try {
        return await searchSafetyReferences({ ...input, signal: controller.signal });
      } finally {
        await lease.release();
      }
    })().finally(() => {
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
      entry.controller.abort(new Error("all safety-reference request consumers disconnected"));
    }
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await checkPublicRateLimit({
    request,
    namespace: "safety-reference-search",
    limit: 30,
    windowMs: 60_000,
    instanceLimiter: limiter,
  });
  const limited = publicRateLimitResponse(rateLimit);
  if (limited) return limited;

  const query = normalizeSearchValue(request.nextUrl.searchParams.get("q") || "");
  const limit = readSafetyReferenceLimit(request.nextUrl.searchParams.get("limit"));
  const itemType = normalizeSearchValue(request.nextUrl.searchParams.get("itemType") || "") || undefined;
  const sourceId = normalizeSearchValue(request.nextUrl.searchParams.get("sourceId") || "") || undefined;
  const riskTag = normalizeSearchValue(request.nextUrl.searchParams.get("riskTag") || "") || undefined;
  const evidenceRoleParam = request.nextUrl.searchParams.get("evidenceRole");
  const evidenceRole = evidenceRoleParam === "direct" || evidenceRoleParam === "supporting"
    ? evidenceRoleParam
    : undefined;

  if (isOverCharBudget(query, PUBLIC_SAFETY_REFERENCE_QUERY_MAX_CHARS)) {
    return applyPublicRateLimitHeader(publicWorkBudgetExceeded(
      "q exceeds the public safety-reference work budget",
      PUBLIC_SAFETY_REFERENCE_QUERY_MAX_CHARS,
    ), rateLimit);
  }
  if ([itemType, sourceId, riskTag].some(isOversizedFilter)) {
    return applyPublicRateLimitHeader(publicWorkBudgetExceeded(
      "filter exceeds the public safety-reference work budget",
      PUBLIC_SAFETY_REFERENCE_FILTER_MAX_CHARS,
    ), rateLimit);
  }

  const providerRateLimit = await checkPublicSearchProviderAdmission(request, "safety-reference");
  const providerLimited = publicRateLimitResponse(providerRateLimit);
  if (providerLimited) return providerLimited;

  try {
    const result = await searchCoalesced({
      query,
      limit,
      itemType,
      sourceId,
      riskTag,
      evidenceRole
    }, request.signal);
    const publicResult = {
      ...result,
      items: result.items.map(buildPublicSafetyReferenceItem),
    };

    return applyPublicSearchWorkHeaders(applyPublicRateLimitHeader(
      NextResponse.json(publicResult, { status: result.ok ? 200 : 503 }),
      providerRateLimit,
    ), "safety-reference");
  } catch (error) {
    request.signal.throwIfAborted();
    const admissionResponse = publicSearchAdmissionErrorResponse(error);
    if (admissionResponse) return applyPublicRateLimitHeader(admissionResponse, providerRateLimit);
    throw error;
  }
}
