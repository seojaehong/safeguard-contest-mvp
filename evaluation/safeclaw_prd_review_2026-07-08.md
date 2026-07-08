# SafeClaw PRD v1.0 검수 결과

검수일: 2026-07-08

대상:

- `C:\Users\iceam\.codex\attachments\b2b29e99-e292-4e57-93dd-cdf8501cc190\pasted-text.txt`

## 총평

문서의 방향은 좋다. “문서 생성 데모”가 아니라 “작업 전 안전 문서팩 운영 제품”으로 가야 한다는 결론은 현재 SafeClaw의 제품 방향과 맞다. 다만 개발팀이 바로 붙을 수 있는 PRD로 쓰기에는 아직 기능 목록형 문서에 가깝다.

가장 큰 문제는 세 가지다.

1. 현재 사용자가 요구한 `fallback이 아닌`, `하네스 엔지니어링`, `DB 정합화`, `온톨로지 결합`이 PRD의 핵심 게이트로 들어가 있지 않다.
2. 기존 레포의 실제 구조인 `workpacks`, `dispatch_logs`, `mcp_tokens`, `evidenceLabels`, `qa_review_docpack`, `generate_reviewed_safety_docpack`을 기준으로 작성되지 않았다.
3. 성공 지표와 Acceptance Criteria에 숫자/비율/시간 표현이 많아 현재 문서 규칙과 충돌한다.

## 주요 수정 필요 사항

### 1. `graceful fallback`을 시스템 요구로 두면 이번 목표와 충돌한다

원문 위치:

- 13장 시스템 요구: `외부 API 장애 시 graceful fallback`
- 9.3 Acceptance Criteria: `근거 링크가 깨지면 fallback 상태를 보여야 함`

문제:

이번 요구는 “폴백이 아닌, 온톨로지까지 조합되어 개발”이다. 그러면 PRD의 핵심은 fallback 허용이 아니라 `live-readiness gate`여야 한다. 즉, fallback은 조용히 대체하는 성공 경로가 아니라 명확한 차단/보완 상태로 다뤄야 한다.

수정 제안:

- `fallback` 표현을 `보류`, `차단`, `수동 확인 필요`로 바꾼다.
- 생성 성공 기준을 `문서가 나왔다`가 아니라 `live 근거, 구조화 산출물, 온톨로지 검수, 증빙 매핑이 모두 붙었다`로 둔다.

### 2. 하네스 엔지니어링이 PRD 기능으로 들어가 있지 않다

원문 위치:

- 3장 목표
- 9.2 문서팩 생성
- 14장 기술 요구사항

문제:

문서 생성 품질 안정화라고만 되어 있고, 실제 개발팀이 구현해야 할 harness 요구가 없다. 현재 레포에는 구조화 문서, 모델 타임아웃 정책, 진단/스모크, QA 검수 도구가 이미 있으므로 PRD도 이를 기준으로 써야 한다.

수정 제안:

새 섹션을 추가한다.

```md
## Harness Requirements
- 모든 문서팩 생성은 `qualityContract`를 반환한다.
- full/enhanced 모드는 구조화 산출물 준비 여부를 표시한다.
- `mock`, `fallback`, `live` 모드를 숨기지 않는다.
- 온톨로지 QA 결과와 증빙 매핑 결과가 없으면 제출 가능 상태가 아니다.
- 테스트는 단순 생성 성공이 아니라 누락 조치, 미검증 근거, DB 저장 가능 상태까지 검증한다.
```

### 3. 온톨로지 요구가 `내부 지식 DB`로만 흐려져 있다

원문 위치:

- 9.3 데이터 소스: `내부 지식 DB`
- 13장 외부 연동

문제:

현재 SafeClaw의 차별점은 단순 지식 DB가 아니라 작업유형, 위험요인, 안전조치, 법조문, 중대재해처벌법 시행령 제4조 증빙 의무를 잇는 온톨로지다. 그런데 원문에서는 `내부 지식 DB`로만 표현되어 기능 요구가 약해졌다.

수정 제안:

- `Evidence Mapping`과 별도로 `Ontology QA` 모듈을 만든다.
- `qa_review_docpack` 또는 같은 수준의 웹 경로 검수를 명시한다.
- `작업유형 자동 보정`, `누락 안전조치 탐지`, `법조문/의무 연결`, `제출 전 점검표`를 Acceptance Criteria로 둔다.

### 4. 데이터 모델 초안이 현재 DB와 맞지 않는다

원문 위치:

- 11장 데이터 모델 초안

문제:

새 Entity를 추상적으로 나열하고 있지만, 현재 레포에는 이미 `workpacks`, `dispatch_logs`, `mcp_tokens`, worker snapshot, dispatch snapshot, evidence summary 저장 흐름이 있다. 이 PRD 그대로 개발하면 기존 구조와 중복되거나 migration 충돌이 날 수 있다.

수정 제안:

11장은 새 모델 초안이 아니라 `Current Schema Alignment`로 바꾼다.

필수로 적어야 할 것:

- 기존 테이블/JSON 컬럼 중 재사용할 것
- 새 migration이 필요한 것
- 기존 데이터 변형 여부
- RLS/권한 영향
- `workpack_id`로 문서, 작업자 snapshot, 전파 로그, evidence summary가 어떻게 연결되는지

### 5. UI/UX 요구가 너무 broad해서 개발 순서가 안 나온다

원문 위치:

- 9.1~9.7 전체
- 10장 UI/UX 전면 개선안

문제:

좋은 방향이 많지만 개발팀이 바로 붙기엔 화면별 우선순위가 섞여 있다. 특히 랜딩, 작업공간, 문서편집, 전파, 아카이브, Ops가 모두 같은 레벨에 있어 첫 sprint가 커진다.

수정 제안:

UI/UX는 다음처럼 첫 구현 단위를 줄인다.

- C1: 작업공간에 `qualityContract` 패널 노출
- C2: 문서 편집 화면에 `제출 전 점검` 패널 노출
- C3: 전파 wizard는 실제 발송 전 요약 카드부터 구현
- C4: 아카이브는 서버 저장 문서팩과 로컬 snapshot을 더 명확히 구분

### 6. 문서 규칙과 충돌하는 숫자/비율/성공률 표현이 많다

원문 위치:

- 7장 성공 지표: 완료율, 이탈률, 실행 비율, 응답률, 실패율, 오류율, 깨짐 비율, 클릭률
- 9.1 Acceptance Criteria: `30초`
- 9.4 Acceptance Criteria: `1분`, `3명`
- 9.6 Acceptance Criteria: `3클릭`
- 9.7 기능 요구사항: `성공률`, `P95`
- 14장 성능: `3초`, `15초`, `5초`

문제:

현재 프로젝트 문서 규칙은 확률, 점수, 적중률 숫자 출력을 금지한다. 성공률/비율류 표현은 그대로 두면 제출용 문서 규칙과 충돌한다.

수정 제안:

- `완료율`, `응답률`, `실패율`은 내부 분석 이벤트명으로만 둔다.
- 사용자/제출용 문서에는 `생성 완료 여부`, `전파 실행 여부`, `확인 응답 여부`, `출력 오류 발생 여부`처럼 상태형 지표로 바꾼다.
- 시간/클릭 숫자는 내부 UX 목표로 분리하고 외부 문서에서는 제거한다.

### 7. `자동 저장`은 위험하다

원문 위치:

- 9.6 Acceptance Criteria: `생성 완료된 문서팩은 자동 저장되어야 함`

문제:

현재 SafeClaw는 로컬 snapshot과 관리자 서버 저장을 구분한다. 자동 저장을 요구하면 로그인 전/후, 조직/현장 귀속, 개인정보 포함 여부, 작업자 연락처 저장 동의가 모두 얽힌다.

수정 제안:

- 생성 직후는 `브라우저 current snapshot 저장`
- 관리자 로그인 후는 `서버 workpack 저장`
- 작업자 연락처/전파 대상은 별도 동의 후 저장
- 제출 증빙은 서버 저장본만 인정

### 8. 전파/확인 요구는 개인정보와 권한 요구가 부족하다

원문 위치:

- 9.4 Workers
- 9.5 Dispatch
- 12장 권한 모델

문제:

휴대폰, 이메일, 국적, 언어 정보가 들어가는데 동의, 보관기간, 마스킹, 발송 권한, 작업자 확인 링크의 인증 방식이 없다.

수정 제안:

- 연락처는 전파 목적 필드로 제한
- UI에는 마스킹 표시
- 확인 링크는 토큰형/만료형 중 하나로 명시
- 관리자와 현장관리자 권한 차이를 Supabase RLS 기준으로 정의

## 구조 재작성 제안

현재 문서는 좋은 제품 PRD 초안이다. 하지만 개발 실행용으로는 아래 구조가 더 맞다.

```md
# SafeClaw Integrated Workpack Loop PRD

## 1. Scope
- 작업 전 문서팩 생성
- live 근거 연결
- 온톨로지 QA
- 증빙 매핑
- 전파/확인
- 서버 저장

## 2. Non-goals
- 종합 EHS
- ERP/그룹웨어 깊은 통합
- 공공조달 전체 기능
- silent fallback 성공 처리

## 3. Current Architecture
- /api/ask
- generate_reviewed_safety_docpack
- qa_review_docpack
- evidenceLabels
- workpacks / dispatch_logs
- current workpack local snapshot

## 4. Required Contract
- qualityContract
- live readiness
- ontology review
- DB persistence readiness
- evidence filing readiness

## 5. Stories
- C1 qualityContract response + UI
- C2 web ontology QA
- C3 DB consistency gate
- C4 dispatch confirmation
- C5 archive evidence file

## 6. Acceptance Gates
- no silent fallback
- no unmapped evidence in submit-ready state
- no server save without org/site scope
- no dispatch without recipient preview
```

## 결론

이 PRD는 방향성 문서로는 충분히 쓸 만하다. 하지만 지금 바로 개발팀에 넘길 문서라면 `기능 목록`보다 `통합 계약`, `현행 코드 기준`, `DB migration 여부`, `온톨로지 QA`, `fallback 차단 조건`이 앞에 와야 한다.

다음 버전은 제목부터 `SafeClaw Integrated Workpack Loop PRD`로 바꾸고, 첫 sprint를 `qualityContract + web ontology QA + DB 저장 정합성 gate`로 좁히는 것이 좋다.
