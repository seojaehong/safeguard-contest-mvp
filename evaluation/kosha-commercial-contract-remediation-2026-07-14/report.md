# KOSHA Commercial Contract Remediation v3 Evidence

## Source Identity

- Branch: `fix/kosha-commercial-contract-remediation`
- Starting HEAD and product parent: `29ae8372a709824acc244dcc772d55dbf0710d81`
- Product remediation commit: `f74c5972a4c776bfc9e1a924d3bf50ce55b503a2`
- Product remediation tree: `99e161f1ca4880c5470e694df9fd02b8230c29cd`
- Bounded corpus contract commit: `5919d58bbf7de1027f4b4118d5ec997fd4865f9f`
- Final verification tree: `6f2ed6684543f696101bd88150d44c77acd1ab6a`
- Verification product series: `f74c5972a4c776bfc9e1a924d3bf50ce55b503a2+5919d58bbf7de1027f4b4118d5ec997fd4865f9f`
- Authoritative main: `920c7f360688352156de4854b4957a9f2f1f0e43`

## TDD RED Evidence

| Bypass | RED result | Log |
| --- | ---: | --- |
| Provider structured risk/TBM surfaces | 2 failed | `red-v3-provider-structured-surfaces.log` |
| Parentless prompt semantic metadata | 2 failed | `red-v3-parentless-prompt-identity.log` |
| Unrelated parent packet-wide unlock | 2 failed | `red-v3-unrelated-parent.log` |
| Full serialized parentless surface | 4 failed | `red-v3-serialized-parentless-surface.log` |

All four bypass RED logs are bound to starting HEAD `29ae8372a709824acc244dcc772d55dbf0710d81` and exit code 1.

The first 12-file grouped run on product commit `f74c597` remained honestly RED: group D passed 129 of 130 tests and failed at `tests/kosha-guide-corpus-audit.test.ts:1954`. The immutable log is `integrated-kosha-group-d.log` with SHA-256 `7f0c0ae1905a62bbaf3b74973e0c62e58eee78d776539008ed6c6b630bbed008`.

## Product Remediation

- Final response deliverables use explicit narrative allowlists when any technical KOSHA row lacks a relevant parent. Provider `structuredRiskRows`, `tbmRiskLinks`, controls, actions, and evidence references cannot survive through the base deliverables object.
- Parentless provider packets expose only non-semantic KOSHA identity metadata. Regex-derived topic/action summaries were removed.
- Parent readiness is evaluated for each KOSHA row using deterministic strong overlap and conflicting-tag checks against eligible SIF or non-KOSHA direct parents.
- Prompt lines, required citations, appendices, public DB packet serialization, and provider result surfaces all use the same per-row readiness boundary.
- Enhanced and full modes cover KOSHA-only and unrelated-parent attacks, including provider-returned hazard, control, action, and evidence-reference fields. Relevant-parent positive cases remain covered.
- `naturalize_only`, SIF -> KOSHA -> law ordering, and mandate-vs-guidance separation remain preserved.

## Corpus Contract Alignment

The failed line 1954 assertion was invalid under the approved parentless fail-closed contract. Its fixture contains only KOSHA technical-support rows and no SIF or non-KOSHA direct parent, so requiring `작업발판|안전대` in provider prompt context contradicted identity-only exposure.

Source-corpus control coverage remains in `auditKoshaRetrievalScenario`: `requiredControlTerms` are still checked against `sourceEvidenceText`. Commit `5919d58` changes only `tests/kosha-guide-corpus-audit.test.ts`, retaining that source check while asserting two parentless prompt rows have `parentEvidenceReady:false` and omit `bodyExcerpt`, summary, controls, evidence references, and action phrases.

- Targeted contract GREEN: 1 passed, 109 skipped in `green-v3-corpus-parentless-contract.log`.
- Post-contract group D GREEN: 130 of 130 passed in distinct `integrated-kosha-group-d-green.log`.
- The original group D RED log was not overwritten.

## Verification Results

### Product Commit f74c597

| Check | Result | Log |
| --- | ---: | --- |
| Focused commercial/KOSHA tests | 55 passed | `focused-tests.log` |
| Group B | 26 passed | `integrated-kosha-group-b.log` |
| Group C | 22 passed | `integrated-kosha-group-c.log` |
| Group D | 129 passed, 1 failed | `integrated-kosha-group-d.log` |
| Group E | 84 passed | `integrated-kosha-group-e.log` |
| Strict TypeScript typecheck | passed | `typecheck.log` |
| Original four-file scope and diff check | passed | `diff-check-f74c597.log` |

This commit alone did not pass the grouped 12-file suite: 261 passed and 1 failed out of 262 executed tests.

### Verification Series f74c597+5919d58

| Check | Result | Log |
| --- | ---: | --- |
| Focused commercial/KOSHA tests | 55 passed | `final-focused-tests.log` |
| Group B | 26 passed | `final-integrated-kosha-group-b.log` |
| Group C | 22 passed | `final-integrated-kosha-group-c.log` |
| Group D | 130 passed | `integrated-kosha-group-d-green.log` |
| Group E | 84 passed | `final-integrated-kosha-group-e.log` |
| Grouped 12-file aggregate | 262 passed | `full-12-file-tests.log` |
| Strict TypeScript typecheck | passed | `final-typecheck.log` |
| Two-commit scope, no-`any`, and diff check | passed | `diff-check.log` |

The grouped total is based on four completed serial groups covering 12 unique files. It is a verification-series result after the bounded test-contract alignment, not a claim that `f74c597` alone passed all 12 files.

## Scope Integrity

- Product commit `f74c597` changes only `lib/search.ts`, `lib/db-harness.ts`, `tests/commercial-harness.test.ts`, and `tests/kosha-current-review-run-ask.test.ts`.
- Separately authorized contract commit `5919d58` changes only `tests/kosha-guide-corpus-audit.test.ts`.
- Evidence changes are confined to `evaluation/kosha-commercial-contract-remediation-2026-07-14/`.
- No DB, schema, migration, data, package, lockfile, or dependency changes were made.
- Full repository tests and production deployment were outside this remediation scope.

## Independent Review

- Status: `pending`
- Owner: main integration review
- `independent-review-v3.log` records a failed read-only tool invocation (`exitCode=1`) caused by an invalid local Codex `service_tier` config value. It is excluded from success evidence.

## Integration Gate

Do not integrate this branch until main completes and accepts a fresh independent re-review.
