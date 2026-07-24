# SafeClaw Live Harness Quality Probe

- Overall: FAIL
- Generated: 2026-07-24T13:03:20.007Z
- Source HEAD at generation: 5a91a1f5659c748143cb8c52ef670c5949b22401
- Live commit at generation: unavailable
- Note: this artifact is generated before it is committed. A later evidence-only commit can contain this report without changing the measured runtime surface.
- Base URL: http://127.0.0.1:3075
- Request: POST /api/ask (enhanced)
- HTTP: 200
- Quality state: degraded
- Ontology state: ready

## Contract Evidence

| Contract | State | Evidence |
| --- | --- | --- |
| api_response | PASS | HTTP status: 200 |
| enhanced_mode | PASS | requested: enhanced; request body: enhanced; response: enhanced |
| generation_evidence_sealed | FAIL | version: missing; algorithm: missing; snapshot packet: mismatch; signature: structural presence only; server secret is not read by this probe |
| db_harness_first | PASS | mode: db_harness_first; evidence authority: db_harness; LLM role: naturalize_only; fallback chain: false |
| evidence_sets_present | PASS | direct: present; sif: present; supporting: present |
| evidence_labels_clean | PASS | repeated evidence identities: none |
| structured_risk_tbm_links | PASS | risk rows: present; TBM links: present; row validation: ready |
| risk_control_fields_distinct | PASS | duplicate current/additional controls: none |
| scenario_controls_present | PASS | fall: structured.riskAssessmentRows[0]; scaffold: structured.riskAssessmentRows[0]; wind: structured.riskAssessmentRows[0]; traffic: structured.riskAssessmentRows[1]; additional evidence in JSON |
| irrelevant_controls_absent | PASS | unsupported control flags: none |
| quality_state_ready | FAIL | overall: degraded; evidence: ready; structured: ready; DB harness: ready |
| ontology_state_ready | PASS | quality ontology: ready; harness ontology: ready; summary ontology: ready; QA verdict: 통과 |
| no_db_mutation | PASS | POST /api/ask mutatesDb=false |
