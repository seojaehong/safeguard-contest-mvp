# SafeClaw `/why` mobile P0 evaluation

- Base: `cb43e4d10416150577cfe88179cdced5f4a23e94`
- Branch: `fix/why-mobile-p0-cb43e4d`
- Scope: `app/why/**`, focused test, and this evaluation bundle only

## TDD result

The initial browser test reproduced the defect in both themes: 31 visible elements extended beyond the 390px viewport while the desktop five-column layout remained intact. After the route-local change, all four browser scenarios passed.

| Viewport | Theme | Page overflow | Outside viewport | Unreadable text | Touch targets below 44px | Comparison geometry |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 390x844 | Day | 0px | 0 | 0 | 0 | 5 stacked rows, each 332px |
| 390x844 | Night | 0px | 0 | 0 | 0 | 5 stacked rows, each 332px |
| 1440x900 | Day | 0px | 0 | 0 | n/a | 5 columns, 1104px table |
| 1440x900 | Night | 0px | 0 | 0 | n/a | 5 columns, 1104px table |

Both mobile themes expose a native table with five column headers and five row headers while presenting the body rows as cards.

## Verification

- `npm.cmd test -- tests/why-mobile-layout.test.ts --reporter=verbose`: 1 file, 4 tests passed
- `npm.cmd run typecheck`: passed with `--noEmit --incremental false`
- Playwright visual review: mobile and desktop screenshots checked in Day and Night modes
- `npm.cmd test -- tests/frontend-route-coverage.test.ts --reporter=dot`: 36 passed, 1 provenance check failed because the existing full-browser report has a different `sourceIdentity`; refreshing global frontend evidence is outside this `/why`-only branch

Evidence files are stored beside this report: `focused-browser-test.log`, `typecheck.log`, `route-coverage-test.log`, and four viewport/theme screenshots.
