# Raw Error Projection Security Remediation

- Verdict: `PASS_LIVE_DEPLOYED_SOURCE_RAW_ERROR_PROJECTION_CONTRACT`
- Product and production commit: `856f7e65c33aa71d97277c8abca83864fee8ca47`
- Sealed finding: `csf_7aef114e48b74b34b829e893` (`information-exposure.raw-error-projection`, medium)

## Remediation

Knowledge matching, knowledge ingest persistence, workflow and scheduled briefing dispatch, briefing generation, and photo analysis no longer return raw exception, database, webhook, file-I/O, provider, or harness details. Public failures now use fixed codes, bounded Korean messages, and generated correlation IDs. Server diagnostics retain only a safe error type, bounded token code, integer status, and bounded operation context.

The n8n transport no longer embeds a failed response body in a thrown error. Successful webhook responses are projected through an allowlist of receipt fields. Normal photo provider/model provenance and caller cancellation remain intact, while nested provider/harness failures and invalid-signature file-I/O details are rebuilt as fixed public messages.

## Verification

- Focused security regression: `5` files / `93` tests PASS.
- Adjacent route and capability regression: `6` files / `122` tests PASS.
- Strict TypeScript: `npm.cmd run typecheck` PASS.
- Production build: Next.js `15.5.22`, `28/28` static pages PASS.
- Production marker: `856f7e65`, deployment `safeguard-contest-fi88l10w0-seojaehongs-projects.vercel.app`.
- Read-only live probes: knowledge match `200`, coarse photo readiness `200`, dispatch capability `200 preview_only`, and unauthorized briefing `401`, with no internal error details exposed.

No production failure was induced. The negative failure contract is proven by bounded tests and the deployed source marker; the live probes confirm only non-mutating public boundaries.

## Boundary

This receipt does not rewrite or close the sealed 21-finding scan. The immutable original 18-finding baseline and sealed current-head scan remain unchanged, and a fresh follow-up scan is required before reclassification. No database, provider dispatch, Share-session, vector/embedding, Wiki, or KOSHA registry mutation occurred. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`, approval-gated findings remain open, and security-complete remains false.
