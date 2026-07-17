# Remote Hermes Service Auth P1 Remediation

## Scope

- Base commit: `8405a6cb6492207cf0c8a4380130e11a8e0b591e`
- Async replay remediation base: `8af5f3313e49f99c1d9aa34a0a8dabcc2eaa78d7`
- DB-free service-auth module and focused tests only
- No production route, migration, provider policy, engine adapter, runtime, or transport contract changes

## Remediation

- Exports a five-minute maximum assertion TTL and a thirty-second maximum future clock skew.
- Enforces `issuedAt <= now + skew`, `now < expiresAt`, and bounded TTL during both creation and verification.
- Makes verification asynchronous and requires an atomic `Promise<boolean>` replay consumer.
- Builds the replay key from organization, site, run, request, attempt, and attempt-envelope digest bindings.
- Passes the binding key, assertion `expiresAt` as `retainUntil`, and an `AbortSignal` to the consumer.
- Bounds replay consumption to one second and rejects false, rejection, timeout, and non-Promise results.
- Rejects replay failures with `SERVICE_AUTH_REPLAY_REJECTED` without exposing callback details, secrets, or signatures.
- Performs signature and expected-binding checks before invoking the replay consumer.
- Contains consumer rejection after timeout without an unhandled rejection or source-error disclosure.

## TDD Evidence

- Time-bound RED: 21 tests, 1 failed because the exported bounds and enforcement were absent.
- Time-bound GREEN: 21 tests passed.
- Replay RED: 25 tests, 3 failed because duplicate/refused/thrown consumption was not enforced.
- Replay GREEN: 25 tests passed, preserving the original 20 tests.
- Async replay RED: 26 tests, 1 failed because `Promise<false>` was treated as truthy and approved.
- Async replay GREEN: 30 tests passed, including retention, timeout, late rejection, and pre-consumption verification order.

## Verification

- `npm.cmd test -- --run tests/remote-hermes-service-auth.test.ts tests/remote-hermes-contract.test.ts tests/remote-engine-protocol.test.ts`
  - 3 test files passed
  - 100 tests passed
- `npm.cmd run typecheck`
  - Passed with TypeScript strict checking
