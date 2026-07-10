# SafeClaw 문서 편집 화면 상용화 UI 감사

검증일: 2026-07-10
대상: `/workspace` 문서 생성 후 `편집` 모드
기준: 현재 작업공간의 Linear 계열 정보 질서, 모바일 현장 사용성, 기능 보존

## 판정

편집 기능과 운영 정보는 충분하지만, 현재 화면은 본문 편집기 앞뒤로 운영 패널을 모두 상시 렌더링한다. 데스크톱에서는 편집 열이 좁아지고, 모바일에서는 약 16,000px 이상의 한 페이지가 되어 실제 편집 입력란이 첫 화면에 나타나지 않는다. 간격 조정만으로 해결할 문제가 아니라 정보 구조를 바꿔야 한다.

## 실제 브라우저 근거

- 데스크톱 편집 화면 높이: 약 7,000px
- 모바일 390 x 844 편집 화면 높이: 약 16,000px
- 가로 넘침: 없음
- 모바일 첫 화면: 헤더, 단계, 위험 요약이 먼저 보이고 편집 본문은 아래로 밀림
- 데스크톱: 작업공간 rail, 문서 목록, 편집기, 다운로드, Claw 패널이 중첩되어 편집 폭이 좁음
- 시각 언어: 기존 작업공간보다 노랑·주황 카드와 큰 radius가 강해 편집 화면만 다른 제품처럼 보임

캡처:

- `output/playwright/2026-07-10/operation-graph-fix/editor-desktop-headless.png`
- `output/playwright/2026-07-10/operation-graph-fix/editor-mobile-headless.png`

## 유지할 정보

기본 화면에 항상 보인다.

- 문서 제목과 문서 선택
- 문서 검토로 돌아가기
- 자동 저장·재검수 상태
- 본문 편집기
- XLSX, HWP, PDF 액션
- 위험도, 핵심 위험, 미완료 조치 요약

## Inspector로 이동할 정보

기능은 유지하되 동시에 하나만 연다.

- 근거·품질
- 작업 이력 그래프
- Claw 질의
- 작업자·교육
- 공유·확인 이력
- 관리자 저장·학습 export

닫힌 패널은 조건부 렌더링하거나 `display:none`으로 문서 높이에 참여하지 않게 한다. 모바일에서는 full-width drawer, 데스크톱에서는 오른쪽 overlay inspector를 사용한다.

## 접을 정보

- 전체 즉시조치 카드
- PLAN / DO / CHECK / ACT / ISO 체크리스트
- 템플릿 매핑 전체 표
- 베타·전체 다운로드 세부 설명
- 전체 rubric과 제출 미리보기

이 정보는 삭제하지 않고 관련 inspector 또는 세부 정보 disclosure로 이동한다.

## 시각 규칙

- 편집 화면은 현재 작업공간의 흰색·중성 회색 surface와 얇은 divider를 따른다.
- 카드 radius는 6~8px 범위로 줄인다.
- 그림자와 크림색 배경을 제거한다.
- 노랑은 주요 CTA가 아니라 위험·주의 상태에만 사용한다.
- 오렌지 대문자 운영 라벨은 중성 caption으로 바꾼다.
- 문서 편집기가 데스크톱의 주 작업 폭을 차지한다.

## 구현 범위

하나의 bounded refactor로 진행한다.

- `components/SafeGuardCommandCenter.tsx`
- `components/FieldOperationsWorkspace.tsx`
- `components/WorkpackEditor.tsx`
- `app/globals.css`
- `tests/workspace-layout-regression.test.ts`
- `tests/documents-editor-layout.test.ts`

공유 상태를 `/share` 라우트로 옮기는 작업은 이번 refactor에 섞지 않고 후속 백엔드·라우팅 작업으로 분리한다.

## TDD 완료 조건

- 모바일 편집 직후 본문 편집기가 첫 작업 흐름 안에 보임
- 닫힌 inspector 패널은 레이아웃 높이에 참여하지 않음
- 모바일 편집 화면 높이가 현재 구조보다 크게 감소
- 데스크톱 본문 편집 폭이 보조 패널보다 우선됨
- 동시에 하나의 inspector만 표시됨
- drawer 닫기 후 트리거로 포커스가 복귀함
- 보이는 버튼·입력의 좌우 bounding box가 viewport 안에 있음
- 기존 근거, 그래프, Claw, 작업자, 공유, 다운로드 기능이 각 inspector에서 접근 가능함

## 실행 순서

1. 편집 모드 레이아웃 회귀 테스트를 RED로 추가한다.
2. `FieldOperationsWorkspace`의 기본 레이아웃을 editor-first 단일 열로 바꾼다.
3. 보조 패널을 단일 inspector 상태로 묶는다.
4. 모바일 drawer와 포커스 복귀를 구현한다.
5. 편집 화면에만 scoped Linear 토큰을 적용한다.
6. 데스크톱·모바일 실제 Chromium으로 입력 → 생성 → 편집 → inspector 전환을 검증한다.
