# Knowledge review transitions are not atomic

- Severity: medium
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

Event rows are updated iteratively before run state is committed, allowing partial transitions after errors or concurrent review.

## Remediation

Use one expected-state transactional RPC with idempotent retry.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

