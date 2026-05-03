# SafeClaw Design Route Mapping

이 문서는 디자이너 최종 SafeClaw 셸을 실제 제품 라우트에 맞춘 기준표입니다. `/workspace`는 안정적인 작업 엔진으로 유지하고, 나머지 라우트는 사용자가 보는 제품 메뉴와 카피를 정리합니다.

## 운영 원칙

- 공개 메뉴에는 prototype, A/B, screen-count, contest, MVP 언어를 노출하지 않습니다.
- 사용자는 “데모를 보는 사람”이 아니라 “작업 전 문서팩을 준비하는 현장 관리자”로 대합니다.
- 내부 구현명, API path, 컴포넌트명은 운영 화면의 주 카피에서 제외합니다.
- `/workspace`는 기존 생성 흐름을 유지하고 다른 shell route는 안정 경로로 다시 연결합니다.

## Route Map

| Route | User-facing name | UX role | Current action |
|---|---|---|---|
| `/` | SafeClaw 홈 | 회사/제품 진입 | 작업공간과 문서팩으로 바로 연결 |
| `/workspace` | 작업공간 | 핵심 생성 엔진 | 기존 SafeGuardCommandCenter 유지 |
| `/home` | 대시보드 | 오늘 작업 현황 | 작업공간 fallback 유지, 내부 구현명 제거 |
| `/documents` | 문서팩 | 편집/출력 | WorkpackEditor 구현명 대신 편집·보완·출력으로 설명 |
| `/tbm` | TBM | 현장 회의 모드 | TBM 질문과 확인 항목 중심, 메뉴에 직접 노출 |
| `/worker` | 모바일 안내 | 작업자 확인 화면 | 작업자 공지와 이해 확인으로 설명 |
| `/workers` | 작업자·교육 | 작업자/언어/교육 상태 | API path 대신 업무 범위로 설명 |
| `/evidence` | 근거 라이브러리 | 법령/KOSHA/재해사례 반영 위치 | 내부 컴포넌트명 제거 |
| `/dispatch` | 현장 전파 | 메일·문자 전파 기록 | API path 대신 전파 기록으로 설명 |
| `/archive` | 이력 | 문서팩/전파 이력 | DB table/path 노출 제거 |
| `/knowledge` | 지식베이스 | 법령·KOSHA 근거층 | 지식 DB를 제품형 명칭으로 정리 |
| `/ops/api` | 연결 상태 | 공공 API/전파 채널 점검 | dryrun/smoke 원문 용어를 보조 설명으로 낮춤 |
| `/settings` | 운영 설정 | 조직/현장/채널 설정 | “확장 필요” 대신 설정 범위 표시 |
| `/prototype` | 내부 경로 | 더 이상 공개 route map 아님 | `/workspace`로 redirect |
| `/demo` | 작업 흐름 미리보기 | 공개 주 메뉴에서 제거 | 직접 접근 시 제품 흐름 카피만 표시 |

## Shell Copy Changes

- `연결 대상`은 `업무 범위`로 변경했습니다.
- `연결 예정`은 `제품화 중`으로 변경했습니다.
- `부분 연결`은 `운영 중`으로 변경했습니다.
- 랜딩 CTA의 `30초 데모`는 `문서팩 보기`로 변경했습니다.
- 작업공간 상단의 `v2 시연`은 `문서팩`으로 변경했습니다.
- 소개/신뢰/로드맵 페이지의 `데모` 링크는 `작업공간`으로 변경했습니다.

## Stable Route Constraint

`/workspace`는 이번 작업에서 생성 엔진, API 호출, 문서팩 생성 로직을 변경하지 않았습니다. 변경은 네비게이션, 제품 카피, route shell 설명, `/prototype` redirect에 한정했습니다.
