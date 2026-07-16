# Remote Hermes Adapter TDD Evidence

Date: 2026-07-16
Base commit: `ce211b10f53470a95432284613fbb00d47f115de`
Branch: `feat/remote-hermes-adapter-20260716`

## Scope

Implemented a single-attempt, tool-free remote Hermes naturalizer behind the
existing SafeClaw `EngineAdapter`. The implementation does not add a database
migration, queue, retry loop, effectful tool, production credential, rollout
allowlist value, deployment, or production promotion.

## RED Evidence

The following tests were observed failing before their corresponding behavior
was implemented:

1. `tests/remote-hermes-contract.test.ts`: module not found for the closed
   prompt/claims projection contract.
2. `tests/remote-hermes-contract.test.ts`: attempt-envelope builder missing.
3. `tests/remote-hermes-contract.test.ts`: replay guard and signed response
   validator missing.
4. `tests/remote-hermes-runtime.test.ts`: remote runtime module missing.
5. `tests/remote-hermes-route.test.ts`: `remote-hermes` resolved to the
   unavailable adapter.
6. `tests/remote-hermes-route.test.ts`: readiness policy classified the remote
   mode as unsupported.
7. `tests/remote-hermes-contract.test.ts`: PII-shaped claim text was initially
   accepted instead of failing before attempt creation.

The independent review of `f73bc70` then produced a second RED cycle:

8. A fully configured adapter remained available without any signed remote
   policy attestation.
9. An attested HTTPS IP-literal endpoint was accepted.
10. Fetch did not set `redirect="error"`.
11. Arbitrary claim text and display labels still crossed the boundary.
12. Response size was checked only after buffering and the deadline ended when
    response headers arrived.
13. Process-local replay state was unbounded and had no TTL cleanup.
14. Readiness accepted URL forms that runtime normalization rejected.

## GREEN Evidence

- Focused remote and existing Hermes/OpenClaw/provider suite:
  `10` test files passed, `182` tests passed, `0` failed.
- New remote suite contribution:
  `3` test files, `27` tests.
- Existing focused regression contribution:
  `7` test files, `155` tests.
- Strict typecheck: `npm.cmd run typecheck` exited `0`.
- Production build: `npm.cmd run build` exited `0`; Next.js compiled,
  type-checked, generated `28/28` static pages, and completed build traces.
- Diff whitespace check: `git diff --check` reported no errors.

## Contract Evidence

- Outbound bodies contain only closed prompt intent enums, tenant bindings,
  opaque actor/run identifiers, and allowlisted public claim/citation
  projections with complete scalar-leaf classifications.
- Raw or normalized prompts, the Evidence packet, tenant/site memory, photos,
  tool schemas, MCP tokens, Supabase credentials, and OAuth material are not
  represented in the outbound DTO.
- Claim text and display labels are not fields in the remote DTO. Only verified
  public claim/citation IDs, a closed claim kind, closed source-label code,
  public provenance class, and non-reversible source digest cross the boundary.
- Unclassified upstream claims fail before network access. Exact-schema attack
  tests reject attempted name, address, account, passport, foreign-registration,
  and site-identifier strings rather than claiming regex proves arbitrary text safe.
- Logical request digests are stable across attempts; request, attempt, nonce,
  timestamp, attempt digest, and request signature are attempt-specific.
- Responses are closed success/failure unions. Validation covers tenant and
  attempt bindings, expiry, digest, service receipt signature, replay,
  allowlisted selected claim/citation IDs, usage shape, and the versioned error
  taxonomy.
- Missing endpoint, hostname allowlist, tenant allowlist, signer, or signed
  policy attestation creates an unavailable adapter and produces zero network
  calls. Signed policy attestations must bind the expected service/origin and
  prove `allow=[]`, `deny=["*"]`, required preflight, durable ledger, and
  durable replay modes.
- URL policy is shared by runtime/readiness. IP literals, localhost/private
  names, private/link-local/reserved DNS results, DNS result changes, and HTTP
  redirects are rejected.
- The single deadline covers fetch and streamed body consumption. The reader
  enforces the byte cap before retaining each chunk and is cancelled on cap or
  abort.
- Remote composition advertises only `stream_text`; planner tool requests are
  denied. Accepted selections are converted to the existing
  `hermes-output-attestation/v1` path for SafeClaw-owned rendering.
- SafeClaw authority remains `canMutate=false`, `canPublish=false`, and
  `humanConfirmationRequired=true`. Remote failures do not select a local
  fallback and the runtime performs exactly one fetch attempt.

## Honest Limitations

- The local replay cache is process-local, TTL-bounded, and size-bounded. It is
  not multi-instance replay protection. Readiness remains closed unless the
  signed remote attestation declares durable ledger and replay modes; no local
  durable store was added because no database or queue was authorized.
- Signing uses configured HMAC material. KMS/workload identity and remote
  service deployment are outside this change.
- No live remote gateway was available, so transport interoperability is
  verified with signed in-process HTTP fixtures rather than a deployed probe.
- Native fetch does not expose a portable TLS-hostname-preserving IP pin in this
  code path. Public DNS is checked immediately before and after fetch and any
  change rejects the response, but this is not equivalent to transport-level
  DNS pinning.
- The prompt projection is intentionally fixed to the first bounded Korean
  safety-chat naturalization intent.
- The signed policy receipt uses configured HMAC verification material; it is
  not an online challenge, KMS-backed asymmetric attestation, or live service
  identity probe.
- No environment values were populated and no production traffic was enabled.
