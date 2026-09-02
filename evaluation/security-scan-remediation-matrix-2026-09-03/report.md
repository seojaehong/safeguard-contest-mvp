# Security scan remediation matrix

## Verdict

`PASS_APPROVAL_FREE_SECURITY_REMEDIATIONS_DATABASE_GATES_REMAIN`

The immutable Codex Security baseline remains the 17 findings produced by scan `8fe9c06a-018c-446f-aa98-1b37df95287a` against `f0c8a7be`. This companion matrix does not rewrite or suppress that baseline.

## Current classification

- Four application findings are mitigated in current source: public legal-search work amplification, public safety-reference work amplification, replayable client dispatch-log persistence, and unbounded authenticated MCP generation.
- Thirteen findings require Supabase RLS or same-tenant relationship constraints. They remain approval-gated because implementing or applying those controls changes the database schema and live authorization behavior.
- A post-scan high-severity transitive advisory was found in the explicit `fast-uri@3.1.5` override. The override and lockfile now use `3.1.6`, which remains inside AJV's declared `^3.0.1` compatibility range.

## Verification

- Focused security regression tests: 3 files, 35 tests passed.
- TypeScript strict typecheck: PASS.
- Next.js 15.5.22 production build: PASS, 29 static pages generated.
- Dependency tree: `ajv@8.20.0` resolves `fast-uri@3.1.6`.
- `npm audit`: 0 vulnerabilities after remediation.
- Remote CI: pending for this branch.

## Boundaries

No database schema or data mutation, provider dispatch, share-session creation, embedding/vector mutation, wiki publication, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` evidence remains `MISSING_EVIDENCE`.
