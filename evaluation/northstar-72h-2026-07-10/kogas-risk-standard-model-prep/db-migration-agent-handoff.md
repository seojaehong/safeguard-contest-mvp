# KOGAS Offline Migration Handoff

This note is for a future DB migration agent. Do not mutate Supabase or run a DB migration from this package.

## What this package contains

- Source archive inspected offline: `C:\Users\iceam\Downloads\한국가스공사_KOGAS 위험성평가 표준모델_20240909.zip`
- Root source id: `kogas-risk-standard-models-20240909`
- Parsed workbook members: `69`
- Skipped members: `2`
- Extracted row candidates: `3101`

Artifacts:

- `normalized-risk-standard-rows.json`: workbook row normalization output
- `source-profile.json`: per-member profile and skip reasons
- `safety-reference-upsert-preview.json`: offline preview of `safety_reference_sources/items` rows
- `mapping-proposal.json`: field mapping contract for `risk-standard-model` and `risk-standard-row`

## Proposed migration contract

1. Create one `safety_reference_sources` row per parsable workbook member, not one giant row for the entire ZIP.
2. Create one `risk-standard-model` item per workbook to preserve file-level search and provenance.
3. Create one `risk-standard-row` item per extracted risk row. Keep raw text and carry-forward flags in `payload`.
4. Keep `.hwp` and nested `.zip` members out of the first DB ingest. Review them in a separate parser lane.
5. Treat this package as review material. Do not upload until normalization rules and null-handling are explicitly approved.

## Suggested future agent steps

1. Review representative rows in `qa.md` and confirm the row granularity is acceptable for retrieval.
2. Review `mapping-proposal.json` and `safety-reference-upsert-preview.json` with the owning agent before any SQL or REST upload.
3. If approved, feed only the preview payload into an upload script in a separate DB-enabled workstream.
4. Preserve skipped members and reasons in the migration ticket so the second-wave parser scope stays visible.

## Explicit non-goals for this package

- No DB migration
- No Supabase mutation
- No `.env` or secret changes
- No archive upload

See `mapping-proposal.json` and `safety-reference-upsert-preview.json` for the exact field contract.
