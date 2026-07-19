# Multi-Process Fallback Quality Gate

Date: 2026-07-19

## Verdict

PASS. Local TDD gates passed, and the post-deploy live `/api/ask` probe confirmed production is serving the same process-specific fallback behavior at commit `aef86987a205996b2cb75bd91779952a2840b3e1`.

## Problem

After cross-process evidence borrowing was blocked, the DB harness correctly preserved process coverage but could fall back to generic rows. In live output, this meant each requested process had two rows, but rows could still read like generic weather/equipment checks rather than excavation, soil haulage, or material lifting controls.

## Fix

`buildSafetyReferenceRiskRows()` now uses process-specific deterministic fallback rows for common explicit construction processes:

- `굴착`: excavation face/slope collapse, burial/struck-by risk, excavator swing-radius control.
- `토사반출`: dump truck movement, reverse/turning zones, haul road and load management.
- `자재양중`: mobile crane, rigging, hook latch, lifting radius, outrigger/weather controls.

These rows are used only when direct process evidence is missing or rejected as ambiguous. Verified direct SIF/KOSHA evidence still wins.

## TDD Evidence

RED:

```text
npm.cmd test -- tests\commercial-harness.test.ts --maxWorkers=1 --fileParallelism=false
FAIL uses process-specific deterministic fallback controls when direct process evidence is ambiguous
expected generic fallback text to match /굴착면|사면|매몰|붕괴|굴삭기/
```

GREEN:

```text
npm.cmd test -- tests\commercial-harness.test.ts --maxWorkers=1 --fileParallelism=false
1 file / 58 tests PASS
```

Regression:

```text
npm.cmd test -- tests\ai-deliverables-generation-trace.test.ts tests\ai-deliverables-scope.test.ts tests\naturalize-output-contract.test.ts tests\grounded-generation-contract.test.ts tests\commercial-harness.test.ts --maxWorkers=1 --fileParallelism=false
4 files / 118 tests PASS
```

TypeScript:

```text
npm.cmd run typecheck
PASS
```

## Post-Deploy Gate

The live production probe passed on 2026-07-19:

```text
POST https://www.safeclaw.kr/api/ask
commitSha: aef86987a205996b2cb75bd91779952a2840b3e1
status: 200
structuredRiskRowCount: 6
processCounts: 굴착 2 / 토사반출 2 / 자재양중 2
missingExpectedProcesses: 0
underCoveredExpectedProcesses: 0
qualityFailures: 0
```

Evidence files:

- `evaluation/multi-process-fallback-quality-2026-07-19/live-postdeploy-summary.json`
- `evaluation/multi-process-fallback-quality-2026-07-19/live-postdeploy-sample.json`

The live `/api/ask` multi-process probe required:

- `굴착` rows include excavation-specific terms such as `굴착면`, `사면`, `매몰`, `붕괴`, or `굴삭기`;
- `토사반출` rows include haulage-specific terms such as `덤프트럭`, `후진`, `가설도로`, or `차량 동선`;
- `자재양중` rows include lifting-specific terms such as `이동식 크레인`, `줄걸이`, `인양`, or `양중`;
- no requested process falls back to unrelated scaffold/checklist wording.

All four requirements passed in production.
