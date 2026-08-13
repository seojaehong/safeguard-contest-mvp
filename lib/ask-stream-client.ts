// Client-side consumer for /api/ask/stream (Task D-2b). Not unit tested directly
// (fetch/ReadableStream network plumbing) — parseSseChunk, the pure part, is
// tested in tests/sse-client.test.ts. This helper is exercised via typecheck/build
// and dev-server runtime verification per the task brief.

import { parseSseChunk } from "@/lib/sse-client";
import type { AskProgressEvent } from "@/lib/ask-progress";
import type { HarnessMemoryInput } from "@/lib/db-harness";

export type AskStreamRequest = {
  question: string;
  aiMode?: string;
  harnessMemory?: HarnessMemoryInput;
};

export class AskStreamHttpError extends Error {
  readonly code: string | null;
  readonly status: number;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "AskStreamHttpError";
    this.code = code;
    this.status = status;
  }
}

export function shouldRetryAskViaLegacy(error: unknown): boolean {
  return !(error instanceof AskStreamHttpError);
}

/**
 * Fetches /api/ask/stream, calling `onEvent` for every parsed SSE frame, and
 * resolves with the `final` event's payload. Throws (never resolves) if the
 * response isn't ok, the body is missing, or the stream ends without ever
 * emitting a `final` event. Callers may retry only non-HTTP transport failures.
 */
export async function fetchAskStream(
  request: AskStreamRequest,
  onEvent: (event: AskProgressEvent) => void,
  signal?: AbortSignal
): Promise<unknown> {
  const response = await fetch("/api/ask/stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    signal
  });

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const body = typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};
    const message = typeof body.error === "string"
      ? body.error
      : `문서팩 스트림 요청 실패: HTTP ${response.status}`;
    throw new AskStreamHttpError(
      message,
      response.status,
      typeof body.code === "string" ? body.code : null,
    );
  }
  if (!response.body) {
    throw new Error("문서팩 스트림 응답 본문을 확인할 수 없습니다.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload: unknown;
  let sawFinal = false;
  let streamErrorMessage: string | null = null;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const { events, rest } = parseSseChunk(buffer, chunk);
    buffer = rest;
    for (const event of events) {
      onEvent(event);
      if (event.kind === "final") {
        finalPayload = event.payload;
        sawFinal = true;
      } else if (event.kind === "error") {
        streamErrorMessage = event.message;
      }
    }
  }

  if (sawFinal) return finalPayload;
  throw new Error(streamErrorMessage || "문서팩 스트림이 완료 이벤트 없이 종료되었습니다.");
}
