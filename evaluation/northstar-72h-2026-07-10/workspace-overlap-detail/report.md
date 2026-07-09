# Workspace Overlap Detail Check

Date: 2026-07-10

## Issue

The day workspace looked overlapped again on a short presentation screen. The visible symptom was not a fixed header covering the input. The page was taller than the first fold, so focusing or filling the textarea caused the browser to auto-scroll the shell.

## Reproduction

Production before this patch:

- Viewport: 1440 x 460 CSS px
- URL: `https://www.safeclaw.kr/workspace?theme=day`
- Artifact: `prod-day-1440x460-filled.png`
- Metrics: `prod-day-1440x460-filled-metrics.json`

Observed:

- `scrollY`: 80
- `textarea.bottom`: 545, below viewport height 460
- `helper.top`: 573, below first fold
- `topbar.top`: -68, so the top shell was scrolled away

Root cause:

- The outer workbench card had class `workspace-input-page`.
- The inner actual input page also had class `workspace-input-page`.
- Day theme and overlap guard CSS applied page padding to both boxes in some viewport states.

## Fix

- Renamed the outer card state class to `workspace-view-input`, `workspace-view-document`, `workspace-view-share`.
- Kept `workspace-input-page` only on the actual input page section.
- Added a compact first-fold contract only for zoom-sized short screens: `min-width: 901px` and `max-height: 560px`.
- Added a regression test that fills the textarea on a 1440 x 460 viewport and verifies no auto-scroll occurs.

## After Fix

Local after patch:

- Artifact: `local-after-day-1440x460-filled.png`
- Metrics: `local-after-day-1440x460-filled-metrics.json`

Observed:

- `scrollY`: 0
- `inputPageCount`: 1
- `mainHasLegacyPageClass`: false
- `textarea.bottom`: 416, inside viewport height 460
- `helper.top`: 440, still visible in first fold
- `topbar.bottom`: 72, `viewport.top`: 104

## Verification

```powershell
npm.cmd test -- tests\workspace-layout-regression.test.ts
npm.cmd test -- tests\workspace-layout-regression.test.ts tests\risk-row-normalization.test.ts tests\quality-contract.test.ts tests\workpack-ontology-qa.test.ts tests\commercial-harness.test.ts
npm.cmd run typecheck
npm.cmd run build
```

Results:

- Workspace layout regression: 7 tests passed.
- Focused harness/layout suite: 5 files, 31 tests passed.
- Typecheck passed.
- Production build passed.
