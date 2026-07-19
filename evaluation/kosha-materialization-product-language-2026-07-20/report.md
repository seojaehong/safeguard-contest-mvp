# KOSHA Materialization Product Language Check

Date: 2026-07-20

Branch: `fix/kosha-materialization-20260720`

Base HEAD: `a1e92295aa27ebe2576064decde07111f86731d7`

## Verdict

PASS. The Phase A document materialization boundary now keeps the canonical provenance contract while removing user-facing internal English labels from the inserted review rows.

## What Changed

- The canonical review row still carries the stable key and all SIF/KOSHA/law provenance.
- User-facing labels changed from `stableKey`, `KOSHA guidance UID`, and `mandatedBy law UID` to Korean product labels:
  - `검토행 ID`
  - `SIF 유사사례 근거`
  - `KOSHA 기술지침 근거`
  - `법령 근거`
- KOSHA materialization now includes guide code, physical page, and the guide support statement, so the generated document shows what the guide contributed instead of only listing a UID.
- The output remains `검토 필요` and human-confirmation gated. This does not claim legal compliance or KOSHA corpus launch readiness.

## Verification

| Gate | Result |
| --- | --- |
| `npm.cmd test -- tests\phase-a-product-materialization.test.ts tests\claw-tools-phase-a-materialization.test.ts tests\kosha-materialization-matrix.test.ts --maxWorkers=1 --fileParallelism=false` | PASS, 3 files / 55 tests |
| `npm.cmd test -- tests\exact-trusted-kosha-grounding.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\exact-trusted-kosha-registry-wave3.test.ts tests\kosha-grounding-fail-closed.test.ts tests\kosha-current-review-run-ask.test.ts tests\exact-kosha-applicability-policy.test.ts tests\kosha-materialization-matrix.test.ts tests\phase-a-product-materialization.test.ts tests\claw-tools-phase-a-materialization.test.ts --maxWorkers=1 --fileParallelism=false` | PASS, 9 files / 169 tests |
| `python -m unittest scripts.tests.test_acquire_exact_kosha_body` | PASS, 19 tests |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run build` | PASS, 28/28 static pages |

## Remaining Boundary

`KOSHA_CORPUS_STATE` is still not launch-ready (`launchReady=false`, `productionChunkBridge=absent`). That is intentionally preserved. This patch improves product wording and guide reflection inside the materialized document rows; it does not alter trust pins, registry assets, DB schema, retrieval ranking, or legal duty classification.
