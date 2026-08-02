# Safe supporting evidence

Candidate: `candidate-ec168b19ed09499e`

This file records non-mutating reproduction guidance and direct evidence for review. No DB, provider, share-session, vector, wiki, or KOSHA registry mutation was executed.

## Evidence locations

- `supabase/migrations/010_commercial_operations.sql:71-86` (source)
- `supabase/migrations/010_commercial_operations.sql:212-227` (root_control)

## Safe verification

- Reject photo rows that mix tenant A ownership with tenant B related IDs.
- Reject an improvement that does not belong to the selected workpack.
