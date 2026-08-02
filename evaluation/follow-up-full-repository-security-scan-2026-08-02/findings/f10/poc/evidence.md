# Safe supporting evidence

Candidate: `candidate-599e2c8fab24dc32`

This file records non-mutating reproduction guidance and direct evidence for review. No DB, provider, share-session, vector, wiki, or KOSHA registry mutation was executed.

## Evidence locations

- `supabase/migrations/003_knowledge_runtime.sql:21-44` (source)
- `supabase/migrations/003_knowledge_runtime.sql:94-109` (root_control)

## Safe verification

- Reject each cross-tenant related-object permutation.
- Verify provenance exports never resolve foreign-tenant objects.
