# Public Search Distributed Admission Configuration Truth

Verdict: `PASS_LIVE_PRODUCTION_PUBLIC_SEARCH_DISTRIBUTED_CONFIGURATION_TRUTH`

## Result

Source and production are aligned at `60e4799ea397f4d287a74e079142b4b828867705`. Both public search routes require distributed admission in production.

- The shared limiter uses an atomic Upstash Redis REST counter when both server-only variables are valid.
- Client identifiers are SHA-256 hashed before becoming Redis keys; raw IP values are not sent as key material.
- Partial, unsafe, absent, or unavailable distributed configuration fails closed before legal or KOSHA provider work.
- Production does not use the development-only per-instance fallback when configuration is absent.
- `X-SafeClaw-Rate-Limit: distributed` on an unavailable response identifies the required guard path. It does not prove the Upstash configuration is ready.

## Live Verification

At `2026-08-27T13:34:25.5248512Z`, one bounded read-only request per route produced the same fail-closed result:

| Route | Status | Mode header | Retry | Code | Provider work |
| --- | ---: | --- | ---: | --- | --- |
| `/api/search` | 503 | `distributed` | 5 seconds | `DISTRIBUTED_RATE_LIMIT_UNAVAILABLE` | not executed |
| `/api/safety-reference/search` | 503 | `distributed` | 5 seconds | `DISTRIBUTED_RATE_LIMIT_UNAVAILABLE` | not executed |

The production configuration state is `absent`, readiness mode is `unavailable`, and distributed activation remains pending. This is honest fail-closed configuration truth, not a claim that distributed protection is configured.

## Verification

- Focused public-search admission tests: 3 files, 19 tests, 0 failures.
- TypeScript strict typecheck: PASS.
- Next.js 15.5.22 production build at the same source head: PASS, 28 static pages.
- `git diff --check`: PASS.
- Targeted secret scan: PASS.

## Boundary

The immutable original 18-finding baseline and completed scan `8fe9c06a-018c-446f-aa98-1b37df95287a` remain unchanged. This companion evidence does not mark either sealed public-search finding remediated; a fresh full repository scan is required after configuration reaches `ready`.

Database findings remain approval-gated. No DB mutation, provider dispatch, Share-session creation, vector mutation, wiki publication, or KOSHA registry mutation occurred. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
