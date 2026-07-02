import { describe, expect, it } from "vitest";

import {
  DEFAULT_DELIVERABLES_TIMEOUT_MS,
  FALLBACK_MODEL_TIMEOUT_CAP_MS,
  formatWorkDate,
  planModelAttempts,
  resolveDeliverablesTimeoutMs
} from "@/lib/ai-deliverables-policy";

describe("resolveDeliverablesTimeoutMs", () => {
  it("defaults to 45000ms when the env value is missing", () => {
    expect(DEFAULT_DELIVERABLES_TIMEOUT_MS).toBe(45000);
    expect(resolveDeliverablesTimeoutMs(undefined)).toBe(45000);
    expect(resolveDeliverablesTimeoutMs("")).toBe(45000);
  });

  it("uses GEMINI_DELIVERABLES_TIMEOUT_MS when set", () => {
    expect(resolveDeliverablesTimeoutMs("30000")).toBe(30000);
  });

  it("ignores invalid or non-positive values", () => {
    expect(resolveDeliverablesTimeoutMs("abc")).toBe(45000);
    expect(resolveDeliverablesTimeoutMs("0")).toBe(45000);
    expect(resolveDeliverablesTimeoutMs("-5000")).toBe(45000);
  });
});

describe("planModelAttempts", () => {
  it("gives the primary model the full timeout budget", () => {
    const attempts = planModelAttempts("gemini-2.5-flash", ["gemini-2.5-flash-lite"], 45000);
    expect(attempts[0]).toEqual({ model: "gemini-2.5-flash", timeoutMs: 45000 });
  });

  it("caps fallback model timeouts at 15000ms", () => {
    expect(FALLBACK_MODEL_TIMEOUT_CAP_MS).toBe(15000);
    const attempts = planModelAttempts("gemini-2.5-flash", ["gemini-2.5-flash-lite"], 45000);
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual({ model: "gemini-2.5-flash-lite", timeoutMs: 15000 });
  });

  it("never gives a fallback more budget than the primary", () => {
    const attempts = planModelAttempts("gemini-2.5-flash", ["gemini-2.5-flash-lite"], 10000);
    expect(attempts[1].timeoutMs).toBe(10000);
  });

  it("dedupes when the primary is repeated in fallbacks", () => {
    const attempts = planModelAttempts("gemini-2.5-flash", ["gemini-2.5-flash", "gemini-2.5-flash-lite"], 45000);
    expect(attempts.map((a) => a.model)).toEqual(["gemini-2.5-flash", "gemini-2.5-flash-lite"]);
  });

  it("returns only the primary when no fallbacks are configured", () => {
    expect(planModelAttempts("gemini-2.5-flash", [], 45000)).toEqual([
      { model: "gemini-2.5-flash", timeoutMs: 45000 }
    ]);
  });
});

describe("formatWorkDate", () => {
  it("formats a UTC instant as its KST (Asia/Seoul, UTC+9) calendar date", () => {
    // 2026-07-02T16:00:00Z + 9h = 2026-07-03T01:00 KST → next day in KST.
    expect(formatWorkDate(new Date("2026-07-02T16:00:00Z"))).toBe("2026-07-03");
  });

  it("keeps the same calendar date when KST does not roll over", () => {
    // 2026-07-02T10:00:00Z + 9h = 2026-07-02T19:00 KST → same day.
    expect(formatWorkDate(new Date("2026-07-02T10:00:00Z"))).toBe("2026-07-02");
  });

  it("zero-pads single-digit months and days", () => {
    expect(formatWorkDate(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01-05");
  });
});
