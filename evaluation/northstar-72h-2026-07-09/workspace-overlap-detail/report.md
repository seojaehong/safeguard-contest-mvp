# Workspace Overlap Detail Check

Date: 2026-07-09

## Issue

The live Day workspace can still show the old overlapping behavior on a wide, short presentation viewport. In the failing live state, the topbar remains sticky while the workspace body scrolls underneath it, so the headline/composer area looks covered or clipped.

## Live Reproduction

- URL: `https://www.safeclaw.kr/workspace?theme=day`
- Viewport: `2048x638`
- Scroll: `260px`
- Live metrics:
  - `.command-topbar`: `position sticky`, `top 8`, `bottom 125`, `z-index 30`
  - `.command-copy h1`: `top 63`, `bottom 110`
  - `.command-console-input`: `top 200`, `bottom 352`
- Evidence:
  - `live-day-2048x638-initial.png`
  - `live-day-2048x638-scroll260.png`
  - `live-day-2048x638-scroll260-metrics.json`

## Fix

- Hard-bound `.workspace-command-topbar` to `position: relative !important` with all sticky offsets reset.
- On wide but short screens, bound the left workspace rail to the visible viewport height.
- Hide non-critical recent examples and the third readiness row in the short-screen rail so the rail no longer runs far below the visible canvas.
- Preserve the main input page vertical rhythm so the headline remains visible after the 260px scroll regression case.

## Local Verification

- URL: `http://127.0.0.1:3231/workspace?theme=day`
- Viewport: `2048x638`
- Scroll: `260px`
- Local fixed metrics:
  - `.command-topbar`: `position relative`, `top -248`, `bottom -188`
  - `.workspace-side-nav`: `height 522`, `overflow-y auto`, `max-height 522px`, `min-height 0px`
  - `.workspace-recent-list`: `display none`
  - third readiness row: `display none`
  - `.command-copy h1`: `top 10`, `bottom 86`
  - `.command-console-input`: `top 201`, `bottom 365`
- Evidence:
  - `local-fixed-day-2048x638-initial.png`
  - `local-fixed-day-2048x638-scroll260.png`
  - `local-fixed-day-2048x638-scroll260-metrics.json`

## Regression Test

```powershell
npm.cmd test -- tests\workspace-layout-regression.test.ts
```

Result: 5 tests passed.

## Deployment Note

The public live site still showed the pre-fix sticky topbar during this check. The branch must be deployed before using `www.safeclaw.kr/workspace` for a demo or submission review.
