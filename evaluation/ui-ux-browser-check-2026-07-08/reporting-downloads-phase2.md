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

## Phase 1 Implementation Update

Status: implemented for the non-KRAS portion on 2026-07-08.

- Added `/reports` as a SafeClaw module nav item.
- Added a current-workpack report/download center backed by `safeclaw.currentWorkpack.v1`.
- Added local improvement history parsing backed by `safeclaw.operationImprovements.v1`.
- Added period selection for daily, weekly, and monthly report views.
- Added report summary cards for risk rows, high-risk rows, improvement candidates, and Before/After photo improvements.
- Added As-Is/To-Be risk table and improvement candidate list.
- Added classification summaries by process, task, risk level, and reflected document.
- Added client-side downloads:
  - Markdown improvement report.
  - CSV classification/raw handoff.
  - JSON canonical report snapshot.
- Reworked `/reports` from dashboard cards into a Linear-style work-document layout:
  - document body with title, meta, numbered sections, As-Is/To-Be table, improvement notes.
  - right-side rail for period, downloads, summary, evidence, classification, and next actions.
  - mobile layout stacks the document first and the rail after the document.
- KRAS input preparation is intentionally held per user direction and is not exposed in `/reports`.

Implementation files:

- `app/reports/page.tsx`
- `components/ReportsDownloadCenter.tsx`
- `lib/reporting-downloads.ts`
- `lib/operation-improvement-history.ts`
- `tests/reporting-downloads.test.ts`

Verification:

- `npm.cmd test -- tests/reporting-downloads.test.ts`
- `npm.cmd test -- tests/workpack-ontology-qa.test.ts tests/quality-contract.test.ts tests/mcp-tools.test.ts tests/reporting-downloads.test.ts`
- `npm.cmd run typecheck`
- `npm.cmd run build`
- Playwright desktop and mobile browser check:
  - `evaluation/ui-ux-browser-check-2026-07-08/reports-desktop.png`
  - `evaluation/ui-ux-browser-check-2026-07-08/reports-mobile.png`
  - `evaluation/ui-ux-browser-check-2026-07-08/reports-browser-check.json`

Browser check summary:

- Desktop and mobile both show the report nav item.
- Desktop and mobile both render `.safeclaw-workdoc` and `.safeclaw-workdoc-rail`.
- The old four-card KPI grid is absent from the report body.
- Desktop and mobile both show Markdown, CSV, and JSON download buttons.
- As-Is/To-Be and Before/After improvement copy are visible.
- KRAS copy is absent.
- Horizontal overflow is absent on desktop and mobile.
- Markdown download event emits `서울-성수동-근린생활시설-현장-weekly-safety-report.md` in the Playwright check.

Latest workspace-tone pass:

- `/reports` now uses the same product tone as `/workspace`: black canvas, quiet surface hierarchy, violet-blue accent, hairline borders, compact module rail.
- The design decision is to keep the current workspace direction, not jump to a pure Dieter Rams reduction. Rams-style reduction is used only as a checklist for removing clutter.
- Long labels were shortened in the visible UI:
  - hero title reduced to `개선 리포트.`
  - rail labels changed from `Period / Download / Evidence / Classification` to `기간 / 다운로드 / 근거 / 분류`
  - evidence IDs such as `riskAssessmentDraft` and `tbmBriefing` are hidden behind user-facing labels like `위험성평가`, `TBM`
  - mobile risk table cells expose `작업 / 위험 / 현재 / 개선 / 근거` labels after the header collapses
- Latest Playwright check confirms:
  - no desktop/mobile horizontal overflow
  - no KRAS copy
  - no internal evidence IDs in visible text
  - no English rail labels
  - primary CTA background uses the workspace violet accent `rgb(108, 111, 247)`

Design exploration images generated for discussion only:

- `C:\Users\iceam\.codex\generated_images\019f3f63-8305-7681-ac03-ed667c939776\ig_046509641f339cfb016a4e5295f1d8819197dd43ede07cbfec.png` — current workspace vs Rams-reduced workspace.
- `C:\Users\iceam\.codex\generated_images\019f3f63-8305-7681-ac03-ed667c939776\ig_0102fb3cc09c6f3b016a4e52edb4bc8191a002c085bac8bc46.png` — desktop samples for documents, dispatch, evidence, archive, knowledge DB, AI connect.
- `C:\Users\iceam\.codex\generated_images\019f3f63-8305-7681-ac03-ed667c939776\ig_0102fb3cc09c6f3b016a4e535a112c8191bb7359d636a4fd61.png` — mobile samples for the same pages.

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
