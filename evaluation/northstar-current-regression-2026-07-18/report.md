# North Star Current Regression Pass

Date: 2026-07-18
Head: `cd0e8a17323e34f5fcb9a736b3f1d06bcd4b6f0f`

## Purpose

This pass separates current launch evidence from stale read-only audits and old worktree candidates. It does not redefine the North Star goal as complete.

## KOSHA Exact Trust Status

Committed and pushed:

- Commit: `cd0e8a17` (`fix: expose exact kosha trust status`)
- CI: GitHub Actions run `29627126247`, success
- Deployment: production deployment `5498151869`, success
- Live probe: `https://www.safeclaw.kr/api/safety-reference/status`

Live response summary:

```text
StatusCode: 200
status: ready
searchReady: true
exactTrustRegistry.status: ready
exactTrustRegistry.count: 3
stableDocumentKeys: D-C-13,D-C-7,B-E-10
versions: D-C-13-2026,D-C-7-2026,B-E-10-2026
```

## Current UI/UX Revalidation

The following checks were rerun against the current head or production where explicitly noted:

```text
npm.cmd test -- tests/workpack-share-authority-routes.test.ts tests/workspace-share-simplification.test.ts tests/workspace-share-mobile-browser.test.ts --maxWorkers=1 --fileParallelism=false
PASS: 3 files / 44 tests

npm.cmd test -- tests/workspace-layout-regression.test.ts -t "blank generation" --maxWorkers=1 --fileParallelism=false
PASS: 1 focused test / 25 skipped

npm.cmd test -- tests/why-mobile-layout.test.ts --maxWorkers=1 --fileParallelism=false
PASS: 1 file / 4 tests

$env:ONTOLOGY_BASE_URL='https://www.safeclaw.kr'; npm.cmd test -- tests/ontology-ui-browser.test.ts tests/ontology-tablet-overflow.test.ts --maxWorkers=1 --fileParallelism=false
PASS: 2 files / 3 tests

npm.cmd test -- tests/product-module-shell.test.ts tests/frontend-shared-surfaces.test.ts --maxWorkers=1 --fileParallelism=false
PASS: 2 files / 19 tests

npm.cmd test -- tests/documents-editor-layout.test.ts -t "contrast" --maxWorkers=1 --fileParallelism=false
PASS: 4 focused tests / 26 skipped
```

Current interpretation:

- `/share/[sessionId]` recipient portal exists on the current head and is covered by share authority tests.
- Blank workspace generation now focuses the textarea, shows `role="alert"`, marks `aria-invalid`, and avoids `/api/ask` calls.
- `/why` mobile overflow and `/ontology` graph usability blockers from older production audits are not reproduced by current targeted tests.
- Module shell and document contrast gates are green on current tests.

## Candidate Triage

Reviewed candidate commits from export/localization worktrees are not all safe to range-merge because their branches are older than current master and broad diffs include large deletion/reversion risk.

Findings:

- `2633b604` PDF enum localization is not an ancestor of current head, but its product/test file diff against current head is empty. The behavior appears already integrated through another path.
- Current focused PDF/export tests passed:
  - `npm.cmd test -- tests/pdf-korean-font-integration.test.ts tests/document-export-localization.test.ts --maxWorkers=1 --fileParallelism=false`
  - PASS: 2 files / 26 tests
- Excel/HWPX/XLSX/web candidates have old-base broad diffs and should not be range-merged. Only exact, freshly reviewed, conflict-checked hunks should be considered.
- Current focused export tests passed:
  - `npm.cmd test -- tests/xlsx-export-route.test.ts tests/document-export-localization.test.ts --maxWorkers=1 --fileParallelism=false`
  - PASS: 2 files / 18 tests

## Remaining North Star Work

This report does not close the active goal. Remaining high-value work includes:

- Continue current-state audits for routes not covered by the focused tests.
- Keep integrating only reviewed, exact, non-regressive worktree outputs.
- Expand runtime status from configured trust pins toward stronger exact asset integrity evidence if needed.
- Continue Phase A / Phase B separation for SIF -> KOSHA Guide -> law grounding, Hermes adapter boundaries, and LLM wiki governance.
