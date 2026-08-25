# LLM Wiki Candidate Content Matrix

- Verdict: `PASS_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX`
- Mode: `live-production`
- Generation mode: `deterministic`
- Base URL: `https://www.safeclaw.kr`
- Source head: `b22b918c2f27c2072f6ba6bc6bc8f822f3c975f0`
- Production commit: `b22b918c2f27c2072f6ba6bc6bc8f822f3c975f0`
- Cases: 5/5 PASS
- Reviewer-visible source traces: 5/5

| Scenario | HTTP | Matched hazards | Sections | Evidence trace | Missing evidence groups | Failures | Verdict |
| --- | ---: | --- | ---: | --- | ---: | --- | --- |
| chemical-cleaning | 200 | chemical-msds | 4/4 | visible | 0 | none | PASS |
| hot-work-fire | 200 | hot-work-fire | 4/4 | visible | 0 | none | PASS |
| confined-space | 200 | confined-space | 4/4 | visible | 0 | none | PASS |
| forklift-traffic | 200 | forklift-traffic | 4/4 | visible | 0 | none | PASS |
| fall-foreign-worker | 200 | fall-scaffold, foreign-worker-briefing | 4/4 | visible | 0 | none | PASS |

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
