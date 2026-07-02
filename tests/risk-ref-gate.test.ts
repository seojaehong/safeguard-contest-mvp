import { describe, expect, it } from "vitest";

import { clampOneBased, clampRiskRefs } from "@/lib/risk-ref-gate";

describe("clampRiskRefs", () => {
  it("keeps in-range integer indices unchanged", () => {
    expect(clampRiskRefs([0, 1, 2], 4)).toEqual([0, 1, 2]);
  });

  it("drops indices at or past maxIndexExclusive", () => {
    expect(clampRiskRefs([0, 3, 4, 5], 4)).toEqual([0, 3]);
  });

  it("drops negative indices", () => {
    expect(clampRiskRefs([-1, 0, 1], 4)).toEqual([0, 1]);
  });

  it("drops non-integer values", () => {
    expect(clampRiskRefs([0, 1.5, "2", null, undefined, NaN], 4)).toEqual([0]);
  });

  it("de-duplicates while preserving first-seen order", () => {
    expect(clampRiskRefs([2, 0, 2, 1, 0], 4)).toEqual([2, 0, 1]);
  });

  it("returns [] for non-array input", () => {
    expect(clampRiskRefs(undefined, 4)).toEqual([]);
    expect(clampRiskRefs("not-an-array", 4)).toEqual([]);
    expect(clampRiskRefs(null, 4)).toEqual([]);
  });

  it("returns [] when maxIndexExclusive is 0 (no risk rows)", () => {
    expect(clampRiskRefs([0, 1], 0)).toEqual([]);
  });
});

describe("clampOneBased", () => {
  it("keeps in-range 1-based refs unchanged", () => {
    expect(clampOneBased(1, 3)).toBe(1);
    expect(clampOneBased(3, 3)).toBe(3);
  });

  it("rejects 0 and negative refs (must be >= 1)", () => {
    expect(clampOneBased(0, 3)).toBeNull();
    expect(clampOneBased(-1, 3)).toBeNull();
  });

  it("rejects refs past count", () => {
    expect(clampOneBased(4, 3)).toBeNull();
  });

  it("rejects non-integer / non-number values", () => {
    expect(clampOneBased(1.5, 3)).toBeNull();
    expect(clampOneBased("1", 3)).toBeNull();
    expect(clampOneBased(null, 3)).toBeNull();
    expect(clampOneBased(undefined, 3)).toBeNull();
  });

  it("rejects any ref when count is 0", () => {
    expect(clampOneBased(1, 0)).toBeNull();
  });
});
