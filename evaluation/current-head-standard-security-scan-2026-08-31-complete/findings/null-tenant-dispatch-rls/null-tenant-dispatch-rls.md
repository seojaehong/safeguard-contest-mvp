# NULL-tenant dispatch rows bypass owner-scoped RLS

- Severity: medium
- Confidence: high
- Rule: `authorization-bypass.null-tenant-policy`
- Target revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`

## Summary

dispatch_logs permits nullable ownership and the FOR ALL policy explicitly accepts organization_id IS NULL for reads and writes.

## Code Evidence

- `supabase/migrations/002_workspace_productization.sql:76-90`
- `supabase/migrations/002_workspace_productization.sql:183-200`

## Attack Path

dispatch_logs permits nullable ownership and the FOR ALL policy explicitly accepts organization_id IS NULL for reads and writes.

- Impact: high
- Likelihood: unknown

## Limitations

- Effective production grants and existing NULL rows were not inspected.

## Remediation

Approval-gated: backfill or quarantine tenantless rows, require non-null ownership, remove NULL policy branches, and add direct-role tests.

## Scan Boundaries

No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`. Approval-gated deployment and database claims remain unverified.

