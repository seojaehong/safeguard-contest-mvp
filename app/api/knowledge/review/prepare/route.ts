import { NextRequest, NextResponse } from "next/server";
import { generateKnowledgeText } from "@/lib/ai";
import { buildKnowledgeCandidateDraft } from "@/lib/knowledge-candidate-route";
import {
  isStrictUuidV4,
  KnowledgeReviewPrepareError,
  prepareKnowledgeReviewCandidate
} from "@/lib/knowledge-review-prepare";
import {
  acquirePublicAskWorkLease,
  applyPublicAskWorkHeaders,
  publicAskConcurrencyResponse
} from "@/lib/public-ask-admission";
import {
  applyPublicRateLimitHeader,
  checkPublicRateLimit,
  publicRateLimitResponse
} from "@/lib/public-distributed-rate-limit";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  createSupabaseAdminClient,
  getWorkspaceUser
} from "@/lib/supabase-admin";
import {
  enforcePublicJsonRequestBodyBudget,
  KNOWLEDGE_WRITE_REQUEST_MAX_BYTES
} from "@/lib/public-work-budget";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PREPARE_RATE_LIMIT = 10;
const PREPARE_RATE_WINDOW_MS = 60_000;
const limiter = createRateLimiter({ limit: PREPARE_RATE_LIMIT, windowMs: PREPARE_RATE_WINDOW_MS });

type PreparationExecution =
  | { admitted: false }
  | {
      admitted: true;
      result: Awaited<ReturnType<typeof prepareKnowledgeReviewCandidate>>;
      weight: number;
    };

type InFlightPreparation = {
  controller: AbortController;
  consumers: number;
  settled: boolean;
  promise: Promise<PreparationExecution>;
};

const inFlightPreparations = new Map<string, InFlightPreparation>();

function waitForPreparation<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abort);
    });
  });
}

async function runCoalescedPreparation(
  key: string,
  signal: AbortSignal,
  work: (signal: AbortSignal) => Promise<PreparationExecution>
) {
  let entry = inFlightPreparations.get(key);
  if (!entry) {
    const controller = new AbortController();
    let createdEntry: InFlightPreparation;
    const promise = work(controller.signal).finally(() => {
      createdEntry.settled = true;
      if (inFlightPreparations.get(key) === createdEntry) inFlightPreparations.delete(key);
    });
    createdEntry = { controller, consumers: 0, settled: false, promise };
    void createdEntry.promise.catch(() => undefined);
    inFlightPreparations.set(key, createdEntry);
    entry = createdEntry;
  }

  entry.consumers += 1;
  try {
    return await waitForPreparation(entry.promise, signal);
  } finally {
    entry.consumers -= 1;
    if (entry.consumers === 0 && !entry.settled) {
      entry.controller.abort(new Error("all knowledge-review preparation consumers disconnected"));
    }
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await checkPublicRateLimit({
    request,
    namespace: "knowledge-review-prepare",
    limit: PREPARE_RATE_LIMIT,
    windowMs: PREPARE_RATE_WINDOW_MS,
    instanceLimiter: limiter
  });
  const limited = publicRateLimitResponse(rateLimit);
  if (limited) return limited;

  const bodyBudget = await enforcePublicJsonRequestBodyBudget(
    request,
    KNOWLEDGE_WRITE_REQUEST_MAX_BYTES,
    "request body exceeds the knowledge write byte budget",
  );
  if (!bodyBudget.ok) return applyPublicRateLimitHeader(bodyBudget.response, rateLimit);

  const body = await bodyBudget.request.json().catch((): unknown => null);
  const runId = typeof body === "object"
    && body !== null
    && !Array.isArray(body)
    && typeof (body as Record<string, unknown>).runId === "string"
    ? ((body as Record<string, unknown>).runId as string).trim()
    : "";
  if (!isStrictUuidV4(runId)) {
    return applyPublicRateLimitHeader(NextResponse.json({
      ok: false,
      configured: true,
      code: "prepare_run_id_required",
      message: "유효한 runId가 필요합니다."
    }, { status: 400 }), rateLimit);
  }

  const client = createSupabaseAdminClient();
  if (!client) {
    return applyPublicRateLimitHeader(NextResponse.json({
      ok: false,
      configured: false,
      message: "사람 검토 저장소가 설정되지 않았습니다."
    }, { status: 503 }), rateLimit);
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return applyPublicRateLimitHeader(NextResponse.json({
      ok: false,
      configured: true,
      message: "로그인이 필요합니다."
    }, { status: 401 }), rateLimit);
  }

  try {
    const execution = await runCoalescedPreparation(
      `${user.id}:${runId}`,
      request.signal,
      async (signal): Promise<PreparationExecution> => {
        let lease;
        try {
          lease = await acquirePublicAskWorkLease("enhanced", {
            requireDistributedInProduction: true
          });
        } catch (error) {
          console.error("knowledge review preparation admission unavailable", error);
          return { admitted: false };
        }
        if (!lease) return { admitted: false };

        try {
          const result = await prepareKnowledgeReviewCandidate(client, user, { runId }, {
            buildCandidate: async (input) => {
              const built = await buildKnowledgeCandidateDraft({
                question: input.question,
                rawEvents: input.rawEvents,
                tenantContext: input.tenantContext,
                generate: true,
                signal
              }, { generateText: generateKnowledgeText });
              return {
                candidate: built.candidate,
                configured: built.generated.configured,
                providerLabel: built.generated.providerLabel
              };
            }
          });
          return { admitted: true, result, weight: lease.weight };
        } finally {
          await lease.release();
        }
      }
    );
    if (!execution.admitted) {
      return applyPublicRateLimitHeader(publicAskConcurrencyResponse("enhanced"), rateLimit);
    }

    const response = NextResponse.json({
      ...execution.result,
      message: "검토용 지식 후보를 저장했습니다. 공개 또는 온톨로지 반영은 수행하지 않았습니다."
    });
    applyPublicAskWorkHeaders(response, "enhanced", execution.weight);
    return applyPublicRateLimitHeader(response, rateLimit);
  } catch (error) {
    request.signal.throwIfAborted();
    if (error instanceof KnowledgeReviewPrepareError) {
      if (error.status >= 500) {
        console.error("knowledge review preparation failed", {
          code: error.code,
          cause: error.cause
        });
      }
      return applyPublicRateLimitHeader(NextResponse.json({
        ok: false,
        configured: true,
        code: error.code,
        message: error.message
      }, { status: error.status }), rateLimit);
    }

    console.error("knowledge review preparation failed", error);
    return applyPublicRateLimitHeader(NextResponse.json({
      ok: false,
      configured: true,
      code: "prepare_failed",
      message: "지식 후보를 준비하지 못했습니다."
    }, { status: 500 }), rateLimit);
  }
}
