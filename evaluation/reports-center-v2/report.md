# Reports Center V2 Evaluation

Date: 2026-07-11
Branch: `feature/reports-center-v2`

## Scope

- Kept the existing Linear-style work-document and right-rail layout.
- Added weekly, monthly, and custom date-range reports while retaining the existing daily mode.
- Added process, task, risk-level, improvement-status, site, and team facets.
- Kept As-Is/To-Be risk and improvement rows in Markdown, CSV, JSON, Markdown corpus, and JSONL corpus downloads.
- Added an explicit in-session approval gate for Before/After photo names.
- Added empty, download-ready, report-error, download-preparing, and download-error states.
- Made no DB schema, migration, Supabase mutation, upload, or remote-state changes.

## Behavioral Evidence

| Contract | Evidence |
| --- | --- |
| Custom period | Inclusive `YYYY-MM-DD` range, exact missing/reversed range errors, stable range filename |
| Facets | Risk rows and matched improvements share the six filter axes; options come from unfiltered period data |
| Photo approval | Unapproved photo names are absent from Markdown, CSV, and JSON; approved pairs are included |
| Export context | JSON stores `dateRange` and `filters`; Markdown renders an `적용 조건` section |
| Empty/ready/error | `resolveReportViewState` controls copy and download availability |
| UI wiring | Custom date controls, six labeled selects, approval checkbox, and guarded download buttons |

## Verification

- `npm.cmd test -- tests/reporting-downloads.test.ts tests/reports-download-center.test.ts`
  - Result: 2 test files passed, 20 tests passed, 0 failed.
- `npm.cmd run typecheck`
  - Result: `tsc --noEmit --incremental false` completed successfully.
- `Invoke-WebRequest http://127.0.0.1:3127/reports`
  - Result: HTTP 200.
- Playwright DOM smoke at `1440x1000`
  - Initial: title `개선 리포트.`, document present, rail present, 6 filters, no horizontal overflow.
  - Invalid custom range: error state present, 2 date inputs, 0 enabled downloads.
  - Valid custom range: download-ready state present, 5 enabled downloads.

## Concerns

- The current source remains the browser's single current workpack plus local improvement history; durable multi-workpack history still requires a separately approved data design.
- A dedicated team field does not exist in the current local model, so the report facet uses each risk row's improvement owner as the team value.
- Local photo evidence stores filenames and analysis metadata, not binary attachments; this implementation gates and exports approved filenames only.
