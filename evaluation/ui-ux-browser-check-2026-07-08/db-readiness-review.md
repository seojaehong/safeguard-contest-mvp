# SafeClaw DB Readiness Review

Date: 2026-07-08

## Current Supabase Assets

Read-only probe confirmed:

- `safety_reference_sources`: 1,063 rows
- `safety_reference_items`: 9,920 rows
- `safety_reference_ingestion_runs`: 2 rows
- SIF cases: 6,033 rows
- Construction process rows: 626 rows
- Machinery rows: 730 rows
- Technical guidelines: 803 rows
- Technical support regulations: 237 rows
- TBM rows: 227 rows
- Risk assessment rows: 231 rows
- Work plan rows: 20 rows
- Published ontology nodes/edges: 166 / 169
- Stored workpacks / education records / dispatch logs: 5 / 4 / 6

## Phase 1 Usage

- No schema migration.
- `safety_reference_items` is surfaced through user-language labels: high-risk cases, KOSHA official references, TBM/risk-assessment criteria.
- `qualityContract` and `ontologyQa` appear in the document evidence panel.
- `workpacks`, `education_records`, and `dispatch_logs` remain separate persistence concepts in the share panel.
- Today's improvements are represented as local operational ontology candidates with task, hazard, improvement text, reflected documents, and optional Before/After photo file names.

## Phase 2 Approval Candidates

- Add `quality_contract jsonb` and `ontology_qa jsonb` to `workpacks`.
- Create `workpack_share_sessions`.
- Create `workpack_read_confirmations`.
- Create `workpack_improvements`.
- Add `safety_reference_embeddings` for similar SIF/work history retrieval.
- Add file storage for Before/After photos and run real image analysis before creating improvement candidates.

## Risks

- `dispatch_logs` is a provider log, not a read-confirmation source of truth.
- `dispatch_logs.organization_id` currently allows null in RLS policies; avoid using null-org logs as confirmation records.
- Draft/verified ontology must not be shown as published evidence.
- Phase 1 photo analysis is a candidate UI only. It must not claim actual vision-model verification.
