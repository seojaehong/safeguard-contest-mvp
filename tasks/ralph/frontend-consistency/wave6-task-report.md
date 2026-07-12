# Wave 6 ontology typography report

## Status

Wave 6 source is complete at `59d056f`. The scoped typography contract, strict typecheck, 27/27 production build, and opt-in production browser matrix pass. The standard full static audit remains intentionally RED and is not claimed as PASS.

## Changed files

- `app/globals.css`
- `tests/ontology-typography-role-contract.test.ts`
- `tests/ontology-typography-production-matrix.test.ts`

The task brief and pre-existing `prd.json` modification were not included in the source commit. No excluded product, parser, allowlist, route coverage, threshold, package, backend harness, or Reports files were edited.

## TDD RED proof

Command:

`npm.cmd test -- tests/ontology-typography-role-contract.test.ts`

Initial result: RED, 1 failed. The assertion returned 36 `.ontology-*` / `.operation-memory-*` `typography-tuple` violations from the authoritative CSS, including operation-loop support text, HUD labels, component titles, table text, and captions.

Browser REDs were also used to close real cascade behavior:

- The first production run computed ontology support text as 15px/420/25.8px instead of the semantic 14px/500/22.4px role because the document skin had higher specificity.
- The next run computed component-title tracking as `0` because a global content `strong` rule used `letter-spacing: 0 !important`; the generic rule was narrowly excluded for the six ontology component-title selector families.
- The workspace matrix initially found no preview in the input-only route. It was corrected using the repository's canonical current-workpack restore flow, then opening Edit to render the real shared `OperationMemoryPreview` inside `.field-workspace`.

## Static audit delta

Iteration command used a temporary output path:

`$env:OUTPUT_PATH = Join-Path $env:TEMP 'wave6-before.json'; node scripts/frontend_consistency_audit.mjs`

| Category | Before | After | Delta |
| --- | ---: | ---: | ---: |
| typography-tuple | 612 | 576 | -36 |
| font-size-tier | 192 | 181 | -11 |
| important-declaration | 737 | 737 | 0 |
| line-height-tier | 232 | 232 | 0 |
| tracking-tier | 128 | 128 | 0 |
| selector-role | 51 | 51 | 0 |
| radius-tier | 288 | 288 | 0 |
| decorative-box-shadow | 59 | 59 | 0 |
| decorative-gradient | 53 | 53 | 0 |
| decorative-text-shadow | 2 | 2 | 0 |
| **Total** | **2,354** | **2,307** | **-47** |

Coverage issues stayed at 0. No expected counts, audit code, semantic allowlists, route inventory, or coverage were changed.

## Verification

- `npm.cmd test -- tests/ontology-typography-role-contract.test.ts tests/ontology-typography-production-matrix.test.ts` — focused contract PASS; production matrix is opt-in and skipped without its environment flag.
- `npm.cmd run typecheck` — PASS, strict no-emit typecheck.
- `npm.cmd run build` — PASS, optimized production build and static generation 27/27.
- `$env:ONTOLOGY_TYPOGRAPHY_PROD_MATRIX='1'; npm.cmd test -- tests/ontology-typography-production-matrix.test.ts` — PASS, 1/1 in 39.75s.
- Browser matrix covered `/ontology?theme=day|night` at 1440x900, 390x844, and 1440x320; verified rendered product/HUD/component-title/support/table/caption family, size, weight, line-height, tracking, popover hover exercise, and horizontal overflow.
- Browser matrix covered restored `/workspace?theme=day|night` at 1440x900, opened the generated field workspace, and verified the shared operation-memory component-title/caption roles plus horizontal overflow.
- Source-bound audit: `node scripts/frontend_consistency_audit.mjs` with `OUTPUT_PATH=evaluation/frontend-ontology-typography-wave6-2026-07-12/source-59d056f/frontend-consistency-audit.json` — expected exit 1, 2,307 residual violations, coverage issues 0.

## Commits and evidence

- Source/product/tests: `59d056f` (`feat: normalize ontology typography roles`)
- Source-bound evidence: `evaluation/frontend-ontology-typography-wave6-2026-07-12/source-59d056f/frontend-consistency-audit.json`

## Known residual RED and concerns

- Full static audit remains RED at 2,307. This wave does not claim static PASS or a 108-row PASS.
- The authoritative backend advanced separately to UI-neutral `3b0edfe`; this branch was deliberately not rebased or integrated.
- A separate visible-layout blocker remains outside Wave 6 ownership: `workspace-layout-regression` production geometry reports desktop composer bottom +12px at test line 563 and mobile submit +10px at line 946. It requires a later bounded viewport TDD wave; no Wave 6 typography rule was used to mask it.
- The initial browser hover check only exercised the target; the reviewer fix below supersedes it with a deterministic computed opacity and geometry assertion.

## Reviewer fix follow-up

Source fix commit: `5aea3a9` (`fix: expand ontology typography matrix`).

The reviewer acceptance gaps were converted into a stricter production contract:

- `/ontology` now uses an explicit exhaustive table of actually rendered selector families. Each support, HUD, component-title, caption, and table selector is checked for computed font family, size, weight, line-height, and tracking at all six Day/Night viewport combinations.
- The restored `/workspace` shared preview now runs at Day/Night for 1440x900, 390x844, and 1440x320. Each combination checks complete component-title, caption, table, and HUD tuples plus horizontal overflow.
- The component-title assertion includes the previously omitted `-0.3px` computed tracking value; table assertions include tracking and product font family.
- The hover contract now proves a real interaction transition: the rendered card starts at opacity 0, the row is hovered, the test waits for computed opacity 1, then verifies nonzero geometry and horizontal viewport intersection.

Enhanced TDD RED proof:

- The expanded matrix first failed because `.operation-memory-actions button` computed as Pretendard 14px/520/16px/0 instead of the HUD tuple Geist Mono 11px/700/16px/0.88px.
- The fix narrowly excludes buttons inside `.operation-memory-preview` from the document skin's generic `!important` typography rule. No parser, allowlist, product component, or route behavior changed.
- A selector for `.operation-memory-popover strong` was removed from the rendered-family table after the production sample proved that family is not instantiated in the current preview graph. It remains covered by the static scoped contract; browser claims are limited to actually rendered elements.

Fresh fix verification:

- Focused contract command — PASS (1 passed, opt-in matrix skipped without its flag).
- `npm.cmd run typecheck` — PASS.
- `npm.cmd run build` — PASS, 27/27 generated.
- Opt-in production matrix — PASS, 1/1 in 66.30s across 12 route/theme/viewport cases.
- Source-bound static audit — expected RED 2,307, coverage issues 0; totals and categories are unchanged from the original Wave 6 evidence.
- Fix evidence artifact: `evaluation/frontend-ontology-typography-wave6-2026-07-12/source-5aea3a9/frontend-consistency-audit.json`.

## Second reviewer fix: exhaustive operation-memory manifest

Source test commit: `a7f21cc` (`test: exhaust operation memory typography matrix`).

The production matrix now has one route-aware `operationMemoryFamilies` manifest derived from `components/OperationMemoryPreview.tsx`. It is reused for `/ontology` and restored `/workspace` at Day/Night × 1440x900, 390x844, and 1440x320. Every instantiated family receives a complete computed tuple assertion.

Manifest coverage:

- Support: `.operation-memory-copy p`, `.operation-memory-list-item strong`.
- HUD: `.operation-memory-actions button` on `/ontology`, plus shared `.operation-memory-stats span`, `.operation-memory-point > span`, `.operation-memory-list-item span`, `.operation-memory-detail > span`, `.operation-memory-detail dt`, and `.operation-memory-detail li b`.
- Component title: `.operation-memory-detail > strong`.
- Caption: `.operation-memory-point strong`, `.operation-memory-point small`, `.operation-memory-detail p`, `.operation-memory-list-item small`.
- Table: `.operation-memory-detail dd`, `.operation-memory-detail li span`.

The workspace fixture now uses the existing DB-harness builders with one minimal direct reference. The matrix selects a real related node before checking conditional detail rows, so `detail li b` and `detail li span` are rendered product DOM rather than synthetic test markup.

Conditional families not instantiated by either fixture remain out of browser claims: `.operation-memory-message`, `.operation-memory-popover *`, and `.operation-memory-inline-card *`. They remain covered by the static scoped typography contract. `.compact-head` and `.eyebrow` are intentionally outside this manifest because they are shared unscoped component classes, not `.operation-memory-*` families in the Wave 6 scope.

Second-review TDD evidence:

- RED: restored workspace timed out on the newly required `.operation-memory-detail li b`, exposing that the original canonical sample had no DB harness relations.
- GREEN: the relation-bearing fixture and active-node traversal instantiate the family on both routes; the 12-case opt-in matrix passes 1/1 in 72.71s.
- Focused contract PASS; strict typecheck PASS; production build PASS with 27/27 generated.
- Source-bound static audit remains expected RED 2,307 with coverage issues 0 and unchanged category totals.
- Evidence artifact: `evaluation/frontend-ontology-typography-wave6-2026-07-12/source-a7f21cc/frontend-consistency-audit.json`.
