# Grounded Generation Remediation

## Candidate

- Starting HEAD: `cdf53d8b028bf776cee93256c7ee49acc428f77e`
- Branch: `fix/northstar-grounded-generation-20260715`
- LLM role: `naturalize_only`
- Status: independent findings remediated; focused verification passed

## Closed independent findings

1. Control suffixes now accept only parenthesized canonical citation tokens. A valid KOSHA token does not authorize adjacent arbitrary prose.
2. `runAsk` now preserves `sourceIdentity` and every packet `criticalControl` on `AskResponse.groundingReview` after an outer pipeline failure. `AnswerPanel` renders that review surface.
3. Duplicate source keys are deterministically deduplicated. Scalar fields come from the canonical representative; aliases and controls are canonically merged and deduplicated.

## Editor-focus diagnosis

The editor-focus assertion passed in every reproduction run. The intermittent suite failure occurred afterward during Windows cleanup: `taskkill` returned before the isolated Next server emitted `exit`, and immediate temporary-directory deletion raised `EPERM`.

- Initial loop: 10 editor-focus assertions passed; 1 suite cleanup failure.
- Bounded deletion retry alone: 3 editor-focus assertions passed; 1 suite cleanup failure. This was not accepted as fixed.
- Final fix: wait up to 5 seconds for the killed process tree to exit, fail explicitly if it remains alive, then use bounded filesystem retries.
- Final post-fix loop: 3 editor-focus assertions passed; 0 suite cleanup failures.

## Verification

- Grounding and generation focused suite: 4 files, 69 tests passed.
- Isolated browser harness suite: 1 file, 3 tests passed.
- Final editor-focus repetition: 3 runs passed, 21 unrelated tests skipped per run, 0 cleanup failures.
- Strict TypeScript typecheck: passed before final report update; rerun in final gate.
- `git diff --check`: pending final gate after report update.

No database schema, migration, environment contract, or destructive data operation was changed.
