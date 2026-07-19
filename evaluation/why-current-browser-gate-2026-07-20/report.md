# Why Page Current Browser Gate

- Checked at: 2026-07-20 KST
- Git HEAD: `6dbf62068fdc22427ee0e87a7cc4682589c97d11`
- Branch: `fix/kosha-materialization-20260720`
- Local production URL: `http://localhost:3034/why`

## Verdict

PASS for the prior `/why` mobile comparison overflow blocker.

The previous live audit found the mobile comparison table extending to roughly 889px on a 390px viewport. On the current rendered surface, the semantic table is preserved but mobile rows stack into readable cards within the viewport.

## Focused Tests

Command:

```powershell
npm.cmd test -- tests\why-mobile-layout.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: PASS, 1 file / 4 tests.

## Browser Metrics

| Variant | Body height | Horizontal overflow | Outside elements | Comparison width | First row display | Under-44 controls |
| --- | ---: | --- | ---: | ---: | --- | ---: |
| Desktop Day 1440x900 | 1142 | false | 0 | 1104 | grid | 5 |
| Mobile Day 390x844 | 2727 | false | 0 | 332 | grid | 0 |
| Desktop Night 1440x900 | 1142 | false | 0 | 1104 | grid | 5 |
| Mobile Night 390x844 | 2727 | false | 0 | 332 | grid | 0 |

## Evidence Files

- `evaluation/why-current-browser-gate-2026-07-20/metrics.json`
- `evaluation/why-current-browser-gate-2026-07-20/desktop-day.png`
- `evaluation/why-current-browser-gate-2026-07-20/mobile-day.png`
- `evaluation/why-current-browser-gate-2026-07-20/desktop-night.png`
- `evaluation/why-current-browser-gate-2026-07-20/mobile-night.png`

## Non-Claims

- This does not claim every desktop text-link affordance has 44px touch height.
- This closes the mobile comparison overflow/clipping blocker only.
