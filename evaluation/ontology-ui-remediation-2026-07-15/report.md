# SafeClaw 온톨로지 UI P0 개선 보고서

## 범위

- 통합 기준 HEAD: `b48a618`
- 제품 커밋: `8f6330912069208c13e7304893e3c99290b24c07`
- 전용 브랜치: `fix/northstar-ontology-ui-20260715`
- 소유 범위: `app/ontology/**`, 온톨로지 전용 테스트, 이 평가 산출물
- DB, 온톨로지 schema, published 데이터, retrieval 계약 변경: 없음

## P0 원인과 조치

기존 `/ontology`는 작업 메모리 그래프, 32개 전역 그래프, 166개 전체 노드 목록을 연속 렌더링했습니다. 실제 live 감사에서 메인 그래프 노드 겹침 62쌍과 dark-on-dark 대비 실패가 확인됐습니다.

이번 변경은 데이터 삭제 없이 표시 범위를 다음처럼 재구성했습니다.

1. 선택 항목의 직접 관계 또는 확장 관계만 BFS로 구성합니다.
2. 화면 표시 노드는 최대 15개로 제한하고 결정적 고정 슬롯을 사용합니다.
3. desktop은 고대비 밝은 노드 카드, 직접 연결선 강조, 검색·유형·정렬·확대 제어를 제공합니다.
4. mobile은 축소 그래프를 기본 렌더링하지 않고 관계 카드를 표시합니다. 그래프는 명시적인 전체 화면 동작에서만 엽니다.
5. 전체 노드는 밝은 검색 목록으로 보존하되 18개씩 점진 노출합니다.
6. 그래프 JSON과 MD/JSONL/Obsidian 경로는 접힌 `원본 데이터 내보내기`로 강등했습니다.
7. 내부 데이터 값은 유지하면서 첫 화면의 published/seed/node/hop 표현만 고객용 한국어로 치환했습니다.
8. 전체 화면 dialog는 초기 포커스, Tab 순환, Escape 닫기, 호출 버튼 포커스 복귀를 보장합니다.

## TDD 기록

- RED 1: 밀집된 확장 관계 15개를 기존 슬롯에 배치했을 때 노드 겹침 2쌍 검출
- RED 2: 신규 CSS의 raw hex/rgba와 내부 제품 용어 노출 검출
- RED 3: 브라우저가 확장 관계를 클릭하지 않는 기존 계측 계약 검출
- RED 4: CSS Color 4 `color(srgb ...)`를 0~255 RGB로 오독해 대비 `1.16:1`로 오판
- GREEN: 5×3 비중첩 슬롯, 변수 기반 색상, 고객용 presentation label, 실제 확장 관계 클릭 및 CSS Color 4 환산을 적용해 desktop Day/Night 노드 대비 `16.01:1`

## 검증 결과

- focused ontology/unit/navigation/typography: 8 files, 49 tests PASS
- production browser contract: 1 file, 1 test PASS
- strict TypeScript typecheck: PASS
- production build: PASS, static generation units 28
- frontend static audit: PASS, 32 pages, 23 product components, coverage issues 0, violations 0
- ontology CSS raw hex/rgba: 0
- `git diff --check`: PASS (Windows LF/CRLF 안내만 발생)

### 브라우저 계측

| 변형 | 표시 노드 | 겹침 | 가로 넘침 | 최소 제어 | 노드 대비 | 모바일 관계 기본 | 전체 화면 |
|---|---:|---:|---:|---:|---:|---|---|
| desktop Day | 15 | 0 | 0 | 44px | 16.01:1 | 숨김 | 제공 |
| desktop Night | 15 | 0 | 0 | 44px | 16.01:1 | 숨김 | 제공 |
| mobile Day | 기본 0 / 전체 화면 15 | 0 | 0 | 44px | 해당 없음 | 표시 | 키보드 계약 검증 |
| mobile Night | 기본 0 / 전체 화면 15 | 0 | 0 | 44px | 해당 없음 | 표시 | 키보드 계약 검증 |

원시 계측: `browser-metrics.json`

정적 감사: `static-audit.json`

스크린샷:

- `desktop-day.png`
- `desktop-night.png`
- `mobile-day.png`
- `mobile-night.png`

## 통합 후 필수 게이트

- 이 브랜치는 main에 통합하지 않았습니다.
- 전역 frontend 108행 감사는 source identity가 바뀌므로 authoritative 통합 HEAD에서 재생성해야 합니다.
- live 배포 후 `/ontology` 1440/390 Day/Night를 다시 확인해야 합니다.
- 기존 전역 CSS의 퇴역 온톨로지 selector는 별도 전역 정리에서 제거해야 하며, 이번 bounded 변경에서는 시각적으로 사용하지 않습니다.
