# Public Ask endpoints fall back to per-instance provider budgets

- Severity: `medium`
- Confidence: `high`
- Rule: `resource-exhaustion.distributed-provider-admission`

## Summary

Unauthenticated sync and streaming Ask operations can multiply provider rate and weighted concurrency capacity across production instances when distributed admission is absent.

## Attack Path

POST /api/ask and POST /api/ask/stream crosses the broken control into runAsk provider fan-out.

## Impact

Unauthenticated sync and streaming Ask operations can multiply provider rate and weighted concurrency capacity across production instances when distributed admission is absent.

## Source Locations

- `lib/public-ask-admission.ts:27` (root_control)

## Validation Boundaries

- No live DB, provider, deployment, Share-session, vector, wiki, or KOSHA registry mutation was performed.
- Optional deployment prerequisites are stated in the finding.

## Remediation

Require distributed production rate and weighted concurrency admission for provider-backed Ask modes and fail closed when durable admission is unavailable.

This write-up documents static current-revision evidence only. No database, provider, Share-session, vector, wiki, or KOSHA registry mutation was performed.