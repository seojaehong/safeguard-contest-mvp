# SafeClaw Live Harness Quality Probe

- Overall: FAIL
- Generated: 2026-07-15T14:02:39.528Z
- Base URL: https://www.safeclaw.kr
- Request: POST /api/ask (enhanced)
- HTTP: 200
- Quality state: degraded
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
| scenario_controls_present | FAIL | fall: structured.riskAssessmentRows[1]; scaffold: structured.riskAssessmentRows[1]; wind: structured.riskAssessmentRows[4]; traffic: structured.riskAssessmentRows[0]; additional evidence in JSON |
| irrelevant_controls_absent | PASS | unsupported control flags: none |
| quality_state_ready | FAIL | overall: degraded; evidence: ready; structured: ready; DB harness: ready |
| ontology_state_ready | PASS | quality ontology: ready; harness ontology: ready; summary ontology: ready; QA verdict: 통과 |
| no_db_mutation | PASS | POST /api/ask mutatesDb=false |
