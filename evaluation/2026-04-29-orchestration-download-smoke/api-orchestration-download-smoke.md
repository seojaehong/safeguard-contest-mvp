# SafeGuard API 조합 및 다운로드 스모크

- 생성시각: 2026-04-29T13:10:42.680Z
- 대상 URL: https://safeguard-contest-mvp.vercel.app
- 질문: 대구 달서구 창고업 고중량 박스 적재 및 수작업 운반. 작업자 5명, 숙련자 중심, 오늘 날씨를 반영해 위험성평가와 TBM, 안전보건교육 기록을 만들어줘.
- 기상 선조회: live / 단시간 구름많음, 강수없음, 기온 15℃, 풍속 2m/s (초단기실황/초단기예보/단기예보 반영)
- /api/ask: live / 문서 11종

## API 반영 맵

| API | 호출 경로 | 상태 | 반영 위치 | 건수/신호 | 증거 |
| --- | --- | --- | --- | ---: | --- |
| 기상청 현재/초단기/단기 | /api/weather 선조회<br>/api/ask 내부 fetchWeatherSignal | live | 현장 브리프 날씨<br>위험성평가표 작업조건<br>TBM 기상 신호<br>작업중지 기준 | 3 | 단시간 구름많음, 강수없음, 기온 15℃, 풍속 2m/s (초단기실황/초단기예보/단기예보 반영) |
| Law.go + korean-law-mcp | /api/ask 내부 searchLegalSources | live | 근거 출처<br>위험성평가표 반영 근거<br>TBM 기록 반영 근거<br>사진/증빙 확인 근거 | 6 | korean-law-mcp 비활성화 |
| Gemini | /api/ask 내부 generateAnswer | live | 점검결과 요약<br>위험성평가표<br>TBM<br>안전보건교육<br>외국인 전송본 | 11 | ### 1. 핵심 판단

제공된 현장 조건(대구 달서구 창고업, 고중량 박스 적재 및 수작업 운반, 작업자 5명, 숙련자 중심, 오늘 날씨 반영)을 바탕으로, 산업안전보건법령 및 관련 해석례에 따라 잠재적인 위험 요소를 파악하고 이에 대한 기본적인 관리 방안을 수립할 필요가 있습니다.  |
| Work24 훈련과정 | /api/ask 내부 fetchTrainingRecommendations | live | 후속 교육<br>안전보건교육 기록<br>교육 추천 카드 | 3 | 고용24 사업주훈련 호출 성공. 교육 적합성은 현장 키워드와 대상 일치 여부로 재정렬했습니다. |
| KOSHA 안전보건교육포털 | /api/ask 내부 fetchKoshaEducationRecommendations | live | 후속 교육<br>안전보건교육 기록<br>KOSHA 교육 카드 | 3 | KOSHA 교육포털 메타데이터 확인 성공. 교육대상 26개, 과정 후보 3건을 반영했습니다. |
| KOSHA 공식자료/가이드 | /api/ask 내부 fetchKoshaReferences | live | 위험성평가 절차<br>TBM 기록 항목<br>안전보건교육 서식 | 5 | KOSHA·고용노동부 공식 자료 URL 4건 확인. 확인된 자료의 서식 힌트와 반영 위치를 위험성평가·TBM·교육 기록에 적용했습니다. |
| KOSHA 재해사례 | /api/ask 내부 fetchAccidentCases | fallback | 유사 재해사례<br>TBM 예방 포인트<br>교육 사례 | 3 | KOSHA 국내재해사례 API 오류 응답: 99 / UNKNOWN_ERROR 기본 재해사례 근거로 전환했습니다. |

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
| PDF | ok | 275882 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.pdf |
| JPG | ok | 173146 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-risk-assessment.jpg |
| ALL_TXT | ok | 45642 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-safeguard-workpack.txt |
| ALL_CSV | ok | 69127 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-safeguard-workpack.csv |
| ALL_XLS | ok | 99302 | evaluation\2026-04-29-orchestration-download-smoke\files\대성창고-safeguard-workpack.xls |