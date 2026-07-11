# OpenClaw Broker Hardening Design

## Browser and owner boundary

`GET /api/agent/context` is a server-authenticated, read-only selector contract. It returns only `{ id, name }` options for sites belonging to organizations whose `owner_id` matches the bearer user. `FieldOperationsWorkspace` fetches it only after a browser session exists and passes the selected ID to `ClawChat`. The browser ID is a selector, never an authority: `/api/agent/chat` authenticates again and rechecks the owner/site binding before it consults an engine.

The chat UI has no guest allowance. Suggestions, input, and send are disabled until both a bearer token and an owned-site context are ready. Login, loading, and unavailable-site states have explicit text.

## Engine topology

The default and Vercel/serverless modes use an unavailable adapter and return stable `503` responses without a child spawn. Local OpenClaw remains fail-closed until a local sidecar proves both the site-bound MCP credential and an executable-tool allowlist/effect-bound authorization. Until that contract exists, adapters expose no executable capabilities; metadata is not described as enforcement.

The installed local OpenClaw `agent --help` for `2026.6.5` documents `--session-key`. Each broker execution supplies an opaque `broker-<uuid>` key scoped as `agent:<agent>:<key>`, so it does not reuse the persisted default `main` session across requests or tenants. This help inspection did not invoke OAuth or an agent turn.

Relay config, relay types, and relay tests are removed. A signed relay remains deferred until there is a complete implementation with transport, signature verification, replay protection, and execution authorization enforcement.

## Runtime controls

A coarse IP limiter executes before body parsing or Supabase authentication; below its threshold malformed anonymous requests still return the useful `401` auth contract. A fine limiter uses the authenticated user ID after the broker's owner/site check. Both are per-route-instance guards, not distributed quota.

Timeout and caller abort propagate into the engine signal. The guarded adapter keeps its concurrency slot until the underlying run settles; the OpenClaw runner kills a child but rejects only after the child `close` event. Already-aborted signals do not spawn a child. Child stderr is drained but never appended to an error, browser response, or broker log. Broker logs contain stable codes only.

## Preserved contracts

`401`, `403`, and `400` auth/site failures remain fail-closed. OAuth validation follows the site and execution-attestation gates. OpenClaw spawn options retain `shell: false`; the browser receives redacted errors; KOSHA and audit prompt contracts remain unchanged.
