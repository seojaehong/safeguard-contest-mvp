# LLM Wiki Candidate Content Matrix

- Verdict: `RED_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX`
- Mode: `live-production`
- Generation mode: `deterministic`
- Base URL: `https://www.safeclaw.kr`
- Source head: `e9138a2fbd6e78a7ead3eead0a511b2d8e21c171`
- Production commit: `e9138a2fbd6e78a7ead3eead0a511b2d8e21c171`
- Cases: 0/5 PASS
- Reviewer-visible source traces: 0/5

| Scenario | HTTP | Matched hazards | Sections | Evidence trace | Missing evidence groups | Failures | Verdict |
| --- | ---: | --- | ---: | --- | ---: | --- | --- |
| chemical-cleaning | 200 | chemical-msds | 4/4 | missing | 2 | missing_evidence_term_group:물질안전보건자료 조회 서비스|안전보건자료 링크 서비스; missing_evidence_term_group:법제처 국가법령정보 산업안전보건법|산업안전보건법; reviewer_evidence_trace_missing; technical_guidance_boundary_missing; law_candidate_boundary_missing | RED |
| hot-work-fire | 200 | hot-work-fire | 4/4 | missing | 2 | missing_evidence_term_group:화기작업 화재·폭발 예방 매뉴얼|사고사망 게시판 정보 조회서비스; missing_evidence_term_group:법제처 국가법령정보 산업안전보건법|산업안전보건법; reviewer_evidence_trace_missing; technical_guidance_boundary_missing; law_candidate_boundary_missing | RED |
| confined-space | 200 | confined-space | 4/4 | missing | 2 | missing_evidence_term_group:안전보건법령 스마트검색|국내재해사례 게시판 정보 조회서비스; missing_evidence_term_group:법제처 국가법령정보 산업안전보건법|산업안전보건법; reviewer_evidence_trace_missing; technical_guidance_boundary_missing; law_candidate_boundary_missing | RED |
| forklift-traffic | 200 | forklift-traffic | 4/4 | missing | 2 | missing_evidence_term_group:지게차의 안전작업계획서 작성지침; missing_evidence_term_group:법제처 국가법령정보 산업안전보건법|산업안전보건법; reviewer_evidence_trace_missing; technical_guidance_boundary_missing; law_candidate_boundary_missing | RED |
| fall-foreign-worker | 200 | fall-scaffold, foreign-worker-briefing | 4/4 | missing | 2 | missing_evidence_term_group:KOSHA 위험성평가 사업안내|KOSHA 4M 기법 위험성평가 메뉴얼; missing_evidence_term_group:법제처 국가법령정보 산업안전보건법|산업안전보건법; reviewer_evidence_trace_missing; technical_guidance_boundary_missing; law_candidate_boundary_missing | RED |

## Contract

- Each scenario uses the deployed stateless `/api/knowledge/regenerate` path.
- Deterministic mode proves the built-in safety-knowledge fallback; provider mode separately proves enhanced LLM generation when runtime admission is available.
- The response must expose the server-derived four-section content-readiness contract.
- Scenario hazard IDs and scenario-specific term groups must remain grounded in generated text.
- Scenario-specific KOSHA/official source terms must be visible in the candidate body, not only in server metadata.
- Candidate text must label KOSHA material as technical/official guidance and law material as a current-law review candidate.
- Placeholder text, legal overclaim, missing law provenance, and missing hazard grounding fail closed.
- All candidates remain unpublished and require human review.

## Boundary

- This matrix does not read the actual production candidate queue.
- No DB write, Wiki publication, provider dispatch, Share-session creation, embedding/vector mutation, or KOSHA registry mutation is performed.
- Exact saved Share remains `MISSING_EVIDENCE`.
- LLM Wiki publication and Supabase RLS isolation remain `APPROVAL_GATED`.
