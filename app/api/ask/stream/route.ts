import { NextRequest } from "next/server";
import { runAsk } from "@/lib/search";
import type { AiMode } from "@/lib/ai-deliverables";
import { createRateLimiter } from "@/lib/rate-limit";
import { enforceRateLimit } from "@/lib/api-guard";
import { formatSseEvent, type AskProgressEvent } from "@/lib/ask-progress";
import { createLogger } from "@/lib/logger";
import { parseHarnessMemoryInput } from "@/lib/db-harness";

// Task D-2a: streaming twin of /api/ask (app/api/ask/route.ts is untouched — demo
// stability). Same request body, but responds with an SSE stream of stage/doc progress
// events followed by a final event carrying the same AskResponse payload /api/ask returns.
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5min — same budget as /api/ask; full-mode generation is ~120s

const log = createLogger("api/ask/stream");
const ALLOWED_MODES: AiMode[] = ["template", "enhanced", "full"];
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: AskProgressEvent) => {
        try {
          controller.enqueue(encoder.encode(formatSseEvent(event)));
        } catch (error) {
          // Connection likely closed client-side; nothing further to do.
          log.warn("SSE enqueue failed (client likely disconnected)", error);
        }
      };
      try {
        const payload = await runAsk(question, { aiMode, harnessMemory, onProgress: emit });
        emit({ kind: "final", payload });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error("runAsk failed in stream route", error);
        emit({ kind: "error", message });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
