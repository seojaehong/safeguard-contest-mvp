# Grounded Generation Remediation

## Candidate

- Starting HEAD: `cb43e4d10416150577cfe88179cdced5f4a23e94`
- Branch: `fix/northstar-grounded-current-20260715`
- Replayed source commits: `875dfe1`, `f473be6`, `68010bb`, `cdf53d8`, `7f568c1` (exact commits only; no range merge)
- LLM role: `naturalize_only`
- Status: independent findings remediated; focused verification passed

## Closed independent findings

1. Control suffixes now accept only parenthesized canonical citation tokens. A valid KOSHA token does not authorize adjacent arbitrary prose.
2. `runAsk` now preserves `sourceIdentity` and every packet `criticalControl` on `AskResponse.groundingReview` after an outer pipeline failure. `AnswerPanel` renders that review surface.
3. Duplicate source keys are deterministically deduplicated. Scalar fields come from the canonical representative; aliases and controls are canonically merged and deduplicated.
4. Actionable control sentences in narrative drafts are checked against packet controls even when they carry no KOSHA or law token. Unsupported installation, isolation, PPE, stop-work, and similar instructions fail closed as `control_claim_not_in_packet`.
5. The second independent review expanded the gate beyond verb keywords: instruction-shaped narrative sentences and every structured control field used by work plans, TBM, education, permits, and emergency response now resolve to an immutable packet control or fail closed.
6. `groundingReview` now carries rejected document groups and issue paths through `runAsk`; `AnswerPanel` renders Korean document, field, and remediation labels for human confirmation.

## Editor-focus diagnosis

The editor-focus assertion passed in every reproduction run. The intermittent suite failure occurred afterward during Windows cleanup: `taskkill` returned before the isolated Next server emitted `exit`, and immediate temporary-directory deletion raised `EPERM`.

- Initial loop: 10 editor-focus assertions passed; 1 suite cleanup failure.
- Bounded deletion retry alone: 3 editor-focus assertions passed; 1 suite cleanup failure. This was not accepted as fixed.
- Final fix: wait up to 5 seconds for the killed process tree to exit, fail explicitly if it remains alive, then use bounded filesystem retries.
- Final post-fix loop: 3 editor-focus assertions passed; 0 suite cleanup failures.

## Verification

- Grounding and generation focused suite: 4 files, 84 tests passed.
- Isolated browser harness suite: 1 file, 3 tests passed.
- Final editor-focus repetition: 3 runs passed, 21 unrelated tests skipped per run, 0 cleanup failures.
- Strict TypeScript typecheck: passed after lock-respecting dependency sync; package and lockfile diff remained empty.
- `git diff --check`: passed before the final report-only update and is rerun before commit.

No database schema, migration, environment contract, or destructive data operation was changed.
