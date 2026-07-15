# SIF Post-Migration Verifier Report

Date: 2026-07-09

## What Changed

SafeClaw now has a read-only post-migration verifier for the SIF embedding gate.

Command:

```powershell
npm.cmd run knowledge:sif-embedding-post-migration-verify -- --output evaluation/sif-embedding-gate/post-migration-verify.json
```

The verifier is intended to run after the approved SIF-only migration and after the approved embedding upload.

## Current Runtime Result

The current DB is still before migration.

- Status: `migration-required`
- SIF source count: 6,033
- Expected embedding rows: 6,032
- Uploaded embedding rows: 0
- `safety_reference_embeddings`: missing
- `match_safety_reference_embeddings`: missing
- `SAFETY_REFERENCE_VECTOR_SEARCH`: off

This confirms that the full SIF embedding/upload gate has not passed yet.

## What The Verifier Checks

- SIF source count still matches 6,033.
- `safety_reference_embeddings` exists.
- Uploaded row count equals the fixed corpus count, 6,032.
- `match_safety_reference_embeddings` RPC is callable.
- Sample embedding rows contain model and metadata.
- Vector feature flag is allowed only after row count and RPC checks are green.

## Boundary

This turn did not apply a DB migration, generate the full SIF embeddings, upload embeddings, or enable vector search. It only added and executed a read-only verifier so the next approval gate has an auditable post-migration check.
