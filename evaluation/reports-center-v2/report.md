# Reports Center V2 Remediation Evaluation

Date: 2026-07-11
Branch: `feature/reports-center-v2`
Reviewed remediation baseline: `67d767777b76a91a2a29c7350909b0c51a054039`

## Scope

- Kept the existing Linear-style work-document and right-rail layout.
- Applied daily, weekly, monthly, and custom periods to both the current workpack risk rows and improvement history.
- Standardized period boundaries and rendered timestamps on `Asia/Seoul` calendar time.
- Kept six filters while renaming the unsupported team concept to the actual risk-row assignee/owner.
- Removed improvement-status inference from risk verification and photo approval; DB/API/local/reporting now share `candidate | approved | rejected | reflected`, with only legacy `proposed` mapped losslessly to `candidate`.
- Replaced substring matching with an explicit site/process/task/hazard association that links only when exactly one same-site risk row matches.
- Bound photo approval to the exact improvement ID plus Before/After filename pair and reset approval on reload.
- Added strict RFC3339 offset and real-calendar validation for workpack `savedAt` and improvement `createdAt`.
- Added CSV formula-injection neutralization and complete local/sample source metadata to every export format, including empty CSV results.
- Made no DB schema, migration, Supabase mutation, environment, secret, upload, or remote-state changes.

## Behavioral Evidence

| Contract | Evidence |
| --- | --- |
| Period and timezone | Risk rows use workpack `savedAt`; improvements use `createdAt`; custom midnight, weekly start, labels, and rendering use KST |
| Invalid timestamps | Calendar rollover and offset-free values are rejected; invalid workpack `savedAt` fails report construction and invalid improvement `createdAt` rows are excluded |
| Six filters | Process, task, risk level, explicit improvement status, site, and assignee operate on period-scoped data |
| Improvement status | The DB candidate status is returned by POST and validated into the local snapshot; all four canonical values are preserved and non-lossless legacy values fail closed |
| Risk association | Only an exact, unique, same-site explicit association links an improvement; missing, ambiguous, or cross-site associations remain `미연결` |
| Photo approval | Unapproved names are absent; ID plus both filenames must match; duplicate IDs or incomplete pairs fail closed; a real page reload clears approval |
| CSV safety | Cells beginning with formula-capable prefixes are emitted as text before CSV quoting |
| Source scope | JSON, CSV, report Markdown, corpus JSONL, and corpus Markdown include scope, mode, workpack `savedAt`, `riskRowTimeBasis`, and limitations; CSV has a metadata row even with no result rows |
| UI state | Pure behavior tests cover approval transitions, and Playwright verifies approval is false after an actual `/reports` reload |

## TDD Evidence

Observed follow-up RED before implementation for:

- canonical `candidate`, `rejected`, and `reflected` values being dropped while invented legacy statuses survived;
- calendar rollover and offset-free timestamps being accepted by JavaScript date coercion;
- invalid workpack `savedAt` values reaching report construction;
- a cross-site improvement inheriting another site's process, task, and assignee;
- CSV omitting `riskRowTimeBasis` and limitations, and empty CSV output omitting all metadata values.

The real reload test was added as a browser-level characterization of the existing reset implementation and passed without a UI production change.

## Verification

- `npm.cmd test -- tests/operation-improvement-history.test.ts tests/workpack-commercial.test.ts tests/workpack-improvement-route.test.ts tests/reporting-downloads.test.ts tests/reports-download-center.test.ts`
  - Result: 5 test files passed, 47 tests passed, 0 failed.
- `npm.cmd run typecheck`
  - Result: `tsc --noEmit --incremental false` completed successfully.
- Playwright launched `/reports`, approved an exact Before/After pair, reloaded the page, and verified approval reset to false. The suite closed Chromium and its dynamic-port Next dev server; no test-port server remained.

## Concerns

- The report remains a current-browser snapshot, not durable multi-workpack history. Exports now state this directly.
- Risk rows do not have row-level creation timestamps, so period inclusion uses the enclosing workpack `savedAt`; this basis is included in source metadata.
- Legacy improvement records without `riskAssociation` remain visible as `미연결` and intentionally fail process/task/risk/assignee linkage filters until saved with an explicit association.
- Legacy `proposed` is mapped to canonical `candidate`; invented legacy states without a lossless canonical meaning are excluded instead of guessed.
- Photo evidence remains filenames and analysis metadata rather than binary attachments; only an approved exact pair is exported.
