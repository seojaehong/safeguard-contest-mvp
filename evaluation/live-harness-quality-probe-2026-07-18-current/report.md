# SafeClaw Live Harness Quality Probe

- Overall: FAIL
- Generated: 2026-07-17T20:02:51.701Z
- Base URL: https://www.safeclaw.kr
- Request: POST /api/ask (enhanced)
- HTTP: 200
- Quality state: blocked
- Ontology state: ready

## Contract Evidence

| Contract | State | Evidence |
| --- | --- | --- |
| api_response | PASS | HTTP status: 200 |
| enhanced_mode | PASS | requested: enhanced; request body: enhanced; response: enhanced |
| generation_evidence_sealed | PASS | version: safeclaw-generation-evidence/v1; algorithm: HMAC-SHA256; snapshot packet: matches; signature: structural presence only; server secret is not read by this probe |
| db_harness_first | PASS | mode: db_harness_first; evidence authority: db_harness; LLM role: naturalize_only; fallback chain: false |
| evidence_sets_present | PASS | direct: present; sif: present; supporting: present |
| structured_risk_tbm_links | FAIL | risk rows: missing; TBM links: missing; row validation: not ready |
| scenario_controls_present | FAIL | fall: missing; scaffold: missing; wind: missing; traffic: missing; additional evidence in JSON |
| irrelevant_controls_absent | FAIL | machine_guard: 가동부 방호덮개 at dbHarness.packet.directEvidence[2] |
| quality_state_ready | FAIL | overall: blocked; evidence: ready; structured: blocked; DB harness: degraded |
| ontology_state_ready | FAIL | quality ontology: ready; harness ontology: review_required; summary ontology: review_required; QA verdict: 통과 |
| no_db_mutation | PASS | POST /api/ask mutatesDb=false |

## Flags

- machine_guard: 가동부 방호덮개 (dbHarness.packet.directEvidence[2])
