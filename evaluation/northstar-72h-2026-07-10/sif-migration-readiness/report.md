# SafeClaw SIF Migration/Apply Readiness

Generated: 2026-07-10 KST  
Repo/worktree: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\backend-harness-gate`  
Branch: `feature/backend-harness-gate`

## Scope And Non-Actions

This is a readiness sidecar only. I inspected the SIF source/corpus/migration/runtime path and did not run a DB migration, did not upload embeddings, did not mutate Supabase data, and did not touch `.env` or secrets.

## Readiness Verdict

Current state: **ready to request Phase 2 SIF-only migration approval, not ready to enable vector embedding search yet.**

The SIF corpus and approval artifacts are prepared, but the target DB evidence still shows no `safety_reference_embeddings` table and no `match_safety_reference_embeddings` RPC. Runtime vector search must stay off until the migration is applied, the 6,032-row upload is verified, and the RPC smoke test returns rows.

## Current SIF Source And Corpus Counts

| Surface | Current finding | Evidence |
| --- | ---: | --- |
| Original XLSX source described by analysis | 6,032 normalized case rows | `evaluation/data-ingestion/sif-analysis.md` |
| Sheet `아카이브(제조업등)` | 2,573 rows | `evaluation/data-ingestion/sif-analysis.md` |
| Sheet `아카이브(건설업)` | 3,459 rows | `evaluation/data-ingestion/sif-analysis.md` |
| Current DB-derived SIF source items | 6,033 rows | `evaluation/sif-embedding-gate/report.json`, `runtime-db-probe.json` |
| Skipped source rows | 1 spreadsheet header row, id `sif-아카이브-건설업-00001` | `evaluation/sif-embedding-gate/report.json` |
| Current embedding corpus | 6,032 JSONL lines | direct JSONL line count |
| Corpus category split | `아카이브(건설업)` 3,459, `아카이브(제조업등)` 2,573 | direct JSONL category count |
| Batch manifest | 61 batches, batch size 100 | `evaluation/sif-embedding-gate/sif-embedding-batch-manifest.json` |
| Full embeddings generated/uploaded | 0 / 0 | `evaluation/sif-embedding-gate/report.json` |
| Canary embedding | 3 generated, 0 uploaded | `evaluation/sif-embedding-canary-2026-07-09/report.json` |

Corpus hash: `2712c6eafd24962588293749bb12d249cf761972dcdea7b249f16efea76b8f3e`  
Corpus JSONL SHA256: `54DB348B32016725AFCF1A550D819EF7CB9B6EF6A278C728AC6F8D7EED02A5F7`

Source mapping available:

- Parser source: `scripts/ingest_safety_reference_catalog.py` maps the XLSX to source id `kosha-sif-archive-20260401`.
- Current corpus records carry `referenceItemId` plus sheet category. The IDs map back through `safety_reference_items.id` to `safety_reference_items.source_id = kosha-sif-archive-20260401`.
- The analysis document names the original source as `C:\Users\iceam\Downloads\한국산업안전보건공단_산업재해 고위험요인(SIF) 아카이브_20260401.xlsx`.
- That XLSX is not tracked in this repo, and it was not present at the recorded `Downloads` path during this check. Current counts are therefore verified from checked-in analysis/corpus artifacts and DB probe output, not by reopening the original workbook.

## Migration Files And Approval Safety

`supabase/migrations/004_safety_reference_catalog.sql`

- Creates `safety_reference_sources`, `safety_reference_items`, and ingestion run tables.
- This is the base catalog path already used by current SIF/KOSHA search.

`supabase/migrations/010_commercial_operations.sql`

- Draft approval migration for a broader commercial operations layer.
- Includes `safety_reference_embeddings`, HNSW index, and `match_safety_reference_embeddings`.
- Also includes share sessions, read confirmations, workpack improvements, photo metadata, storage bucket creation, and workpack column changes.
- Not SIF-only. Do not use it for Phase 2 unless the approval explicitly covers the wider schema/storage scope.

`evaluation/sif-embedding-gate/sif-embedding-only-migration.sql`

- Best Phase 2 approval target.
- Marked as an approval artifact: "Do not apply without explicit DB migration approval."
- Adds only `vector`, `safety_reference_embeddings`, unique `(reference_item_id, embedding_model)`, reference index, HNSW cosine index, `match_safety_reference_embeddings`, RLS, and public select blocked with `using (false)`.
- SHA256: `B45EE34862AED599E0AD7AC6454E4F957382F87B4B47807DC52E97D588D30334`

## Current Runtime Path

The runtime already has the fallback structure needed for an approval-gated vector rollout:

- `searchSafetyReferences()` in `lib/safety-reference-catalog.ts` resolves `SAFETY_REFERENCE_VECTOR_SEARCH`. Default is disabled.
- If enabled and `OPENAI_API_KEY` is present, it creates a query embedding, calls `match_safety_reference_embeddings`, and merges vector rows with ranked RPC rows.
- If vector is disabled, missing, empty, or RPC 404s, the path falls back to ranked RPC and then REST `ilike`/tag/source filters.
- The search result exposes `retrievalMode`: `hybrid-vector-rpc`, `ranked-rpc`, `rest-ilike`, or `unconfigured`.
- `run_safeclaw_harness_agent` calls three searches: direct evidence, `itemType=sif-case`, and supporting evidence. It then builds a `db_harness_first` packet and a `naturalize_only` generation contract.
- `/api/ask` also builds a DB harness packet and propagates retrieval contract metadata into user-facing responses.

Current DB probe:

- `safety_reference_items`: ready, count 6,033.
- `safety_reference_embeddings`: 404 missing.
- `match_safety_reference_embeddings`: 404 missing.
- `SAFETY_REFERENCE_VECTOR_SEARCH`: off.
- Post-migration verifier status: `migration-required`.

## Missing Pieces Before Vector Search

1. Explicit approval to apply the SIF-only migration SQL, with the hash above fixed in the approval note.
2. Runtime DB probe after migration showing table and RPC ready.
3. Explicit approval for full embedding cost execution.
4. Full embedding generation for 6,032 corpus records using `text-embedding-3-small`, 1,536 dimensions.
5. Explicit upload approval and DB upsert into `safety_reference_embeddings`.
6. Row count verification: uploaded rows must equal 6,032 for the fixed corpus hash.
7. Metadata sample verification: uploaded rows should preserve `contentHash`, `itemType`, and title metadata.
8. `match_safety_reference_embeddings` smoke test with a real query embedding.
9. Only after those pass, enable `SAFETY_REFERENCE_VECTOR_SEARCH=1`.
10. Re-run `/api/safety-reference/search`, `/api/ask` or `/workspace`, and the MCP harness to confirm `hybrid-vector-rpc`.

## Exact Phase 2 Approval Checklist

Before approval:

- Confirm no unrelated app-code changes are being bundled into the migration/apply task.
- Approve `evaluation/sif-embedding-gate/sif-embedding-only-migration.sql` by path and SHA256.
- Confirm this approval does not include broader `010_commercial_operations.sql` tables unless separately approved.
- Confirm `SAFETY_REFERENCE_VECTOR_SEARCH` remains off.
- Confirm preflight has no failed checks and reports `dbMutationPerformed=false`, `embeddingGenerated=false`, `uploaded=false`.

Approved sequence:

1. Apply only the approved SIF-only migration SQL.
2. Run the runtime DB probe and verify `safety_reference_embeddings` and `match_safety_reference_embeddings` are ready.
3. Run embedding generation only after cost approval:

```powershell
npm.cmd run knowledge:sif-embedding-corpus -- --embed --approved-embedding
```

4. Run upload only after DB migration and upload approval:

```powershell
npm.cmd run knowledge:sif-embedding-corpus -- --embed --approved-embedding --upload --approved-upload
```

5. Run read-only post-migration verification:

```powershell
npm.cmd run knowledge:sif-embedding-post-migration-verify -- --output evaluation/sif-embedding-gate/post-migration-verify.json
```

6. Verify row count is 6,032, RPC smoke returns rows, metadata samples are present, and vector flag is still off during verification.
7. Enable `SAFETY_REFERENCE_VECTOR_SEARCH=1`.
8. Re-run API/runtime checks and save evidence under `evaluation/`.

## Frontend And Runtime Surfaces To Update After Embeddings Are Active

- `/settings/ai-connect`: change SIF gate state from migration approval pending to upload verified/vector active. The existing card already has `vectorGuard`, `learningLifecycle`, approval steps, artifact integrity, and command surfaces.
- `/api/sif-embedding-gate/status`: should report `dbUploadVerified=true`, `vectorSearchUsable=true`, uploaded count 6,032, and no failed verifier checks.
- `/api/sif-embedding-gate/approval-packet`: should move from approval request to completed audit packet or next operational gate.
- `/api/safety-reference/search`: should return `retrievalMode=hybrid-vector-rpc` and `vectorSearch.reason=ready` when vector results exist.
- `/workspace` and `/api/ask`: DB harness summary should surface `hybrid-vector-rpc` instead of only ranked/REST fallback.
- `AnswerPanel`/status notes: show that the document response used approved vector retrieval when `dbHarness.summary.retrievalContract.vector.ready` is true.
- MCP `run_safeclaw_harness_agent`: returned `packet.retrievalContract` and `promptContext` should report `hybrid-vector-rpc / vector=ready`.
- `/knowledge` and `/evidence`: add or expose SIF vector retrieval state next to catalog counts so operators can distinguish "catalog loaded" from "embedding retrieval active."
- Learning/operation graph exports: preserve retrieval provenance as `hybrid-vector-rpc` for later audit.

## Bottom Line

The corpus side is ready and the approval packet is credible. The next safe action is not upload and not feature flag activation; it is explicit approval and application of the SIF-only migration artifact, followed by read-only probe evidence.
