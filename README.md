# contest-mvp

산업안전 법령·판례 코파일럿 MVP 스캐폴드.

## 오늘 완료된 것
- Next.js 앱 구조
- 통합 검색 `/search`
- 질문형 데모 `/ask`
- 법령 상세 `/law/[id]`
- 판례 상세 `/precedent/[id]`
- API 라우트 `/api/search`, `/api/ask`
- mock mode 기본값
- 내일 Law.go 키 연결용 어댑터 자리 확보

## 내일 할 것
1. `.env.example` 복사 후 `.env.local` 생성
2. `LAWGO_OC` 입력
3. `LAWGO_MOCK_MODE=false` 전환
4. Law.go 실검색/상세 어댑터 연결
5. OpenAI 키 입력 후 답변 고도화

## 실행
```bash
npm install
cp .env.example .env.local
npm run dev
```

## 제품 스토리
- 공공데이터(법령/판례) + AI를 이용해 산업안전 실무 질문에 근거 기반 답변 제공
- KOSHA/기상청/에어코리아는 다음 확장 데이터 소스로 연결 예정
