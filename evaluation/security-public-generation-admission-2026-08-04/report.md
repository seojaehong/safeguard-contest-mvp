# Public generation distributed admission truth

## Verdict

`PASS_LIVE_PRODUCTION_PUBLIC_GENERATION_DISTRIBUTED_CONFIGURATION_TRUTH`

Product and production commit: `99c7df721af566510a96793c75701bd78392a034`

The immutable security baseline remains scan `d12d04ce-deaf-497d-8754-33d5baab2ca0` at target `e087d474a1de72bd3687c703a61a4263fe792fa4`. This evidence does not rewrite that baseline or claim that its 28 reportable findings are closed.

## Measured Change

Before remediation, live production at `f86fb44f` returned `400 question is required` with `X-SafeClaw-Rate-Limit: instance` for empty JSON requests to both public generation routes.

Current source and live production at `99c7df72` require distributed admission before request-body parsing:

- `/api/knowledge/regenerate`: `503 DISTRIBUTED_RATE_LIMIT_UNAVAILABLE`, mode header `distributed`, retry after 5 seconds.
- `/api/workpack/remediate`: `503 DISTRIBUTED_RATE_LIMIT_UNAVAILABLE`, mode header `distributed`, retry after 5 seconds.

Both routes stopped before reference search, AI or provider work, and database mutation. Production no longer accepts the instance limiter as a fallback for these routes.

## Runtime Boundary

Production currently reports distributed configuration state `absent` and readiness `unavailable`. The `distributed` response header identifies the required admission path; it does not prove that an active distributed limiter is configured. Multi-instance protection remains pending until approved server-only credentials produce `configurationState=ready`.

Development may retain the instance limiter for local work. Partial or absent distributed production configuration fails closed.

## Verification

- Focused route and admission tests: 3 files, 34 tests, PASS.
- Northstar contract suite: 3 files, 174 tests, PASS.
- Strict typecheck: PASS.
- Production build: PASS, Next.js 15.5.22, 28 static pages.
- `npm audit`: 0 vulnerabilities.
- `git diff --check`: PASS.
- Local production probe: `2026-08-27T14:13:54.3956876Z`.
- Live production probe: `2026-08-27T14:15:15.0072814Z`.

## Boundaries

No database mutation, provider dispatch, Share-session creation, vector or embedding mutation, wiki publication, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`. Approval-gated operations remain approval-gated. A fresh full-repository security scan remains required before claiming canonical scan closure.
