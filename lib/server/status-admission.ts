import { withPublicSafetyReferenceStatusAdmission } from "@/lib/public-distributed-rate-limit";

export const PUBLIC_STATUS_OPERATION_DEADLINE_MS = 15_000;

class PublicStatusDeadlineError extends Error {
  constructor() {
    super("public status operation deadline exceeded");
    this.name = "PublicStatusDeadlineError";
  }
}

function errorResponse(status: number, code: string, error: string): Response {
  return new Response(JSON.stringify({ code, error }), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}

export async function withPublicStatusAdmission(
  request: Request,
  work: (signal: AbortSignal) => Promise<Response>,
  options: { deadlineMs?: number } = {},
): Promise<Response> {
  const controller = new AbortController();
  const abortFromRequest = (): void => controller.abort(request.signal.reason);
  if (request.signal.aborted) abortFromRequest();
  else request.signal.addEventListener("abort", abortFromRequest, { once: true });

  const deadlineError = new PublicStatusDeadlineError();
  const timer = setTimeout(
    () => controller.abort(deadlineError),
    options.deadlineMs ?? PUBLIC_STATUS_OPERATION_DEADLINE_MS,
  );

  try {
    return await withPublicSafetyReferenceStatusAdmission(request, async () => {
      try {
        controller.signal.throwIfAborted();
        return await work(controller.signal);
      } catch (error) {
        if (controller.signal.reason === deadlineError) {
          return errorResponse(504, "PUBLIC_STATUS_DEADLINE_EXCEEDED", deadlineError.message);
        }
        if (request.signal.aborted) {
          return errorResponse(499, "PUBLIC_STATUS_REQUEST_CANCELLED", "public status request was cancelled");
        }
        console.error("[public-status] operation failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        return errorResponse(502, "PUBLIC_STATUS_OPERATION_FAILED", "public status operation failed");
      }
    });
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abortFromRequest);
  }
}
