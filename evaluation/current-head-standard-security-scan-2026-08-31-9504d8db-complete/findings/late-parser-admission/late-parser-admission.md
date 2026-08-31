# Archive and spreadsheet budgets run after expensive parser initialization

- Severity: low
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

AdmZip and ExcelJS parse or materialize input before entry, expansion, row, cell, and elapsed limits execute.

## Remediation

Run central-directory/file-size preflight before parser construction and isolate parsing with hard process limits.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

