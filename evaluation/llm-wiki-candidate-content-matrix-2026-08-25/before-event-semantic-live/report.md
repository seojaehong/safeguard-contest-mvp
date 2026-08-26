# LLM Wiki Candidate Content Matrix

- Verdict: `RED_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX`
- Mode: `live-production`
- Generation mode: `deterministic`
- Base URL: `https://www.safeclaw.kr`
- Source head: `53fb578d3bd19641074502dd3b9a973ca13d5d7a`
- Production commit: `53fb578d3bd19641074502dd3b9a973ca13d5d7a`
- Cases: 0/5 PASS
- Reviewer-visible source traces: 5/5
- Event semantic grounding: 0/5
- Private event term exposure: 0

| Scenario | HTTP | Matched hazards | Sections | Evidence trace | Event facts | Missing fact groups | Private exposure | Failures | Verdict |
| --- | ---: | --- | ---: | --- | --- | ---: | ---: | --- | --- |
| chemical-cleaning | 200 | chemical-msds | 4/4 | visible | missing | 2 | 0 | missing_event_fact_group:야간 교대 작업; missing_event_fact_group:청각 경보 보조수단 필요; event_semantic_grounding_missing | RED |
| hot-work-fire | 200 | hot-work-fire | 4/4 | visible | missing | 2 | 0 | missing_event_fact_group:상부 양중과 하부 화기 동시작업; missing_event_fact_group:작업 종료 후 30분 잔불 감시; event_semantic_grounding_missing | RED |
| confined-space | 200 | confined-space | 4/4 | visible | missing | 2 | 0 | missing_event_fact_group:입구 감시인 1명 상시 배치; missing_event_fact_group:구조 삼각대 현장 비치; event_semantic_grounding_missing | RED |
| forklift-traffic | 200 | forklift-traffic | 4/4 | visible | missing | 2 | 0 | missing_event_fact_group:북문 상하차 통로 폭 2.4m; missing_event_fact_group:점심 교대시간 보행자 집중; event_semantic_grounding_missing | RED |
| fall-foreign-worker | 200 | fall-scaffold, foreign-worker-briefing | 4/4 | visible | missing | 2 | 0 | missing_event_fact_group:베트남어 브리핑 필요; missing_event_fact_group:오후 돌풍 예보 시 작업 중지; event_semantic_grounding_missing | RED |

## Contract

- Each scenario uses the deployed stateless `/api/knowledge/regenerate` path.
- Deterministic mode proves the built-in safety-knowledge fallback; provider mode separately proves enhanced LLM generation when runtime admission is available.
- The response must expose the server-derived four-section content-readiness contract.
- Scenario hazard IDs and scenario-specific term groups must remain grounded in generated text.
- Scenario-specific KOSHA/official source terms must be visible in the candidate body, not only in server metadata.
- Candidate text must label KOSHA material as technical/official guidance and law material as a current-law review candidate.
- Explicit safe review facts from raw events must remain visible while private payload fields and forbidden terms remain absent.
- Placeholder text, legal overclaim, missing law provenance, and missing hazard grounding fail closed.
- All candidates remain unpublished and require human review.

## Boundary

- This matrix does not read the actual production candidate queue.
- No DB write, Wiki publication, provider dispatch, Share-session creation, embedding/vector mutation, or KOSHA registry mutation is performed.
- Exact saved Share remains `MISSING_EVIDENCE`.
- LLM Wiki publication and Supabase RLS isolation remain `APPROVAL_GATED`.
