# Cross-tenant confirmation rows can suppress legitimate public acknowledgements

- Severity: `medium`
- Confidence: `high`
- Rule: `tenant-integrity.related-object-binding`

## Summary

Owner-only RLS does not bind confirmation foreign keys to the row tenant, and the public idempotency query omits organization and site filters.

## Attack Path

Direct PostgREST insert plus public acknowledgement crosses the broken control into Public idempotent success branch.

## Impact

Owner-only RLS does not bind confirmation foreign keys to the row tenant, and the public idempotency query omits organization and site filters.

## Source Locations

- `app/api/share-sessions/[sessionId]/route.ts:232` (root_control)

## Validation Boundaries

- No live DB, provider, deployment, Share-session, vector, wiki, or KOSHA registry mutation was performed.
- Optional deployment prerequisites are stated in the finding.

## Remediation

Add tenant-tuple constraints and RLS checks, then filter and verify the complete tuple before idempotent success.

This write-up documents static current-revision evidence only. No database, provider, Share-session, vector, wiki, or KOSHA registry mutation was performed.