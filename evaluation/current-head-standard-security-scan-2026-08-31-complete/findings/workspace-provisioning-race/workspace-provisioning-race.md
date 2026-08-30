# Workspace provisioning can create duplicate organizations and sites

- Severity: low
- Confidence: high
- Rule: `race-condition.workspace-provisioning`
- Target revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`

## Summary

Concurrent first-use requests can all miss select-then-insert checks and create duplicate owner organizations or same-name sites because no natural-key uniqueness enforces idempotency.

## Code Evidence

- `lib/supabase-admin.ts:645-715`
- `supabase/migrations/002_workspace_productization.sql:3-19`

## Attack Path

Concurrent first-use requests can all miss select-then-insert checks and create duplicate owner organizations or same-name sites because no natural-key uniqueness enforces idempotency.

- Impact: low
- Likelihood: medium

## Limitations

- The intended future multi-organization identity must be decided before migration.

## Remediation

Define the workspace identity and add an idempotency key or uniqueness, then provision transactionally.

## Scan Boundaries

No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`. Approval-gated deployment and database claims remain unverified.

