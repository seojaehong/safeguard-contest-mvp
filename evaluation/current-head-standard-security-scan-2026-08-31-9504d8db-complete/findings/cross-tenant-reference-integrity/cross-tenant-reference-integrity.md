# Related object identifiers are not bound to the same tenant

- Severity: low
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

Independent foreign keys allow identifiers from different organizations, sites, workpacks, workers, photos, Share sessions, and acknowledgements to coexist.

## Remediation

Add composite tenant-scoped constraints or constraint triggers and retain application tuple checks.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

