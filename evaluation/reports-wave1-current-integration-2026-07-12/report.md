# Reports deep-remediation browser evidence

- Source branch: `fix/export-web-deep-remediation`
- Product source: `0c58b1bee22cacd3dd04f08554aed06d1934d833`
- Generated at: `2026-07-13T22:15:06.2863189+09:00`
- Harness: isolated Next development server (`harnessMode: dev`)

## Scope

This refresh verifies the user-visible Korean comparison labels and the Reports browser design contract at the exact source commit above. Internal `asIs`/`toBe` data keys were preserved. Production build claims from the earlier integration report are intentionally not carried forward because this evidence run used the development harness.

## Fresh gates

| Gate | Result |
| --- | --- |
| User-visible Korean copy | `7/7` |
| Focused Reports source and browser | `56/56` |
| Reports browser design contract | `10/10` |
| Knowledge browser layout | `4/4` |
| Strict typecheck | PASS |

## Browser metrics

Day/Night at `1440x900` and `390x844` record horizontal overflow `0`, period controls `62px`, CTA `44px`, control/CTA radius `8px`, rendered overlap `0`, clipped CTA `false`, and hero meta/CTA overlap `false`.

Mobile `contentTop` is measured from the page top immediately after loading and before hover/focus can auto-scroll the page. Day and Night both measure `352px`, satisfying the fail-closed `0..387px` contract.

The empty state records horizontal overflow `0`. All four server-error scenarios retain five disabled downloads, horizontal overflow `0`, no CTA clipping, no hero overlap, no readiness occlusion, and no visible overlay.

## Evidence files

- `reports-sample-{day,night}-{desktop,mobile}-metrics.json`
- `reports-sample-{day,night}-{desktop,mobile}.png`
- `reports-empty-day-desktop.png`
- `reports-server-error-{day,night}-{desktop,mobile}.png`
- `reports-state-metrics.json`

## Remaining RED

None in the gates executed for this refresh. The full production build and 108-row audit remain integration-branch gates and are not claimed by this development-harness evidence.
