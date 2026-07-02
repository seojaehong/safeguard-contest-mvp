import { describe, expect, test } from "vitest";
import {
  planModelAttempts,
  planPostAnthropicAttempts,
  resolveAnthropicModelForDoc,
  resolveDocBudget,
  resolvePositiveIntEnv,
  DEFAULT_DELIVERABLES_TIMEOUT_MS,
  FALLBACK_MODEL_TIMEOUT_CAP_MS,
  HEAVY_DOC_FALLBACK_TIMEOUT_CAP_MS
} from "@/lib/ai-deliverables-policy";

describe("resolvePositiveIntEnv", () => {
  test("parses a positive integer string", () => {
    expect(resolvePositiveIntEnv("30000", 10_000)).toBe(30_000);
  });

  test("falls back on undefined, garbage, zero, and negatives", () => {
    expect(resolvePositiveIntEnv(undefined, 10_000)).toBe(10_000);
    expect(resolvePositiveIntEnv("abc", 10_000)).toBe(10_000);
    expect(resolvePositiveIntEnv("0", 10_000)).toBe(10_000);
    expect(resolvePositiveIntEnv("-5", 10_000)).toBe(10_000);
  });
});

describe("resolveDocBudget", () => {
  test("standard docs keep the base timeout and 8192 output tokens", () => {
    const budget = resolveDocBudget("riskAssessment", 45_000);
    expect(budget.timeoutMs).toBe(45_000);
    expect(budget.maxOutputTokens).toBe(8192);
    expect(budget.fallbackTimeoutCapMs).toBe(FALLBACK_MODEL_TIMEOUT_CAP_MS);
  });

  test("foreign doc gets a doubled timeout, 16384 output tokens and a larger fallback cap", () => {
    const budget = resolveDocBudget("foreign", 45_000);
    expect(budget.timeoutMs).toBe(90_000);
    expect(budget.maxOutputTokens).toBe(16_384);
    expect(budget.fallbackTimeoutCapMs).toBe(HEAVY_DOC_FALLBACK_TIMEOUT_CAP_MS);
  });

  test("foreign doubling respects a custom base timeout", () => {
    const budget = resolveDocBudget("foreign", DEFAULT_DELIVERABLES_TIMEOUT_MS);
    expect(budget.timeoutMs).toBe(DEFAULT_DELIVERABLES_TIMEOUT_MS * 2);
  });
});

describe("planPostAnthropicAttempts", () => {
  test("goes straight to the fast fallback model with the capped budget", () => {
    const attempts = planPostAnthropicAttempts(["gemini-2.5-flash-lite"], {
      timeoutMs: 45_000,
      maxOutputTokens: 8192,
      fallbackTimeoutCapMs: 15_000,
    });
    expect(attempts).toEqual([{ model: "gemini-2.5-flash-lite", timeoutMs: 15_000 }]);
  });

  test("defaults to gemini-2.5-flash-lite when no fallback models configured", () => {
    const attempts = planPostAnthropicAttempts([], {
      timeoutMs: 90_000,
      maxOutputTokens: 16_384,
      fallbackTimeoutCapMs: 30_000,
    });
    expect(attempts).toEqual([{ model: "gemini-2.5-flash-lite", timeoutMs: 30_000 }]);
  });
});

describe("planModelAttempts with a custom fallback cap", () => {
  test("fallback attempt uses the provided cap instead of the default", () => {
    const attempts = planModelAttempts("gemini-2.5-flash", ["gemini-2.5-flash-lite"], 90_000, 30_000);
    expect(attempts).toEqual([
      { model: "gemini-2.5-flash", timeoutMs: 90_000 },
      { model: "gemini-2.5-flash-lite", timeoutMs: 30_000 }
    ]);
  });

  test("omitting the cap keeps the default fallback cap", () => {
    const attempts = planModelAttempts("gemini-2.5-flash", ["gemini-2.5-flash-lite"], 45_000);
    expect(attempts[1].timeoutMs).toBe(FALLBACK_MODEL_TIMEOUT_CAP_MS);
  });
});

describe("resolveAnthropicModelForDoc", () => {
  test("heavy docs (foreign, free) route to the fast haiku model", () => {
    expect(resolveAnthropicModelForDoc("foreign", "claude-sonnet-5")).toBe("claude-haiku-4-5");
    expect(resolveAnthropicModelForDoc("free", "claude-opus-4-8")).toBe("claude-haiku-4-5");
  });

  test("standard docs keep the configured model", () => {
    expect(resolveAnthropicModelForDoc("riskAssessment", "claude-sonnet-5")).toBe("claude-sonnet-5");
    expect(resolveAnthropicModelForDoc("tbmLog", "claude-haiku-4-5")).toBe("claude-haiku-4-5");
  });
});
