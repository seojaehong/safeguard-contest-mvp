# LLM Wiki Candidate Content Matrix

- Verdict: `PASS_CURRENT_SOURCE_LOCAL_WIKI_CANDIDATE_EVIDENCE_VISIBILITY_LIVE_PENDING`
- Product/source commit: `909c1747f47e501b3b7dcde30df957e500d43858`
- Current production commit: `e9138a2fbd6e78a7ead3eead0a511b2d8e21c171`
- Current-source deterministic fallback: 5/5 PASS
- Live production deterministic fallback: 5/5 PASS
- Live enhanced LLM attempt: 0/5 RED before AI generation

## Current-source result

The stateless candidate builder produced grounded four-section review candidates for chemical cleaning, hot work, confined space, forklift traffic, and foreign-worker fall scenarios. Every case preserved its expected hazard IDs and scenario-specific terms, reported zero placeholder or legal-overclaim findings, required human review, and remained unpublished.

The reviewer-visible evidence contract found an honest 0/5 live baseline at `e9138a2f`: source provenance existed in server metadata, but KOSHA/official source names, the current-law candidate, and their distinct evidence roles were absent from the candidate body. Current source `909c1747` now passes 5/5 locally. Every candidate exposes a scenario-specific KOSHA source candidate, a current-law candidate, and the technical-guidance-versus-law boundary in the fourth review section. Live verification is still required.

The changed Knowledge regeneration path also retains caller cancellation propagation: `tests/knowledge-regenerate-route.test.ts` passes 18/18, including forwarding the request `AbortSignal` into provider generation and rejecting with the caller's abort reason instead of entering a fallback path.

## Live result

The earlier production commit `db896d45116418c7a185d9dad443a198be7a8de3` returned 5/5 PASS for the prior deterministic fallback contract. The same production commit returned HTTP 503 for all five provider-mode requests because distributed admission was unavailable before AI generation. This remains an honest runtime configuration blocker, not an enhanced LLM content PASS. The stronger reviewer-visible evidence contract is local-only until `909c1747` deploys and a fresh live run passes.

## Scope

- The matrix calls only the stateless `/api/knowledge/regenerate` route.
- It does not read the actual production candidate queue.
- Route-controlled browser fixtures are not accepted as actual generation proof.
- No DB write, Wiki publication, provider dispatch, Share-session creation, vector/embedding mutation, or KOSHA registry mutation occurred.
- Exact saved Share remains `MISSING_EVIDENCE`.
- LLM Wiki publication and Supabase RLS isolation remain `APPROVAL_GATED`.
