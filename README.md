# SafeClaw

작업 전 현장 설명을 `위험성평가표`, `작업계획서`, `TBM`, `안전보건교육 기록`, `비상대응`, `사진/증빙`, `현장 전파 메시지`로 정리하는 산업안전 문서팩 서비스입니다.

## 주요 흐름

- `/` 현장 상황 입력, 문서팩 편집, 다운로드, 근거 확인, 현장 전파
- `/ask` 근거 기반 질의와 문서 판단 보조
- `/search` Law.go 중심 법령·판례·해석례 통합 근거 탐색
- `/dryrun` 운영 점검 로그와 검증 리포트 확인
- `/api/ask`, `/api/search`, `/api/workflow/dispatch` 제품 API

## 데이터 연결

- Law.go: 법령, 판례, 법령해석례
- korean-law-mcp: 법령 근거 보강
- Gemini: 문서팩 생성 및 쉬운 문장 브리핑
- 기상청: 현장 기상 신호
- Work24: 후속 직업훈련·취업교육 후보
- KOSHA: 공식 안전보건 자료, 교육포털, 유사 재해사례
- Oracle n8n: 메일, 문자, 카카오, 밴드 등 현장 전파 자동화

## 실행

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

## 환경 변수

- `LAWGO_OC`: Law.go 법령정보 API OC
- `KOREAN_LAW_MCP_ENABLED=true`: korean-law-mcp 근거 보강 활성화
- `GEMINI_API_KEY`: 문서팩 생성과 다국어 안전문구 생성
- `DATA_GO_KR_SERVICE_KEY`: 공공데이터포털 기반 기상·KOSHA 재해사례 호출
- `WORK24_AUTH_KEY`: 고용24 훈련과정 추천
- `N8N_INTERNAL_BASE`: 로컬 또는 서버 내부 n8n 호출용
- `N8N_PUBLIC_BASE`: Vercel 같은 호스팅 환경에서 사용할 공개 HTTPS relay
- `N8N_WEBHOOK_PATH`, `N8N_WEBHOOK_TOKEN`: 현장 전파 webhook 경로와 인증 토큰

Vercel에는 `N8N_INTERNAL_BASE`를 넣지 말고 `N8N_PUBLIC_BASE`만 사용합니다.

## 검증

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run audit:launch
```

`npm.cmd run audit:launch`는 `evaluation/launch-readiness/api-connection-audit.json`에 API 연결, 파싱, 문서팩 반영 위치, 전파 상태를 남깁니다.

## 디자인 기준

UI 변경은 루트의 `DESIGN.md`를 기준으로 합니다. SafeClaw는 랜딩페이지가 아니라 현장 작업자가 바로 쓰는 문서팩 워크스페이스처럼 보여야 하며, 사용자 화면에는 구현용 상태어 대신 `연결됨`, `일부 근거 보류`, `연결 점검 필요` 같은 운영 언어를 사용합니다.
