// Provider selection for structured deliverables generation (pure, unit-testable).
//
// Demo/pilot lever: setting AI_DELIVERABLES_PROVIDER=claude (plus ANTHROPIC_API_KEY)
// routes document generation to the Anthropic API instead of Vertex Gemini.
// Vertex stays the default and the runtime fallback — a Claude failure must never
// degrade below today's behavior.

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";

export type ProviderDecision = {
  provider: "anthropic" | "vertex";
  model?: string;
  reason?: string;
};

export function resolveDeliverablesProvider(env: {
  anthropicApiKey?: string;
  providerFlag?: string;
  modelOverride?: string;
}): ProviderDecision {
  const flag = env.providerFlag?.trim().toLowerCase();
  const wantsAnthropic = flag === "claude" || flag === "anthropic";
  if (!wantsAnthropic) return { provider: "vertex" };
  if (!env.anthropicApiKey?.trim()) {
    return { provider: "vertex", reason: "AI_DELIVERABLES_PROVIDER=claude but ANTHROPIC_API_KEY is not set" };
  }
  return { provider: "anthropic", model: env.modelOverride?.trim() || DEFAULT_ANTHROPIC_MODEL };
}
