# Share Mobile Exact Viewport Gate

Verdict: `PASS_LIVE_PRODUCTION`

Source commit: `be254e5d45806c79fba960449c54302dfcab9901`

Live production marker at verification: `963b24e92d121359ca90505478da40131ccc876e`

This gate follows the live-verified 1.16x mobile share wave. It fixes the remaining shell-level scroll by removing mobile Share's extra shell bottom padding/fixed viewport height and hiding the secondary readiness warning in the collapsed mobile cockpit.

## Geometry

Local production and live production, `/workspace?share`, 390x844:

| Metric | Previous live | Current source | Live production |
| --- | ---: | ---: | ---: |
| Page height | 980 | 844 | 844 |
| Height ratio | 1.16x | 1.00x | 1.00x |
| Share root bottom | 836 | 810 | 810 |
| Share root height | 552 | 491 | 491 |
| Summary bottom | - | - | 485 |
| Preview bottom | 648 | 683 | 683 |
| Primary CTA bottom | 707 | 742 | 742 |
| Config toggle bottom | - | - | 801 |
| Horizontal overflow | 0 | 0 | 0 |

Live DOM check also confirms `data-share-stage-rail` is `display:none` on mobile and all 3 configuration cards are collapsed (`display:none`, height 0) by default.

Desktop and document/editor surfaces are unchanged by this shell-only mobile Share compaction:

- desktop Share: 946 / 900 = 1.05x
- desktop-short Share: 946 / 723 = 1.31x
- mobile Documents: 980 / 844 = 1.16x
- mobile Editor: 1131 / 844 = 1.34x

## Checks

- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts -t "keeps localized worker dispatch previews bounded|keeps generated provider-result details in bounded desktop and mobile drilldown" --maxWorkers=1 --fileParallelism=false --hookTimeout=180000` -> PASS, 1 file / 1 passed / 3 skipped
- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts -t "keeps generated provider-result details in bounded desktop and mobile drilldown" --maxWorkers=1 --fileParallelism=false --hookTimeout=180000` -> PASS, 1 file / 1 passed / 3 skipped
- `npm.cmd test -- tests\workspace-share-simplification.test.ts --maxWorkers=1 --fileParallelism=false` -> PASS, 1 file / 11 passed
- `npm.cmd run build` -> PASS, 28/28 static pages
- `npm.cmd run typecheck` -> PASS
- `node evaluation\workspace-docs-share-production-gate-2026-07-20\run-current-geometry-probe.mjs` with `SAFECLAW_BASE_URL=http://127.0.0.1:3050` -> PASS
- `node evaluation\workspace-docs-share-production-gate-2026-07-20\run-current-geometry-probe.mjs` against `https://www.safeclaw.kr` -> PASS, live production
- Live Playwright thin DOM probe for `/workspace?share`, 390x844 -> PASS, mobile exact viewport, stage rail hidden, config cards collapsed, summary/preview/CTA/toggle in viewport

## Live status

Live production now reports `963b24e92d121359ca90505478da40131ccc876e`, which includes the mobile Share exact viewport source slice and the North Star evidence refresh.

Provider live dispatch remains outside this gate.
