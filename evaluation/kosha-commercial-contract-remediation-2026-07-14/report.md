# KOSHA Commercial Contract Remediation v2 Evidence

## Source Identity

- Branch: `fix/kosha-commercial-contract-remediation`
- Starting HEAD and product parent: `049debe47cf6d18e923bb5c91e5fafd8d07c885b`
- Product commit: `7e7910ac475a1e726013f748f73717e380b3657e`
- Product tree: `4c02eb011138234930d39c7aa29c1c24c690add7`
- Authoritative main base for eventual integration: `c6b493c6a780c65776fa1c592871da743f65c618`

## TDD RED Evidence

- `red-v2.log`: 43 focused tests executed before the product fix; 5 failed and 38 passed.
- `red-provenance-v2.log`: the added provider/provenance boundary assertion failed before the final product fix; 1 failed and 42 passed.
- The RED assertions cover complete absence of standalone `structured.riskAssessmentRows`, controls, today actions, and KOSHA body/control citation material when no SIF or direct non-KOSHA parent is ready.

## Product Remediation

- Parentless KOSHA-only packets remain `review_required` and cannot receive AI rows, deterministic fallback rows, controls, TBM risk links, or immediate/today actions.
- Required KOSHA body citations now require parent readiness from a SIF case or a non-KOSHA `evidence_role=direct` record.
- Parentless verified KOSHA metadata is exposed only as bounded `technical_guidance_candidate` metadata without body excerpts, detailed provenance references, or action-bearing text.
- Provider invocation and prompt-boundary tests now assert that excluded KOSHA body/control text never reaches the provider and cannot return through structured output.
- Existing SIF -> KOSHA -> law ordering, `naturalize_only`, mandate-vs-guidance separation, and no scoring/probability output contracts remain intact.

## Product-HEAD GREEN Evidence

Every accepted GREEN log records product commit `7e7910ac475a1e726013f748f73717e380b3657e` and tree `4c02eb011138234930d39c7aa29c1c24c690add7`.

| Check | Result | Log |
| --- | ---: | --- |
| Focused KOSHA/commercial tests | 2 files, 43 tests passed | `focused-tests.log` |
| Existing group B | 2 files, 16 tests passed | `integrated-kosha-group-b.log` |
| Existing group C | 4 files, 22 tests passed | `integrated-kosha-group-c.log` |
| Existing group D | 3 files, 130 tests passed | `integrated-kosha-group-d.log` |
| Existing group E | 3 files, 82 tests passed | `integrated-kosha-group-e.log` |
| Existing 12-file suite aggregate | 12 files, 250 tests passed | `full-12-file-tests.log` |
| Strict TypeScript typecheck | passed | `typecheck.log` |
| Product commit diff check | passed | `diff-check.log` |
| Evidence identity/count cross-check | passed | `evidence-integrity.log` |
| Product identity and clean pre-evidence status | recorded | `product-state.log` |

The initial single-process 12-file attempt did not emit a completion footer and is retained only as `full-12-file-single-process-incomplete.log`; it is not counted as pass evidence. The same 12 files were then rerun in four bounded serial groups, all of which completed with exit code 0 and totalled 250 tests.

## Scope Integrity

- Product/test changes are limited to `lib/search.ts`, `lib/db-harness.ts`, `tests/commercial-harness.test.ts`, and `tests/kosha-current-review-run-ask.test.ts`.
- Evidence changes are confined to `evaluation/kosha-commercial-contract-remediation-2026-07-14/`.
- No DB, schema, migration, data, package, lockfile, or dependency changes were made.
- Full repository tests and production deployment were outside this remediation scope.

## Integration Gate

Do not integrate this branch before a fresh independent re-review accepts the remediation and evidence.
