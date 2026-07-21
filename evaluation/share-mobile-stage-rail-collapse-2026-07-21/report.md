# Share Mobile Stage Rail Collapse Gate

Verdict: `PASS_LIVE_PRODUCTION`

Source/product commit: `2d173b48d35c9e7936d2656ddfb2dbf8ec5097f4`

Live production now reports evidence commit `3b86df0135f54076d93a91c119c8c4237c43ed2a`, which includes this product commit. The live browser geometry probe was rerun against `https://www.safeclaw.kr`.

## Structural Decision

Route splitting alone is not accepted as the UX fix. It helps orientation, but `/share` still needs a first-viewport cockpit with bounded or collapsed secondary details. This wave removes the duplicate mobile stage rail from the default mobile cockpit, keeps the selected summary/preview/CTA/detail toggle first-viewport visible, and preserves desktop staged composition.

## Current-Source Geometry

The same geometry was rechecked against live production after deployment catch-up.

Mobile `/workspace?share`, 390x844:

| Theme | Page | Summary | Preview | CTA | Config toggle | Stage rail | Config cards | Overflow |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: |
| Day | 980 / 844 = 1.16x | 391.5 | 616.5 | 675.5 | 734.5 | `display:none` | `none, none, none` | 0 |
| Night | 980 / 844 = 1.16x | 391.5 | 616.5 | 675.5 | 734.5 | `display:none` | `none, none, none` | 0 |

Desktop `/workspace?share`, 1440x900:

| Theme | Page | Preview | CTA | Stage rail | Config cards | Overflow |
| --- | ---: | ---: | ---: | --- | --- | ---: |
| Day | 946 / 900 = 1.05x | 757 | 401 | `grid`, 4 columns | `grid, grid, grid` | 0 |
| Night | 946 / 900 = 1.05x | 757 | 401 | `grid`, 4 columns | `grid, grid, grid` | 0 |

Generated provider-result fixture:

| Viewport | Page | Preview | CTA | Result summary | Result default | Overflow |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| 390x844 | 980 / 844 = 1.16x | 675 | 734 | 839 | closed | 0 |
| 1440x900 | 928 / 900 = 1.03x | 785 | 429 | 819 | closed | 0 |

The fixture proves UI containment only. It does not claim real provider delivery.

## Checks

- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts -t "renders every Vietnamese paragraph" --maxWorkers=1 --fileParallelism=false --hookTimeout=180000` -> PASS, 1 file / 1 passed / 3 skipped
- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts -t "keeps generated provider-result details" --maxWorkers=1 --fileParallelism=false --hookTimeout=180000` -> PASS, 1 file / 1 passed / 3 skipped
- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts -t "standalone dispatch|keeps generated provider-result details" --maxWorkers=1 --fileParallelism=false --hookTimeout=180000` -> PASS, 1 file / 3 passed / 1 skipped
- `npm.cmd test -- tests\workspace-share-simplification.test.ts --maxWorkers=1 --fileParallelism=false` -> PASS, 1 file / 11 passed
- `npm.cmd run typecheck` -> PASS
- `node evaluation\workspace-docs-share-production-gate-2026-07-20\run-current-geometry-probe.mjs` with `SAFECLAW_BASE_URL=https://www.safeclaw.kr` -> PASS

## Scope And Debt

Closed in this wave:

- Mobile Share no longer shows the four-step stage rail as duplicate default chrome.
- Mobile summary, preview, primary CTA, and detail toggle remain inside the first viewport.
- Desktop Share keeps the staged rail and config cards visible as a desktop composition.
- Generated provider-result fixture keeps closed result summary inside the first viewport.

Still open:

- A stricter exact-one-viewport mobile Share route, if product acceptance requires it.
- Real provider dispatch, which remains gated by the separate persistent idempotency/provider-result ledger approval path.
