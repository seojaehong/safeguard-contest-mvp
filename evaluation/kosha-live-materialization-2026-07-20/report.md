# KOSHA Live Materialization Gate

Generated at: 2026-07-19T22:50:46.421Z

Production commit: `43559c89c4fe180a0867de7b47b2bab756e75990`

Findings: 3

## Case Summary

| Case | Ask OK | KOSHA status | KOSHA refs | KOSHA citations | Deliverable KOSHA mentions | Internal terms |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| scaffold-fall | true | live / live | 5 | 0 | 34 | DB 하네스, fallback |
| hotwork-ventilation | true | live / live | 6 | 0 | 20 | DB 하네스, fallback |
| electrical-panel | true | live / live | 6 | 0 | 29 | DB 하네스, fallback |

## Findings

- P2 scaffold-fall: internal-terms {"severity":"P2","id":"scaffold-fall","issue":"internal-terms","terms":["DB 하네스","fallback"]}
- P2 hotwork-ventilation: internal-terms {"severity":"P2","id":"hotwork-ventilation","issue":"internal-terms","terms":["DB 하네스","fallback"]}
- P2 electrical-panel: internal-terms {"severity":"P2","id":"electrical-panel","issue":"internal-terms","terms":["DB 하네스","fallback"]}

## Local Remediation

The production baseline above proved KOSHA materialization was working, but the public `/api/ask` response still exposed internal diagnostic language in visible response fields. A bounded remediation now sanitizes only public response surfaces while preserving internal audit evidence under `dbHarness`, `generationEvidence`, and `generationTrace`.

Public replacements include:

- `DB 하네스` -> `고정 근거`
- `AI_MODE=enhanced` -> `생성 모드: 강화`
- `row-first` -> `위험요인 표 우선`
- `deterministic` -> `규칙 기반`
- `fallback path` -> `보조 응답 경로`
- `graceful fallback 정책` -> `보조 응답 정책`

The KOSHA materialization runner was also updated to split public internal-term hits from internal-only audit paths, so future post-deploy reruns do not fail merely because raw audit fields correctly retain machine evidence.

Verification:

- `npm.cmd test -- tests\ask-public-surface.test.ts tests\answer-panel-display.test.ts tests\kosha-current-review-run-ask.test.ts --maxWorkers=1 --fileParallelism=false` — 3 files / 44 tests PASS
- `npm.cmd run typecheck` — PASS after build completed
- `npm.cmd run build` — 28/28 static pages PASS

## Sample KOSHA Lines

### scaffold-fall

```text
[KOSHA 보강] KOSHA 위험성평가 사업안내 (공식 링크 확인)
KOSHA 교육포털 메타데이터 확인 성공. 교육대상 28개, 과정 후보 3건을 반영했습니다.
KOSHA·고용노동부 공식 자료 URL 5건 확인. 확인된 자료의 서식 힌트와 반영 위치를 위험성평가·TBM·교육 기록에 적용했습니다.
KOSHA
KOSHA 위험성평가 사업안내
KOSHA
KOSHA 위험성평가 교육자료
위험성평가 작성과 작업자 공유 교육에 활용할 수 있는 KOSHA 교육자료입니다.
KOSHA
KOSHA 작업 전 안전점검회의(TBM) OPS
KOSHA
산업안전보건교육 가이드북
```

### hotwork-ventilation

```text
[KOSHA 보강] KOSHA 위험성평가 사업안내 (공식 링크 확인)
KOSHA 교육포털 메타데이터 확인 성공. 교육대상 28개, 과정 후보 3건을 반영했습니다.
KOSHA·고용노동부 공식 자료 URL 6건 확인. 확인된 자료의 서식 힌트와 반영 위치를 위험성평가·TBM·교육 기록에 적용했습니다.
KOSHA
KOSHA 위험성평가 사업안내
KOSHA
KOSHA 위험성평가 교육자료
위험성평가 작성과 작업자 공유 교육에 활용할 수 있는 KOSHA 교육자료입니다.
KOSHA
KOSHA 작업 전 안전점검회의(TBM) OPS
KOSHA
산업안전보건교육 가이드북
```

### electrical-panel

```text
[KOSHA 보강] KOSHA 위험성평가 사업안내 (공식 링크 확인)
KOSHA 교육포털 메타데이터 확인 성공. 교육대상 28개, 과정 후보 3건을 반영했습니다.
KOSHA·고용노동부 공식 자료 URL 6건 확인. 확인된 자료의 서식 힌트와 반영 위치를 위험성평가·TBM·교육 기록에 적용했습니다.
KOSHA
KOSHA 위험성평가 사업안내
KOSHA
KOSHA 위험성평가 교육자료
위험성평가 작성과 작업자 공유 교육에 활용할 수 있는 KOSHA 교육자료입니다.
KOSHA
KOSHA 작업 전 안전점검회의(TBM) OPS
KOSHA
산업안전보건교육 가이드북
```
