import { createHash } from "node:crypto";

import { getClientIp } from "@/lib/api-guard";
import type { RateLimiter, RateLimitResult } from "@/lib/rate-limit";

const DEFAULT_TIMEOUT_MS = 1_500;

const FIXED_WINDOW_SCRIPT = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('PTTL', KEYS[1])",
  "return {count, ttl}",
].join("\n");

type RateLimitMode = "distributed" | "instance";

export type PublicRateLimitDecision = RateLimitResult & {
  mode: RateLimitMode;
  reason: "distributed" | "distributed_limiter_unavailable" | "distributed_limiter_misconfigured" | "instance_fallback";
};

type Environment = Record<string, string | undefined>;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type PublicRateLimitOptions = {
  request: Request;
  identifier?: string;
  namespace: string;
  limit: number;
  windowMs: number;
  instanceLimiter: RateLimiter;
  environment?: Environment;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
};

type UpstashConfiguration =
  | { state: "absent" }
  | { state: "invalid" }
  | { state: "ready"; token: string; url: string };

function readUpstashConfiguration(environment: Environment): UpstashConfiguration {
  const url = environment.UPSTASH_REDIS_REST_URL?.trim() ?? "";
  const token = environment.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";
  if (!url && !token) return { state: "absent" };
  if (!url || !token) return { state: "invalid" };

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return { state: "invalid" };
    }
    return { state: "ready", token, url: parsed.toString() };
  } catch {
    return { state: "invalid" };
  }
}

function buildRateLimitKey(namespace: string, identifier: string): string {
  const digest = createHash("sha256").update(identifier).digest("hex").slice(0, 32);
  return `safeclaw:public-rate:${namespace}:${digest}`;
}

function retryAfterSeconds(ttlMs: number, windowMs: number): number {
  const boundedTtl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : windowMs;
  return Math.max(1, Math.ceil(boundedTtl / 1_000));
}

async function checkUpstashRateLimit(input: {
  config: Extract<UpstashConfiguration, { state: "ready" }>;
  fetchImpl: FetchLike;
  identifier: string;
  limit: number;
  namespace: string;
  timeoutMs: number;
  windowMs: number;
}): Promise<PublicRateLimitDecision> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await input.fetchImpl(input.config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        FIXED_WINDOW_SCRIPT,
        "1",
        buildRateLimitKey(input.namespace, input.identifier),
        String(input.windowMs),
      ]),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`distributed limiter returned HTTP ${response.status}`);

    const payload = await response.json() as { error?: unknown; result?: unknown };
    if (typeof payload.error === "string" && payload.error) {
      throw new Error("distributed limiter rejected the atomic counter command");
    }
    if (!Array.isArray(payload.result) || payload.result.length < 2) {
      throw new Error("distributed limiter returned an invalid counter response");
    }
    const count = Number(payload.result[0]);
    const ttlMs = Number(payload.result[1]);
    if (!Number.isSafeInteger(count) || count < 1 || !Number.isFinite(ttlMs)) {
      throw new Error("distributed limiter returned invalid counter values");
    }

    return count <= input.limit
      ? { allowed: true, mode: "distributed", reason: "distributed" }
      : {
          allowed: false,
          mode: "distributed",
          reason: "distributed",
          retryAfterSeconds: retryAfterSeconds(ttlMs, input.windowMs),
        };
  } catch (error) {
    console.error("[public-rate-limit] distributed limiter unavailable", {
      error: error instanceof Error ? error.message : String(error),
      namespace: input.namespace,
    });
    return {
      allowed: false,
      mode: "distributed",
      reason: "distributed_limiter_unavailable",
      retryAfterSeconds: 5,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkPublicRateLimit(
  options: PublicRateLimitOptions,
): Promise<PublicRateLimitDecision> {
  const environment = options.environment ?? process.env;
  const config = readUpstashConfiguration(environment);
  const identifier = options.identifier ?? getClientIp(options.request);

  if (config.state === "invalid") {
    console.error("[public-rate-limit] distributed limiter configuration is incomplete or unsafe", {
      namespace: options.namespace,
    });
    return {
      allowed: false,
      mode: "distributed",
      reason: "distributed_limiter_misconfigured",
      retryAfterSeconds: 5,
    };
  }
  if (config.state === "ready") {
    return checkUpstashRateLimit({
      config,
      fetchImpl: options.fetchImpl ?? fetch,
      identifier,
      limit: options.limit,
      namespace: options.namespace,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      windowMs: options.windowMs,
    });
  }

  return {
    ...options.instanceLimiter.check(identifier),
    mode: "instance",
    reason: "instance_fallback",
  };
}

export function publicRateLimitResponse(decision: PublicRateLimitDecision): Response | null {
  if (decision.allowed) return null;
  const retryAfter = String(decision.retryAfterSeconds ?? 60);
  const unavailable = decision.reason !== "distributed" && decision.mode === "distributed";
  return new Response(
    JSON.stringify({
      error: unavailable
        ? "요청 보호 서비스를 확인하는 동안 요청을 잠시 처리할 수 없습니다."
        : "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.",
      code: unavailable ? "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE" : "RATE_LIMIT_EXCEEDED",
      retryAfterSeconds: Number(retryAfter),
    }),
    {
      status: unavailable ? 503 : 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": retryAfter,
        "X-SafeClaw-Rate-Limit": decision.mode,
      },
    },
  );
}

export function applyPublicRateLimitHeader<T extends Response>(
  response: T,
  decision: PublicRateLimitDecision,
): T {
  response.headers.set("X-SafeClaw-Rate-Limit", decision.mode);
  return response;
}
