# 현재 타깃 웹 한글화·온톨로지 겹침 검증 v2

- authoritative parent: `d3ad86530bc786d8024206cc5b7c7db60c055278`
- 검증 제품 SHA: `188b3b38de48c102f199cfd0942a93d59d56d7fa`
- 빌드 ID: `OYLfEPZhNwrBG1IPM04At`
- 브랜치: `fix/web-localization-current-target`
- 브라우저 모드: `prod`
- push: 독립 리뷰 전 미실행

## 채택 및 제외

- 제품 후보는 정확히 `aca2f1db878e8597fd946ce99cabc9ecd4fe0345` → `14dc197e9c253c45a5ea79476acddbf6ac0f1a33` → `188b3b38de48c102f199cfd0942a93d59d56d7fa` 순서입니다.
- 네 번째 객체는 이 보고서와 v2 JSON/PNG만 담는 evidence commit입니다. 커밋은 자기 SHA를 내용에 기록할 수 없으므로 정확한 evidence SHA는 Git 생성 후 외부 handoff에 기록합니다.
- 명시적 제외 대상은 구 evidence commit `1835d9fd703f84b8209f718bdc97cf3e7de55dea`와 `evaluation/web-localization-current-target-2026-07-13/`뿐입니다.
- whole branch merge, range merge, 구 evidence 포함 merge는 금지합니다. 아래 4개 객체를 순서대로 선택 이식해야 합니다.

## 선택 이식 순서와 파일 맵

1. `aca2f1db878e8597fd946ce99cabc9ecd4fe0345`
   - `app/knowledge/page.tsx`
   - `app/ontology/page.tsx`
   - `app/reports/page.tsx`
   - `components/ReportsDownloadCenter.tsx`
   - `lib/reporting-downloads.ts`
   - `tests/current-target-localization-browser.test.ts`
   - `tests/current-target-localization-contract.test.ts`
   - `tests/reporting-downloads.test.ts`
   - `tests/reports-download-center.test.ts`
2. `14dc197e9c253c45a5ea79476acddbf6ac0f1a33`
   - `app/ontology/page.tsx`
   - `components/OperationMemoryPreview.tsx`
   - `tests/current-target-localization-browser.test.ts`
   - `tests/current-target-localization-contract.test.ts`
3. `188b3b38de48c102f199cfd0942a93d59d56d7fa`
   - `app/ontology/page.tsx`
4. v2 evidence commit
   - `evaluation/web-localization-current-target-2026-07-13-v2/`의 26파일만 포함

## 리뷰 RED와 보정

최초 독립 리뷰에서 정식 노드 종류 `Duty`의 raw fallback, 좁은 겹침 선택자, dev/stale 증거 허용이 확인되어 REJECT되었습니다.

- `nodeKindLabel`을 `NodeKind`와 `KIND_KO`의 완전 매핑으로 변경하고 `NODE_KINDS` 전체를 범례·집계에 사용했습니다.
- 스키마와 공개 시드의 모든 종류가 한글 레이블을 갖는 target-native 계약을 추가했습니다.
- readiness를 role/aria 기반으로 변경하고 영문 금지 정규식에 `Duty`를 포함했습니다.
- 증거 모드에서는 예상 source SHA, build ID, prod 모드가 하나라도 다르면 beforeAll에서 실패합니다.
- 의미 있는 텍스트·컨트롤 전체를 검사하되 조상/자손과 실제 overflow clip 밖 요소만 제외하는 visible geometry 검사를 추가했습니다.

넓은 검사로 OperationMemory 절대 배치 카드가 desktop 3쌍, mobile 7쌍 겹치는 실제 RED를 발견했습니다. 공유 `app/globals.css`를 수정하지 않고 `OperationMemoryPreview`를 responsive node-selector grid로 변경했습니다. 두 번째 온톨로지 그래프의 겹치는 HTML 레이블은 제거하고 SVG topology, authoritative 범례, 전체 노드 목록을 보존했습니다. prod 390px에서 잡힌 목록 행 3쌍은 목록 gap을 1px에서 6px로 조정해 해소했습니다.

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| 초기 기준선 | 4파일 55/55 |
| 초기 경계 RED | 4실패/39통과 |
| 리뷰 remediation RED | 2실패/2통과 |
| OperationMemory geometry RED | desktop 3쌍, mobile 7쌍 |
| 관련 회귀 aggregate | 6파일 64/64 |
| strict typecheck | PASS |
| exact 제품 정상 빌드 | Next.js 15.5.20, 정적 27/27 |
| exact 제품 prod 브라우저 | 15/15 |

리포트 bearer 세션 테스트는 첫 aggregate에서 헤더가 비어 1회 실패했으나 같은 테스트 단독 1/1 통과 후 aggregate 전체를 다시 실행해 64/64로 확인했습니다. 제품 네트워크 코드는 변경하지 않았습니다.

## 프로덕션 브라우저 증거

`/reports`, `/ontology`, `/knowledge` × Day/Night × 1440x900/390x844의 화면 매트릭스 12행과 OperationMemory geometry 2행, Issue regex 1행을 검증했습니다.

| 측정값 | 합계 |
| --- | ---: |
| 가로 오버플로 | 0 |
| 가시 요소·컨트롤 겹침 | 0 |
| 이름 없는 인터랙티브 요소 | 0 |
| Issue 오버레이 감지 행 | 0 |

12개 JSON과 12개 전체 페이지 PNG는 모두 source SHA `188b3b38de48c102f199cfd0942a93d59d56d7fa`, build ID `OYLfEPZhNwrBG1IPM04At`, `prod` 모드를 기록합니다.
