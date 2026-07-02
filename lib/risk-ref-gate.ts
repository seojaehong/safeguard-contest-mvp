// Risk-row cross-reference gate (2026-07-02 prod smoke — task-5 brief).
//
// AI-generated structured docs (workPlanStructured, tbmLogStructured,
// tbmBriefingStructured) reference risk rows / hazards by array index, but the
// model sometimes emits indices that are non-integer, negative, or past the
// end of the referenced array — that crashes cross-reference rendering
// downstream (xlsx-builder / hwp-table-builder).
//
// Two shapes exist in the codebase:
//   - workPlanStructured.workSteps[].relatedRiskRowIndex: number[], 0-based,
//     references structuredRiskRows (a *separate* parallel AI call — the
//     row count isn't known until the merge point in ai-deliverables.ts).
//   - tbmBriefingStructured.measures[].hazardRef: number, 1-based, references
//     hazards within the *same* parsed object (count known at parse time).

/**
 * Clamp a 0-based index array to [0, maxIndexExclusive). Drops non-integer,
 * negative, and out-of-range values, and de-duplicates while preserving the
 * first-seen order.
 */
export function clampRiskRefs(indices: unknown, maxIndexExclusive: number): number[] {
  if (!Array.isArray(indices) || maxIndexExclusive <= 0) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const value of indices) {
    if (typeof value !== "number" || !Number.isInteger(value)) continue;
    if (value < 0 || value >= maxIndexExclusive) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

/**
 * Validate a single 1-based reference against `count` items. Returns the
 * reference unchanged when valid, or null when it's not an integer, is < 1,
 * or exceeds `count`.
 */
export function clampOneBased(ref: unknown, count: number): number | null {
  if (typeof ref !== "number" || !Number.isInteger(ref)) return null;
  if (ref < 1 || ref > count) return null;
  return ref;
}
