# 현재 타깃 웹 한글화 검증 보고서

- 기준 부모: `d3ad86530bc786d8024206cc5b7c7db60c055278`
- 제품 커밋: `aca2f1db878e8597fd946ce99cabc9ecd4fe0345`
- 브랜치: `fix/web-localization-current-target`
- 빌드 ID: `dpm4TZUQTCz5X9Eugous3`
- 브라우저 모드: `prod`
- push 상태: 독립 리뷰 전 미실행

## 변경 경계

- 리포트 웹 화면의 `As-Is`, `To-Be`, `Before/After`를 `개선 전`, `개선 후`로 표시했습니다.
- CSV, 사용자용 Markdown, 운영 코퍼스 Markdown의 개선 비교 레이블을 한글화했습니다.
- JSONL 내부 계약인 `asIs`, `toBe` 키는 그대로 유지했습니다.
- 온톨로지의 원시 노드 종류와 상태 레이블을 한글 표시 함수로 통과시켰습니다.
- 지식 화면의 현재 대상 영문 상태·섹션 레이블을 한글화했습니다.
- 리포트의 fail-closed 다운로드 잠금 5종은 변경하지 않았습니다.

## TDD 및 정적 검증

| 단계 | 결과 |
| --- | --- |
| 기준선 | 4파일, 55/55 통과 |
| 경계 RED | 2파일, 4실패/39통과 |
| 경계 GREEN | 2파일, 43/43 통과 |
| 관련 회귀 묶음 | 5파일, 59/59 통과 |
| strict typecheck | 통과 |
| 정상 프로덕션 빌드 | Next.js 15.5.20, 정적 페이지 27/27 통과 |

초기 브라우저 RED는 제품 화면 12행이 아니라 오버레이 감지 정규식이 `Issue (1)`을 놓친 테스트 결함 1건이었습니다. Unicode 문자 경계로 보정한 뒤 dev 13/13, 제품 커밋 기준 prod 13/13을 통과했습니다.

## 프로덕션 브라우저 매트릭스

`/reports`, `/ontology`, `/knowledge` 각각을 Day/Night 및 1440x900/390x844로 확인해 총 12행을 생성했습니다.

| 측정값 | 합계 |
| --- | ---: |
| 가로 오버플로 | 0 |
| 섹션 겹침 | 0 |
| 이름 없는 인터랙티브 요소 | 0 |
| Issue 오버레이 감지 행 | 0 |

오버레이 탐지기는 `1 Issue`, `2 Issues`, `N Issues`, `Issue (1)`, `Issues (2)`, `Issue: 1`, `Issues: N` 변형을 별도 회귀 테스트로 확인했습니다.

각 화면의 JSON 측정값과 전체 페이지 PNG는 이 보고서와 같은 디렉터리에 있습니다. 12개 JSON 모두 제품 SHA `aca2f1db878e8597fd946ce99cabc9ecd4fe0345`, 빌드 ID `dpm4TZUQTCz5X9Eugous3`, `prod` 모드를 기록합니다.
