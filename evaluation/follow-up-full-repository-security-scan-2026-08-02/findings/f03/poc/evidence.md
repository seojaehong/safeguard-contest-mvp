# Safe supporting evidence

Candidate: `candidate-3a1b115c790af29d`

This file records non-mutating reproduction guidance and direct evidence for review. No DB, provider, share-session, vector, wiki, or KOSHA registry mutation was executed.

## Evidence locations

- `app/api/search/route.ts:7-9` (entrypoint)
- `lib/legal-sources.ts:121-150` (sink)

## Safe verification

- Reject oversized legal queries before any provider call.
- Assert repeated public requests are throttled before retry fan-out.
