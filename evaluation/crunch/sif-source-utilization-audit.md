# SafeClaw SIF/Public Data Utilization Audit

- Audit date: 2026-07-10
- Worktree: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\backend-harness-gate`
- Scope: Downloads source shapes, ingestion scripts and artifacts, current DB-harness/retrieval code, and the approved-vector gate.
- Non-actions: no DB request, no schema change, no source rewrite, no secret read/use, no push.

## Executive Decision

**Overall DB migration recommendation: HOLD.**

The SIF data family is already useful through the catalog/ranked DB-harness path, but it is not fully embedded or vector-retrievable. A source-identity mismatch and one construction-header row are present in the ingest boundary. Fix and re-prove those two conditions before approving the existing SIF-only embedding migration. KOGAS is a strong next corpus, but only its offline extraction package is ready; its DB migration remains held.

## Verified Source Inventory

| Source | Source shape observed | Current utilization | Evidence | Recommendation |
| --- | --- | --- | --- | --- |
| `붙임1. 사망사고 고위험요인(SIF) 아카이브(제조업 등, 건설업).xlsx` | SHA-256 `0c2bb7a47c951039b30020e0ba6974362cf5d32d69d62486093f3f16b2da394e`; blank cover; manufacturing 2,573 valid rows/10 columns; construction 3,459 valid rows/10 columns; **6,032 valid cases** | Catalog DB snapshot has 6,033 `sif-case` rows. Corpus builder prepares 6,032 eligible cases. MCP harness asks for `itemType: sif-case` and filters with `isEmbeddableSifReferenceItem`. | `scripts/ingest_safety_reference_catalog.py:178-223`, `app/api/mcp/[transport]/route.ts:252-274`, `evaluation/sif-embedding-gate/runtime-db-probe.json` | **HOLD** embedding migration until canonical input mapping and header exclusion are corrected/re-proven. |
| KOSHA machinery CSV | 730 rows, 7 columns | Already cataloged as `machinery` / `kosha-machinery-20210909`; searchable as direct evidence. | `scripts/ingest_safety_reference_catalog.py:265-301`; existing audit/runtime artifacts | **REJECT** duplicate migration or a new live API dependency. |
| KOSHA construction-process CSV | 626 rows, 4 columns | Already cataloged as `construction-process` / `kosha-construction-process-20210910`; searchable as direct evidence. | `scripts/ingest_safety_reference_catalog.py:226-262`; existing audit/runtime artifacts | **REJECT** duplicate migration. |
| KOGAS risk-standard ZIP | 71 members: 42 `.xls`, 27 `.xlsx`, 1 `.hwp`, 1 nested ZIP | Offline package has 69 parsed workbooks, 180 sheets, 69 model items, 3,101 risk rows; no DB write. | `evaluation/northstar-72h-2026-07-10/kogas-risk-standard-model-prep/report.json` and `safety-reference-upsert-preview.json` | **ACCEPT** offline preparation; **HOLD** DB migration pending normalization/approval. |
| Korea East-West Power chemical register CSV | 103 rows, 13 columns; columns 6-9 are blank in 53 rows; two site values observed | Not a current ingestion job or retrieval lane. Site-specific and partially incomplete. | Local source scan; current `ingest_safety_reference_catalog.py` job list | **HOLD** for a scoped chemical supplement, not default retrieval. |
| Korea Southern Power risk-assessment summary CSV | 5 rows, 3 columns | Not ingested; aggregate coverage counts only. | Local source scan | **REJECT** for evidence-harness migration. |
| Seoul Facilities near-miss analysis CSV | 3 rows, 14 columns | Not ingested; annual aggregate counts only. | Local source scan | **REJECT** for evidence-harness migration. |

## SIF Findings

### 1. Ingested and retrievable, but one non-case row leaked

The supplied construction sheet has a two-row header. `first_non_empty_header()` in `scripts/ingest_safety_reference_catalog.py` chooses only its first non-empty header row, so the second header row is emitted as `sif-아카이브-건설업-00001`. That explains the DB snapshot's 6,033 SIF rows versus the workbook's 6,032 valid cases.

- `evaluation/sif-embedding-gate/report.json`: 6,033 source items, one skipped header-like item, 6,032 corpus rows.
- `lib/sif-embedding-corpus.ts` excludes the malformed/header item from corpus creation.
- `app/api/mcp/[transport]/route.ts:272` repeats that exclusion before building the harness packet.
- The generic catalog search route delegates to `searchSafetyReferences` without this same explicit SIF eligibility filter. The malformed row is unlikely to rank for a specific task, but it remains a catalog-integrity defect.

### 2. Current source filename is not the ingest script's canonical input

The supplied filename exists. The script's hard-coded input, `한국산업안전보건공단_산업재해 고위험요인(SIF) 아카이브_20260401.xlsx`, does not exist in Downloads. Therefore a fresh catalog-ingest command cannot reproduce the current SIF state from the supplied input without changing the input mapping. The valid-row counts align with the existing corpus, but byte-for-byte identity with the old named source cannot be proven because that old file is absent.

### 3. Embedding and vector retrieval are intentionally not live

The current read-only DB snapshots show:

| Check | Result |
| --- | --- |
| `safety_reference_items` | ready, 6,033 SIF rows |
| `safety_reference_embeddings` | absent, HTTP 404 |
| `match_safety_reference_embeddings` | absent, HTTP 404 |
| uploaded embeddings | 0 of expected 6,032 |
| `SAFETY_REFERENCE_VECTOR_SEARCH` | disabled |
| post-migration verifier | `migration-required`; four embedding/RPC checks fail as expected |

The vector schema and RPC exist only in unapplied `supabase/migrations/010_commercial_operations.sql`. This is correctly approval-gated: the corpus command requires both `--approved-embedding` and `--approved-upload`. Static gate verification passed: **5 files, 12 tests** (`sif-embedding-*` suite) on 2026-07-10.

## Harness Classification

| State | Data |
| --- | --- |
| Ingested | SIF 6,033 catalog rows; machinery 730; construction process 626 (per existing DB/evaluation snapshots) |
| Retrievable now | SIF/KOSHA through REST/ranked catalog search; MCP harness retrieves direct, SIF, and supporting candidate sets before composing its packet |
| Embedded | 3-row canary artifact only; the full 6,032-row SIF corpus has no DB embeddings |
| Approved for DB write | None in this audit |
| Prepared but unused | KOGAS 69 models + 3,101 rows in offline upsert preview; chemical register; two aggregate CSVs |

## odcloud KOSHA Equipment API Verification

Official, read-only documentation confirms the machinery dataset family at [Public Data Portal: dataset 15087796](https://www.data.go.kr/data/15087796/fileData.do): 730 CSV rows and the seven fields `번호`, industry major/mid/minor, equipment name, English name, and description. The same official page identifies the Swagger namespace `15087796/v1` and the `api.odcloud.kr` API family, and states that OpenAPI use requires application/authorization.

No secret or unauthenticated API request was made in this audit. The repository's current live KOSHA integrations do not reference dataset `15087796`, its UDDI, or `api.odcloud.kr`; they consume the already-ingested CSV catalog instead. The official schema/date match the local CSV, so adding this authenticated live dependency now would add an operational dependency without demonstrated data gain.

## Migration Gate

**Reject now:** machinery duplicate, construction-process duplicate, 5-row Southern Power summary, and 3-row Seoul Facilities summary.

**Hold:**

1. SIF-only vector migration/upload until the supplied filename is made canonical (or explicitly aliased), the construction second-header row is prevented from entering `safety_reference_items`, and a read-only re-count proves 6,032 source rows equals 6,032 eligible corpus rows.
2. KOGAS DB migration until the 69-workbook extraction is approved with rules for carry-forward fields, variable headers, site/company scope, duplicate controls, and the two skipped archive members.
3. Chemical register until a chemical-specific, site-scoped retrieval lane preserves its blank-field semantics.

**Accept after those gates:** the existing SIF-only embedding migration is the right technical path; it should remain SIF-only, cost-approved, upload-approved, and followed by the existing post-migration verifier before enabling `SAFETY_REFERENCE_VECTOR_SEARCH=1`.

