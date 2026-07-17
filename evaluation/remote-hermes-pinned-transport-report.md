# Remote Hermes Pinned HTTPS Transport Evaluation

## Scope

Implemented and verified the connection-pinned Node HTTPS transport adapter only. The agent chat route, provider activation, and database schema remain unchanged.

## Security Contract

- Resolves the endpoint hostname once through an injectable resolver.
- Rejects the complete DNS answer set if any result is private, reserved, malformed, or otherwise non-public.
- Selects one validated address and forces the HTTPS socket lookup to that pin with connection reuse disabled.
- Preserves the original hostname for `Host`, TLS SNI, and certificate identity verification.
- Builds `connectedAddress` from the connected socket and requires it to match the selected pin.
- Does not follow redirects; redirect responses and address mismatches cancel their bodies.
- Propagates the caller abort signal through DNS and HTTPS dialing, including cancellation of a body returned after abort.
- Leaves Remote Hermes runtime unavailable when a durable attempt ledger is absent.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Focused Remote Hermes suites | PASS: 4 files, 62 tests | `evaluation/remote-hermes-pinned-transport-tests.log` |
| TypeScript strict typecheck | PASS | `evaluation/remote-hermes-pinned-transport-typecheck.log` |

Total verification elapsed time: 20,347 ms. Failures: 0.
