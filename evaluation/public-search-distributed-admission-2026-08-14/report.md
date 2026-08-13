# Public Search Distributed Admission

## Verdict

`PASS_LIVE_PRODUCTION_PUBLIC_SEARCH_PROVIDER_WORK_FAILS_CLOSED_WITHOUT_DISTRIBUTED_ADMISSION`

Production commit `b8d24652d3a45ea9bfee50227eb6f37f4a703594` requires distributed rate admission and a shared weighted lease before legal, safety-reference, or weather provider work starts.

## Live Checks

| Surface | Status | Admission | Code |
| --- | ---: | --- | --- |
| `/api/search` | 503 | distributed | `DISTRIBUTED_RATE_LIMIT_UNAVAILABLE` |
| `/api/safety-reference/search` | 503 | distributed | `DISTRIBUTED_RATE_LIMIT_UNAVAILABLE` |
| `/api/weather` | 503 | distributed | `DISTRIBUTED_RATE_LIMIT_UNAVAILABLE` |

The live probes were read-only GET requests. They stopped at admission, and no provider call was executed for evidence.

## Contract

- Shared capacity: 12 work units.
- Legal work: 6 units; safety-reference work: 3 units; weather work: 1 unit.
- One coalesced upstream job acquires one lease even when multiple HTTP consumers share it.
- Success, error, and final-consumer cancellation paths release the lease.
- Development keeps the bounded instance fallback; production fails closed without distributed configuration.

## Verification

- Focused and adjacent Vitest: 5 files, 35 tests, 0 failures.
- Coalesced lease regression: 2 consumers, 1 upstream job, 1 acquire, 1 release.
- Strict TypeScript: PASS.
- Next.js 15.5.22 production build: PASS (`yegsAn6_SApnLPFgNskq8`).
- Diff check: PASS.

The same 5-file/35-test receipt keeps the historical public provider cancellation and weighted-admission gates current for the four changed legal, safety-reference, and weather paths. It does not rewrite their older findings or claims.

## Boundaries

- The immutable `csf_bb897a39277591f4fbab0ca7` finding is not rewritten or closed by this evidence.
- A fresh full-repository security scan remains required before any security-complete claim.
- Distributed backend activation remains `OPERATOR_CONFIGURATION_REQUIRED`.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
- No DB, provider dispatch, Share session, vector runtime, wiki publication, or KOSHA registry mutation occurred.
