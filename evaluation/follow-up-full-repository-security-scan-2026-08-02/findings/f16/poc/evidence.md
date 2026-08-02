# Safe supporting evidence

Candidate: `candidate-8a52343203698158`

This file records non-mutating reproduction guidance and direct evidence for review. No DB, provider, share-session, vector, wiki, or KOSHA registry mutation was executed.

## Evidence locations

- `supabase/migrations/001_init.sql:8-16` (root_control)

## Safe verification

- Anonymous and unrelated authenticated roles cannot read or mutate documents.
- Tenant A cannot access tenant B document bodies or citations.
