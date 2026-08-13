import type { NextRequest } from "next/server";

import { getClientIp } from "@/lib/api-guard";
import {
  acquirePublicConcurrencyLease,
  applyPublicRateLimitHeader,
  checkPublicRateLimit,
  publicRateLimitResponse,
  type PublicRateLimitDecision,
} from "@/lib/public-distributed-rate-limit";
import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import {
  buildSystemPrompt,
  capHistory,
  parseHistory,
  sanitizeUserInput,
  type ClawChatEvent,
} from "@/lib/agent-loop";
import {
  BrokerError,
  createGuardedEngineAdapter,
  createUnavailableEngineAdapter,
  publicBrokerError,
  resolveEngineMode,
  type EngineAdapter,
  type EnvLike,
} from "@/lib/engine-adapter";
import {
  createLocalOpenClawAdapter,
  buildOpenClawChatPrompt,
} from "@/lib/openclaw-chat";
import {
  createExperimentalHermesAdapter,
  createRemoteHermesAdapter,
  type SafeClawHermesComposition,
} from "@/lib/hermes-engine-adapter";
import {
  createOpenClawHermesComposition,
  type OpenClawHermesRuntimeDependencies,
} from "@/lib/openclaw-hermes-runtime";
import type { ResolveBrokerContext } from "@/lib/openclaw-broker-auth";
import {
  createRemoteHermesComposition,
  type RemoteHermesRuntimeDependencies,
} from "@/lib/remote-hermes-runtime";
import { enforceRequestBodyBudget } from "@/lib/mcp-work-budget";

const log = createLogger("api/agent/chat");
export const AGENT_CHAT_REQUEST_BODY_MAX_BYTES = 64 * 1_024;
export const AGENT_CHAT_ADMISSION_POLICY = {
  authenticated: {
    limit: 5,
    namespace: "agent-chat-authenticated",
    windowMs: 60_000,
  },
  preAuth: {
    limit: 20,
    namespace: "agent-chat-pre-auth",
    windowMs: 60_000,
  },
  engine: {
    defaultConcurrency: 1,
    defaultTimeoutMs: 240_000,
    leaseBufferMs: 10_000,
    namespace: "agent-chat-engine-work",
  },
} as const;
export type AgentChatRouteDependencies = {
  resolveContext: ResolveBrokerContext;
  engine: EngineAdapter;
  preAuthLimiter?: ReturnType<typeof createRateLimiter>;
  authenticatedLimiter?: ReturnType<typeof createRateLimiter>;
};

export type ProductionEngineAdapterDependencies = {
  experimentalHermes?: SafeClawHermesComposition;
  openClawHermes?: OpenClawHermesRuntimeDependencies;
  remoteHermes?: Omit<RemoteHermesRuntimeDependencies, "env">;
};

function jsonError(error: BrokerError): Response {
  return new Response(JSON.stringify({ code: error.code, error: error.message }), {
    status: error.status,
    headers: { "Content-Type": "application/json" },
  });
}

function instanceDecision(limiter: RateLimiter, identifier: string): PublicRateLimitDecision {
  return {
    ...limiter.check(identifier),
    mode: "instance",
    reason: "instance_fallback",
  };
}

function agentChatEngineConcurrency(environment: EnvLike = process.env): number {
  const parsed = Number.parseInt(environment.OPENCLAW_MAX_CONCURRENT ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : AGENT_CHAT_ADMISSION_POLICY.engine.defaultConcurrency;
}

function agentChatEngineLeaseMs(environment: EnvLike = process.env): number {
  const configuredTimeoutMs = Number.parseInt(environment.OPENCLAW_CHAT_TIMEOUT_MS ?? "", 10);
  const timeoutMs = Number.isSafeInteger(configuredTimeoutMs) && configuredTimeoutMs > 0
    ? configuredTimeoutMs
    : AGENT_CHAT_ADMISSION_POLICY.engine.defaultTimeoutMs;
  return timeoutMs + AGENT_CHAT_ADMISSION_POLICY.engine.leaseBufferMs;
}

function agentChatConcurrencyResponse(): Response {
  return new Response(JSON.stringify({
    code: "AGENT_CHAT_CONCURRENCY_LIMIT",
    error: "에이전트 작업이 많습니다. 잠시 후 다시 시도해 주세요.",
    retryAfterSeconds: 1,
  }), {
    status: 503,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": "1",
    },
  });
}

export function createProductionEngineAdapter(
  env: EnvLike,
  dependencies: ProductionEngineAdapterDependencies = {},
): EngineAdapter {
  const mode = resolveEngineMode(env);
  let base: EngineAdapter;
  if (mode === "local-openclaw") {
    base = createLocalOpenClawAdapter({
      env,
      // Until a local attestation sidecar proves the profile credential's
      // mcp_tokens site/org binding, production local execution stays closed.
      verifySiteBinding: async () => false,
    });
  } else if (mode === "experimental-hermes") {
    const composition = dependencies.experimentalHermes
      ?? createOpenClawHermesComposition(env, dependencies.openClawHermes);
    base = composition
      ? createExperimentalHermesAdapter({ env, composition })
      : createUnavailableEngineAdapter();
  } else if (mode === "remote-hermes") {
    const composition = createRemoteHermesComposition({
      env,
      ...dependencies.remoteHermes,
    });
    base = composition
      ? createRemoteHermesAdapter({ env, composition })
      : createUnavailableEngineAdapter();
  } else {
    base = createUnavailableEngineAdapter();
  }
  const maxConcurrent = Number.parseInt(env.OPENCLAW_MAX_CONCURRENT ?? "", 10);
  const timeoutMs = Number.parseInt(env.OPENCLAW_CHAT_TIMEOUT_MS ?? "", 10);
  return createGuardedEngineAdapter(base, { maxConcurrent, timeoutMs });
}

export function createAgentChatPost(dependencies: AgentChatRouteDependencies) {
  const routePreAuthLimiter = dependencies.preAuthLimiter ?? createRateLimiter({ limit: 20, windowMs: 60_000 });
  const routeAuthenticatedLimiter = dependencies.authenticatedLimiter ?? createRateLimiter({ limit: 5, windowMs: 60_000 });
  return async function post(request: NextRequest): Promise<Response> {
    const preAuthDecision = dependencies.preAuthLimiter
      ? instanceDecision(routePreAuthLimiter, getClientIp(request))
      : await checkPublicRateLimit({
          request,
          namespace: AGENT_CHAT_ADMISSION_POLICY.preAuth.namespace,
          limit: AGENT_CHAT_ADMISSION_POLICY.preAuth.limit,
          windowMs: AGENT_CHAT_ADMISSION_POLICY.preAuth.windowMs,
          instanceLimiter: routePreAuthLimiter,
        });
    const coarseLimited = publicRateLimitResponse(preAuthDecision);
    if (coarseLimited) return coarseLimited;

    let authentication;
    try {
      authentication = await dependencies.resolveContext.authenticate(request);
    } catch (error) {
      const brokerError = error instanceof BrokerError
        ? error
        : new BrokerError("AUTH_BACKEND_UNAVAILABLE", 503, error);
      log.error("openclaw broker authentication failed", { code: brokerError.code });
      return applyPublicRateLimitHeader(jsonError(brokerError), preAuthDecision);
    }

    const authenticatedDecision = dependencies.authenticatedLimiter
      ? instanceDecision(routeAuthenticatedLimiter, authentication.user.id)
      : await checkPublicRateLimit({
          request,
          identifier: authentication.user.id,
          namespace: AGENT_CHAT_ADMISSION_POLICY.authenticated.namespace,
          limit: AGENT_CHAT_ADMISSION_POLICY.authenticated.limit,
          windowMs: AGENT_CHAT_ADMISSION_POLICY.authenticated.windowMs,
          instanceLimiter: routeAuthenticatedLimiter,
        });
    const limited = publicRateLimitResponse(authenticatedDecision);
    if (limited) return limited;

    const bodyBudget = await enforceRequestBodyBudget(request, AGENT_CHAT_REQUEST_BODY_MAX_BYTES, {
      code: "AGENT_CHAT_PAYLOAD_TOO_LARGE",
      error: `Agent chat request body exceeds the ${AGENT_CHAT_REQUEST_BODY_MAX_BYTES}-byte limit.`,
    });
    if (!bodyBudget.ok) return bodyBudget.response;

    const body = await bodyBudget.request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(new BrokerError("SITE_CONTEXT_REQUIRED", 400));
    }

    const parsed = body as { message?: unknown; history?: unknown; siteId?: unknown };
    const message = sanitizeUserInput(parsed.message);
    if (!message) {
      return new Response(JSON.stringify({ code: "MESSAGE_REQUIRED", error: "메시지를 입력해 주세요." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const requestedSiteId = typeof parsed.siteId === "string" ? parsed.siteId : null;

    let context;
    try {
      context = await dependencies.resolveContext.resolveOwnedSite(authentication, requestedSiteId);
    } catch (error) {
      const brokerError = error instanceof BrokerError
        ? error
        : new BrokerError("AUTH_BACKEND_UNAVAILABLE", 503, error);
      log.error("openclaw broker preflight failed", { code: brokerError.code });
      return jsonError(brokerError);
    }

    let distributedEngineRelease: (() => Promise<void>) | null | undefined;
    try {
      distributedEngineRelease = await acquirePublicConcurrencyLease({
        concurrency: agentChatEngineConcurrency(),
        leaseMs: agentChatEngineLeaseMs(),
        namespace: AGENT_CHAT_ADMISSION_POLICY.engine.namespace,
        requireDistributedInProduction: false,
      });
    } catch (error) {
      log.error("openclaw broker distributed engine admission unavailable", {
        error: error instanceof Error ? error.message : String(error),
      });
      return agentChatConcurrencyResponse();
    }
    if (distributedEngineRelease === null) return agentChatConcurrencyResponse();
    const releaseEngineLease = distributedEngineRelease ?? (async () => undefined);

    try {
      await dependencies.engine.checkAvailability(context, request.signal);
    } catch (error) {
      await releaseEngineLease();
      const brokerError = error instanceof BrokerError
        ? error
        : new BrokerError("ENGINE_UNAVAILABLE", 503, error);
      log.error("openclaw broker engine preflight failed", { code: brokerError.code });
      return jsonError(brokerError);
    }

    const history = capHistory(parseHistory(parsed.history));
    const systemPrompt = buildSystemPrompt(context.site);
    const prompt = buildOpenClawChatPrompt({ systemPrompt, history, message });
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        const emit = (event: ClawChatEvent): void => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch (error) {
            log.warn("SSE enqueue failed", { code: "SSE_ENQUEUE_FAILED" });
          }
        };
        try {
          emit({
            kind: "tool",
            name: "agent_engine",
            status: "start",
            label: "현장 연결을 확인하고 있습니다.",
          });
          await dependencies.engine.run({ context, prompt, emit, signal: request.signal });
          emit({
            kind: "tool",
            name: "agent_engine",
            status: "ok",
            label: "현장 연결 확인을 마쳤습니다.",
          });
          emit({ kind: "final" });
        } catch (error) {
          const brokerError = publicBrokerError(error);
          log.error("openclaw broker execution failed", { code: brokerError.code });
          emit({
            kind: "tool",
            name: "agent_engine",
            status: "fail",
            label: "에이전트 실행에 실패했습니다.",
          });
          emit({ kind: "error", code: brokerError.code, message: brokerError.message });
        } finally {
          await releaseEngineLease();
          controller.close();
        }
      },
      async cancel() {
        await releaseEngineLease();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  };
}
