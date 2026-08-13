# Concurrent MCP token issuance can exceed the active-token cap

- Severity: `low`
- Confidence: `high`
- Rule: `business-logic.atomic-credential-admission`

## Summary

The site token limit is checked in one database request and inserted in another, allowing concurrent issuance above the cap.

## Attack Path

POST /api/mcp-tokens crosses the broken control into mcp_tokens insert.

## Impact

The site token limit is checked in one database request and inserted in another, allowing concurrent issuance above the cap.

## Source Locations

- `app/api/mcp-tokens/route.ts:240` (root_control)

## Validation Boundaries

- No live DB, provider, deployment, Share-session, vector, wiki, or KOSHA registry mutation was performed.
- Optional deployment prerequisites are stated in the finding.

## Remediation

Use an atomic transactional database function or per-site locked reservation.

This write-up documents static current-revision evidence only. No database, provider, Share-session, vector, wiki, or KOSHA registry mutation was performed.