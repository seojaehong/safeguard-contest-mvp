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

/**
 * Resolves the per-call timeout for deliverables generation.
 * Only GEMINI_DELIVERABLES_TIMEOUT_MS is honored — GEMINI_TIMEOUT_MS is
 * intentionally NOT inherited (it is tuned for the ai.ts answer path).
 */
export function resolveDeliverablesTimeoutMs(rawEnvValue: string | undefined): number {
  const parsed = Number.parseInt(rawEnvValue ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return DEFAULT_DELIVERABLES_TIMEOUT_MS;
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
export function planModelAttempts(
  primaryModel: string,
  fallbackModels: string[],
  primaryTimeoutMs: number
): ModelAttempt[] {
  const models = [...new Set([primaryModel, ...fallbackModels])];
  return models.map((model, index) => ({
    model,
    timeoutMs: index === 0 ? primaryTimeoutMs : Math.min(FALLBACK_MODEL_TIMEOUT_CAP_MS, primaryTimeoutMs)
  }));
}
