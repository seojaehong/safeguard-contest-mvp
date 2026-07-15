# Grounded Generation Remediation

## Candidate

- Product SHA: `68010bb`
- Branch: `fix/northstar-grounded-generation-20260715`
- LLM role: `naturalize_only`
- Status: focused verification passed; independent re-review pending

## Closed review findings

1. TBM measures and unaddressed actions now require packet `evidenceRefs` in the TypeScript contract and generation prompt.
2. A pipeline-wide provider failure retains the grounding packet identity and every critical control as `review_required` diagnostics.
3. A verified control cannot be used as a prefix for arbitrary appended instructions. Only an exact control or a suffix made solely of packet-resolved citation parentheses is accepted.
4. Packet sources, aliases, and controls are canonically ordered before both hashing and serialization, so equal identities produce identical model evidence input.
5. Site locations such as `A-1 구역` are no longer parsed as KOSHA citations; only complete versioned guide tokens are treated as explicit citations.

Rejected groups still expose every absent critical control through DB harness `missingEvidence`; no fallback is labeled grounded merely because it is syntactically valid.

## Verification

- Grounding and generation: 4 files, 66 tests passed
- TBM, quality, XLSX, and workspace regressions: 4 files, 40 passed, 1 skipped
- Strict TypeScript typecheck: passed
- `git diff --check`: passed

No database schema, migration, environment contract, or API response schema was changed.
