# Structured XLSX Render Budget Remediation

## Verdict

`PASS_LIVE_DEPLOYED_SOURCE_LOCAL_PRODUCTION_STRUCTURED_XLSX_RENDER_BUDGET_DIRECT_LIVE_PROBE_ADMISSION_BLOCKED`

Product commit `b0d3529a6f34d5f9cca0a71bac61f2f15fdbb040` is deployed in production. The export admission policy now projects repeated table rows for all five structured XLSX modes before workbook allocation.

## Remediation

- Preserved the existing request-byte, field-length, nested-entry, row, output-byte, and public admission controls.
- Added mode-specific projected cell accounting for work plan, permit inspection, TBM briefing, TBM log, and education record exports.
- Counted every repeated row path rendered by the structured workbook builders.
- Applied a 256-cell fixed-layout allowance plus six cells per projected table row against the existing 5,000 rendered-cell limit.
- Kept edited canonical-row exports on the existing bounded row path.

## Verification

- Focused export suites: 3 files, 42 tests passed, 0 failed.
- Strict TypeScript check: passed.
- Next.js 15.5.22 production build: passed; 28 static pages generated.
- Production marker: `b0d3529a6f34d5f9cca0a71bac61f2f15fdbb040`.
- A live read-only oversized TBM-log probe was rejected fail-closed by the public distributed admission guard with `503 DISTRIBUTED_RATE_LIMIT_UNAVAILABLE`. The route-level inner budget was therefore not directly executed on live production; local production route tests prove the new 413 path before workbook construction.

## Boundaries

- This remediation does not close the full security scan. A fresh full-repository rescan remains required.
- No database, provider dispatch, Share-session, embedding/vector, wiki, or KOSHA registry mutation occurred.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
- Existing approval-gated launch boundaries remain unchanged.
