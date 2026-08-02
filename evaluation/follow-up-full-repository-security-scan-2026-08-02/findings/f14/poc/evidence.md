# Safe supporting evidence

Candidate: `candidate-18468428547ee512`

This file records non-mutating reproduction guidance and direct evidence for review. No DB, provider, share-session, vector, wiki, or KOSHA registry mutation was executed.

## Evidence locations

- `supabase/migrations/002_workspace_productization.sql:21-41` (source)
- `supabase/migrations/002_workspace_productization.sql:132-147` (root_control)

## Safe verification

- Reject an owned worker row containing a foreign-tenant site UUID.
- Verify authorized same-tenant site reassignment remains possible.
