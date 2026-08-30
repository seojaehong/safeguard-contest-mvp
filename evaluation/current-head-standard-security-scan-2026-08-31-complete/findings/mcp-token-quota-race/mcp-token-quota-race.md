# MCP active-token quota remains non-atomic

- Severity: low
- Confidence: high
- Rule: `race-condition.quota-enforcement`
- Target revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`

## Summary

Concurrent token issuance requests can all observe a count below the cap before separate inserts commit.

## Code Evidence

- `app/api/mcp-tokens/route.ts:247-278`
- `supabase/migrations/007_mcp_tokens.sql:14-32`

## Attack Path

Concurrent token issuance requests can all observe a count below the cap before separate inserts commit.

- Impact: low
- Likelihood: medium

## Limitations

- No live concurrency test was performed.

## Remediation

Approval-gated: enforce count and insert in one serialized database function or locked transaction.

## Scan Boundaries

No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`. Approval-gated deployment and database claims remain unverified.

