# Wave 7 workspace viewport report

## Status

Wave 7 is complete at source commit `7b2155a`. Both reproduced production geometry failures, the focused workspace layout suite, strict typecheck, normal 27/27 build, and the expanded opt-in production matrix pass. The standard static audit remains intentionally RED and is not claimed as a static or 108-row PASS.

## TDD RED proof

The two requested browser tests were run before production CSS changed:

- `keeps the day composer submit action visible on scaled presentation screens`: at 1638x510, `.input-composer-tray` bottom was `514px`, while the assertion required at most `502px`; 12px beyond the required safety boundary and 4px beyond the viewport.
- `keeps the mobile day composer action inside the first viewport`: at 390x844 with DPR 3, `.composer-submit-button` bottom was `806px`, while the assertion required at most `796px`; 10px beyond the required mobile safety boundary.

The existing opt-in production matrix was strengthened before the CSS fix. It initially exposed an additional real Day 1440x500 geometry failure: composer bottom `502px` against maximum `492px`. Test-fixture mistakes encountered while strengthening the matrix were corrected against the real product DOM: the attachment control is a label/file input, not a button.

## Root cause and fix

The controls were correctly sized and remained in normal document flow. The final responsive cascade retained cumulative vertical whitespace above and immediately before the composer:

- Desktop at width >=901px and height <=560px retained short-screen page padding plus a 4px composer top margin.
- Mobile at width <=720px retained 20px page top padding while the composer stacked its real attachment and submit controls.

The selector-scoped fix is limited to `app/globals.css`:

- For desktop height <=560px, the existing page padding declaration is consolidated to `0 clamp(28px, 4vw, 48px) 20px`. The composer top margin is `0` from 431px through 560px; the later <=430px compact rule deliberately restores `8px`, and the 410/360/320 production cases still satisfy the viewport bounds.
- For mobile width <=720px, page padding becomes `10px 18px 28px`.

No controls were hidden or removed. No transforms, scaling, new clipping, overflow masking, tolerance changes, parser changes, allowlist changes, route-inventory changes, Reports changes, backend contracts, package files, or `SafeGuardCommandCenter.tsx` were touched. W4-W6 typography and ontology selectors remain unchanged.

## Exact geometry after

- Scaled desktop 1638x510: composer bottom `492px`, maximum `502px`.
- Mobile 390x844 DPR 3: submit bottom `796px`, maximum `796px`.
- Mobile composer container bottom `805px`, inside the `844px` viewport; the submit separately retains the stricter 48px bottom inset.
- Expanded production matrix: all Day/Night viewport cases passed with nonzero composer, submit, and attachment geometry; visible and enabled controls; and no horizontal overflow.

## Changed files

Product/test commit `7b2155a`:

- `app/globals.css`
- `tests/workspace-layout-regression.test.ts`

Evidence/report commit (this report's commit):

- `evaluation/frontend-workspace-viewport-wave7-2026-07-12/source-7b2155a/frontend-consistency-audit.json`
- `evaluation/frontend-workspace-viewport-wave7-2026-07-12/source-7b2155a/verification.md`
- `tasks/ralph/frontend-consistency/wave7-task-report.md`

## Verification results

- Exact original RED commands: failed at `514 <= 502` and `806 <= 796` before the fix.
- `npm.cmd test -- tests/workspace-layout-regression.test.ts tests/workspace-input-css-contract.test.ts --maxWorkers=1` — PASS, 20 passed; the opt-in production test skipped.
- Focused post-consolidation original geometry and CSS-contract command — PASS, 3 passed.
- `npm.cmd run typecheck` — PASS.
- `npm.cmd run build` — PASS, normal build generated 27/27 static pages.
- `$env:WORKSPACE_INPUT_PROD_MATRIX='1'; npm.cmd test -- tests/workspace-layout-regression.test.ts -t "preserves the exact Day and Night textarea cascade at every responsive band" --maxWorkers=1` — PASS, 1/1 in 68.48s.
- Matrix cases: Workspace Day/Night at 1440x900, reproduced 1638x510, 1440x500, 1440x410, 1440x360, required 1440x320, and 390x844.

## Static audit delta

Source-bound output: `evaluation/frontend-workspace-viewport-wave7-2026-07-12/source-7b2155a/frontend-consistency-audit.json`.

- Status: expected RED.
- Wave 7 violations: `2,307`.
- Baseline/Wave 6 violations: `2,307`.
- Exact delta: `0`.
- Coverage issues: `0`.
- No static or 108-row PASS is claimed.

## Residual concerns

- The full static consistency audit still has 2,307 pre-existing violations outside Wave 7 scope.
- The matrix intentionally verifies the input workspace surface; generated-document and Reports surfaces were not expanded because they are excluded from this wave.
- The unrelated task brief remains unstaged and no unrelated screenshot modifications were staged or overwritten.
