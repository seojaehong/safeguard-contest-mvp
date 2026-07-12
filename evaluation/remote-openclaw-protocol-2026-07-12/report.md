# Remote OpenClaw Signed Protocol Phase 1

## Scope and disposition

The approved source final `1ad409f6a2f896b333777b8ab950a613178de21d` was rebased from original base `3b0edfe48c29e603f3156440362fca9304ef4d1a` onto current authoritative backend-harness base `31a44c0d972c46a47c94ad387eeeff39528d1be9`; the rebased protocol final is `0c3cbe246a208306e62913907ac3ff33f744750c`. The third independent review is SPEC PASS and CODE PASS with P0-P3 findings 0. No engine selection, runtime route, MCP, existing OpenClaw file, UI, database, schema, environment, or sidecar repository is wired or changed. Runtime remains disabled and unchanged. `remoteDemoReady` remains `false`.

## Current security controls

- A portable UTF-16 scanner rejects unpaired high and low surrogates with `PROTOCOL_UNICODE_INVALID` before body byte measurement, hashing, signing, or verification. Signer envelope fields, tool intents, string keys, raw verifier bodies, and decoded envelope values use the same check. Valid surrogate pairs remain accepted.
- Verifier policy defaults apply only when an option is `undefined`. Runtime `null`, non-number values, `NaN`, infinities, zero, negatives, fractions, and values above the hard limit fail with `PROTOCOL_POLICY_INVALID` before temporal comparisons.
- Raw bodies remain limited to 16,384 UTF-8 bytes before header access, hashing, key selection, or JSON parsing.
- `RemoteEngineRawHeader[]` preserves pre-fold header lines and enforces a 32-line limit plus the 8,192-byte aggregate limit before hashing or key selection. Case-insensitive duplicate protocol lines fail closed.
- WHATWG `Headers` is explicitly a folded representation. Its mode enforces at most 32 unique normalized entries and 8,192 aggregate UTF-8 name/value bytes after folding. It does not and cannot claim the original raw line count. Any future transport adapter requiring a raw-line limit must enforce that limit before constructing `Headers`, or pass raw tuples instead.
- Record input enforces at most 32 normalized enumerable entries; explicit string-array values are counted individually. It does not claim to reconstruct already folded transport lines.
- Methods remain exact uppercase ASCII tokens. Paths remain path-only ASCII segments without empty/dot segments, query, fragment, backslash, controls, percent encoding, or Unicode.
- Duplicate-aware JSON validation, exact envelope fields, current/next key-ID uniqueness, SHA-256 body hashing, the fixed HMAC-SHA256 known-answer vector, and exact 32-byte `timingSafeEqual` signature comparison remain unchanged.

## Auditable RED provenance

- Production parent: `c3fa528fbd2ac90e07c67e9d63c9d636ab04fc3c`
- Test-only commit: `6086418e832243d10d63ceacd2b409c7fbb75ed9`
- Test-only tree: `277f480d25b9b60ac246794796da1c43855f50e4`
- Command: `npm.cmd test -- tests/remote-engine-protocol.test.ts`
- Result on that exact tree: exit 1; 1 failed file; 4 failed and 56 passed of 60 tests.
- Failing families: runtime `null` policy values, D800/D801 UTF-8 hash/HMAC reuse, and raw tuple-list interpretation/counting.
- Raw output: `red-security-review.stdout.log`, Git blob `63c8936b04f21df31a1a12f5313102650e1dfa26`.
- Structured provenance: `red-security-review.provenance.json`.
- The original RED commits, tree, command, result, and raw-log blob above are preserved unchanged; the structured provenance also records the original approved base, current integration base, approved source final, and rebased protocol final.

## GREEN and repository verification

- Focused GREEN: `npm.cmd test -- tests/remote-engine-protocol.test.ts`, 1 file, 60 passed, 0 failed. Raw log: `green-security-review.stdout.log`, Git blob `5d3895959292072f485e71e9844b09e00e01538b`.
- Related engine tests: `npm.cmd test -- tests/engine-adapter.test.ts tests/remote-engine-protocol.test.ts`, 2 files, 69 passed, 0 failed. Raw log: `related-engine-tests.stdout.log`, Git blob `44b947c558e09261226fcc97c527d40df767c7d6`.
- Strict typecheck: `npm.cmd run typecheck`, exit 0. Raw log: `typecheck-security-review.stdout.log`, Git blob `b60052d6022e1d3c1b1ddc772e194ff4e4de384b`.
- One sequential production build: `npm.cmd run build`, exit 0, static pages 27/27, with 0 global `next build` processes immediately before start. Raw log: `build-security-review.stdout.log`, Git blob `cfc986957177f579c463423d881185b8e7a66fd9`.
- Current-base diff scope passed with 11 changed files, and runtime import/call references are 0.
- The complete repository test suite was not run; the requested focused and related engine-adapter suites were run.

## Review handoff

The current candidate carries no prior blanket bypass-count assertion. The second-review reproducers fail closed while valid paired Unicode, undefined defaults, bounded raw tuples, folded WHATWG headers, both rotation slots, and the security KAT remain green. The third independent review recorded SPEC PASS and CODE PASS with P0-P3 findings 0.

## Open risks and deferred requirements

Phase 1 intentionally does not store or consume nonces. Verification exposes the authenticated nonce, but future runtime integration must atomically claim it in a durable shared replay store before dispatch. In-memory replay prevention remains intentionally absent. Key provisioning, operational rotation, transport deployment, sidecar enforcement, and end-to-end remote execution remain outside Phase 1. This artifact does not claim remote demo readiness.
