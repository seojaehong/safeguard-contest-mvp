import { describe, expect, test } from "vitest";
import { resolveDeliverablesProvider, DEFAULT_ANTHROPIC_MODEL } from "@/lib/ai-provider-policy";

describe("resolveDeliverablesProvider", () => {
  test("defaults to vertex when nothing is configured", () => {
    expect(resolveDeliverablesProvider({})).toEqual({ provider: "vertex" });
  });

  test("stays on vertex when key exists but provider flag is unset", () => {
    expect(resolveDeliverablesProvider({ anthropicApiKey: "sk-ant-xxx" })).toEqual({ provider: "vertex" });
  });

  test("stays on vertex (with warning reason) when provider=claude but key is missing", () => {
    const result = resolveDeliverablesProvider({ providerFlag: "claude" });
    expect(result.provider).toBe("vertex");
    expect(result.reason).toContain("ANTHROPIC_API_KEY");
  });

  test("selects anthropic with default model when flag and key are both set", () => {
    const result = resolveDeliverablesProvider({ anthropicApiKey: "sk-ant-xxx", providerFlag: "claude" });
    expect(result).toEqual({ provider: "anthropic", model: DEFAULT_ANTHROPIC_MODEL });
  });

  test("accepts 'anthropic' as flag value and honors model override", () => {
    const result = resolveDeliverablesProvider({
      anthropicApiKey: "sk-ant-xxx",
      providerFlag: "anthropic",
      modelOverride: "claude-opus-4-8",
    });
    expect(result).toEqual({ provider: "anthropic", model: "claude-opus-4-8" });
  });
});
