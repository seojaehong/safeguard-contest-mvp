# OpenClaw Broker P0 Hardening Design

## Security boundary

`/api/agent/chat` authenticates the browser Supabase bearer token before resolving a caller-selected site. The site must belong to an organization owned by the authenticated user. Missing authentication returns `401`, missing site context returns `400`, and a site outside the user's owner scope returns `403` before an engine adapter is consulted.

## Engine topology

The route depends on a small `EngineAdapter` interface. Production selects an unavailable adapter by default and returns a stable `503` without spawning. A local OpenClaw adapter is eligible only in explicit `local-openclaw` mode, outside Vercel, after CLI capability checks, and after a site-bound MCP credential verifier proves that the configured profile credential belongs to the authenticated organization and site. This repository does not currently expose enough OpenClaw profile metadata to prove that final binding, so the production verifier fails closed until the documented local sidecar is installed.

A relay boundary may accept only a configured HTTPS origin from a server-side allowlist and a signed, short-lived request carrying user, organization, site, capabilities, issued-at, expiry, and nonce. No generic proxy or relay transport is implemented in this slice.

## Runtime controls

An in-memory adapter guard limits concurrent work per warm instance to one by default. It aborts timed-out work and releases capacity in `finally`. Distributed quota and durable job coordination remain deferred.

Browser-facing errors contain stable codes and redacted Korean messages. Detailed errors, stderr, executable paths, profile names, plugin details, and account details remain server logs only. OpenClaw status validation remains OAuth-only, and every child process uses `shell: false`.

Missing or malformed bearer requests fail locally before Supabase. Syntactically valid but invalid bearer tokens still flow through `auth.getUser(token)` so the browser keeps the existing `AUTH_INVALID` semantics; a dedicated pre-auth abuse limiter for those failures is deferred for a later release.

## Tool effects

The adapter exposes a static capability list containing only `read`, `compute`, and `draft_write`. `draft_write` means an unpersisted draft; this route performs no direct database writes.

## Verification

Focused tests cover authentication, site ownership, adapter reachability, disabled/serverless fail-closed behavior, redacted SSE failures, OAuth-only validation, `shell: false`, concurrency, timeout cleanup, relay configuration validation, and the effect registry. Typecheck, `build27`, and `git diff --check` close the local gate without paid calls or OAuth invocation.
