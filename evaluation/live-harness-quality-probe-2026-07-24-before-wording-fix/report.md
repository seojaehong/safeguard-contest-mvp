# SafeClaw Live Harness Quality Probe

- Overall: FAIL
- Generated: 2026-07-24T13:02:07.530Z
- Source HEAD at generation: 94aad39a07671cafdc68d3910226c022782cff14
- Live commit at generation: 94aad39a07671cafdc68d3910226c022782cff14
- Note: this artifact is generated before it is committed. A later evidence-only commit can contain this report without changing the measured runtime surface.
- Base URL: https://www.safeclaw.kr
- Request: POST /api/ask (enhanced)
- HTTP: 200
- Quality state: ready
- Ontology state: ready

## Contract Evidence

| Contract | State | Evidence |
| --- | --- | --- |
| api_response | PASS | HTTP status: 200 |
| enhanced_mode | PASS | requested: enhanced; request body: enhanced; response: enhanced |
| generation_evidence_sealed | PASS | version: safeclaw-generation-evidence/v1; algorithm: HMAC-SHA256; snapshot packet: matches; signature: structural presence only; server secret is not read by this probe |
| db_harness_first | PASS | mode: db_harness_first; evidence authority: db_harness; LLM role: naturalize_only; fallback chain: false |
| evidence_sets_present | PASS | direct: present; sif: present; supporting: present |
| evidence_labels_clean | FAIL | supporting[0]: D-C-13-2026 D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정; supporting[1]: A-R-1-2026 A-R-1-2026 자율안전보건체계 구축 및 운영에 관한 기술지원규정; answer[13]: - 기술 보조지침 후보(근거 부족): D-C-13-2026 D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정 / A-R-1-2026 A-R-1-2026 자율안전보건체계 구축 및 운영에 관한 기술지원규정 |
| structured_risk_tbm_links | PASS | risk rows: present; TBM links: present; row validation: ready |
| risk_control_fields_distinct | PASS | duplicate current/additional controls: none |
| scenario_controls_present | PASS | fall: structured.riskAssessmentRows[0]; scaffold: structured.riskAssessmentRows[0]; wind: structured.riskAssessmentRows[0]; traffic: structured.riskAssessmentRows[1]; additional evidence in JSON |
| irrelevant_controls_absent | PASS | unsupported control flags: none |
| quality_state_ready | PASS | overall: ready; evidence: ready; structured: ready; DB harness: ready |
| ontology_state_ready | PASS | quality ontology: ready; harness ontology: ready; summary ontology: ready; QA verdict: 통과 |
| no_db_mutation | PASS | POST /api/ask mutatesDb=false |
