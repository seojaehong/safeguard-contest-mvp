# SafeClaw Current Workpack Route Wiring Report

검증일: 2026-05-02
목표: `/workspace`에서 생성한 실제 문서팩을 SafeClaw 제품 라우트가 이어받도록 1차 연결

## 변경 요약

이번 변경은 DB나 외부 API를 건드리지 않고 브라우저 임시 저장 레이어를 추가했습니다. `/workspace`에서 `/api/ask` 결과를 받은 직후 최신 문서팩을 `safeclaw.currentWorkpack.v1` 키로 저장하고, 아래 화면들이 먼저 이 값을 읽습니다.

- `/documents`
- `/evidence`
- `/workers`
- `/dispatch`

저장된 최신 문서팩이 없으면 기존처럼 제품 예시 문서팩을 표시합니다. 사용자는 화면 상단 배너에서 `현재 작업 연결` 또는 `샘플 작업 표시` 상태를 바로 구분할 수 있습니다.

## 연결된 흐름

1. 사용자가 `/workspace`에서 작업 내용을 입력합니다.
2. `SafeGuardCommandCenter`가 `/api/ask`를 호출합니다.
3. 응답 `AskResponse`를 `safeclaw.currentWorkpack.v1`에 저장합니다.
4. 사용자가 `/documents`, `/evidence`, `/workers`, `/dispatch`로 이동하면 `CurrentWorkpackModules`가 최신 문서팩을 읽습니다.
5. 최신 문서팩이 있으면 실제 생성 결과 기준으로 문서 편집, 근거 표시, 작업자 요약, 전파 메시지가 렌더링됩니다.

## 화면별 변경 상태

| 화면 | 이전 | 현재 |
|---|---|---|
| `/documents` | 항상 `buildSampleWorkpack()` | 최신 문서팩 우선, 없으면 샘플 |
| `/evidence` | 항상 샘플 citation/KOSHA/재해사례 | 최신 문서팩 근거 우선, 없으면 샘플 |
| `/workers` | 항상 샘플 기반 작업자 요약 | 최신 문서팩 시나리오 기반 작업자 요약 |
| `/dispatch` | 항상 샘플 전파 메시지 | 최신 문서팩 전파 메시지 우선 |

## 검증 결과

- `npm.cmd run build`: 통과
- `npm.cmd run typecheck`: 통과

## 남은 한계

- 이 연결은 비회원 브라우저 임시 저장 기준입니다. 새 브라우저나 localStorage 삭제 후에는 샘플로 돌아갑니다.
- Supabase 저장 문서팩을 `workpackId`로 조회하는 서버 기반 연결은 아직 아닙니다.
- `/home`, `/archive`, `/worker`, `/tbm`, `/settings`는 여전히 운영 확장/예정 화면입니다.
- `/documents`의 편집 초안 저장은 `WorkpackEditor` 내부 localStorage에 따로 저장됩니다. 이후 SharedContext/Workpack 저장소로 통합할 필요가 있습니다.

## 다음 추천 작업

1. `/workspace` 생성 완료 후 `문서`, `근거`, `전파`로 바로 이동하는 액션을 명확히 추가합니다.
2. `/archive`에서 localStorage 최신 문서팩과 Supabase 문서팩 목록을 함께 조회합니다.
3. 로그인 사용자는 `/api/workpacks` 저장 후 `workpackId` 기반으로 화면 간 이동하게 만듭니다.
4. `/documents`를 디자인 명세의 3-pane 편집 화면으로 재구성합니다.
