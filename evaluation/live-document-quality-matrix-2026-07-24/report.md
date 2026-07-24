# Live Document Quality Matrix Remediation

- Verdict: `PASS_LIVE_PRODUCTION_MULTI_SCENARIO_DOCUMENT_QUALITY`
- Source/product commit: `74d7fe3c13c5f757b0feec67760438a83ad5cc77`
- Production at final verification: `74d7fe3c13c5f757b0feec67760438a83ad5cc77`
- Scenario manifest: `evaluation/live-document-quality-matrix-2026-07-24/scenarios.json`

## Scope

This approval-free matrix calls only `POST /api/ask`. It covers forklift logistics, hot work with foreign workers, confined-space pump inspection, press maintenance, and road excavation. It does not save a workpack, create a Share session, mutate the DB, or send a provider message.

## Before

The strengthened gate ran against live production `8c76632a`.

| Scope | Base URL | Cases | Result | Elapsed |
| --- | --- | ---: | --- | ---: |
| Live before remediation | `https://www.safeclaw.kr` | 5 | 4 PASS / 1 RED | 123182 ms |

The hot-work foreign-worker scenario failed `reflection:foreignWorkerScenarioRelevance`. Eight legacy generic translated phrases named strong wind, forklifts, chemicals, or fall hazards even though those risks were not part of that scenario. The raw report is `evaluation/live-document-quality-matrix-2026-07-24-before-remediation/report.json`.

The investigation also exposed that AI-authored structured risk rows could pass schema validation when `currentControls` and `additionalControls` were identical. The strengthened matrix now checks that structured rows exist and that both control fields are distinct.

## Remediation

- Generic multilingual fallback sentences now say to stop and report an unsafe condition without inventing named hazards.
- AI-authored risk rows with duplicate current/additional controls receive a distinct field-verification and work-hold action.
- The matrix accepts semantically equivalent stop-work and vehicle-collision wording while adding strict structured-row and scenario-relevance checks.

## Current-Source Verification

The rebuilt current source ran on `http://127.0.0.1:3076`. Local build-info did not expose a commit marker, so the server was launched immediately after building source commit `74d7fe3c`; this is not presented as live production proof.

| Scope | Cases | Result | Structured rows | Distinct controls | Foreign-worker relevance |
| --- | ---: | --- | --- | --- | --- |
| Current-source local production | 5 | 5 PASS / 0 RED | PASS | PASS | PASS |

Raw evidence: `evaluation/live-document-quality-matrix-2026-07-24-after-local/report.json`.

Verification also passed:

- Focused regression: 4 files / 79 tests
- `npm.cmd run build`
- `npm.cmd run typecheck`
- `git diff --check`

## Live After

Production `/api/build-info` reached product commit `74d7fe3c` at deployment `safeguard-contest-66ahyzxsn-seojaehongs-projects.vercel.app`. The same five-scenario matrix then passed live:

| Scope | Cases | Result | Structured rows | Distinct controls | Foreign-worker relevance |
| --- | ---: | --- | --- | --- | --- |
| Live production after remediation | 5 | 5 PASS / 0 RED | PASS | PASS | PASS |

Raw evidence: `evaluation/live-document-quality-matrix-2026-07-24-after-live/report.json`.

## Claim Boundary

Allowed claim: the scenario-specific document-control patch passes current-source local production and deployed live production across the five measured domains.

Exact saved `/share/[sessionId]` geometry remains outside this matrix and remains missing evidence without a real URL or an approved session-creation flow.
