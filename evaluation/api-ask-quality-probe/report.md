# `/api/ask` AI Mode Quality Probe

- Generated at: 07/05/2026 22:25:16
- Endpoint: https://www.safeclaw.kr/api/ask
- Scenario: 안산 제조공장 배관 용접·절단 화기작업, 외국인 근로자·신규 작업자·화재감시자·다국어 교육 포함

## Verdict

aiMode full 연결은 정상 작동했다. 기본 호출은 mode mock / 템플릿 산출물이고, full 호출은 mode live / OpenAI 응답 결합 상태로 돌아왔다. 품질 차이는 분명하며, 특히 법령·기상·공공자료·구조화 산출물 연결이 추가된다.

## Comparison

| Case | Mode | Status | Elapsed | Deliverables | Risk chars | TBM chars | Education chars |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| default | mock | 연결 점검 필요 | 1033 ms | 14 | 1438 | 1163 | 970 |
| full | live | 연결됨 | 96322 ms | 19 | 2531 | 1696 | 2043 |

## Default Preview

```text
위험성평가표(초안)
공식자료 기반: KOSHA 위험성평가 절차 및 4M 기법 참고

업체명: 그린메탈
업종: 제조업
작업명: 용접·절단 화기작업
공정/세부작업: 금속 절단, 아크 용접, 가연물 통제, 화재감시
작업장소: 경기 안산 제조공장
작업인원: 6명
기상 및 작업조건: 고온 작업조건, 온열질환 예방과 휴식 기준 공유 필요

[1. 사전준비]
- 평가대상 작업: 용접·절단 화기작업
- 참여자: 현장소장, 관리감독자, 작업반장, 해당 작업자
- 확인자료: 작업
```

## Full Preview

```text
[기본정보]
■ 작업일자: 2026-07-05
■ 회사명: 그린메탈
■ 업종: 제조업
■ 작업장소: 경기 안산 제조공장(배관라인)
■ 작업내용: 배관 용접·절단 화기작업(산소-아세틸렌 절단, 아크용접 병행)
■ 작업인원: 총 6명(내국인 3명, 외국인 근로자 2명, 신규 투입자 1명)
■ 기상조건: 기온 24℃, 풍속 1m/s, 강수없음 - 옥외 기상영향은 낮으나 실내 고온·환기불량이 주요 변수
■ 관련법령: 산업안전보건법 제38조(안전조치), 제39조(보건조치
```

## Full Mode Evidence

```text
Law.go와 OpenAI 응답을 결합했습니다. / 법령 근거 상태: live / 기상청 초단기실황 호출 성공 (안산, base 20260705 2100) / 기상청 초단기예보 호출 성공 (안산, base 20260705 2130) / 기상청 단기예보 호출 성공 (안산, base 20260705 2000) / 기상청 기상특보 조회 성공 (전국, 202607051000) / 기상청 영향예보 조회 성공 (서울서남권, 보건(일반인)) / 고용24 사업주훈련 호출 성공. 교육 적합성은 현장 키워드와 대상 일치 여부로 재정렬했습니다. / KOSHA 교육포털 메타데이터 확인 성공. 교육대상 26개, 과정 후보 3건을 반영했습니다. / KOSHA·고용노동부 공식 자료 URL 6건 확인. 확인된 자료의 서식 힌트와 반영 위치를 위험성평가·TBM·교육 기록에 적용했습니다. / KOSHA 세부 OpenAPI 2건을 문서 반영 근거로 연결했습니다. 보류 상세: 정상 응답 / 화학물질 키워드가 없어 MSDS 호출을 건너뜁니다. / 건설업 작업 키워드가 없어 건설업 일별 중대재해 현황 호출을 건너뜁니다. / KOSHA 국내재해사례 후보 API live 호출 성공. 유사 사례를 TBM과 교육 문구에 반영했습니다. 연결 방식: urlsearchparams:raw / KOSHA 사고사망 게시판 live 호출 성공. 중대위험 사례를 TBM과 교육 문구에 반영했습니다. / 지식 DB 매칭 4건 / Supabase 카탈로그 매칭 8건 (configured=true) / structured 위험성평가 rows 4건, 검증 이슈 2건 (structured rows=AI) / TBM-risk 연결 4건 (TBM-risk links=AI) / AI_MODE=full (Gemini 본문 18개 채움: riskAssessmentDraft, workPlanStructured, tbmBriefingStructured, tbmQuestions, tbmLogStructured, tbmLogDraft, educationRecordStructured, safetyEducationPoints, structuredRiskRows, structuredRiskRowsValidationIssues, workpackSummaryDraft, emergencyResponseDraft, photoEvidenceDraft, kakaoMessage, foreignWorkerBriefing, foreignWorkerTransmission, foreignWorkerLanguages, tbmRiskLinks) [riskAssessment=ok workPlanStructured=ok tbmBriefingStructured=ok tbmLogStructured=ok tbmLog=ok educationRecordStructured=ok structuredRiskRows=ok free=ok foreign=ok tbmRiskLinks=ok]
```

## Saved Responses

- evaluation/api-ask-quality-probe/default.json
- evaluation/api-ask-quality-probe/full.json
- evaluation/api-ask-quality-probe/report.json
- evaluation/api-ask-quality-probe/report.md

