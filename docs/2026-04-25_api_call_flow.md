# SafeGuard API 호출 순환구조 메모

## 결론
현재 SafeGuard의 호출 흐름은 순환참조 없이 아래 한 방향으로 진행된다.

1. 페이지 또는 API 라우트에서 `runAsk` 또는 `runSearch` 호출
2. `runSearch` / `runAsk`가 `searchLegalSources`를 통해 Law.go 법령/판례/해석례를 우선 조회
3. 긴 자연어 질문은 `산업안전보건법` 중심 fallback 질의로 한 번 더 보강
4. 설정 시 `korean-law-mcp`를 추가로 조회해 근거를 보강
5. `runAsk`는 동시에 `기상청`, `고용24`, `KOSHA` 보강 데이터를 병렬 수집
   - 기상청은 `초단기실황`, `초단기예보`, `단기예보`를 같은 위치 격자(nx/ny)로 병렬 확인한다.
6. 수집한 citations를 `generateAnswer`로 넘겨 Gemini 또는 OpenAI 응답 생성
7. AI 호출 실패 시 `buildMockAskResponse`로 fallback
8. 최종적으로 `AskResponse` 또는 검색 결과를 페이지/API 응답으로 반환

## 코드 기준 경로
- 홈 페이지: `app/page.tsx` -> `runAsk`
- 질문 API: `app/api/ask/route.ts` -> `runAsk`
- 검색 API: `app/api/search/route.ts` -> `runSearch`
- 질문 오케스트레이션: `lib/search.ts`
- 근거 검색: `lib/legal-sources.ts`
- Law.go 레이어: `lib/lawgo.ts`
- 기상청 레이어: `lib/weather.ts`
- 고용24 교육 연계: `lib/work24.ts`
- KOSHA 가이드 보강: `lib/kosha.ts`
- AI 레이어: `lib/ai.ts`
- mock 및 시나리오 생성: `lib/mock-data.ts`

## 현재 상태 정리
- `Law.go`: live adapter 구현 완료
- `기상청 초단기실황/초단기예보/단기예보`: live adapter 구현 완료
- `고용24 사업주훈련/교육 추천`: live adapter 구현 완료
- `KOSHA`: 현재는 공식 가이드 링크 기반 fallback 보강 경로
- `korean-law-mcp`: 설정 시 보강 가능
- `Gemini`: live 가능
- 최종 응답 안정성: timeout 20초, retry 1회, 실패 시 graceful fallback

## 더미데이터가 들어가는 위치
- `lib/mock-data.ts`에서 업체명, 업종, 현장명, 작업유형, 위험요인, 교육 포인트를 포함한 시나리오 프로필을 관리
- 질문 문자열의 키워드를 기반으로 건설업, 물류업, 제조업, 시설관리업 시나리오를 선택
- 선택된 시나리오에 맞춰 위험성평가, TBM, TBM 일지, 안전교육 기록, 카카오 메시지까지 생성

## E2E 테스트가 검증하는 범위
- `/` 홈 렌더링
- `/ask` 보조 화면 렌더링
- `/api/ask` 응답 구조와 산출물 필드
- `/api/search` 검색 결과 응답 구조
- 업체별 시나리오가 올바른 회사명과 업종으로 매핑되는지
- Law.go, 기상청 3종 응답, 고용24 live 응답이 status와 외부 데이터 필드에 반영되는지
