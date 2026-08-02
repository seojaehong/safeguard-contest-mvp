# Safe supporting evidence

Candidate: `candidate-d15f964a8816890f`

This file records non-mutating reproduction guidance and direct evidence for review. No DB, provider, share-session, vector, wiki, or KOSHA registry mutation was executed.

## Evidence locations

- `app/api/mcp/[transport]/implementation.ts:151-198` (entrypoint)
- `app/api/mcp/[transport]/implementation.ts:315-372` (root_control)

## Safe verification

- Reject over-budget strings before invoking any provider or persistence helper.
- Assert aggregate nested payload limits and durable tenant throttling.
