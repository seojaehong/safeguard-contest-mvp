# MCP active-token quota remains non-atomic

- Severity: low
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

Token issuance counts active tokens and inserts separately, allowing concurrent requests to exceed the cap.

## Remediation

Enforce quota atomically with a transaction, lock, or unique slot model.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

