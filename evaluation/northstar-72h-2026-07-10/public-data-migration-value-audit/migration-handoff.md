# Migration Handoff: Public Data Value Candidates

This brief is for a future migration agent. Do not run DB migrations or mutate Supabase as part of this handoff.

## Priority 1

### KOGAS risk standard models

- Source: `C:\Users\iceam\Downloads\한국가스공사_KOGAS 위험성평가 표준모델_20240909.zip`
- Proposed root source id: `kogas-risk-standard-models-20240909`
- Proposed item types:
  - `risk-standard-model`
  - `risk-standard-row`

Why this is worth migrating:

- 71 archive members, mostly `.xls/.xlsx`, with actual risk-assessment templates.
- Strong fit for SafeClaw target outputs: task-specific hazards, controls, and document structure.
- Best additive value beyond existing `SIF`, `machinery`, and `construction-process` sources.

What to do next:

1. Build an offline extractor only.
2. Normalize archive member paths into stable child source ids.
3. For each workbook, extract:
   - workbook title
   - sheet names
   - main risk table bounds
   - row-level task / hazard / current-state / action text where present
4. Write review artifacts first:
   - JSON summary per member
   - one Markdown QA note with 5 representative samples
5. Do not upload anything until normalization rules are reviewed.

Suggested normalization:

- Child source id: `kogas-risk-standard-models-20240909::<member-path>`
- Deduplicate repeated controls across templates after preserving raw text.
- Keep company-specific task wording in metadata, but build generalized control text separately.

Main risks:

- Mixed `.xls`, `.xlsx`, `.hwp`, and nested archive handling
- Header rows and merged cells
- Template layout variance across departments
- Company-specific phrasing that may need scope tagging

## Priority 2

### East-West Power chemical risk register

- Source: `C:\Users\iceam\Downloads\한국동서발전(주)_화학물질 위험성평가 리스트_20220801.csv`
- Proposed source id: `ewp-chemical-risk-register-20220801`
- Proposed item type: `chemical-risk-register`

Why this is worth migrating later:

- Adds product/CAS/site-level chemical context.
- Useful as a chemical-specific supplement, not as default public retrieval.

What to do next:

1. Keep it out of the default public evidence path.
2. Normalize on `승인번호 + CAS번호`.
3. Tag all rows with site scope (`당진화력`).
4. QA blanks in `노출수준`, `유해성`, `위험성`, `감소대책` before any ingest.

## Explicit non-goals

- Do not add the odcloud machinery API to runtime.
- Do not re-ingest `한국산업안전보건공단_업종별 기계설비 목록_20210909.csv`.
- Do not re-ingest `한국산업안전보건공단_건설업 공종별 세부공정 목록_20210910.csv`.
- Do not migrate the Seoul Facilities or Korea South Power summary CSVs into `safety_reference_items`.
