# Reports release RED remediation

- Branch: `fix/release-reports-red-remediation`
- Exact base: `a1dbedb64e177a4909584274eaad87484aa732f4`
- Scope: Reports test-owned files and evaluation evidence only
- Result: PASS

## Root cause

This was not a render timing race. Two diagnostic RED runs reached the same settled state after the explicit local switch:

- provenance: `browser_local`
- local marker: visible
- server error panel: removed
- download readiness: `empty`
- disabled exports: `5/5`
- readiness detail: `No report matches the selected conditions`

The local workpack passed `inspectStoredCurrentWorkpack`, but the browser fixture overrode `savedAt` with `2026-07-10T08:00:00.000Z`. Once the KST weekly boundary advanced, `buildReportSnapshot` correctly excluded that workpack from the default weekly report. The test therefore described a current local workpack while supplying a prior-period timestamp.

## Remediation

The browser fixture now preserves the real current-workpack contract by retaining the builder-generated current RFC3339 timestamp. After switching, the test waits on the real `data-download-readiness="ready"` condition before asserting that all five exports are enabled. No arbitrary sleep was added, and no production Reports logic changed.

## Fail-closed preservation

Initial server authority remains blocking:

- no-session: the server error panel is visible, local data is not exposed, and all five exports are disabled before explicit switch
- HTTP 401: blocked with no local switch when no valid local workpack exists
- HTTP 404: blocked with no local switch when no valid local workpack exists
- malformed legacy payload: blocked without exposing local data or exports

The full reporting run also retained sample-preview download blocking and reporting helper validation. Exports become available only after an explicit switch to a validated, current-period local workpack whose snapshot resolves to `ready`.

## Verification

| Gate | Result |
| --- | --- |
| Diagnostic RED run 1 | exit 1, readiness `empty`, exports disabled `5/5` |
| Diagnostic RED run 2 | exit 1, same settled state |
| Focused GREEN run 1 | exit 0, `1/1` selected test |
| Focused GREEN run 2 | exit 0, `1/1` selected test |
| All reporting tests | exit 0, `4/4` files, `71/71` tests |
| Strict typecheck | exit 0 |

Fresh command logs:

- `focused-pass-1.log`
- `focused-pass-2.log`
- `reporting-tests.log`
- `typecheck.log`

## Git sync

`git fetch origin --prune` completed successfully and confirmed that the remediation branch did not yet exist on the remote. An explicit `git pull --rebase origin feat/backend-release-integration-v2` attempted to replay the local integration history and stopped on conflicts in files outside this task's ownership, including `app/globals.css`. The rebase was aborted without resolving or staging any conflict. HEAD and its parent were restored exactly to the remediation commit and requested base, so the branch is published as a new non-force push without rewriting the authoritative local base.

## Changed files

- `tests/reports-download-center.test.ts`
- `evaluation/release-reports-red-remediation-2026-07-12/report.md`
- `evaluation/release-reports-red-remediation-2026-07-12/report.json`
