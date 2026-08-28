# Knowledge Preparation Capability Truth

- Verdict: `PASS_LIVE_DEPLOYED_SOURCE_KNOWLEDGE_PREPARATION_CAPABILITY_TRUTH_AUTHENTICATED_PROBE_HELD`
- Product source: `ea9fb620c17be6dd3b21105d8df2accf9bff6994`
- Current production: `ea9fb620c17be6dd3b21105d8df2accf9bff6994`
- Scope: knowledge-review candidate preparation failure truth only

## Finding

The enhanced LLM candidate path remains unavailable when distributed admission is not configured. Previously, the preparation route converted that configuration failure into `PUBLIC_ASK_CONCURRENCY_LIMIT`, and the review inbox collapsed every failure into a generic preparation error. The UI therefore could not distinguish an operator configuration lock from temporary load.

## Remediation

- A distributed admission exception now returns the fixed public code `DISTRIBUTED_RATE_LIMIT_UNAVAILABLE` without exposing the private exception.
- A null lease remains the temporary `PUBLIC_ASK_CONCURRENCY_LIMIT` case.
- The review inbox presents separate configuration-lock, temporary-load, authentication, and storage/guard messages.
- The lock copy explicitly preserves existing candidate review and the unpublished boundary.

## Verification

- Focused route/UI contracts: 2 files, 29 tests, PASS.
- Adjacent knowledge preparation, review, regeneration, and admission contracts: 4 files, 88 tests, PASS.
- Strict typecheck: PASS.
- Production build: PASS, 28 static pages.

## Boundary

This does not activate enhanced LLM generation, perform an authenticated live candidate preparation, publish Wiki content, or prove RLS. Production includes the product commit, but the live evidence is intentionally marker-only because a behavioral preparation probe would create a real review run. No database, provider, dispatch, Share-session, ontology, Wiki, embedding/vector, or KOSHA registry mutation occurred.

Enhanced LLM runtime remains `BLOCKED_DISTRIBUTED_RATE_LIMIT_CONFIGURATION`; LLM Wiki publication and RLS remain `APPROVAL_GATED`; exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; security-complete remains false.
