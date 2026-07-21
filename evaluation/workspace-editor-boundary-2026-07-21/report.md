# Workspace editor boundary gate

## Verdict

PASS_LIVE_PRODUCTION_CURRENT_HEAD.

The generated document editor was still behaving like a long single-page surface after the first document cockpit split. Current production was stale at the start of this gate, but live production later advanced to the pushed evidence commit and the browser geometry probe passed against `https://www.safeclaw.kr`.

## Build identity

- Live `/api/build-info` at start: `bebc66e3ef6abda86972a83fd666e86f4a5fd656`
- Local production `/api/build-info`: `703e4a031a9c19f78f986b863d647f367e123cf8`
- Product commit: `703e4a031a9c19f78f986b863d647f367e123cf8`
- Live verified `/api/build-info`: `1413eb73960dc9ccdea5f5688b1a4be4b3e23373`

## What changed

- Bounded the workspace document-focus parent wrappers so the page no longer grows with every editor, evidence, utility, and appendix panel.
- Kept the editor, navigation, and evidence areas independently scrollable inside the viewport.
- Left provider dispatch and backend product contracts untouched.

## Geometry result

| Surface | Before height/client | Before ratio | After height/client | After ratio | Overflow |
| --- | ---: | ---: | ---: | ---: | --- |
| Editor desktop short | 2533 / 723 | 3.50 | 952 / 723 | 1.32 | outside 0, overflowX false |
| Editor desktop | 2533 / 900 | 2.81 | 1129 / 900 | 1.25 | outside 0, overflowX false |
| Editor mobile | 2288 / 844 | 2.71 | 1131 / 844 | 1.34 | outside 0, overflowX false |
| Share desktop short | n/a | n/a | 946 / 723 | 1.31 | outside 0, overflowX false |
| Share desktop | n/a | n/a | 946 / 900 | 1.05 | outside 0, overflowX false |
| Share mobile | n/a | n/a | 1107 / 844 | 1.31 | outside 0, overflowX false |

## Verification commands

- `npm.cmd test -- tests\documents-editor-layout.test.ts -t "puts supporting document cockpits|keeps the editor workspace and expanded tools contained" --maxWorkers=1 --fileParallelism=false` → PASS, 1 file / 2 tests
- `npm.cmd test -- tests\workspace-layout-regression.test.ts -t "keeps the generated document edit flow inside the workspace design system" --maxWorkers=1 --fileParallelism=false` → PASS, 1 file / 1 test
- `npm.cmd run typecheck` → PASS
- `npm.cmd run build` → PASS, 28/28 static pages
- `git diff --check` → PASS
- `node evaluation\workspace-docs-share-production-gate-2026-07-20\run-current-geometry-probe.mjs` with `SAFECLAW_BASE_URL=http://127.0.0.1:3044` → PASS
- `node evaluation\workspace-docs-share-production-gate-2026-07-20\run-current-geometry-probe.mjs` with `SAFECLAW_BASE_URL=https://www.safeclaw.kr` → PASS

## Remaining notes

- Live production now reports `1413eb73960dc9ccdea5f5688b1a4be4b3e23373`, and the browser geometry probe has been rerun against live.
- Splitting pages alone is not enough if internal document/share panels remain normal-flow long content. The durable structure should be step-shell plus bounded internal scroll regions: summary rail, active task panel, evidence/details drawer, and collapsed secondary document sections.
- Share mobile is now within the existing first-view threshold, but still 1.31 screens tall. A stricter follow-up can reduce `shareRoot` below one viewport by collapsing secondary rails and keeping only primary CTA plus preview in the first screen.
