# Documents / Share IA Bounded Wave

Checked at: 2026-07-21 KST

## Verdict

- Standalone `/documents` desktop short-height entry: **PASS after bounded patch**
- `/workspace` generated documents cockpit: **already PASS on production `e3191abe`**
- `/workspace` share desktop two-pane: **already PASS on production `e3191abe`**
- `/workspace` share desktop channel density: **PASS after bounded patch**
- Standalone `/documents` mobile and deep-review drilldown: **open follow-up**

This is not a route-splitting completion claim. The user concern is correct: splitting pages alone does not solve long document/share surfaces. The product fix is a two-level IA: step split for orientation, then viewport-first cockpit plus explicit drilldown/detail for long content.

## Production Baseline Before This Patch

Direct live read-only probe on `https://www.safeclaw.kr` showed production build `e3191abe1b7cf41126d03e50d0670555e71cd94a`.

Standalone `/documents` was still a real blocker:

- Desktop 1440x723: page height 1698, ratio 2.35x, workpack/editor top 506, textarea top 815.
- Mobile 390x844: page height 1816, ratio 2.15x, workpack top 545, editor top 671, textarea top 1005.

Generated `/workspace` collapsed documents/share were not the main stale issue:

- `/workspace` documents desktop-short: body 876 / 723, workbench bottom 722, safety brief bottom 649, risk edit CTA bottom 391, share CTA bottom 441, visible previews 0, overflow false, outside 0.
- `/workspace` share desktop-short: share body 920 / 723, form bottom 675, preview bottom 705, preview width 520, primary CTA bottom 349, overflow false, outside 0.

Share was two-pane on desktop, but channel cards inside the left pane were too narrow and tall in live review, making the desktop surface read like compressed mobile cards.

## Patch Scope

- `app/globals.css`
  - Short-height desktop `/documents` compresses header/current chrome and bounds the WorkpackEditor shell as an internal workbench pane.
  - `/workspace` share desktop channel choices become readable one-column controls inside the channel card instead of tiny nested columns.
- `tests/documents-editor-layout.test.ts`
  - Adds first-viewport assertions for standalone `/documents` desktop short-height.
  - The gate checks page ratio, workpack/editor top, workbench height, workbench bottom, horizontal overflow, and internal scroll ownership.
- `tests/workspace-share-mobile-browser.test.ts`
  - Adds desktop channel-card density assertions: exactly three cards, each width >= 150 and height <= 80, while preserving right-pane preview and first-viewport CTA.

## Verification

- `npm.cmd test -- tests\documents-editor-layout.test.ts -t "bounds the default documents route editor" --maxWorkers=1 --fileParallelism=false`
  - PASS: 1 selected / 30 skipped.
- `npm.cmd test -- tests\documents-editor-layout.test.ts --maxWorkers=1 --fileParallelism=false`
  - PASS: 1 file / 31 tests.
- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts --maxWorkers=1 --fileParallelism=false`
  - PASS: 1 file / 1 test.
- `npm.cmd run typecheck`
  - PASS.

## Product IA Decision

Page/route split alone is not sufficient. The release structure should remain:

1. Input: describe work, choose mode, attach evidence, generate.
2. Documents: default cockpit for current work summary, core documents, selected risk assessment entry, and next CTA.
3. Share/result: desktop two-pane action cockpit; mobile serial action cockpit.
4. Drilldown/detail: full 12-document editing, full previews, evidence ledger, translated message source, logs, and history.

Long content is allowed only when it is explicitly opened as detail. It should not define the default step surface.

## Remaining Follow-Up

- Standalone `/documents` mobile still needs its own density wave if the first real editor surface must be above the first viewport.
- Deep review should become a bounded detail drawer/internal pane or route, not an expansion that turns a default step back into a long page.
- This wave should be reported as a bounded visible-layout fix, not “all UI/IA solved.”
