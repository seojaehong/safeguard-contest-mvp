# Public page disconnect cancellation remediation

## Verdict

`PASS_CURRENT_SOURCE_PUBLIC_PAGE_DISCONNECT_CANCELLATION_LIVE_PENDING`

Product commit `8be2c6152b40dbda93b00d5dc57c19fc37022c33` removes the synthetic server-page request boundary from provider-backed Ask and legal-search page loads. Production was still `d110403bd1aa8e79927f9746c0f1a994fd2bdeaa` at verification time, so live closure remains pending.

## Security behavior

- `/ask` now starts provider work through the existing `/api/ask` admission route.
- `/search` now starts provider work through the existing `/api/search` admission route.
- Each client page owns an `AbortController` and aborts its API request when the page unmounts or its query changes.
- The API routes keep their existing admission, size, concurrency, and provider-work controls and propagate the real browser request signal into `runAsk` or coalesced legal search.
- The previous synthetic `Request` created inside the server page is no longer used for provider-backed work.

## Verification

| Check | Result |
| --- | --- |
| Focused Ask/Search security suite | 3 files, 30/30 PASS |
| Strict typecheck | PASS |
| Next.js production build | PASS, 29 static pages |
| Ask navigation disconnect | `/api/ask` started, then `net::ERR_ABORTED` |
| Search navigation disconnect | `/api/search` started, then `net::ERR_ABORTED` |

## Boundaries

This current-source receipt does not rewrite or reclassify a sealed Codex Security scan. Live-after-deployment verification and a fresh whole-repository security scan remain required. No database, provider, Share-session, embedding, vector, Wiki, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
