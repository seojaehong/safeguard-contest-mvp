# SafeClaw Final E2E Matrix

- 생성시각: 2026-05-03T12:44:14.209Z
- 대상 URL: http://127.0.0.1:3011
- 전체 판정: notice

## 게이트

| Gate | 판정 | 커버리지 |
| --- | --- | --- |
| api-status | pass | 주요 HTML route, safety-reference status, weather, PDF export source, dispatch log auth gate |
| ask-generation | pass | /api/ask live sample 및 deterministic matrix 문서 생성 |
| document-rubric | pass | 위험성평가/TBM/교육/사진증빙/외국인 안내 등 문서별 필수 문구 반영 |
| download-export | pass | PDF/HWPX/XLS/ALL_XLS 다운로드 스모크 및 /api/export/pdf HTML source |
| dispatch-logs | notice | 전파 실행 조건, dispatch workflow, dispatch log 저장 게이트 |
| main-routes | pass | 홈 생성 플로우, Sheets TSV, 근거 링크, 주요 route 응답 |

## Blocker

| Gate | 사유 |
| --- | --- |
| 없음 | 현재 래퍼 기준 blocker 없음 |

## Notice

| Gate | 사유 |
| --- | --- |
| dispatch-logs | 전파 실행 조건, dispatch workflow, dispatch log 저장 게이트 게이트가 조건부 통과 또는 설정 미완료 상태입니다. |

## 산출물

- `report.json`: 최종 기계 판독용 매트릭스
- `quality-matrix/report.json`: 문서 루브릭 및 입력 반영 매트릭스
- `submission-readiness/submission-readiness-summary.json`: 제출 준비도, 다운로드/export, 전파 상태
- `local-ui-regression-smoke.json`: 로컬 UI 주요 흐름 회귀 결과

## 재실행

```powershell
npm.cmd run smoke:final-e2e-matrix
```
