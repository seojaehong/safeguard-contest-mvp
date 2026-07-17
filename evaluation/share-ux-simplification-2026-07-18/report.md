# Share UX Simplification Patch

Date: 2026-07-18

## Scope

This patch reduces the default manager share panel copy for recording-critical foreign worker distribution. It keeps the existing recipient portal preview contract, dispatch/session behavior, and worker-language message payload contract intact.

## Changed Files

- `components/WorkflowSharePanel.tsx`
- `tests/workspace-share-simplification.test.ts`
- `tests/workflow-share-panel-behavior.test.ts`

## Product Changes

- Replaced the long three-paragraph share header with two short lines:
  - send today's document pack to selected recipients
  - workers confirm from their personal screen
- Shortened recipient language copy from generic "language-specific preparation" to stored worker-language preparation.
- Shortened preview helper text so it says the dropdown only changes the preview language; actual dispatch still uses each worker's saved language.

## Verification

Commands executed on local HEAD before commit:

```powershell
npm.cmd test -- tests\workspace-share-simplification.test.ts tests\workflow-share-panel-behavior.test.ts tests\workflow-share-client.test.ts --maxWorkers=1 --fileParallelism=false
npm.cmd run typecheck
git diff --check
npm.cmd run build
```

Results:

- Focused share tests: 3 files / 48 tests PASS
- Strict typecheck: PASS
- Diff whitespace check: PASS, line-ending warnings only
- Production build: PASS, 28/28 static pages

## Non-Goals

- No DB schema or data changes.
- No dispatch provider behavior changes.
- No removal of audit/provenance data.
- No changes to unrelated screenshot artifacts already dirty in the worktree.
