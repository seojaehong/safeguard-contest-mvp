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

function windowsDescendantPids(rootPid) {
  const wmic = `${process.env.SystemRoot || "C:\\Windows"}\\System32\\Wbem\\WMIC.exe`;
  const result = childProcess.spawnSync(wmic, ["process", "get", "ParentProcessId,ProcessId", "/format:csv"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    timeout: 5_000,
    windowsHide: true,
  });
  if (result.status !== 0) return [];
  const childrenByParent = new Map();
  for (const line of result.stdout.split(/\r?\n/u)) {
    const columns = line.trim().split(",");
    if (columns.length < 3) continue;
    const parentPid = Number.parseInt(columns.at(-2), 10);
    const pid = Number.parseInt(columns.at(-1), 10);
    if (!Number.isInteger(parentPid) || !Number.isInteger(pid) || pid <= 0) continue;
    const children = childrenByParent.get(parentPid) || [];
    children.push(pid);
    childrenByParent.set(parentPid, children);
  }
  const descendants = [];
  const pending = [rootPid];
  while (pending.length) {
    const parentPid = pending.shift();
    for (const pid of childrenByParent.get(parentPid) || []) {
      descendants.push(pid);
      pending.push(pid);
    }
  }
  return descendants;
}

function taskkill(pid, includeTree) {
  const executable = `${process.env.SystemRoot || "C:\\Windows"}\\System32\\taskkill.exe`;
  return childProcess.spawnSync(executable, ["/PID", String(pid), ...(includeTree ? ["/T"] : []), "/F"], {
    stdio: "ignore",
    timeout: 5_000,
    windowsHide: true,
  });
}

function terminateProcessTree(child) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    const descendantsBeforeRootKill = windowsDescendantPids(child.pid);
    try {
      process.kill(child.pid, "SIGKILL");
    } catch {}
    const descendantsAfterRootKill = windowsDescendantPids(child.pid);
    const descendants = [...new Set([...descendantsBeforeRootKill, ...descendantsAfterRootKill])];
    let descendantKillFailed = false;
    for (const pid of descendants.reverse()) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        descendantKillFailed = true;
      }
    }
    if (!descendants.length || descendantKillFailed) taskkill(child.pid, true);
    return;
  }
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

export function spawnWithBudget(command, args, options = {}, budget = {}) {
  const timeoutMs = budget.timeoutMs ?? DEFAULT_SMOKE_PROCESS_TIMEOUT_MS;
  const maxBufferBytes = budget.maxBufferBytes ?? DEFAULT_SMOKE_PROCESS_MAX_BUFFER_BYTES;
  const onStdout = budget.onStdout;
  const onStderr = budget.onStderr;

  return new Promise((resolve) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    let totalBytes = 0;
    let budgetError = null;
    let spawnError = null;
    let closed = false;
    const child = childProcess.spawn(command, args, {
      ...options,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const terminate = (error) => {
      if (budgetError) return;
      budgetError = error;
      terminateProcessTree(child);
    };
    const capture = (chunks, callback, value) => {
      const chunk = Buffer.from(value);
      const remaining = Math.max(0, maxBufferBytes - totalBytes);
      const accepted = chunk.subarray(0, remaining);
      if (accepted.length) {
        chunks.push(accepted);
        totalBytes += accepted.length;
        callback?.(accepted);
      }
      if (accepted.length !== chunk.length) {
        terminate(new OperatorSmokeBudgetError(
          "SMOKE_PROCESS_OUTPUT_BUDGET_EXCEEDED",
          `operator smoke process output exceeds ${maxBufferBytes} bytes`,
        ));
      }
    };

    child.stdout.on("data", (value) => capture(stdoutChunks, onStdout, value));
    child.stderr.on("data", (value) => capture(stderrChunks, onStderr, value));
    child.on("error", (error) => {
      spawnError = error;
    });

    const timer = setTimeout(() => {
      terminate(new OperatorSmokeBudgetError(
        "SMOKE_PROCESS_TIMEOUT",
        `operator smoke process exceeded ${timeoutMs}ms`,
      ));
    }, timeoutMs);

    child.on("close", (status, signal) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      resolve({
        status: budgetError ? null : status,
        signal,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        error: budgetError || spawnError,
      });
    });
  });
}
