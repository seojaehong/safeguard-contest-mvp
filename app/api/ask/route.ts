import { NextRequest, NextResponse } from "next/server";
import { runAsk } from "@/lib/search";
import type { AiMode } from "@/lib/ai-deliverables";
import { parseHarnessMemoryInput } from "@/lib/db-harness";
import { attachGenerationEvidence } from "@/lib/generation-evidence";
import { createLogger } from "@/lib/logger";
import { sanitizeAskResponsePublicSurface } from "@/lib/ask-public-surface";
import {
  isOverCharBudget,
  enforcePublicJsonRequestBodyBudget,
  publicWorkBudgetExceeded,
  PUBLIC_ASK_HARNESS_MEMORY_MAX_CHARS,
  PUBLIC_ASK_QUESTION_MAX_CHARS,
  PUBLIC_ASK_REQUEST_MAX_BYTES,
  serializedCharLength
} from "@/lib/public-work-budget";
import {
  acquirePublicAskWorkLease,
  applyPublicAskWorkHeaders,
  checkPublicAskAdmission,
  publicAskConcurrencyResponse,
  type PublicAskWorkLease,
} from "@/lib/public-ask-admission";
import { resolveRunAskMode } from "@/lib/run-ask-mode";
import {
  applyPublicRateLimitHeader,
  publicRateLimitResponse,
} from "@/lib/public-distributed-rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5min — Pro plan max; 7-way parallel Vertex calls need headroom

const ALLOWED_MODES: AiMode[] = ["template", "enhanced", "full"];
const log = createLogger("api/ask");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  const rateLimit = await checkPublicAskAdmission(request);
  const limited = publicRateLimitResponse(rateLimit);
  if (limited) return limited;
  const bodyBudget = await enforcePublicJsonRequestBodyBudget(
    request,
    PUBLIC_ASK_REQUEST_MAX_BYTES,
    "request body exceeds the public ask byte budget",
  );
  if (!bodyBudget.ok) return applyPublicRateLimitHeader(bodyBudget.response, rateLimit);
  const body: unknown = await bodyBudget.request.json().catch(() => ({}));
  const record = isRecord(body) ? body : {};
  const question = typeof record.question === "string" ? record.question : "산업안전 실무 질문";
  if (isOverCharBudget(question, PUBLIC_ASK_QUESTION_MAX_CHARS)) {
    return applyPublicRateLimitHeader(
      publicWorkBudgetExceeded("question exceeds the public ask work budget", PUBLIC_ASK_QUESTION_MAX_CHARS),
      rateLimit,
    );
  }
  if (record.harnessMemory !== undefined && serializedCharLength(record.harnessMemory) > PUBLIC_ASK_HARNESS_MEMORY_MAX_CHARS) {
    return applyPublicRateLimitHeader(
      publicWorkBudgetExceeded("harnessMemory exceeds the public ask work budget", PUBLIC_ASK_HARNESS_MEMORY_MAX_CHARS),
      rateLimit,
    );
  }
  const requestedMode = typeof record.aiMode === "string" ? (record.aiMode as AiMode) : undefined;
  const aiMode = resolveRunAskMode({
    requestedMode: requestedMode && ALLOWED_MODES.includes(requestedMode) ? requestedMode : undefined,
    envDefault: process.env.AI_MODE_DEFAULT,
  });
  const harnessMemory = parseHarnessMemoryInput(record.harnessMemory);
  let workLease: PublicAskWorkLease | null;
  try {
    workLease = await acquirePublicAskWorkLease(aiMode);
  } catch (error) {
    log.error("public ask concurrency admission unavailable", {
      errorType: error instanceof Error ? error.name : typeof error,
    });
    return applyPublicRateLimitHeader(publicAskConcurrencyResponse(aiMode), rateLimit);
  }
  if (!workLease) return applyPublicRateLimitHeader(publicAskConcurrencyResponse(aiMode), rateLimit);
  try {
    const result = await runAsk(question, { aiMode, harnessMemory, signal: request.signal });
    const sealed = attachGenerationEvidence(result, {
      secret: process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET,
      generatedAt: new Date().toISOString()
    });
    if (sealed.generationTrace) {
      log.info("safeclaw_generation_trace", {
        event: "safeclaw_generation_trace",
        traceId: sealed.generationTrace.traceId,
        askMode: sealed.generationTrace.askMode,
        answerProvider: sealed.generationTrace.answer.provider,
        answerModel: sealed.generationTrace.answer.model,
        answerComposition: sealed.generationTrace.answer.composition,
        answerUpstreamProvider: sealed.generationTrace.answer.upstream?.provider,
        answerUpstreamModel: sealed.generationTrace.answer.upstream?.model,
        deliverablesAttempted: sealed.generationTrace.deliverables.attempted,
        deliverablesProvider: sealed.generationTrace.deliverables.provider,
        modelPerDocument: sealed.generationTrace.deliverables.modelPerDocument,
        fallbackUsed: sealed.generationTrace.fallbackUsed,
        evidenceSealed: Boolean(sealed.generationEvidence)
      });
    }
    return applyPublicAskWorkHeaders(applyPublicRateLimitHeader(
      NextResponse.json(sanitizeAskResponsePublicSurface(sealed)),
      rateLimit,
    ), aiMode, workLease.weight);
  } finally {
    await workLease.release();
  }
}
