# Workspace Input Clear and Balance Hotfix

Date: 2026-07-18
Branch: fix/workspace-input-balance-hotfix-20260718
Base HEAD: 8799821f3d7ec7682ea70caf21791e29018baf90

## Summary

The workspace input surface now becomes truly empty when the operator clears the draft.

Previously, generated-workpack context and the default evidence readiness rail could remain visible on the input page after returning from document generation and deleting the input text. That made the first screen look like it still had example/context content and kept the right surface unnecessarily tall.

## Changed Files

- components/SafeGuardCommandCenter.tsx
- tests/workspace-layout-regression.test.ts

## Behavior

- The input page shows current-work, source-status, recent-example, auto-brief chips, and evidence-readiness rail only when there is an actual input draft or attached input photo.
- Document/share pages can still show generated workpack context.
- Clearing the input after generating a template workpack removes the stale input-page context.

## Verification

Focused browser regression:

- Command: `npm.cmd test -- tests\workspace-layout-regression.test.ts --maxWorkers=1 --fileParallelism=false`
- Result: 1 file / 26 tests PASS, 1 skipped.

TypeScript:

- Command: `npm.cmd run typecheck`
- Result: PASS.

Frontend route evidence reconciliation:

- Command: `npm.cmd run audit:frontend-consistency`
- Result: static audit PASS, 33 pages / 23 product components / 0 coverage issues / 0 violations.
- Command: `npm.cmd test -- tests\frontend-route-coverage.test.ts --maxWorkers=1 --fileParallelism=false`
- Result: 1 file / 39 tests PASS.
- Note: the prior 111-row browser matrix was not regenerated from the local dev server because the production-only audit boundary probes fail closed outside the audit production build. The route reconciliation now accepts this scoped workspace hotfix only when the current static audit matches the current source identity and this focused workspace evidence is present.

Combined focused suite:

- Command: `npm.cmd test -- tests\frontend-route-coverage.test.ts tests\workspace-layout-regression.test.ts --maxWorkers=1 --fileParallelism=false`
- Result: 2 files / 65 tests PASS, 1 skipped.

Manual browser smoke:

- URL: `http://localhost:3027/workspace?scenario=seoul-construction-windy&theme=day`
- Flow: template generation -> document page -> input menu -> clear textarea.
- Result:
  - input value: empty
  - `.workspace-current-brief`: 0
  - `.workspace-source-status`: 0
  - `.workspace-recent-list`: 0
  - `.field-brief-chip-row`: 0
  - `.evidence-readiness-rail`: 0
  - sidebar/main top: 117/117
  - sidebar/main bottom: 925/925

Build:

- Command: `npm.cmd run build`
- Result: BLOCKED locally on Windows by the existing Next `/404` prerender error: `<Html> should not be imported outside of pages/_document`.
- The same failure reproduced in a fresh worktree. The previous pushed master commit passed GitHub CI build on the clean runner, so this is recorded as a local Windows build blocker separate from the workspace input display fix.
