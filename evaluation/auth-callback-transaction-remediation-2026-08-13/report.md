# Auth callback transaction remediation

Verdict: `PASS_LIVE_PRODUCTION_AUTH_CALLBACK_TRANSACTION_RESCAN_PENDING`

Source: `11ac094112cb3b83a14c36f294b84583ef45ce03`

The login origin now records a 15-minute one-time browser transaction and places its nonce in the callback URL. The callback disables Supabase automatic URL-session detection, consumes the local transaction before reading hash tokens or exchanging an OAuth code, and rejects unsolicited callbacks.

## Verification

- Auth callback contract: 1 file, 12 tests passed.
- Strict typecheck: passed.
- Next.js 15.5.22 production build: passed, 28 static pages.
- The broader frontend reconciliation reported a source-identity refresh requirement because callback source changed; no product assertion failed in that check.
- Live production `b94f1fe5`, Chrome 1440x723: an unsolicited fake hash session was rejected, the hash was removed, and no local transaction existed.

## Boundary

No valid live authentication flow, DB mutation, provider dispatch, Share-session creation, vector mutation, wiki publication, or KOSHA registry mutation was performed. Frontend evidence refresh and the follow-up security scan remain pending. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
