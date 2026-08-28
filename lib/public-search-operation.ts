import { createRateLimiter } from "@/lib/rate-limit";
import {
  applyPublicRateLimitHeader,
  checkPublicRateLimit,
  publicRateLimitResponse,
  type PublicRateLimitDecision,
} from "@/lib/public-distributed-rate-limit";
import {
  acquirePublicSearchWorkLease,
  checkPublicSearchProviderAdmission,
  publicSearchAdmissionErrorResponse,
} from "@/lib/public-search-admission";
import {
  isOverCharBudget,
  publicWorkBudgetExceeded,
  PUBLIC_LEGAL_SEARCH_QUERY_MAX_CHARS,
} from "@/lib/public-work-budget";
import { runSearch } from "@/lib/search";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

type SearchResults = Awaited<ReturnType<typeof runSearch>>;
type InFlightSearch = {
  controller: AbortController;
  consumers: number;
  settled: boolean;
  promise: Promise<SearchResults>;
};

const inFlightSearches = new Map<string, InFlightSearch>();

export type PublicLegalSearchOperationResult =
  | {
      ok: true;
      query: string;
      rateLimit: PublicRateLimitDecision;
      results: SearchResults;
    }
  | { ok: false; response: Response };

export function normalizePublicSearchQuery(value: string): string {
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

async function runCoalescedSearch(query: string, signal: AbortSignal): Promise<SearchResults> {
  const key = normalizePublicSearchQuery(query).toLowerCase();
  let entry = inFlightSearches.get(key);
  if (!entry) {
    const controller = new AbortController();
    let createdEntry: InFlightSearch;
    const promise = (async () => {
      const lease = await acquirePublicSearchWorkLease("legal");
      try {
        return await runSearch(query, controller.signal);
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
      entry.controller.abort(new Error("all legal-search request consumers disconnected"));
    }
  }
}

export async function runPublicLegalSearchOperation(input: {
  request: Request;
  query: string;
  signal?: AbortSignal;
}): Promise<PublicLegalSearchOperationResult> {
  const rateLimit = await checkPublicRateLimit({
    request: input.request,
    namespace: "legal-search",
    limit: 30,
    windowMs: 60_000,
    instanceLimiter: limiter,
  });
  const limited = publicRateLimitResponse(rateLimit);
  if (limited) return { ok: false, response: limited };

  const query = normalizePublicSearchQuery(input.query);
  if (isOverCharBudget(query, PUBLIC_LEGAL_SEARCH_QUERY_MAX_CHARS)) {
    return {
      ok: false,
      response: applyPublicRateLimitHeader(
        publicWorkBudgetExceeded(
          "q exceeds the public legal search work budget",
          PUBLIC_LEGAL_SEARCH_QUERY_MAX_CHARS,
        ),
        rateLimit,
      ),
    };
  }

  const providerRateLimit = await checkPublicSearchProviderAdmission(input.request, "legal");
  const providerLimited = publicRateLimitResponse(providerRateLimit);
  if (providerLimited) return { ok: false, response: providerLimited };

  try {
    const results = await runCoalescedSearch(query, input.signal ?? input.request.signal);
    return { ok: true, query, rateLimit: providerRateLimit, results };
  } catch (error) {
    (input.signal ?? input.request.signal).throwIfAborted();
    const admissionResponse = publicSearchAdmissionErrorResponse(error);
    if (admissionResponse) {
      return {
        ok: false,
        response: applyPublicRateLimitHeader(admissionResponse, providerRateLimit),
      };
    }
    throw error;
  }
}
