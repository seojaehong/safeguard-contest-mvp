import { createHash, randomUUID } from "node:crypto";

import { getClientIp } from "@/lib/api-guard";
import {
  createConcurrencyGuard,
  createRateLimiter,
  type RateLimiter,
  type RateLimitResult,
} from "@/lib/rate-limit";

const DEFAULT_TIMEOUT_MS = 1_500;
const DOCUMENT_EXPORT_LEASE_MS = 310_000;
const PHOTO_ANALYSIS_LEASE_MS = 70_000;

export const PUBLIC_DOCUMENT_EXPORT_ADMISSION_POLICY = {
  concurrency: 2,
  limit: 24,
  namespace: "document-export",
  windowMs: 60_000,
  workUnit: "document-export",
} as const;

export const PUBLIC_PHOTO_ANALYSIS_ADMISSION_POLICY = {
  concurrency: 2,
  limit: 8,
  namespace: "photo-analysis",
  windowMs: 60_000,
  workUnit: "photo-analysis",
} as const;

const documentExportLimiter = createRateLimiter({
  limit: PUBLIC_DOCUMENT_EXPORT_ADMISSION_POLICY.limit,
  windowMs: PUBLIC_DOCUMENT_EXPORT_ADMISSION_POLICY.windowMs,
});
const documentExportConcurrency = createConcurrencyGuard(
  PUBLIC_DOCUMENT_EXPORT_ADMISSION_POLICY.concurrency,
);
const photoAnalysisLimiter = createRateLimiter({
  limit: PUBLIC_PHOTO_ANALYSIS_ADMISSION_POLICY.limit,
  windowMs: PUBLIC_PHOTO_ANALYSIS_ADMISSION_POLICY.windowMs,
});
const photoAnalysisConcurrency = createConcurrencyGuard(
  PUBLIC_PHOTO_ANALYSIS_ADMISSION_POLICY.concurrency,
);

const FIXED_WINDOW_SCRIPT = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('PTTL', KEYS[1])",
  "return {count, ttl}",
].join("\n");
const CONCURRENCY_ACQUIRE_SCRIPT = [
  "redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])",
  "local active = redis.call('ZCARD', KEYS[1])",
  "local requested = tonumber(ARGV[6])",
  "if active + requested > tonumber(ARGV[2]) then return {0, active} end",
  "for i = 1, requested do redis.call('ZADD', KEYS[1], ARGV[3], ARGV[4] .. ':' .. i) end",
  "redis.call('PEXPIRE', KEYS[1], ARGV[5])",
  "return {1, active + requested}",
].join("\n");
const CONCURRENCY_RELEASE_SCRIPT = [
  "local released = 0",
  "for i = 1, tonumber(ARGV[2]) do released = released + redis.call('ZREM', KEYS[1], ARGV[1] .. ':' .. i) end",
  "return released",
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
  requireDistributedInProduction?: boolean;
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

  if (options.requireDistributedInProduction && environment.VERCEL_ENV === "production") {
    console.error("[public-rate-limit] distributed limiter is required in production", {
      namespace: options.namespace,
    });
    return {
      allowed: false,
      mode: "distributed",
      reason: "distributed_limiter_unavailable",
      retryAfterSeconds: 5,
    };
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

function buildConcurrencyKey(namespace: string): string {
  return `safeclaw:public-concurrency:${namespace}`;
}

async function runUpstashCommand(
  config: Extract<UpstashConfiguration, { state: "ready" }>,
  command: unknown[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`distributed concurrency returned HTTP ${response.status}`);
    const payload = await response.json() as { error?: unknown; result?: unknown };
    if (typeof payload.error === "string" && payload.error) {
      throw new Error("distributed concurrency rejected the atomic lease command");
    }
    return payload.result;
  } finally {
    clearTimeout(timer);
  }
}

export async function acquirePublicConcurrencyLease(input: {
  concurrency: number;
  leaseMs: number;
  namespace: string;
  requireDistributedInProduction: boolean;
  weight?: number;
}): Promise<(() => Promise<void>) | null | undefined> {
  const weight = input.weight ?? 1;
  if (!Number.isSafeInteger(input.concurrency) || input.concurrency < 1) {
    throw new Error("distributed concurrency capacity must be a positive safe integer");
  }
  if (!Number.isSafeInteger(weight) || weight < 1 || weight > input.concurrency) {
    throw new Error("distributed concurrency weight must fit within capacity");
  }
  const config = readUpstashConfiguration(process.env);
  if (config.state === "absent") {
    if (input.requireDistributedInProduction && process.env.VERCEL_ENV === "production") {
      throw new Error("distributed concurrency is required in production");
    }
    return undefined;
  }
  if (config.state === "invalid") throw new Error("distributed concurrency configuration is incomplete or unsafe");

  const owner = randomUUID();
  const now = Date.now();
  const result = await runUpstashCommand(config, [
    "EVAL",
    CONCURRENCY_ACQUIRE_SCRIPT,
    "1",
    buildConcurrencyKey(input.namespace),
    String(now),
    String(input.concurrency),
    String(now + input.leaseMs),
    owner,
    String(input.leaseMs),
    String(weight),
  ]);
  if (!Array.isArray(result) || result.length < 1 || ![0, 1].includes(Number(result[0]))) {
    throw new Error("distributed concurrency returned an invalid lease response");
  }
  if (Number(result[0]) === 0) return null;

  let released = false;
  return async () => {
    if (released) return;
    released = true;
    try {
      await runUpstashCommand(config, [
        "EVAL",
        CONCURRENCY_RELEASE_SCRIPT,
        "1",
        buildConcurrencyKey(input.namespace),
        owner,
        String(weight),
      ]);
    } catch (error) {
      console.error("[public-rate-limit] distributed concurrency release failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

async function acquireDocumentExportLease(): Promise<(() => Promise<void>) | null | undefined> {
  return acquirePublicConcurrencyLease({
    concurrency: PUBLIC_DOCUMENT_EXPORT_ADMISSION_POLICY.concurrency,
    leaseMs: DOCUMENT_EXPORT_LEASE_MS,
    namespace: PUBLIC_DOCUMENT_EXPORT_ADMISSION_POLICY.namespace,
    requireDistributedInProduction: true,
  });
}

async function acquirePhotoAnalysisLease(): Promise<(() => Promise<void>) | null | undefined> {
  return acquirePublicConcurrencyLease({
    concurrency: PUBLIC_PHOTO_ANALYSIS_ADMISSION_POLICY.concurrency,
    leaseMs: PHOTO_ANALYSIS_LEASE_MS,
    namespace: PUBLIC_PHOTO_ANALYSIS_ADMISSION_POLICY.namespace,
    requireDistributedInProduction: true,
  });
}

function applyDocumentExportAdmissionHeaders<T extends Response>(
  response: T,
  decision: PublicRateLimitDecision,
): T {
  applyPublicRateLimitHeader(response, decision);
  response.headers.set("X-SafeClaw-Work-Unit", PUBLIC_DOCUMENT_EXPORT_ADMISSION_POLICY.workUnit);
  return response;
}

function documentExportConcurrencyResponse(decision: PublicRateLimitDecision): Response {
  return applyDocumentExportAdmissionHeaders(new Response(JSON.stringify({
    error: "문서 내보내기 작업이 많습니다. 잠시 후 다시 시도해 주세요.",
    code: "PUBLIC_EXPORT_CONCURRENCY_LIMIT",
    retryAfterSeconds: 1,
  }), {
    status: 503,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": "1",
    },
  }), decision);
}

export async function withPublicDocumentExportAdmission(
  request: Request,
  work: () => Promise<Response>,
): Promise<Response> {
  const decision = await checkPublicRateLimit({
    request,
    namespace: PUBLIC_DOCUMENT_EXPORT_ADMISSION_POLICY.namespace,
    limit: PUBLIC_DOCUMENT_EXPORT_ADMISSION_POLICY.limit,
    windowMs: PUBLIC_DOCUMENT_EXPORT_ADMISSION_POLICY.windowMs,
    instanceLimiter: documentExportLimiter,
  });
  const limited = publicRateLimitResponse(decision);
  if (limited) {
    limited.headers.set("X-SafeClaw-Work-Unit", PUBLIC_DOCUMENT_EXPORT_ADMISSION_POLICY.workUnit);
    return limited;
  }

  let release: (() => void | Promise<void>) | null;
  try {
    const distributedRelease = await acquireDocumentExportLease();
    release = distributedRelease === undefined
      ? documentExportConcurrency.tryAcquire()
      : distributedRelease;
  } catch (error) {
    console.error("[public-rate-limit] distributed concurrency unavailable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return documentExportConcurrencyResponse(decision);
  }
  if (!release) return documentExportConcurrencyResponse(decision);

  try {
    return applyDocumentExportAdmissionHeaders(await work(), decision);
  } finally {
    await release();
  }
}

function photoAnalysisConcurrencyResponse(decision: PublicRateLimitDecision): Response {
  const response = new Response(JSON.stringify({
    error: "사진 분석 작업이 많습니다. 잠시 후 다시 시도해 주세요.",
    code: "PHOTO_ANALYSIS_CONCURRENCY_LIMIT",
    retryAfterSeconds: 1,
  }), {
    status: 503,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": "1",
    },
  });
  applyPublicRateLimitHeader(response, decision);
  response.headers.set("X-SafeClaw-Work-Unit", PUBLIC_PHOTO_ANALYSIS_ADMISSION_POLICY.workUnit);
  return response;
}

export async function withPublicPhotoAnalysisAdmission(
  request: Request,
  work: () => Promise<Response>,
): Promise<Response> {
  const decision = await checkPublicRateLimit({
    request,
    namespace: PUBLIC_PHOTO_ANALYSIS_ADMISSION_POLICY.namespace,
    limit: PUBLIC_PHOTO_ANALYSIS_ADMISSION_POLICY.limit,
    windowMs: PUBLIC_PHOTO_ANALYSIS_ADMISSION_POLICY.windowMs,
    instanceLimiter: photoAnalysisLimiter,
    requireDistributedInProduction: true,
  });
  const limited = publicRateLimitResponse(decision);
  if (limited) {
    limited.headers.set("X-SafeClaw-Work-Unit", PUBLIC_PHOTO_ANALYSIS_ADMISSION_POLICY.workUnit);
    return limited;
  }

  let release: (() => void | Promise<void>) | null;
  try {
    const distributedRelease = await acquirePhotoAnalysisLease();
    release = distributedRelease === undefined
      ? photoAnalysisConcurrency.tryAcquire()
      : distributedRelease;
  } catch (error) {
    console.error("[public-rate-limit] photo analysis concurrency unavailable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return photoAnalysisConcurrencyResponse(decision);
  }
  if (!release) return photoAnalysisConcurrencyResponse(decision);

  try {
    const response = await work();
    applyPublicRateLimitHeader(response, decision);
    response.headers.set("X-SafeClaw-Work-Unit", PUBLIC_PHOTO_ANALYSIS_ADMISSION_POLICY.workUnit);
    return response;
  } finally {
    await release();
  }
}
