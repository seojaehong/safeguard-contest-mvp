# Remote Hermes Terminal Ledger Contract

## Scope

- Requested base: `56cb66f1405c49e18e88f583a95025b13f09c40d`
- Final rebase and verification base: `6b2c1d936de1b47684436c18f7335a6eae40556d`
- Branch: `feat/remote-hermes-terminal-ledger`
- Product boundary: contract and runtime only
- Explicit exclusions: customer route wiring, database persistence, migrations, provider policy

## Implemented Contract

- Exported `RemoteHermesUsage` and immutable `RemoteHermesTerminalRecord` types.
- Extended `RemoteHermesAttemptLedger` with `recordTerminal(record, signal)`.
- Enforced `reserve -> trusted transport -> signed response validation without replay consumption -> terminal record -> local replay commit -> emitText`.
- Persisted organization, site, run, request, attempt, logical request, attempt envelope, and response envelope identifiers/digests with usage and latency.
- Recorded signed remote failures with only validated error code, origin, and an optional fixed-form `diag_` plus 64 lowercase hexadecimal digest reference before failing closed.
- Recorded post-reserve transport, connection, HTTP, body, JSON, and signature/response validation failures as sanitized gateway terminal failures.
- Closed post-reserve timeout and caller-abort failures through a separate two-second terminal-persistence deadline, never the already-aborted execution signal.
- Preserved the original timeout, transport, or validation `BrokerError` classification when terminal persistence failed or returned `duplicate`, while attaching both errors as an `AggregateError` cause.
- Constructed a validated signed remote failure as `ENGINE_EXECUTION_FAILED` before terminal persistence; ledger errors, deadlines, and duplicates preserve that original classification with terminal evidence attached as an `AggregateError` cause.
- Blocked output when terminal persistence fails.
- Kept a signed response retryable when terminal persistence fails because replay state is not consumed before the durable write succeeds.
- Required `recordTerminal` to return `recorded` or `duplicate`; duplicate always fails closed without output.
- Rejected runtime construction when the injected ledger does not implement both `reserve` and `recordTerminal`.
- Prevented a repeated signed response from producing another output after the durable ledger returns `duplicate`. This does not claim the provider or transport was blocked before invocation.
- Locked the remote adapter to `stream_text` with no read, mutation, publication, effect, or approval capability.

## TDD Evidence

- Initial RED: 2 files, 72 tests; 3 expected terminal-ledger failures.
- Contract-completeness RED: reserve-only ledger runtime was incorrectly created.
- Review remediation RED: 2 files, 35 tests; 7 expected failures covering replay timing and five post-reserve failure phases.
- Second review RED: 2 files, 48 tests; 10 expected failures covering opaque diagnostics, independent terminal-close signaling, and original gateway error preservation. The pre-fix timer reuse also produced two unhandled timeout rejections.
- Third review RED: 1 file, 40 tests; 2 expected failures proving signed remote failures were masked by terminal ledger errors and duplicates.
- Final P3 coverage: extended the same signed-failure terminal table with a hanging ledger. The existing bounded deadline preserved `ENGINE_EXECUTION_FAILED`, attached terminal-timeout evidence, emitted nothing, and left zero fake timers without production changes.
- Final command: `npm.cmd test -- tests/remote-hermes-contract.test.ts tests/remote-hermes-runtime.test.ts tests/remote-hermes-route.test.ts tests/remote-hermes-https-transport.test.ts tests/hermes-engine-adapter.test.ts tests/claw-chat-route.test.ts`
- Final focused suite files:
  - `tests/remote-hermes-contract.test.ts`
  - `tests/remote-hermes-runtime.test.ts`
  - `tests/remote-hermes-route.test.ts`
  - `tests/remote-hermes-https-transport.test.ts`
  - `tests/hermes-engine-adapter.test.ts`
  - `tests/claw-chat-route.test.ts`
- Final focused result: 6 files, 159 tests passed.
- Strict TypeScript: passed.
- Production build: not rerun for the final test-and-report-only P3; the last production-source build passed with 28 static pages and this commit changes no production source.
- Dependency synchronization: `npm.cmd install`; package and lock files unchanged.

## Remaining Blockers

- No durable database-backed ledger implementation is connected.
- No customer-visible route uses the remote runtime.
- Cross-instance replay protection still requires the future durable ledger implementation.
- Workload identity, key rotation, and production gateway interoperability remain unverified.
- Human approval receipts are still required before any future effectful tool, write, dispatch, or publication capability.

## Decision

This slice is ready as a non-runnable contract boundary. It does not make Remote Hermes customer-visible and does not authorize database or provider changes.
