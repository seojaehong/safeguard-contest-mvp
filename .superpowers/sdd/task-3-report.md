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
