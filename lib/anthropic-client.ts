import Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "@/lib/logger";

const log = createLogger("anthropic");

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cachedClient;
}

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/**
 * One structured line per Claude call so prompt-cache hit rates can be observed.
 * Counts only — never the prompt, user input or key. A logging failure never blocks the response.
 */
function logUsage(model: string, label: string | undefined, usage: Anthropic.Messages.Usage | undefined): void {
  if (!usage) return;
  try {
    log.info("anthropic_usage", {
      model,
      label: label ?? null,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
    });
  } catch {
    // Observation only.
  }
}

/**
 * Generates text (JSON-demanding prompts included) via the Anthropic Messages API.
 * Mirrors generateWithVertex's contract: resolves with the text, throws on
 * timeout/refusal/empty so the caller's fallback chain can take over.
 */
export async function generateWithAnthropic(
  model: string,
  prompt: string,
  options: { maxOutputTokens: number; timeoutMs: number; signal?: AbortSignal; logLabel?: string }
): Promise<string> {
  options.signal?.throwIfAborted();
  const client = getClient();
  const response = await client.messages.create(
    {
      model,
      max_tokens: options.maxOutputTokens,
      messages: [{ role: "user", content: prompt }],
    },
    { timeout: options.timeoutMs, maxRetries: 0, signal: options.signal }
  );
  logUsage(model, options.logLabel, response.usage);

  if (response.stop_reason === "refusal") {
    throw new Error(`Anthropic refusal (model=${model})`);
  }
  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  if (!text.trim()) {
    throw new Error(`Anthropic empty response (model=${model}, stop_reason=${response.stop_reason})`);
  }
  if (response.stop_reason === "max_tokens") {
    log.warn("Anthropic output truncated at max_tokens", { model, maxOutputTokens: options.maxOutputTokens });
  }
  return text;
}
