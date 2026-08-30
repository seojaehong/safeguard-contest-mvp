# SafeClaw logout user-content storage remediation

- Verdict: `PASS_LIVE_DEPLOYED_SOURCE_LOGOUT_USER_CONTENT_PURGE_CONTRACT`
- Source base: `e1669ffbdbe2d9f1a73d2d365f924c9dc674fb98`
- Product/production: `e7533365e3ceb9ceef733587e05709cb59860d4f`
- Finding: `csf_939ccf5e3f2f0fa1963be3e5` (`client-data.persistent-logout-retention`, medium)

## Remediation

Both explicit logout surfaces and the Supabase `SIGNED_OUT` event now purge persisted user content. The bounded cleanup removes the current workpack, raw worker and recipient snapshots, generated document drafts, editorial review state and reviewer name, and operation-improvement/photo metadata. Theme and AI-mode preferences remain intact.

The workspace logout path navigates to `/login` after cleanup. This unmounts the workspace and prevents its autosave effects from recreating the just-deleted worker and document data. Cleanup still runs if the Supabase sign-out request fails, and per-key cleanup failures are surfaced instead of silently ignored.

## Verification

- Focused and adjacent Vitest: `5` files / `100` tests PASS.
- Strict TypeScript: `npm.cmd run typecheck` PASS.
- Production build: Next.js `15.5.22`, `28/28` static pages PASS.
- Frontend static audit: `33` pages, `24` components, `0` coverage issues, `0` violations.
- Vercel status and production `/api/build-info`: `e7533365`, `master`, `production` PASS.

The live logout action itself was not executed because that would mutate the signed-in browser session and local user-content storage. This receipt therefore proves the local behavior contract and the deployed source marker separately.

## Boundary

This is a current-source remediation receipt, not a rewrite of the sealed finding. The immutable original baseline and current-head Standard scan remain unchanged, and a fresh scan is required before reclassification. No database, provider, Share-session, vector/embedding, Wiki, or KOSHA registry mutation occurred. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; security-complete remains false.
