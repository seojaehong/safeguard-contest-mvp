# Remote OpenClaw Signed Protocol Phase 1

## Scope

This change adds only a pure Node protocol module, focused tests, and this evaluation report. It does not wire the protocol into engine selection, runtime routes, MCP, OpenClaw, UI, database, schema, environment, or the sidecar repository. Runtime behavior remains disabled and unchanged.

## Protocol contract

- `RemoteEngineRequestV1` contains only `requestId`, `userId`, `organizationId`, `siteId`, `issuedAt`, `expiresAt`, `prompt`, `allowedToolIntents`, and `audience`.
- The exact-field validator rejects unknown fields, so OAuth tokens, Supabase bearer tokens, credentials, and other undeclared data cannot become envelope fields.
- Request IDs and tenant IDs are limited to 128 characters, prompt to 12,000 characters, audience to 256 characters, and tool intents to 32 unique values of at most 128 characters each.
- Explicit ordered JSON serialization makes the signed body deterministic.
- The canonical request is newline-delimited in this order: protocol version, uppercase HTTP method, path, key ID, canonical issued-at timestamp, nonce, audience, and lowercase SHA-256 body hash.
- HMAC-SHA256 signing uses a current/next keyring. Verification uses `timingSafeEqual` and returns the verified key slot and tenant/request metadata.
- Verification fails closed with stable typed codes for missing/malformed headers, unsupported version, unknown key, malformed or tampered body, method/path/audience mismatch, future issue time, expiration, excessive TTL, malformed body hash, and invalid signature.

## TDD evidence

- RED command: `npm.cmd test -- tests/remote-engine-protocol.test.ts`
- RED result: exit 1; one failed suite because `@/lib/remote-engine-protocol` did not exist. No production module existed at that point.
- GREEN command: `npm.cmd test -- tests/remote-engine-protocol.test.ts`
- GREEN result: 1 file, 20 passed, 0 failed.
- Related command: `npm.cmd test -- tests/engine-adapter.test.ts tests/remote-engine-protocol.test.ts`
- Related result: 2 files, 29 passed, 0 failed.

## Verification

- Strict typecheck: `npm.cmd run typecheck`, exit 0.
- Production build: `npm.cmd run build`, exit 0, static pages 27/27.
- Diff check: `git diff --check`, exit 0 before report creation and rerun in the final gate.
- Runtime wiring search: the module name appears only in its focused test import; no app, route, component, or existing OpenClaw file imports it.
- Full repository test suite was not run; the requested focused and related engine-adapter suites were run.

## Open risks and deferred requirements

Phase 1 intentionally does not store or consume nonces. Verification returns the authenticated nonce, but a future runtime integration must atomically claim it in a durable shared replay store before dispatch. An in-memory replay cache would be unsafe across processes and deployments and is not implemented. Key provisioning, key rotation operations, transport deployment, sidecar enforcement, and end-to-end remote execution remain outside this phase. This artifact does not claim remote demo readiness.
