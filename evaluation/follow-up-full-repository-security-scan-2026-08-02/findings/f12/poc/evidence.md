# Safe supporting evidence

Candidate: `candidate-3f9e10f8d6d58aac`

This file records non-mutating reproduction guidance and direct evidence for review. No DB, provider, share-session, vector, wiki, or KOSHA registry mutation was executed.

## Evidence locations

- `supabase/migrations/010_commercial_operations.sql:36-49` (source)
- `supabase/migrations/010_commercial_operations.sql:178-193` (root_control)

## Safe verification

- Reject acknowledgements mixing tenant A and B identifiers.
- Reject workers that are not recipients of the referenced session.
