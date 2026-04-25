# 2026-04-25 Live Integration Report

## 요약
- Law.go: live
- Gemini: live
- 기상청 단기예보: live
- 고용24 교육 추천: live
- KOSHA: fallback 공식 가이드 보강

## 검증 결과
- 대표 시나리오 `/api/ask`: 성공
- 대표 시나리오 법령 근거: 6건 확인
- 대표 시나리오 상태값: `lawgo=live`, `ai=live`, `weather=live`, `work24=live`, `kosha=fallback`
- 상황별 E2E: 4건 중 4건 성공
- 평균 응답시간: 18578ms
- P95 응답시간: 21117ms

## 산출물 연계 확인
- 위험성평가 초안: 생성 확인
- TBM 브리핑: 생성 확인
- TBM 일지: 생성 확인
- 안전교육 기록 초안: 생성 확인
- 고용24 추천 교육: 안전교육 기록 초안에 연결 확인
- 기상청 위험 신호: 답변/TBM 브리핑에 연결 확인
- KOSHA 가이드: TBM 일지에 연결 확인

## 참고 파일
- `evaluation/2026-04-25-live-e2e/ask-live.json`
- `evaluation/2026-04-25-scenario-e2e/summary.json`
- `evaluation/2026-04-25-scenario-e2e/details.json`
- `docs/2026-04-25_api_call_flow.md`

## 남은 리스크
- KOSHA는 아직 공식 API 어댑터가 아니라 공식 자료 링크 기반 fallback 보강 경로다.
- `korean-law-mcp`는 현재 비활성화 상태라 Law.go 단일 축으로 검증했다.
