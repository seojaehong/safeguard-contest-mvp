# KOSHA Guide Approval Packet

Generated at: 2026-07-20T06:05:20.000Z

## Decision

`approval_required_before_mutation_or_embedding`

SafeClaw can safely claim that KOSHA exact-trust pins and Phase A document materialization are proven. SafeClaw must not claim that the full 1,040-row KOSHA Guide corpus is ready for authoritative grounding or production vector retrieval.

## Current Facts

| Item | Count |
| --- | ---: |
| Local / Supabase-visible KOSHA Guide rows | 1,040 |
| Official current rows | 1,039 |
| Official retired rows observed | 679 |
| Usable nonempty parsed bodies | 222 |
| Empty body rows | 818 |
| Missing official URL | 1,040 |
| Missing official file ID | 1,040 |
| Missing official published date | 1,040 |
| Missing official current/retired status | 1,040 |
| Official version mismatches | 7 |
| Retired local rows | 1 |
| Duplicate/fallback summary rows | 822 |
| Retrieval reflection failures | 13 |

## Recommendation

Adopt KOSHA Guide as the next embedding candidate after SIF, but only after repair and approval.

The corpus is valuable as the technical-guidance layer in the SafeClaw evidence hierarchy. In its current state, embedding it would mostly index titles, fallback summaries, and derived controls, not official body text. That would make retrieval look smarter without actually grounding the generated documents in verified KOSHA Guide bodies.

## Required Before Embedding

1. Backfill official URL, file ID, published date, current/retired status, and content hash for every active KOSHA Guide row.
2. Hydrate or OCR the 818 empty-body rows, or quarantine unresolved rows outside active retrieval.
3. Replace 822 fallback/duplicate summaries with source-grounded summaries.
4. Update 7 version mismatches and retire 1 officially retired local row.
5. Split SIF and KOSHA Guide vector retrieval by corpus kind, index, and RPC.
6. Run zero-mutation dry-run diff, focused tests, post-migration verification, and explicit user approval before any DB mutation or embedding upload.

## Verified Commands

```powershell
node scripts\audit_kosha_guides.mjs --output-dir evaluation\kosha-guide-approval-current-2026-07-20 --env-file <secret-env-file>
```

Result: read-only pass, 94.293s.

```powershell
npm.cmd test -- tests\kosha-guide-corpus-audit.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: 1 file / 110 tests passed.

```powershell
python -m unittest scripts.tests.test_snapshot_kosha_guide_corpus scripts.tests.test_ingest_safety_reference_catalog
```

Result: 55 tests passed.

## Boundaries

- DB mutation: no.
- Upload: no.
- Embedding generation: no.
- Vector retrieval enablement: no.
- Raw audit: `evaluation/kosha-guide-approval-current-2026-07-20/report.json`

## Forbidden Claims

- Full 1,040-row KOSHA Guide corpus is authoritative-grounding ready.
- KOSHA Guide embeddings are production-active.
- KOSHA Guide DB metadata has been backfilled.
- Retired KOSHA Guide rows have been removed from active retrieval.
- A DB migration, upload, or embedding generation was performed by this run.
