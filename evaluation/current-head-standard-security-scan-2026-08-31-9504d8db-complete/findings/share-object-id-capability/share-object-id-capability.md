# Public Share uses database object identifiers as bearer credentials

- Severity: medium
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

Public Share GET treats `sessionId + workerId` as the capability without recipient contact verification.

## Remediation

Use a dedicated high-entropy revocable token stored as a hash and bound to recipient and expiry.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

