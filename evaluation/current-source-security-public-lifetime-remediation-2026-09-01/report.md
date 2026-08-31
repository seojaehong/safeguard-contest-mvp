# SafeClaw public request lifetime remediation

- Verdict: `PASS_LIVE_PRODUCTION_PUBLIC_REQUEST_LIFETIME_REMEDIATION_RESCAN_PENDING`
- Product commit: `b983f9f8b7fe9b3aa57b4701bc782fd3799a421c`
- Production commit: `35c47474b3116712ecceb8cb0b5ec7b1762ddf9d`
- Scan input: `1e5d68c4-fd86-4df4-bb95-542a9708ffef` at `02bc2302`

## Remediation

`POST /api/knowledge/review/prepare` now completes workspace authentication before it reads, buffers, or parses the request body. Unauthenticated requests return `401` without consuming the body. Authenticated requests retain the existing byte ceiling and read deadline before JSON parsing, and the provider-generation admission and coalescing contracts remain unchanged.

The public Ontology page no longer creates a detached synthetic server request for graph work. The browser calls `/api/ontology/graph` directly and aborts that request when navigation unmounts the page. The API already carries the caller signal through its public admission lease and aggregate 15-second deadline into the bounded graph loader. The client accepts a live graph only after validating published nodes, published edges, citations, endpoint integrity, unique node IDs, and count consistency; malformed successful responses keep the seed fallback and `partial` state.

## Verification

- Focused and adjacent Vitest: `7` files / `56` tests PASS.
- Frontend route coverage: `1` file / `39` tests PASS.
- Ontology browser: `2/2` PASS, including live-state promotion and malformed-payload fallback.
- Geometry: `10` Day/Night desktop/tablet/mobile rows; body ratio `1.0`, horizontal overflow `0`, outside elements `0`, overlap pairs `0`, minimum control height `44px`.
- Strict TypeScript: PASS.
- Production build: Next.js `15.5.22`, `29/29` static pages PASS.
- Two independent read-only security reviews found no remaining blocker after the review findings were fixed.
- Production `POST /api/knowledge/review/prepare` returned `401` for the unauthenticated read-only probe.
- Production `/api/ontology/graph` returned `503 DISTRIBUTED_RATE_LIMIT_UNAVAILABLE` before provider or database work because distributed admission is not configured.
- Production Ontology browser verification passed `1` file / `2` tests, including fallback containment.

The frontend static audit still reports two pre-existing Share summary pseudo-element typography residuals. Coverage is complete and the route contract passes; this receipt does not hide or reclassify those unrelated residuals.

## Boundary

This is scoped current-source and live-production remediation evidence, not a rewrite or reclassification of any sealed scan. The immutable original 18-finding baseline remains unchanged, and the sealed current scan's 19 findings remain historical evidence until a fresh scan is completed. No database, provider dispatch, Share-session, vector or embedding, Wiki publication, or KOSHA registry mutation occurred. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; approval-gated findings remain open; security-complete remains false. Distributed ontology admission still requires operator configuration, and a fresh full-repository scan remains required before finding reclassification.
