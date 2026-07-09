# Workspace Overlap Current Check

Date: 2026-07-10

## Issue

The user reported another first-screen overlap/clipping case on `/workspace` Day mode. The screenshot looked like a wide physical capture with a short effective CSS viewport, where the textarea first line appeared visually clipped.

## Diagnosis

- Current production did not reproduce literal DOM overlap on the probed viewports.
- The risky case was not side navigation crossing the main pane. It was compressed textarea line-box comfort on short presentation/zoom viewports.
- Existing tests checked geometry, but they did not assert enough textarea padding and line-height for Korean bold glyphs.

## Change

- Hardened the final `/workspace` submission guard in `app/globals.css`.
- Increased textarea line-height and vertical padding for short desktop presentation viewports.
- Kept the submit action in the first viewport by reducing only bottom padding and composer spacing where needed.
- Extended `tests/workspace-layout-regression.test.ts` to assert textarea padding and line-height at compact heights.

## Evidence

Current production pre-check screenshots:

- `live-2048x638-dpr1.png`
- `live-1024x319-dpr2.png`
- `live-1365x425-dpr15.png`
- `live-1170x365-dpr175.png`
- `live-mobile-390x844-dpr3.png`

Local fixed screenshots:

- `local-fixed-2048x638-dpr1.png`
- `local-fixed-1024x319-dpr2.png`
- `local-fixed-1365x425-dpr15.png`
- `local-fixed-1170x365-dpr175.png`
- `local-fixed-mobile-390x844-dpr3.png`

Local fixed summary:

- `local-fixed-summary.json`

Key local fixed result:

- no horizontal scroll: pass
- topbar clear of viewport: pass
- side navigation clear of main pane: pass
- textarea clear of composer: pass
- textarea line-box comfort: pass
- submit button in first viewport: pass
- browser console warnings/errors in the probe: 0

## Verification

- `npm.cmd test -- tests\workspace-layout-regression.test.ts`
  - Result: 14 passed
- `npm.cmd run typecheck`
  - Result: passed
- `npm.cmd run build`
  - Result: passed

## Notes

The dev screenshot includes the local Next.js indicator at the bottom-left. That marker is not part of production UI.
