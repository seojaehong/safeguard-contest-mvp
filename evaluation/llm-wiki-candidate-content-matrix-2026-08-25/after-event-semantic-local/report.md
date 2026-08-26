# LLM Wiki Candidate Content Matrix

- Verdict: `PASS_CURRENT_SOURCE_LOCAL_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX`
- Mode: `current-source-local-production`
- Generation mode: `deterministic`
- Base URL: `http://127.0.0.1:3083`
- Source head: `4df4dd68f5133f757233bcd34ac247140221220a`
- Production commit: `not-live`
- Cases: 5/5 PASS
- Reviewer-visible source traces: 5/5
- Event semantic grounding: 5/5
- Private event term exposure: 0

| Scenario | HTTP | Matched hazards | Sections | Evidence trace | Event facts | Missing fact groups | Private exposure | Failures | Verdict |
| --- | ---: | --- | ---: | --- | --- | ---: | ---: | --- | --- |
| chemical-cleaning | 200 | chemical-msds | 4/4 | visible | visible | 0 | 0 | none | PASS |
| hot-work-fire | 200 | hot-work-fire | 4/4 | visible | visible | 0 | 0 | none | PASS |
| confined-space | 200 | confined-space | 4/4 | visible | visible | 0 | 0 | none | PASS |
| forklift-traffic | 200 | forklift-traffic | 4/4 | visible | visible | 0 | 0 | none | PASS |
| fall-foreign-worker | 200 | fall-scaffold, foreign-worker-briefing | 4/4 | visible | visible | 0 | 0 | none | PASS |

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
