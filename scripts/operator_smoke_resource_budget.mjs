import childProcess from "node:child_process";

export const DEFAULT_SMOKE_HTTP_TIMEOUT_MS = 30_000;
export const DEFAULT_SMOKE_RESPONSE_MAX_BYTES = 8 * 1024 * 1024;
export const DEFAULT_SMOKE_PROCESS_TIMEOUT_MS = 180_000;
export const DEFAULT_SMOKE_PROCESS_MAX_BUFFER_BYTES = 8 * 1024 * 1024;

export class OperatorSmokeBudgetError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "OperatorSmokeBudgetError";
    this.code = code;
  }
}

export function readBoundedPositiveInteger(value, fallback, { min = 1, max } = {}) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return typeof max === "number" ? Math.min(parsed, max) : parsed;
}

function responseBudgetError(maxBytes) {
  return new OperatorSmokeBudgetError(
    "SMOKE_RESPONSE_BUDGET_EXCEEDED",
    `operator smoke response exceeds ${maxBytes} bytes`,
  );
}

export async function fetchBufferWithBudget(url, init = {}, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_SMOKE_HTTP_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_SMOKE_RESPONSE_MAX_BYTES;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutController = new AbortController();
  const upstreamSignal = init.signal;
  const forwardAbort = () => timeoutController.abort(upstreamSignal?.reason);
  if (upstreamSignal) {
    upstreamSignal.throwIfAborted();
    upstreamSignal.addEventListener("abort", forwardAbort, { once: true });
  }
  const timer = setTimeout(() => {
    timeoutController.abort(new OperatorSmokeBudgetError(
      "SMOKE_REQUEST_TIMEOUT",
      `operator smoke request exceeded ${timeoutMs}ms`,
    ));
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, { ...init, signal: timeoutController.signal });
    const declaredLength = Number.parseInt(response.headers.get("content-length") || "", 10);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      await response.body?.cancel(responseBudgetError(maxBytes));
      throw responseBudgetError(maxBytes);
    }
    if (!response.body) {
      return { response, buffer: Buffer.alloc(0) };
    }

    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel(responseBudgetError(maxBytes));
          throw responseBudgetError(maxBytes);
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    return { response, buffer: Buffer.concat(chunks, totalBytes) };
  } catch (error) {
    if (timeoutController.signal.aborted && timeoutController.signal.reason instanceof OperatorSmokeBudgetError) {
      throw timeoutController.signal.reason;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    upstreamSignal?.removeEventListener("abort", forwardAbort);
  }
}

export function spawnSyncWithBudget(command, args, options = {}, budget = {}) {
  return childProcess.spawnSync(command, args, {
    ...options,
    timeout: budget.timeoutMs ?? DEFAULT_SMOKE_PROCESS_TIMEOUT_MS,
    maxBuffer: budget.maxBufferBytes ?? DEFAULT_SMOKE_PROCESS_MAX_BUFFER_BYTES,
    killSignal: "SIGKILL",
    windowsHide: true,
  });
}
