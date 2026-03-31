# Korean Law MCP Integration

## 목적
`contest-mvp`의 기존 Law.go 중심 흐름을 유지하면서, `korean-law-mcp`를 법령/판례/해석례 보강 소스로 붙였다.

## 설계 원칙
1. **Law.go-first 유지**
   - 기존 `lib/lawgo.ts` 결과를 먼저 사용한다.
   - mock/live 분기 구조는 그대로 둔다.
2. **보강은 옵션 처리**
   - `KOREAN_LAW_MCP_ENABLED=true`일 때만 추가 호출한다.
   - 키가 없거나 호출 실패하면 기존 흐름만 유지한다.
3. **데모 설명 가능성 강화**
   - `/search`와 `/ask`에서 source label로 근거 출처를 구분한다.
   - 판례뿐 아니라 해석례까지 같은 UX 안에서 보여준다.

## 추가된 핵심 파일
- `lib/korean-law-mcp.ts`
  - `korean-law-mcp` 패키지를 직접 호출하는 서버 어댑터
  - 법령/판례/해석례 검색 결과를 `SearchResult`로 정규화
  - `klm-law-*`, `klm-prec-*`, `klm-expc-*` ID로 상세 조회 라우팅
- `lib/legal-sources.ts`
  - Law.go + korean-law-mcp 결과 merge
  - source mix 요약 제공
- `app/interpretation/[id]/page.tsx`
  - 해석례 상세 페이지

## 검색 동작
1. `searchLegalSources()`가 먼저 `searchLawGo()` 호출
2. 이어서 `searchKoreanLawMcp()` 호출
3. title/type 기준으로 중복 제거 후 최대 10건 반환
4. `/api/search`는 `sourceMix` 메타데이터를 함께 반환

예시 응답 필드:
```json
{
  "q": "하청 안전보건 책임",
  "count": 6,
  "results": [...],
  "sourceMix": {
    "total": 6,
    "counts": {
      "mock": 4,
      "korean-law-mcp": 2
    },
    "koreanLawMcp": {
      "enabled": true,
      "configured": true,
      "keySource": "LAWGO_OC",
      "summary": "korean-law-mcp 활성화 (LAWGO_OC)"
    }
  }
}
```

## 상세 조회
- `law/*` → 기존 mock/Law.go 상세 + korean-law-mcp 법령 상세 공존
- `precedent/*` → 기존 mock/Law.go 판례 + korean-law-mcp 판례 공존
- `interpretation/*` → korean-law-mcp 전용 상세 페이지 추가

## 환경 변수
`.env.local` 예시:
```bash
LAWGO_MOCK_MODE=true
LAWGO_OC=...

KOREAN_LAW_MCP_ENABLED=true
# 비우면 LAWGO_OC를 재사용
KOREAN_LAW_MCP_LAW_OC=

OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

## 남은 확장 포인트
- Law.go 실검색/상세가 붙으면 현재 merge 레이어 그대로 사용 가능
- answer 생성 시 citation ranker를 추가해 법령/판례/해석례 비율을 조절할 수 있음
- `get_article_with_precedents`, `chain_full_research` 같은 korean-law-mcp 체인 도구까지 붙이면 근거 품질을 더 끌어올릴 수 있음
