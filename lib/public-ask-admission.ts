import { createRateLimiter } from "@/lib/rate-limit";
import type { AiMode } from "@/lib/ai-deliverables";
import {
  acquirePublicConcurrencyLease,
  checkPublicRateLimit,
} from "@/lib/public-distributed-rate-limit";

const PUBLIC_ASK_LIMIT = 10;
const PUBLIC_ASK_WINDOW_MS = 60_000;
export const PUBLIC_ASK_PROVIDER_ADMISSION_POLICY = {
  capacity: 12,
  leaseMs: 310_000,
  namespace: "public-ask-provider-work",
  // Template has no providers; enhanced runs answer/mapping; full adds the parallel document groups.
  weights: {
    template: 0,
    enhanced: 2,
    full: 12,
  } satisfies Record<AiMode, number>,
} as const;
let activeInstanceWorkUnits = 0;
const publicAskInstanceLimiter = createRateLimiter({
  limit: PUBLIC_ASK_LIMIT,
  windowMs: PUBLIC_ASK_WINDOW_MS,
});

export function checkPublicAskAdmission(request: Request) {
  return checkPublicRateLimit({
    request,
    namespace: "public-ask-family",
    limit: PUBLIC_ASK_LIMIT,
    windowMs: PUBLIC_ASK_WINDOW_MS,
    instanceLimiter: publicAskInstanceLimiter,
  });
}

export type PublicAskWorkLease = {
  release: () => Promise<void>;
  weight: number;
};

function acquireInstanceWorkUnits(weight: number): (() => void) | null {
  if (activeInstanceWorkUnits + weight > PUBLIC_ASK_PROVIDER_ADMISSION_POLICY.capacity) return null;
  activeInstanceWorkUnits += weight;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeInstanceWorkUnits -= weight;
  };
}

export async function acquirePublicAskWorkLease(aiMode: AiMode): Promise<PublicAskWorkLease | null> {
  const weight = PUBLIC_ASK_PROVIDER_ADMISSION_POLICY.weights[aiMode];
  if (weight === 0) return { release: async () => undefined, weight };

  const distributedRelease = await acquirePublicConcurrencyLease({
    concurrency: PUBLIC_ASK_PROVIDER_ADMISSION_POLICY.capacity,
    leaseMs: PUBLIC_ASK_PROVIDER_ADMISSION_POLICY.leaseMs,
    namespace: PUBLIC_ASK_PROVIDER_ADMISSION_POLICY.namespace,
    requireDistributedInProduction: true,
    weight,
  });
  const release = distributedRelease === undefined
    ? acquireInstanceWorkUnits(weight)
    : distributedRelease;
  if (!release) return null;
  return {
    weight,
    release: async () => { await release(); },
  };
}

export function publicAskConcurrencyResponse(aiMode: AiMode): Response {
  return new Response(JSON.stringify({
    error: "AI 문서 생성 작업이 많습니다. 잠시 후 다시 시도해 주세요.",
    code: "PUBLIC_ASK_CONCURRENCY_LIMIT",
    retryAfterSeconds: 1,
  }), {
    status: 503,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": "1",
      "X-SafeClaw-AI-Mode": aiMode,
      "X-SafeClaw-Work-Unit": String(PUBLIC_ASK_PROVIDER_ADMISSION_POLICY.weights[aiMode]),
    },
  });
}

export function applyPublicAskWorkHeaders<T extends Response>(response: T, aiMode: AiMode, weight: number): T {
  response.headers.set("X-SafeClaw-AI-Mode", aiMode);
  response.headers.set("X-SafeClaw-Work-Unit", String(weight));
  return response;
}
