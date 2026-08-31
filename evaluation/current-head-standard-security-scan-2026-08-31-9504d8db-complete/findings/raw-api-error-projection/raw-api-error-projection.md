# API error responses expose internal database and provider details

- Severity: low
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

Public and authenticated routes project raw exception, database, webhook body, or vision-provider details to clients.

## Remediation

Return stable codes and generic messages; log redacted causes server-side.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

