# SafeGuard API 조합 및 다운로드 스모크

- 생성시각: 2026-07-05T13:07:31.568Z
- 대상 URL: http://127.0.0.1:3022
- 질문: 세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보. 추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘.
- 기상 선조회: live / 단시간 흐림, 비, 기온 25℃, 풍속 1m/s (초단기실황/초단기예보/단기예보/기상특보/영향예보/생활기상 자외선 반영)
- /api/ask: mock / 문서 11종

## API 반영 맵

| API | 호출 경로 | 상태 | 반영 위치 | 건수/신호 | 증거 |
| --- | --- | --- | --- | ---: | --- |
| 기상청 현재/초단기/단기/특보/영향예보 | /api/weather 선조회<br>/api/ask 내부 fetchWeatherSignal | mock | 현장 브리프 날씨<br>위험성평가표 작업조건<br>TBM 기상 신호<br>작업중지 기준 | 0 | 오후 강풍 예보, 작업중지 기준 공유 필요 |
| Law.go + korean-law-mcp | /api/ask 내부 searchLegalSources | mock | 근거 출처<br>위험성평가표 반영 근거<br>TBM 기록 반영 근거<br>사진/증빙 확인 근거 | 4 | korean-law-mcp 비활성화 |
| Gemini | /api/ask 내부 generateAnswer | mock | 점검결과 요약<br>위험성평가표<br>TBM<br>안전보건교육<br>외국인 전송본 | 11 | 세이프건설 서울 성수동 근린생활시설 현장의 주요 위험은 강풍 상황에서 이동식 비계가 흔들리며 작업자가 추락하거나 비계가 전도될 위험입니다.

건설업 현장 기준으로 위험 요약, 위험성평가 초안, TBM 브리핑, TBM 일지, 안전교육 기록을 한 번에 생성하는 흐름을 제공합니다.

실무에서 |
| Work24 훈련과정 | /api/ask 내부 fetchTrainingRecommendations | mock | 후속 교육<br>안전보건교육 기록<br>교육 추천 카드 | 0 | 현장 예시 기반 교육 연계 문구 |
| KOSHA 안전보건교육포털 | /api/ask 내부 fetchKoshaEducationRecommendations | fallback | 후속 교육<br>안전보건교육 기록<br>KOSHA 교육 카드 | 1 | 대표 시나리오 기반 KOSHA 교육포털 연계 문구 |
| KOSHA 공식자료/가이드 | /api/ask 내부 fetchKoshaReferences | fallback | 위험성평가 절차<br>TBM 기록 항목<br>안전보건교육 서식 | 0 | 대표 시나리오 기반 KOSHA 가이드 보강 문구 |
| KOSHA 스마트검색/자료링크/MSDS/건설업 일별 중대재해 | /api/ask 내부 fetchKoshaOpenApiEvidence | unknown | 문서 반영 근거<br>위험성평가표<br>안전보건교육<br>TBM | 0 |  |
| KOSHA 국내재해사례/첨부파일/사고사망 | /api/ask 내부 fetchAccidentCases | fallback | 유사 재해사례<br>TBM 예방 포인트<br>교육 사례 | 3 | 대표 시나리오 기반 유사 재해사례 보강 문구 |

## 다운로드 생성 결과

| 형식 | 결과 | 바이트 | 파일 |
| --- | --- | ---: | --- |
| TXT | ok | 3041 | evaluation\final-output-integrity-audit-local\formats\seoul-construction-windy\files\세이프건설-risk-assessment.txt |
| JSON | ok | 3548 | evaluation\final-output-integrity-audit-local\formats\seoul-construction-windy\files\세이프건설-risk-assessment.json |
| CSV | ok | 5241 | evaluation\final-output-integrity-audit-local\formats\seoul-construction-windy\files\세이프건설-risk-assessment.csv |
| XLS | ok | 12021 | evaluation\final-output-integrity-audit-local\formats\seoul-construction-windy\files\세이프건설-risk-assessment.xls |
| DOC | ok | 5946 | evaluation\final-output-integrity-audit-local\formats\seoul-construction-windy\files\세이프건설-risk-assessment.doc |
| HTML | ok | 3619 | evaluation\final-output-integrity-audit-local\formats\seoul-construction-windy\files\세이프건설-risk-assessment.html |
| HWPX | ok | 8805 | evaluation\final-output-integrity-audit-local\formats\seoul-construction-windy\files\세이프건설-risk-assessment.hwpx |
| HWP_TABLE | ok | 15872 | evaluation\final-output-integrity-audit-local\formats\seoul-construction-windy\files\세이프건설-risk-assessment.hwp |
| XLSX_OOXML | ok | 9824 | evaluation\final-output-integrity-audit-local\formats\seoul-construction-windy\files\세이프건설-risk-assessment.xlsx |
| PDF | ok | 225350 | evaluation\final-output-integrity-audit-local\formats\seoul-construction-windy\files\세이프건설-risk-assessment.pdf |
| JPG | ok | 149749 | evaluation\final-output-integrity-audit-local\formats\seoul-construction-windy\files\세이프건설-risk-assessment.jpg |
| ALL_TXT | ok | 53738 | evaluation\final-output-integrity-audit-local\formats\seoul-construction-windy\files\세이프건설-safeguard-workpack.txt |
| ALL_CSV | ok | 78430 | evaluation\final-output-integrity-audit-local\formats\seoul-construction-windy\files\세이프건설-safeguard-workpack.csv |
| ALL_XLS | ok | 127092 | evaluation\final-output-integrity-audit-local\formats\seoul-construction-windy\files\세이프건설-safeguard-workpack.xls |