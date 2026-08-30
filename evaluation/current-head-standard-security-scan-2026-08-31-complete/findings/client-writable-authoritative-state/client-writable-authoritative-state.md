# Tenant-writable rows can forge authoritative workflow evidence

- Severity: low
- Confidence: high
- Rule: `authorization-bypass.client-writable-authoritative-state`
- Target revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`

## Summary

Broad tenant FOR ALL policies permit direct mutation of status, review, receipt, and workflow fields later consumed as authoritative evidence.

## Code Evidence

- `supabase/migrations/002_workspace_productization.sql:149-200`
- `supabase/migrations/003_knowledge_runtime.sql:94-126`
- `supabase/migrations/010_commercial_operations.sql:161-227`

## Attack Path

Broad tenant FOR ALL policies permit direct mutation of status, review, receipt, and workflow fields later consumed as authoritative evidence.

- Impact: medium
- Likelihood: low

## Limitations

- Effective direct-table grants and migration 010 deployment were not inspected.

## Remediation

Approval-gated: split client input from authoritative result state and expose narrow server-only transactional transitions.

## Scan Boundaries

No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`. Approval-gated deployment and database claims remain unverified.

