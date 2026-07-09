# Workspace Compact Input Overlap Check

Date: 2026-07-10

## Finding

The reported white-theme overlap was not reproduced on the latest deployed CSS at 100% zoom, but the first input screen was still structurally fragile on presentation-scale viewports. At 2048x638 and zoom-equivalent viewports, support content such as chips and readiness rails pushed the composer below the first viewport and could read as clipping or overlap in real browser zoom/capture conditions.

## Fix

- Moved the primary submit action into the input composer tray so the first screen always keeps the user decision point visible.
- Hid automatic chips and evidence readiness rail on short desktop viewports. Those signals remain available in normal-height screens and in the side rail/document step.
- Added a compact presentation regression test for 1638x510 and 1365x425 viewports.
- Updated the older scroll-away topbar tests so they validate the actual invariant: the topbar must not overlay the viewport, whether the compact screen scrolls or not.

## Evidence

- `evaluation/northstar-72h-2026-07-10/layout-probes/fixed-day-2048x638-filled.png`
- `evaluation/northstar-72h-2026-07-10/layout-probes/fixed-day-zoom125-filled.png`
- `evaluation/northstar-72h-2026-07-10/layout-probes/fixed-day-zoom150-filled.png`
- `evaluation/northstar-72h-2026-07-10/layout-probes/fixed-day-compact-input-metrics.json`

## Verification

- `npm.cmd test -- tests\workspace-layout-regression.test.ts` -> 11 passed
- `npm.cmd test -- tests\documents-editor-layout.test.ts tests\module-shell-design-regression.test.ts` -> 4 passed
- `npm.cmd run typecheck` -> passed
- `npm.cmd run build` -> passed

## Follow-Up

Separate from this layout fix, live generation stream verification still needs a focused pass. The stream endpoint returned HTTP 200, but the UI probe previously remained in `3/12` generating state when using the enhanced stream path. That should be treated as the next P1 after this compact-layout patch.

## Second Pass: 150% Zoom-Like Day Screen

The follow-up screenshot matched a 150% browser-zoom equivalent more closely than a normal 2048x638 CSS viewport. In that condition, the previous compact rule compressed the textarea down to roughly 84px and kept secondary sidebar/helper content visible. It did not always produce a DOM collision, but it could read as clipped or overlapping because the primary input text had too little vertical space.

Additional fix:

- At desktop heights of 430px or less, hide the input subtitle, helper copy, and secondary sidebar groups.
- Keep the textarea at 118px minimum for 430px-high zoom-like screens.
- Add a stricter 380px-high rule that keeps the textarea at 108px minimum while preserving the composer submit action inside the viewport.
- Update regression tests so compact screens prioritize input legibility instead of squeezing every support label into the first viewport.

Additional evidence:

- `evaluation/northstar-72h-2026-07-10/layout-probes/local-day-zoom150-overlap-fixed.png`
- `evaluation/northstar-72h-2026-07-10/layout-probes/local-day-zoom150-overlap-fixed.json`
- `evaluation/northstar-72h-2026-07-10/layout-probes/local-day-1170x365-overlap-fixed.png`
- `evaluation/northstar-72h-2026-07-10/layout-probes/local-day-1170x365-overlap-fixed.json`

Additional verification:

- `npm.cmd test -- tests\workspace-layout-regression.test.ts -t "zoom-like compact|high-zoom short|composer submit action"` -> 3 passed
