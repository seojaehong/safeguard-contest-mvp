# KOSHA Current Gate

Checked at: 2026-07-20 KST

## Verdict

PASS on current master lineage through `2144b5ba`.

The current tree preserves the SafeClaw evidence hierarchy: SIF/KOSHA exact references feed the evidence harness first, legal/ontology classification validates and labels the resulting controls, and the LLM remains constrained to document materialization rather than fact invention.

## Verified Scope

- Exact trusted KOSHA registry: D-C-13, D-C-7, B-E-10.
- Wave 2 evidence package contradiction is already corrected in `evaluation/kosha-trust-registry-wave2-2026-07-16/report.md` and `report.json`; the old broad-suite failure remains recorded as historical unresolved RED, not a PASS or hang.
- D-C-7 scaffold guidance materialization remains wired into risk assessment/TBM outputs.
- Phase-A product materialization and claw tools keep the SIF/KOSHA/law provenance boundary.
- No DB schema change, Supabase mutation, or corpus bulk mutation was performed.

## Verification

| Gate | Result |
| --- | --- |
| `npm.cmd test -- tests\exact-trusted-kosha-grounding.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\exact-trusted-kosha-registry-wave3.test.ts tests\kosha-grounding-fail-closed.test.ts tests\kosha-current-review-run-ask.test.ts tests\exact-kosha-applicability-policy.test.ts tests\kosha-materialization-matrix.test.ts tests\phase-a-product-materialization.test.ts tests\claw-tools-phase-a-materialization.test.ts --maxWorkers=1 --fileParallelism=false` | PASS, 9 files / 169 tests |
| `python -m unittest scripts.tests.test_acquire_exact_kosha_body` | PASS, 19 tests |

## Notes

- This is a current-state recheck, not a new KOSHA corpus expansion.
- The metadata-verified KOSHA candidate pool remains outside production direct evidence until exact body/PDF/provenance pins and human review receipts are completed.
- The next north-star KOSHA step is broadening exact-pinned guide coverage while keeping the same fail-closed registry, query applicability, and materialization tests.
