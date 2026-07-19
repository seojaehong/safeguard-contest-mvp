# Multi-Process Evidence Specificity Gate

Date: 2026-07-19

## Verdict

LOCAL PASS. Post-deploy live probe is still required after this commit reaches production.

## Problem

The previous live gate proved that explicit multi-process prompts now preserve process coverage. However, the first post-fix sample also showed a quality gap: adjacent-process evidence could still be reused when the deterministic DB harness needed a second row for a process.

This gate tightens the contract from simple process coverage to process-specific evidence and controls.

## Fix

`buildSafetyReferenceRiskRows()` now:

- only enters multi-process mode when the query clearly asks for multiple processes (`N개 공종`, `공종별`, or `세부공정`);
- avoids borrowing unrelated adjacent-process evidence when a process has no direct matching candidate;
- specializes deterministic fallback rows with the requested process label in the hazard, controls, verification, equipment, and evidence refs.

This keeps single complex work descriptions, such as a confined-space pump task with several comma-separated conditions, on the existing task-specific rerank path.

## TDD Evidence

RED:

```text
npm.cmd test -- tests\commercial-harness.test.ts --maxWorkers=1 --fileParallelism=false
FAIL keeps deterministic multi-process rows tied to process-specific evidence instead of borrowing adjacent process refs
expected generic fallback row text to match /굴착|절토|낙석|사면/
```

Regression caught during GREEN:

```text
FAIL preserves upstream task-specific rerank order when building risk rows
```

The initial multi-process parser was too broad and treated comma-separated single-task conditions as multiple processes. The implementation was narrowed to explicit multi-process markers.

GREEN:

```text
npm.cmd test -- tests\commercial-harness.test.ts --maxWorkers=1 --fileParallelism=false
1 file / 55 tests PASS
```

Regression:

```text
npm.cmd test -- tests\ai-deliverables-generation-trace.test.ts tests\ai-deliverables-scope.test.ts tests\naturalize-output-contract.test.ts tests\grounded-generation-contract.test.ts tests\commercial-harness.test.ts --maxWorkers=1 --fileParallelism=false
4 files / 115 tests PASS
```

TypeScript:

```text
npm.cmd run typecheck
PASS
```

## Post-Deploy Gate

After deployment reaches this commit, rerun the live `/api/ask` multi-process probe and require:

- each requested process still has at least two structured risk rows;
- row text for each process contains process-specific equipment, hazard, controls, or evidence terms;
- the single-task rerank path remains unchanged for comma-separated non-process conditions.
