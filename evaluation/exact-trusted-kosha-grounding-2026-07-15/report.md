# Exact-trusted KOSHA grounding verification

## Scope

- Base: `b15f24e0f8412dd5d86a5a07292427e39838410e`
- Branch: `fix/exact-trusted-kosha-grounding-20260715`
- No database migration or data mutation.
- No broad KOSHA allowlist and no statutory-mandate promotion.
- Full suite intentionally not run; this bounded patch uses focused contract tests and strict typecheck.

## Contract

The D-C-13 production reference becomes harness-direct only when its item ID, source ID, item type, title/version identity, pinned official URL, official file ID, publication date, and actual UTF-8 body SHA256 resolve to the exact production registry entry. Contradictory lifecycle, review state, body kind, version, URL, file ID, publication date, or body hash fails closed.

Exact trust retains the authority `technical_guidance_only`. General verified KOSHA remains supporting-only. D-C-7 and unresolved/stale/mutated references remain `review_required` and are excluded from direct/risk-row use.

## Implementation evidence

- `production-kosha-trust`: exact production pin and mutation-resistant decision builder.
- `safety-reference-catalog`: exact trust is resolved before generic remote/local metadata, without weakening generic KOSHA decisions.
- `safety-reference-catalog-server`: local-corpus-unavailable filtering delegates to the same supporting-citation gate.
- `db-harness`: exact KOSHA can be direct, SIF/direct/supporting buckets are disjoint, and TBM coverage remains explicit.
- `grounded-generation-contract`: exact KOSHA is serialized as `kind=kosha` with `KOSHA:D-C-13@D-C-13-2026`, never as DB direct or law.
- `hermes-engine-adapter`: trusted KOSHA is found in direct or supporting, deduplicated, and exposed only as `KOSHA 실행지침` claims.

## TDD evidence

- Initial RED: `tests/exact-trusted-kosha-grounding.test.ts` reported 5 failed / 0 passed.
- Intermediate: 4 passed / 1 failed while the grounded-generation reference key still used the item ID.
- GREEN: 5 passed / 5 total after decision metadata supplied the stable key/version.
- Focused regression command:
  `npm.cmd test -- tests/kosha-grounding-fail-closed.test.ts tests/commercial-harness.test.ts tests/grounded-generation-contract.test.ts tests/hermes-engine-adapter.test.ts tests/kosha-guide-supporting-row-relevance.test.ts tests/exact-trusted-kosha-grounding.test.ts`
- Focused result: 6 files passed, 157 tests passed.
- Strict typecheck: `npm.cmd run typecheck` passed.
- Diff audit: `git diff --check` passed; no new `any`, DB migration, output, or Playwright artifact changes.

## Mutation matrix

The focused tests reject body hash, item ID, source ID, item type, version/title, lifecycle, official URL, official file ID, and publication-date mutations. They also prove that a general verified KOSHA record remains supporting-only and D-C-7 stays review-required.

## Verdict

PASS for bounded selective integration after independent review. The patch does not claim full-suite, live deployment, or database validation.
