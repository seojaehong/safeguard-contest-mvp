# Remote Hermes Pinned HTTPS Transport Evaluation

## Scope

Implemented and verified the connection-pinned Node HTTPS transport adapter only. The agent chat route, provider activation, and database schema remain unchanged.

The independent-review HOLD items were remediated for re-review. This report does not claim independent acceptance.

## Security Contract

- Resolves the endpoint hostname once through an injectable resolver.
- Rejects the complete DNS answer set if any result is private, reserved, malformed, or otherwise non-public.
- Selects one validated address and forces the HTTPS socket lookup to that pin with connection reuse disabled.
- Preserves the original hostname for `Host`, TLS SNI, and certificate identity verification.
- Builds `connectedAddress` from the connected socket and requires it to match the selected pin.
- Does not follow redirects; redirect responses and address mismatches cancel their bodies.
- Propagates the caller abort signal through DNS and HTTPS dialing, including cancellation of a body returned after abort.
- Leaves Remote Hermes runtime unavailable when a durable attempt ledger is absent.

## HOLD Remediation

- `REMOTE_HERMES_MAX_OUTBOUND_BODY_BYTES` is `32,768` UTF-8 bytes, aligned to the existing `REMOTE_HERMES_MAX_ENVELOPE_BYTES` runtime constraint.
- The exact outbound boundary is accepted. A multibyte UTF-8 over-boundary body is rejected before resolver or dial invocation.
- The production-default Node dial still uses `https.request` and `tls.checkServerIdentity`. Its request-factory seam verifies the pinned lookup callback, original `Host`, TLS SNI, certificate hostname, and socket-derived `remoteAddress` without external network access.
- The ledger gate uses a valid signed environment and trusted transport. A control assertion creates the runtime when a ledger is supplied, while omitting only the ledger keeps it unavailable.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Focused Remote Hermes suites | PASS: 4 files, 65 tests | `evaluation/remote-hermes-pinned-transport-tests.log` |
| TypeScript strict typecheck | PASS | `evaluation/remote-hermes-pinned-transport-typecheck.log` |

Total verification elapsed time: 22,508 ms. Failures: 0.
