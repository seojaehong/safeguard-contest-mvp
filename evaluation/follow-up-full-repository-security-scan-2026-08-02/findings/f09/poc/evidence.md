# Safe supporting evidence

Candidate: `candidate-c0d9c7a5c82ae199`

This file records non-mutating reproduction guidance and direct evidence for review. No DB, provider, share-session, vector, wiki, or KOSHA registry mutation was executed.

## Evidence locations

- `supabase/migrations/010_commercial_operations.sql:51-69` (source)
- `supabase/migrations/010_commercial_operations.sql:195-210` (root_control)

## Safe verification

- Reject cross-tenant workpack and site IDs on insert and update.
- Accept only same-tenant, internally consistent improvement rows.
