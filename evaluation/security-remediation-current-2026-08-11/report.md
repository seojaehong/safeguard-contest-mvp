# Approval-free security remediation

Verdict: `PASS_CURRENT_SOURCE_APPROVAL_FREE_SECURITY_REMEDIATION_LIVE_PENDING`

## Scope

- Product commit: `f0bacff5a0b32adb5b534afdce1135a4385d528c`
- Immutable completed scan: `8fe9c06a-018c-446f-aa98-1b37df95287a` (17 findings)
- Fresh current-source scan: `739fa314-fe17-4f46-80c5-0802b932bf83` (27 findings: 11 medium, 16 low; partial coverage)
- No DB, provider dispatch, Share-session, vector, wiki, or KOSHA exact-registry mutation was performed.

## Source-remediated findings

- MCP coarse admission now runs before token resolution; token-scoped admission remains after authentication.
- Agent chat and MCP token issuance enforce measured pre-parse body limits.
- HWP, XLSX, PDF, and HWPX share one `document-export` admission namespace and a two-work in-process concurrency lease.
- Legal provider timeouts abort the underlying Law.go and korean-law-mcp request before retry.
- Safety-reference REST/RPC/count requests use explicit abortable deadlines.

## Partial remediation

- `/api/ask` and `/api/ask/stream` now share `public-ask-family` admission. Request abort and SSE cancellation reach orchestration, legal fetches, and safety-reference fetches. Some SDK-backed generation providers still cannot receive an `AbortSignal`, so this finding is not claimed fully closed.
- Weather coalescing now uses the resolved area and outdoor/standard work key. Distributed miss-concurrency proof is still pending.

## Verification

- Focused security suite: 9 files, 52 tests PASS.
- Adjacent regression suite: 18 files, 222 tests PASS.
- Post-build MCP route regression: 2 files, 12 tests PASS.
- Strict TypeScript: PASS.
- Next.js 15.5.22 production build: PASS, 28 static pages.
- `git diff --check`: PASS.

## Boundaries

- Exact saved `/share/[sessionId]`: `MISSING_EVIDENCE`.
- DB/RLS and tenant-isolation findings remain approval-gated and untouched.
- Provider dispatch persistence remains approval-gated and preview-only.
- Distributed runtime configuration and live headers require post-deployment verification.
- A follow-up security scan is required after deployment; this report does not rewrite either immutable baseline.
