# Remote OpenClaw Signed Protocol Phase 1

## Scope and disposition

The fresh security review finding set is remediated within the pure Node protocol module and its focused tests. No engine selection, runtime route, MCP, existing OpenClaw file, UI, database, schema, environment, or sidecar repository is wired or changed. Runtime remains disabled and unchanged. `remoteDemoReady` remains `false`.

## Security controls

- Verifier policy overrides must be positive safe integers and may only tighten the hard 60-second future-skew and 300-second TTL limits. `NaN`, infinities, zero, negatives, fractions, and values above the hard limits fail with `PROTOCOL_POLICY_INVALID` before temporal comparisons.
- Raw bodies are limited to 16,384 UTF-8 bytes before header access, hashing, key selection, or JSON parsing. Signing applies the same byte limit before hashing, including multi-byte prompts.
- Headers are snapshotted once into a lowercase map. All raw headers are limited to 32 entries and 8,192 aggregate UTF-8 name/value bytes before hashing or key selection.
- Case-insensitive duplicate protocol headers fail with `PROTOCOL_HEADER_DUPLICATE`. Record aliases/arrays and WHATWG `Headers` comma-coalesced duplicates are covered.
- Methods are exact uppercase ASCII tokens. They are never case-normalized.
- Paths are path-only ASCII segments. Root is allowed; every other segment is non-empty and limited to ASCII unreserved characters. Dot segments, duplicate/trailing slashes, query, fragment, backslash, NUL/control characters, all percent encoding, and all Unicode forms are rejected. Signer, signed headers, and verifier transport input use the same validators.
- A bounded duplicate-aware JSON scanner validates the full JSON grammar and decoded object-member names before whole-object `JSON.parse`, preventing last-wins member ambiguity.
- Current/next key IDs must differ. A colliding rotation configuration fails with `PROTOCOL_KEYRING_INVALID` without trying either key.
- The exact-field body validator rejects OAuth, Supabase bearer, credential, and other unknown envelope fields after a correctly re-signed body passes hash/signature checks.
- HMAC-SHA256 still uses exact 32-byte digest comparison through `timingSafeEqual`. A fixed body-hash and HMAC known-answer vector is asserted independently of self sign/verify behavior.

## Auditable RED provenance

- Test-only commit: `b65e70de72d73cd4d314b65f18bc91e732c3822f`
- Test-only tree: `f7d6e7dfa267682a06ebfcc87adee9f07f00c12d`
- Production parent: `97b30076779d798544353f713afe911804c8a0d5`
- Command: `npm.cmd test -- tests/remote-engine-protocol.test.ts`
- Result on that exact tree: exit 1; 1 failed file; 32 failed and 22 passed of 54 tests.
- Raw output: `red-security-review.stdout.log`, Git blob `7abf3c09f5362bdd73090f4349e42e08d70df1a3`.
- Structured provenance: `red-security-review.provenance.json`.

The failures cover invalid numeric policy, unsigned and correctly signed oversized bodies, multi-byte signer overflow, header budgets, repeated Record scans, non-canonical method/path inputs, duplicate Record/Headers protocol fields, duplicate JSON members, and colliding key IDs. The fixed known-answer vector and correctly re-signed unknown-field control are test corrections rather than manufactured failures.

## GREEN and repository verification

- Focused GREEN: `npm.cmd test -- tests/remote-engine-protocol.test.ts`, 1 file, 54 passed, 0 failed. Raw log: `green-security-review.stdout.log`.
- Related engine tests: `npm.cmd test -- tests/engine-adapter.test.ts tests/remote-engine-protocol.test.ts`, 2 files, 63 passed, 0 failed. Raw log: `related-engine-tests.stdout.log`.
- Strict typecheck: `npm.cmd run typecheck`, exit 0. Raw log: `typecheck-security-review.stdout.log`.
- One sequential production build: `npm.cmd run build`, exit 0, static pages 27/27. Raw log: `build-security-review.stdout.log`.
- Final staged whitespace/scope checks and remote SHA equality are recorded in the final handoff after commit/push.
- The complete repository test suite was not run; the requested focused and related engine-adapter suites were run.

## Fresh re-review

The final candidate was retraced from untrusted raw body/header input through budget gates, canonical transport binding, body hash, unique key selection, constant-time signature verification, duplicate-aware JSON validation, exact envelope validation, and temporal policy. Alternate inputs reviewed include multi-byte bodies, Record and WHATWG header representations, lowercase/full-width method forms, composed/decomposed Unicode paths, percent escapes, dot/empty segments, and signed unknown/duplicate JSON fields. No bypass in the reported finding set remains in this pure module.

## Open risks and deferred requirements

Phase 1 intentionally does not store or consume nonces. Verification exposes the authenticated nonce, but future runtime integration must atomically claim it in a durable shared replay store before dispatch. In-memory replay prevention remains intentionally absent. Key provisioning, operational rotation, transport deployment, sidecar enforcement, and end-to-end remote execution remain outside Phase 1. This artifact does not claim remote demo readiness.
