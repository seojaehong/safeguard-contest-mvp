# SafeClaw 작업 이력 그래프 근거 정합성 검증

검증일: 2026-07-10
대상: `/workspace` 문서 생성 후 편집 화면의 작업 이력 그래프

## 재현 입력

> 세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계를 사용하고 작업자 5명 중 신규 투입자 1명이 포함된다. 오후 강풍 예보가 있으며 자재 반입 지게차 동선과 작업자 통행 동선이 겹친다.

## 발견한 문제

위험성평가 구조화 행에는 지게차 동선, 이동식 비계·강풍, 도료·유기용제 화재 조치가 정상 반영됐다. 그러나 편집 화면의 작업 이력 그래프에는 외벽 도장 작업과 무관한 아래 조치가 다시 나타났다.

- 가동부 방호덮개 설치 및 비상정지장치 작동 확인
- 정비 전 전원 차단 및 잠금표지(LOTO)

## 근본 원인

1. 일부 추락 SIF 원시 레코드에는 추락 조치와 기계 조치가 함께 저장되어 있었다.
2. 운영 조치 분류기가 원시 `controls`까지 분류 텍스트로 사용하면서 잘못 붙은 기계 조치가 기계 근거라는 신호로 다시 사용됐다.
3. 신규 DB 하네스 패킷에서 조치를 정규화해도, 과거 작업팩의 `short_summary`와 봉인된 reference controls를 작업 이력 그래프가 그대로 투영할 수 있었다.

## 수정

- 작업 분류에는 title, category, summary, body, keywords, risk tags만 사용하고 raw controls는 사용하지 않는다.
- B-E-17과 B-M-11은 공식 코드·원문 정체성으로 운영 조치를 고정한다.
- 추락+기계 정비 SIF는 추락 방호와 LOTO를 함께 보존한다.
- 비계 부재 사이 끼임 같은 비기계 SIF는 추락·협착 통제를 사용하고 기계 방호·LOTO를 배제한다.
- 작업 이력 그래프는 신규/과거 reference 모두 `deriveSafetyReferenceOperationalView()`를 거쳐 Evidence 상세와 Control 노드를 만든다.
- 원시 provenance는 수정하지 않고, 사용자에게 보이는 운영 표면만 재정규화한다.

## TDD 증거

실제 오염 SIF와 레거시 저장 스냅샷을 포함한 회귀 테스트를 먼저 추가했다.

- RED: 그래프 Control 노드에서 방호덮개·비상정지장치·LOTO가 검출되어 실패
- GREEN: 지게차 동선, 비계·강풍, 도료 화재 조치는 유지되고 무관 조치는 제거
- Evidence 상세도 같은 금지 문구를 포함하지 않는지 함께 검증

집중 검증:

```text
npm.cmd test -- tests/workspace-operation-graph.test.ts tests/operation-memory-visualization.test.ts tests/generation-evidence-operation-routes.test.ts --run
3 files passed, 10 tests passed

npm.cmd test -- tests/workspace-operation-graph.test.ts tests/safety-reference-hybrid.test.ts --run
2 files passed, 18 tests passed

npm.cmd test -- tests/safety-reference-hybrid.test.ts tests/workspace-operation-graph.test.ts tests/operation-memory-visualization.test.ts tests/generation-evidence-operation-routes.test.ts --run
4 files passed, 24 tests passed

npm.cmd run typecheck
passed

npm.cmd run build
passed, 27 static pages generated

npm.cmd test -- --maxWorkers=1 --fileParallelism=false
88 files passed, 656 tests passed

```

## 실제 브라우저 검증

로컬 production build를 `http://localhost:3118`에서 실행하고 입력부터 12종 생성, 편집 진입, 그래프 렌더링까지 재실행했다.

데스크톱:

- 편집 화면이 기존 표 화면으로 되돌아가지 않음
- 지게차 동선 조치 표시
- 이동식 비계·강풍 조치 표시
- 도료·유기용제 화재 조치 표시
- 방호덮개·비상정지장치·LOTO 미표시
- 정전도장기·피도장물 접지 오염 미표시
- 가로 넘침 없음

모바일 390 x 844:

- 같은 근거 정합성 조건 통과
- 가로 넘침과 화면 밖 도형 없음
- 편집 화면 전체 길이는 약 16,067px로 길어 후속 정보 구조 축소가 필요

캡처:

- `output/playwright/2026-07-10/operation-graph-fix/editor-desktop-headless.png`
- `output/playwright/2026-07-10/operation-graph-fix/editor-mobile-headless.png`

## 후속 UI 판정

기능 정합성은 회복됐지만 편집 화면은 워크스페이스의 조용한 Linear 계열 톤보다 노랑·주황 도구 카드가 강하고, 모바일에서는 한 화면에 순차 노출되는 섹션이 많다. 다음 UI 작업에서는 문서 편집을 중심에 두고 운영 체크, 파일 다운로드, Claw 질의, 작업 이력 그래프를 필요 시 여는 보조 패널로 단계적으로 접어야 한다.

## 아직 남은 검증

- Preview 배포 후 보호된 `/api/ask` 응답과 편집 그래프 재검증

독립 코드 리뷰는 B-E-17, B-M-11, 정상 기계·밀폐공간 LOTO, 비기계 끼임, 복합 추락·불시기동, raw provenance 불변성 경계를 확인하고 승인했다.
