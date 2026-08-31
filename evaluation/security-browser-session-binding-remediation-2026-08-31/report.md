# Browser session binding security remediation

## Verdict

`PASS_LIVE_DEPLOYED_SOURCE_BROWSER_SESSION_BINDING_RESCAN_PENDING`

Product commit `e36356d8` routes all 11 browser Supabase client surfaces through
one factory with `detectSessionInUrl: false`. Non-callback pages therefore no
longer accept an unbound implicit session from a crafted URL fragment. The
transaction-bound callback continues to parse and persist its session only
after consuming the locally initiated `auth_tx` value.

## Verification

- Focused authentication contract: 1 file, 14 tests passed.
- Strict TypeScript typecheck: PASS.
- Next.js 15.5.22 production build: PASS, 28 static pages generated.
- Static inventory: 11 safe browser-client surfaces and zero raw
  `createClient(...)` calls under `app/` or `components/`.
- Adjacent surface contracts passed 27 tests and skipped 2. The one residual
  RED is an existing frontend consistency finding for
  `.safeclaw-share-recipient-documents-summary::after` in `app/globals.css`;
  it is outside this authentication remediation.

## Live state

Production reported `77bcd6ea4ec1ea1914126dd7ba924f788b972602` when rechecked.
That deployment contains product commit `e36356d8`, so the bounded browser-client
configuration is source/live aligned. No live login or session mutation was
performed; this is a deployed-source verification, not a new authenticated-flow scan.

The completed 14-finding Standard scan remains immutable. This artifact does
not rewrite or close that sealed result; a post-deployment verification is
required before the sealed scan finding can be reclassified or closed.

## Preserved boundaries

- Exact saved `/share/[sessionId]`: `MISSING_EVIDENCE`.
- No Share session creation, DB mutation, provider dispatch, vector mutation,
  Wiki publication, or KOSHA registry mutation occurred.
- Approval-gated launch boundaries remain open.
