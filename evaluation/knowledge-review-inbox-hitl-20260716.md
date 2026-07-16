# Knowledge Review Inbox HITL Evaluation

Date: 2026-07-16
Base commit: `ce211b10f53470a95432284613fbb00d47f115de`

## Scope

Implemented the smallest stored SafeClaw knowledge review slice without schema,
migration, ontology, Hermes, corpus, or wiki markdown changes.

## Acceptance Evidence

| Requirement | Evidence | Result |
| --- | --- | --- |
| Valid draft and tenant events become reviewable | `knowledge-review-prepare.test.ts` persists one envelope and guarded `review_required` update | Pass |
| Cross-org, cross-site, missing, duplicate, shared, invalid-status inputs write nothing | Six fail-closed fixture cases assert an empty write log | Pass |
| Empty or failed generation cannot become reviewable | Empty/whitespace and thrown generator cases preserve `draft` with zero writes | Pass |
| Candidate and API are redacted and bounded | Generic event-count question, digest-only model prompt, 12,000-character text limit, 20-event/hazard limits, 96-character provider limit, response without provenance/tenant/raw fields | Pass |
| Prepare to inbox to existing review action | Authenticated in-memory fixture prepares, loads the real inbox loader, and calls the real existing approval action | Pass |
| Review receipts stay unpublished | Existing action suite covers approve, site-only, reject; receipts require `publicationState=unpublished`, `ontologyPublished=false`, `publishPerformed=false` | Pass |
| No ontology mutation | Integration fixture records zero ontology table access/write through prepare and review | Pass |
| Mobile inbox is usable | Playwright at 390x844 finds one decision group, three controls at least 44x44, zero overlap pairs, and document overflow at most 1px | Pass |
| Existing regenerate/review contracts remain | Existing regenerate, inbox route, action, governance, page, and mobile tests included in focused suite | Pass |

## TDD Record

1. Prepare tests failed because `lib/knowledge-review-prepare.ts` did not exist.
2. Prepare route tests failed because the route did not exist.
3. Browser test failed because the inbox component did not exist.
4. PII regression test failed because the stored run question reached the builder.
5. Minimal implementation was added after each failure and the focused tests were rerun green.

New focused tests: 15 (`11` prepare, `3` prepare route, `1` browser).

## Verification

Final focused command:

```text
npm.cmd test -- tests/knowledge-governance.test.ts tests/knowledge-governance-ui-contract.test.ts tests/knowledge-regenerate-route.test.ts tests/knowledge-review-route.test.ts tests/knowledge-review-actions.test.ts tests/knowledge-review-prepare.test.ts tests/knowledge-review-prepare-route.test.ts tests/knowledge-review-inbox-browser.test.ts tests/knowledge-page-layout.test.ts tests/knowledge-mobile-ia-browser.test.ts
```

Result: `10` test files passed, `100` tests passed, `0` failed.

Typecheck command: `npm.cmd run typecheck`
Build command: `npm.cmd run build`

Both reached unrelated PDF export imports and stopped because the shared
`node_modules` does not contain declared dependencies `pdf-lib` and
`@pdf-lib/fontkit`. No type error from the changed knowledge files remained.
The build failed only on those two unresolved modules.

## Boundaries Confirmed

- Database schema and migrations changed: `0`
- Ontology node or edge writes: `0`
- Automatic publish operations: `0`
- Wiki markdown mutations: `0`
- Hermes or engine files changed: `0`
- KOSHA corpus files changed: `0`
- Push performed: no

## Limitations

- No live Supabase mutation was run; persistence and authentication were verified
  with typed in-memory and route fixtures.
- Full typecheck and production build require restoring the two existing PDF
  dependencies in the shared workspace dependency tree.
