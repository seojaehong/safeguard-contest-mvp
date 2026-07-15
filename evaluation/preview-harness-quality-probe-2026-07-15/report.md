# SafeClaw Live Harness Quality Probe

- Overall: FAIL
- Generated: 2026-07-15T14:02:46.875Z
- Base URL: https://safeguard-contest-mvp-git-feat-nort-0f5618-seojaehongs-projects.vercel.app
- Request: POST /api/ask (enhanced)
- HTTP: 401
- Quality state: missing
- Ontology state: missing

## Contract Evidence

| Contract | State | Evidence |
| --- | --- | --- |
| api_response | FAIL | HTTP status: 401 |
| enhanced_mode | FAIL | requested: enhanced; request body: enhanced; response: missing |
| generation_evidence_sealed | FAIL | version: missing; algorithm: missing; snapshot packet: mismatch; signature: structural presence only; server secret is not read by this probe |
| db_harness_first | FAIL | mode: missing; evidence authority: missing; LLM role: missing; fallback chain: missing |
| evidence_sets_present | FAIL | direct: missing; sif: missing; supporting: missing |
| structured_risk_tbm_links | FAIL | risk rows: missing; TBM links: missing; row validation: not ready |
| scenario_controls_present | FAIL | fall: missing; scaffold: missing; wind: missing; traffic: missing; additional evidence in JSON |
| irrelevant_controls_absent | PASS | unsupported control flags: none |
| quality_state_ready | FAIL | overall: missing; evidence: missing; structured: missing; DB harness: missing |
| ontology_state_ready | FAIL | quality ontology: missing; harness ontology: missing; summary ontology: missing; QA verdict: not supplied |
| no_db_mutation | PASS | POST /api/ask mutatesDb=false |
