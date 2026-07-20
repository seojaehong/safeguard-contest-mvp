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

## 2026-07-21 Sample Shell Follow-Up

Live production `ca273fe5a09fa098a6d12867624850a332c53761` confirmed that the provider-result drilldown patch was deployed, but the default/sample `/dispatch?theme=day` route still rendered two very wide stacked module panels:

- desktop 1440x900: first panel approximately `1108px` wide, second panel approximately `1108px` wide.
- x buckets stayed near `[240, 320]`, so the default route did not prove a deliberate desktop publish/status composition.

Current-source bounded patch keeps generated/current-workpack Share as the full-width two-pane cockpit, but changes the sample/empty shell panels into two desktop regions.

Current-source sample shell metrics from `evaluation/share-mobile-p1/standalone-dispatch-sample-desktop-metrics.json`:

| Metric | Value |
| --- | ---: |
| page height | 900px / 1.00x viewport |
| grid | 1156x109, left 260 |
| first panel | 635x77, left 284 |
| second panel | 413x77, left 979 |
| distinct columns | true |
| horizontal overflow | 0 |

Mobile sample shell is now route-scoped compact one-column:

| Metric | Value |
| --- | ---: |
| page height | 893px / 1.06x viewport |
| grid | 358x392, left 16, top 453, bottom 845 |
| first panel | 332x172, top 470, bottom 641 |
| second panel | 332x179, top 665, bottom 844 |
| horizontal overflow | 0 |

Production verification for commit `a3254ae3176468e715fccb6dd308aada7c5870aa`:

| Metric | Value |
| --- | ---: |
| page height | 900px / 1.00x viewport |
| horizontal overflow | 0 |
| grid | 1156x109, left 260 |
| x buckets | 280, 960 |
| first panel | 635x77, left 284 |
| second panel | 413x77, left 979 |
| panel count | 2 |

Interpretation: the earlier production evidence closed the desktop sample-shell "wide stacked panel" risk. The current-source follow-up also reduces the mobile sample shell from `1202px / 1.42x` to `893px / 1.06x`, with both sample panels effectively inside the first viewport and horizontal overflow still closed. This remains a sample/default shell proof, not generated provider-result state proof, and it does not change provider dispatch capability.
