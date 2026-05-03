# Final Design Shell Report

작업 범위: pixel/product shell mapping and route UX  
DB 변경: 없음  
`/workspace` 생성 엔진 변경: 없음

## Changed Routes

| Route | Before | After |
|---|---|---|
| `/` | CTA에 데모 노출 | 작업공간/문서팩 중심 CTA |
| `/workspace` | 상단에 v2 시연 링크 | 문서팩 링크로 변경, 생성 흐름 유지 |
| `/home` | 신규 대시보드 필요 | 오늘 작업·교육 확인·전파 결과 업무 범위로 정리 |
| `/documents` | WorkpackEditor 구현명 노출 | 편집·보완·PDF/XLS/HWPX 출력으로 설명 |
| `/evidence` | CitationList 등 구현명 노출 | 법령·KOSHA·재해사례 반영 위치로 설명 |
| `/workers` | API path 노출 | 작업자 명단·교육 확인·언어별 안내로 설명 |
| `/dispatch` | workflow/dispatch API path 노출 | 메일·문자·전파 기록으로 설명 |
| `/archive` | workpacks/dispatch_logs 노출 | 문서팩 이력·근거 확인·전파 로그로 설명 |
| `/ops/api` | dryrun/smoke 중심 설명 | 공공 API·전파 채널·지식베이스 상태로 정리 |
| `/settings` | 확장 필요 표현 | 조직·현장·전파 채널 설정 범위로 정리 |
| `/tbm` | 문서 하위처럼 표시 | 제품 메뉴의 TBM route로 직접 표시 |
| `/worker` | 신규 route 표현 | 모바일 안내 업무 범위로 정리 |
| `/prototype` | prototype map 노출 | `/workspace`로 redirect |
| `/preview`, `/why`, `/trust`, `/roadmap` | 데모 링크/시연 언어 | 작업공간 링크와 제품 로드맵 언어 |
| `/demo` | 제품 시연/v2 문구 | 작업 흐름 미리보기 문구 |

## Product Shell Improvements

- 운영 메뉴를 제품형 그룹으로 정리했습니다: 운영, 실행, 시스템.
- `TBM`과 `모바일 안내`를 실제 제품 route로 메뉴에 포함했습니다.
- 내부 구현명, DB table, API path, prototype route map 표현을 주요 사용자-facing copy에서 제거했습니다.
- 상태 라벨은 개발 단계처럼 보이는 표현보다 제품 운영 상태에 가깝게 바꿨습니다.

## What Stayed Stable

- `/workspace` page는 기존 `SafeGuardCommandCenter` 호출 구조를 유지했습니다.
- DB script, migration, Supabase mutation은 건드리지 않았습니다.
- 기존 미추적 evaluation 산출물은 그대로 두었습니다.

## Remaining Design Debt

- `SafeClawPrototype` 컴포넌트와 `demo-*`, `v2-*`, `safeclaw-prototype-*` CSS class 이름은 내부 코드명으로 남아 있습니다. 공개 route에서 `/prototype`은 redirect 처리했지만, 후속 정리 때 class/component 명칭까지 정리하면 코드와 제품 언어가 더 일치합니다.
- `/demo` route는 직접 접근 가능하지만 공개 메뉴에서는 제거했습니다. 완전히 숨길지, `/workspace` redirect로 바꿀지는 제품 운영 정책 결정이 필요합니다.
- `/home`, `/tbm`, `/worker`, `/settings`는 제품형 shell copy는 정리됐지만 아직 독립 데이터 저장/조회 기능은 제한적입니다.
