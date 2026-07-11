// SSE progress events for the streaming /api/ask/stream route (Task D-2a).
//
// Kept as a pure module (types + formatter + a promise-listener helper) so it can be
// unit tested without touching the network/AI call sites. runAsk / ai-deliverables call
// these via an injected onProgress callback that defaults to a no-op — existing callers
// of runAsk / generateAllDeliverablesWithDiagnostics are unaffected.

export const ASK_STAGE_FAILURE_CODE = "ask_stage_failed" as const;
export const ASK_STAGE_FAILURE_MESSAGE = "이 단계를 완료하지 못했습니다. 다음 단계는 계속 진행합니다.";

export type AskStageEvent = {
  kind: "stage";
  stage: string;
  status: "start" | "ok" | "fail";
  code?: typeof ASK_STAGE_FAILURE_CODE;
  detail?: string;
};

export type AskDocEvent = {
  kind: "doc";
  name: string;
  status: "ok" | "fail";
};

export type AskFinalEvent = {
  kind: "final";
  payload: unknown;
};

export type AskErrorEvent = {
  kind: "error";
  message: string;
};

export type AskProgressEvent = AskStageEvent | AskDocEvent | AskFinalEvent | AskErrorEvent;

export type OnAskProgress = (event: AskProgressEvent) => void;

/** No-op default so runAsk/generateAllDeliverablesWithDiagnostics callers need not opt in. */
export const noopOnProgress: OnAskProgress = () => {};

/**
 * Formats one SSE frame: "data: {json}\n\n". Newline-delimited per the SSE spec —
 * the route writes this string directly to the ReadableStream controller.
 */
export function formatSseEvent(event: AskProgressEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Wraps onProgress so a throwing listener can never break the caller (design doc §3:
 * "onProgress 콜백 내부 예외가 생성 파이프라인을 죽이면 안 됨").
 */
export function safeEmit(onProgress: OnAskProgress | undefined, event: AskProgressEvent): void {
  if (!onProgress) return;
  try {
    onProgress(event);
  } catch {
    // Swallow — progress reporting must never affect the underlying pipeline.
  }
}

/**
 * Attaches ok/fail listeners to a batch of named promises without altering their
 * resolution — the original promises are returned untouched (still safe to pass into
 * Promise.allSettled). Emits a "start" stage event immediately for each, then "ok"/"fail"
 * as each promise settles (order of settlement, not array order).
 */
export function attachProgressListeners(
  promises: Array<{ stage: string; promise: Promise<unknown> }>,
  onProgress: OnAskProgress | undefined
): void {
  if (!onProgress) return;
  for (const { stage, promise } of promises) {
    safeEmit(onProgress, { kind: "stage", stage, status: "start" });
    promise.then(
      () => safeEmit(onProgress, { kind: "stage", stage, status: "ok" }),
      () =>
        safeEmit(onProgress, {
          kind: "stage",
          stage,
          status: "fail",
          code: ASK_STAGE_FAILURE_CODE,
          detail: ASK_STAGE_FAILURE_MESSAGE
        })
    );
  }
}
