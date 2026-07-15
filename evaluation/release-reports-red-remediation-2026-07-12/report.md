# Reports release RED remediation

- Branch: `fix/release-reports-red-remediation`
- Base: `a1dbedb64e177a4909584274eaad87484aa732f4`
- Scope: Reports test fixture and evaluation evidence only
- Product code changes: none
- Result: PASS after review remediation

## Root cause

The failed full-suite test did not reveal an optimistic export path. The local
workpack fixture used a fixed `2026-07-10` timestamp while the product correctly
filters the default report to the current KST week. Once that timestamp moved
outside the active week, the explicit browser-local switch settled to
`data-download-readiness="empty"` and all five export buttons remained disabled.

The first correction replaced the stale timestamp and waited on the real
`ready` state. Independent review then found a remaining boundary flake: fixture
creation and browser rendering could still straddle Monday 00:00 KST.

## Review remediation

The regression now uses one fixed midweek reference instant for both sides of
the contract:

- the stored workpack receives the same RFC3339 `savedAt` value;
- Playwright fixes the browser `Date` to that instant before navigation;
- the test still begins in the blocked no-session server state;
- exports are checked only after the explicit local switch reaches the real
  `data-download-readiness="ready"` condition.

`week-boundary-red.log` proves the test fails when the browser clock is fixed
but the workpack retains a mismatched real-time timestamp. The matching
`week-boundary-green.log` proves the shared reference instant closes that gap.
No arbitrary sleep or product-side bypass was added.

## Fail-closed preservation

The four-file reporting suite confirms:

- no-session server authority remains blocking before an explicit switch;
- HTTP 401 and 404 responses remain blocked without a valid local workpack;
- malformed server payloads do not expose local exports;
- all five exports remain disabled for empty or invalid report snapshots;
- a validated local workpack becomes available only after an explicit switch.

## Verification

| Gate | Result |
| --- | --- |
| Boundary RED | expected exit 1, `ready` selector timed out |
| Boundary GREEN | `1/1` selected test passed |
| Main focused review | `1/1` selected test passed |
| All reporting tests | `4/4` files, `71/71` tests passed |
| Strict typecheck | exit 0 |

Evidence:

- `week-boundary-red.log`
- `week-boundary-green.log`
- `main-focused-review.log`
- `reporting-tests-review-remediation.log`
- `typecheck-review-remediation.log`

## Changed files

- `tests/reports-download-center.test.ts`
- `evaluation/release-reports-red-remediation-2026-07-12/*`
