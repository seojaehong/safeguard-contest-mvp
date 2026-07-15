# SafeClaw Generation and Readiness Semantics Plan

## Goal

Separate document generation completion from safety review and share readiness so an operator never reads `12/12` as final approval.

## Constraints

- Keep the three-page workflow and current review/editor focus mode.
- Do not turn readiness into a percentage, score, or probability.
- Do not expose internal QA field names or fallback terminology.
- Template mode must be honestly indeterminate while its non-streaming request is pending.
- No database or API schema changes are required.

## Task 1: Extend the progress contract

Files:

- `lib/workspace-generation-progress.ts`
- `tests/workspace-generation-progress.test.ts`

Steps:

1. Add RED tests for a generated payload with blocked readiness.
2. Add `shareReady` and `reviewSummary` inputs to the progress builder.
3. Keep `count` as generated-document count, but return separate generation and review labels.
4. For generated-but-blocked workpacks, use `12/12 generated` plus `review required`; never return the bare copy `workpack ready`.
5. For template requests without stream events, return an indeterminate generation label instead of synthetic `3/12` progress.

## Task 2: Render adjacent status and honest template feedback

Files:

- `components/SafeGuardCommandCenter.tsx`
- `tests/workspace-layout-regression.test.ts`

Steps:

1. Pass current readiness into the progress builder.
2. Render generation completion and review/share state in the same progress summary.
3. Keep the detailed QA reasons in the existing review section, using operator language.
4. Add a browser test proving a blocked payload shows `generated` and `review required` together and cannot enter share.
5. Add a browser test proving template mode uses an indeterminate pending state and does not pretend to advance document counts.

## Verification

- `npm.cmd test -- tests/workspace-generation-progress.test.ts tests/workspace-layout-regression.test.ts`
- `npm.cmd run typecheck`
- Desktop and mobile Day/Night browser checks for generation, blocked review, and share navigation.

## Commit

`fix: separate generation from share readiness`
