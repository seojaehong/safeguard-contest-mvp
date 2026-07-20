# Dispatch Standalone Cockpit Gate

- Checked: 2026-07-21T02:57:40+09:00
- Source HEAD before commit: `ba91572412b49bd61d463119f58382e4ca77396c`
- Product commit: `2346cf1291304920bc8007b0efbceaf809a11ba3`
- Verdict: `PASS_PRODUCTION`
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

Measured production browser metrics at `https://www.safeclaw.kr`:

| Metric | Value |
| --- | ---: |
| production commit | `2346cf1291304920bc8007b0efbceaf809a11ba3` |
| page height | 1116px / 1.24x viewport |
| horizontal overflow | false |
| outside horizontal elements | 0 |
| share root | 1156x652, top 323, bottom 975 |
| primary CTA | 582x44, top 500, bottom 544 |
| preview | 520x398, top 500, bottom 898 |
| preview right of primary | true |
| message lines | client 228, scroll 228, overflow auto |
| channel cards | 164x44, 164x44, 164x44 |
| support panel | 1108x49 |

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

Production live verification is complete for commit `2346cf1291304920bc8007b0efbceaf809a11ba3`.
