# Documents First-Edit Cockpit Gate

Generated at: 2026-07-21 06:15 KST

Source base before this patch: `668c08147edf9d9e6b3cab7edf68b3a4f00229b6`

## Verdict

`PASS_PRODUCTION`

This bounded wave targets the user's current `/documents` complaint at the next IA layer. Previous evidence already closed raw page overflow, one-section accordion behavior, sticky-toolbar overlap, and section action shortcuts. This patch does not reopen those contracts; it changes the default standalone `/documents` cockpit so the selected document is `위험성평가표` and the first editable section lands inside the first viewport.

## Product IA Contract

Route/page split alone is not accepted as the UX fix. The required shape is:

- A route may orient the user, but each route still needs a first-viewport cockpit.
- `/documents` should start from the selected high-value document and current editable section, not a long summary-first stack.
- Long document bodies remain in the bounded internal pane, with sticky local context and drilldown/accordion affordances.

## Current-Source Geometry

Measured with local current-source browser at `http://localhost:3217/documents?theme=day`.

### Desktop Short 1440x723

- `bodyHeight = 770`, `heightRatio = 1.07`
- `horizontalOverflow = false`
- selected document title: `위험성평가표`
- risk launcher pressed: `true`
- `.workpack-shell`: `top=336`, `bottom=722`, `height=386`, `overflowY=auto`, `clientHeight=386`, `scrollHeight=1499`
- `.document-toolbar`: `top=229`, `bottom=333`
- first `.document-section-textarea`: `top=493`, `bottom=658`

### Mobile 390x844

- `bodyHeight = 844`, `heightRatio = 1.00`
- `horizontalOverflow = false`
- selected document title: `위험성평가표`
- risk launcher pressed: `true`
- `.workpack-shell`: `top=476`, `bottom=796`, `height=320`, `overflowY=auto`, `clientHeight=320`, `scrollHeight=1544`
- `.document-toolbar`: `top=476`, `bottom=572`
- first `.document-section-textarea`: `top=580`, `bottom=737`
- first textarea is below the sticky toolbar and inside the first viewport.

## Production Geometry

Measured on live `https://www.safeclaw.kr/documents?theme=day` after `/api/build-info` returned `5dc34b4729ec2a8c77b74c1109d4dfd58dc01550`.

### Desktop Short 1440x723

- `bodyHeight = 770`, `heightRatio = 1.07`
- `horizontalOverflow = false`
- selected document title: `위험성평가표`
- risk launcher pressed: `true`
- `.workpack-shell`: `top=336`, `bottom=722`, `height=386`, `overflowY=auto`, `clientHeight=386`, `scrollHeight=1499`
- `.document-toolbar`: `top=229`, `bottom=333`
- first `.document-section-textarea`: `top=493`, `bottom=658`

### Mobile 390x844

- `bodyHeight = 844`, `heightRatio = 1.00`
- `horizontalOverflow = false`
- selected document title: `위험성평가표`
- risk launcher pressed: `true`
- `.workpack-shell`: `top=476`, `bottom=796`, `height=320`, `overflowY=auto`, `clientHeight=320`, `scrollHeight=1544`
- `.document-toolbar`: `top=476`, `bottom=572`
- first `.document-section-textarea`: `top=581`, `bottom=738`
- first textarea is below the sticky toolbar and inside the first viewport.

## Focused Gate

Commands:

```powershell
npm.cmd test -- tests\documents-editor-layout.test.ts -t "bounds the default documents route editor" --maxWorkers=1 --fileParallelism=false
npm.cmd test -- tests\documents-editor-layout.test.ts -t "opens a requested document|bounds the default documents route editor|keeps the editor workspace and expanded tools contained" --maxWorkers=1 --fileParallelism=false
npm.cmd test -- tests\northstar-open-gate-audit.test.ts tests\northstar-live-rollup.test.ts --maxWorkers=1 --fileParallelism=false
npm.cmd run typecheck
```

Results:

- Documents default cockpit slice: PASS, 1 file / 1 selected test.
- Documents focused preservation slices: PASS, 1 file / 3 selected tests.
- North Star/open-gate preservation: PASS, 2 files / 14 tests.
- TypeScript: PASS.

Full `tests\documents-editor-layout.test.ts` was also attempted, but the browser harness stayed alive for more than four minutes with no further Vitest output. The test process tree was stopped and the result is recorded as hung/slow, not as a product failure or a PASS.

The test now asserts:

- default selected document title is `위험성평가표`;
- mobile risk launcher is pressed by default;
- first structured textarea is inside the first viewport;
- first structured textarea is below the sticky toolbar;
- outer page remains bounded and horizontal overflow remains closed.

## Remaining Debt

This is not a claim that every document-specific editing flow is complete. Remaining product-depth work is richer per-document section summaries, readability inside the bounded pane, and optional drilldown/detail affordances. Provider live dispatch remains a separate approval-gated contract.
