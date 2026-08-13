import { createRateLimiter } from "@/lib/rate-limit";
import {
  acquirePublicConcurrencyLease,
  checkPublicRateLimit,
  type PublicRateLimitDecision,
} from "@/lib/public-distributed-rate-limit";

const PUBLIC_SEARCH_PROVIDER_LIMIT = 30;
const PUBLIC_SEARCH_PROVIDER_WINDOW_MS = 60_000;

export type PublicSearchProviderKind = "legal" | "safety-reference" | "weather";

export const PUBLIC_SEARCH_PROVIDER_ADMISSION_POLICY = {
  capacity: 12,
  leaseMs: 70_000,
  namespace: "public-search-provider-work",
  weights: {
    legal: 6,
    "safety-reference": 3,
    weather: 1,
  } satisfies Record<PublicSearchProviderKind, number>,
} as const;

export type PublicSearchWorkLease = {
  release: () => Promise<void>;
  weight: number;
};

export class PublicSearchAdmissionError extends Error {
  readonly code: "PUBLIC_SEARCH_CONCURRENCY_LIMIT" | "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE";

  constructor(code: PublicSearchAdmissionError["code"], cause?: unknown) {
    super(code, cause === undefined ? undefined : { cause });
    this.name = "PublicSearchAdmissionError";
    this.code = code;
  }
}

let activeInstanceWorkUnits = 0;
const providerLimiter = createRateLimiter({
  limit: PUBLIC_SEARCH_PROVIDER_LIMIT,
  windowMs: PUBLIC_SEARCH_PROVIDER_WINDOW_MS,
});

function acquireInstanceWorkUnits(weight: number): (() => void) | null {
  if (activeInstanceWorkUnits + weight > PUBLIC_SEARCH_PROVIDER_ADMISSION_POLICY.capacity) return null;
  activeInstanceWorkUnits += weight;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeInstanceWorkUnits -= weight;
  };
}

export function checkPublicSearchProviderAdmission(
  request: Request,
  kind: PublicSearchProviderKind,
): Promise<PublicRateLimitDecision> {
  return checkPublicRateLimit({
    request,
    namespace: `public-search-provider-${kind}`,
    limit: PUBLIC_SEARCH_PROVIDER_LIMIT,
    windowMs: PUBLIC_SEARCH_PROVIDER_WINDOW_MS,
    instanceLimiter: providerLimiter,
    requireDistributedInProduction: true,
  });
}

export async function acquirePublicSearchWorkLease(
  kind: PublicSearchProviderKind,
): Promise<PublicSearchWorkLease> {
  const weight = PUBLIC_SEARCH_PROVIDER_ADMISSION_POLICY.weights[kind];
  let distributedRelease: (() => Promise<void>) | null | undefined;
  try {
    distributedRelease = await acquirePublicConcurrencyLease({
      concurrency: PUBLIC_SEARCH_PROVIDER_ADMISSION_POLICY.capacity,
      leaseMs: PUBLIC_SEARCH_PROVIDER_ADMISSION_POLICY.leaseMs,
      namespace: PUBLIC_SEARCH_PROVIDER_ADMISSION_POLICY.namespace,
      requireDistributedInProduction: true,
      weight,
    });
  } catch (error) {
    console.error("[public-search-admission] distributed lease unavailable", {
      error: error instanceof Error ? error.message : String(error),
      kind,
    });
    throw new PublicSearchAdmissionError("DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", error);
  }

  const release = distributedRelease === undefined
    ? acquireInstanceWorkUnits(weight)
    : distributedRelease;
  if (!release) throw new PublicSearchAdmissionError("PUBLIC_SEARCH_CONCURRENCY_LIMIT");

  return {
    weight,
    release: async () => { await release(); },
  };
}

export function publicSearchAdmissionErrorResponse(error: unknown): Response | null {
  if (!(error instanceof PublicSearchAdmissionError)) return null;
  const unavailable = error.code === "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE";
  return new Response(JSON.stringify({
    error: unavailable
      ? "요청 보호 서비스를 확인하는 동안 검색을 잠시 처리할 수 없습니다."
      : "외부 검색 작업이 많습니다. 잠시 후 다시 시도해 주세요.",
    code: error.code,
    retryAfterSeconds: unavailable ? 5 : 1,
  }), {
    status: 503,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": unavailable ? "5" : "1",
      "X-SafeClaw-Admission": "distributed",
    },
  });
}

export function applyPublicSearchWorkHeaders<T extends Response>(
  response: T,
  kind: PublicSearchProviderKind,
): T {
  response.headers.set("X-SafeClaw-Work-Kind", kind);
  response.headers.set(
    "X-SafeClaw-Work-Unit",
    String(PUBLIC_SEARCH_PROVIDER_ADMISSION_POLICY.weights[kind]),
  );
  return response;
}
