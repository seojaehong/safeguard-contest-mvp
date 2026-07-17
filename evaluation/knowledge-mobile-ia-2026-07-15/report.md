# Knowledge mobile IA verification

## Result

Knowledge content remains complete on desktop. At widths up to 720px, the page now presents a six-item Korean task index and shows one selected section at a time. The default `오늘` section contains the core knowledge status and a direct link to evidence search. Governance and diagnostics remain available as later tabs.

Before client enhancement, all six server-rendered sections remain visible and the mobile tab navigation remains hidden. After hydration, the URL hash becomes the source of truth and the page shows one selected section without losing no-JavaScript access.

## Browser measurements

Viewport: 390 x 844.

| Theme | Document height | Horizontal overflow | Visible panels | Active panel top | Tab target size |
| --- | ---: | ---: | ---: | ---: | --- |
| Day | 1,148px | 0px | 1 | 441.97px | 119.33px x 44px |
| Night | 1,148px | 0px | 1 | 441.97px | 119.33px x 44px |

The prior height of approximately 8,890px is user-provided baseline context. The current value was measured by Playwright from `document.documentElement.scrollHeight`.

Keyboard checks covered ArrowRight, ArrowLeft, Home, and End. Browser checks also covered all six click targets, direct hash entry, invalid-hash fallback, and back/forward history synchronization.

## Verification

- PASS: focused Vitest run, 3 files and 11 tests.
- PASS: Day and Night mobile browser layout, keyboard tab transition, 44px targets, and zero horizontal overflow.
- PASS: JavaScript-disabled server render keeps all six sections visible and hides the enhancement-only tab list.
- PASS: desktop renders all six panels and hides the mobile task index.
- PASS: `git diff --check`.
- PASS: dependency sync with `npm.cmd install`; `package.json` and `package-lock.json` diff remain zero.
- PASS: `npm.cmd run typecheck`.
- NOT RUN: production build; final build remains an integration-branch gate.

No commit was created, as requested.
