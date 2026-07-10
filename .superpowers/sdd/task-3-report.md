# Task 3 Report: Shared shells, controls, and framework states

## Status

- Ralph story: `F3`
- Progress: `in_progress`
- Passes: `false` pending controller review
- Base commit: `9c9b68606323fc12b8f92b14dcd14176031ab631`
- Task commit: `fix: align shared frontend surfaces` (the authoritative hash is reported after commit)
- Scope: frontend shared surfaces only; no backend, API, database, destination, event-handler, or copy changes

## TDD evidence

### RED

Command:

```powershell
npm.cmd test -- tests/frontend-shared-surfaces.test.ts
```

Observed result before production changes:

- Exit code: `1`
- Test files: `1 failed`
- Tests: `9 failed`, `2 passed`, `11 total`
- Expected failures were present: special-state titles were visual `div` elements, workspace loading used a numeric inline style, stable module shell hooks were absent, and named shared CSS rules did not exist.

### GREEN

Command:

```powershell
npm.cmd test -- tests/frontend-shared-surfaces.test.ts tests/frontend-design-contract.test.ts
```

Observed result after the minimal implementation:

- Exit code: `0`
- Test files: `2 passed`
- Tests: `29 passed`, `0 failed`

## Implementation

- Converted not-found, route error, global error, and workspace loading titles to semantic `h1` elements without changing Korean copy.
- Added the shared `.special-state`, `.special-state-title`, and named `.loading-spinner` hooks; removed the numeric inline spinner style.
- Preserved `reset()` handlers and all existing link destinations.
- Added stable module shell hooks for header, navigation, title, description, content, and the hero scope card.
- Added accessible live/busy semantics to workspace loading; decorative brand marks remain inside controls with explicit accessible names.
- Added landing shared hooks for header, navigation, page title, descriptions, actions, and cards.
- Consolidated the live global `.card`, `.button`, `.topbar`, form focus/disabled, loading, and special-state rules into the authoritative shared section and removed superseded duplicate declarations.
- Aligned changed shared surfaces to canonical `44px` controls, `4px` control/panel radii, `24px` panel padding, page-title/body-large typography tuples, and the approved spacing tokens.

## Changed files

- `components/SafeClawModuleShell.tsx`
- `components/SafeClawLanding.tsx`
- `app/not-found.tsx`
- `app/error.tsx`
- `app/global-error.tsx`
- `app/workspace/loading.tsx`
- `app/globals.css`
- `tests/frontend-shared-surfaces.test.ts`
- `tasks/ralph/frontend-consistency/prd.json`
- `.superpowers/sdd/task-3-report.md`

## Verification evidence

| Gate | Result | Evidence |
| --- | --- | --- |
| Focused shared + design-contract tests | Pass | 2 files, 29 tests, 0 failures |
| TypeScript | Pass | `npm.cmd run typecheck`, exit code 0 |
| Production build | Pass | `npm.cmd run build`, exit code 0; 27 static pages generated |
| Static frontend audit | Pass | 32 page files, 22 component files, 0 coverage issues, 0 violations, 0 `!important` declarations |
| Diff hygiene | Pass | `git diff --check`, no whitespace errors |

## Concerns and follow-up

- No Task 3 implementation blocker remains.
- `F3.passes` intentionally remains `false` until controller review, as requested.
- Route-by-route browser screenshots and Day/Night visual reconciliation belong to later stories and were not expanded into this focused task.

## Review findings correction

Review source: `.superpowers/sdd/task-3-review.md` (`I1`–`I4`).

### Review-fix RED

Command:

```powershell
npm.cmd test -- tests/frontend-shared-surfaces.test.ts tests/frontend-design-contract.test.ts
```

Observed before the review fixes:

- Exit code: `1`
- Test files: `2 failed`
- Tests: `4 failed`, `28 passed`, `32 total`
- Failures reproduced the effective landing tuple override, document variant `22px`/mobile body reduction, and missing `.loading-spinner` reduced-motion override in both focused and design-contract coverage.

### Review-fix GREEN

Observed after correcting the scoped declarations and tests:

- Focused + design-contract tests: `32 passed`, `0 failed`
- Static audit: `pass`; 32 pages, 22 components, 0 coverage issues, 0 violations, 0 `!important` declarations
- TypeScript: `npm.cmd run typecheck`, exit code `0`
- Production build: `npm.cmd run build`, exit code `0`; 27 static pages generated

### Review-fix implementation

- Normalized effective landing hero descriptions to the body-large tuple.
- Normalized login, contact, and landing CTA controls to the shared 44px control geometry and control typography tuple.
- Normalized landing card padding to `var(--space-6)` (24px).
- Normalized document variant aside padding and responsive gap to spacing tokens; kept document descriptions body-large through scoped and mobile declarations.
- Disabled `.loading-spinner` animation under `prefers-reduced-motion: reduce` and covered it in both focused and design-contract tests.
- Replaced first-match CSS assertions with later-declaration evaluation, asserted every introduced landing hook, and bounded brand-control accessibility checks to each actual `Link` element.
- Ralph `F3` remains `in_progress` with `passes: false` pending controller review.

## Second review remediation

Review source: updated `.superpowers/sdd/task-3-review.md` against commit `a03ec9e`.

### Second-remediation RED

Command:

```powershell
npm.cmd test -- tests/frontend-shared-surfaces.test.ts tests/frontend-design-contract.test.ts
```

Observed before the selector split:

- Exit code: `1`
- Test files: `2 failed`
- Tests: `2 failed`, `30 passed`, `32 total`
- Both failures reproduced the exact high-specificity regression: document workdoc-list and report-note copy resolved to body-large instead of the body tuple.

### Second-remediation GREEN

- Focused + design-contract tests: `32 passed`, `0 failed`
- Static audit: `pass`; 32 pages, 22 components, 0 coverage issues, 0 violations, 0 `!important` declarations
- TypeScript: `npm.cmd run typecheck`, exit code `0`
- Production build: `npm.cmd run build`, exit code `0`; 27 static pages generated

### Second-remediation implementation

- Split the high-specificity document variant rule by semantic role: hero description and workdoc-header intro remain body-large; workdoc-list and report-note copy explicitly use the body tuple at the same specificity.
- Renamed the focused helper to `declarationsForExactSelector` so it no longer claims to calculate the complete cross-selector cascade.
- Added focused and design-contract assertions for each actual high-specificity header/list/report selector.
- Replaced text-bearing brand-link proxy checks with an icon-only control invariant. The reviewed module shell and landing currently contain zero icon-only button/link controls; any future detected icon-only control must have an accessible name.
- Preserved the landing canonical values and reduced-motion spinner fix from the prior remediation.
- Ralph `F3` remains `in_progress` with `passes: false` pending controller review.
