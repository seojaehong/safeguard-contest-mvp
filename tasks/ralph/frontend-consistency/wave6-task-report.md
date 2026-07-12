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
- The browser hover exercise confirms the real hover target and rendered card are present; opacity was not used as the acceptance because overlapping graph/nav hit targets made that state assertion nondeterministic. Typography and overflow are asserted from actual rendered elements.
