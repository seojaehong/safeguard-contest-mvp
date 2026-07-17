# SafeClaw module brand touch target verification

## Scope

- Base: `56cb66f1405c49e18e88f583a95025b13f09c40d`
- Files: `app/globals.css`, `tests/product-module-shell.test.ts`
- Viewport: `390x844`
- Product behavior: the shared SafeClaw home link must expose a touch target of at least `44x44px` without horizontal page overflow.

## TDD evidence

### RED

After adding `.safeclaw-module-brand` to `readVisibleTouchTargets()`, the focused browser suite failed across its 12-route matrix because the home link height was `24px`.

- Command: `npm.cmd test -- tests/product-module-shell.test.ts`
- Result: `1 file failed`, `1 test failed / 2 passed`
- Representative failure: `/home SafeClaw touch target height: expected 24 to be greater than or equal to 44`

### GREEN

The mobile shared-shell media query now applies `min-width: 44px` and `min-height: 44px` to `.safeclaw-module-brand`.

- Focused browser suite: `1 file / 3 tests PASS`
- Strict typecheck: PASS after installing lockfile-declared local dependencies
- Production build: PASS, `28/28` static pages generated

## Browser geometry

The production build was served locally and measured with Playwright at `390x844` across 11 shared module routes. The focused test matrix also covers `/reports`; the standalone geometry capture omitted that route because its authenticated data state is conditional.

- Routes: `/home`, `/documents`, `/workers`, `/evidence`, `/knowledge`, `/settings`, `/tbm`, `/archive`, `/ops/api`, `/ask`, `/dispatch`
- Brand target on every route: `93.6x44px`
- Minimum width: `93.6px`
- Minimum height: `44px`
- Maximum document horizontal overflow: `0px`

## Notes

The first typecheck attempt failed only because the new worktree had not installed the lockfile-declared `pdf-lib` packages. `npm.cmd install` changed neither `package.json` nor `package-lock.json`; the repeated strict typecheck passed.
