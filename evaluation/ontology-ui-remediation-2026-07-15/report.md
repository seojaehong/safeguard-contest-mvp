# SafeClaw 온톨로지 UI P0 개선 보고서

## 범위

- 기준 HEAD: `cb43e4d10416150577cfe88179cdced5f4a23e94`
- 제품 커밋: `108c950`
- 전용 브랜치: `fix/northstar-ontology-ui-20260715`
- 소유 범위: `app/ontology/**`, 온톨로지 전용 테스트, 이 평가 산출물
- DB, 온톨로지 schema, published 데이터, retrieval 계약 변경: 없음

## P0 원인과 조치

기존 `/ontology`는 작업 메모리 그래프, 32개 전역 그래프, 166개 전체 노드 목록을 연속 렌더링했습니다. 실제 live 감사에서 메인 그래프 노드 겹침 62쌍과 dark-on-dark 대비 실패가 확인됐습니다.

이번 변경은 데이터 삭제 없이 표시 범위를 다음처럼 재구성했습니다.

1. 선택 노드의 1홉 또는 2홉 이웃만 BFS로 구성합니다.
2. 화면 표시 노드는 최대 15개로 제한하고 결정적 고정 슬롯을 사용합니다.
3. desktop은 고대비 밝은 노드 카드, 직접 연결선 강조, 검색·유형·정렬·확대 제어를 제공합니다.
4. mobile은 축소 그래프를 기본 렌더링하지 않고 관계 카드를 표시합니다. 그래프는 명시적인 전체 화면 동작에서만 엽니다.
5. 전체 노드는 밝은 검색 목록으로 보존하되 18개씩 점진 노출합니다.
6. 그래프 JSON과 MD/JSONL/Obsidian 경로는 접힌 `원본 데이터 내보내기`로 강등했습니다.

## TDD 기록

- 최초 RED: 순수 이웃 모델 2건, presentation 계약 2건, 총 4건 실패
- 브라우저 RED 1: 공통 shell 제어까지 포함한 24px 측정 오탐을 탐색기 루트로 경계 수정
- 브라우저 RED 2: Night 전역 버튼 토큰이 노드에 적용돼 대비 `3.76:1`로 실패
- GREEN: 온톨로지 제어의 semantic surface를 scoped override하여 desktop Day/Night 노드 대비 `16.37:1`

## 검증 결과

- focused ontology/unit/navigation: 7 files, 46 tests PASS
- ontology typography role: 1 file, 1 test PASS
- production browser contract: 1 file, 1 test PASS
- strict TypeScript typecheck: PASS
- production build: PASS, static generation units 28
- `git diff --check`: PASS (Windows LF/CRLF 안내만 발생)

### 브라우저 계측

| 변형 | 표시 노드 | 겹침 | 가로 넘침 | 최소 제어 | 노드 대비 | 모바일 관계 기본 | 전체 화면 |
|---|---:|---:|---:|---:|---:|---|---|
| desktop Day | 13 | 0 | 0 | 44px | 16.37:1 | 숨김 | 제공 |
| desktop Night | 13 | 0 | 0 | 44px | 16.37:1 | 숨김 | 제공 |
| mobile Day | 0 | 0 | 0 | 44px | 해당 없음 | 표시 | 검증 |
| mobile Night | 0 | 0 | 0 | 44px | 해당 없음 | 표시 | 검증 |

원시 계측: `browser-metrics.json`

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
