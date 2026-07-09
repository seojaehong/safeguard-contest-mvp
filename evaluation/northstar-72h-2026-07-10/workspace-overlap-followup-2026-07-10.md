# Workspace overlap follow-up - 2026-07-10

## Issue checked

User screenshot showed the Day workspace input page with the first input line visually clipped and the left evidence/menu area continuing into the short first viewport.

## Reproduction matrix

| Target | Viewport | DPR | Result |
| --- | ---: | ---: | --- |
| Local dev | 2048 x 638 | 1.0 | No clipping. Input text starts inside the textarea with `scrollTop=0`; chips and evidence rail are hidden on short screens. |
| Production | 2048 x 638 | 1.0 | No clipping. Same geometry as local latest. |
| Production | 1365 x 425 | 1.5 | No clipping. This matches a 2048 x 638 physical screenshot on 150% Windows scaling. |

## Evidence

- `evaluation/northstar-72h-2026-07-10/layout-overlap-probes/day-2048x638-input.png`
- `evaluation/northstar-72h-2026-07-10/layout-overlap-probes/day-2048x638-input.json`
- `evaluation/northstar-72h-2026-07-10/layout-overlap-probes/live-day-2048x638-input.png`
- `evaluation/northstar-72h-2026-07-10/layout-overlap-probes/live-day-2048x638-input.json`
- `evaluation/northstar-72h-2026-07-10/layout-overlap-probes/live-day-1365x425-dpr15-input.png`
- `evaluation/northstar-72h-2026-07-10/layout-overlap-probes/live-day-1365x425-dpr15-input.json`

## Current production metrics

For `1365 x 425 / DPR 1.5`:

- `scrollWidth=1365`, so there is no horizontal overflow.
- `textarea.top=184`, `textarea.bottom=302`, `scrollTop=0`, `scrollHeight=clientHeight=116`.
- `composer.top=320`, so the textarea and action tray have an 18px gap.
- `.field-brief-chip-row` and `.evidence-readiness-rail` are `display:none` on this short viewport.

## Conclusion

The uploaded screenshot appears to be from the pre-fix state, a cached asset, or a deployment moment before the latest compact-layout CSS was served. The latest production state passes the short-screen overlap guard. Keep `tests/workspace-layout-regression.test.ts` as the regression gate for this class of issue, especially the `1365 x 425` scaled presentation case.
