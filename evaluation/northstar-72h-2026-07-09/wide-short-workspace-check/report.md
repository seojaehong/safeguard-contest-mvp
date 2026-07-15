# Wide/Short Workspace Overlap Check

Date: 2026-07-09

## Issue

The Day workspace could still show a clipped/covered first-screen area on a wide but short presentation viewport after the user scrolled. This was not a document-generation failure. It was a layout layering issue: the production topbar was still sticky and stayed over the workspace content.

## Reproduction

- URL: `https://www.safeclaw.kr/workspace?theme=day`
- Viewport: `2048x638`
- Scroll: `260px`
- Live result:
  - `.command-topbar` position: `sticky`
  - topbar rect: `top 8 / bottom 125`
  - heading rect: `top 63 / bottom 110`
  - The sticky topbar overlaps the headline area.
- Screenshot: `live-day-scrolled-2048x638.png`
- Metrics: `live-day-scrolled-2048x638.json`

## Fix

- Force the workspace topbar to remain in document flow inside `.command-center-shell`.
- Add `top: auto !important` so previous sticky theme rules cannot re-pin it.
- Extend the Playwright regression test with the same Day + `2048x638` + scroll scenario.

## Local Verification

- Local HEAD result:
  - `.command-topbar` position: `relative`
  - topbar rect after scroll: `top -248 / bottom -188`
  - heading rect: `top 10 / bottom 86`
  - textarea rect: `top 201 / bottom 365`
  - The topbar scrolls away and no longer covers workspace content.
- Screenshot: `local-day-scrolled-2048x638.png`
- Metrics: `local-day-scrolled-2048x638.json`

## Command

```powershell
npm.cmd test -- tests\workspace-layout-regression.test.ts
```

Result: 4 tests passed.

## Deployment Note

Production still showed the old topbar behavior during this check. The branch fix must be deployed before using `www.safeclaw.kr/workspace` for demo or submission review.
