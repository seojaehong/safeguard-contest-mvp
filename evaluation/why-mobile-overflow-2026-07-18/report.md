# Why Mobile Overflow Gate

Date: 2026-07-18

## Scope

- Route: `https://www.safeclaw.kr/why`
- Viewport: `390x844`
- Themes: Day, Night
- Purpose: Re-check the prior launch blocker where the `/why` comparison table extended to about 889px on mobile.

## Result

PASS. The current production `/why` comparison table renders as stacked cards on mobile and no longer creates horizontal overflow.

## Live Metrics

| Theme | Body width | Document width | Viewport | Overflow | Outside elements | Table width | Rows |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Day | 390 | 390 | 390 | 0 | 0 | 332 | 5 |
| Night | 390 | 390 | 390 | 0 | 0 | 332 | 5 |

Each comparison row rendered as `display: grid` with left/right bounds `29..361`, inside the 390px viewport.

## Local Regression

Command:

```powershell
npm.cmd test -- tests\why-mobile-layout.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- Test files: 1 passed
- Tests: 4 passed
- Duration: 31.91s

## Evidence

- `evaluation/why-mobile-overflow-2026-07-18/live-day.png`
- `evaluation/why-mobile-overflow-2026-07-18/live-night.png`

## Notes

This is an evidence-only gate record. No product source changes were required for this route in this pass.
