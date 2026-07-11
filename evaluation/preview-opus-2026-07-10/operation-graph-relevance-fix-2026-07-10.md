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
4. 이동식 도크 장비 목록은 지게차 상하차 용도임에도 `machinery` 유형만으로 기계 정비 LOTO가 표시될 수 있었다.
5. 지게차 SIF는 사고형태가 추락 또는 적재물 전도·낙하임에도 수집 당시 기계 방호·LOTO가 붙은 레코드가 있었다.
6. SIF `summary`와 `body`를 합친 뒤 첫 `재해개요:`만 추출하면, 앞쪽의 구체적인 사고 요약이 누락되고 오래된 본문 조각이 분류를 덮을 수 있었다.

## 수정

- 작업 분류에는 title, category, summary, body, keywords, risk tags만 사용하고 raw controls는 사용하지 않는다.
- `summary`의 비라벨 사고요약과 `summary/body`의 모든 `재해개요:` 구간을 함께 보존하고, 감소대책 문구는 인과 분류 전에 제거한다.
- 명시된 재해종류와 사고개요를 우선해 추락, 감전·아크, 압력·스팀, 화학물질 노출, 화재·폭발, 지게차, 인양물, 적재물, 낙하물, 밀폐공간을 분리한다.
- 제목·공종·embedding envelope은 사고 원인에서 제외하고, 사고개요에 없는 `risk_tags`만으로 위험을 확정하지 않는다.
- 익사·침수, 폭염·온열질환, 담장·구조물 붕괴, 사일로 매몰, 독성가스, 굴삭기 운반물 사고를 별도 인과 분기로 처리한다.
- 동력설비 끼임은 수작업 끼임과 분리해 방호·접근통제·에너지 격리·LOTO 또는 기계적 고정을 적용한다.
- 밀폐공간은 명시적 질식·산소결핍·유해가스 또는 밀폐장소의 다중 구조사고가 있을 때만 확정하며, 펌프·모터 문맥이 없는 사례에는 설비 LOTO를 만들지 않는다.
- 차량 제동 밀림, 차량 자체 전도·전복, 운행 충돌, 적재물·인양물 낙하를 서로 다른 원인 분기로 분리한다.
- 지게차 포크·적재물 탑승 사고는 실제 결과에 따라 추락과 마스트·프레임 끼임을 분리한다.
- 붕괴는 굴착면·관로, 탱크 슬러지, 터널 막장 낙반을 구체적인 조치로 변환한다.
- 인과 분기에 매칭되지 않은 SIF는 원시 관리대책을 재사용하지 않고 `검토 필요`로 fail-closed 처리한다.
- B-E-17과 B-M-11은 공식 코드·원문 정체성으로 운영 조치를 고정한다.
- 이동식 도크처럼 지게차 상하차·하역 용도가 원문에 명시된 장비는 지게차 동선·신호수 조치로 고정한다.
- 지게차 SIF는 포크·파렛트 탑승 추락과 적재물 전도·낙하를 분리해 각각 추락방지 또는 적재 안정 조치로 변환한다.
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
npm.cmd test -- tests/safety-reference-hybrid.test.ts tests/commercial-harness.test.ts tests/workspace-operation-graph.test.ts tests/operation-memory-visualization.test.ts tests/generation-evidence-operation-routes.test.ts tests/live-harness-quality-probe.test.ts --run
6 files passed, 84 tests passed

npm.cmd test -- tests/safety-reference-hybrid.test.ts tests/commercial-harness.test.ts tests/operation-memory-visualization.test.ts tests/quality-contract.test.ts tests/workpack-ontology-qa.test.ts tests/mcp-tools.test.ts tests/sif-causality-audit-gate.test.ts --run
7 files passed, 124 tests passed

npm.cmd run typecheck
passed

npm.cmd run build
passed, 27 static pages generated

npm.cmd run audit:sif-causality -- --output evaluation/2026-07-11-sif-corpus-causality-v4-audit.jsonl
6,032행, 기준 파일 해시 일치, 결정적 출력, 원본 변이 0건, 인과 플래그 0건, 게이트 실패 0건

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

## SIF 전수 감사

분류기와 같은 사고개요 추출 표면을 사용해 기준 SIF 코퍼스 6,032행을 두 번 변환했다. 장비명만 등장하는 원인 미확정 사례는 확정 조치 대신 검토 필요로 닫고, 컨베이어·파쇄기·크레인·고소작업대·임시 발판 사고의 대표 오분류를 실데이터 회귀로 고정했다.

상세 결과: `evaluation/2026-07-11-sif-corpus-causality-v4-audit.md`

## 아직 남은 검증

- 변경 통합 후 전체 테스트와 브라우저 회귀를 새 상태에서 다시 실행
- Preview 배포 후 보호된 `/api/ask` 응답과 편집 그래프 재검증

독립 코드 리뷰는 B-E-17, B-M-11, 정상 기계·밀폐공간 LOTO, 비기계 끼임, 복합 추락·불시기동, raw provenance 불변성 경계를 확인하고 승인했다.
