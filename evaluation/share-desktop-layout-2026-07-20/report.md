# Share Desktop Layout Check - 2026-07-20

## Verdict

PASS for bounded desktop share layout remediation.

The previous share surface passed functional tests but still read visually like a narrow mobile card floating inside the desktop workspace. This patch keeps the approved share workflow intact while making the desktop breakpoint a full-width two-column workbench:

- Left: today recipients, channel state, language selector
- Right: message preview, single primary CTA

## Changes

- Expanded desktop share panel to the 1180px workbench width.
- Replaced the desktop 3-card row with a single left-column workflow stack.
- Kept the message preview and primary CTA in a dedicated right execution column.
- Removed excess desktop step-page padding for the share state.
- Kept mobile rules untouched.

## Verification

- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts --maxWorkers=1 --fileParallelism=false`
  - 1 file / 1 test PASS
  - Confirms full Vietnamese message retention, bounded preview, single CTA, desktop task-distance budget, mobile task-distance budget, and horizontal overflow 0.
- `npm.cmd test -- tests\workspace-share-simplification.test.ts tests\workflow-share-client.test.ts tests\workflow-share-panel-behavior.test.ts tests\workpack-share-authority-routes.test.ts tests\frontend-workbench-visual-contract.test.ts --maxWorkers=1 --fileParallelism=false`
  - 5 files / 98 tests PASS
- `npm.cmd run typecheck`
  - PASS
- `npm.cmd run build`
  - PASS, 28/28 static pages
- `git diff --check`
  - PASS, line-ending warning only

## Evidence

- Updated screenshots:
  - `evaluation/share-mobile-p1/screenshots/desktop-day-vietnamese.png`
  - `evaluation/share-mobile-p1/screenshots/desktop-night-vietnamese.png`
  - `evaluation/share-mobile-p1/screenshots/mobile-390-day-vietnamese.png`
  - `evaluation/share-mobile-p1/screenshots/mobile-390-night-vietnamese.png`

## Remaining Scope

This patch does not change dispatch authority, provider configuration, login, or share-session data contracts. It is a bounded UI composition fix for the already-approved share workflow.
