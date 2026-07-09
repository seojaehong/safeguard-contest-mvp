# SIF Source Usage Check

Date: 2026-07-10

## Question

User asked whether the local SIF source is the attached file:

`C:\Users\iceam\Downloads\붙임1. 사망사고 고위험요인(SIF) 아카이브(제조업 등, 건설업).xlsx`

and whether SafeClaw is fully using it.

## Source Workbook Check

The workbook has three sheets:

- Cover sheet: 33 rows, no non-empty rows detected.
- Archive, manufacturing and related industries: 2,576 max rows, 2,575 non-empty rows.
- Archive, construction: 3,463 max rows, 3,462 non-empty rows.

After excluding title/header rows, the workbook aligns with the project SIF source count:

- Manufacturing and related industries: 2,573 case rows.
- Construction: about 3,460 case/header-ingested rows.
- Combined source footprint: 6,033 rows in `safety_reference_items` where `item_type = sif-case`.

## SafeClaw Corpus Check

`evaluation/sif-embedding-gate/report.json` reports:

- Source: `safety_reference_items:item_type=sif-case`
- `itemCount`: 6,033
- `skippedCount`: 1
- `skippedIds`: `sif-아카이브-건설업-00001`
- `corpusCount`: 6,032
- `emptyEmbeddingTextCount`: 0
- `missingControlsCount`: 0
- `missingPrimaryDocumentsCount`: 0
- `duplicateContentHashCount`: 0
- `mode`: `corpus-only`

So the SIF source is ingested and normalized into a clean corpus, with one spreadsheet header-like item excluded from the embedding corpus.

## Current Runtime Usage

Current Phase 1 usage is active, but not full vector usage:

- `safety_reference_items` contains 6,033 SIF cases.
- Workspace generation uses `externalData.safetyReference`, `dbHarness`, and the document evidence panel to surface SIF/KOSHA candidates.
- The generation harness fixes relevant SIF/KOSHA/work-history evidence first, then lets the LLM phrase documents around those retrieved rows.
- This is not fine-tuning. It is retrieval/harness usage.

## Not Yet Fully Enabled

`evaluation/sif-embedding-gate/runtime-db-probe.json` and `post-migration-verify.json` show:

- `safety_reference_items`: ready, 6,033 SIF rows.
- `safety_reference_embeddings`: missing, HTTP 404.
- `match_safety_reference_embeddings`: missing, HTTP 404.
- `SAFETY_REFERENCE_VECTOR_SEARCH`: disabled.
- `embeddedCount`: 0.
- `uploadedCount`: 0.
- Status: `migration-required`.

Therefore the current product does not yet fully use the SIF corpus through semantic vector retrieval. The full embedding path is intentionally held behind the approved migration/upload gate.

## Verdict

Yes, the project appears to be using this SIF source family.

No, it is not yet fully utilized in the strongest sense. The full source is loaded into `safety_reference_items` and used by the DB harness/ranked retrieval path, but the Phase 2 embedding table/RPC/vector feature flag are not live yet.

Recommended product wording:

- Current: "SIF/KOSHA 근거 검색 기반"
- After migration/upload: "SIF 유사사례 임베딩 검색 기반"

Avoid saying:

- "SIF로 학습 완료"
- "전체 SIF 파인튜닝 완료"

