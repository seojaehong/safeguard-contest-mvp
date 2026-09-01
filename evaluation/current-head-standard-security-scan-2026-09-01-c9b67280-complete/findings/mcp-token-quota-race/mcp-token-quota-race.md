# MCP active-token quota can be exceeded through concurrent issuance

## Severity

Low

## Attack Path

Concurrent authenticated issuance requests can all observe free capacity and each insert a token.

## Source Evidence

app/api/mcp-tokens/route.ts:247-280 separates the count and insert; migration 009 adds only an index.

## Impact

The affected control can be bypassed or exhausted under the stated preconditions. Current live database state and approval-gated operations were not exercised.

## Remediation

Use a transactionally locked issuance function or bounded unique slots.

## Boundaries

No database, provider, Share-session, vector, wiki, embedding, or KOSHA registry mutation was performed. Exact saved Share remains MISSING_EVIDENCE.

