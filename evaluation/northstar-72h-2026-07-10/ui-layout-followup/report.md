# SafeClaw UI Layout Follow-Up

Date: 2026-07-10 KST

## Scope

- `/workspace` day-mode compact/zoom-like first screen overlap check
- `/documents` `WorkpackEditor` regression where edit mode fell back to the old dark/card UI
- Browser captures and automated layout regression tests

## Findings

1. The deployed `/workspace` wide and laptop views did not show a literal DOM overlap at 100% CSS pixels.
2. The risky case is a compact/zoom-like viewport (`1024x430` CSS px): the composer was close to the viewport edge and needed a more defensive compact layout.
3. `/documents` had a confirmed style regression. `WorkpackEditor` inherited the old `.safeclaw-module-shell .workpack-shell/.document-editor/.sheet-export-panel` dark OS bridge, while the surrounding document module was already light workbench style.

## Changes

- Added a compact viewport guard for workspace day/night surfaces:
  - tighter header margin
  - smaller first-screen heading and composer spacing
  - bounded sidebar overflow
  - compact evidence rail/cards
- Added a document-module bridge for `WorkpackEditor`:
  - light workbench shell, sidebar, editor, document tabs, template cards
  - non-purple document tabs and template cards
  - light textarea with stable line-height
  - contained submission preview
  - cleared old dark `.sheet-export-panel` inheritance
- Added regression coverage:
  - `tests/workspace-layout-regression.test.ts`
  - `tests/documents-editor-layout.test.ts`

## Evidence

- Before deployed documents capture:
  - `evaluation/northstar-72h-2026-07-10/documents-editor-design/prod-documents-editor.png`
  - `evaluation/northstar-72h-2026-07-10/documents-editor-design/prod-documents-preview-open.png`
- Workspace compact captures:
  - `evaluation/northstar-72h-2026-07-10/workspace-overlap-regression/prod-workspace-zoom-like-1024x430.png`
  - `evaluation/northstar-72h-2026-07-10/ui-layout-followup/local-workspace-1024x430.png`
- Documents after local fix:
  - `evaluation/northstar-72h-2026-07-10/ui-layout-followup/local-documents-editor-after-sheet-fix.png`
  - `evaluation/northstar-72h-2026-07-10/ui-layout-followup/local-documents-preview-open-after-sheet-fix.png`
- Metrics:
  - `evaluation/northstar-72h-2026-07-10/workspace-overlap-regression/prod-workspace-zoomlike-metrics.json`
  - `evaluation/northstar-72h-2026-07-10/ui-layout-followup/local-layout-metrics.json`
  - `evaluation/northstar-72h-2026-07-10/ui-layout-followup/local-documents-after-sheet-fix-metrics.json`

## Verification

- `npm.cmd test -- tests\workspace-layout-regression.test.ts tests\documents-editor-layout.test.ts`
  - Result: 2 files passed, 10 tests passed
- `npm.cmd run typecheck`
  - Result: passed
- `npm.cmd run build`
  - Result: passed

## Remaining Product Note

The `/documents` page is now visually aligned with the workbench system, but it still contains a lot of editing/export capability on one long surface. For a commercial-grade release, the next simplification pass should consider moving secondary export formats and template mapping into a secondary drawer or settings panel.
