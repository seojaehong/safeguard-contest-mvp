# Workspace Documents/Share UX Remediation

Date: 2026-07-20 KST

## Scope

This patch addresses the remaining workspace launch blockers found on production `13346572796092333c7f7e8a0d28c189b32574a1`:

- Documents stage still felt like a long workbench page instead of a focused step.
- Mobile document preview expanded the full risk assessment body into the page.
- Share desktop still behaved too much like a stacked mobile panel.
- Share mobile pushed message preview and CTA too far down.

No database schema, Supabase data, provider, or evidence-harness logic was changed.

## Product Changes

- Added a workspace page-state class to the command center root: `workspace-page-input`, `workspace-page-document`, or `workspace-page-share`.
- On Documents/Share stages, the left workbench rail now becomes a compact 3-step row and hides non-action context groups.
- Mobile document preview is bounded to a 360px review window with internal preview scroll; the full editable body remains available through the editor.
- Share desktop uses a two-column composition: target/channel/language/readiness on the left, message preview and CTA on the right.
- Share mobile compresses the status pill and bounds the message preview to 160px so the primary CTA appears earlier.

## Geometry Evidence

Measured with local production server `http://localhost:3022` after `npm.cmd run build`.

### Before, live production baseline

- Served build: `13346572796092333c7f7e8a0d28c189b32574a1`
- Desktop documents: page height 1170px on 900px viewport.
- Mobile documents: page height 2589px on 844px viewport.
- Mobile document preview body: full visible body, about 1494px in local reproduction.
- Desktop share: previous focused test observed page height 1352px on 900px viewport because sidebar context remained.
- Mobile share: page height 1678px, primary CTA bottom 1560px.

Baseline report:

- `evaluation/workspace-doc-share-live-geometry-2026-07-20/report.json`

### After, patched local production

- Desktop documents: page height 1147px, outside elements 0.
- Mobile documents: page height 1417px, outside elements 0.
- Mobile document preview: 360px viewport, 1492px retained scroll content, `overflow-y:auto`.
- Desktop share: page height 1061px, share root 980px wide, preview and CTA in right column, outside elements 0.
- Mobile share: page height 1487px, preview 160px bounded, primary CTA bottom 1369px, outside elements 0.

Patched report:

- `evaluation/workspace-doc-share-ux-remediation-2026-07-20/report.json`
- screenshots:
  - `evaluation/workspace-doc-share-ux-remediation-2026-07-20/screenshots/desktop-1440-documents.png`
  - `evaluation/workspace-doc-share-ux-remediation-2026-07-20/screenshots/desktop-1440-share.png`
  - `evaluation/workspace-doc-share-ux-remediation-2026-07-20/screenshots/mobile-390-documents.png`
  - `evaluation/workspace-doc-share-ux-remediation-2026-07-20/screenshots/mobile-390-share.png`

## Verification

- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts tests\north-star-document-ux.test.ts --maxWorkers=1 --fileParallelism=false`
  - 2 files / 5 tests PASS
- `npm.cmd test -- tests\frontend-workbench-visual-contract.test.ts tests\workspace-share-simplification.test.ts tests\workspace-layout-regression.test.ts --maxWorkers=1 --fileParallelism=false`
  - 3 files / 48 tests PASS / 1 skipped
- `npm.cmd run typecheck`
  - PASS
- `npm.cmd run build`
  - PASS, 28/28 static pages

## Remaining Product Notes

- Documents mobile is now much shorter but still not a full one-screen review experience because the risk assessment content itself is long. The bounded preview prevents the page from being dominated by one document body.
- Share desktop is no longer a mobile-width card. It is a desktop workbench composition, but the outer page still uses the same SafeClaw command shell.
