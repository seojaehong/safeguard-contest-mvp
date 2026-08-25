# LLM Wiki Candidate Content Matrix

- Verdict: `RED_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_MATRIX`
- Mode: `live-production`
- Generation mode: `provider`
- Base URL: `https://www.safeclaw.kr`
- Source head: `db896d45116418c7a185d9dad443a198be7a8de3`
- Production commit: `db896d45116418c7a185d9dad443a198be7a8de3`
- Cases: 0/5 PASS

| Scenario | HTTP | Matched hazards | Sections | Failures | Verdict |
| --- | ---: | --- | ---: | --- | --- |
| chemical-cleaning | 503 |  | null/4 | http_status:503; response_not_ok; provider_not_configured; provider_generation_not_used; storage_not_stateless; saved_run_created; candidate_contract_mismatch; candidate_not_pending_review; candidate_publication_state_changed; candidate_db_mutation_boundary_failed; candidate_publish_allowed; human_review_not_required; machine_evidence_replaces_human_review; review_contract_mutation_boundary_failed; readiness_contract_mismatch; readiness:missing; required_sections_incomplete; placeholder_content; legal_overclaim; law_provenance_missing; hazard_grounding_missing; human_review_overclaimed; readiness_publication_boundary_failed; missing_hazard:chemical-msds; missing_term_group:화학물질|세척제|MSDS; missing_term_group:누출|보호구|환기 | RED |
| hot-work-fire | 503 |  | null/4 | http_status:503; response_not_ok; provider_not_configured; provider_generation_not_used; storage_not_stateless; saved_run_created; candidate_contract_mismatch; candidate_not_pending_review; candidate_publication_state_changed; candidate_db_mutation_boundary_failed; candidate_publish_allowed; human_review_not_required; machine_evidence_replaces_human_review; review_contract_mutation_boundary_failed; readiness_contract_mismatch; readiness:missing; required_sections_incomplete; placeholder_content; legal_overclaim; law_provenance_missing; hazard_grounding_missing; human_review_overclaimed; readiness_publication_boundary_failed; missing_hazard:hot-work-fire; missing_term_group:용접|화기; missing_term_group:화재|불티|가연물 | RED |
| confined-space | 503 |  | null/4 | http_status:503; response_not_ok; provider_not_configured; provider_generation_not_used; storage_not_stateless; saved_run_created; candidate_contract_mismatch; candidate_not_pending_review; candidate_publication_state_changed; candidate_db_mutation_boundary_failed; candidate_publish_allowed; human_review_not_required; machine_evidence_replaces_human_review; review_contract_mutation_boundary_failed; readiness_contract_mismatch; readiness:missing; required_sections_incomplete; placeholder_content; legal_overclaim; law_provenance_missing; hazard_grounding_missing; human_review_overclaimed; readiness_publication_boundary_failed; missing_hazard:confined-space; missing_term_group:밀폐공간|탱크; missing_term_group:산소결핍|유해가스|환기 | RED |
| forklift-traffic | 503 |  | null/4 | http_status:503; response_not_ok; provider_not_configured; provider_generation_not_used; storage_not_stateless; saved_run_created; candidate_contract_mismatch; candidate_not_pending_review; candidate_publication_state_changed; candidate_db_mutation_boundary_failed; candidate_publish_allowed; human_review_not_required; machine_evidence_replaces_human_review; review_contract_mutation_boundary_failed; readiness_contract_mismatch; readiness:missing; required_sections_incomplete; placeholder_content; legal_overclaim; law_provenance_missing; hazard_grounding_missing; human_review_overclaimed; readiness_publication_boundary_failed; missing_hazard:forklift-traffic; missing_term_group:지게차; missing_term_group:보행자|동선|충돌; missing_term_group:신호수|운행경로|접근금지 | RED |
| fall-foreign-worker | 503 |  | null/4 | http_status:503; response_not_ok; provider_not_configured; provider_generation_not_used; storage_not_stateless; saved_run_created; candidate_contract_mismatch; candidate_not_pending_review; candidate_publication_state_changed; candidate_db_mutation_boundary_failed; candidate_publish_allowed; human_review_not_required; machine_evidence_replaces_human_review; review_contract_mutation_boundary_failed; readiness_contract_mismatch; readiness:missing; required_sections_incomplete; placeholder_content; legal_overclaim; law_provenance_missing; hazard_grounding_missing; human_review_overclaimed; readiness_publication_boundary_failed; missing_hazard:fall-scaffold; missing_hazard:foreign-worker-briefing; missing_term_group:비계|고소작업; missing_term_group:추락|안전대|안전난간; missing_term_group:외국인|쉬운 한국어|다국어 | RED |

## Contract

- Each scenario uses the deployed stateless `/api/knowledge/regenerate` path.
- Deterministic mode proves the built-in safety-knowledge fallback; provider mode separately proves enhanced LLM generation when runtime admission is available.
- The response must expose the server-derived four-section content-readiness contract.
- Scenario hazard IDs and scenario-specific term groups must remain grounded in generated text.
- Placeholder text, legal overclaim, missing law provenance, and missing hazard grounding fail closed.
- All candidates remain unpublished and require human review.

## Boundary

- This matrix does not read the actual production candidate queue.
- No DB write, Wiki publication, provider dispatch, Share-session creation, embedding/vector mutation, or KOSHA registry mutation is performed.
- Exact saved Share remains `MISSING_EVIDENCE`.
- LLM Wiki publication and Supabase RLS isolation remain `APPROVAL_GATED`.
