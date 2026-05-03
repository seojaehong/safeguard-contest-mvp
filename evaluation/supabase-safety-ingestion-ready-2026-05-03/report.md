# Supabase safety ingestion readiness

- generated_at: 2026-05-03T10:46:18.587769+00:00
- db_mutation_applied: false
- total_files: 1062
- parse_success_files: 1053
- parse_failure_files: 9
- duplicate_files: 316
- candidate_records: 1514
- upsert_item_candidates: 1505
- submission_output_records: 522
- internal_knowledge_records: 992

## Document Kind Counts

- emergency_response: 7
- permit: 16
- photo_evidence: 931
- risk_assessment: 241
- safety_education_log: 12
- tbm: 234
- technical_reference: 53
- work_plan: 20

## Output Files

- validation-report.json
- upsert-payload.json
- upsert.sql
- migration-candidate.sql

## Notes

- Existing `safety_reference_sources`, `safety_reference_items`, `safety_reference_ingestion_runs` are enough for dry-run upsert.
- `migration-candidate.sql` is optional and was not applied.
- Records marked `needs_manual_review=true` should not be bulk-loaded without OCR/layout review.