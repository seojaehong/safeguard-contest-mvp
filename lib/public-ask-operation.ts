import type { AiMode } from "@/lib/ai-deliverables";
import type { HarnessMemoryInput } from "@/lib/db-harness";
import { createLogger } from "@/lib/logger";
import {
  acquirePublicAskWorkLease,
  checkPublicAskAdmission,
  checkPublicAskProviderAdmission,
  publicAskConcurrencyResponse,
  publicAskUsesProvider,
} from "@/lib/public-ask-admission";
import {
  applyPublicRateLimitHeader,
  publicRateLimitResponse,
  type PublicRateLimitDecision,
} from "@/lib/public-distributed-rate-limit";
import {
  isOverCharBudget,
  publicWorkBudgetExceeded,
  PUBLIC_ASK_QUESTION_MAX_CHARS,
} from "@/lib/public-work-budget";
import { runAsk } from "@/lib/search";
import type { AskResponse } from "@/lib/types";

const log = createLogger("public-ask-operation");

export type PublicAskOperationResult =
  | {
      ok: true;
      aiMode: AiMode;
      data: AskResponse;
      rateLimit: PublicRateLimitDecision;
      workUnit: number;
    }
  | { ok: false; response: Response };

export async function runPublicAskOperation(input: {
  request: Request;
  question: string;
  aiMode: AiMode;
  harnessMemory?: HarnessMemoryInput;
  signal?: AbortSignal;
  admission?: PublicRateLimitDecision;
}): Promise<PublicAskOperationResult> {
  const rateLimit = input.admission ?? await checkPublicAskAdmission(input.request);
  const limited = publicRateLimitResponse(rateLimit);
  if (limited) return { ok: false, response: limited };

  if (isOverCharBudget(input.question, PUBLIC_ASK_QUESTION_MAX_CHARS)) {
    return {
      ok: false,
      response: applyPublicRateLimitHeader(
        publicWorkBudgetExceeded(
          "question exceeds the public ask work budget",
          PUBLIC_ASK_QUESTION_MAX_CHARS,
        ),
        rateLimit,
      ),
    };
  }

  let effectiveRateLimit = rateLimit;
  if (publicAskUsesProvider(input.aiMode)) {
    const providerRateLimit = await checkPublicAskProviderAdmission(input.request, input.aiMode);
    const providerLimited = publicRateLimitResponse(providerRateLimit);
    if (providerLimited) return { ok: false, response: providerLimited };
    effectiveRateLimit = providerRateLimit;
  }

  let workLease;
  try {
    workLease = await acquirePublicAskWorkLease(input.aiMode);
  } catch (error) {
    log.error("public ask concurrency admission unavailable", {
      errorType: error instanceof Error ? error.name : typeof error,
    });
    return {
      ok: false,
      response: applyPublicRateLimitHeader(
        publicAskConcurrencyResponse(input.aiMode),
        effectiveRateLimit,
      ),
    };
  }
  if (!workLease) {
    return {
      ok: false,
      response: applyPublicRateLimitHeader(
        publicAskConcurrencyResponse(input.aiMode),
        effectiveRateLimit,
      ),
    };
  }

  try {
    const data = await runAsk(input.question, {
      aiMode: input.aiMode,
      harnessMemory: input.harnessMemory,
      signal: input.signal ?? input.request.signal,
    });
    return {
      ok: true,
      aiMode: input.aiMode,
      data,
      rateLimit: effectiveRateLimit,
      workUnit: workLease.weight,
    };
  } finally {
    await workLease.release();
  }
}
