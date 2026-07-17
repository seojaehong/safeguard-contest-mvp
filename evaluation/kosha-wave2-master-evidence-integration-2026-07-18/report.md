# KOSHA Wave 2 Evidence Integration

## Summary

This pass integrates the reviewed KOSHA wave 2 evidence correction onto current `master` without changing product code, DB schema, or Supabase data.

The important correction is evidence honesty: the exact trust registry product path is treated as passing, while the historical 34-file broad KOSHA/SIF/ontology run remains recorded as RED because `tests/kosha-guide-corpus-audit.test.ts` had 3 unresolved failures. The broad run is not reclassified as a pass.

## Integrated Commits

- `41355b47` `docs: correct KOSHA wave2 focused evidence`
- `e78e6eaf` `chore: normalize KOSHA wave2 evidence log`

The intermediate upstream documentation commit was empty after conflict resolution because the final reviewed report content was applied in `41355b47`.

## Changed Files

- `evaluation/kosha-trust-registry-wave2-2026-07-16/report.md`
- `evaluation/kosha-trust-registry-wave2-2026-07-16/report.json`
- `evaluation/kosha-trust-registry-wave2-2026-07-16/kosha-sif-ontology-tests.log`

## Current Verification

- Conflict markers: none
- `report.json`: valid JSON
- DB mutation: false
- Schema mutation: false
- Focused Vitest on current master:
  - Command: `npm.cmd test -- tests/exact-kosha-applicability-policy.test.ts tests/exact-trusted-kosha-grounding.test.ts tests/exact-trusted-kosha-registry-wave2.test.ts tests/kosha-grounding-fail-closed.test.ts --maxWorkers=1 --fileParallelism=false`
  - Result: 4 files / 49 tests PASS
- Python acquisition tests:
  - Command: `python -m unittest scripts.tests.test_acquire_exact_kosha_body`
  - Result: 19 tests PASS
- Strict TypeScript:
  - Command: `npm.cmd run typecheck`
  - Result: PASS

## Remaining Boundary

This does not claim the historical broad KOSHA/SIF/ontology suite is green. The reviewed evidence package now explicitly records it as unresolved RED, while preserving the exact-trust product path and current focused gates as passing.
