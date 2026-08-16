export const MCP_GENERATION_QUESTION_MAX_CHARS = 4_000;
export const MCP_TASK_MAX_CHARS = 256;
export const MCP_REGION_MAX_CHARS = 120;
export const MCP_DOCUMENT_TEXT_MAX_CHARS = 20_000;
export const MCP_SEARCH_QUERY_MAX_CHARS = 1_000;
export const MCP_DOC_TYPE_MAX_CHARS = 128;
export const MCP_REQUEST_BODY_MAX_BYTES = 96 * 1_024;
export const MCP_TOKEN_REQUEST_BODY_MAX_BYTES = 8 * 1_024;

export type McpRequestBodyBudgetResult =
  | { ok: true; request: Request }
  | { ok: false; response: Response };

type RequestBodyBudgetError = {
  code: string;
  error: string;
};

type RequestBodyBudgetOptions = {
  timeoutMs?: number;
  timeoutError?: RequestBodyBudgetError;
};

function payloadTooLargeResponse(maxBytes: number, error: RequestBodyBudgetError): Response {
  return Response.json(
    {
      code: error.code,
      error: error.error,
      limit: maxBytes,
    },
    { status: 413 },
  );
}

function bodyReadTimeoutResponse(timeoutMs: number, error: RequestBodyBudgetError): Response {
  return Response.json(
    {
      code: error.code,
      error: error.error,
      limit: timeoutMs,
    },
    { status: 408 },
  );
}

export async function enforceRequestBodyBudget(
  request: Request,
  maxBytes: number,
  error: RequestBodyBudgetError,
  options: RequestBodyBudgetOptions = {},
): Promise<McpRequestBodyBudgetResult> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/u.test(contentLength)) {
    const declaredBytes = Number(contentLength);
    if (Number.isSafeInteger(declaredBytes) && declaredBytes > maxBytes) {
      return { ok: false, response: payloadTooLargeResponse(maxBytes, error) };
    }
  }

  if (!request.body) return { ok: true, request };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const controller = new AbortController();
  const timeoutError = options.timeoutMs
    ? new Error(`Request body read timeout after ${options.timeoutMs}ms`)
    : undefined;
  const abortFromCaller = () => controller.abort(request.signal.reason);
  if (request.signal.aborted) abortFromCaller();
  else request.signal.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = options.timeoutMs
    ? setTimeout(() => controller.abort(timeoutError), options.timeoutMs)
    : undefined;
  const abortRead = () => {
    void reader.cancel(controller.signal.reason).catch(() => undefined);
  };
  controller.signal.addEventListener("abort", abortRead, { once: true });
  const aborted = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
  });

  try {
    while (true) {
      controller.signal.throwIfAborted();
      const { done, value } = await Promise.race([reader.read(), aborted]);
      controller.signal.throwIfAborted();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("Request body budget exceeded");
        return { ok: false, response: payloadTooLargeResponse(maxBytes, error) };
      }
      chunks.push(value);
    }
  } catch (readError) {
    await reader.cancel(readError).catch(() => undefined);
    if (timeoutError && readError === timeoutError && options.timeoutError && options.timeoutMs) {
      return { ok: false, response: bodyReadTimeoutResponse(options.timeoutMs, options.timeoutError) };
    }
    throw readError;
  } finally {
    if (timeout) clearTimeout(timeout);
    request.signal.removeEventListener("abort", abortFromCaller);
    controller.signal.removeEventListener("abort", abortRead);
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    ok: true,
    request: new Request(request, { body }),
  };
}

export async function enforceMcpRequestBodyBudget(
  request: Request,
  maxBytes = MCP_REQUEST_BODY_MAX_BYTES,
): Promise<McpRequestBodyBudgetResult> {
  return enforceRequestBodyBudget(request, maxBytes, {
    code: "MCP_PAYLOAD_TOO_LARGE",
    error: `MCP request body exceeds the ${maxBytes}-byte limit.`,
  });
}
