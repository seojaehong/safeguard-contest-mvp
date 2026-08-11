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
 * Generates text (JSON-demanding prompts included) via the Anthropic Messages API.
 * Mirrors generateWithVertex's contract: resolves with the text, throws on
 * timeout/refusal/empty so the caller's fallback chain can take over.
 */
export async function generateWithAnthropic(
  model: string,
  prompt: string,
  options: { maxOutputTokens: number; timeoutMs: number; signal?: AbortSignal }
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
