# Remote Hermes Terminal Ledger Contract

## Scope

- Base: `56cb66f1405c49e18e88f583a95025b13f09c40d`
- Branch: `feat/remote-hermes-terminal-ledger`
- Product boundary: contract and runtime only
- Explicit exclusions: customer route wiring, database persistence, migrations, provider policy

## Implemented Contract

- Exported `RemoteHermesUsage` and immutable `RemoteHermesTerminalRecord` types.
- Extended `RemoteHermesAttemptLedger` with `recordTerminal(record, signal)`.
- Enforced `reserve -> trusted transport -> signed response validation -> terminal record -> emitText`.
- Persisted organization, site, run, request, attempt, logical request, attempt envelope, and response envelope identifiers/digests with usage and latency.
- Recorded signed remote failures with only validated error code, origin, and optional opaque diagnostics reference before failing closed.
- Blocked output when terminal persistence fails.
- Rejected runtime construction when the injected ledger does not implement both `reserve` and `recordTerminal`.
- Preserved replay rejection so a repeated signed response cannot produce a second terminal record or output.
- Locked the remote adapter to `stream_text` with no read, mutation, publication, effect, or approval capability.

## TDD Evidence

- Initial RED: 2 files, 72 tests; 3 expected terminal-ledger failures.
- Contract-completeness RED: reserve-only ledger runtime was incorrectly created.
- Final focused suite: 6 files, 138 tests passed.
- Strict TypeScript: passed.
- Production build: passed; 28 static pages generated.
- Dependency synchronization: `npm.cmd install`; package and lock files unchanged.

## Remaining Blockers

- No durable database-backed ledger implementation is connected.
- No customer-visible route uses the remote runtime.
- Cross-instance replay protection still requires the future durable ledger implementation.
- Workload identity, key rotation, and production gateway interoperability remain unverified.
- Human approval receipts are still required before any future effectful tool, write, dispatch, or publication capability.

## Decision

This slice is ready as a non-runnable contract boundary. It does not make Remote Hermes customer-visible and does not authorize database or provider changes.
