# Documents Mobile Exact Cockpit Gate

Verdict: `PASS_LIVE_PRODUCTION`

Product commit: `625d839a404ac2daeec495b7aff47d49303d212d`

Live production evidence commit: `3670420e88ee3130073c38721d120521e6fe8894`

This gate closes the remaining mobile Documents shell scroll that survived after Share was fixed. The product change applies the same mobile shell compaction used by Share to the default Documents review cockpit, while keeping full document editing as an intentional drilldown.

## Geometry

Live production, `/workspace`, 390x844:

| Stage | Previous live | Current live | Horizontal overflow | Outside viewport |
| --- | ---: | ---: | --- | ---: |
| Documents default cockpit | 980 / 844 = 1.16x | 844 / 844 = 1.00x | false | 0 |
| Editor drilldown | 1131 / 844 = 1.34x | 1067 / 844 = 1.26x | false | 0 |
| Share default cockpit | 844 / 844 = 1.00x | 844 / 844 = 1.00x | false | 0 |

Mobile Documents workbench geometry:

- workbench top: 294
- workbench bottom: 786
- workbench height: 492
- deep review open by default: false
- visible document preview panes by default: 0

Desktop surfaces were not targeted by this wave:

- desktop-short Documents: 876 / 723 = 1.21x
- desktop Documents: 1053 / 900 = 1.17x
- desktop Share: 946 / 900 = 1.05x

## Checks

- `npm.cmd test -- tests\workspace-layout-regression.test.ts -t "keeps the generated documents review cockpit before full editor drilldown" --maxWorkers=1 --fileParallelism=false --hookTimeout=180000` -> PASS, 1 file / 1 passed / 28 skipped
- `npm.cmd test -- tests\workspace-layout-regression.test.ts -t "keeps the generated document edit flow inside the workspace design system" --maxWorkers=1 --fileParallelism=false --hookTimeout=180000` -> PASS, 1 file / 1 passed / 27 skipped
- `npm.cmd run build` -> PASS, 28/28 static pages
- `npm.cmd run typecheck` -> PASS
- `node evaluation\workspace-docs-share-production-gate-2026-07-20\run-current-geometry-probe.mjs` against `https://www.safeclaw.kr` -> PASS, `/api/build-info` `3670420e88ee3130073c38721d120521e6fe8894`

## Scope notes

- This is not a route-splitting claim.
- Provider live dispatch remains outside this gate.
- Live production now serves evidence commit `3670420e88ee3130073c38721d120521e6fe8894`, which includes product commit `625d839a404ac2daeec495b7aff47d49303d212d`.
- Full editor drilldown may remain scrollable because editing a safety document is an intentional long-form task.
