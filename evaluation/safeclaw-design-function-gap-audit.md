# SafeClaw Design-to-Function Audit

검토일: 2026-05-02
대상: SafeClaw 디자인 핸드오프, 16화면 프로토타입, 현재 Next.js 라우트/컴포넌트
기준: 디자인 명세와 기능 명세가 실제 제품 화면에 같은 구조로 붙어 있는지 확인

## 결론

현재 상태는 `디자인 명세와 기능 명세가 1:1로 완성된 상태`가 아닙니다. 정확히는 아래 단계입니다.

- `/workspace`는 실제 엔진입니다. 작업 입력, 기상 선조회, `/api/ask`, 문서팩 생성, 문서 편집, 다운로드, 작업자/교육, 전파 패널이 실제로 묶여 있습니다.
- 새 SafeClaw 16화면 라우트는 제품 IA로 나뉘었지만, 다수 화면이 샘플 데이터 또는 안내형 셸입니다.
- 디자인 명세의 다크 HUD, 그리드, 모노 텔레메트리, Hazard Yellow 방향은 일부 반영됐지만, 화면별 픽셀/레이아웃/상호작용은 아직 핸드오프 원본과 동일하지 않습니다.
- 기능이 붙은 화면도 현재 작업공간의 `실제 생성 결과`와 공유되지 않는 경우가 많습니다. 대표적으로 `/documents`, `/evidence`, `/workers`, `/dispatch`는 `buildSampleWorkpack()` 기반입니다.

따라서 지금 제품은 `기존 안정 엔진 + SafeClaw 브랜드 셸 + 일부 기능 연결` 상태입니다. 사용자가 요구한 `디자인 기반 화면에 실제 기능이 다 붙은 제품`까지는 추가 리팩토링이 필요합니다.

## 화면별 판정

| 화면 | 현재 라우트 | 디자인 명세 일치 | 기능 연결 | 판정 | 확인 근거 |
|---|---|---:|---:|---|---|
| 랜딩 | `/` | 부분 | 부분 | 부분 연결 | `SafeClawLanding`이 브랜드 방향은 반영하지만 핸드오프 원본과 타이포/줄바꿈/섹션 구성이 아직 다릅니다. |
| 로그인 | 없음 또는 설정 필요 | 미흡 | 미흡 | 신규 필요 | Supabase Auth 화면이 별도 제품 라우트로 존재하지 않습니다. |
| 홈 대시보드 | `/home` | 부분 | 미흡 | 신규 필요 | `status="planned"`, 실제 다현장/오늘 작업/전파 실패 조회가 없습니다. |
| 워크스페이스 | `/workspace` | 부분 | 강함 | 핵심 엔진 | `SafeGuardCommandCenter`가 `/api/weather`, `/api/ask`, 문서팩, 작업자, 전파를 실제로 연결합니다. 다만 디자인은 기존 작업공간 기반입니다. |
| 문서 편집 | `/documents` | 부분 | 부분 | 부분 연결 | `WorkpackEditor`는 실제 편집/다운로드 기능이 있으나 `buildSampleWorkpack()` 샘플로 동작합니다. 현재 생성 결과와 직접 연결되지 않습니다. |
| 근거 라이브러리 | `/evidence` | 부분 | 부분 | 부분 연결 | `CitationList`, KOSHA, 재해사례를 보여주지만 샘플 데이터 기반입니다. 검색/필터/현재 문서 반영 위치 UX는 미완성입니다. |
| 작업자·교육 | `/workers` | 부분 | 부분 | 부분 연결 | 작업자 카드와 교육 상태를 표시하지만 편집/저장 흐름은 `/workspace#workers`로 우회합니다. |
| 현장 전파 | `/dispatch` | 부분 | 강함 | 실사용 연결에 가까움 | `WorkflowSharePanel`이 `/api/workflow/dispatch`, `/api/dispatch-logs`와 연결됩니다. 단, 샘플 문서팩 기반입니다. |
| 작업자 모바일 | `/worker` | 부분 | 미흡 | 신규 필요 | 모바일 카드 시각화만 있고 작업자 인증, 이해 확인 저장, 실제 링크 공유 흐름은 없습니다. |
| TBM 풀스크린 | `/tbm` | 부분 | 미흡 | 신규 필요 | 샘플 TBM 질문 표시 수준입니다. 현장 모드, 체크, 참석 확인 저장은 없습니다. |
| 이력·아카이브 | `/archive` | 부분 | 미흡 | 신규 필요 | API 계약 설명만 있고 실제 목록 조회/검색 UI는 없습니다. |
| 지식 DB | `/knowledge` | 부분 | 부분 | 부분 연결 | 기존 지식 DB 경로는 존재하지만 16화면의 학습된 코퍼스/인용 가능 근거 화면과 완전히 일치하지 않습니다. |
| API 연결 | `/ops/api` | 부분 | 부분 | 부분 연결 | dryrun snapshot을 보여주지만 16화면의 API connection center 수준의 채널별 상세 운영 화면은 아닙니다. |
| 설정 | `/settings` | 부분 | 미흡 | 신규 필요 | 조직/현장/API/전파 채널 항목 안내만 있습니다. 실제 설정 저장 UI는 없습니다. |
| 프로토타입 목록 | `/prototype` | 부분 | 해당 없음 | 내부 지도 | 화면맵 역할입니다. 제품 내 주 메뉴가 아니라 내부 확인용으로 유지하는 편이 맞습니다. |

## 기능 연결의 핵심 문제

### 1. 현재 workpack state가 새 화면으로 전달되지 않습니다

`/workspace`에서 생성한 실제 결과는 해당 화면 안에서는 잘 작동합니다. 그러나 `/documents`, `/evidence`, `/workers`, `/dispatch`는 `buildSampleWorkpack()`을 사용합니다. 즉, 사용자가 방금 만든 문서팩을 문서 편집 화면이나 근거 라이브러리에서 이어서 보는 구조가 아직 아닙니다.

필요 조치:
- `workpackId` 또는 client-side session draft를 공통 컨텍스트로 둡니다.
- `/workspace` 생성 완료 후 `/documents?workpackId=...`, `/evidence?workpackId=...`로 이동 가능하게 합니다.
- 비회원은 localStorage draft, 로그인 사용자는 Supabase `workpacks`를 진실원천으로 둡니다.

### 2. 16화면은 아직 제품 메뉴가 아니라 라우트맵에 가깝습니다

디자이너가 준 화면은 제품 IA의 청사진입니다. 현재 구현은 그 청사진을 라우트로 나누었지만, 각 라우트 내부가 실제 화면 스펙대로 재구성되지는 않았습니다.

필요 조치:
- 공개 메뉴는 `제품`, `문서`, `근거`, `작업자`, `전파`, `이력`, `지식 DB`, `설정` 정도로 정리합니다.
- `랜딩 A/B`, `워크스페이스 A/B`, `화면 16` 같은 프로토타입 언어는 사용자 화면에서 제거합니다.
- `/prototype`은 내부 QA/디자인맵으로만 둡니다.

### 3. 디자인 토큰은 일부 반영됐지만 화면 구조는 아직 원본과 다릅니다

브랜드 색, 다크 배경, 모노 라벨, 그리드 배경은 들어왔습니다. 그러나 핸드오프의 구체적인 화면 비율, 사이드바 폭, 상단 바 높이, 카드 구조, 타이포 스케일, 줄바꿈 제어는 화면별로 아직 불안정합니다.

필요 조치:
- `SafeClawModuleShell`을 실제 제품 셸로 고정합니다.
- landing/workspace/document/evidence/dispatch는 각각 원본 screenshot 기준으로 gap pass를 돌립니다.
- 히어로 문구는 `font-size: clamp(...)`, `line-height`, `letter-spacing`, `max-width`, `text-wrap: balance` 기준을 별도 토큰화합니다.

## 실제로 붙어 있는 기능

| 기능 | 상태 | 실제 위치 |
|---|---|---|
| 기상 선조회 | 붙음 | `/workspace`, `SafeGuardCommandCenter`, `/api/weather` |
| 문서팩 생성 | 붙음 | `/workspace`, `/api/ask` |
| 법령/KOSHA/Work24/Gemini 조합 | 붙음 | `/api/ask` 결과와 workspace 근거 패널 |
| 문서 편집 | 붙음 | `WorkpackEditor` |
| PDF/XLS/HWPX/DOC/TXT/JSON/CSV/HTML/JPG 출력 | 붙음 | `WorkpackEditor` |
| Google Sheets 보조 흐름 | 부분 | TSV 복사/다운로드 기반, OAuth 자동 생성은 아님 |
| 보완 문구 생성 | 붙음 | `WorkpackEditor`의 `/api/workpack/remediate` 호출 |
| 외국인 다국어 전송본 | 붙음 | `WorkflowSharePanel`, `foreignWorkerLanguages` |
| 메일/SMS 전파 | 붙음 | `WorkflowSharePanel`, `/api/workflow/dispatch` |
| 전파 로그 저장 | 조건부 | authToken + workpackId가 있을 때 `/api/dispatch-logs` |
| 작업자/교육 표시 | 부분 | workspace 및 `/workers`, 저장/편집은 제한적 |
| 이력/아카이브 | 부족 | `/archive`는 계약 설명 수준 |
| 모바일 작업자 확인 | 부족 | `/worker`는 표시용 샘플 |
| TBM 풀스크린 | 부족 | `/tbm`은 표시용 샘플 |
| 설정 | 부족 | `/settings`는 안내 수준 |

## 제출 전 우선순위

### P0. 화면-기능 상태 공유

`/documents`, `/evidence`, `/dispatch`가 샘플이 아니라 방금 생성한 workpack을 읽게 해야 합니다. 이게 안 되면 16화면은 제품이 아니라 포트폴리오식 소개 화면으로 보입니다.

### P0. 메뉴 정리

사용자 메뉴에서 프로토타입 용어를 제거합니다. 추천 메뉴명은 아래입니다.

- 제품
- 작업공간
- 문서
- 근거
- 작업자
- 전파
- 이력
- 지식 DB
- 설정

### P1. 문서 편집 화면을 진짜 3-pane으로 재구성

현재 `WorkpackEditor`는 기능은 강하지만, 디자인 명세의 `문서 편집 3-pane`과는 다릅니다. 좌측 문서 목록, 중앙 제출 서식 미리보기, 우측 근거/보완 제안/다운로드 패널로 나눠야 합니다.

### P1. 근거 라이브러리 실검색화

현재 `/evidence`는 샘플 citation display입니다. 디자인 명세 수준으로 가려면 키워드 검색, 유형 필터, 현재 문서에 인용, 원문 보기, 관련 자료 연결이 필요합니다.

### P1. 전파 화면의 실사용 마감

`WorkflowSharePanel` 기능은 좋습니다. 다음은 샘플 제거, 실제 workpackId 연결, 전송 결과 저장 확인, 외국어 선택별 미리보기 고정입니다.

### P2. 홈/아카이브/설정 운영화

제출용으로는 빈 껍데기처럼 보이지 않게 최소 조회/상태 표시를 붙입니다. 실운영은 후속 단계로 분리해도 됩니다.

## Grill-me 결정 질문

다음 구현 기준을 하나로 고정해야 합니다.

추천 답: `제출 기준 우선`입니다.

이유는 명확합니다. 지금 당장 전체 16화면을 모두 실운영 수준으로 만들면 범위가 터집니다. 대신 제출 기준으로는 아래 4개만 실제 상태 공유까지 닫으면 충분히 제품처럼 보입니다.

1. `/workspace`: 생성 엔진 유지
2. `/documents`: 현재 workpack 편집/다운로드
3. `/evidence`: 현재 workpack 근거/인용
4. `/dispatch`: 현재 workpack 메일/SMS 전파/결과

그 다음 `/home`, `/archive`, `/worker`, `/tbm`, `/settings`는 `준비 중`이 아니라 `운영 확장 화면`으로 정리하고, 대체 경로를 명확히 둡니다.
