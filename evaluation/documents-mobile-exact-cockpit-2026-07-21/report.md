# Documents Mobile Exact Cockpit Gate

Verdict: `PASS_LOCAL_PRODUCTION_CURRENT_SOURCE`

Product commit: `625d839a404ac2daeec495b7aff47d49303d212d`

This gate closes the remaining mobile Documents shell scroll that survived after Share was fixed. The product change applies the same mobile shell compaction used by Share to the default Documents review cockpit, while keeping full document editing as an intentional drilldown.

## Geometry

Local production, `/workspace`, 390x844:

| Stage | Previous live | Current source | Horizontal overflow | Outside viewport |
| --- | ---: | ---: | --- | ---: |
| Documents default cockpit | 980 / 844 = 1.16x | 844 / 844 = 1.00x | false | 0 |
| Editor drilldown | 1131 / 844 = 1.34x | 1067 / 844 = 1.26x | false | 0 |
| Share default cockpit | 844 / 844 = 1.00x | 844 / 844 = 1.00x | false | 0 |

Mobile Documents workbench geometry:

- workbench top: 318
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
- `SAFECLAW_BASE_URL=http://127.0.0.1:3052 node evaluation\workspace-docs-share-production-gate-2026-07-20\run-current-geometry-probe.mjs` -> PASS

## Scope notes

- This is not a route-splitting claim.
- Provider live dispatch remains outside this gate.
- Live production promotion is pending until `/api/build-info` reaches `625d839a404ac2daeec495b7aff47d49303d212d` or a later commit and the live geometry probe is rerun.
- Full editor drilldown may remain scrollable because editing a safety document is an intentional long-form task.
