# Legacy document and query tables lack row-level security

- Severity: medium
- Confidence: medium
- Rule: `authorization-bypass.missing-row-level-security`
- Target revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`

## Summary

Migration 001 creates documents and query_logs without RLS; direct Data API access can cross tenant boundaries if deployed grants expose them.

## Code Evidence

- `supabase/migrations/001_init.sql:1-17`

## Attack Path

Migration 001 creates documents and query_logs without RLS; direct Data API access can cross tenant boundaries if deployed grants expose them.

- Impact: high
- Likelihood: unknown

## Limitations

- Effective production grants and live table use were not inspected.

## Remediation

Approval-gated: enable and force RLS, add tenant ownership or retire the tables, revoke unnecessary grants, and verify direct-role denial.

## Scan Boundaries

No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`. Approval-gated deployment and database claims remain unverified.

