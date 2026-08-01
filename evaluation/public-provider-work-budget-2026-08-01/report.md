# Public provider and upstream work budget remediation

Verdict: `PASS_LIVE_PRODUCTION_PUBLIC_PROVIDER_WORK_BUDGETS`

## Scope

- Wave: `public-provider-and-upstream-work-budgets`
- Product commit: `10749047126c70edf85e3e6c1e1256383ea0da33`
- Base/source before product patch: `3a64a8a8d3ebfe30aed4728b6a2a2877c9e4a755`
- Evidence head: `94bd0dcaa1e691b0a482b8ed2f552023a21ffcd4`
- Production marker during validation: `94bd0dcaa1e691b0a482b8ed2f552023a21ffcd4`
- Production branch/environment: `master` / `production`
- Deployment: `safeguard-contest-mp7mz67vx-seojaehongs-projects.vercel.app`
- Live-after product deploy: `PASS`

## Findings addressed

Current-source remediation covers the four public provider/upstream work budget findings from the full repository security scan:

- `csf_56e94d5af1a7088bda7deedb`
- `csf_602a3194a53652647244cc7d`
- `csf_1c556be46a6e411979fdc671`
- `csf_82c8e671602027bb56acd591`

The immutable full repository scan artifact is not rewritten or suppressed. A follow-up full repository rescan is still required before any broad security-complete claim.

## Security invariant

Public routes must reject over-budget work before DB search, public API fan-out, or model invocation. Equivalent in-flight weather lookups must share one upstream fetch promise.

## Patch strategy

- Added `lib/public-work-budget.ts` with shared budget constants and 413 response helpers.
- `/api/ask` and `/api/ask/stream` reject oversized `question` and `harnessMemory` before `runAsk`.
- `runAsk` rejects oversized direct-call `question` and `harnessMemory` before search/weather/model work.
- `/api/knowledge/regenerate` rejects oversized question, raw event count, and raw event payload before candidate generation or AI draft generation.
- `/api/workpack/remediate` rejects oversized question/document text before safety-reference search or AI generation.
- `/api/weather` rejects oversized question, applies the existing in-memory route limiter pattern, and coalesces normalized equivalent in-flight lookups.

## Verification

- Focused tests: `npm.cmd exec -- vitest run tests/ask-generation-evidence-routes.test.ts tests/run-ask-work-budget.test.ts tests/knowledge-regenerate-route.test.ts tests/workpack-remediate-route.test.ts tests/weather-route-budget.test.ts --maxWorkers=1 --fileParallelism=false` -> PASS, 5 files / 25 tests.
- Focused + adjacent tests: `npm.cmd exec -- vitest run tests/ask-generation-evidence-routes.test.ts tests/run-ask-work-budget.test.ts tests/knowledge-regenerate-route.test.ts tests/workpack-remediate-route.test.ts tests/weather-route-budget.test.ts tests/photo-vision-analysis-route.test.ts tests/workpack-share-authority-routes.test.ts --maxWorkers=1 --fileParallelism=false` -> PASS, 7 files / 67 tests.
- Typecheck: `npm.cmd run typecheck` -> PASS.
- Dependency audit: `npm.cmd audit --omit=dev` -> PASS, found 0 vulnerabilities.
- Build: `npm.cmd run build` -> PASS, Next 15.5.22, 28/28 pages.
- Diff check: `git diff --check` -> PASS before product commit; LF-to-CRLF notices only.

## Boundaries

- DB mutation performed: `false`
- Migration created/applied: `false`
- Provider load test or paid generation stress test performed: `false`
- Provider/Share/vector/wiki/KOSHA mutation: `false`
- Exact saved `/share/[sessionId]`: `MISSING_EVIDENCE`
- Security-complete claim allowed: `false`
- Remaining current-source remediation wave before full rescan: document export work budgets.
