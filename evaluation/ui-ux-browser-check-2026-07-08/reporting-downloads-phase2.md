# SafeClaw Phase 2 Reporting And Downloads

Date: 2026-07-08

## Position

This is an additive module. It does not replace the current `입력 -> 문서 -> 공유` workbench.

- `Workbench`: creates and reviews the current workpack.
- `Photo risk input`: turns field photos into reviewable hazard candidates before generation.
- `Reports`: aggregates workpacks, improvements, acknowledgments, and evidence over time.
- `Download Center`: renders stable export packages from canonical snapshots.
- `KRAS-ready export`: prepares rows and evidence for manual KRAS input; it is not KRAS login, scraping, API reverse engineering, or automatic submission.

## Recommended IA

- `Improvements`
  - As-is/to-be improvement records
  - Before/After photos
  - Hazard, control, owner, status, reflected documents
- `Reports`
  - Weekly and monthly report views
  - Period picker
  - Facet filters by process, task, hazard type, risk level, SIF flag, status
- `Download Center`
  - Report package builder
  - Export history
  - HWPX/PDF/XLSX/CSV/JSON downloads
- `Evidence/Confirmations`
  - Source citations
  - Share sessions
  - Read confirmations
  - Dispatch logs
- `KRAS Input Preparation`
  - Structured risk assessment rows
  - Missing field checklist
  - Manual entry/export checklist
  - Review status before export

## Classification Axes

Start with facet filters instead of a rigid hierarchy:

- Project/site
- Process
- Task
- Hazard source
- Accident type
- Risk level
- SIF flag
- Improvement status
- Legal/evidence strength
- Period

Suggested improvement statuses:

- `제안됨`
- `승인됨`
- `진행중`
- `완료`
- `검증됨`
- `보류`

Evidence strength should not imply legal completion:

- `근거 있음`
- `참고 가능`
- `검토 필요`

## Export Types

- `HWPX`: internal approval, risk assessment as-is/to-be, improvement report.
- `PDF`: fixed sharing and archive copy.
- `XLSX`: weekly/monthly tables and pivot-ready summaries.
- `CSV`: raw data extraction and external system handoff.
- `JSON`: canonical workpack/report snapshot for regeneration.
- `KRAS input checklist`: user-facing checklist for manual transfer into KRAS-compatible fields.

Recommended package:

- `report.pdf`
- `detail.xlsx`
- `raw.csv`
- `manifest.json`
- evidence bundle

## Phase 1 Scope

No DB schema change.

- Render report preview from current/local workpack JSON.
- Add narrative + photo hazard candidate capture in the workbench input step.
- Add as-is/to-be report structure:
  - previous hazard state
  - improvement action
  - expected after-state
  - evidence
  - unresolved items
- Add simple period/filter UI using local/current workpack data where available.
- Export CSV/XLSX/PDF only where existing export paths can safely support it.
- Do not claim KRAS official integration. Use `KRAS 입력 준비 내보내기` for user-facing copy.

## Phase 2 Scope

Requires explicit DB approval.

- `workpack_improvements`
- `report_snapshots`
- `export_jobs`
- `workpack_share_sessions`
- `workpack_read_confirmations`
- `ontology_versions`
- `embedding_sections`
- async export jobs
- durable report history
- HWPX templates
- shareable report links
- SIF similar-case search for report context
- SIF/KOSHA/workpack-history embeddings for candidate retrieval and quality improvement.
- Vision/OCR adapter for front-loaded field-photo hazard candidates.

## Risks

- Reports must not replace the workbench authoring flow.
- As-is/to-be must separate `계획`, `실행`, and `검증` so improvement plans are not mistaken for completed controls.
- HWPX/PDF/XLSX/CSV must come from one canonical JSON snapshot.
- SIF embeddings and vision candidates should assist search and recommendation, not automatically determine risk level.
- Read confirmations and share sessions require retention, expiry, permission, and audit-log rules before production use.
- Avoid KRAS screen automation, unofficial network API reverse engineering, and automatic KRAS submission.
