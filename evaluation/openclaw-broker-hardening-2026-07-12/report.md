# OpenClaw Broker P0 Hardening Report

## Outcome

The browser route no longer has a path from an unauthenticated request to the host OpenClaw profile. `/api/agent/chat` now requires a valid Supabase bearer session and an explicit site ID owned by the authenticated user's organization before consulting an engine adapter.

## Topology truth

| Topology | Result | Process behavior |
| --- | --- | --- |
| Vercel/serverless | `ENGINE_UNAVAILABLE` (`503`) | Never attempts CLI spawn. `VERCEL` forces local mode to disabled. |
| Default local server | `ENGINE_UNAVAILABLE` (`503`) | Never attempts CLI spawn. `SAFECLAW_ENGINE_MODE` defaults to disabled. |
| Explicit local demo | `ENGINE_SITE_BINDING_UNPROVEN` (`503`) in the current repository | Checks local runtime capability, then fails before OAuth status or agent spawn because the OpenClaw profile's MCP bearer credential cannot yet be proven to match the request site. |
| Future relay | Not implemented | Only a fixed HTTPS-origin allowlist and signed short-lived request shape are defined. There is no generic proxy, tunnel, or user-supplied URL. |

No OAuth token is copied into Vercel, application env, browser output, or logs by this change. Existing OpenAI OAuth-only status validation remains in place. Child processes use `shell: false`.

## Request binding

The request body carries `siteId`; the server does not trust it. The server validates the bearer with `getWorkspaceUser()` / Supabase `auth.getUser(token)`, loads that site, and verifies that its organization has `owner_id` equal to the authenticated user. The resulting adapter context contains only `userId`, `organizationId`, `siteId`, and the redacted site prompt profile.

Stable pre-stream responses:

- `AUTH_REQUIRED` (`401`)
- `AUTH_INVALID` (`401`)
- `AUTH_BACKEND_UNAVAILABLE` (`503`)
- `SITE_CONTEXT_REQUIRED` (`400`)
- `SITE_FORBIDDEN` (`403`)
- `ENGINE_UNAVAILABLE` (`503`)
- `ENGINE_RUNTIME_UNAVAILABLE` (`503`)
- `ENGINE_SITE_BINDING_UNPROVEN` (`503`)

Stable stream failures include `ENGINE_BUSY`, `ENGINE_TIMEOUT`, and `ENGINE_EXECUTION_FAILED`. Browser SSE never includes stderr, local paths, profile/plugin names, or account details. Detailed errors remain server-side structured logs.

## Auth abuse limiter adjudication

This release keeps the current public auth semantics:

- Missing or malformed bearer headers fail locally as `AUTH_REQUIRED` before any Supabase call.
- Syntactically valid but invalid bearer tokens still call `auth.getUser(token)` and return `AUTH_INVALID`.

No separate pre-auth abuse limiter was added for invalid bearer floods in this slice. That exposure remains deferred so this release does not collapse `AUTH_INVALID` into a generic rate-limit or auth-required response for legitimate callers behind a noisy shared IP.

## Local sidecar requirement

Local demo activation remains intentionally incomplete until a loopback operator sidecar can attest all of the following without returning plaintext secrets:

1. The exact OpenClaw profile and MCP server entry selected for the run.
2. A hash of that entry's bearer token matches one active `mcp_tokens.token_hash` row.
3. That row's `site_id` and `org_id` exactly match the authenticated broker context.
4. The attestation includes profile/config fingerprint, issued-at, expiry of at most 60 seconds, and a nonce.
5. The broker verifies a server-held signature and rejects replay, expiry, mismatch, missing fields, and env-wide legacy tokens.

Until that verifier is implemented and wired into `createLocalOpenClawAdapter`, the production dependency returns false and local execution fails closed. An env-wide `SAFECLAW_MCP_TOKENS` credential is not accepted as proof.

## Runtime controls

- Static effects: `read`, `compute`, `draft_write` only. `draft_write` is an unpersisted draft; the route performs no direct database writes.
- Per-instance concurrency: default `1`, configurable server-side with `OPENCLAW_MAX_CONCURRENT`.
- Local adapter preflight is stateless. A later site preflight cannot overwrite another site's runnable context before the guarded run acquires the concurrency slot.
- Timeout: aborts work, kills the local child through the adapter signal, clears timers/listeners, and releases capacity.
- Deferred: distributed quota, durable job ownership, cross-instance cancellation, replay storage, and durable relay nonce tracking require future engine infrastructure.
- Deferred: invalid-bearer pre-auth abuse limiting remains a separate release decision.

## Verification

- Focused baseline before changes: existing broker/auth modules were absent from the slice.
- TDD RED: missing adapter/auth modules and missing `shell: false` spawn option failed as expected during implementation.
- Focused GREEN: `npm.cmd test -- tests/claw-chat-route.test.ts tests/openclaw-chat.test.ts tests/engine-adapter.test.ts` passed with 3 files / 25 tests, including the interleaving regression that protects `checkAvailability(A) -> checkAvailability(B) -> run(A)`.
- Typecheck: `npm.cmd run typecheck` passed.
- `build27`: `npm.cmd run build` passed once and generated static pages `27/27`.
- `git diff --check`: passed. Only existing LF->CRLF warnings were emitted; no whitespace errors were reported.
- Independent self-review: passed for the owned slice (`app/api/agent/chat/route.ts`, `components/ClawChat.tsx`, `lib/agent-loop.ts`, `lib/openclaw-chat.ts`, `lib/openclaw-broker-auth.ts`, `lib/openclaw-broker-route.ts`, `lib/engine-adapter.ts`, related tests/docs/evaluation).

## Scope diff-check

Dirty worktree review stayed inside the declared ownership boundary:

- Route and UI wiring: `app/api/agent/chat/route.ts`, `components/ClawChat.tsx`, `lib/agent-loop.ts`
- Engine hardening: `lib/openclaw-chat.ts`, `lib/openclaw-broker-auth.ts`, `lib/openclaw-broker-route.ts`, `lib/engine-adapter.ts`
- Focused tests: `tests/claw-chat-route.test.ts`, `tests/openclaw-chat.test.ts`, `tests/engine-adapter.test.ts`
- Evidence: `docs/superpowers/plans/2026-07-12-openclaw-broker-hardening.md`, `docs/superpowers/specs/2026-07-12-openclaw-broker-hardening-design.md`, `evaluation/openclaw-broker-hardening-2026-07-12/report.md`, `evaluation/openclaw-broker-hardening-2026-07-12/report.json`, `evaluation/openclaw-broker-hardening-2026-07-12/verification.md`

No paid API call, OAuth invocation, token rotation, tunnel deployment, public exposure, database migration, or schema change was performed.
