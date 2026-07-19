# Foreign Dispatch Language Polish Gate

Date: 2026-07-20

Worktree: `recipient-foreign-live-gate-20260720`

## Scope

This gate targets the demo-critical foreign worker dispatch path. The production baseline `/api/ask` probe for a hot-work scenario with Vietnamese workers produced a Vietnamese block, but the risk line still contained English fallback labels:

- `confined-space hazard`
- `heat illness`

Those phrases are visible quality regressions for a recipient-facing safety notice.

## Change

The Vietnamese deterministic language pack now covers the remaining detected hazard keys instead of falling back to English labels:

- confined / poor ventilation
- heat stress
- slip
- heavy load
- crane / lifting radius
- excavation / buried utility

The hot-work, poor-ventilation, and high-temperature scenario now has a regression test that requires Vietnamese terms and rejects the English fallback phrases.

## Verification

Command:

```powershell
npm.cmd test -- tests\foreign-worker-languages.test.ts tests\workflow-share-client.test.ts tests\workpack-share-authority-routes.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- Test files: 3 passed / 3
- Tests: 79 passed / 79

Command:

```powershell
npm.cmd run typecheck
```

Result:

- PASS

## Notes

No provider dispatch was called. This is a deterministic recipient-message quality fix and does not claim production SMS/Kakao/email delivery.

