# Document Typography Audit Remediation

## Scope

- Authoritative base: `785f328e2804ba472a1d659d83ef4c3c89acf342`
- Branch: `fix/document-typography-audit-20260714`
- Owned code: `app/globals.css`, `tests/north-star-document-ux.test.ts`
- Existing frontend route identity evidence and browser no-build suites were not changed.

## RED to GREEN

- RED focused run: 4 test files failed, 4 tests failed, 26 tests passed.
- GREEN focused run: 4 test files passed, 30 tests passed.
- Static frontend audit: pass with 0 violations and 0 coverage issues across 32 page files, 23 component files, and 20,967 CSS lines.
- The provenance and editor summary selectors now have separate rules with complete canonical typography tuples. Geometry declarations remain shared.

## Production Browser Contract

- Before build: `tests/north-star-document-ux.test.ts` conditionally skipped all 4 viewport cases with the explicit reason `missing .next/BUILD_ID; run npm.cmd run build first`.
- Normal build: pass; 28 static pages generated.
- After build: 4 of 4 viewport cases passed in the production browser harness.
- Geometry: summary height 50px; horizontal overflow, nested scroll containers, clipped controls, interaction overlaps, overlay overlaps, undersized touch targets, and section overlaps were all 0.

## Verification

- `npm.cmd run typecheck`: pass.
- `npm.cmd run build`: pass.
- `git diff --check`: pass.
- CI-order full test before build completed with 135 passed files, 6 skipped files, and 9 failed files. The failures were isolated to the known stale frontend route identity, dirty working-tree provenance guards, and missing fresh-worktree dependencies/temporary pnpm virtual-store setup. The North Star suite itself conditionally skipped 4 of 4 cases as intended.

## Logs

- `full-test-before-build.log`
- `north-star-before-build.log`
- `typecheck.log`
- `frontend-audit.log`
- `build.log`
- `north-star-after-build.log`
