# MCP bearer token expiry remediation

## Verdict

`PASS_LIVE_DEPLOYED_SOURCE_MCP_TOKEN_EXPIRY`

Product commit `b42c1a54b9ee27ddffea4ae20ef405b721d4e513` closes the medium
`mcp-token-no-expiry` finding without a database migration. Production now reports the same commit
from deployment `safeguard-contest-igtkhr11y-seojaehongs-projects.vercel.app`.

## Contract

- Persisted MCP tokens expire 90 days after `created_at`.
- Missing, malformed, future-issued, disabled, or expired persisted rows fail closed.
- A matched persisted row that is invalid cannot fall back to a legacy env token.
- Production legacy tokens require `SAFECLAW_MCP_LEGACY_EXPIRES_AT`, in the future and no more
  than 90 days away.
- Expired rows do not consume the active issuance limit.
- The token API and AI connection screen expose expiry and expired status.
- No schema change is required; the contract derives expiry from existing `created_at`.

## Verification

- MCP and AI-connect focused/adjacent suites: 5 files, 74 tests passed.
- Authenticated production-browser matrix: 1 file, 2 tests passed across Day/Night and
  1440x900, 390x844, and 1440x320.
- Frontend consistency audit: pass, 0 violations, 0 coverage issues.
- Strict typecheck: pass.
- Next.js 15.5.22 production build: pass, 28 static pages.
- Diff check: pass. Targeted secret scan: 0 matches.

## Boundaries

No live MCP token was issued or authenticated. No production environment variable was changed.
No DB migration or mutation, provider dispatch, Share session creation, vector/embedding mutation,
wiki publication, or KOSHA registry mutation occurred. Exact saved `/share/[sessionId]` remains
`MISSING_EVIDENCE`, and all approval-gated claims remain unchanged.
