# Share Staged Flow Rail Gate

Checked at: 2026-07-21 KST

## Verdict

`PASS_CURRENT_SOURCE`

The share surface now makes the delivery workflow explicit instead of reading like a loose mobile card stack. The default share panel shows a four-step rail: target, channel, language, dispatch. Desktop keeps the two-pane composition with settings on the left and the message/confirmation preview on the right.

This is a bounded IA slice. It does not claim live provider dispatch completion or the final paid delivery workflow.

## Source

- Product commit: `b35421e07dafed3dc61f6a6406ee75d7df36d0ef`
- Branch: `chore/recipient-foreign-live-gate-20260720`

## What changed

- Added `data-share-stage-rail` with four explicit steps:
  - `01 대상`
  - `02 채널`
  - `03 언어`
  - `04 전송`
- Desktop `/workspace?share` places the rail between the workflow header and the two-pane work area.
- The settings form and preview now both start after the stage rail, preventing the preview grid row from pushing the form downward.
- Standalone `/dispatch` remains compact and hides the rail to preserve the existing sample-module height guard.
- Share/dispatch CSS was tightened so the CTA and preview remain in the first viewport.

## Verification

- `npm.cmd test -- tests\workspace-share-simplification.test.ts --maxWorkers=1 --fileParallelism=false`
  - 1 file / 11 tests PASS
- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts -t "keeps localized worker dispatch previews bounded|standalone dispatch" --maxWorkers=1 --fileParallelism=false`
  - 1 file / 2 tests PASS
- `npm.cmd test -- tests\workspace-share-simplification.test.ts tests\workspace-share-mobile-browser.test.ts -t "keeps only the four-step delivery sequence|uses a real desktop two-pane share composition|keeps localized worker dispatch previews bounded|standalone dispatch" --maxWorkers=1 --fileParallelism=false`
  - 2 files / 4 tests PASS
- `npm.cmd run typecheck`
  - PASS
- `git diff --check`
  - PASS

## Fresh geometry evidence

- `/workspace?share` desktop day 1440x900:
  - stage rail item count: 4
  - stage columns: 4
  - horizontal overflow: 0
  - primary CTA bottom: 461
  - preview bottom: 817
  - stage rail bottom: 849
- `/dispatch?theme=day` desktop 1440x900:
  - root width: 1156
  - root height: 626
  - primary CTA bottom: 542
  - preview bottom: 798
  - horizontal overflow: 0

## Remaining debt

- This is current-source evidence, not production live geometry evidence.
- Actual provider dispatch, billing conversion, and channel-specific live delivery remain gated by provider configuration and auth.
- The share flow still needs final recipient/channel/message/result copy polish after live deployment.
