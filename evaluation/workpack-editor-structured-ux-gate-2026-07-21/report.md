# Workpack Editor Structured UX Gate

Checked at: 2026-07-21 01:16 KST
Source HEAD before this evidence: `2a8baac195bd28f4259ab4b1d4535c7aec6324f6`
Evidence commit: `3e8e32f800aa8c242edbe43987b9ec5cd32625c8`
Branch: `chore/recipient-foreign-live-gate-20260720`

## Verdict

PASS for the current stale-gap classification.

The old statement that all 12 workpack documents are only one generic textarea is stale for the current source. The editor now provides:

- document-specific metadata and navigation for 12 workpack documents,
- structured/source mode separation,
- document-specific structured section builders,
- multiple section textareas for structured document editing,
- canonical risk assessment row editing with the first row visible by default,
- XLSX export behavior that uses canonical risk rows only while source text remains synchronized.

## Honest Boundary

This does not claim every one of the 12 document types is a final bespoke field-first form. Several document types still rely on structured section textareas and source mode as the safe fallback. The next north-star UX wave is to convert more document types into field-first editors while preserving source/raw recovery.

## Fix Included In This Gate

- Updated the document section browser assertion to match the current details > summary > strong structured-section DOM.
- Kept the first risk-assessment row open by default so the primary 행 1 유해·위험요인 field remains directly editable after document/workpack switches and lock confirmation.

## Verification

- `npm.cmd test -- tests\workpack-risk-rows-editor.test.ts tests\workpack-editor-structured-sections.test.ts --maxWorkers=1 --fileParallelism=false`
  PASS: 2 files / 11 tests.
- `npm.cmd test -- tests\documents-editor-layout.test.ts -t "edits canonical risk rows" --maxWorkers=1 --fileParallelism=false`
  PASS: 1 selected test / 29 skipped.
- `npm.cmd test -- tests\documents-editor-layout.test.ts --maxWorkers=1 --fileParallelism=false`
  PASS: 1 file / 30 tests.

## Scope

No DB schema, Supabase data, provider, KOSHA corpus, export route, or production dispatch behavior was changed in this gate.
