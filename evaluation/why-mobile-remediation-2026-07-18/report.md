# Why Mobile Layout Verification - 2026-07-18

## Summary

The earlier `/why` mobile overflow concern does not reproduce on current `master` (`e10d353465b001777e8fe12f373f5af5fa35caf0`). The page already renders the comparison table as stacked semantic table rows on mobile while preserving the five-column comparison table on desktop.

This patch changes only the Playwright harness teardown timeout for `tests/why-mobile-layout.test.ts`. The product page and CSS are unchanged.

## Verification

```powershell
npm.cmd test -- tests\why-mobile-layout.test.ts --maxWorkers=1 --fileParallelism=false
```

## Result

- Browser layout contract: 1 file, 4 tests PASS.
- Mobile Day/Night: document horizontal overflow 0, outside viewport elements 0, unreadable text 0, undersized controls 0.
- Desktop Day/Night: five-column comparison table preserved, document overflow 0, header contrast >= 4.5.
- First run confirmed all 4 product assertions passed but failed during `afterAll` teardown at 30s. Timeout was raised to 90s and the suite exited successfully.

## Scope

- Changed file: `tests/why-mobile-layout.test.ts`
- Product code: unchanged
- DB/schema/data: unchanged
