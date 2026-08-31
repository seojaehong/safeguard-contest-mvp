# SIF approval preflight can skip migration scope validation

- Severity: low
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

Scope checking is conditional on the migration filename containing `sif-embedding-only`, so another filename can receive a passing scope result.

## Remediation

Validate allowlisted SQL objects and bind the packet to the exact migration digest independent of filename.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

