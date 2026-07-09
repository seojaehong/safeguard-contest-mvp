# Enhanced Core Scope Speed Gate

검증 일시: 2026-07-10
대상: `https://www.safeclaw.kr/api/ask/stream`

## 목적

멘토링 이후 목표는 "문서 수"가 아니라 DB 하네스, 온톨로지 QA, 사진 개선 이력, SIF/KOSHA 근거가 위험성평가와 TBM에 실제로 반영되는지이다. 따라서 enhanced 모드는 12종 문서를 모두 AI로 다시 쓰지 않고, 위험성평가/TBM 핵심 산출물만 생성해야 한다.

## 라이브 기준 발견 사항

직접 SSE 호출 결과 enhanced 모드의 비핵심 문서 범위 제한은 적용되어 있었다.

- 생성 문서 이벤트: `riskAssessment`, `tbmBriefingStructured`, `tbmLogStructured`, `structuredRiskRows`, `tbmRiskLinks`
- 비핵심 이벤트 노출 없음: `workPlanStructured`, `educationRecordStructured`, `tbmLog`, `free`, `foreign`
- DB 하네스 상태: `ready`
- 온톨로지 QA: `ready`, `통과`
- 사진 개선 이력 반영: 확인됨
- raw fallback 문구 노출: 없음

다만 전체 응답은 87.8초가 걸렸고, 병목은 `tbmRiskLinks` AI 호출이었다.

| 이벤트 | 완료 시점 |
| --- | ---: |
| `riskAssessment` | 64.1초 |
| `tbmBriefingStructured` | 64.1초 |
| `tbmLogStructured` | 64.1초 |
| `structuredRiskRows` | 64.1초 |
| `tbmRiskLinks` | 87.5초 |

## 수정

enhanced 모드에서는 `tbmRiskLinks`를 별도 AI 호출로 생성하지 않는다. 이미 생성된 `structuredRiskRows`를 기준으로 `lib/search.ts`의 deterministic 하네스 fallback이 TBM 연결을 만든다.

이 변경은 하네스 원칙과도 맞다.

- DB/구조화 row가 위험요인과 조치를 먼저 고정한다.
- LLM은 핵심 문서 문장화에 집중한다.
- TBM 연결은 고정된 row에서 재생성 가능해야 한다.
- 실패하거나 느린 보조 AI 호출이 최종 공유 준비를 지연시키지 않는다.

## 로컬 검증

- `npm.cmd test -- tests\ai-deliverables-scope.test.ts tests\ai-deliverables-progress.test.ts tests\commercial-harness.test.ts`
  - 3 files / 20 tests passed
- `npm.cmd run build`
  - passed
- `npm.cmd run typecheck`
  - passed after build regenerated `.next/types`

## 후속 라이브 검증 기준

배포 후 같은 SSE 요청으로 아래를 다시 확인한다.

- enhanced doc events에서 `tbmRiskLinks`가 사라지는지
- 최종 응답의 `structured.tbmRiskLinks`는 deterministic fallback으로 유지되는지
- 전체 elapsed가 기존 87.8초보다 줄어드는지
- 사진 개선 이력, DB 하네스, 온톨로지 QA가 계속 결과 첫머리와 품질 패널에 반영되는지

## 배포 후 1차 결과

배포 커밋: `ca8f090`
프로덕션 alias: `https://www.safeclaw.kr`

- 전체 응답: 66.6초
- doc events: `riskAssessment`, `tbmBriefingStructured`, `tbmLogStructured`, `structuredRiskRows`
- `tbmRiskLinks` doc event: 제거됨
- 최종 `structured.tbmRiskLinks`: 5건 유지
- DB 하네스: `ready`
- 온톨로지 QA: `ready`, `통과`
- raw fallback/camelCase 노출: 없음

속도는 87.8초에서 66.6초로 개선됐다. 다만 품질 계약은 `overall=degraded`로 남았는데, 원인은 enhanced 모드가 의도적으로 `workPlanStructured`를 생성하지 않는데도 품질 계약이 full 모드의 4종 구조화 산출물 기준을 그대로 적용했기 때문이다.

## 후속 수정

`AskResponse.generationMode`를 추가하고, enhanced 응답에는 `generationMode: "enhanced"`를 기록한다. 품질 계약은 enhanced일 때 필수 구조화 산출물을 아래 3종으로 판정한다.

- `riskAssessmentRows`
- `tbmBriefingStructured`
- `tbmLogStructured`

`workPlanStructured`는 full 모드의 필수 구조화 산출물로 유지한다. 이렇게 해야 사용자가 일부러 줄인 enhanced 경로를 "미흡"으로 오해하지 않고, 실제 공유 준비 상태가 UI와 맞게 표시된다.

## 배포 후 2차 결과

배포 커밋: `d383115`

- 전체 응답: 63.8초
- `generationMode`: `enhanced`
- `qualityContract.overall`: `ready`
- 구조화 검수: `3/3 ready`
- DB 하네스: `ready`
- 온톨로지 QA: `ready`, `통과`
- 최종 `structured.tbmRiskLinks`: 6건 유지
- `tbmRiskLinks` doc event: 없음

남은 문제는 `riskAssessment` prose draft AI 호출이 실패 이벤트로 노출된다는 점이다. 최종 문서와 품질 계약은 하네스/구조화 row 기준으로 ready지만, 진행 콘솔에 빨간 실패가 보이면 사용자는 생성 실패로 오해할 수 있다.

## 후속 수정 2

enhanced 모드의 AI 호출 범위에서 `riskAssessment` prose draft를 제거한다. 위험성평가표는 `structuredRiskRows`와 하네스 기반 deterministic 문서 렌더로 구성한다.

enhanced AI doc events 목표:

- `tbmBriefingStructured`
- `tbmLogStructured`
- `structuredRiskRows`

이렇게 하면 enhanced 모드는 "하네스가 고정한 위험 row + TBM 구조화"에 집중하고, 사용자에게 내부 prose draft 실패를 노출하지 않는다.

## 최종 라이브 결과

배포 커밋: `aea1911`

- 전체 응답: 62.0초
- `generationMode`: `enhanced`
- doc events: `tbmBriefingStructured`, `tbmLogStructured`, `structuredRiskRows`
- doc failures: 없음
- stage failures: 없음
- `qualityContract.overall`: `ready`
- 구조화 검수: `3/3 ready`
- DB 하네스: `ready`
- 온톨로지 QA: `ready`, `통과`
- 최종 `structured.tbmRiskLinks`: 5건 유지
- raw fallback/camelCase/오탈자 `지게브` 노출: 없음

판정: enhanced 경로는 이제 12종 문서 생성기가 아니라, DB 하네스가 고정한 근거와 개선 이력을 기반으로 위험성평가 row와 TBM 구조를 우선 생산하는 workbench 경로로 동작한다. 남은 속도 병목은 60초 전후의 핵심 구조화 생성 구간이며, 다음 최적화는 `structuredRiskRows`와 TBM 구조 생성의 prompt 통합 또는 deterministic row-first 생성 확장으로 진행한다.
