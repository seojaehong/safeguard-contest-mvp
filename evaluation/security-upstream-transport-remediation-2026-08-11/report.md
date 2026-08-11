# Security Upstream Transport Remediation

## Verdict

`PASS_LIVE_PRODUCTION_SOURCE_PROVEN_UPSTREAM_TRANSPORT_SECURITY_NO_PROVIDER_PROBE`

Product commit `b673fc5d` is live in production. It closes two approval-free medium findings from sealed scan `a8aa9242-ed42-4057-88e9-31a72e298292` without rewriting the immutable 20-finding baseline.

## Remediated Findings

- `configurable-mcp-upstream-ssrf`: configurable KIER and KOSHA relay endpoints now require an explicit credential-free HTTPS origin allowlist, reject private/link-local resolution, block redirects, and attach credentials only after URL approval.
- `unbounded-mcp-upstream-response`: KMA/KIER weather responses are capped at 1 MiB and KOSHA accident/relay responses at 2 MiB using both declared-length and streamed-byte enforcement.

The cumulative accounting is now 8 of 20 findings remediated, with 12 still open. This report is not a security-complete claim and does not replace a fresh follow-up scan.

## Verification

- Focused upstream security and integration suite: 5 files / 32 tests PASS.
- Adjacent provider, MCP, safety-reference, and public-search suite: 11 files / 119 tests PASS.
- Strict TypeScript typecheck PASS.
- Next.js 15.5.22 production build PASS, 28/28 static pages.
- Production marker: `b673fc5d3a7f3be366c61d242e54d6a8a452e85e`.
- No external KMA, KIER, KOSHA relay, or provider-dispatch probe was executed. Runtime deployment is proven by build-info; transport behavior is proven by current-source tests.

## Boundaries

- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
- Provider dispatch persistence remains `APPROVAL_GATED`.
- No DB mutation, external provider call, Share-session creation, vector upload, wiki publication, or KOSHA exact-registry mutation occurred.
- The remaining 12 sealed findings stay visible and require remediation, explicit deferral, or a later validated scan.
