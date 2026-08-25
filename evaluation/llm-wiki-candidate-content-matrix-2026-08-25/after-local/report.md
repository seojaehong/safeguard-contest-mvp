# LLM Wiki Candidate Content Matrix

- Verdict: `PASS_CURRENT_SOURCE_LOCAL_LLM_WIKI_CANDIDATE_CONTENT_MATRIX`
- Mode: `current-source-local-production`
- Generation mode: `deterministic`
- Base URL: `http://127.0.0.1:3085`
- Source head: `f07da7c51eaabdc9c15b1a9c85e9655b16d5ba6f`
- Production commit: `not-live`
- Cases: 5/5 PASS

| Scenario | HTTP | Matched hazards | Sections | Failures | Verdict |
| --- | ---: | --- | ---: | --- | --- |
| chemical-cleaning | 200 | chemical-msds | 4/4 | none | PASS |
| hot-work-fire | 200 | hot-work-fire | 4/4 | none | PASS |
| confined-space | 200 | confined-space | 4/4 | none | PASS |
| forklift-traffic | 200 | forklift-traffic | 4/4 | none | PASS |
| fall-foreign-worker | 200 | fall-scaffold, foreign-worker-briefing | 4/4 | none | PASS |

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
