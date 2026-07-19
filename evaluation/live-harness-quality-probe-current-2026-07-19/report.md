# SafeClaw Live Harness Quality Probe

- Overall: PASS
- Generated: 2026-07-19T10:24:50.623Z
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
| structured_risk_tbm_links | PASS | risk rows: present; TBM links: present; row validation: ready |
| scenario_controls_present | PASS | fall: structured.riskAssessmentRows[0]; scaffold: structured.riskAssessmentRows[0]; wind: structured.riskAssessmentRows[0]; traffic: structured.riskAssessmentRows[1]; additional evidence in JSON |
| irrelevant_controls_absent | PASS | unsupported control flags: none |
| quality_state_ready | PASS | overall: ready; evidence: ready; structured: ready; DB harness: ready |
| ontology_state_ready | PASS | quality ontology: ready; harness ontology: ready; summary ontology: ready; QA verdict: 통과 |
| no_db_mutation | PASS | POST /api/ask mutatesDb=false |
