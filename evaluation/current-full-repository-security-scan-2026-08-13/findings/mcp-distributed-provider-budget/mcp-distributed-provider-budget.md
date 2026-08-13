# Provider-generating MCP tools fall back to per-instance throttling

- Severity: `medium`
- Confidence: `high`
- Rule: `resource-exhaustion.distributed-provider-admission`

## Summary

A write-capable MCP token can multiply provider-backed generation work across instances because rate limiting is optional and no generation lease exists.

## Attack Path

POST /api/mcp/mcp generation tools crosses the broken control into Provider-backed runAsk work.

## Impact

A write-capable MCP token can multiply provider-backed generation work across instances because rate limiting is optional and no generation lease exists.

## Source Locations

- `app/api/mcp/[transport]/implementation.ts:356` (root_control)

## Validation Boundaries

- No live DB, provider, deployment, Share-session, vector, wiki, or KOSHA registry mutation was performed.
- Optional deployment prerequisites are stated in the finding.

## Remediation

Require distributed rate control and a durable provider-generation lease keyed by token or tenant.

This write-up documents static current-revision evidence only. No database, provider, Share-session, vector, wiki, or KOSHA registry mutation was performed.