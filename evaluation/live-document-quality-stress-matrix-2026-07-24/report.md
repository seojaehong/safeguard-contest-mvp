# Live Document Quality Stress Matrix

- Verdict: `HONEST_RED_LIVE_PRODUCTION_STRESS_MATRIX`
- Source base before commit: `6a86dc33`
- Scenario manifest: `evaluation/live-document-quality-stress-matrix-2026-07-24/scenarios.json`
- Runner scope: content-contract checks only; no product code changed.

## What changed

The quality matrix runner now supports explicit semantic content contracts:

- `requiredAnyGroups`: at least one term from each semantic group must appear in the selected document text.
- `forbiddenAny`: forbidden overclaiming or unrelated wording must not appear.

This makes the matrix useful for checking scenario specificity beyond generic schema presence.

## Local deterministic result

Raw evidence: `evaluation/live-document-quality-stress-matrix-2026-07-24/local-deterministic/report.json`.

| Scope | Cases | Result |
| --- | ---: | --- |
| Local deterministic stress matrix | 5 | 2 PASS / 3 RED |

Failed contracts:

- `pyeongtaek-simultaneous-overhead-hotwork__stress`: missing explicit work-zone separation / access-control wording.
- `gumi-kosha-guidance-boundary__stress`: missing KOSHA / guidance-reference wording.
- `jeju-overnight-electrical-repair__stress`: missing re-energization and two-person/no-solo-work controls.

## Live production stress result

Raw evidence: `evaluation/live-document-quality-stress-matrix-2026-07-24/live-before/report.json`.

| Scope | Cases | Result |
| --- | ---: | --- |
| Live production stress matrix | 5 | 0 PASS / 5 RED |

Live production failed all five stress scenarios. The failures are not treated as proof that the general document engine is broken; they show that the current output still loses important scenario-specific semantics under sharper field contracts:

- chemical cleaning: missing unidentified chemical / GHS label specificity;
- simultaneous lifting and hot work: missing simultaneous-work and access-control separation;
- vulnerable night maintenance: missing hearing-impaired worker communication controls;
- KOSHA guidance boundary: missing some guarded hazard/worker reflection;
- overnight electrical repair: missing shift handover, fatigue, no-solo-work, and re-energization controls.

## Verification

- `npm.cmd test -- tests\safeclaw-quality-matrix-runner.test.ts --maxWorkers=1 --fileParallelism=false`
- Result: 1 file / 2 tests PASS

## Claim boundary

This is an honest RED discovery artifact, not a launch PASS.

Live production calls were limited to five `POST /api/ask` requests. No DB mutation, Share session creation, provider dispatch, or exact saved `/share/[sessionId]` reproduction was performed.

Next remediation should keep the runner strict and fix product output for the three RED semantic contracts instead of relaxing thresholds.
