# Workspace Overlap Redetail 2

Date: 2026-07-10

## Issue

The day workspace could still look crowded or clipped on presentation-style screens where the physical screenshot is wide but the effective CSS viewport is short because of browser or OS scaling. The user report showed the input surface visually competing with the side rail and first-screen copy.

## Fix

- Added a hard presentation/zoom breakpoint that hides decorative first-screen copy and nonessential side-rail detail on short effective viewports.
- Tightened mobile day layout so the composer, attachment row, and submit button remain visible in the first viewport.
- Added regression coverage for high-zoom desktop and mobile first-viewport composer visibility.

## Evidence

- Live pre-check:
  - `live-day-2048x638.png`
  - `live-day-1170x365-dpr175.png`
  - `live-day-1024x319-dpr2.png`
- Fixed local check:
  - `local-fixed-day-1170x365-dpr175.png`
  - `local-fixed-day-1024x319-dpr2.png`
  - `local-fixed-day-2048x638.png`
  - `local-fixed-mobile-compact-390x844-dpr3.png`
- Metrics:
  - `local-fixed-summary.json`
  - `local-fixed-mobile-compact-390x844-dpr3-metrics.json`

## Verification

- `npm.cmd test -- tests\workspace-layout-regression.test.ts`
  - Result: 14 passed
- `npm.cmd run typecheck`
  - Result: passed
- `npm.cmd run build`
  - Result: passed

## Notes

Browser plugin bootstrap was attempted first, but the in-app browser runtime exposed no `browser.documentation()` function in this session. Regular Playwright was used as the fallback verification path.
