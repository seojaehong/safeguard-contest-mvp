# KOSHA Current HEAD Gate

Generated: 2026-07-19 KST

## 기준

- Authoritative source HEAD at latest refresh: `9f02cf63b3d9c7d51d8f86f51d344f941154521d`
- Live build-info during adjacent latest refresh: `7a28f463842cc2ba5bddc5b8bf83046acfa44be6`
- DB schema/data mutation: none

## 판단

Current master already contains the launch-safe KOSHA evidence shape that should be used for the demo path. The stale `feat/kosha-trust-registry-wave2` branch must not be range-merged because it was based on an older product surface and can remove current launch work such as build-info, the share recipient portal, and recent evaluation artifacts.

The correct rule is:

- Keep current-master behavior as authoritative.
- Use stale KOSHA worktrees only as historical review input.
- Port only bounded, reviewed KOSHA deltas onto current master when they are missing.

## 현재 포함된 KOSHA runtime assets

`next.config.mjs` currently traces these exact KOSHA references:

- `data/safety-knowledge/exact-kosha/d-c-13-2026.json`
- `data/safety-knowledge/exact-kosha/d-c-7-2026.json`
- `data/safety-knowledge/exact-kosha/b-e-10-2026.json`

It also traces the current KOSHA guide corpus snapshot:

- `data/safety-knowledge/kosha-guide-corpus/current.json`
- snapshot `e99b7faf268c513c9eed329c016670339d686ba580141e54fe3ffdfafb478a12`
- `manifest.json`
- `items.jsonl.gz`
- `chunks.jsonl.gz`
- `failures.jsonl`

## 검증

Latest focused refresh:

Command:

```powershell
npm.cmd test -- tests\safety-reference-status-route.test.ts tests\exact-trusted-kosha-grounding.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\kosha-grounding-fail-closed.test.ts tests\kosha-current-review-run-ask.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- 5 files PASS
- 68 tests PASS
- Duration: 35.29s

Command:

```powershell
npm.cmd test -- tests\ai-deliverables-generation-trace.test.ts tests\safety-document-rubric.test.ts tests\risk-ref-gate.test.ts tests\workpack-ontology-qa.test.ts -t "structured risk|risk rows|TBM|KOSHA|D-C-13|D-C-7|B-E-10|Phase A|grounding|evidence" --maxWorkers=1 --fileParallelism=false
```

Result:

- 2 files PASS
- 1 file SKIPPED
- 4 tests PASS
- 27 tests SKIPPED
- Duration: 1.97s

Earlier broader gate:

Command:

```powershell
npm.cmd test -- tests\exact-trusted-kosha-grounding.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\exact-trusted-kosha-registry-wave3.test.ts tests\kosha-grounding-fail-closed.test.ts tests\kosha-current-review-run-ask.test.ts tests\exact-kosha-applicability-policy.test.ts tests\kosha-guide-corpus-audit.test.ts tests\kosha-guide-supporting-row-relevance.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- 8 files PASS
- 225 tests PASS
- Duration: 24.21s

Coverage:

- Exact trusted KOSHA grounding.
- Exact registry wave2 and wave3 boundaries.
- KOSHA fail-closed behavior.
- Current review run-ask path.
- Exact KOSHA applicability policy.
- KOSHA guide corpus audit.
- KOSHA guide supporting-row relevance.

## Non-claims

- This does not approve any DB schema migration or bulk data mutation.
- This does not claim every future KOSHA Guide candidate is published or exact-pinned.
- This does not authorize range-merging stale KOSHA worktrees.
- This does not change the dispatch provider state; live provider dispatch may still be preview-only depending on runtime readiness.

## Demo wording

Safe wording:

> SafeClaw first fixes the evidence pack from SIF/KOSHA/current guide assets, then lets the LLM draft within that boundary.

Avoid:

> KOSHA 전체가 완전 학습됐다.

> 모든 법적 적합성을 자동 판정한다.

> 실제 문자/카카오 전송까지 production에서 완료된다.
