import type { AiMode } from "@/lib/ai-deliverables";
import { PUBLIC_ASK_PROVIDER_ADMISSION_POLICY } from "@/lib/public-ask-admission";
import {
  checkPublicRateLimit,
  type PublicRateLimitDecision,
} from "@/lib/public-distributed-rate-limit";
import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit";

// 로그인 사용자의 하루 AI 비용 상한(2026-10-25 결정 21).
// 사이트 전체(IP 무관) 하루 작업 단위로 센다. 가중치는 동시 처리 용량과 같은 표를 쓴다
// (full 12, enhanced 2 — enhanced 는 full 의 1/6 이라 같은 상한으로 6배를 받는다).
// 기본 600 단위 = full 하루 50건 또는 enhanced 300건. 환경변수로 바꾼다.
export const AI_DAILY_WORK_UNITS_ENV = "SAFECLAW_AI_DAILY_WORK_UNITS";
export const AI_DAILY_WORK_UNITS_DEFAULT = 600;
const DAY_MS = 24 * 60 * 60 * 1_000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1_000;

type Environment = Record<string, string | undefined>;

export function resolveAiDailyWorkUnitCap(environment: Environment = process.env): number {
  const raw = environment[AI_DAILY_WORK_UNITS_ENV]?.trim();
  if (!raw) return AI_DAILY_WORK_UNITS_DEFAULT;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : AI_DAILY_WORK_UNITS_DEFAULT;
}

export function kstDateKey(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

let instanceLimiter: { cap: number; limiter: RateLimiter } | null = null;

function dailyInstanceLimiter(cap: number): RateLimiter {
  if (!instanceLimiter || instanceLimiter.cap !== cap) {
    instanceLimiter = { cap, limiter: createRateLimiter({ limit: cap, windowMs: DAY_MS }) };
  }
  return instanceLimiter.limiter;
}

export type AiDailyCostCapDecision = {
  allowed: boolean;
  cap: number;
  weight: number;
  decision: PublicRateLimitDecision | null;
};

export async function checkAiDailyCostCap(input: {
  request: Request;
  aiMode: AiMode;
  environment?: Environment;
  fetchImpl?: Parameters<typeof checkPublicRateLimit>[0]["fetchImpl"];
  now?: Date;
}): Promise<AiDailyCostCapDecision> {
  const environment = input.environment ?? process.env;
  const cap = resolveAiDailyWorkUnitCap(environment);
  const weight = PUBLIC_ASK_PROVIDER_ADMISSION_POLICY.weights[input.aiMode];
  if (weight === 0) return { allowed: true, cap, weight, decision: null };
  if (weight > cap) return { allowed: false, cap, weight, decision: null };

  const decision = await checkPublicRateLimit({
    request: input.request,
    identifier: `site:${kstDateKey(input.now)}`,
    namespace: "ai-daily-cost",
    limit: cap,
    windowMs: DAY_MS + 60 * 60 * 1_000,
    increment: weight,
    instanceLimiter: dailyInstanceLimiter(cap),
    environment,
    fetchImpl: input.fetchImpl,
    requireDistributedInProduction: true,
  });
  // 카운터를 확인하지 못한 경우(장애·미설정)도 비용 쪽으로 닫는다 — template 강등.
  return { allowed: decision.allowed, cap, weight, decision };
}

export function resetAiDailyCostCapInstanceForTests(): void {
  instanceLimiter = null;
}
