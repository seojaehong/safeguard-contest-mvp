# SafeGuard API 조합 및 다운로드 스모크

- 생성시각: 2026-07-05T13:07:36.484Z
- 대상 URL: http://127.0.0.1:3022
- 질문: 한빛로지스 인천 남동공단 물류센터 지게차 상하차 작업. 숙련 지게차 운전자 2명과 피킹 인력 6명, 우천 후 출입구 바닥 젖음, 보행 동선과 지게차 동선이 겹친다. 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘.
- 기상 선조회: live / 단시간 흐림, 강수없음, 기온 25℃, 풍속 2m/s (초단기실황/초단기예보/단기예보/기상특보/영향예보 반영)
- /api/ask: mock / 문서 11종

## API 반영 맵

| API | 호출 경로 | 상태 | 반영 위치 | 건수/신호 | 증거 |
| --- | --- | --- | --- | ---: | --- |
| 기상청 현재/초단기/단기/특보/영향예보 | /api/weather 선조회<br>/api/ask 내부 fetchWeatherSignal | mock | 현장 브리프 날씨<br>위험성평가표 작업조건<br>TBM 기상 신호<br>작업중지 기준 | 0 | 우천 후 바닥 젖음, 미끄럼·동선 분리 기준 공유 필요 |
| Law.go + korean-law-mcp | /api/ask 내부 searchLegalSources | mock | 근거 출처<br>위험성평가표 반영 근거<br>TBM 기록 반영 근거<br>사진/증빙 확인 근거 | 4 | korean-law-mcp 비활성화 |
| Gemini | /api/ask 내부 generateAnswer | mock | 점검결과 요약<br>위험성평가표<br>TBM<br>안전보건교육<br>외국인 전송본 | 11 | 한빛로지스 인천 남동공단 물류센터의 주요 위험은 지게차 동선과 보행 동선이 겹치면서 충돌하거나 적재물이 낙하할 위험입니다.

물류업 현장 기준으로 위험 요약, 위험성평가 초안, TBM 브리핑, TBM 일지, 안전교육 기록을 한 번에 생성하는 흐름을 제공합니다.

실무에서는 작업 전 위험 |
| Work24 훈련과정 | /api/ask 내부 fetchTrainingRecommendations | mock | 후속 교육<br>안전보건교육 기록<br>교육 추천 카드 | 0 | 현장 예시 기반 교육 연계 문구 |
| KOSHA 안전보건교육포털 | /api/ask 내부 fetchKoshaEducationRecommendations | fallback | 후속 교육<br>안전보건교육 기록<br>KOSHA 교육 카드 | 1 | 대표 시나리오 기반 KOSHA 교육포털 연계 문구 |
| KOSHA 공식자료/가이드 | /api/ask 내부 fetchKoshaReferences | fallback | 위험성평가 절차<br>TBM 기록 항목<br>안전보건교육 서식 | 0 | 대표 시나리오 기반 KOSHA 가이드 보강 문구 |
| KOSHA 스마트검색/자료링크/MSDS/건설업 일별 중대재해 | /api/ask 내부 fetchKoshaOpenApiEvidence | unknown | 문서 반영 근거<br>위험성평가표<br>안전보건교육<br>TBM | 0 |  |
| KOSHA 국내재해사례/첨부파일/사고사망 | /api/ask 내부 fetchAccidentCases | fallback | 유사 재해사례<br>TBM 예방 포인트<br>교육 사례 | 3 | 대표 시나리오 기반 유사 재해사례 보강 문구 |

## 다운로드 생성 결과

| 형식 | 결과 | 바이트 | 파일 |
| --- | --- | ---: | --- |
| TXT | ok | 2921 | evaluation\final-output-integrity-audit-local\formats\incheon-logistics-rain\files\한빛로지스-risk-assessment.txt |
| JSON | ok | 3437 | evaluation\final-output-integrity-audit-local\formats\incheon-logistics-rain\files\한빛로지스-risk-assessment.json |
| CSV | ok | 5121 | evaluation\final-output-integrity-audit-local\formats\incheon-logistics-rain\files\한빛로지스-risk-assessment.csv |
| XLS | ok | 11901 | evaluation\final-output-integrity-audit-local\formats\incheon-logistics-rain\files\한빛로지스-risk-assessment.xls |
| DOC | ok | 5826 | evaluation\final-output-integrity-audit-local\formats\incheon-logistics-rain\files\한빛로지스-risk-assessment.doc |
| HTML | ok | 3499 | evaluation\final-output-integrity-audit-local\formats\incheon-logistics-rain\files\한빛로지스-risk-assessment.html |
| HWPX | ok | 8792 | evaluation\final-output-integrity-audit-local\formats\incheon-logistics-rain\files\한빛로지스-risk-assessment.hwpx |
| HWP_TABLE | ok | 15872 | evaluation\final-output-integrity-audit-local\formats\incheon-logistics-rain\files\한빛로지스-risk-assessment.hwp |
| XLSX_OOXML | ok | 9806 | evaluation\final-output-integrity-audit-local\formats\incheon-logistics-rain\files\한빛로지스-risk-assessment.xlsx |
| PDF | ok | 230358 | evaluation\final-output-integrity-audit-local\formats\incheon-logistics-rain\files\한빛로지스-risk-assessment.pdf |
| JPG | ok | 145096 | evaluation\final-output-integrity-audit-local\formats\incheon-logistics-rain\files\한빛로지스-risk-assessment.jpg |
| ALL_TXT | ok | 33270 | evaluation\final-output-integrity-audit-local\formats\incheon-logistics-rain\files\한빛로지스-safeguard-workpack.txt |
| ALL_CSV | ok | 50558 | evaluation\final-output-integrity-audit-local\formats\incheon-logistics-rain\files\한빛로지스-safeguard-workpack.csv |
| ALL_XLS | ok | 89649 | evaluation\final-output-integrity-audit-local\formats\incheon-logistics-rain\files\한빛로지스-safeguard-workpack.xls |