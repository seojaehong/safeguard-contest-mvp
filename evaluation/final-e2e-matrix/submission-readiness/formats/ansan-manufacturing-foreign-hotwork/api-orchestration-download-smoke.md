# SafeGuard API 조합 및 다운로드 스모크

- 생성시각: 2026-05-03T12:43:17.181Z
- 대상 URL: http://127.0.0.1:3011
- 질문: 그린메탈 경기 안산 공장 배관 용접·절단 화기작업. 외국인 근로자 2명과 신규 작업자 1명 포함, 작업자 6명, 실내 고온과 환기 불량, 가연물 인접. 화재감시자와 다국어 안전교육까지 반영해 위험성평가, TBM, 안전보건교육 기록을 만들어줘.
- 기상 선조회: live / 단시간 흐림, 강수없음, 기온 12℃, 풍속 1m/s (초단기실황/초단기예보/단기예보/기상특보 반영)
- /api/ask: live / 문서 11종

## API 반영 맵

| API | 호출 경로 | 상태 | 반영 위치 | 건수/신호 | 증거 |
| --- | --- | --- | --- | ---: | --- |
| 기상청 현재/초단기/단기/특보/영향예보 | /api/weather 선조회<br>/api/ask 내부 fetchWeatherSignal | live | 현장 브리프 날씨<br>위험성평가표 작업조건<br>TBM 기상 신호<br>작업중지 기준 | 5 | 단시간 흐림, 강수없음, 기온 12℃, 풍속 1m/s (초단기실황/초단기예보/단기예보/기상특보 반영) |
| Law.go + korean-law-mcp | /api/ask 내부 searchLegalSources | live | 근거 출처<br>위험성평가표 반영 근거<br>TBM 기록 반영 근거<br>사진/증빙 확인 근거 | 6 | korean-law-mcp 비활성화 |
| Gemini | /api/ask 내부 generateAnswer | live | 점검결과 요약<br>위험성평가표<br>TBM<br>안전보건교육<br>외국인 전송본 | 11 | ## 그린메탈 경기 안산 공장 배관 용접·절단 화기작업 위험성평가, TBM, 안전보건교육 기록 (현장 검토용 초안)

**1) 핵심 판단**

그린메탈 경기 안산 공장의 실내 배관 용접·절단 화기작업은 고온, 환기 불량, 가연물 인접 등 복합적인 위험 요소를 내포하고 있습니다. 특히 외 |
| Work24 훈련과정 | /api/ask 내부 fetchTrainingRecommendations | live | 후속 교육<br>안전보건교육 기록<br>교육 추천 카드 | 3 | 고용24 사업주훈련 호출 성공. 교육 적합성은 현장 키워드와 대상 일치 여부로 재정렬했습니다. |
| KOSHA 안전보건교육포털 | /api/ask 내부 fetchKoshaEducationRecommendations | live | 후속 교육<br>안전보건교육 기록<br>KOSHA 교육 카드 | 3 | KOSHA 교육포털 메타데이터 확인 성공. 교육대상 26개, 과정 후보 3건을 반영했습니다. |
| KOSHA 공식자료/가이드 | /api/ask 내부 fetchKoshaReferences | live | 위험성평가 절차<br>TBM 기록 항목<br>안전보건교육 서식 | 6 | KOSHA·고용노동부 공식 자료 URL 6건 확인. 확인된 자료의 서식 힌트와 반영 위치를 위험성평가·TBM·교육 기록에 적용했습니다. |
| KOSHA 스마트검색/자료링크/MSDS/건설업 일별 중대재해 | /api/ask 내부 fetchKoshaOpenApiEvidence | live | 문서 반영 근거<br>위험성평가표<br>안전보건교육<br>TBM | 2 | KOSHA 세부 OpenAPI 2건을 문서 반영 근거로 연결했습니다. 보류 상세: 정상 응답 / 화학물질 키워드가 없어 MSDS 호출을 건너뜁니다. / 건설업 작업 키워드가 없어 건설업 일별 중대재해 현황 호출을 건너뜁니다. |
| KOSHA 국내재해사례/첨부파일/사고사망 | /api/ask 내부 fetchAccidentCases | live | 유사 재해사례<br>TBM 예방 포인트<br>교육 사례 | 3 | KOSHA 국내재해사례 후보 API live 호출 성공. 유사 사례를 TBM과 교육 문구에 반영했습니다. 연결 방식: urlsearchparams:raw / KOSHA 사고사망 게시판 live 호출 성공. 중대위험 사례를 TBM과 교육 문구에 반영했습니다. |

## 다운로드 생성 결과

| 형식 | 결과 | 바이트 | 파일 |
| --- | --- | ---: | --- |
| TXT | ok | 5436 | evaluation\final-e2e-matrix\submission-readiness\formats\ansan-manufacturing-foreign-hotwork\files\그린메탈-risk-assessment.txt |
| JSON | ok | 5967 | evaluation\final-e2e-matrix\submission-readiness\formats\ansan-manufacturing-foreign-hotwork\files\그린메탈-risk-assessment.json |
| CSV | ok | 8245 | evaluation\final-e2e-matrix\submission-readiness\formats\ansan-manufacturing-foreign-hotwork\files\그린메탈-risk-assessment.csv |
| XLS | ok | 14639 | evaluation\final-e2e-matrix\submission-readiness\formats\ansan-manufacturing-foreign-hotwork\files\그린메탈-risk-assessment.xls |
| DOC | ok | 9188 | evaluation\final-e2e-matrix\submission-readiness\formats\ansan-manufacturing-foreign-hotwork\files\그린메탈-risk-assessment.doc |
| HTML | ok | 6014 | evaluation\final-e2e-matrix\submission-readiness\formats\ansan-manufacturing-foreign-hotwork\files\그린메탈-risk-assessment.html |
| HWPX | ok | 10041 | evaluation\final-e2e-matrix\submission-readiness\formats\ansan-manufacturing-foreign-hotwork\files\그린메탈-risk-assessment.hwpx |
| PDF | ok | 277985 | evaluation\final-e2e-matrix\submission-readiness\formats\ansan-manufacturing-foreign-hotwork\files\그린메탈-risk-assessment.pdf |
| JPG | ok | 165369 | evaluation\final-e2e-matrix\submission-readiness\formats\ansan-manufacturing-foreign-hotwork\files\그린메탈-risk-assessment.jpg |
| ALL_TXT | ok | 59280 | evaluation\final-e2e-matrix\submission-readiness\formats\ansan-manufacturing-foreign-hotwork\files\그린메탈-safeguard-workpack.txt |
| ALL_CSV | ok | 86112 | evaluation\final-e2e-matrix\submission-readiness\formats\ansan-manufacturing-foreign-hotwork\files\그린메탈-safeguard-workpack.csv |
| ALL_XLS | ok | 123493 | evaluation\final-e2e-matrix\submission-readiness\formats\ansan-manufacturing-foreign-hotwork\files\그린메탈-safeguard-workpack.xls |