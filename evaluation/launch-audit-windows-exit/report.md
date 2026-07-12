# SafeClaw Windows Launch Audit Lifecycle Evaluation

- Generated: `2026-07-12T11:06:06.8572701+09:00`
- Branch: `fix/launch-audit-windows-exit`
- Base: `4c2a35ec24a3be4ddb54cfe839c22fd779e55075`
- Runtime: Windows, Node.js `v24.12.0`, libuv `1.51.0`, Undici `7.16.0`
- Verdict: **PASS**

## Root Cause

The audit completed `/api/ask`, wrote a valid report, printed its summary, and then called
`process.exit(...)` synchronously. That forced Node into teardown while fetch/Undici and process
I/O work could still be finishing. Node `v24.12.0` bundles libuv `1.51.0`; in that exact libuv
version, Windows `uv_async_send()` asserts at line 76 when a sender reaches an async handle after
it has been marked closing. The native race surfaced as
`!(handle->flags & UV_HANDLE_CLOSING)` and Windows status `-1073740791` (`0xC0000409`). The HTTP
response was not the failure: the baseline report already recorded `apiAskStatus: 200` and
`apiAskOk: true`.

libuv upstream independently fixed this Windows race in commit
[`ea493f19895b`](https://github.com/libuv/libuv/commit/ea493f19895bc0cc90b28b48a4e204bc139c48d3),
`win: fix race condition in uv_async_send`. The fix blocks new senders and drains in-flight
senders before closing async handles. SafeClaw cannot replace the bundled runtime here, but it
can remove its avoidable trigger: immediate forced process termination.

Node's process documentation explicitly warns that `process.exit()` can terminate before
pending stdout/stderr I/O finishes and recommends setting `process.exitCode` so the event loop
can drain naturally: <https://nodejs.org/api/process.html#processexitcode>.

Calling-shell checks did not independently reproduce the crash: direct Node child execution,
PowerShell PTY execution, and local keep-alive responses all exited normally under the current
runtime. A deterministic delayed-stdout preload did reproduce the underlying lifecycle defect:
the baseline child wrote its JSON report and exited `0`, but emitted zero stdout bytes because
`process.exit()` discarded the queued write. This separates the controllable script bug from
the timing-dependent native assertion.

## Minimal Fix

- Removed the terminal `process.exit(...)` call.
- Awaited the stdout/stderr write callbacks before assigning `process.exitCode`.
- Removed the target report before each run so a timeout cannot leave a stale success artifact.
- Preserved endpoint, request body, HTTP-status exit semantics, timeout configuration,
  malformed-JSON fallback, dispatch opt-in, and output schema.
- Kept dispatch disabled by default; no dispatcher or provider call is added.

## TDD Evidence

RED on the unmodified script:

- `npm.cmd test -- tests/launch-readiness-audit.test.ts`
- Result: 4 tests failed.
- Success, HTTP failure, and malformed-JSON runs had empty stdout after the forced exit.
- Timeout exited nonzero but retained the pre-seeded stale report and emitted an unstructured
  Node stack.

GREEN after the lifecycle fix:

- `npm.cmd test -- tests/launch-readiness-audit.test.ts`
- Result: 1 test file passed, 4 tests passed.
- Success: exit `0`, one stdout JSON object, one valid report.
- HTTP `503`: exit `1`, one stdout JSON object, failure report retained.
- Timeout: exit `1`, one structured stderr JSON object, no stale report.
- Malformed HTTP `200` JSON: exit `0`, one valid audit report with null scenario and false
  document flags, preserving existing HTTP semantics.

## Verification

- Verification log: `evaluation/launch-audit-windows-exit/verification.txt`
- Strict typecheck: `npm.cmd run typecheck` exited `0`.
- Independent fixture E2E: child exit `0`, no signal, deadline not exceeded, stderr `0` bytes,
  stdout JSON objects `1`, output files `1`, `/api/ask` requests `1`, dispatch requests `0`.
- Fixture child closed in `627 ms`; the harness then closed all loopback sockets and removed its
  temporary directory.
- Secret-bearing environment names were removed from fixture children, fixture cwd contained no
  `.env`, and every HTTP request stayed on `127.0.0.1`.
- No DB access, schema change, real dispatch, paid provider call, main worktree edit, or other
  worktree edit occurred.

## Residual Runtime Caveat

The exact native assertion is timing-sensitive and did not fire for every fast local response on
Node.js `v24.12.0`. The deterministic regression therefore tests the unsafe forced-exit boundary
through queued process I/O while still running the real audit script against a real loopback HTTP
server. The fix does not suppress the assertion or force another exit: it removes this script's
teardown trigger and lets Node close its fetch and stream handles naturally. Other programs that
force teardown on a Node build still bundling libuv `1.51.0` retain the upstream runtime caveat.
