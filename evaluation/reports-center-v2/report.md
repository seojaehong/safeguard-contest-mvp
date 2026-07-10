# Reports Center V2 Remediation Evaluation

Date: 2026-07-11
Branch: `feature/reports-center-v2`
Reviewed implementation: `626bfb65c4f15342f71e840e4b4cac7271b46e41`

## Scope

- Kept the existing Linear-style work-document and right-rail layout.
- Applied daily, weekly, monthly, and custom periods to both the current workpack risk rows and improvement history.
- Standardized period boundaries and rendered timestamps on `Asia/Seoul` calendar time.
- Kept six filters while renaming the unsupported team concept to the actual risk-row assignee/owner.
- Removed improvement-status inference from risk verification and photo approval; status now comes from the improvement record and legacy records default to `proposed`.
- Replaced substring matching with an explicit site/process/task/hazard association that links only when exactly one risk row matches.
- Bound photo approval to the exact improvement ID plus Before/After filename pair and reset approval on reload.
- Added CSV formula-injection neutralization and local/sample source metadata to every export format.
- Made no DB schema, migration, Supabase mutation, environment, secret, upload, or remote-state changes.

## Behavioral Evidence

| Contract | Evidence |
| --- | --- |
| Period and timezone | Risk rows use workpack `savedAt`; improvements use `createdAt`; custom midnight, weekly start, labels, and rendering use KST |
| Invalid timestamps | Invalid improvement `createdAt` values are rejected by the local-history parser and excluded by period evaluation |
| Six filters | Process, task, risk level, explicit improvement status, site, and assignee operate on period-scoped data |
| Improvement status | Risk verification and photo approval do not promote status; a stored status is preserved |
| Risk association | Only an exact, unique explicit association links an improvement; missing or ambiguous associations remain `미연결` |
| Photo approval | Unapproved names are absent; ID plus both filenames must match; duplicate IDs or incomplete pairs fail closed |
| CSV safety | Cells beginning with formula-capable prefixes are emitted as text before CSV quoting |
| Source scope | JSON, CSV, report Markdown, corpus JSONL, and corpus Markdown include `current_browser` or `sample_preview`, workpack time basis, and limitations |
| UI state | Pure behavior tests cover approval transitions; existing empty/ready/error and preparing/error download states remain wired |

## TDD Evidence

Observed RED before implementation for:

- risk rows surviving outside the selected period;
- UTC rather than KST custom-day boundaries;
- status inherited from risk verification;
- explicit status being ignored;
- substring matching choosing the wrong risk row;
- owner being exposed as a fictional team;
- invalid `createdAt` being accepted;
- photo approval using only an improvement ID;
- CSV formula-capable values remaining executable;
- missing export source scope;
- missing behavior-level photo approval transition helper.

## Verification

- `npm.cmd test -- tests/reporting-downloads.test.ts tests/reports-download-center.test.ts`
  - Result: 2 test files passed, 32 tests passed, 0 failed.
- `npm.cmd run typecheck`
  - Result: `tsc --noEmit --incremental false` completed successfully.
- Browser/Playwright smoke was not rerun for this remediation pass; no visual-layout change was intended beyond the `담당자` label and risk-status removal.

## Concerns

- The report remains a current-browser snapshot, not durable multi-workpack history. Exports now state this directly.
- Risk rows do not have row-level creation timestamps, so period inclusion uses the enclosing workpack `savedAt`; this basis is included in source metadata.
- Legacy improvement records without `riskAssociation` remain visible as `미연결` and intentionally fail process/task/risk/assignee linkage filters until saved with an explicit association.
- Older improvements without an explicit status remain `proposed`; risk verification and photo review do not backfill status.
- Photo evidence remains filenames and analysis metadata rather than binary attachments; only an approved exact pair is exported.
