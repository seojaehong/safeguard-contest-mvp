# Safe supporting evidence

Candidate: `candidate-737d561572703a47`

This file records non-mutating reproduction guidance and direct evidence for review. No DB, provider, share-session, vector, wiki, or KOSHA registry mutation was executed.

## Evidence locations

- `app/api/safety-reference/search/route.ts:7-25` (entrypoint)
- `lib/safety-reference-catalog-server.ts:503-523` (sink)

## Safe verification

- Reject oversized queries before corpus or network work.
- Throttle repeated public searches and cap returned result work.
