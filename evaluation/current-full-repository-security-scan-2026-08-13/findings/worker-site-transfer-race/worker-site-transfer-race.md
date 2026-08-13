# Worker site-transfer protection has a check-then-upsert race

- Severity: `low`
- Confidence: `high`
- Rule: `business-logic.atomic-site-binding`

## Summary

Concurrent first-time saves for one worker key and different sites can bypass the pre-check and update the winning site.

## Attack Path

POST /api/workers crosses the broken control into workers upsert.

## Impact

Concurrent first-time saves for one worker key and different sites can bypass the pre-check and update the winning site.

## Source Locations

- `app/api/workers/route.ts:78` (root_control)

## Validation Boundaries

- No live DB, provider, deployment, Share-session, vector, wiki, or KOSHA registry mutation was performed.
- Optional deployment prerequisites are stated in the finding.

## Remediation

Use an atomic RPC or conditional ON CONFLICT update that refuses a different existing site.

This write-up documents static current-revision evidence only. No database, provider, Share-session, vector, wiki, or KOSHA registry mutation was performed.