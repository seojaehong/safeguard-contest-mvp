# Module shell visual unification audit

- Date: 2026-07-11
- Branch: `feature/module-shell-unify`
- Baseline: `2d0ff448f2bb47cd17be4d4674895dfdd104abdb`
- Scope: shared module shell CSS and its focused browser regression test only
- Viewports: desktop `1440x900`, mobile `390x844`
- Evidence method: Playwright Chromium, computed styles, and `getBoundingClientRect()`; no screenshots or binary artifacts

## Selectors

| Surface | Main-start selector | Supporting selector |
| --- | --- | --- |
| `/workspace` | `.workspace-step-page.workspace-input-page` | `.command-center-shell` |
| `/documents` | `.safeclaw-module-content > :first-child` | `.safeclaw-module-shell` |
| `/reports` | `.safeclaw-module-content > :first-child` | `.safeclaw-module-shell` |
| `/reports` sample body | `.safeclaw-workdoc-shell` | `.safeclaw-current-workpack.sample` |

## Main-start Y

All values are viewport-relative CSS pixels.

| Route | Desktop before | Desktop after | Mobile before | Mobile after | Mobile delta |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/workspace` | 105 | 105 | 281 | 281 | 0 |
| `/documents` | 218 | 218 | 446 | 331 | -115 |
| `/reports` | 218 | 218 | 446 | 285 | -161 |
| `/reports` sample body | not measured | not measured | 659 | 498 | -161 |

The module content now starts no more than 50px below the mobile workspace start for the two launch-blocking routes. The report/document internals were not compacted; the movement comes from shared shell chrome only.

## Rendered tokens and chrome

| Metric | Before | After | Workspace reference |
| --- | --- | --- | --- |
| Day accent | `#5148d8` | `#f5c518` | `#f5c518` |
| Night accent | `#8b8dfc` | `#6c6ff7` | `#6c6ff7` |
| Mobile rail radius | `0px` | `14px` | `14px` |
| Mobile nav radius | `0px` | `8px` | `8px` |
| Mobile menu row/column gap | `2px / 2px` | `8px / 8px` | acceptance `>=8px` |
| Mobile rail height | `69px` | `61px` | compact chrome |
| Mobile nav height | `65px` | `59px` | compact chrome |
| Mobile decision-header top | `134px` | `120px` | shell chrome end |
| Module title size | `30px` desktop / `27px` mobile | unchanged | required ranges preserved |
| Visible mobile control heights | `44px` | `44px` | acceptance `>=44px` |
| Horizontal overflow | none | none | none |

The primary command background/border, focused control outline, and active module navigation inset now resolve to `rgb(245, 197, 24)` in Day and `rgb(108, 111, 247)` in Night. Safety success/status colors were left unchanged.

## TDD evidence

1. RED: the expanded browser regression failed on module Day `#5148d8` versus workspace `#f5c518`, and mobile content `446px` versus the workspace-relative `361px` ceiling.
2. GREEN: `tests/module-shell-design-regression.test.ts` passed all 4 tests after the final CSS-only shell patch.
3. The mobile test opens the menu and checks every visible menu/theme/command control, both grid gaps, both chrome radii, title hierarchy, sample report geometry, and horizontal overflow.
4. The theme test reads actual Day/Night computed values for module accent, primary command, focus outline, and active navigation styling.

## Verification

| Command | Result |
| --- | --- |
| `npm.cmd test -- tests/module-shell-design-regression.test.ts --disableConsoleIntercept` | pass, 4 tests |
| `npm.cmd run typecheck` | pass |
| `npm.cmd run build` | pass, 27 static pages generated |
| `git diff --check` | pass |

No backend behavior, report provenance, document density, editor, vision, share, or generation contract was changed.
