# MCP Generation Work Budget

## Verdict

`PASS_LIVE_PRODUCTION_SOURCE_INCLUDED_MCP_GENERATION_WORK_BUDGET_AUTHENTICATED_RUNTIME_PROBE_AND_RESCAN_PENDING`

The source and production marker are aligned at `5c0e7c27599a49ff2c6c4c023cf937c240c0a101`. The deployed source adds a measured 96 KiB JSON-RPC body budget and a token-bound 20/min admission guard before authenticated MCP tool dispatch. A read-only invalid-token probe returned 401 fail-closed. No production MCP credential was used, so the valid authenticated runtime boundary and fresh rescan remain open.

## Immutable Baseline

- Scan: `8fe9c06a-018c-446f-aa98-1b37df95287a`
- Target: `f0c8a7be02becd53c21fb80842cf23c571f22b1f`
- Finding: `csf_f30faad248ef517b894c8946`
- Rule: `resource-exhaustion.mcp-generation`

The sealed finding remains unchanged. This report records a remediation candidate and does not replace a fresh security rescan.

## Current Contract

- Actual streamed request bytes are counted; an undersized or absent `Content-Length` does not bypass the 96 KiB limit.
- Existing field limits remain: question 4,000 characters, task 256 characters, QA document 20,000 characters.
- A valid maximum-size QA document remains below the aggregate body budget and is accepted.
- POST admission uses the shared atomic Upstash limiter when configured and an explicit instance fallback when fully absent.
- Partial or unavailable distributed configuration fails closed before body buffering and MCP tool work.
- The bearer is hashed before it becomes the limiter identifier; the raw bearer is not sent in the Redis key.
- GET/SSE and DELETE session behavior remain outside the POST work budget.

## Verification

- Focused: 2 files / 14 tests PASS.
- Adjacent MCP: 7 files / 77 tests PASS.
- Strict TypeScript: PASS.
- Dependency audit: 0 vulnerabilities.
- Production build: PASS, Next.js 15.5.22, 28 static pages.
- Production marker: `5c0e7c27599a49ff2c6c4c023cf937c240c0a101` on `safeguard-contest-n0go4io0m-seojaehongs-projects.vercel.app`.
- Read-only invalid-token MCP probe: 401 fail-closed; no valid credential was used.

## Current live refresh

Production commit `65f7d839d64a1aefc9e275764497bcd5eab0174b` was re-probed with an intentionally invalid, non-secret bearer and a two-byte JSON body. `/api/mcp/mcp` returned `503 DISTRIBUTED_RATE_LIMIT_UNAVAILABLE` with `X-SafeClaw-Rate-Limit: distributed` and `Retry-After: 5`. This proves distributed admission is configured but currently unhealthy, and that the request fails closed before authentication, MCP tool dispatch, provider work, or mutation. Current compatibility verification passes 3 files / 65 focused tests and 8 files / 126 adjacent MCP tests with zero dependency vulnerabilities. This does not substitute for restored distributed backend health, a valid authenticated 96 KiB boundary probe, or a fresh security scan.

## Boundaries

- The product source is deployed, but a valid authenticated runtime body/rate-limit probe is pending.
- A fresh security rescan is still required before the canonical finding can be reclassified.
- Production distributed limiter activation is observed; distributed backend health remains open.
- No DB, provider, Share-session, embedding/vector, wiki, or KOSHA exact-registry mutation occurred.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
