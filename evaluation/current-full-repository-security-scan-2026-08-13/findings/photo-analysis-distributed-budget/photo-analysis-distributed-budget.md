# Authenticated photo analysis falls back to per-instance provider budgets

- Severity: `medium`
- Confidence: `high`
- Rule: `resource-exhaustion.distributed-provider-admission`

## Summary

An authenticated user can multiply OpenAI vision admission across scaled processes because production photo checks allow instance fallback.

## Attack Path

POST /api/input-photos/hazard-analysis crosses the broken control into OpenAI Responses vision analysis.

## Impact

An authenticated user can multiply OpenAI vision admission across scaled processes because production photo checks allow instance fallback.

## Source Locations

- `lib/public-distributed-rate-limit.ts:379` (root_control)

## Validation Boundaries

- No live DB, provider, deployment, Share-session, vector, wiki, or KOSHA registry mutation was performed.
- Optional deployment prerequisites are stated in the finding.

## Remediation

Require distributed production admission plus durable authenticated-user and global provider quotas.

This write-up documents static current-revision evidence only. No database, provider, Share-session, vector, wiki, or KOSHA registry mutation was performed.