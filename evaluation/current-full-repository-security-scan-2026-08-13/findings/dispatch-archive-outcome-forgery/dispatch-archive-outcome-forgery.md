# Dispatch archive accepts unverified provider outcomes

- Severity: `low`
- Confidence: `high`
- Rule: `integrity.untrusted-provider-receipt`

## Summary

An authenticated tenant owner can write arbitrary provider and status claims without an authoritative dispatch attempt or receipt.

## Attack Path

POST /api/dispatch-logs crosses the broken control into Service-role dispatch_logs insert.

## Impact

An authenticated tenant owner can write arbitrary provider and status claims without an authoritative dispatch attempt or receipt.

## Source Locations

- `app/api/dispatch-logs/route.ts:260` (root_control)

## Validation Boundaries

- No live DB, provider, deployment, Share-session, vector, wiki, or KOSHA registry mutation was performed.
- Optional deployment prerequisites are stated in the finding.

## Remediation

Create archive rows only from immutable server attempts and verified provider results.

This write-up documents static current-revision evidence only. No database, provider, Share-session, vector, wiki, or KOSHA registry mutation was performed.