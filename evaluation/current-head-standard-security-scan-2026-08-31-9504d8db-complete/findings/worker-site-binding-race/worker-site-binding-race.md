# Concurrent worker imports can bypass the site-transfer check

- Severity: medium
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

The route checks current site binding and then performs a separate upsert, so concurrent imports can both pass.

## Remediation

Move the invariant into an atomic database function or constraint-backed transaction.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

