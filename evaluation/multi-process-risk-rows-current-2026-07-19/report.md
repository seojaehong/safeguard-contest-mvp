# Multi-Process Risk Rows Current Gate

- Generated: 2026-07-19T12:04:00+09:00
- Base HEAD before change: `25c29653673450ff02667c34e7dc3f2e1e5ba163`
- Scope: risk assessment structured rows prompt contract

## Verdict

PASS for the prompt-level current gate.

The previous structured risk rows prompt treated every scenario as a fixed 5-7 row job. That was too weak for explicit multi-process work such as "굴착, 토사반출, 자재양중". The prompt now extracts explicit process labels from the question/work summary and requires per-process coverage when at least two processes are named.

## Product Change

- Single-process or ambiguous work keeps the existing 5-7 row budget.
- Explicit multi-process work now instructs the provider to:
  - keep each named process in the `process` field
  - create at least 2 rows per named process
  - allow up to 18 rows
  - avoid merging multiple processes into one row

## Verification

- RED: `tests/ai-deliverables-generation-trace.test.ts` failed because the structured risk rows prompt did not contain the multi-process coverage rule.
- GREEN: `npm.cmd test -- tests\ai-deliverables-generation-trace.test.ts --maxWorkers=1 --fileParallelism=false`
- Result: 1 file / 13 tests PASS.
- Regression gate: `npm.cmd test -- tests\ai-deliverables-generation-trace.test.ts tests\ai-deliverables-scope.test.ts tests\naturalize-output-contract.test.ts tests\grounded-generation-contract.test.ts tests\commercial-harness.test.ts --maxWorkers=1 --fileParallelism=false`
- Result: 4 files / 113 tests PASS.
- `npm.cmd run typecheck`: PASS.

## Remaining Work

This closes the prompt-contract hole. It does not yet prove live model compliance for every multi-process output. A later provider-backed smoke should generate an actual 3-process workpack and assert that structured rows include all named processes before using it as a full document-quality claim.
