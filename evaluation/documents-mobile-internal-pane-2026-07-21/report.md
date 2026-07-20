# Documents Mobile Internal Pane Gate

- Checked at: 2026-07-21T02:27:00+09:00
- Source HEAD before commit: 491bcfd3
- Branch: chore/recipient-foreign-live-gate-20260720
- Scope: standalone `/documents` mobile page-height closure after the first density patch.

## Verdict

PASS for current-source local geometry and focused browser contract.

The first mobile density patch reduced the standalone `/documents` route but still left the page at 1634px / 1.94x viewport. This follow-up moves the long editor body into a bounded internal workpack pane on the mobile `/documents` route.

This is the first structural step from "long page" to "cockpit + drilldown": the page body is now one viewport, while full document editing remains reachable inside a clearly scrollable document pane.

## Current-Source Geometry

Measured at `http://127.0.0.1:3458/documents?theme=day` with viewport 390x844.

- Body height: 844px, 1.00x viewport
- Horizontal overflow: false
- Outside viewport elements: 0
- Current-work strip: visible, top 207px, bottom 297px, height 90px
- Current-work text includes the default/sample status and tells the user actual save/share happens after work input
- Mobile cockpit/launcher: top 305px, bottom 468px, text includes "오늘 문서" and "핵심 3종"
- Workpack pane: top 476px, bottom 796px, height 320px, `overflow-y: auto`
- Workpack pane content height: 1110px, client height: 320px
- Document editor: top 602px, reachable inside the first viewport
- Document textarea: top 823px, reachable at the bottom of the first viewport

## UX Contract

- The page itself no longer becomes a 2x mobile scroll surface by default.
- The current-work/provenance context is still visible above the editor.
- The launcher still tells the user they are in today's core document cockpit.
- The long editor is not deleted or hidden; it moves into an internal scroll/detail pane.
- This does not claim the full route-split redesign or final document-specific editor IA.

## Verification

Commands run:

```powershell
npm.cmd test -- tests\documents-editor-layout.test.ts -t "bounds the default documents route editor|puts the core launcher before the mobile editor" --maxWorkers=1 --fileParallelism=false
npm.cmd test -- tests\documents-editor-layout.test.ts --maxWorkers=1 --fileParallelism=false
npm.cmd run typecheck
```

Results:

- Focused browser slice: PASS, 1 file / 3 tests selected, 28 skipped.
- Full documents editor layout suite: PASS, 1 file / 31 tests.
- Strict TypeScript typecheck: PASS.
