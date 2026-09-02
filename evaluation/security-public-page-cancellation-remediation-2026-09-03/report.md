# Public page disconnect cancellation remediation

## Verdict

`PASS_LIVE_PRODUCTION_PUBLIC_PAGE_DISCONNECT_CANCELLATION`

Product commit `8be2c6152b40dbda93b00d5dc57c19fc37022c33` removes the synthetic server-page request boundary from provider-backed Ask and legal-search page loads. Production commit `e9b7c3c6a64aed27fa71f1c3f6b352b627b41426` contains the product change, and the deployed page bundles reproduce the expected request cancellation.

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
| Live Ask navigation disconnect | Deployed request intercepted before provider execution, then `net::ERR_ABORTED` |
| Live Search navigation disconnect | Deployed request intercepted before provider execution, then `net::ERR_ABORTED` |

## Boundaries

This receipt does not rewrite or reclassify a sealed Codex Security scan. A fresh whole-repository security scan remains required. The live browser probes intercepted both API requests before provider execution, so no database, provider, Share-session, embedding, vector, Wiki, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
