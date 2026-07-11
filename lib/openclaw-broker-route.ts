import type { NextRequest } from "next/server";

import { createRateLimiter } from "@/lib/rate-limit";
import { enforceRateLimit } from "@/lib/api-guard";
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
import type { ResolveBrokerContext } from "@/lib/openclaw-broker-auth";

const log = createLogger("api/agent/chat");
export type AgentChatRouteDependencies = {
  resolveContext: ResolveBrokerContext;
  engine: EngineAdapter;
  preAuthLimiter?: ReturnType<typeof createRateLimiter>;
  authenticatedLimiter?: ReturnType<typeof createRateLimiter>;
};

function jsonError(error: BrokerError): Response {
  return new Response(JSON.stringify({ code: error.code, error: error.message }), {
    status: error.status,
    headers: { "Content-Type": "application/json" },
  });
}

function enforceAuthenticatedRateLimit(userId: string, limiter: ReturnType<typeof createRateLimiter>): Response | null {
  const result = limiter.check(userId);
  if (result.allowed) return null;
  const retryAfter = String(result.retryAfterSeconds ?? 60);
  return new Response(
    JSON.stringify({ error: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.", retryAfterSeconds: Number(retryAfter) }),
    {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": retryAfter },
    },
  );
}

export function createProductionEngineAdapter(env: EnvLike): EngineAdapter {
  const mode = resolveEngineMode(env);
  const base = mode === "local-openclaw"
    ? createLocalOpenClawAdapter({
        env,
        // Until a local attestation sidecar proves the profile credential's
        // mcp_tokens site/org binding, production local execution stays closed.
        verifySiteBinding: async () => false,
      })
    : createUnavailableEngineAdapter();
  const maxConcurrent = Number.parseInt(env.OPENCLAW_MAX_CONCURRENT ?? "", 10);
  const timeoutMs = Number.parseInt(env.OPENCLAW_CHAT_TIMEOUT_MS ?? "", 10);
  return createGuardedEngineAdapter(base, { maxConcurrent, timeoutMs });
}

export function createAgentChatPost(dependencies: AgentChatRouteDependencies) {
  const routePreAuthLimiter = dependencies.preAuthLimiter ?? createRateLimiter({ limit: 20, windowMs: 60_000 });
  const routeAuthenticatedLimiter = dependencies.authenticatedLimiter ?? createRateLimiter({ limit: 5, windowMs: 60_000 });
  return async function post(request: NextRequest): Promise<Response> {
    const coarseLimited = enforceRateLimit(request, routePreAuthLimiter);
    if (coarseLimited) return coarseLimited;

    let authentication;
    try {
      authentication = await dependencies.resolveContext.authenticate(request);
    } catch (error) {
      const brokerError = error instanceof BrokerError
        ? error
        : new BrokerError("AUTH_BACKEND_UNAVAILABLE", 503, error);
      log.error("openclaw broker authentication failed", { code: brokerError.code });
      return jsonError(brokerError);
    }

    const body = await request.json().catch(() => null);
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

    const limited = enforceAuthenticatedRateLimit(context.userId, routeAuthenticatedLimiter);
    if (limited) return limited;

    try {
      await dependencies.engine.checkAvailability(context);
    } catch (error) {
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
          controller.close();
        }
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
