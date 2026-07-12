# Wave 7 source-bound verification

Source commit: `7b2155a`

## Geometry evidence

- RED scaled desktop, 1638x510: composer bottom `514px`; required maximum `502px` (`viewport - 8px`).
- GREEN scaled desktop, 1638x510: composer bottom `492px`; required maximum `502px`.
- RED mobile, 390x844 at DPR 3: submit bottom `806px`; required maximum `796px` (`viewport - 48px`).
- GREEN mobile, 390x844 at DPR 3: submit bottom `796px`; required maximum `796px`.
- The production matrix also observed the mobile composer container bottom at `805px`, inside the `844px` viewport; the submit retained its stricter 48px safety inset.

## Verification

- `npm.cmd test -- tests/workspace-layout-regression.test.ts tests/workspace-input-css-contract.test.ts --maxWorkers=1` — PASS, 20 passed and the opt-in production test skipped.
- Focused post-consolidation geometry/CSS run — PASS, 3 passed and 18 skipped.
- `npm.cmd run typecheck` — PASS.
- `npm.cmd run build` — PASS, normal production build generated 27/27 static pages.
- `$env:WORKSPACE_INPUT_PROD_MATRIX='1'; npm.cmd test -- tests/workspace-layout-regression.test.ts -t "preserves the exact Day and Night textarea cascade at every responsive band" --maxWorkers=1` — PASS, 1 passed in 68.48s.
- Production matrix coverage: Workspace Day/Night at 1440x900, 1638x510, 1440x500, 1440x410, 1440x360, 1440x320, and 390x844. It asserts textarea cascade, composer/submit/attachment bounds, nonzero geometry, visibility, enabled state, and no horizontal overflow.

## Static audit

- `npm.cmd run audit:frontend-consistency` with `OUTPUT_PATH` bound to this directory — expected RED, 2,307 violations, 0 coverage issues.
- Baseline/Wave 6: 2,307 violations. Exact Wave 7 delta: `0`.
- No static PASS or 108-row PASS is claimed.
