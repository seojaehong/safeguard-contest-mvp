// Timeout budget and model-chain policy for ai-deliverables.ts (pure, unit-testable).
//
// Background (2026-07-02 prod smoke): the deliverables timeout inherited
// GEMINI_TIMEOUT_MS=20000 from the prod env, which is shorter than the realistic
// JSON generation time of gemini-2.5-flash (30-45s), so every structured doc call
// timed out and the chain aborted before trying the fallback model. Deliverables
// now use GEMINI_DELIVERABLES_TIMEOUT_MS exclusively, and a timeout on the primary
// no longer skips the fallback — the fallback runs with a short capped budget.

export const DEFAULT_DELIVERABLES_TIMEOUT_MS = 45000;
export const FALLBACK_MODEL_TIMEOUT_CAP_MS = 15000;
// Heavy docs (foreign: 5-language, 11,500-17,000 chars demanded) need both a
// longer wall clock and a larger fallback window — 15s is provably too short
// (2026-07-02 prod smoke: foreign failed at the fallback cap after US-001).
export const HEAVY_DOC_FALLBACK_TIMEOUT_CAP_MS = 30000;

export function resolvePositiveIntEnv(rawEnvValue: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(rawEnvValue ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return fallback;
}

/**
 * Resolves the per-call timeout for deliverables generation.
 * Only GEMINI_DELIVERABLES_TIMEOUT_MS is honored — GEMINI_TIMEOUT_MS is
 * intentionally NOT inherited (it is tuned for the ai.ts answer path).
 */
export function resolveDeliverablesTimeoutMs(rawEnvValue: string | undefined): number {
  return resolvePositiveIntEnv(rawEnvValue, DEFAULT_DELIVERABLES_TIMEOUT_MS);
}

export type DocBudget = {
  timeoutMs: number;
  maxOutputTokens: number;
  fallbackTimeoutCapMs: number;
};

/**
 * Per-document generation budget. The foreign-worker pack demands multi-language
 * output far beyond the standard docs, so it gets 2x wall clock and 16K output
 * tokens; everything else keeps the standard budget.
 */
export function resolveDocBudget(docName: string, baseTimeoutMs: number): DocBudget {
  // foreign: ko+en+vi+th+uz pack ≈ 15-20K output tokens → 3x wall clock.
  // free: 4 grouped docs ≈ 8-10K output tokens → 2x wall clock.
  // (2026-07-02 prod: both timed out on every provider at 2x/1x budgets.)
  if (docName === "foreign") {
    return {
      timeoutMs: baseTimeoutMs * 3,
      maxOutputTokens: 16384,
      fallbackTimeoutCapMs: HEAVY_DOC_FALLBACK_TIMEOUT_CAP_MS
    };
  }
  if (docName === "free") {
    return {
      timeoutMs: baseTimeoutMs * 2,
      maxOutputTokens: 16384,
      fallbackTimeoutCapMs: HEAVY_DOC_FALLBACK_TIMEOUT_CAP_MS
    };
  }
  return {
    timeoutMs: baseTimeoutMs,
    maxOutputTokens: 8192,
    fallbackTimeoutCapMs: FALLBACK_MODEL_TIMEOUT_CAP_MS
  };
}

/**
 * Formats a Date as a KST (Asia/Seoul) calendar date "YYYY-MM-DD".
 *
 * Background (2026-07-02 prod smoke): photoEvidence/tbmLog hallucinated
 * dates ("2026.03.15", "2025년") unrelated to the actual generation date.
 * The generation entrypoint now injects a single authoritative work date
 * into GenContext so the model has no reason to invent one.
 */
export function formatWorkDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export type ModelAttempt = {
  model: string;
  timeoutMs: number;
};

/**
 * Plans the model attempt chain: the primary model gets the full budget,
 * each fallback model gets one attempt capped at FALLBACK_MODEL_TIMEOUT_CAP_MS
 * (never more than the primary budget). Duplicate models are collapsed.
 */
/**
 * Vertex fallback chain when the Anthropic provider already consumed the
 * primary budget: skip the slow flash primary and go straight to the fast
 * fallback model with the capped budget. Keeps the worst-case per-doc chain
 * at budget + cap (e.g. 45s + 15s) instead of budget + 45s + 15s.
 */
/**
 * Per-doc Anthropic model routing: heavy grouped/multilingual docs (free, foreign)
 * produce 6-16K output tokens, which Sonnet/Opus cannot finish inside the doc
 * budget — route those to the fast Haiku tier; everything else keeps the
 * configured model. (2026-07-02 prod: Sonnet 5 completed all 7 structured docs
 * in-budget but timed out on free/foreign.)
 */
export const FAST_ANTHROPIC_MODEL = "claude-haiku-4-5";
const HEAVY_OUTPUT_DOCS = new Set(["foreign", "free"]);

/** Heavy grouped/multilingual docs: 90-135s per attempt — never parse-retry these. */
export function isHeavyOutputDoc(docName: string): boolean {
  return HEAVY_OUTPUT_DOCS.has(docName);
}

export function resolveAnthropicModelForDoc(docName: string, configuredModel: string): string {
  return HEAVY_OUTPUT_DOCS.has(docName) ? FAST_ANTHROPIC_MODEL : configuredModel;
}

export function planPostAnthropicAttempts(fallbackModels: string[], budget: DocBudget): ModelAttempt[] {
  const model = fallbackModels[0]?.trim() || "gemini-2.5-flash-lite";
  return [{ model, timeoutMs: budget.fallbackTimeoutCapMs }];
}

export function planModelAttempts(
  primaryModel: string,
  fallbackModels: string[],
  primaryTimeoutMs: number,
  fallbackTimeoutCapMs: number = FALLBACK_MODEL_TIMEOUT_CAP_MS
): ModelAttempt[] {
  const models = [...new Set([primaryModel, ...fallbackModels])];
  return models.map((model, index) => ({
    model,
    timeoutMs: index === 0 ? primaryTimeoutMs : Math.min(fallbackTimeoutCapMs, primaryTimeoutMs)
  }));
}
