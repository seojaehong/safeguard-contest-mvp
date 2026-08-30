# SafeClaw public ontology error projection remediation

- Verdict: `PASS_LIVE_DEPLOYED_SOURCE_ONTOLOGY_ERROR_PROJECTION_CONTRACT`
- Product commit: `68a8f9dae349cb03d8c77abedd27040b9679bde0`
- Production at verification: `05e70640ec305ff651eba1c42654a6a3b8a02f1e`
- Finding: `csf_74a68abc8d7370ed1b78fad3` (`information-exposure.public-ontology-error-projection`, medium)

## Remediation

The public ontology graph loader no longer embeds a Supabase response body or arbitrary exception message in its API result. Failure responses now contain one of two fixed public error codes, a generated correlation ID, and a bounded Korean message. Server diagnostics retain only the correlation ID, a bounded safe diagnostic label, and structured upstream metadata (`table`, `status`, and `responseBytes`).

Unknown exception text is not logged. This also covers malformed successful responses whose runtime `SyntaxError` message could otherwise quote upstream body fragments. Caller cancellation, public admission, row budgets, body budgets, and the final successful graph output budget remain in place.

## Verification

- Focused and adjacent Vitest: `3` files / `12` tests PASS.
- Negative body-projection coverage: non-2xx and malformed-JSON private markers are absent from both public JSON and server diagnostics.
- Strict TypeScript: `npm.cmd run typecheck` PASS.
- Production build: Next.js `15.5.22`, `28/28` static pages PASS.
- Production marker `05e70640` contains product commit `68a8f9da`.
- Live read-only `/api/ontology/graph` returned `503 DISTRIBUTED_RATE_LIMIT_UNAVAILABLE` before upstream work, with no internal body exposure.

No live upstream failure was induced. The receipt proves the bounded local failure behavior, deployed source marker, and the live public admission boundary separately; it does not claim an induced provider-failure experiment.

## Boundary

This is a current-source remediation receipt, not a rewrite of the sealed finding. The immutable original baseline and sealed current-head scan remain unchanged, and a fresh scan is required before reclassification. No database, provider dispatch, Share-session, vector/embedding, Wiki, or KOSHA registry mutation occurred. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; security-complete remains false.
