# SafeClaw Public-Data Migration Value Audit

Date: 2026-07-10  
Worktree: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\backend-harness-gate`

## Scope

This sidecar verifies three things without running migrations or mutating Supabase:

1. Whether the current codebase calls the KOSHA odcloud machinery API family live.
2. Whether the equivalent machinery/construction CSVs are already ingested.
3. Whether the newly provided local files add migration value to the current SafeClaw evidence harness.

Non-actions:

- No DB migration
- No Supabase data mutation
- No `.env` or secret changes
- No secret commit

Artifacts generated for this audit:

- Source profile JSON: [source-profiles.json](C:/Users/iceam/dev/safeguard-contest-mvp/.worktrees/backend-harness-gate/evaluation/northstar-72h-2026-07-10/public-data-migration-value-audit/source-profiles.json)
- Read-only helper: [inspect_public_data_sources.py](C:/Users/iceam/dev/safeguard-contest-mvp/.worktrees/backend-harness-gate/evaluation/northstar-72h-2026-07-10/public-data-migration-value-audit/inspect_public_data_sources.py)

## API Verification Result

## 1) The current code does **not** call the odcloud machinery endpoint family live

Current live KOSHA OpenAPI code is in:

- [lib/kosha-openapi.ts](C:/Users/iceam/dev/safeguard-contest-mvp/.worktrees/backend-harness-gate/lib/kosha-openapi.ts)
- [lib/search.ts](C:/Users/iceam/dev/safeguard-contest-mvp/.worktrees/backend-harness-gate/lib/search.ts)

The live KOSHA OpenAPI integration currently calls `apis.data.go.kr/B552468/...` services such as:

- smart search
- media link
- MSDS
- construction daily disaster

I found **no repository reference** to:

- `https://infuser.odcloud.kr/oas/docs?namespace=15087796/v1`
- `https://api.odcloud.kr/api/15087796/v1/uddi:9c26704c-6a61-418e-ae73-d0ae33dbbf50`
- dataset id `15087796`
- UDDI `9c26704c-6a61-418e-ae73-d0ae33dbbf50`

So the odcloud machinery dataset is **not part of the current live code path**.

## 2) The odcloud endpoint is real, but it is auth-gated and adds no obvious new schema over the existing CSV

Verified live on 2026-07-10:

- Swagger spec at `infuser.odcloud.kr` identifies the dataset as `한국산업안전보건공단_기계설비별_체크리스트`.
- The documented GET path is `/api/15087796/v1/uddi:9c26704c-6a61-418e-ae73-d0ae33dbbf50`.
- The endpoint description names the same dataset family as the local CSV: `한국산업안전보건공단_업종별 기계설비 목록_20210909`.
- Documented fields are:
  - `번호`
  - `업종대분류`
  - `업종중분류`
  - `업종소분류`
  - `기계설비명`
  - `기계설비영문명`
  - `기계설비설명`

Direct unauthenticated probe on 2026-07-10 returned:

```json
{
  "code": -401,
  "msg": "인증키는 필수 항목 입니다."
}
```

Conclusion:

- The API is live and read-only accessible in principle.
- It requires a service key.
- Based on the published schema and dataset title/date, it does **not** show freshness or extra fields beyond the already ingested `20210909` CSV.

## 3) Equivalent machinery and construction CSVs are already ingested and used

Existing ingestion/parser evidence:

- [scripts/ingest_safety_reference_catalog.py](C:/Users/iceam/dev/safeguard-contest-mvp/.worktrees/backend-harness-gate/scripts/ingest_safety_reference_catalog.py)
- [docs/safety_reference_catalog_migration.md](C:/Users/iceam/dev/safeguard-contest-mvp/.worktrees/backend-harness-gate/docs/safety_reference_catalog_migration.md)
- [evaluation/data-ingestion/safety-reference-catalog-report.json](C:/Users/iceam/dev/safeguard-contest-mvp/.worktrees/backend-harness-gate/evaluation/data-ingestion/safety-reference-catalog-report.json)
- [evaluation/final-knowledge-ingestion/api-status.json](C:/Users/iceam/dev/safeguard-contest-mvp/.worktrees/backend-harness-gate/evaluation/final-knowledge-ingestion/api-status.json)

Confirmed current catalog counts:

- `machinery`: 730 rows
- `construction-process`: 626 rows
- `sif-case`: 6,033 rows

Confirmed source ids already in use:

- `kosha-machinery-20210909`
- `kosha-construction-process-20210910`

Confirmed current product/runtime usage:

- `data/safety-knowledge/kosha-resources.json` exposes `kosha-machinery-list` and `kosha-construction-process-list`.
- `search.ts` classifies these as `machinery` and `construction-process`.
- prior evaluation evidence shows `/api/safety-reference/search` returning live `machinery-*` and `construction-process-*` items from Supabase-backed catalog search.

## Decision Table

| Source | Decision | Why | Rows / sheets / columns | Overlap with current corpus | Proposed `item_type` / `source_id` | Migration risk | Exact next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `서울시설공단_아차사고 사례 분석 현황_20251028.csv` | Reject | Only 3 yearly aggregate rows. No task, no hazard narrative, no control text, no retrieval-ready evidence rows. Useful for trend slides, not for SafeClaw row-first evidence harness. | 3 rows, 14 cols | Indirect thematic overlap with SIF/accident trend concepts only. No usable overlap with `safety_reference_items`, `machinery`, or `construction-process`. | If ever reused: `incident-summary` / `seoul-facilities-near-miss-summary-20251028` | Low technical risk, high semantic mismatch | Do not ingest into `safety_reference_items`. Ignore for current migration. If analytics dashboard scope appears later, keep it in a separate metrics dataset. |
| `한국산업안전보건공단_업종별 기계설비 목록_20210909.csv` | Already covered | Exact dataset family is already parsed, counted, cataloged, and used in search/runtime. The odcloud API shows the same schema/date family and does not justify a new live dependency. | 730 rows, 7 cols | Direct overlap with `safety_reference_items.item_type = machinery`; current source id `kosha-machinery-20210909` | Existing: `machinery` / `kosha-machinery-20210909` | Very low | Keep current ingested source. Do not add odcloud live calling path unless future evidence shows newer fields or a newer dataset revision. |
| `한국산업안전보건공단_건설업 공종별 세부공정 목록_20210910.csv` | Already covered | Already parsed and counted by the current catalog ingestion flow. | 626 rows, 4 cols | Direct overlap with `safety_reference_items.item_type = construction-process`; current source id `kosha-construction-process-20210910` | Existing: `construction-process` / `kosha-construction-process-20210910` | Very low | No migration work needed. Leave current source as-is. |
| `한국남부발전(주)_전사 표준작업 위험성평가 운영현황_20250630.csv` | Reject | Only 5 category/count rows. This is portfolio coverage metadata, not a reusable evidence corpus. It tells us how many standard models exist, but not the hazards or controls inside them. | 5 rows, 3 cols | Conceptual overlap with future risk-model library only. No direct overlap with `SIF`, `machinery`, or `construction-process`. | If ever reused: `risk-model-summary` / `kospo-standard-risk-assessment-summary-20250630` | Low technical risk, high usefulness risk | Do not ingest into reference search. If the publisher later releases underlying standard model files, reassess those instead of this summary table. |
| `한국가스공사_KOGAS 위험성평가 표준모델_20240909.zip` | Adopt now | Highest-value new source in this bundle. It contains 71 concrete standard-model files across office, facility, electrical, vehicle, excavation, aerial work platform, forklift, lab, and contractor scenarios. These are much closer to SafeClaw target outputs than the current public catalog. | 71 archive members total: 42 `.xls`, 27 `.xlsx`, 1 `.hwp`, 1 nested `.zip`. Representative non-empty workbooks show 1-8 sheets, about 9-87 rows, and 8-30 cols per main sheet. | Partial overlap with existing `machinery`, `construction-process`, chemical, and technical-support evidence, but mostly additive: it introduces task-level risk-assessment templates and control rows absent from current corpus. | Recommended new lane: `risk-standard-model` and `risk-standard-row`; root source id `kogas-risk-standard-models-20240909`, child ids per member path | Medium-high: mixed legacy office formats, sheet normalization, company-specific wording, likely duplicate control phrases, possible archive-in-archive cleanup needed | Start an offline extraction-only migration prep: parse workbook metadata and main risk table rows into a review JSON/Markdown artifact, sample-QA 5 representative files, and keep it out of DB until normalization rules are approved. |
| `한국동서발전(주)_화학물질 위험성평가 리스트_20220801.csv` | Adopt later | Adds chemical/product/CAS/site safety context not present in the current generic public corpus. However, it is a single-site register (`당진화력` only), half the rows have blank exposure/hazard/risk fields, and it is better as a gated supplement than a default public evidence source. | 103 rows, 13 cols | Partial overlap with current live MSDS lookup and chemical-related technical-support regulations; additive as site-level chemical register context. | Recommended future lane: `chemical-risk-register` / `ewp-chemical-risk-register-20220801` | Medium: site specificity, partial blanks, normalization needed by `승인번호 + CAS번호`, and should not pollute default retrieval for non-chemical scenarios | Defer until a chemical-specific evidence lane exists. When ready, ingest as a scoped supplement with site tagging and blank-field QA, not as a top-level default public corpus. |

## Recommended Adoption Order

1. `KOGAS 위험성평가 표준모델_20240909.zip`
2. `한국동서발전(주)_화학물질 위험성평가 리스트_20220801.csv`
3. Do not migrate the other four for the current SafeClaw evidence harness.

## Why KOGAS Is The Best Next Candidate

- It is the only source here that looks like real target-state risk-assessment templates rather than metadata.
- It carries scenario-specific structure that SafeClaw can turn into:
  - task taxonomy
  - hazard/control row libraries
  - document reflection hints
  - company-grade standard wording
- It complements, rather than replaces, the current public foundation:
  - `construction-process` gives task labels
  - `machinery` gives equipment context
  - `SIF` gives incident analogs
  - KOGAS adds usable standard-template row structure

## Why The odcloud Machinery API Should Not Be Added Right Now

- Current code already gets machinery value from the ingested catalog.
- Current product search/runtime already exposes those rows.
- The odcloud endpoint is auth-gated.
- The published schema matches the existing CSV family.
- Adding a live odcloud dependency would add operational complexity without obvious data gain.

## Practical Recommendation

Recommended next move:

1. Keep the current machinery/construction ingestion exactly as-is.
2. Do **not** add the odcloud machinery API to runtime.
3. Start a parser-and-review-only migration prep for KOGAS templates.
4. Keep the Dongseo chemical list as a second-wave, scoped supplement candidate.

This means the best value is not a new live API hookup. The best value is a **new template-grade corpus lane** led by the KOGAS archive.
