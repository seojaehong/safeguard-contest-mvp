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
| Candidate is bound to the current source snapshot | Prepare and action attack fixtures reject empty, stale, foreign, or invalid provenance before writes | Pass |
| Browser DTO excludes storage fields | Route JSON and Playwright network-body assertions reject titles, source IDs, original questions, raw event IDs, tenant context, generated output, and provenance | Pass |
| Action gate is fail closed | `draft`, `generated`, empty output, stale candidate, and foreign provenance return 4xx with zero mutations | Pass |
| Service-role reads are scoped in SQL | Run reads include owned organization and site; event reads include exact organization and site constraints, with post-read validation retained | Pass |
| UUIDs fail before DB access | Prepare and review route tests reject non-canonical, v1, and braced IDs and assert no client, auth, or action call | Pass |
| Prepare to inbox to existing review action | Authenticated in-memory fixture prepares, loads the real inbox loader, and calls the real existing approval action | Pass |
| Review receipts stay unpublished | Existing action suite covers approve, site-only, reject; receipts require `publicationState=unpublished`, `ontologyPublished=false`, `publishPerformed=false` | Pass |
| No ontology mutation | Integration fixture records zero ontology table access/write through prepare and review | Pass |
| Mobile inbox is usable | Playwright at 390x844 finds one decision group, three controls at least 44x44, zero overlap pairs, and document overflow at most 1px | Pass |
| Existing regenerate/review contracts remain | Existing regenerate, inbox route, action, governance, page, and mobile tests included in focused suite | Pass |

## TDD Record

1. The remediation attack suite ran before implementation with `15` failures and
   `62` passes across the four focused server files.
2. RED covered UUID bypass, raw storage DTO disclosure, missing query constraints,
   empty/stale/foreign provenance, and action acceptance of draft/generated/empty output.
3. Snapshot binding, DTO allowlisting, query scoping, UUID validation, and the
   action gate were implemented through shared pure validation helpers.
4. Compensation fixtures were upgraded to current source-bound envelopes and
   rerun to preserve partial-write resume and idempotency behavior.

## Verification

Final focused command:

```text
npm.cmd test -- tests/knowledge-governance.test.ts tests/knowledge-governance-ui-contract.test.ts tests/knowledge-regenerate-route.test.ts tests/knowledge-review-route.test.ts tests/knowledge-review-actions.test.ts tests/knowledge-review-prepare.test.ts tests/knowledge-review-prepare-route.test.ts tests/knowledge-review-inbox-browser.test.ts tests/knowledge-page-layout.test.ts tests/knowledge-mobile-ia-browser.test.ts
```

Machine-readable results:

- `evaluation/knowledge-review-remediation-tests.json`: focused non-browser suite.
- `evaluation/knowledge-review-remediation-browser.json`: 390px Playwright suite.

Final result: `104/104` focused non-browser tests and `1/1` browser test passed;
`105` total tests passed with `0` failures.

Typecheck command: `npm.cmd run typecheck`
Build command: `npm.cmd run build`

The first typecheck found declared PDF dependencies missing from the shared
`node_modules`. `npm.cmd install --ignore-scripts` synchronized dependencies with
zero `package.json` or lockfile diff. The subsequent strict typecheck and production
build both passed. The final build completed without warnings after replacing the
unsupported CSS alignment value with `flex-start`.

## Boundaries Confirmed

- Database schema and migrations changed: `0`
- Ontology node or edge writes: `0`
- Automatic publish operations: `0`
- Wiki markdown mutations: `0`
- Hermes or engine files changed: `0`
- KOSHA corpus files changed: `0`
- Push performed: no

## Limitations

- No live Supabase mutation, RLS, or service-role credential probe was run;
  persistence, authentication, query scope, and mutation behavior are proven by
  authenticated typed fakes and route fixtures.
