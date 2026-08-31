# Template inventory scanner parses an unbounded local corpus

- Severity: medium
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

The scanner materializes a recursive corpus and opens parsers without file-count, aggregate-byte, elapsed-time, or symlink admission.

## Remediation

Apply no-follow traversal and corpus/file/time limits before parser initialization.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

