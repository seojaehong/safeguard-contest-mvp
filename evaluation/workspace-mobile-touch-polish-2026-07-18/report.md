# Workspace Mobile Touch Polish

Date: 2026-07-18
Branch: fix/workspace-mobile-touch-polish-20260718
Base: origin/master 32732305dfd093eba3a9279274c9a186ad06caf0

## Summary

The workspace input screen keeps the simplified first-screen behavior, while mobile interactive controls now meet the 44px touch target budget.

## Changed Files

- app/globals.css
- tests/workspace-input-css-contract.test.ts

## Behavior

- Workspace Day/Night theme buttons stay compact on desktop presentation layouts, but are 44px tall on mobile.
- Collapsed `고급 설정` and `예시 불러오기` disclosures keep the text-link visual style while exposing a 44px hit area.
- Example preset chips on the workspace input page are at least 44px tall.
- Blank workspace input still has no stale current-work/evidence rail context.

## Browser Probe

Local dev URL: `http://localhost:3031/workspace?theme=day`
Viewport: 390x844

- document width/client width: 390/390
- theme buttons: 50x44, 62x44
- collapsed disclosures: 86x44, 108x44
- opened example chips: all 44px tall
- undersized controls in scoped probe: 0

## Verification

- `npm.cmd test -- tests\workspace-input-css-contract.test.ts --maxWorkers=1 --fileParallelism=false`: 1 file / 5 tests PASS
- `npm.cmd test -- tests\frontend-workbench-visual-contract.test.ts tests\workspace-layout-regression.test.ts --maxWorkers=1 --fileParallelism=false`: 2 files / 38 tests PASS, 1 skipped
- `npm.cmd run typecheck`: PASS
- `npm.cmd run audit:frontend-consistency`: static audit PASS, 33 pages / 23 product components / 0 coverage issues / 0 violations
- `npm.cmd test -- tests\frontend-route-coverage.test.ts --maxWorkers=1 --fileParallelism=false`: 1 file / 39 tests PASS

## Notes

The first attempt made the workbench theme toggle 44px globally. That exceeded the short desktop presentation topbar budget, so the final implementation scopes the 44px theme toggle height to the mobile media band and preserves the desktop compact contract.
