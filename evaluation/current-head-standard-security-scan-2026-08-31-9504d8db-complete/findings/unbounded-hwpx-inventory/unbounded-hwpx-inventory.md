# HWPX inventory trusts unbounded file and central-directory metadata

- Severity: low
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

The inventory reads entire files and trusts EOCD counts and offsets without central-directory and corpus bounds.

## Remediation

Reuse bounded archive preflight and validate ranges, entries, sizes, and elapsed work.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

