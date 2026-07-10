import { NextRequest, NextResponse } from "next/server";
import { runAsk } from "@/lib/search";
import type { AiMode } from "@/lib/ai-deliverables";
import { createRateLimiter } from "@/lib/rate-limit";
import { enforceRateLimit } from "@/lib/api-guard";
import { parseHarnessMemoryInput } from "@/lib/db-harness";
import { attachGenerationEvidence } from "@/lib/generation-evidence";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5min — Pro plan max; 7-way parallel Vertex calls need headroom

const ALLOWED_MODES: AiMode[] = ["template", "enhanced", "full"];
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
const log = createLogger("api/ask");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, limiter);
  if (limited) return limited;
  const body: unknown = await request.json().catch(() => ({}));
  const record = isRecord(body) ? body : {};
  const question = typeof record.question === "string" ? record.question : "산업안전 실무 질문";
  const requestedMode = typeof record.aiMode === "string" ? (record.aiMode as AiMode) : undefined;
  const aiMode = requestedMode && ALLOWED_MODES.includes(requestedMode) ? requestedMode : undefined;
  const harnessMemory = parseHarnessMemoryInput(record.harnessMemory);
  const result = await runAsk(question, { aiMode, harnessMemory });
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
      deliverablesAttempted: sealed.generationTrace.deliverables.attempted,
      deliverablesProvider: sealed.generationTrace.deliverables.provider,
      modelPerDocument: sealed.generationTrace.deliverables.modelPerDocument,
      fallbackUsed: sealed.generationTrace.fallbackUsed,
      evidenceSealed: Boolean(sealed.generationEvidence)
    });
  }
  return NextResponse.json(sealed);
}
