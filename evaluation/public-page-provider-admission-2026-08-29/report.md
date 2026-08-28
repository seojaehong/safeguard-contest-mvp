# Public page provider admission remediation

## Verdict

`PASS_CURRENT_SOURCE_LOCAL_PUBLIC_PAGE_ADMISSION_LIVE_PENDING`

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

## Live boundary

At evidence time production still reported `c9e24f31b7c9e9db5896bd221401bcef3e35ed24`, while the remediation source is `26e2bc3d`. Live after-deployment verification is required before upgrading this verdict.

## Preserved boundaries

- No DB, provider dispatch, Share-session, vector, embedding, wiki, or KOSHA registry mutation was performed.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
- This evidence does not close the other findings in scan `c5175a50-038b-402e-9fd3-6af9eec6582b` and does not claim security completion.
