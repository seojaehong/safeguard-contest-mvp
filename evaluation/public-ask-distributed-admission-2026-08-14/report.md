# Public Ask Distributed Admission

## Verdict

`PASS_LIVE_PRODUCTION_PUBLIC_ASK_PROVIDER_MODES_FAIL_CLOSED_WITHOUT_DISTRIBUTED_ADMISSION`

Product commit: `4fc478c936d92442a260663e1dfe6aec11cb8d4c`

The current source closes the process-local fallback described by finding `csf_9b3cc6648586dabf4bfa61e9` for provider-backed public Ask modes. It does not rewrite or remove the sealed finding.

## Contract

- Template mode remains available with provider work unit `0` and does not require distributed admission.
- Enhanced and full modes require both distributed rate admission and a distributed weighted lease in production.
- Enhanced consumes `2` units and full consumes the complete `12`-unit provider capacity.
- JSON and SSE routes fail closed before `runAsk` when the distributed backend is absent.
- An explicit stream HTTP admission rejection is not retried through the JSON route. Transport failures without an HTTP response retain the legacy fallback.

## Verification

- Focused Vitest: 3 files / 21 tests, 0 failures.
- Focused and adjacent Vitest: 11 files / 67 tests, 0 failures.
- Strict TypeScript typecheck: PASS.
- Next.js 15.5.22 production build: PASS, 28 static pages.
- Dependency audit: 0 vulnerabilities.
- Local built-server production-mode probe with no distributed backend: template JSON `200` with work unit `0`; enhanced JSON and SSE `503 DISTRIBUTED_RATE_LIMIT_UNAVAILABLE`; no provider call.
- GitHub CI run `31747932563` retained 8 pre-existing unrelated failures across 5 files. No Ask admission test failed.

The same 11-file / 67-test verification is the governed-path compatibility receipt for the existing public JSON body-budget, provider cancellation, provider admission, and public generation admission gates. It preserves the immutable security baseline, no-mutation boundary, fresh-scan requirement, and exact saved Share `MISSING_EVIDENCE` rather than silently treating those older contracts as stale or closed.

## Live Evidence

Production `efc62c3879ff171e6ec664d2b8cb843229486440` includes product commit `4fc478c9`. The live template JSON request returned `200` with work unit `0`. JSON and SSE enhanced/full requests all returned `503 DISTRIBUTED_RATE_LIMIT_UNAVAILABLE` with distributed rate mode before provider work.

## Boundary

No DB mutation, provider call, dispatch, Share-session creation, vector mutation, wiki publication, or KOSHA registry mutation occurred. This proves fail-closed production behavior, not distributed backend activation or finding closure by rescan. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`. Security-complete remains false, operator configuration is still required to enable provider-backed production modes, and a fresh follow-up scan remains required.
