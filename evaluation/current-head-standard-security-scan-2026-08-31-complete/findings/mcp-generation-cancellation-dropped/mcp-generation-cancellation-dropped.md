# MCP document-generation tools drop transport cancellation

- Severity: medium
- Confidence: high
- Rule: `resource-exhaustion.mcp-generation-cancellation-dropped`
- Target revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`

## Summary

Scoped MCP receives an AbortSignal, but generation registrations omit it and docpack handlers invoke knowledge/provider work without transport cancellation.

## Code Evidence

- `lib/mcp-scoped-tool.ts:24-80`
- `app/api/mcp/[transport]/implementation.ts:198-233`
- `lib/mcp-docpack-handler.ts:34-84`
- `lib/mcp-docpack-handler.ts:153-176`

## Attack Path

Scoped MCP receives an AbortSignal, but generation registrations omit it and docpack handlers invoke knowledge/provider work without transport cancellation.

- Impact: medium
- Likelihood: medium

## Limitations

- Provider calls retain independent timeouts.

## Remediation

Thread the scoped AbortSignal through both generation handlers, knowledge retrieval, runAsk, and provider calls, releasing admission promptly on abort.

## Scan Boundaries

No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`. Approval-gated deployment and database claims remain unverified.

