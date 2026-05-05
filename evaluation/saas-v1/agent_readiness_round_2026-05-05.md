# SafeClaw Agent Readiness Round

Date: 2026-05-05
Branch: `codex/document-format-cta`
Scope: 로그인, 아카이브, 디자인 셸, 서식/다운로드, 지식 DB, 전파, QA 하네스

## 운영 방식

현재 툴 슬롯 제한상 7개 서브에이전트를 동시에 띄우는 방식은 사용할 수 없다. 이번 라운드는 순차 에이전트 판정으로 진행했고, 메인 에이전트는 PM/통합 판정자 역할만 수행했다.

앞으로도 긴 문맥에서는 아래 방식이 적합하다.

- 기능 축별 에이전트가 독립 판정한다.
- 메인 에이전트는 상충되는 판정과 P0/P1만 통합한다.
- 구현 전에 “안 도는 명칭”과 “실제 구현 수준”을 분리한다.

## Agent A - Auth / Archive / DB

### 현재 상태

- Supabase magic link와 세션 구독은 구현되어 있다.
- 브라우저 세션 access token을 Bearer로 API에 전달하고, 서버는 `auth.getUser(token)`으로 검증한다.
- 로그인 상태에서 `workpacks`, `workers`, `education_records` 저장 경로가 있다.
- `/api/workpacks`, `/api/dispatch-logs` 목록 조회는 owner 기준으로 동작한다.
- 비회원은 로컬 임시 저장 상태로 동작한다.

### 명칭과 실제 구현의 차이

- `로그인`: 랜딩의 로그인 버튼은 실제 로그인 시작이 아니라 `/workspace` 이동이다.
- `관리자`: 별도 관리자 role/claim이 아니라 인증된 사용자를 관리자처럼 표시한다.
- `문서팩 다시 열기`: 서버 row를 hydrate하지 않고 로컬 또는 `/documents` 이동 중심이다.
- `서버 아카이브`: 목록 browsing은 되지만 저장된 workpack 본문 재구성/편집 복원은 약하다.

### 우선순위

- P0: 서버 workpack 재열기 구현.
- P1: 관리자 명칭을 실제 role 기반으로 만들거나 “로그인 사용자/팀 이력”으로 낮춘다.
- P1: 홈 로그인 CTA를 실제 Auth 패널로 연결한다.
- P1: dispatch log 저장 실패를 UI에 명확히 반영한다.

## Agent B - Design Shell / Brand

### 현재 상태

- `/workspace` 핵심 흐름은 V1 Split + Top Stepper에 어느 정도 근접했다.
- Supporting routes는 SafeClaw shell을 사용한다.
- Landing, prototype, 공통 shell은 Remix/SafeClaw 브랜드 가이드와 아직 차이가 크다.

### 명칭과 실제 구현의 차이

- `/prototype`: 실제 handoff 화면이 아니라 `/workspace`로 redirect한다.
- Landing: 작업 콘솔 우선이 아니라 대형 hero와 회사 홈페이지형 nav 중심이다.
- `/workspace`: `SafeGuardCommandCenter`를 직접 렌더링해 shell 통일이 약하다.
- 로고: landing은 원형 outline이고, 가이드의 black square + yellow SC와 다르다.
- 메뉴 IA: landing과 product shell의 vocabulary가 이원화되어 있다.
- Yellow/radius/shadow/gradient: 브랜드 가이드와 legacy CSS가 섞여 있다.

### 우선순위

- P0: `/workspace`를 SafeClaw shell과 통합한다.
- P0: `/prototype`을 내부 map으로 유지할지 실제 handoff 화면으로 살릴지 결정한다.
- P0: landing을 콘솔형 제품 진입으로 정렬한다.
- P1: 로고, 메뉴, yellow 사용, radius/shadow/gradient를 정리한다.

## Agent C - Forms / Export

### 현재 상태

- 위험성평가표, 작업계획서, 안전작업허가 확인서, TBM 기록, 안전보건교육 기록은 문서별 profile과 고유 구조가 있다.
- “실제 안전서식/제출보조 초안” 수준으로는 방어 가능하다.
- 원본 직인, 허가번호, 결재선, 표 병합 레이아웃은 제출 전 확인 필요라고 코드가 명시한다.

### 명칭과 실제 구현의 차이

- `PDF 다운로드`: 실제 PDF 파일 다운로드가 아니라 HTML 팝업 + 브라우저 인쇄 흐름이다.
- `XLS`: 네이티브 XLSX가 아니라 Excel-compatible HTML `.xls`이다.
- `HWPX`: 원본 템플릿 셀/병합/여백/선 스타일 복제가 아니라 rhwp 기반 구조화 텍스트다.
- `Google Sheets`: OAuth/API 자동 입력이 아니라 `sheets.new` + TSV 클립보드 handoff다.

### 우선순위

- P0: 없음. 준제출형 안전서식으로 표현하면 방어 가능하다.
- P1: PDF 명칭을 `PDF 저장/인쇄`로 맞추거나 실제 binary download CTA를 연결한다.
- P1: XLS/HWPX/PDF를 원본 서식 반영처럼 표현하지 않는다.
- P1: 위험성평가의 가능성/중대성/등급을 행별 산정 근거로 높인다.

## Agent D - Evidence / Knowledge

### 현재 상태

- `/api/safety-reference/status`, `/api/safety-reference/search`, `/api/knowledge/match`는 살아 있다.
- Supabase safety reference DB는 ready 상태다.
- KOSHA 기술지원규정, SIF, 공종, 기계설비, JSA/위험성평가 자료는 검색층으로 작동한다.

### 명칭과 실제 구현의 차이

- `/evidence`: 근거는 보이지만 “어느 문서 어느 문장에 반영됐는지”까지 구조화되어 있지는 않다.
- `/knowledge?reference=...`: query를 상세 검색/패널로 여는 구현이 없다.
- `/api/safety-reference/search`: `TBM` 같은 동음어 의도 분리가 약하다.
- 직접근거/보조근거 구분은 프롬프트와 문구 중심이고, API 필드로 고정되어 있지는 않다.
- `/api/ask` 기본 생성은 Supabase 지식DB보다 seed 지식DB와 appendices 중심이다.

### 우선순위

- P0: 없음. 치명적 라우트 불능은 아니다.
- P1: `/api/ask`에 Supabase safety-reference catalog를 직접 연결한다.
- P1: evidence role을 구조화한다.
- P1: 긴 근거 목록이 문서 품질을 해치지 않게 요약/제한 규칙을 강화한다.

## Agent E - Workers / Dispatch

### 현재 상태

- 작업자 빠른 추가, 기존 작업자 수정, 선택 토글, 역할/국적/언어/교육상태 UI가 연결되어 있다.
- 교육상태 저장 경로가 있다.
- 외국인 메시지 선택 UI와 메시지 빌더가 있다.
- 메일/SMS 전파는 n8n webhook relay 구조다.
- 카카오/밴드는 UI에서 disabled 상태다.

### 명칭과 실제 구현의 차이

- `메일/SMS 전파`: 직접 provider 발송이 아니라 n8n relay다.
- `dispatch log`: dispatch 성공 후 클라이언트가 별도 저장한다. authToken, workpackId, channelResults가 없으면 로그가 남지 않는다.
- `카카오/밴드 잠금`: UI는 잠겨 있지만 API 타입/허용 목록에는 포함되어 있다.

### 우선순위

- P0: 없음. 즉시 깨지는 경로는 확인되지 않았다.
- P1: n8n relay임을 UI/로그에서 명확히 표시한다.
- P1: dispatch와 log 저장을 더 원자적으로 묶는다.
- P1: 카카오/밴드 API 허용도 UI 잠금 정책과 맞춘다.

## Agent F - QA / Commercial Readiness

### 현재 상태

- build/typecheck 스크립트는 있고 strict mode다.
- 20개 base scenario x 5 variant matrix와 일부 live `/api/ask` 샘플이 있다.
- 다운로드 검증은 PDF/HWPX/XLS/ALL_XLS 대표 시나리오를 포함한다.
- route, weather, export, UI 생성, Sheets TSV, 근거 링크 smoke가 있다.

### 명칭과 실제 구현의 차이

- 인증된 저장 happy path는 아직 출시 승인 게이트로 충분하지 않다.
- 실제 login/archive/reopen/edit E2E가 약하다.
- live dispatch는 기본적으로 꺼져 있고 notice 처리된다.
- `SAFEGUARD_AUTH_TOKEN` 부재 storage blocked가 final matrix에서 notice로 완화되는 구조가 있다.

### 우선순위

- P0: final gate에 `npm.cmd run build` 후 `npm.cmd run typecheck`를 강제 포함한다.
- P0: 인증 토큰/브라우저 세션 기반 저장 happy path를 필수 통과로 승격한다.
- P0: `/login` 또는 명확한 로그인 진입과 archive 재오픈 E2E를 추가한다.
- P0: live dispatch와 log 저장을 staging 수신자로 검증한다.
- P0: 하위 smoke `blocked`를 final matrix에서 notice로 낮추지 못하게 한다.

## 통합 판정

### 제출/공모전 관점

제출용 제품 데모로는 충분히 설득력 있는 수준이다. 핵심 문서 생성, 공공 API 근거, 외국인 메시지, 작업자/전파 흐름, 지식DB 검색층이 모두 존재한다.

### 유료 파일럿 관점

유료 파일럿 후보로는 가능하다. 다만 제안서/데모에서 다음 표현은 조심해야 한다.

- “관리자 로그인”보다는 “로그인 사용자 이력”이 더 정확하다.
- “PDF 다운로드”보다는 “PDF 저장/인쇄”가 현재 구현과 맞다.
- “Google Sheets 자동 생성”은 현재 구현과 맞지 않는다.
- “원본 HWPX 서식 복제”는 아직 아니다.
- “전파 실발송”은 n8n relay와 provider 설정에 의존한다.

### 상용 SaaS v1 출시 관점

상용 SaaS v1로 잠그려면 아래 P0를 먼저 닫아야 한다.

1. 실제 로그인 진입.
2. 서버 workpack 재열기.
3. archive reopen/edit E2E.
4. `/workspace` SafeClaw shell 통합.
5. final matrix blocked 정책 강화.

## 다음 작업 게이트

1차 게이트는 `Auth + Archive + Shell + QA`다.

권장 작업 순서:

1. `/login` 또는 `/workspace?login=1` 실제 로그인 진입.
2. `/api/workpacks?id=` 또는 detail route 추가.
3. `/archive`의 “다시 열기”가 서버 workpack을 hydrate.
4. `/documents?workpackId=`에서 서버 문서팩 편집 가능.
5. `/workspace` shell 통합과 로그인 CTA 수정.
6. final matrix에서 blocked 완화 금지.

이 게이트가 닫히면 “이름만 있는 SaaS” 느낌은 크게 줄어든다.
