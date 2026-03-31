# contest-mvp

산업안전 법령·판례 코파일럿 MVP.

## 현재 상태
- Next.js 앱 구조
- 통합 검색 `/search`
- 질문형 데모 `/ask`
- 법령 상세 `/law/[id]`
- 판례 상세 `/precedent/[id]`
- 해석례 상세 `/interpretation/[id]`
- API 라우트 `/api/search`, `/api/ask`
- Law.go-first 검색 흐름 유지
- `korean-law-mcp` 보강 레이어 추가
  - 법령/판례/해석례 검색 보강
  - `/api/search`에 source mix 메타데이터 포함
  - 질문형 답변 citation에 korean-law-mcp 근거 혼합 가능
- mock mode 기본값 유지

## 실행
```bash
npm install
cp .env.example .env.local
npm run dev
```

## 환경 변수
- `LAWGO_MOCK_MODE=true` → 기본 데모 모드
- `KOREAN_LAW_MCP_ENABLED=true` + `KOREAN_LAW_MCP_LAW_OC`(또는 `LAWGO_OC`) → korean-law-mcp 보강 활성화
- `OPENAI_API_KEY` → 질문형 답변을 실제 LLM 응답으로 전환

자세한 설정/연동 포인트는 `KOREAN-LAW-MCP-INTEGRATION.md` 참고.

## 제품 스토리
- 공공데이터(법령/판례/해석례) + AI를 이용해 산업안전 실무 질문에 근거 기반 답변 제공
- Law.go를 주 검색 플로우로 유지하면서, korean-law-mcp를 통해 법적 근거 중복성과 설명 가능성을 강화
- KOSHA/기상청/에어코리아는 다음 확장 데이터 소스로 연결 예정
