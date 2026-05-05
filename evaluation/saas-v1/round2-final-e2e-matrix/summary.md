# SafeClaw Final E2E Matrix

- 생성시각: 2026-05-05T01:16:30.985Z
- 대상 URL: https://safeguard-contest-mvp.vercel.app
- 전체 판정: blocked

## 게이트

| Gate | 판정 | 커버리지 |
| --- | --- | --- |
| api-status | blocked | 주요 HTML route, safety-reference status, weather, PDF export source, archive auth gates |
| ask-generation | blocked | /api/ask live sample 및 deterministic matrix 문서 생성 |
| document-rubric | blocked | 위험성평가/TBM/교육/사진증빙/외국인 안내 등 문서별 필수 문구 반영 |
| download-export | blocked | PDF/HWPX/XLS/ALL_XLS 다운로드 스모크 및 /api/export/pdf HTML source |
| dispatch-logs | notice | 전파 실행 조건, dispatch workflow, workpack archive, dispatch log 저장 게이트 |
| main-routes | pass | 홈 생성 플로우, Sheets TSV, 근거 링크, 주요 route 응답 |

## Blocker

| Gate | 사유 |
| --- | --- |
| api-status | /api/export/pdf returned 404; /api/export/pdf?format=pdf returned 404 |
| ask-generation | seoul-scaffold-paint__full-context: rubric:photoEvidenceDraft photoEvidenceDraft missing section terms: 조치 후; seoul-scaffold-paint__minimal-input: rubric:photoEvidenceDraft photoEvidenceDraft missing section terms: 조치 후; seoul-scaffold-paint__weather-heavy: rubric:photoEvidenceDraft photoEvidenceDraft missing section terms: 조치 후 |
| document-rubric | seoul-scaffold-paint__full-context: rubric:photoEvidenceDraft photoEvidenceDraft missing section terms: 조치 후; seoul-scaffold-paint__minimal-input: rubric:photoEvidenceDraft photoEvidenceDraft missing section terms: 조치 후; seoul-scaffold-paint__weather-heavy: rubric:photoEvidenceDraft photoEvidenceDraft missing section terms: 조치 후 |
| download-export | PDF/HWPX/XLS/ALL_XLS 다운로드 스모크 및 /api/export/pdf HTML source 게이트가 통과하지 못했습니다. 세부 JSON을 확인하세요. |

## Notice

| Gate | 사유 |
| --- | --- |
| dispatch-logs | 전파 실행 조건, dispatch workflow, workpack archive, dispatch log 저장 게이트 게이트가 조건부 통과 또는 설정 미완료 상태입니다. |

## 산출물

- `report.json`: 최종 기계 판독용 매트릭스
- `quality-matrix/report.json`: 문서 루브릭 및 입력 반영 매트릭스
- `submission-readiness/submission-readiness-summary.json`: 제출 준비도, 다운로드/export, 전파 상태
- `local-ui-regression-smoke.json`: 로컬 UI 주요 흐름 회귀 결과

## 재실행

```powershell
npm.cmd run smoke:final-e2e-matrix
```
