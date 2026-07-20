# Dispatch Standalone Cockpit Gate

- Checked: 2026-07-21T02:51:41+09:00
- Source HEAD before commit: `ba91572412b49bd61d463119f58382e4ca77396c`
- Verdict: `PASS_CURRENT_SOURCE`
- Route: `/dispatch`
- Viewport: 1440x900 desktop

## Result

The standalone dispatch route now behaves like a desktop cockpit instead of a mobile-like stacked share card.

Measured current-source browser metrics:

| Metric | Value |
| --- | ---: |
| page height | 1116px / 1.24x viewport |
| share root width | 1156px |
| share root height | 652px |
| primary CTA bottom | 544.39px |
| preview bottom | 898.39px |
| preview left | 877px |
| primary action right | 861px |
| horizontal overflow | 0 |
| channel cards | 164x44, 164x44, 164x44 |

Acceptance:

- Primary CTA is inside the first viewport.
- Message preview is inside the first viewport.
- Preview is in the desktop right pane, not serial/mobile stacked.
- Channel cards are readable and compact.
- Page height is below the 1.35x desktop cockpit budget.
- Horizontal overflow remains closed.

## Verification

- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts -t "standalone dispatch module" --maxWorkers=1 --fileParallelism=false`  
  PASS: 1 file / 1 selected test, 1 skipped.
- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts --maxWorkers=1 --fileParallelism=false`  
  PASS: 1 file / 2 tests.
- `npm.cmd run typecheck`  
  PASS.

## Boundaries

This gate does not claim real provider email/SMS/Kakao delivery. Production dispatch remains preview-only until persistent idempotency and provider result persistence are approved and verified.

Production live verification should run after this commit is deployed.
