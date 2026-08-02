# Safe supporting evidence

Candidate: `candidate-b3d53e946a9a7ecf`

This file records non-mutating reproduction guidance and direct evidence for review. No DB, provider, share-session, vector, wiki, or KOSHA registry mutation was executed.

## Evidence locations

- `supabase/migrations/001_init.sql:1-6` (root_control)

## Safe verification

- Anonymous and ordinary authenticated roles cannot read query text.
- Only the intended server or operator role can insert and inspect logs.
