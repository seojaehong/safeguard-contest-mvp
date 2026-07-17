# SafeClaw CI Remediation - 2026-07-18

## Scope

- Investigated the failing GitHub CI run `29610481655` from commit `4f2155c`.
- Remediated the current local failures on top of the current `master` head.
- Kept unrelated screenshot changes out of the remediation scope.

## Fixes

1. Parentless KOSHA action-surface boundary
   - Blocked provider-injected `structuredRiskRows`, `structuredRiskRowsValidationIssues`, and `tbmRiskLinks` from the final deliverables when a technical KOSHA support item lacks a ready SIF/direct parent.
   - Preserved deterministic DB harness rows for valid direct/SIF evidence paths.

2. Generation evidence route comparison contract
   - Relaxed the comparison count assertion from exactly `2` to `>= 2` because the richer KOSHA corpus can legitimately return more comparison-only rows.

3. Frontend audit provenance
   - Regenerated the static frontend consistency report for the current source identity.
   - Rebuilt the app and regenerated the 111-row browser audit report against `http://127.0.0.1:3011`.

4. Share recipient portal handoff reconciliation
   - The read-only handoff for `de4103db` said no recipient portal existed.
   - Current source already contains `/share/[sessionId]` and `/api/share-sessions/[sessionId]`, so no copy-only downgrade was applied in this remediation.

## Verification

- `npm.cmd test -- tests\generation-evidence-operation-routes.test.ts tests\kosha-current-review-run-ask.test.ts tests\commercial-harness.test.ts --maxWorkers=1 --fileParallelism=false`
  - 3 files / 86 tests PASS
- `npm.cmd test -- tests\frontend-route-coverage.test.ts --maxWorkers=1 --fileParallelism=false`
  - 1 file / 39 tests PASS
- `npm.cmd test -- tests\generation-evidence-operation-routes.test.ts tests\kosha-current-review-run-ask.test.ts tests\commercial-harness.test.ts tests\frontend-route-coverage.test.ts --maxWorkers=1 --fileParallelism=false`
  - 4 files / 125 tests PASS
- `npm.cmd run typecheck`
  - PASS
- `npm.cmd run build`
  - PASS, 28/28 static pages
- `npm.cmd run audit:frontend-consistency`
  - PASS, coverage issues 0, violations 0
- `node .\scripts\frontend_consistency_browser_audit.mjs`
  - PASS, 111/111 rows, failed rows 0, findings 0

## Artifacts

- `evaluation/frontend-audit-runner-port-v2-2026-07-11/static-audit.json`
- `evaluation/frontend-audit-runner-port-v2-2026-07-11/browser-report.json`
- `evaluation/frontend-audit-runner-port-v2-2026-07-11/browser-report.md`
