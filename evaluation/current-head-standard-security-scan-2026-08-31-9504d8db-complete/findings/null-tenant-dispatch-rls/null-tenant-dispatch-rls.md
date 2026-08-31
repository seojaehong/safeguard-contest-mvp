# NULL-tenant dispatch rows bypass owner-scoped RLS

- Severity: medium
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

The dispatch table permits NULL `organization_id` and the owner FOR ALL policy accepts those rows, leaving tenantless state outside normal ownership.

## Remediation

Make the tenant key non-null, quarantine legacy rows, and remove the NULL policy branch.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

