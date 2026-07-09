# SIF-Only Migration Approval Package

Generated: 2026-07-09 18:03 KST

## Decision Needed

Approve the SIF-only runtime migration before any full embedding upload.

The current verified migration artifact is:

- `evaluation/sif-embedding-gate/sif-embedding-only-migration.sql`

This package does not apply the migration and does not upload embeddings.

## Current Gate Result

Command:

```powershell
npm.cmd run knowledge:sif-embedding-preflight -- --require-execution-env --output evaluation/sif-embedding-gate/approval-preflight-report.json
npm.cmd run knowledge:sif-embedding-runtime-probe -- --output evaluation/sif-embedding-gate/runtime-db-probe.json
```

Result:

- preflight: ok
- failedCheckIds: none
- dbMutationPerformed: false
- embeddingGenerated: false
- uploaded: false
- executionReadyAfterApproval: true
- runtime DB status: `migration-required`

## Why Migration Comes Before Upload

The target DB currently has:

- `safety_reference_items`: ok, SIF count 6,033
- `safety_reference_embeddings`: missing
- `match_safety_reference_embeddings`: missing

Therefore a 6,032-row upload would fail until the table, HNSW index, RLS, and RPC exist.

## What The SIF-Only Migration Adds

- `vector` extension
- `safety_reference_embeddings`
- unique key on `(reference_item_id, embedding_model)`
- reference item index
- HNSW cosine vector index
- `match_safety_reference_embeddings` RPC
- RLS enabled
- public select blocked with `using (false)`

## What It Intentionally Does Not Add

- share sessions
- read confirmations
- workpack improvements
- report snapshots
- export jobs
- commercial operations workflow tables

Those remain a separate commercial operations migration gate.

## Approval Sequence

1. Approve and apply `evaluation/sif-embedding-gate/sif-embedding-only-migration.sql` or an equivalent production migration.
2. Run `knowledge:sif-embedding-runtime-probe` again and verify table/RPC readiness.
3. Run embedding generation and upload only after explicit approval:

```powershell
npm.cmd run knowledge:sif-embedding-corpus -- --embed --approved-embedding --upload --approved-upload
```

4. Run the read-only post-migration verifier:

```powershell
npm.cmd run knowledge:sif-embedding-post-migration-verify -- --output evaluation/sif-embedding-gate/post-migration-verify.json
```

5. Verify uploaded row count equals 6,032 and RPC smoke returns rows.
6. Enable `SAFETY_REFERENCE_VECTOR_SEARCH=1`.
7. Verify `/workspace` evidence path reports vector retrieval, such as `hybrid-vector-rpc`.

## Non-Approval Outcome

If migration approval is not given, SafeClaw should continue using the current REST/RPC/tag search path. The harness can still use SIF/KOSHA references from `safety_reference_items`, but vector retrieval remains off.
