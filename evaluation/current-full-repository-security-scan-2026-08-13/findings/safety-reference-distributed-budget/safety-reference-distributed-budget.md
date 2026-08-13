# Safety-reference provider work uses per-instance production limits

- Severity: `medium`
- Confidence: `high`
- Rule: `resource-exhaustion.distributed-search-admission`

## Summary

Public safety-reference search can multiply service-role database and optional embedding work across production instances.

## Attack Path

GET /api/safety-reference/search crosses the broken control into Supabase search and optional OpenAI embeddings.

## Impact

Public safety-reference search can multiply service-role database and optional embedding work across production instances.

## Source Locations

- `app/api/safety-reference/search/route.ts:47` (root_control)

## Validation Boundaries

- No live DB, provider, deployment, Share-session, vector, wiki, or KOSHA registry mutation was performed.
- Optional deployment prerequisites are stated in the finding.

## Remediation

Require distributed production rate control and durable weighted leases for database and embedding work.

This write-up documents static current-revision evidence only. No database, provider, Share-session, vector, wiki, or KOSHA registry mutation was performed.