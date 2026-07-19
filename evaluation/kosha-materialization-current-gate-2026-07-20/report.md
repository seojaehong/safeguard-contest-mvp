# KOSHA / Phase A Materialization Current Gate

- Checked at: 2026-07-20 KST
- Git HEAD: `d7227e55d52fedcece292af70584012491659976`
- Branch: `fix/kosha-materialization-20260720`
- Scope: KOSHA exact trust registry, KOSHA applicability, fail-closed grounding, Phase A product materialization, Claw tool materialization

## Verdict

PASS.

The current HEAD preserves the SIF/KOSHA-first evidence harness and Phase A materialization contract in the focused gate. This does not claim a full-site UX pass or a Supabase migration approval.

## Verification

| Gate | Command | Result |
| --- | --- | --- |
| KOSHA + Phase A focused Vitest | `npm.cmd test -- tests\exact-trusted-kosha-grounding.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\exact-trusted-kosha-registry-wave3.test.ts tests\kosha-grounding-fail-closed.test.ts tests\kosha-current-review-run-ask.test.ts tests\exact-kosha-applicability-policy.test.ts tests\kosha-materialization-matrix.test.ts tests\phase-a-product-materialization.test.ts tests\claw-tools-phase-a-materialization.test.ts --maxWorkers=1 --fileParallelism=false` | PASS, 9 files / 169 tests |
| KOSHA acquisition Python tests | `python -m unittest scripts.tests.test_acquire_exact_kosha_body` | PASS, 19 tests |
| Strict typecheck | `npm.cmd run typecheck` | PASS |
| Production build | `npm.cmd run build` | PASS, Next.js 15.5.15, 28/28 static pages |

## Notes

- This gate checks the current implementation boundary, not a new database migration.
- The evidence hierarchy remains: SIF/KOSHA grounding first, law/Article as mandate validation, LLM limited to document naturalization/materialization.
- Live share desktop smoke is recorded separately under `evaluation/live-share-desktop-smoke-2026-07-20/`.
