import { NextRequest, NextResponse } from "next/server";
import type { AiMode } from "@/lib/ai-deliverables";
import { parseHarnessMemoryInput } from "@/lib/db-harness";
import { attachGenerationEvidence } from "@/lib/generation-evidence";
import { createLogger } from "@/lib/logger";
import { sanitizeAskResponsePublicSurface } from "@/lib/ask-public-surface";
import {
  enforcePublicJsonRequestBodyBudget,
  publicWorkBudgetExceeded,
  PUBLIC_ASK_HARNESS_MEMORY_MAX_CHARS,
  PUBLIC_ASK_REQUEST_MAX_BYTES,
  serializedCharLength
} from "@/lib/public-work-budget";
import { applyPublicAskWorkHeaders } from "@/lib/public-ask-admission";
import { runPublicAskOperation } from "@/lib/public-ask-operation";
import { resolveRunAskMode } from "@/lib/run-ask-mode";
import {
  applyPublicRateLimitHeader,
} from "@/lib/public-distributed-rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5min — Pro plan max; 7-way parallel Vertex calls need headroom

const ALLOWED_MODES: AiMode[] = ["template", "enhanced", "full"];
const log = createLogger("api/ask");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  const bodyBudget = await enforcePublicJsonRequestBodyBudget(
    request,
    PUBLIC_ASK_REQUEST_MAX_BYTES,
    "request body exceeds the public ask byte budget",
  );
  if (!bodyBudget.ok) return bodyBudget.response;
  const body: unknown = await bodyBudget.request.json().catch(() => ({}));
  const record = isRecord(body) ? body : {};
  const question = typeof record.question === "string" ? record.question : "산업안전 실무 질문";
  if (record.harnessMemory !== undefined && serializedCharLength(record.harnessMemory) > PUBLIC_ASK_HARNESS_MEMORY_MAX_CHARS) {
    return publicWorkBudgetExceeded("harnessMemory exceeds the public ask work budget", PUBLIC_ASK_HARNESS_MEMORY_MAX_CHARS);
  }
  const requestedMode = typeof record.aiMode === "string" ? (record.aiMode as AiMode) : undefined;
  const aiMode = resolveRunAskMode({
    requestedMode: requestedMode && ALLOWED_MODES.includes(requestedMode) ? requestedMode : undefined,
    envDefault: process.env.AI_MODE_DEFAULT,
  });
  const harnessMemory = parseHarnessMemoryInput(record.harnessMemory);
  const operation = await runPublicAskOperation({ request, question, aiMode, harnessMemory });
  if (!operation.ok) return operation.response;
  const result = operation.data;
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
    operation.rateLimit,
  ), aiMode, operation.workUnit);
}
