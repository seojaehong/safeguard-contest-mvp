# Remote Hermes Service Auth P1 Remediation

## Scope

- Base commit: `8405a6cb6492207cf0c8a4380130e11a8e0b591e`
- DB-free service-auth module and focused tests only
- No production route, migration, provider policy, engine adapter, runtime, or transport contract changes

## Remediation

- Exports a five-minute maximum assertion TTL and a thirty-second maximum future clock skew.
- Enforces `issuedAt <= now + skew`, `now < expiresAt`, and bounded TTL during both creation and verification.
- Requires verification callers to inject an atomic replay consumer.
- Builds the replay key from organization, site, run, request, attempt, and attempt-envelope digest bindings.
- Rejects duplicate consumption, consumer refusal, and consumer exceptions with `SERVICE_AUTH_REPLAY_REJECTED` without exposing callback details, secrets, or signatures.

## TDD Evidence

- Time-bound RED: 21 tests, 1 failed because the exported bounds and enforcement were absent.
- Time-bound GREEN: 21 tests passed.
- Replay RED: 25 tests, 3 failed because duplicate/refused/thrown consumption was not enforced.
- Replay GREEN: 25 tests passed, preserving the original 20 tests.

## Verification

- `npm.cmd test -- --run tests/remote-hermes-service-auth.test.ts tests/remote-hermes-contract.test.ts tests/remote-engine-protocol.test.ts`
  - 3 test files passed
  - 95 tests passed
- `npm.cmd run typecheck`
  - Passed with TypeScript strict checking
