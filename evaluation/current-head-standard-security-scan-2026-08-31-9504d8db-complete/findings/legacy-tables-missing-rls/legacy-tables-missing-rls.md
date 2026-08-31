# Legacy document and query tables lack row-level security

- Severity: medium
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

Migration 001 creates `documents` and `query_logs` without RLS. If live Data API grants expose them, a direct role can cross tenant boundaries.

## Remediation

Enable and force RLS or retire the tables, revoke unnecessary grants, and verify anonymous/authenticated denial.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

