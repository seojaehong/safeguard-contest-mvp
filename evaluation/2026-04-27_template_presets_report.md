# SafeGuard template preset report

Date: 2026-04-27

## Implemented

- Added document-type template presets in the workpack editor:
  - Excel 시트형: table-first format for field checklists and approval sheets
  - Word 보고서형: `.doc` compatible HTML with section tables
  - HWPX 제출형: section/item text optimized for Korean word processor export
- Added selected-template download behavior.
- Added selected document `DOC` export in addition to TXT, JSON, CSV, XLS, HTML, JPG, PDF, and HWPX.
- Updated HWPX generation to use the section/item template text instead of raw body text.

## Verification

- `npm.cmd run build`: passed
- `npm.cmd run typecheck`: passed after build regenerated `.next/types`
- UI smoke: `evaluation/2026-04-27-template-presets/template-ui-smoke.json`

## Smoke summary

- Home rendered Excel template preset: true
- Home rendered Word template preset: true
- Home rendered HWPX template preset: true
- Home rendered DOC button: true
- Home rendered selected-template download button: true

## Notes

- XLS uses Excel-compatible HTML so the file opens in Excel without adding a spreadsheet dependency.
- DOC uses Word-compatible HTML so the file opens in Word or compatible editors.
- HWPX continues to use `@rhwp/core` and keeps Korean text in the generated document.
