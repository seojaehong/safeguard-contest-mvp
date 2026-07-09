# Workspace Ultra-Short Zoom Overlap Report

Date: 2026-07-10

## Issue

The reported screenshot matches a high-zoom or high-DPI presentation condition where the physical screenshot is wide, but the CSS viewport is much shorter and closer to `1024 x 319`.

The existing layout regression suite covered `1024 x 430`, `1170 x 365`, `1365 x 425`, `1440 x 460`, `1600 x 820`, `2048 x 638`, but not the `1024 x 319` ultra-short case.

## Reproduction Evidence

Live probe before this patch:

- URL: `https://www.safeclaw.kr/workspace?theme=day`
- Viewport: `1024 x 319`, `deviceScaleFactor=2`
- Screenshot: `evaluation/northstar-72h-2026-07-10/workspace-ultrashort-zoom-overlap/live-workspace-overlap-css1024x319-dsf2.png`
- Measured composer bottom: `351`
- Viewport height: `319`
- Result: input action bar was clipped below the first viewport.

Reference live desktop probe:

- Viewport: `2048 x 638`
- Screenshot: `evaluation/northstar-72h-2026-07-10/workspace-ultrashort-zoom-overlap/live-workspace-overlap-2048x638.png`
- Result: wide desktop was not the failing condition.

## Fix

Added an ultra-short workspace guard:

- Compact topbar from 60px to 42px.
- Hide non-essential brand subtitle, topbar status caption, and workspace title caption.
- Collapse the first-screen hero copy on ultra-short viewports.
- Keep only the field input label, textarea, photo attachment, and generate action.
- Narrow the left rail to 220px and reduce row density only for `max-height: 340px`.

This preserves the normal Day/Night workbench design while making high-zoom presentation screens usable.

## Local Verification

Local probe after patch:

- URL: `http://127.0.0.1:3234/workspace?theme=day`
- Viewport: `1024 x 319`, `deviceScaleFactor=2`
- Screenshot: `evaluation/northstar-72h-2026-07-10/workspace-ultrashort-zoom-overlap/local-workspace-overlap-fixed-css1024x319-dsf2.png`
- Topbar: `4-46`
- Textarea: `103-197`
- Composer: `211-257`
- Viewport height: `319`
- Result: input action bar remains visible with margin.

## Postdeploy Verification

Production probe after deployment:

- URL: `https://www.safeclaw.kr/workspace?theme=day&v=3af5c2f`
- Viewport: `1024 x 319`, `deviceScaleFactor=2`
- Screenshot: `evaluation/northstar-72h-2026-07-10/workspace-ultrashort-zoom-overlap/postdeploy-workspace-fixed-css1024x319-dsf2.png`
- Topbar: `4-46`
- Textarea: `103-197`
- Composer: `211-257`
- Viewport height: `319`
- Result: production page no longer clips the input action bar.

## Regression Tests

Added:

- `tests/workspace-layout-regression.test.ts`
  - `keeps ultra-short zoomed day screens from clipping the input action`

The test asserts:

- no horizontal overflow
- topbar does not overlap the viewport
- left rail remains bounded and scrollable
- hero copy is hidden in the ultra-short case
- textarea does not clip filled text
- composer bottom stays within the viewport

## AI Harness Scope Follow-Up

Also finalized the pending enhanced-generation scope change:

- `enhanced` now runs only core risk/TBM workbench groups:
  - `riskAssessment`
  - `tbmBriefingStructured`
  - `tbmLogStructured`
  - `structuredRiskRows`
  - `tbmRiskLinks`
- Non-core document groups remain deterministic/template in enhanced mode.
- Skipped `free` and `foreign` promises are no longer created as rejected promises in enhanced mode.

Added:

- `tests/ai-deliverables-scope.test.ts`

## Commands

- `npm.cmd test -- tests\workspace-layout-regression.test.ts tests\ai-deliverables-scope.test.ts tests\ai-deliverables-progress.test.ts tests\commercial-harness.test.ts`
  - 4 files passed
  - 32 tests passed
- `npm.cmd test -- tests\operation-improvement-history.test.ts tests\quality-contract.test.ts tests\workpack-ontology-qa.test.ts`
  - 3 files passed
  - 11 tests passed
- `npm.cmd run typecheck`
  - passed
- `npm.cmd run build`
  - passed
