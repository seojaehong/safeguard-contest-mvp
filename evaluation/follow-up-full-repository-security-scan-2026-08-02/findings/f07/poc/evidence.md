# Safe supporting evidence

Candidate: `candidate-5ead52eea8de6fc0`

This file records non-mutating reproduction guidance and direct evidence for review. No DB, provider, share-session, vector, wiki, or KOSHA registry mutation was executed.

## Evidence locations

- `supabase/migrations/002_workspace_productization.sql:59-74` (source)
- `supabase/migrations/002_workspace_productization.sql:166-181` (root_control)

## Safe verification

- Reject every tenant A record containing one tenant B foreign key.
- Cover insert and update paths for all three relationships.
