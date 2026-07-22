# Documents Selected Editor Cockpit Gate

Verdict: `PASS_CURRENT_SOURCE`

Source head: `39bd637c8c8b388cf36865fd44503fad78a437bd`

Production live claim: `false`

Provider dispatch live claim: `false`

## Structure Decision

Route split alone is not accepted as the UX fix. Splitting `/workspace`, `/documents`, and `/share` helps orientation, but the same long document or share-result body would still fail if it remains in normal page flow. The accepted pattern is: route/step boundary, first-viewport cockpit, and long content inside local scroll, accordion, drawer, or detail drilldown.

This slice targets the selected `/documents` editor/detail landing. The selected `위험성평가표` editor now surfaces field summary plus `근거 보기` / `점검 보기` CTAs before the long risk-row list and raw textarea.

## Geometry Evidence

Measured against local production current source at `http://127.0.0.1:3058`.

| Surface | Body / viewport | Field strip | Evidence/recheck CTA | First risk row header | First hazard field | Raw textarea | Overflow |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Desktop short 1440x723 | 882 / 723 = 1.22x | 355-403 | 419-463 | 646-703 | 739-799 | 1126-1299 | false / outside 0 |
| Desktop 1440x900 | 1129 / 900 = 1.25x | 343-391 | 407-451 | 634-691 | 728-788 | 1115-1288 | false / outside 0 |
| Mobile 390x844 | 1067 / 844 = 1.26x | 352-396 | 404-440 | 622-679 | 703-753 | 991-1164 | false / outside 0 |

Mobile CTA bottom is `440`, inside the first viewport and before raw document text. The raw textarea remains secondary drilldown content.

## Commands

- `npm.cmd test -- tests\documents-editor-layout.test.ts -t "bounds the default documents route editor" --maxWorkers=1 --fileParallelism=false` → PASS, 1 passed / 31 skipped
- `npm.cmd test -- tests\workspace-layout-regression.test.ts -t "keeps the generated document edit flow inside the workspace design system" --maxWorkers=1 --fileParallelism=false --hookTimeout=180000` → PASS, 1 passed / 29 skipped
- `npm.cmd test -- tests\documents-editor-layout.test.ts -t "canonical risk rows|incomplete new risk row|locks structured editing|row identity" --maxWorkers=1 --fileParallelism=false` → PASS, 4 passed / 28 skipped
- `npm.cmd run typecheck` → PASS
- `npm.cmd run build` → PASS, 28/28 static pages
- `SAFECLAW_BASE_URL=http://127.0.0.1:3058 node evaluation\workspace-docs-share-production-gate-2026-07-20\run-current-geometry-probe.mjs` → PASS

## Remaining Debt

- This does not claim the full 12-document editor IA is complete.
- Mobile selected editor remains `1.26x` by body height because long risk rows and raw text remain drilldown content.
- Next bounded work should continue field/row-first authoring depth without moving long content back into page body flow.
- Provider live dispatch remains approval-gated.
