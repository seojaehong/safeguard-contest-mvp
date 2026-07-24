# Live Document Quality Stress Matrix

- Verdict: `PASS_LIVE_PRODUCTION_STRESS_MATRIX`
- Source base before commit: `6a86dc33`
- Product commit: `6ddf66b58952674be29924064b061a0f6e7e5241`
- Production commit at live verification: `fa5aa4de49990dafe12f65ea3488c580e96c157f`
- Product commit included in production lineage: `true`
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

## Current-source local production after remediation

Raw evidence: `evaluation/live-document-quality-stress-matrix-2026-07-24/after-local/report.json`.

| Scope | Cases | Result |
| --- | ---: | --- |
| Current-source local production stress matrix | 5 | 5 PASS / 0 RED |

The local run used a production build from product commit `6ddf66b5` after the scenario-specificity fix and the corrected Gumi manifest contract. Local runtime build-info was unavailable, so this is source/build-bound evidence rather than a deployed marker claim. It called only the local `/api/ask` endpoint and did not create saved Share data.

## Live production after remediation

Raw evidence: `evaluation/live-document-quality-stress-matrix-2026-07-24/after-live/report.json`.

| Scope | Cases | Result |
| --- | ---: | --- |
| Live production stress matrix | 5 | 5 PASS / 0 RED |

Production `/api/build-info` reached `fa5aa4de49990dafe12f65ea3488c580e96c157f`, and the same five stress scenarios then passed against `https://www.safeclaw.kr`.

## Verification

- `npm.cmd test -- tests\safeclaw-quality-matrix-runner.test.ts --maxWorkers=1 --fileParallelism=false`
- Result: 1 file / 2 tests PASS
- `npm.cmd test -- tests\scenario-inference.test.ts --maxWorkers=1 --fileParallelism=false`
- Result: 1 file / 32 tests PASS
- Combined product/runner regression: 4 files / 50 tests PASS
- Typecheck PASS
- Next production build PASS, 28/28 static pages

## Claim boundary

This is a live production stress-matrix PASS for the five measured scenarios.

Live production calls were limited to ten `POST /api/ask` requests: five before-remediation RED calls and five after-remediation PASS calls. Current-source after-remediation calls were local only. No DB mutation, Share session creation, provider dispatch, or exact saved `/share/[sessionId]` reproduction was performed.

This five-scenario stress PASS does not replace broad human wording review, exact saved Share geometry, provider dispatch approval, or DB/RLS approval gates.
