# Remote Hermes Adapter TDD Evidence

Date: 2026-07-17

Base commit: `ce211b10f53470a95432284613fbb00d47f115de`

Branch: `feat/remote-hermes-adapter-20260716`

Reviewed candidate: `950db2117e1d0ebc75c8584184da80d235bfaece`

## Verdict

The remote Hermes contract is implemented as an experimental, fail-closed
adapter boundary. The production `/api/agent/chat` route does not inject a
trusted transport or durable attempt ledger, so `remote-hermes` remains
unavailable and performs zero network calls.

This change does not deploy a Hermes worker, enable production traffic, add a
database migration, write a credential, widen MCP authority, or publish
ontology data.

## Runtime Contract

- Environment configuration can validate the remote contract but cannot create
  a runnable runtime by itself.
- Runtime construction requires both an injected `RemoteHermesTrustedTransport`
  and an injected `RemoteHermesAttemptLedger`.
- The ledger reserves the signed attempt before dispatch and returns a receipt
  bound to the attempt digest and reservation time.
- Ledger reservation, transport dispatch, and streamed body consumption share
  the same caller/deadline abort boundary.
- The trusted transport must report the expected endpoint origin, actual
  connected origin/address, zero redirects, service identity, and policy
  attestation digest. Private, reserved, link-local, documentation, and
  IPv4-mapped private IPv6 addresses fail closed.
- Invalid connection reports cancel the response body before rejection.
- Responses bind the attempt-ledger receipt digest inside the signed response
  envelope and are rejected at the exact attempt expiry boundary.
- Process-local response replay state remains bounded by count and TTL, while
  the signed policy requires the external service to declare durable ledger and
  replay behavior.

## Evidence Harness Boundary

- The outbound DTO contains only closed prompt intent enums, tenant bindings,
  opaque actor/run identifiers, and allowlisted public claim/citation
  projections.
- Raw prompts, worker identity data, phone numbers, site labels, evidence body
  text, photos, workpack memory, OAuth material, Supabase material, MCP tokens,
  and tool schemas are not outbound fields.
- Only the exact production SIF archive identifier
  `kosha-sif-archive-20260401` can become a remote public SIF claim.
  Similar-looking, legacy, or unverified source IDs are excluded from remote
  execution.
- Every excluded SIF is recorded in the local planner input as an opaque
  reference digest plus `remote_sif_source_not_verified`; raw source IDs are
  not added to the remote DTO.
- KOSHA controls require the existing production exact-trust predicate.
- Unclassified claims fail before ledger reservation or transport dispatch.
- Remote Hermes remains `naturalize_only`, `toolPolicy=deny-all`,
  `canMutate=false`, `canPublish=false`, and
  `humanConfirmationRequired=true`.

## TDD Evidence

RED cases reproduced during the final remediation:

1. The production SIF source `kosha-sif-archive-20260401` was not recognized.
2. Readiness reported `remote-evaluation-ready` without a trusted transport or
   durable ledger.
3. Response validation did not bind an attempt-ledger receipt.
4. A receipt reserved before attempt issuance was accepted.
5. An IPv4-mapped private IPv6 connection report was accepted.
6. A pending ledger reservation could outlive the caller deadline.
7. Earlier test rewriting removed response-size, streamed-deadline, and outbound
   PII regression coverage; those tests were restored.

Final local gates:

- Focused Hermes/OpenClaw/provider suite: `10` files, `197` tests PASS.
- Core remote suite: `4` files, `92` tests PASS.
- Strict TypeScript: PASS.
- Production build: PASS, `28/28` static pages generated.
- `git diff --check`: PASS apart from line-ending conversion warnings.

Independent review of the reviewed candidate and its working-tree evidence:
SPEC PASS / CODE PASS, P0-P3 findings `0`.

## Readiness Presentation

`assessEngineRuntimeReadiness()` now separates contract readiness from execution
readiness. A valid signed configuration returns `remote-contract-ready`,
`contractReady=true`, `executionReady=false`, and explicit missing runtime
dependencies. The operations page presents this as `실행 계층 연결 필요`, not
as a runnable or locally attested engine.

## Honest Limitations

- No production implementation of the connection-pinned transport or durable
  attempt ledger is included. Therefore production execution intentionally
  remains disabled.
- The injected transport and ledger are trusted infrastructure boundaries. A
  future implementation must provide its own integration tests against the
  actual connection metadata and durable store before rollout.
- HMAC material is configuration-based. KMS/workload identity, key rotation,
  queueing, resume/failover, and multi-instance replay verification remain
  Phase B work.
- No live remote gateway probe was run.
- No environment values or production rollout allowlists were populated.
