# LLM Wiki SIF Evidence Matrix

- Verdict: `PASS_LIVE_PRODUCTION_SIF_KOSHA_LAW_WIKI_CANDIDATE_EVIDENCE`
- Product/source commit: `b777fa07c8fa651931796eb6df933ba0e4de4300`
- Live evidence/production commit: `aa4e27df0a917b42556b04f020753bb04dd4c13a`
- Deployment: `safeguard-contest-j9fhfe5fo-seojaehongs-projects.vercel.app`
- Current-source local matrix: 5/5 PASS
- Live production matrix: 5/5 PASS
- Reviewer-visible SIF evidence with SIF provenance: 5/5
- Reviewer-visible KOSHA technical guidance boundary: 5/5
- Reviewer-visible current-law boundary: 5/5
- Event semantic grounding: 5/5
- Private event/title term exposure: 0

## What Changed

The deterministic Wiki candidate now presents evidence in the declared order `SIF incident/control evidence -> KOSHA technical guidance -> current law`. Linked SIF provenance must be visible in the review section or content readiness fails closed. The Knowledge review inbox also shows whether linked SIF evidence is present in the candidate body.

SIF titles are bounded, deduplicated, and filtered with the same private-data patterns used for reviewer-visible event facts. A linked SIF event therefore cannot become an unchecked title disclosure path.

## Evidence

- Current-source matrix: `evaluation/llm-wiki-sif-evidence-matrix-2026-08-26/after-local/report.json`
- Live production matrix: `evaluation/llm-wiki-sif-evidence-matrix-2026-08-26/after-live/report.json`
- Prior live matrix: `evaluation/llm-wiki-candidate-content-matrix-2026-08-25/report.json`
- Focused Vitest: 4 files / 41 tests PASS
- Strict TypeScript check: PASS
- Next production build: PASS, 28 static pages

The prior live matrix proved KOSHA/law evidence visibility and event facts, but did not contain or measure a SIF reviewer-visible contract. It is retained as prior evidence and is not reinterpreted as SIF proof.

## Boundary

- Live production evidence is scoped to five stateless deterministic candidate builds; it is not an actual candidate-queue read or enhanced-provider quality claim.
- The actual production candidate queue was not read.
- Human review is not complete and candidates remain unpublished.
- No DB write, Wiki publication, provider dispatch, Share-session creation, embedding/vector mutation, or KOSHA registry mutation was performed.
- Enhanced LLM generation remains blocked by distributed runtime admission configuration.
- Exact saved Share remains `MISSING_EVIDENCE`.
- LLM Wiki publication and Supabase RLS launch isolation remain `APPROVAL_GATED`.
