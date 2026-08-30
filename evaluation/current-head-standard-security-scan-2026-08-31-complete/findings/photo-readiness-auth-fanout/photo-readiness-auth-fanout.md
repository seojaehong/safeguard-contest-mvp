# Photo readiness GET permits admissionless Supabase authentication fanout

- Severity: medium
- Confidence: high
- Rule: `resource-exhaustion.photo-readiness-auth-fanout`
- Target revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`

## Summary

Arbitrary non-empty Bearer tokens on the public readiness GET trigger Supabase Auth before any distributed admission, route deadline, or cancellation boundary.

## Code Evidence

- `app/api/input-photos/hazard-analysis/route.ts:44-64`
- `lib/supabase-admin.ts:624-635`

## Attack Path

Arbitrary non-empty Bearer tokens on the public readiness GET trigger Supabase Auth before any distributed admission, route deadline, or cancellation boundary.

- Impact: medium
- Likelihood: high

## Limitations

- Supabase must be configured for the authentication sink to be reachable.

## Remediation

Return coarse readiness without authentication or move diagnostics behind admitted authenticated operator access with token and timeout bounds.

## Scan Boundaries

No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`. Approval-gated deployment and database claims remain unverified.

