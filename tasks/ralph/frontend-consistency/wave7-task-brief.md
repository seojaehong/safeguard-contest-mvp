# Wave 7 task brief

Base: authoritative frontend/backend integration `87798d1`.

## Goal

Fix two reproduced production workspace geometry failures without hiding, clipping, scaling away, or removing user controls:

1. `tests/workspace-layout-regression.test.ts` scaled desktop composer bottom is 12px below the viewport near the assertion at line 563.
2. The mobile submit control bottom is 10px below the 390px viewport near the assertion at line 946.

## Process and acceptance

1. TDD: run the two exact production geometry tests first and preserve their RED measurements.
2. Diagnose computed geometry and the final CSS cascade. Prefer selector-scoped CSS in `app/globals.css`; do not edit `SafeGuardCommandCenter.tsx` unless evidence proves CSS alone cannot preserve behavior.
3. Do not pass by hiding controls, reducing audit coverage, loosening assertions/tolerances, using transforms/scaling, or adding overflow clipping.
4. Add or strengthen an opt-in production matrix covering Workspace Day/Night at:
   - the reproduced scaled desktop viewport,
   - 1440x320 short height,
   - 390x844 mobile,
   - at least one ordinary 1440x900 control case.
5. Assert composer/submit bounds, nonzero control geometry, no horizontal overflow, and that key controls remain visible and usable.
6. Re-run the original `workspace-layout-regression` tests that failed, focused related layout tests, strict typecheck, normal build 27/27, and the production matrix.
7. Run static audit and record exact delta. Do not claim static or 108-row PASS.
8. Commit product/tests first, then source-bound evidence under `evaluation/frontend-workspace-viewport-wave7-2026-07-12/source-<sha>/`.

## Hard exclusions

- No parser, allowlist, threshold, coverage, route inventory, or 108-row changes.
- No Reports CSS/behavior or backend product contracts.
- No package/lock changes.
- Preserve the W4-W6 final typography cascade and all ontology selectors.
- Do not stage or overwrite the 16 unrelated screenshot modifications.

## Deliverable

Write `tasks/ralph/frontend-consistency/wave7-task-report.md` with RED proof, root cause, exact geometry before/after, changed files, verification commands/results, static delta, commits, and residual concerns. Return status, commits, verification summary, concerns only.
