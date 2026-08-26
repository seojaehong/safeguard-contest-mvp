# LLM Wiki Candidate Content Matrix

- Verdict: `PASS_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX`
- Mode: `live-production`
- Generation mode: `deterministic`
- Base URL: `https://www.safeclaw.kr`
- Source head: `aa4e27df0a917b42556b04f020753bb04dd4c13a`
- Production commit: `aa4e27df0a917b42556b04f020753bb04dd4c13a`
- Cases: 5/5 PASS
- Reviewer-visible SIF evidence and provenance: 5/5
- Reviewer-visible source traces: 5/5
- Event semantic grounding: 5/5
- Private event term exposure: 0

| Scenario | HTTP | Matched hazards | Sections | SIF evidence | Evidence trace | Event facts | Missing fact groups | Private exposure | Failures | Verdict |
| --- | ---: | --- | ---: | --- | --- | --- | ---: | ---: | --- | --- |
| chemical-cleaning | 200 | chemical-msds | 4/4 | visible+proven | visible | visible | 0 | 0 | none | PASS |
| hot-work-fire | 200 | hot-work-fire | 4/4 | visible+proven | visible | visible | 0 | 0 | none | PASS |
| confined-space | 200 | confined-space | 4/4 | visible+proven | visible | visible | 0 | 0 | none | PASS |
| forklift-traffic | 200 | forklift-traffic | 4/4 | visible+proven | visible | visible | 0 | 0 | none | PASS |
| fall-foreign-worker | 200 | fall-scaffold, foreign-worker-briefing | 4/4 | visible+proven | visible | visible | 0 | 0 | none | PASS |

## Contract

- Each scenario uses the deployed stateless `/api/knowledge/regenerate` path.
- Deterministic mode proves the built-in safety-knowledge fallback; provider mode separately proves enhanced LLM generation when runtime admission is available.
- The response must expose the server-derived four-section content-readiness contract.
- Scenario hazard IDs and scenario-specific term groups must remain grounded in generated text.
- Reviewer-visible evidence must preserve the authority order `SIF incident/control evidence -> KOSHA technical guidance -> current law`.
- Scenario-specific SIF and KOSHA/official source terms must be visible in the candidate body, not only in server metadata.
- Candidate text must label SIF as non-statutory incident/control evidence, KOSHA as technical/official guidance, and law as a current-law review candidate.
- Explicit safe review facts from raw events must remain visible while private payload fields and forbidden terms remain absent.
- Placeholder text, legal overclaim, missing SIF/law provenance, and missing hazard grounding fail closed.
- All candidates remain unpublished and require human review.

## Boundary

- This matrix does not read the actual production candidate queue.
- No DB write, Wiki publication, provider dispatch, Share-session creation, embedding/vector mutation, or KOSHA registry mutation is performed.
- Exact saved Share remains `MISSING_EVIDENCE`.
- LLM Wiki publication and Supabase RLS isolation remain `APPROVAL_GATED`.
