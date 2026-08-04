# MCP Generation Work Budget

## Verdict

`PASS_CURRENT_SOURCE_LOCAL_MCP_GENERATION_WORK_BUDGET_LIVE_AND_RESCAN_PENDING`

The current source at `5c0e7c27599a49ff2c6c4c023cf937c240c0a101` adds a measured 96 KiB JSON-RPC body budget and a token-bound 20/min admission guard before authenticated MCP tool dispatch. Production was still at `e1eeffac2e62d615a5f65e1ecc250983ec77ea88` when this report was written, so this is not a live closure claim.

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

## Boundaries

- Live deployment evidence is pending.
- A fresh security rescan is still required before the canonical finding can be reclassified.
- Production distributed limiter activation remains open.
- No DB, provider, Share-session, embedding/vector, wiki, or KOSHA exact-registry mutation occurred.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
