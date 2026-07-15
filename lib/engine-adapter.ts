import type { ClawChatEvent, ClawSiteProfile } from "@/lib/agent-loop";

export type EngineMode = "disabled" | "local-openclaw" | "experimental-hermes";
export type EnvLike = Record<string, string | undefined>;
export const ENGINE_ADAPTER_CONTRACT_VERSION = "engine-adapter/v1" as const;

export type EngineRuntime = "unavailable" | "openclaw" | "hermes";
export type EngineCapability = "stream_text" | "request_read_tool";

export type EngineAuthority = {
  readonly systemOfRecord: "safeclaw-mcp-db-harness";
  readonly toolExecutionBoundary: "safeclaw-mcp-interceptor";
  readonly canMutate: false;
  readonly canPublish: false;
  readonly humanConfirmationRequired: true;
};

export const SAFECLAW_ENGINE_AUTHORITY: EngineAuthority = Object.freeze({
  systemOfRecord: "safeclaw-mcp-db-harness",
  toolExecutionBoundary: "safeclaw-mcp-interceptor",
  canMutate: false,
  canPublish: false,
  humanConfirmationRequired: true,
});

export type BrokerRequestContext = {
  userId: string;
  organizationId: string;
  siteId: string;
  site: ClawSiteProfile;
};

export type EngineRunInput = {
  context: BrokerRequestContext;
  prompt: string;
  emit: (event: ClawChatEvent) => void;
  signal: AbortSignal;
};

export interface EngineAdapter {
  readonly id: string;
  readonly contractVersion: typeof ENGINE_ADAPTER_CONTRACT_VERSION;
  readonly runtime: EngineRuntime;
  readonly authority: EngineAuthority;
  readonly capabilities: readonly EngineCapability[];
  checkAvailability(context: BrokerRequestContext, signal?: AbortSignal): Promise<void>;
  run(input: EngineRunInput): Promise<void>;
}

export type BrokerErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "AUTH_BACKEND_UNAVAILABLE"
  | "SITE_CONTEXT_REQUIRED"
  | "SITE_FORBIDDEN"
  | "SITE_BACKEND_UNAVAILABLE"
  | "ENGINE_UNAVAILABLE"
  | "ENGINE_RUNTIME_UNAVAILABLE"
  | "ENGINE_SITE_BINDING_UNPROVEN"
  | "ENGINE_EXECUTION_ATTESTATION_UNPROVEN"
  | "ENGINE_TOOL_FORBIDDEN"
  | "ENGINE_BUSY"
  | "ENGINE_TIMEOUT"
  | "ENGINE_EXECUTION_FAILED";

const PUBLIC_MESSAGES: Record<BrokerErrorCode, string> = {
  AUTH_REQUIRED: "로그인이 필요합니다.",
  AUTH_INVALID: "로그인 세션이 유효하지 않습니다.",
  AUTH_BACKEND_UNAVAILABLE: "인증 서비스를 사용할 수 없습니다.",
  SITE_CONTEXT_REQUIRED: "현장 컨텍스트가 필요합니다.",
  SITE_FORBIDDEN: "이 현장에 접근할 수 없습니다.",
  SITE_BACKEND_UNAVAILABLE: "현장 정보를 확인할 수 없습니다.",
  ENGINE_UNAVAILABLE: "에이전트 엔진을 사용할 수 없습니다.",
  ENGINE_RUNTIME_UNAVAILABLE: "에이전트 실행 환경을 사용할 수 없습니다.",
  ENGINE_SITE_BINDING_UNPROVEN: "현장 연결을 확인할 수 없어 실행하지 않았습니다.",
  ENGINE_EXECUTION_ATTESTATION_UNPROVEN: "실행 권한을 확인할 수 없어 실행하지 않았습니다.",
  ENGINE_TOOL_FORBIDDEN: "에이전트 엔진에 허용되지 않은 도구 요청입니다.",
  ENGINE_BUSY: "에이전트가 다른 요청을 처리 중입니다.",
  ENGINE_TIMEOUT: "에이전트 실행 시간이 초과되었습니다.",
  ENGINE_EXECUTION_FAILED: "에이전트 실행에 실패했습니다.",
};

export class BrokerError extends Error {
  readonly code: BrokerErrorCode;
  readonly status: number;

  constructor(code: BrokerErrorCode, status: number, cause?: unknown) {
    super(PUBLIC_MESSAGES[code], { cause });
    this.name = "BrokerError";
    this.code = code;
    this.status = status;
  }
}

export function publicBrokerError(error: unknown): BrokerError {
  return error instanceof BrokerError
    ? error
    : new BrokerError("ENGINE_EXECUTION_FAILED", 500, error);
}

export function resolveEngineMode(env: EnvLike): EngineMode {
  const requested = env.SAFECLAW_ENGINE_MODE?.trim();
  if (requested === "local-openclaw") {
    return env.VERCEL ? "disabled" : "local-openclaw";
  }
  if (requested === "experimental-hermes") {
    return env.VERCEL || env.SAFECLAW_HERMES_LOCAL_POC !== "1"
      ? "disabled"
      : "experimental-hermes";
  }
  return "disabled";
}

export function createUnavailableEngineAdapter(
  code: Extract<BrokerErrorCode, "ENGINE_UNAVAILABLE" | "ENGINE_SITE_BINDING_UNPROVEN"> = "ENGINE_UNAVAILABLE",
): EngineAdapter {
  const unavailable = async (): Promise<never> => {
    throw new BrokerError(code, 503);
  };
  return {
    id: "unavailable",
    contractVersion: ENGINE_ADAPTER_CONTRACT_VERSION,
    runtime: "unavailable",
    authority: SAFECLAW_ENGINE_AUTHORITY,
    capabilities: [],
    checkAvailability: unavailable,
    run: unavailable,
  };
}

function positiveInt(value: number, fallback: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function createGuardedEngineAdapter(
  adapter: EngineAdapter,
  options: { maxConcurrent?: number; timeoutMs?: number } = {},
): EngineAdapter {
  const maxConcurrent = positiveInt(options.maxConcurrent ?? 1, 1);
  const timeoutMs = positiveInt(options.timeoutMs ?? 240_000, 240_000);
  let active = 0;

  async function runInSlot(
    callerSignal: AbortSignal | undefined,
    operation: (signal: AbortSignal) => Promise<void>,
  ): Promise<void> {
    if (callerSignal?.aborted) {
      throw callerSignal.reason instanceof BrokerError
        ? callerSignal.reason
        : new BrokerError("ENGINE_EXECUTION_FAILED", 500, callerSignal.reason);
    }
    if (active >= maxConcurrent) throw new BrokerError("ENGINE_BUSY", 503);
    active += 1;
    const controller = new AbortController();
    const abortFromCaller = (): void => controller.abort(callerSignal?.reason);
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let timeoutError: BrokerError | null = null;

    try {
      timeout = setTimeout(() => {
        timeoutError = new BrokerError("ENGINE_TIMEOUT", 503);
        controller.abort(timeoutError);
      }, timeoutMs);
      await operation(controller.signal);
      if (timeoutError) throw timeoutError;
    } catch (error) {
      if (timeoutError) throw timeoutError;
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
      callerSignal?.removeEventListener("abort", abortFromCaller);
      active -= 1;
    }
  }

  return {
    id: adapter.id,
    contractVersion: adapter.contractVersion,
    runtime: adapter.runtime,
    authority: adapter.authority,
    capabilities: adapter.capabilities,
    checkAvailability: (context, signal) => runInSlot(
      signal,
      (guardedSignal) => adapter.checkAvailability(context, guardedSignal),
    ),
    async run(input): Promise<void> {
      await runInSlot(
        input.signal,
        (guardedSignal) => adapter.run({ ...input, signal: guardedSignal }),
      );
    },
  };
}
