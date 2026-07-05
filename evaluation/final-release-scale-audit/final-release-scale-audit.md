# SafeClaw Final Release Scale Audit

Generated: 2026-07-05T11:20:04.488Z

Base URL: https://www.safeclaw.kr

Automated Verdict: **pass**

Release Verdict: **blocked**

Strict Mode: **on**

## Coverage

- Existing web workflow: production /api/ask document generation.
- AI connection workflow: production AI connection page, token API auth guard, MCP auth guard.
- Scale contract: tenant-scoped hashed tokens, bounded cursor pagination, bounded site-name lookup, active-token cap, email/OAuth callback return path, operator docs.

## Scale Envelope

Invariant: Per-request token list and site-name lookup row counts stay constant as total users grow; 10000-user release requires the mcp_tokens org/site query indexes to be approved and applied.

| Users | Token List Rows Read Per Request Max | Site Name Rows Read Per Request Max | Active Tokens With One Site Per User Max |
|-------|--------------------------------------|-------------------------------------|------------------------------------------|
| 1 | 51 | 50 | 50 |
| 10 | 51 | 50 | 500 |
| 100 | 51 | 50 | 5000 |
| 1000 | 51 | 50 | 50000 |
| 10000 | 51 | 50 | 500000 |

## Automated Gates

| Gate | Verdict | Details |
|------|---------|---------|
| existing-web-api-ask | pass | {"status":200,"elapsedMs":473,"missingDeliverables":[],"deliverableCount":11,"scenario":{"companyName":"그린메탈","companyType":"제조업","siteName":"경기 안산 제조공장","workSummary":"그린메탈 경기 안산 제조공장 옥외 용접 작업","workerCount":6,"weatherN |
| ai-connect-page | pass | {"status":200,"elapsedMs":188} |
| ai-token-api-auth-guard | pass | {"status":401,"limit":50,"nextCursor":null,"message":"관리자 로그인이 필요합니다."} |
| mcp-no-token-auth-guard | pass | {"status":401,"rawPreview":"{\"error\":\"invalid_token\",\"error_description\":\"No authorization provided\"}"} |
| tenant-scoped-token-insert | pass | {"evidence":"lib/mcp-token-service.ts stores only hash + site/org scope"} |
| bounded-token-list | pass | {"evidence":"token list limit constants and API usage present"} |
| cursor-pagination-contract | pass | {"evidence":"opaque cursor helpers, API nextCursor, and UI load-more present"} |
| bounded-site-name-lookup | pass | {"evidence":"token route loads site names only for current page token rows"} |
| active-token-cap | pass | {"evidence":"site-level active token cap enforced before issuing plaintext token"} |
| explicit-user-scale-envelope | pass | {"targets":[1,10,100,1000,10000],"requestBounds":{"tokenListRequestedLimitMax":50,"tokenListFetchRowsMax":51,"siteNameLookupRowsMax":50,"activeTokensPerSiteMax":50},"evidence":"audit payload models 1, 10, 100, 1000, and  |
| multi-provider-auth-return | pass | {"evidence":"email hash callbacks and OAuth code callbacks return to AI connect safely"} |
| operator-scale-docs | pass | {"evidence":"docs/mcp-server.md documents cursor paging, active cap, and index approval gate"} |

## Release Gates

| Gate | Verdict | Details |
|------|---------|---------|
| supabase-kakao-provider-enabled | blocked | {"status":400,"elapsedMs":110,"supabaseOrigin":"https://mewqgevgdgghhatqtuos.supabase.co","disabledReason":"Supabase returned Unsupported provider: provider is not enabled","redirectTo":"https://www.safeclaw.kr/auth/call |
| mcp-token-query-indexes-approved | blocked | {"hasOrgCreatedIndex":false,"hasSiteCreatedIndex":false,"orgIndexEvidenceFiles":[],"siteIndexEvidenceFiles":[],"approvalRequired":true,"approvalCandidate":"evaluation/final-release-scale-audit/mcp-token-query-indexes-app |

## Remaining Operator Actions

- Supabase Auth dashboard Kakao Provider must be enabled before Kakao login is release-ready.
- Supabase Auth dashboard Site URL/Redirect URL must allow https://www.safeclaw.kr/auth/callback.
- DB index migration for 10,000-user operation still requires explicit approval before application. Candidate SQL: evaluation/final-release-scale-audit/mcp-token-query-indexes-approval.sql
- After applying DB indexes, run the read-only verification query: evaluation/final-release-scale-audit/mcp-token-query-indexes-verify.sql
