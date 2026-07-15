# Reports integration contract hotfix

## Verdict

Bounded fix **PASS**. Final static/browser release evidence is still pending on the final product HEAD.

## RED

The Reports chain passed its own focused suite, but the full integration CI run exposed five design-contract regressions plus the intentionally stale browser evidence identity.

- CI: `29299380661`
- Local reproduction: 6 files failed, 6 tests failed, 65 tests passed.
- The route root declared a body font size and line height without the matching weight and tracking.
- The report preview summary used the control tuple although the canonical selector role is support copy.
- Mobile report content started at `346px` against the `340px` bound; after the first correction, the sample report started at `542px` against the `540px` bound.

## GREEN

Only `app/globals.css` changed.

- Reports root: complete body tuple.
- Preview summary: canonical support tuple.
- Mobile reports header: 8px outer gap and 4px action padding, keeping the page and sample report inside the existing task-distance contract.
- Focused design and browser contracts: 5 files, 34 tests passed.
- Frontend static audit: 32 pages, 23 product components, violations 0, coverage issues 0, `!important` declarations 0.
- Strict TypeScript: PASS.
- `git diff --check`: PASS.

## Open gate

`tests/frontend-route-coverage.test.ts` remains intentionally fail-closed because its checked-in source identity predates the current integration tree. Regenerating it now would create another stale snapshot after Share, Ontology, KOSHA, and Web integration. Static evidence and the 108-row Day/Night browser audit must be generated once on the final product HEAD.
