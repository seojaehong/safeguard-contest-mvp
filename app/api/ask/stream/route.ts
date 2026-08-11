import { NextRequest } from "next/server";
import { runAsk } from "@/lib/search";
import type { AiMode } from "@/lib/ai-deliverables";
import { formatSseEvent, type AskProgressEvent } from "@/lib/ask-progress";
import { createLogger } from "@/lib/logger";
import { parseHarnessMemoryInput } from "@/lib/db-harness";
import { attachGenerationEvidence } from "@/lib/generation-evidence";
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

// Task D-2a: streaming twin of /api/ask. Same request body, but responds with an SSE stream of stage/doc progress
// events followed by a final event carrying the same AskResponse payload /api/ask returns.
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5min — same budget as /api/ask; full-mode generation is ~120s

const log = createLogger("api/ask/stream");
const ALLOWED_MODES: AiMode[] = ["template", "enhanced", "full"];

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

  const workController = new AbortController();
  const abortWork = () => workController.abort(request.signal.reason);
  if (request.signal.aborted) abortWork();
  else request.signal.addEventListener("abort", abortWork, { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: AskProgressEvent) => {
        try {
          controller.enqueue(encoder.encode(formatSseEvent(event)));
        } catch (error) {
          if (!workController.signal.aborted) workController.abort(error);
          log.warn("SSE enqueue failed (client likely disconnected)", {
            errorType: error instanceof Error ? error.name : typeof error
          });
        }
      };
      try {
        const payload = await runAsk(question, {
          aiMode,
          harnessMemory,
          onProgress: emit,
          signal: workController.signal,
        });
        const sealed = attachGenerationEvidence(payload, {
          secret: process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET,
          generatedAt: new Date().toISOString()
        });
        emit({ kind: "final", payload: sanitizeAskResponsePublicSurface(sealed) });
      } catch (error) {
        if (!workController.signal.aborted) {
          log.error("runAsk failed in stream route", {
            errorType: error instanceof Error ? error.name : typeof error
          });
          emit({ kind: "error", message: "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." });
        }
      } finally {
        request.signal.removeEventListener("abort", abortWork);
        try {
          controller.close();
        } catch {
          // The consumer may already have cancelled the stream.
        }
        await workLease.release();
      }
    },
    cancel(reason) {
      if (!workController.signal.aborted) workController.abort(reason);
      request.signal.removeEventListener("abort", abortWork);
      void workLease.release();
    },
  });

  return applyPublicAskWorkHeaders(applyPublicRateLimitHeader(new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  }), rateLimit), aiMode, workLease.weight);
}
