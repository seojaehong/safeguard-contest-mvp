# Live Multi-Process Generation Gate

Date: 2026-07-19

## Verdict

PASS after deployment of `08798afcb395c516adde31a65c7e823c63323bc0`.

Before the patch, the live `/api/ask` route accepted `aiMode: "full"` and returned HTTP 200, but the produced structured risk rows did not preserve the three requested process labels.

## Live Probe Input

`서울 성수동 복합건물 현장. 굴착, 토사반출, 자재양중 3개 공종을 오늘 동시에 진행한다. 작업자 8명, 굴삭기 1대, 덤프트럭 2대, 이동식 크레인 1대 사용. 각 공종별 위험성평가 rows와 TBM 핵심 확인사항을 만들어줘.`

## Live Probe Result Before Patch

- Route: `POST https://www.safeclaw.kr/api/ask`
- Status: `200`
- Requested mode: `full`
- Response mode: `live`
- Generation mode: `full`
- Structured risk rows: `5`
- Process counts: `건설업 외벽 도장 작업: 5`
- Missing requested processes: `굴착`, `토사반출`, `자재양중`
- Under-covered requested processes: `굴착`, `토사반출`, `자재양중`
- Source detail: `structured rows=DB harness deterministic`

The failure was not an HTTP/API failure. It was a DB-harness materialization issue: deterministic rows collapsed multiple requested processes into the scenario default process label.

Raw probe summaries:

- `response-summary.json`
- `response-sample.json`

## Fix

`buildSafetyReferenceRiskRows()` now detects explicit multi-process prompts and preserves each requested process as its own `process` label. For two or more explicit processes, the deterministic DB harness now creates at least two rows per process, bounded to 18 rows, using matching SIF/KOSHA/direct evidence first and baseline rows only as a coverage backstop.

## TDD Evidence

RED:

```text
npm.cmd test -- tests\commercial-harness.test.ts --maxWorkers=1 --fileParallelism=false
FAIL preserves explicit multi-process labels in deterministic DB harness risk rows
expected 0 to be greater than or equal to 2
```

GREEN:

```text
npm.cmd test -- tests\commercial-harness.test.ts --maxWorkers=1 --fileParallelism=false
1 file / 54 tests PASS
```

Regression:

```text
npm.cmd test -- tests\ai-deliverables-generation-trace.test.ts tests\ai-deliverables-scope.test.ts tests\naturalize-output-contract.test.ts tests\grounded-generation-contract.test.ts tests\commercial-harness.test.ts --maxWorkers=1 --fileParallelism=false
4 files / 114 tests PASS
```

TypeScript:

```text
npm.cmd run typecheck
PASS
```

## Post-Deploy Live Gate

After deployment reached `08798afcb395c516adde31a65c7e823c63323bc0`, the same live `/api/ask` probe passed:

- Route: `POST https://www.safeclaw.kr/api/ask`
- Status: `200`
- Build-info commit: `08798afcb395c516adde31a65c7e823c63323bc0`
- Structured risk rows: `6`
- Process counts: `굴착: 2`, `토사반출: 2`, `자재양중: 2`
- Missing requested processes: none
- Under-covered requested processes: none
- Source detail: `structured rows=DB harness deterministic`

Postfix probe summaries:

- `postfix-response-summary.json`
- `postfix-response-sample.json`

## Follow-Up Quality Note

The fixed live response now preserves process coverage. Some evidence rows are still reused across process labels when the DB harness has stronger matching evidence for one process than another. That is acceptable for this gate but should be refined in the next quality pass with stricter per-process evidence matching and process-specific controls.
