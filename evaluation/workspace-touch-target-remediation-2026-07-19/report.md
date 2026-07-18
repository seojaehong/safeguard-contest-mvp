# Workspace Touch Target Remediation (2026-07-19)

## Scope

- Tightened the workspace topbar brand link, photo attachment input overlay, and AI mode controls so the input screen remains touch-safe for launch video capture.
- Preserved the existing workspace layout, share recipient portal, ontology, why, and knowledge surfaces.

## Changes

- `app/globals.css`
  - `brand-lockup` now exposes a 44px interactive box while preserving the prior layout height with block-axis margin compensation.
  - `composer-attach-button input` now inherits the 44px control hit target instead of measuring below the button target.
  - `ai-mode-option` rows are locked to the 44px control target and their radio controls are enlarged to 20px.
- `tests/workspace-input-css-contract.test.ts`
  - Added CSS contract assertions for the brand link, hidden file input hit target, and AI radio/row sizing.

## Verification

- `npm.cmd test -- tests\workspace-input-css-contract.test.ts --maxWorkers=1 --fileParallelism=false`
  - 1 file / 5 tests PASS
- `npm.cmd test -- tests\workspace-input-css-contract.test.ts tests\workspace-layout-regression.test.ts --maxWorkers=1 --fileParallelism=false`
  - 2 files / 31 tests PASS / 1 skipped
- `npm.cmd test -- tests\ontology-ui-browser.test.ts tests\why-mobile-layout.test.ts tests\knowledge-mobile-ia-browser.test.ts tests\share-recipient-portal-browser.test.ts --maxWorkers=1 --fileParallelism=false`
  - 3 files PASS / 1 skipped; 12 tests PASS / 1 skipped
- `npm.cmd run typecheck`
  - PASS
- `npm.cmd run build`
  - PASS, 28/28 static pages
- `git diff --check`
  - PASS, line-ending warnings only
- `npm.cmd run audit:frontend-consistency`
  - PASS, `evaluation/frontend-audit-runner-port-v2-2026-07-11/static-audit.json` regenerated with source identity `6273ff8cba82fa14a9ec0965212cff40b79dd036805ef953c34c5b20d237b5f6`
- `npm.cmd test -- tests\frontend-route-coverage.test.ts --maxWorkers=1 --fileParallelism=false`
  - 1 file / 39 tests PASS

## Live Baseline

Before this patch, `evaluation/north-star-live-ui-surface-2026-07-19/report.md` confirmed the deployed `abeb8e6197d18138d7b1c177bef38cd576d2a4de` surface had no route overflow, no ontology overlap, no internal-term exposure in the sampled launch routes, and only remaining small-target samples concentrated around workspace chrome/file/radio controls.
