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

export async function enforceRequestBodyBudget(
  request: Request,
  maxBytes: number,
  error: RequestBodyBudgetError,
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

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel("Request body budget exceeded");
      return { ok: false, response: payloadTooLargeResponse(maxBytes, error) };
    }
    chunks.push(value);
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
