# SafeGuard API 조합 및 다운로드 스모크

- 생성시각: 2026-05-02T10:51:23.055Z
- 대상 URL: https://safeguard-contest-mvp.vercel.app
- 질문: 대구 달서구 창고업 고중량 박스 적재 및 수작업 운반. 작업자 5명, 숙련자 중심, 오늘 날씨를 반영해 위험성평가와 TBM, 안전보건교육 기록을 만들어줘.
- 기상 선조회: live / 단시간 흐림, 강수없음, 기온 23℃, 풍속 1m/s (초단기실황/초단기예보/단기예보/기상특보 반영)
- /api/ask: live / 문서 11종

## API 반영 맵

| API | 호출 경로 | 상태 | 반영 위치 | 건수/신호 | 증거 |
| --- | --- | --- | --- | ---: | --- |
| 기상청 현재/초단기/단기/특보/영향예보 | /api/weather 선조회<br>/api/ask 내부 fetchWeatherSignal | live | 현장 브리프 날씨<br>위험성평가표 작업조건<br>TBM 기상 신호<br>작업중지 기준 | 5 | 단시간 흐림, 강수없음, 기온 23℃, 풍속 1m/s (초단기실황/초단기예보/단기예보/기상특보 반영) |
| Law.go + korean-law-mcp | /api/ask 내부 searchLegalSources | live | 근거 출처<br>위험성평가표 반영 근거<br>TBM 기록 반영 근거<br>사진/증빙 확인 근거 | 6 | korean-law-mcp 비활성화 |
| Gemini | /api/ask 내부 generateAnswer | live | 점검결과 요약<br>위험성평가표<br>TBM<br>안전보건교육<br>외국인 전송본 | 11 | ## 고중량 박스 취급 작업 현장 검토 초안

### 1) 핵심 판단

대구 달서구 창고업의 고중량 박스 적재 및 수작업 운반 작업은 작업자 5명의 숙련도를 고려하더라도, **근골격계 질환 발생 위험이 매우 높으며, 적재물 낙하, 협착 등의 잠재적 위험을 상시 내포**하고 있습니다. 특 |
| Work24 훈련과정 | /api/ask 내부 fetchTrainingRecommendations | live | 후속 교육<br>안전보건교육 기록<br>교육 추천 카드 | 3 | 고용24 사업주훈련 호출 성공. 교육 적합성은 현장 키워드와 대상 일치 여부로 재정렬했습니다. |
| KOSHA 안전보건교육포털 | /api/ask 내부 fetchKoshaEducationRecommendations | live | 후속 교육<br>안전보건교육 기록<br>KOSHA 교육 카드 | 3 | KOSHA 교육포털 메타데이터 확인 성공. 교육대상 26개, 과정 후보 3건을 반영했습니다. |
| KOSHA 공식자료/가이드 | /api/ask 내부 fetchKoshaReferences | live | 위험성평가 절차<br>TBM 기록 항목<br>안전보건교육 서식 | 5 | KOSHA·고용노동부 공식 자료 URL 5건 확인. 확인된 자료의 서식 힌트와 반영 위치를 위험성평가·TBM·교육 기록에 적용했습니다. |
| KOSHA 스마트검색/자료링크/MSDS/건설업 일별 중대재해 | /api/ask 내부 fetchKoshaOpenApiEvidence | live | 문서 반영 근거<br>위험성평가표<br>안전보건교육<br>TBM | 2 | KOSHA 세부 OpenAPI 2건을 문서 반영 근거로 연결했습니다. 보류 상세: 정상 응답 / 화학물질 키워드가 없어 MSDS 호출을 건너뜁니다. / 건설업 작업 키워드가 없어 건설업 일별 중대재해 현황 호출을 건너뜁니다. |
| KOSHA 국내재해사례/첨부파일/사고사망 | /api/ask 내부 fetchAccidentCases | live | 유사 재해사례<br>TBM 예방 포인트<br>교육 사례 | 3 | KOSHA 국내재해사례 후보 API live 호출 성공. 유사 사례를 TBM과 교육 문구에 반영했습니다. 연결 방식: urlsearchparams:raw / KOSHA 사고사망 게시판 live 호출 성공. 중대위험 사례를 TBM과 교육 문구에 반영했습니다. |

## 다운로드 생성 결과

| 형식 | 결과 | 바이트 | 파일 |
| --- | --- | ---: | --- |
| TXT | ok | 7540 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.txt |
| JSON | ok | 8078 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.json |
| CSV | ok | 11335 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.csv |
| XLS | ok | 18185 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.xls |
| DOC | ok | 11805 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.doc |
| HTML | ok | 8118 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.html |
| HWPX | ok | 10925 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.hwpx |
| PDF | ok | 294678 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.pdf |
| JPG | ok | 169770 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.jpg |
| ALL_TXT | ok | 62008 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-safeguard-workpack.txt |
| ALL_CSV | ok | 90075 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-safeguard-workpack.csv |
| ALL_XLS | ok | 123551 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-safeguard-workpack.xls |