# Public Search Distributed Rate-Limit Readiness

Verdict: `PASS_CURRENT_SOURCE_DISTRIBUTED_LIMITER_CAPABILITY_LIVE_CONFIGURATION_PENDING`

## Result

Current source `c1e5a98ff75d8d67b7ebd7eb8b2ed00c2bedcd56` adds one shared distributed admission-control contract to `/api/search` and `/api/safety-reference/search`.

- Both routes use an atomic fixed-window counter through the Upstash Redis REST API.
- Client identifiers are SHA-256 hashed before they become Redis keys; raw IP values are not sent as key material.
- The endpoint must be HTTPS and both server-only variables must be present.
- Partial or unsafe configuration fails closed with HTTP 503 before legal/KOSHA provider work.
- A configured distributed counter outage also fails closed before provider work.
- When both variables are absent, the existing per-instance guard remains active and responses disclose `X-SafeClaw-Rate-Limit: instance` rather than pretending distributed protection is active.

The protocol shape follows the official [Upstash Redis REST API documentation](https://upstash.com/docs/redis/features/restapi), including a command JSON array and a single atomic `EVAL` operation.

## Verification

- Focused and adjacent security tests: 6 files, 88 tests, 0 failures.
- TypeScript strict typecheck: PASS.
- Next.js 15.5.22 production build: PASS, 28 static pages.
- `git diff --check`: PASS.
- Targeted secret scan: PASS.

## Live Boundary

Production still reported `6546a04912bc3fd08f28bd09037701cc113d6e0b` when this report was authored, so current source had not deployed. Production Upstash configuration was not inspected or changed. This report does not claim `X-SafeClaw-Rate-Limit: distributed` is live.

The sealed scan `8fe9c06a-018c-446f-aa98-1b37df95287a` remains immutable. Its two public-search findings are not marked closed by this companion evidence; a future full repository scan must reclassify them after the production mode is verified. Thirteen DB/RLS findings remain separately approval-gated.

No DB mutation, provider dispatch, Share-session creation, vector mutation, wiki publication, or KOSHA registry mutation occurred. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
