# Launch edit revalidation P0

## Scope

- Authoritative base: `d42e143575c636fcc6e698b9c9eb35609c70b156`
- Isolated worktree: `safeguard-contest-mvp-launch-revalidation`
- Owned product files: `components/SafeGuardCommandCenter.tsx`, `lib/workpack-readiness.ts`
- Excluded: share localization and dispatch provider files

## Result

- A user edit clears the prior ontology QA and quality contract.
- The immutable evidence packet is retained, but both packet and summary ontology status are downgraded to `review_required`.
- `편집 내용 다시 점검` fetches the published ontology graph, validates its shape, and reviews the current canonical document text.
- A fresh ontology QA result and quality contract are produced. The prior verdict is not restored.
- Failed review keeps sharing blocked. Passing review unlocks the share surface.
- Edited content remains in the canonical in-memory and local-storage workpack.
- A further edit invalidates the fresh review again and clears any previously saved workpack id.
- If content changes while graph validation is in flight, the stale result is discarded and the newer edit remains locked for another review.

## TDD Evidence

- RED: readiness test failed with `buildWorkpackRevalidationBasis is not a function` before implementation.
- GREEN: passing canonical welding controls produced a new `통과` QA result and share-ready assessment.
- Fail-closed: removing `화재감시자 배치` produced a non-passing fresh review and kept sharing blocked.
- Browser: generation -> failing edit -> concurrent edit during validation -> stale result discarded -> blocked share -> corrected edit -> passing revalidation -> share completed while preserving both edit sentinels.

## Verification

- `npm.cmd test -- tests/workpack-readiness.test.ts tests/workspace-pages.test.ts tests/workspace-share-simplification.test.ts`
  - 3 files passed, 18 tests passed.
- `npm.cmd run typecheck`
  - Passed with strict TypeScript checks.
- `npm.cmd run build`
  - Passed; 28 static pages generated and `/workspace` compiled.
- `$env:WORKSPACE_REVALIDATION_BROWSER_MODE='prod'; npm.cmd test -- tests/workspace-edit-revalidation-browser.test.ts --pool=forks --maxWorkers=1`
  - 1 file passed, 1 browser test passed.

## Environment Note

The first dev-harness attempts ended before test execution because Vitest workers exited while many parallel Node processes were active. The same focused browser path was then run against the freshly built production server and passed.
