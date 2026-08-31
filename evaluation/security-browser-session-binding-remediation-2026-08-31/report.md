# Browser session binding security remediation

## Verdict

`PASS_CURRENT_SOURCE_BROWSER_SESSION_BINDING_LIVE_PENDING`

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

Production reported `121c8a017c18b58874ef965cece12bc3e0f0df2f` when checked.
That is the completed security-scan baseline, not product commit `e36356d8`.
The remediation is verified in current source and remains live-pending.

The completed 14-finding Standard scan remains immutable. This artifact does
not rewrite or close that sealed result; a post-deployment verification is
required before a live remediation claim.

## Preserved boundaries

- Exact saved `/share/[sessionId]`: `MISSING_EVIDENCE`.
- No Share session creation, DB mutation, provider dispatch, vector mutation,
  Wiki publication, or KOSHA registry mutation occurred.
- Approval-gated launch boundaries remain open.
