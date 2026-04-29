# SafeGuard API 조합 및 다운로드 스모크

- 생성시각: 2026-04-29T14:27:20.981Z
- 대상 URL: https://safeguard-contest-mvp.vercel.app
- 질문: 대구 달서구 창고업 고중량 박스 적재 및 수작업 운반. 작업자 5명, 숙련자 중심, 오늘 날씨를 반영해 위험성평가와 TBM, 안전보건교육 기록을 만들어줘.
- 기상 선조회: live / 단시간 흐림, 강수없음, 기온 14℃, 풍속 1m/s (초단기실황/초단기예보/단기예보/기상특보 반영)
- /api/ask: live / 문서 11종

## API 반영 맵

| API | 호출 경로 | 상태 | 반영 위치 | 건수/신호 | 증거 |
| --- | --- | --- | --- | ---: | --- |
| 기상청 현재/초단기/단기/특보/영향예보 | /api/weather 선조회<br>/api/ask 내부 fetchWeatherSignal | live | 현장 브리프 날씨<br>위험성평가표 작업조건<br>TBM 기상 신호<br>작업중지 기준 | 5 | 단시간 흐림, 강수없음, 기온 14℃, 풍속 1m/s (초단기실황/초단기예보/단기예보/기상특보 반영) |
| Law.go + korean-law-mcp | /api/ask 내부 searchLegalSources | live | 근거 출처<br>위험성평가표 반영 근거<br>TBM 기록 반영 근거<br>사진/증빙 확인 근거 | 6 | korean-law-mcp 비활성화 |
| Gemini | /api/ask 내부 generateAnswer | live | 점검결과 요약<br>위험성평가표<br>TBM<br>안전보건교육<br>외국인 전송본 | 11 | ## 핵심 판단

대구 달서구 창고업의 고중량 박스 적재 및 수작업 운반 작업은 근골격계 질환, 낙하물에 의한 협착 및 부딪힘, 미끄러짐, 전도 등의 유해·위험 요인을 내포하고 있습니다. 특히 숙련자 중심이라 하더라도 고중량물 취급에 대한 위험은 상존하며, 오늘 날씨는 작업 환경에 추가 |
| Work24 훈련과정 | /api/ask 내부 fetchTrainingRecommendations | live | 후속 교육<br>안전보건교육 기록<br>교육 추천 카드 | 3 | 고용24 사업주훈련 호출 성공. 교육 적합성은 현장 키워드와 대상 일치 여부로 재정렬했습니다. |
| KOSHA 안전보건교육포털 | /api/ask 내부 fetchKoshaEducationRecommendations | live | 후속 교육<br>안전보건교육 기록<br>KOSHA 교육 카드 | 3 | KOSHA 교육포털 메타데이터 확인 성공. 교육대상 26개, 과정 후보 3건을 반영했습니다. |
| KOSHA 공식자료/가이드 | /api/ask 내부 fetchKoshaReferences | live | 위험성평가 절차<br>TBM 기록 항목<br>안전보건교육 서식 | 5 | KOSHA·고용노동부 공식 자료 URL 4건 확인. 확인된 자료의 서식 힌트와 반영 위치를 위험성평가·TBM·교육 기록에 적용했습니다. |
| KOSHA 스마트검색/자료링크/MSDS | /api/ask 내부 fetchKoshaOpenApiEvidence | fallback | 문서 반영 근거<br>위험성평가표<br>안전보건교육<br>TBM | 0 | KOSHA 세부 OpenAPI 호출은 수행했지만 표시 가능한 항목이 없습니다. keyword: 42 / UNKNOWN_ERROR(null) / searchKeyword: 42 / UNKNOWN_ERROR(null) / srchWrd: 42 / UNKNOWN_ERROR(null) / qu |
| KOSHA 국내재해사례/첨부파일/사고사망 | /api/ask 내부 fetchAccidentCases | live | 유사 재해사례<br>TBM 예방 포인트<br>교육 사례 | 3 | KOSHA 국내재해사례 후보 API live 호출 성공. 유사 사례를 TBM과 교육 문구에 반영했습니다. 연결 방식: urlsearchparams:raw / KOSHA 사고사망 게시판 live 호출 성공. 중대위험 사례를 TBM과 교육 문구에 반영했습니다. |

## 다운로드 생성 결과

| 형식 | 결과 | 바이트 | 파일 |
| --- | --- | ---: | --- |
| TXT | ok | 5834 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.txt |
| JSON | ok | 6490 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.json |
| CSV | ok | 9189 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.csv |
| XLS | ok | 15347 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.xls |
| DOC | ok | 9617 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.doc |
| HTML | ok | 6412 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.html |
| HWPX | ok | 10222 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.hwpx |
| PDF | ok | 276005 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.pdf |
| JPG | ok | 173146 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.jpg |
| ALL_TXT | ok | 47277 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-safeguard-workpack.txt |
| ALL_CSV | ok | 70762 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-safeguard-workpack.csv |
| ALL_XLS | ok | 100937 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-safeguard-workpack.xls |