# KOSHA Commercial Contract Remediation Evidence

## Source Identity

- Branch: `fix/kosha-commercial-contract-remediation`
- Base commit: `3a74107e3d8363f437815b877533f7342fd02c45`
- Product commit: `d120a9235b46d1a2e863ca5364b2e087d521472e`
- Product tree: `31667de4dd2a7799ee303fc390df49d7bc6b61bc`

## Remediation Summary

- Restricted KOSHA supporting evidence parents to SIF cases or non-KOSHA `evidence_role=direct` rows.
- Kept KOSHA technical rows out of independent risk rows and out of "today first action" answer/practical surfaces when no SIF/direct parent exists.
- Preserved `naturalize_only`, improvement memory priority, and mandate-vs-guidance separation.
- Kept verified KOSHA prompt evidence traceable as `technical_guidance_candidate` when parent evidence is missing, and as `technical_guidance_only` when parent evidence is ready.

## RED Evidence

- Initial focused RED before product changes: 3 failing tests.
- Failures covered:
  - KOSHA-only packet surfaced a KOSHA control as an independent action.
  - Non-KOSHA supporting row became a risk-row parent and received KOSHA support.
  - `runAsk` KOSHA-only output surfaced KOSHA action controls instead of stopping at review-required.

## GREEN Evidence

| Check | Result | Log |
| --- | ---: | --- |
| Focused KOSHA/commercial tests | 2 files, 40 tests passed | `focused-tests.log` |
| Integrated group B | 2 files, 14 tests passed | `integrated-kosha-group-b.log` |
| Integrated group C | 4 files, 22 tests passed | `integrated-kosha-group-c.log` |
| Integrated group D | first run 1 failure, rerun 3 files, 130 tests passed | `integrated-kosha-group-d.log`, `integrated-kosha-group-d-rerun.log` |
| Integrated group E | 3 files, 81 tests passed | `integrated-kosha-group-e.log` |
| 12-file KOSHA/commercial group | 12 files, 247 tests passed | groups B-E |
| Typecheck | passed after dependency install restore | `typecheck.log`, `npm-ci.log`, `typecheck-rerun.log` |
| Diff check | exit 0 | `diff-check.log` |

The prior 12-file equivalent group was 244 tests. This branch adds 3 remediation tests, so the same file group now reports 247 tests.

## Scope Integrity

- Changed product/test files only: `lib/search.ts`, `lib/db-harness.ts`, `tests/commercial-harness.test.ts`, `tests/kosha-current-review-run-ask.test.ts`.
- Evidence files are confined to `evaluation/kosha-commercial-contract-remediation-2026-07-14/`.
- No DB, schema, migration, data, package, or lockfile changes were made.
- `npm.cmd ci` restored ignored local `node_modules` only so strict typecheck could resolve existing dependencies.

## Residual Risks

- The first typecheck attempt failed because this worktree had no installed `pdf-lib` or `@pdf-lib/fontkit`; the rerun after `npm.cmd ci` passed.
- `npm.cmd ci` reported existing dependency audit warnings; no dependency upgrades or package/lock changes were performed.
- Full repository test suite and production deployment were not run in this remediation scope.
