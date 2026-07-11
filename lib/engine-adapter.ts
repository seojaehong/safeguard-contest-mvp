import type { ClawChatEvent, ClawSiteProfile } from "@/lib/agent-loop";

export const ENGINE_TOOL_EFFECTS = ["read", "compute", "draft_write"] as const;

export type EngineToolEffect = (typeof ENGINE_TOOL_EFFECTS)[number];
export type EngineMode = "disabled" | "local-openclaw" | "relay";
export type EnvLike = Record<string, string | undefined>;

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
  readonly capabilities: readonly EngineToolEffect[];
  checkAvailability(context: BrokerRequestContext): Promise<void>;
  run(input: EngineRunInput): Promise<void>;
}

export type BrokerErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "AUTH_BACKEND_UNAVAILABLE"
  | "SITE_CONTEXT_REQUIRED"
  | "SITE_FORBIDDEN"
  | "ENGINE_UNAVAILABLE"
  | "ENGINE_RUNTIME_UNAVAILABLE"
  | "ENGINE_SITE_BINDING_UNPROVEN"
  | "ENGINE_BUSY"
  | "ENGINE_TIMEOUT"
  | "ENGINE_EXECUTION_FAILED";

const PUBLIC_MESSAGES: Record<BrokerErrorCode, string> = {
  AUTH_REQUIRED: "로그인이 필요합니다.",
  AUTH_INVALID: "로그인 세션이 유효하지 않습니다.",
  AUTH_BACKEND_UNAVAILABLE: "인증 서비스를 사용할 수 없습니다.",
  SITE_CONTEXT_REQUIRED: "현장 컨텍스트가 필요합니다.",
  SITE_FORBIDDEN: "이 현장에 접근할 수 없습니다.",
  ENGINE_UNAVAILABLE: "에이전트 엔진을 사용할 수 없습니다.",
  ENGINE_RUNTIME_UNAVAILABLE: "에이전트 실행 환경을 사용할 수 없습니다.",
  ENGINE_SITE_BINDING_UNPROVEN: "현장 연결을 확인할 수 없어 실행하지 않았습니다.",
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
  if (requested === "relay") return "relay";
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
    capabilities: ENGINE_TOOL_EFFECTS,
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

  return {
    id: adapter.id,
    capabilities: adapter.capabilities,
    checkAvailability: (context) => adapter.checkAvailability(context),
    async run(input): Promise<void> {
      if (active >= maxConcurrent) throw new BrokerError("ENGINE_BUSY", 503);
      active += 1;
      const controller = new AbortController();
      const abortFromCaller = (): void => controller.abort(input.signal.reason);
      input.signal.addEventListener("abort", abortFromCaller, { once: true });
      let timedOut = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;

      try {
        const timeoutPromise = new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            timedOut = true;
            const error = new BrokerError("ENGINE_TIMEOUT", 503);
            controller.abort(error);
            reject(error);
          }, timeoutMs);
        });
        await Promise.race([
          adapter.run({ ...input, signal: controller.signal }),
          timeoutPromise,
        ]);
      } catch (error) {
        if (timedOut) throw new BrokerError("ENGINE_TIMEOUT", 503, error);
        throw error;
      } finally {
        if (timeout) clearTimeout(timeout);
        input.signal.removeEventListener("abort", abortFromCaller);
        active -= 1;
      }
    },
  };
}

export type RelayAdapterConfig = {
  origin: string;
  allowedOrigins: string[];
  signingKeyId: string;
  maxTtlSeconds: number;
};

export type SignedRelayRequest = {
  payload: {
    userId: string;
    organizationId: string;
    siteId: string;
    capabilities: readonly EngineToolEffect[];
    issuedAt: string;
    expiresAt: string;
    nonce: string;
  };
  keyId: string;
  signature: string;
};

function httpsOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value ? url.origin : null;
  } catch {
    return null;
  }
}

export function parseRelayAdapterConfig(env: EnvLike): RelayAdapterConfig {
  const origin = httpsOrigin(env.SAFECLAW_RELAY_ORIGIN?.trim() ?? "");
  const allowedOrigins = (env.SAFECLAW_RELAY_ORIGIN_ALLOWLIST ?? "")
    .split(",")
    .map((value) => httpsOrigin(value.trim()))
    .filter((value): value is string => Boolean(value));
  const signingKeyId = env.SAFECLAW_RELAY_SIGNING_KEY_ID?.trim() ?? "";
  const requestedTtl = Number.parseInt(env.SAFECLAW_RELAY_MAX_TTL_SECONDS ?? "", 10);
  const maxTtlSeconds = Number.isFinite(requestedTtl) && requestedTtl > 0
    ? Math.min(requestedTtl, 60)
    : 60;

  if (!origin || !allowedOrigins.includes(origin) || !signingKeyId) {
    throw new Error("RELAY_CONFIG_INVALID");
  }
  return { origin, allowedOrigins, signingKeyId, maxTtlSeconds };
}
