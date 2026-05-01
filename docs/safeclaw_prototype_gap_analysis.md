# SafeClaw Prototype Gap Analysis

## 목적

이 문서는 `SafeClaw Prototype _standalone_.html`의 16화면 제품 구조와 현재 Next.js 구현의 차이를 정리합니다. 목표는 기능 엔진을 유지하면서 SafeClaw를 `랜딩 + 운영 셸 + 작업공간 + 시스템 화면`을 갖춘 실제 서비스처럼 재구성하는 것입니다.

## 기준 상태

### 프로토타입이 제시한 목표 상태

프로토타입은 아래 구조를 갖습니다.

| 영역 | 화면 |
|---|---|
| 진입 | 랜딩 A, 랜딩 B, 로그인 |
| 제품 | 홈 대시보드, 워크스페이스 A, 워크스페이스 B, 문서 편집, 근거 라이브러리, 작업자, 현장 전파 |
| 필드 | 모바일 작업자 뷰, TBM 풀스크린 |
| 시스템 | 이력, 지식 DB, API 연결, 설정 |

공통 셸은 `TopBar + Sidebar + PageLayout`입니다. 사이드바는 `홈`, `작업 입력`, `문서팩`, `근거 라이브러리`, `작업자·교육`, `현장 전파`, `TBM 모드`, `이력·아카이브`, `지식 DB`, `API 연결`, `설정`을 기준으로 나뉩니다.

### 현재 구현 상태

현재 구현은 기능 엔진과 공공 API 조합이 강합니다.

| 영역 | 현재 상태 |
|---|---|
| 랜딩 | `/`에 SafeClaw 랜딩 일부와 기존 작업 입력 흐름이 함께 있음 |
| 워크스페이스 | `SafeGuardCommandCenter`, `FieldOperationsWorkspace`, `WorkpackEditor` 중심 |
| 문서팩 | 11종 산출물, 편집, Excel/HWPX/PDF 중심 다운로드 |
| 근거 | Law.go, KOSHA, Work24, 기상청, 재해사례, 지식 DB 일부 연결 |
| 전파 | n8n 기반 메일·문자 전파, 카카오·밴드 준비 중 |
| 저장 | Supabase 기반 관리자 저장 흐름 |
| 보조 페이지 | `/demo`, `/why`, `/preview`, `/trust`, `/roadmap`, `/knowledge`, `/search`, `/dryrun` |

## 핵심 갭

| 갭 | 현재 | 목표 | 조치 |
|---|---|---|---|
| 서비스 셸 | 홈 내부에 작업공간과 랜딩이 결합 | 전역 `SafeClawAppShell`로 분리 | TopBar, Sidebar, PageHeader를 공통 컴포넌트화 |
| 라우팅 | `/`, `/demo`, `/knowledge` 등 일부 라우트만 분리 | 16화면을 제품 IA로 분리 | `/app`, `/workspace`, `/docs`, `/evidence`, `/workers`, `/dispatch`, `/tbm`, `/archive`, `/settings` |
| 랜딩 | 기능 화면 위에 얹힌 소개 섹션 | 별도 마케팅 랜딩 | `/`는 랜딩 전용, 실제 작업은 `/workspace`로 이동 |
| 홈 대시보드 | 최근 문서팩/현장 상태가 작업공간 내부에 섞임 | 운영 홈 대시보드 | `/app`에 오늘 위험, 미완료 교육, 전파 실패, 최근 문서팩 배치 |
| 문서 편집 | 기능은 강하지만 긴 편집 패널 중심 | 문서 편집 전용 화면 | `/docs`에서 문서 목록, 편집, 버전, 다운로드를 분리 |
| 근거 라이브러리 | 생성 결과 하단/보조 검색 중심 | 독립 근거 라이브러리 | `/evidence`에 법령, KOSHA, 재해사례, 지식 DB 매핑 |
| 작업자 관리 | 워크스페이스 우측 패널 | 작업자·교육 화면 | `/workers`로 분리하고 교육상태·언어·연락처 관리 |
| 전파 | 워크스페이스 전파 패널 | 전파 결과/추적 화면 | `/dispatch`에 채널, 수신자, 언어, 로그 표시 |
| TBM | 문서 중 하나 | 현장 풀스크린 모드 | `/tbm`은 태블릿·현장 화면 기준으로 단순화 |
| 시스템 화면 | 설정/연결 상태가 산재 | API 연결·설정·이력 분리 | `/api-status`, `/settings`, `/archive` 신설 또는 정리 |

## 우선순위 판단

지금 바로 가격/플랜 화면을 추가하는 것보다 `기존 기능을 새 셸로 마이그레이션`하는 것이 우선입니다. 이유는 제출과 시연에서 가장 큰 차이를 만드는 지점이 기능 추가가 아니라 “진짜 서비스처럼 보이는 정보구조”이기 때문입니다.

권장 순서:

1. `/`를 랜딩 전용으로 고정합니다.
2. 기존 작업 생성 흐름을 `/workspace`로 이동합니다.
3. 프로토타입의 `TopBar + Sidebar`를 Next.js 컴포넌트로 이식합니다.
4. `WorkpackEditor`를 `/docs`에서도 열 수 있게 분리합니다.
5. `CitationList`, 지식 DB, 법령 상세를 `/evidence` 중심으로 묶습니다.
6. `WorkerEducationPanel`과 `WorkflowSharePanel`을 각각 `/workers`, `/dispatch`에서도 재사용합니다.
7. `/tbm`은 현장 풀스크린 모드로 별도 구현합니다.
8. `/archive`, `/settings`, `/api-status`는 현재 저장·환경·스모크 결과를 보여주는 시스템 화면으로 둡니다.

## 기능 보존 원칙

전수 디자인 리팩토링을 하더라도 아래 엔진은 유지합니다.

| 엔진 | 유지 이유 |
|---|---|
| `/api/ask` | 기상청, Law.go, Work24, KOSHA, Gemini 조합 생성의 핵심 |
| `WorkpackEditor` | 11종 문서 편집과 다운로드 품질이 이미 축적됨 |
| `FieldOperationsWorkspace` 내부 저장/전파 로직 | Supabase, n8n, worker education 흐름이 붙어 있음 |
| `lib/safety-document-rubric.ts` | 공공기관·ISO 45001식 품질 점검 기준 |
| `/api/knowledge/*` | LLM wiki와 지식 DB 확장의 기반 |

## 리팩토링 목표 구조

```text
/
  랜딩 전용
/app
  운영 홈 대시보드
/workspace
  오늘 작업 입력 -> API 조합 -> 문서팩 생성
/docs
  문서팩 편집, 버전, 다운로드
/evidence
  법령, KOSHA, 재해사례, 지식 DB 근거
/workers
  작업자, 교육, 언어, 연락처
/dispatch
  메일, 문자, 카카오, 밴드, 전파 로그
/tbm
  현장 풀스크린 TBM
/archive
  과거 문서팩, 교육기록, 전파기록
/knowledge
  지식 DB와 LLM wiki
/api-status
  공공 API, n8n, Supabase 연결 상태
/settings
  조직, 현장, 관리자, 채널 설정
```

## 구현 단계

### Phase 1. 셸 이식

- `SafeClawAppShell` 생성.
- `TopBar`, `Sidebar`, `ClawMark`, `Wordmark`, `PageHeader` 분리.
- 기존 `/demo`, `/why`, `/preview`, `/trust`, `/roadmap`은 당장 유지하되 새 셸 적용은 후순위.

### Phase 2. 랜딩과 작업공간 분리

- `/`는 프로토타입 랜딩을 기준으로 재구성.
- 기존 `SafeGuardCommandCenter`는 `/workspace`로 이동.
- 홈 CTA는 `14일 무료 체험`, `30초 데모`, `작업공간 열기`로 정리.

### Phase 3. 핵심 제품 화면 분리

- `/app`: 운영 홈.
- `/docs`: `WorkpackEditor` 중심.
- `/evidence`: `CitationList`와 지식 DB 검색 중심.
- `/workers`: 작업자·교육 패널 중심.
- `/dispatch`: 전파 패널과 로그 중심.

### Phase 4. 필드 화면

- `/tbm`: 현장 풀스크린.
- 모바일 작업자 뷰는 별도 route 또는 responsive section으로 구현.

### Phase 5. 시스템 화면

- `/archive`: Supabase 저장 이력.
- `/api-status`: 공공 API, n8n, Supabase 상태.
- `/settings`: 조직, 현장, 채널 설정.

## 제출 전 최소 도달 기준

| 기준 | 완료 조건 |
|---|---|
| 첫 인상 | `/`가 완전히 SafeClaw 브랜드 랜딩으로 보임 |
| 기능 진입 | CTA에서 `/workspace`로 이동해 기존 생성 기능이 그대로 작동 |
| 제품 IA | 사이드바로 홈, 작업, 문서, 근거, 작업자, 전파, TBM, 이력, 지식 DB 이동 |
| 데이터 흐름 | `/workspace`에서 생성한 문서팩을 `/docs`, `/evidence`, `/workers`, `/dispatch`가 재사용 |
| 제출 안정성 | 기존 `typecheck`, `build`, `smoke:submission` 회귀 없음 |

## 결론

다음 작업은 `가격/플랜 화면 추가`가 아니라 `기존 SafeGuard Workspace를 새 SafeClaw 셸로 마이그레이션`입니다. 지금 제품의 약점은 기능 부족이 아니라 정보구조와 화면 분리가 아직 데모형이라는 점입니다.

추천 결정:

`랜딩은 프로토타입 기준으로 전면 교체하고, 기존 기능 엔진은 /workspace 아래로 이동한다. 이후 문서·근거·작업자·전파 화면을 같은 엔진을 재사용하는 독립 화면으로 분리한다.`
