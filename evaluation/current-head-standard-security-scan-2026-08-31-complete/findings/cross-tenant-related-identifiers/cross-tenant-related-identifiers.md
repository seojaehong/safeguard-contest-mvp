# Related object identifiers are not bound to the same tenant

- Severity: low
- Confidence: high
- Rule: `authorization-bypass.cross-tenant-reference`
- Target revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`

## Summary

Independent foreign keys and owner checks allow a row owned by one tenant to reference related object UUIDs from another tenant.

## Code Evidence

- `supabase/migrations/002_workspace_productization.sql:21-90`
- `supabase/migrations/003_knowledge_runtime.sql:1-64`
- `supabase/migrations/010_commercial_operations.sql:21-95`

## Attack Path

Independent foreign keys and owner checks allow a row owned by one tenant to reference related object UUIDs from another tenant.

- Impact: medium
- Likelihood: low

## Limitations

- Migration 010 deployment and effective direct-table grants were not inspected.

## Remediation

Approval-gated: add composite tenant keys or validation triggers and enforce same-tenant tuples transactionally.

## Scan Boundaries

No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`. Approval-gated deployment and database claims remain unverified.

