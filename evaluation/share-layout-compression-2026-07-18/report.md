# Share Layout Compression Patch

Date: 2026-07-18

## Scope

This patch keeps the existing share workflow behavior and recipient portal contract, but reduces the default manager share screen height for recording-critical demos.

## Changed Files

- `app/globals.css`
- `tests/frontend-workbench-visual-contract.test.ts`
- `evaluation/frontend-audit-runner-port-v2-2026-07-11/static-audit.json`
- `evaluation/frontend-audit-runner-port-v2-2026-07-11/browser-report.json`
- `evaluation/frontend-audit-runner-port-v2-2026-07-11/browser-report.md`

## Product Changes

- The three share setup cards now render in a compact desktop row:
  - today recipients
  - channel
  - language preview
- Recipient card no longer spans the entire row on desktop.
- Message preview remains fully visible without inner scrolling to preserve the existing browser contract.
- Mobile/container behavior remains single-column through the existing module container rule.

## Verification

Commands executed:

```powershell
npm.cmd test -- tests\frontend-workbench-visual-contract.test.ts tests\workspace-share-simplification.test.ts tests\workflow-share-panel-behavior.test.ts tests\workflow-share-client.test.ts --maxWorkers=1 --fileParallelism=false
npm.cmd run audit:frontend-consistency
npm.cmd test -- tests\frontend-workbench-visual-contract.test.ts tests\workspace-share-simplification.test.ts tests\workflow-share-panel-behavior.test.ts tests\workflow-share-client.test.ts tests\frontend-route-coverage.test.ts --maxWorkers=1 --fileParallelism=false
npm.cmd run typecheck
git diff --check
npm.cmd run build
```

Results:

- Initial focused share/visual tests: 4 files / 60 tests PASS
- Static frontend consistency audit: PASS, coverage issues 0, violations 0
- Share + route coverage focused set: 5 files / 99 tests PASS
- Strict typecheck: PASS
- Diff whitespace check: PASS, line-ending warnings only
- Production build: PASS, 28/28 static pages

## Non-Goals

- No dispatch API or provider behavior changes.
- No DB schema or data changes.
- No change to worker recipient portal route behavior.
- No staging of unrelated screenshot artifacts already dirty in the worktree.

## CI Follow-Up

Initial run `29618621125` correctly rejected the first version of this patch because it capped the message preview at 168px and introduced hidden inner content. The browser contract requires the complete outgoing message preview to remain visible without an internal scrollbar. The follow-up keeps the desktop three-card compression but restores the preview lines to `max-height: none` and `overflow: visible`.
