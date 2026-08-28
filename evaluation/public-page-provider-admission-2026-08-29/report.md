# Public page provider admission remediation

## Verdict

`PASS_LIVE_PRODUCTION_PUBLIC_PAGE_ADMISSION`

Current source `26e2bc3d` removes direct provider orchestration from the public `/ask` and `/search` pages. Both pages and their API routes now use shared admitted operations before `runAsk` or `runSearch` can execute.

## Security contract

- Ask: public-family rate limit -> question budget -> provider rate limit -> weighted lease -> `runAsk`.
- Search: legal-search rate limit -> query budget -> provider rate limit -> weighted lease -> `runSearch`.
- Production fails closed before provider work when distributed admission is unavailable.
- Request signals reach provider orchestration and weighted leases release in `finally` blocks.
- The pages no longer import `runAsk` or `runSearch` directly.

## Verification

- Focused Vitest: 5 files, 37/37 tests passed.
- Strict TypeScript typecheck: PASS.
- Next.js 15.5.22 production build: PASS, 28/28 static pages generated.
- `git diff --check`: PASS.

## Live verification

Production reported product commit `26e2bc3d8be31826d55fec5074c4a61854ae0027` on `master`. Read-only, no-provider probes confirmed:

- Oversized `/ask` and `/search` page requests rendered their controlled admission-hold states with HTTP 200.
- Oversized `/api/ask` and `/api/search` requests both returned HTTP 413 with `PUBLIC_WORK_BUDGET_EXCEEDED`.
- These probes stopped before provider work and performed no data mutation.

## Preserved boundaries

- No DB, provider dispatch, Share-session, vector, embedding, wiki, or KOSHA registry mutation was performed.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
- This evidence does not close the other findings in scan `c5175a50-038b-402e-9fd3-6af9eec6582b` and does not claim security completion.
