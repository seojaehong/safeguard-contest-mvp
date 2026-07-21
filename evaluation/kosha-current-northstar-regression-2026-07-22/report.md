# KOSHA Current North Star Regression Gate

Verdict: `PASS`

Checked at: `2026-07-21T21:35:00.706Z`

Source/live commit: `dbe9fed5896150ff2977d68303771764f41e82d6`

## What This Proves

- Exact trusted KOSHA pins remain available and fail-closed.
- KOSHA guide corpus audit remains green.
- Structured `riskAssessmentRows` preserve exact KOSHA `evidenceRefs`.
- Structured `tbmRiskLinks` preserve exact KOSHA `evidenceRefs`.
- Grounded generation and live harness quality gates still pass.
- Live KOSHA status reports `9,920` catalog items, `1,040` technical rows, and the 3-pin exact trust registry at the current production commit.

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Structured materialization + harness | `npm.cmd test -- tests\kosha-materialization-matrix.test.ts tests\grounded-generation-contract.test.ts tests\live-harness-quality-probe.test.ts --maxWorkers=1 --fileParallelism=false` | PASS, 3 files / 50 tests |
| Exact trust + corpus | `npm.cmd test -- tests\exact-trusted-kosha-grounding.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\kosha-grounding-fail-closed.test.ts tests\kosha-current-review-run-ask.test.ts tests\kosha-guide-corpus-audit.test.ts --maxWorkers=1 --fileParallelism=false` | PASS, 5 files / 173 tests |
| Live gate unit | `npm.cmd test -- tests\kosha-current-live-gate.test.ts --maxWorkers=1 --fileParallelism=false --testTimeout=90000` | PASS, 1 file / 3 tests |
| Combined focused regression | `npm.cmd test -- tests\kosha-materialization-matrix.test.ts tests\grounded-generation-contract.test.ts tests\live-harness-quality-probe.test.ts tests\exact-trusted-kosha-grounding.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\kosha-grounding-fail-closed.test.ts tests\kosha-current-review-run-ask.test.ts tests\kosha-guide-corpus-audit.test.ts tests\kosha-current-live-gate.test.ts --maxWorkers=1 --fileParallelism=false --testTimeout=90000` | PASS, 9 files / 226 tests |
| Live production KOSHA gate | `npm.cmd run gate:kosha-live -- --output evaluation\kosha-current-live-gate-2026-07-20 --base-url https://www.safeclaw.kr` | PASS, failedCheckIds `[]` |
| TypeScript | `npm.cmd run typecheck` | PASS |

## Live Runtime Summary

- Catalog items: `9,920`
- KOSHA technical rows: `1,040`
- Technical guides/support regulations: `803 / 237`
- Local corpus: `234` items, `7,127` chunks, `0` failures
- Exact registry: `D-C-13-2026`, `D-C-7-2026`, `B-E-10-2026`

## Boundaries

- This does not claim every KOSHA guide in the broader corpus is exact-published production evidence.
- This does not claim SIF vector retrieval is production-active.
- No DB migration, Supabase write, embedding generation, or vector upload was performed.
- This does not claim live provider dispatch.
