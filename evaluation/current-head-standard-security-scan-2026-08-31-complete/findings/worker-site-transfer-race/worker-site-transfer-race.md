# Concurrent worker imports can bypass the site-transfer check

- Severity: medium
- Confidence: high
- Rule: `race-condition.worker-site-binding`
- Target revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`

## Summary

Two concurrent imports can both pass the preflight lookup and then upsert the same organization/external_key with different site_id values.

## Code Evidence

- `app/api/workers/route.ts:84-120`
- `supabase/migrations/002_workspace_productization.sql:21-42`

## Attack Path

Two concurrent imports can both pass the preflight lookup and then upsert the same organization/external_key with different site_id values.

- Impact: medium
- Likelihood: low

## Limitations

- No live concurrency test was performed.

## Remediation

Approval-gated: serialize by organization_id and external_key in a transactional RPC and require an explicit transfer transition.

## Scan Boundaries

No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`. Approval-gated deployment and database claims remain unverified.

