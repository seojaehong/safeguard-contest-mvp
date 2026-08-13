# Legal search lacks a durable production concurrency budget

- Severity: `medium`
- Confidence: `high`
- Rule: `resource-exhaustion.distributed-search-admission`

## Summary

Public legal search uses an optional distributed rate limiter and no global concurrency lease before multi-provider retries.

## Attack Path

GET /api/search crosses the broken control into Legal-provider retry fan-out.

## Impact

Public legal search uses an optional distributed rate limiter and no global concurrency lease before multi-provider retries.

## Source Locations

- `app/api/search/route.ts:70` (root_control)

## Validation Boundaries

- No live DB, provider, deployment, Share-session, vector, wiki, or KOSHA registry mutation was performed.
- Optional deployment prerequisites are stated in the finding.

## Remediation

Require distributed production rate limiting and a durable weighted concurrency lease for legal-provider work.

This write-up documents static current-revision evidence only. No database, provider, Share-session, vector, wiki, or KOSHA registry mutation was performed.