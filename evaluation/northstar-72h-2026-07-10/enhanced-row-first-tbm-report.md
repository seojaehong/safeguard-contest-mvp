# Enhanced Row-First TBM Gate

검증 일시: 2026-07-10
대상: enhanced 생성 경로

## 배경

직전 라이브 기준 enhanced 경로는 `qualityContract.overall=ready`까지 도달했지만, 전체 응답은 약 62초였다. 남은 병목은 `deliverables` 단계 내부에서 `tbmBriefingStructured`, `tbmLogStructured`, `structuredRiskRows`를 모두 AI 호출로 기다리는 구조였다.

멘토링 이후 SafeClaw의 제품 정의는 "문서 많이 생성"이 아니라 "DB 하네스가 근거와 개선 이력을 먼저 고정하고, 오늘 위험성평가/TBM으로 되돌리는 운영 루프"다. 따라서 enhanced 경로는 TBM 문서를 다시 AI로 쓰기보다, 확정된 위험성평가 row에서 TBM 브리핑/기록 구조를 재생성 가능하게 조립하는 편이 더 맞다.

## 수정

- enhanced AI doc scope를 `structuredRiskRows` 1개로 축소했다.
- `tbmBriefingStructured`는 `structuredRiskRows`에서 deterministic 생성한다.
- `tbmLogStructured`도 같은 row에서 deterministic 생성하고, `relatedRiskRowIndex`를 유지한다.
- 진행 콘솔 카피를 `AI 본문 초안 생성`에서 `구조화 산출물 조립`으로 바꿨다.
- `structuredRiskRows` 진행 카피를 `위험요인-조치 row 확정`으로 바꿨다.

## 기대 효과

- enhanced 진행 콘솔에서 보이는 doc event가 한 개로 줄어든다.
- TBM 브리핑/기록은 위험성평가 row와 항상 같은 hazard/control을 사용한다.
- 작업자 공유/확인용 TBM이 "AI 산문"이 아니라 "하네스가 고정한 row의 파생물"이 된다.
- 다음 라운드에서 속도 병목을 `structuredRiskRows` 단일 호출로 좁힐 수 있다.

## 로컬 검증

- `npm.cmd test -- tests\ai-deliverables-scope.test.ts tests\workspace-generation-progress.test.ts tests\tbm-deterministic-structures.test.ts tests\quality-contract.test.ts tests\commercial-harness.test.ts tests\workpack-readiness.test.ts tests\operation-improvement-history.test.ts`
  - 7 files / 34 tests passed
- `npm.cmd test -- tests\tbm-deterministic-structures.test.ts tests\ai-deliverables-scope.test.ts tests\workspace-generation-progress.test.ts`
  - 3 files / 10 tests passed
- `npm.cmd run build`
  - passed
- `npm.cmd run typecheck`
  - passed

## 라이브 검증 기준

배포 후 `https://www.safeclaw.kr/api/ask/stream`에 동일한 성수동 외벽 도장 케이스를 호출해 아래를 확인한다.

- doc events가 `structuredRiskRows`만 남는지
- doc failures / stage failures가 없는지
- `qualityContract.overall=ready` 유지
- `structured.readyCount=3`, `structured.requiredCount=3` 유지
- `deliverables.tbmBriefingStructured`와 `deliverables.tbmLogStructured`가 최종 payload에 존재하는지
- `structured.tbmRiskLinks`가 유지되는지
- 사진 개선 이력과 SIF/KOSHA 근거가 answer에 계속 반영되는지

## 라이브 검증 결과

배포 커밋: `750fd6c`
프로덕션 alias: `https://www.safeclaw.kr`

- 전체 응답: 59.4초
- `generationMode`: `enhanced`
- doc events: `structuredRiskRows`
- doc failures: 없음
- stage failures: 없음
- `qualityContract.overall`: `ready`
- 구조화 검수: `3/3 ready`
- DB 하네스: `ready`
- 온톨로지 QA: `ready`, `통과`
- 최종 `structured.tbmRiskLinks`: 5건 유지
- `deliverables.tbmBriefingStructured`: 존재, hazard 5건
- `deliverables.tbmLogStructured`: 존재, hazard 5건
- `status.detail`: `TBM structured=deterministic from risk rows` 포함
- 사진 개선 이력, SIF/KOSHA 근거: answer에 반영됨
- raw fallback/camelCase/오탈자 `지게브`: 노출 없음

판정: enhanced는 이제 AI가 3종 문서를 각각 쓰는 경로가 아니라, 위험성평가 row를 확정한 뒤 DB 하네스 기반으로 TBM 브리핑/기록을 조립하는 row-first 경로로 동작한다. 62.0초에서 59.4초로 개선 폭은 크지 않지만, 다음 병목이 `structuredRiskRows` 단일 AI 호출임을 확정했다. 다음 라운드는 `structuredRiskRows` 자체를 DB/SIF/KOSHA 후보 row + LLM 보정 또는 deterministic row builder로 더 줄이는 방향이 맞다.
