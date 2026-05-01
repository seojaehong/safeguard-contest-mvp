# SafeGuard 제출 기준점 운영화 리포트

## 제출 기준

이번 제출 기준은 `Vercel Production에서 실제 운영 흐름이 닫히는 상태`다. 닫아야 할 축은 `관리자 계정/이력 저장`, `메일·문자 전파 및 로그`, `PDF/HWPX/XLS 제출 서식 검수` 세 가지로 고정한다.

게이트 판정은 `pass`, `pass_with_notice`, `blocked`만 사용한다.

| 축 | 제출 기준 | 판정 기준 |
|---|---|---|
| 관리자 계정/이력 저장 | Supabase Auth 로그인 후 문서팩, 근로자, 교육기록 저장 | `workpackId`, 저장 시각, 저장 항목 수가 확인되면 `pass` |
| 메일·문자 전파 | n8n을 통해 메일·문자 요청을 보내고 채널별 결과를 받음 | 메일·문자 결과와 dispatch log가 남으면 `pass` |
| 제출 서식 | 대표 시나리오에서 PDF/HWPX/XLS 생성 검증 | 주요 문구, 확인/서명란, 파일 존재가 확인되면 `pass` |

## 구현 상태

### 관리자 계정/이력 저장

- 비회원 화면은 `비회원 임시 저장`으로 표시한다.
- 로그인 전 저장 시도는 `관리자 로그인 필요`로 표시한다.
- 로그인 후 작업공간 저장 시 `/api/workers`, `/api/workpacks`, `/api/education-records`를 순서대로 호출한다.
- 저장 성공 시 `문서팩 ID`, `저장 시각`, `저장 항목 수`를 표시한다.
- 저장 실패는 `저장 실패`로 표시하고 콘솔에 오류를 남긴다.

### 메일·문자 전파 및 로그

- 제출 기준 채널은 메일과 문자다.
- 카카오와 밴드는 준비 중 상태로 잠근다.
- 전파 전 확인 모달에서 수신자, 채널, 언어, 메시지 미리보기를 확인한다.
- 전파 전 문서팩이 저장되지 않았다면 로그인 상태에서 먼저 저장을 시도한다.
- n8n 응답의 `sent`, `failed`, `unconfigured`, `skipped` 상태를 그대로 화면에 보여준다.
- 로그인 상태에서 `workpackId`와 채널 결과가 있으면 `/api/dispatch-logs`에 저장한다.
- Solapi 통신사 전달 실패는 API 접수와 실제 전달 실패를 구분해 리포트에 남긴다.

### 제출 서식 검수

- 정식 제출 형식은 PDF, HWPX, XLS다.
- Excel은 표지, 섹션 요약, 확인 칸, 결재/서명란, 인쇄 폭 기준을 확인한다.
- HWPX는 한글 깨짐, 제목, 섹션, 확인/서명란, 핵심 문구를 확인한다.
- PDF는 브라우저 인쇄 기반 제출본으로 안내하고, 대표 문서 3종의 주요 문구 포함 여부를 확인한다.

## 자동 검증

제출 전 아래 명령을 실행한다.

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:submission
```

`smoke:submission`은 아래 파일을 생성한다.

- `evaluation/submission-readiness/prod-storage-smoke.json`
- `evaluation/submission-readiness/prod-dispatch-smoke.json`
- `evaluation/submission-readiness/document-format-verification.json`
- `evaluation/submission-readiness/submission-readiness-summary.json`

## 환경값

Production 전파는 공개 relay만 사용한다. Vercel에는 내부 주소를 넣지 않는다.

```text
N8N_PUBLIC_BASE=https://<public-relay-domain>
N8N_WEBHOOK_PATH=safeguard-workpack
N8N_WEBHOOK_TOKEN=<secret>
```

로컬 또는 서버 내부 실행은 내부 주소를 사용한다.

```text
N8N_INTERNAL_BASE=http://127.0.0.1:5678
N8N_WEBHOOK_PATH=safeguard-workpack
N8N_WEBHOOK_TOKEN=<secret>
```

저장 검증은 관리자 로그인 토큰이 필요하다.

```text
SAFEGUARD_AUTH_TOKEN=<Supabase access token>
SAFEGUARD_RUN_LIVE_DISPATCH=1
SAFEGUARD_DISPATCH_RECIPIENTS=<email-or-phone>
```

## 제출 전 남은 확인

- Supabase migration 적용 여부 확인.
- Vercel Production에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 주입 여부 확인.
- Vercel Production에는 `N8N_INTERNAL_BASE`가 없어야 한다.
- Solapi 발신번호가 통신사 전달 단계에서 정상 처리되는지 확인.
- PDF/HWPX/XLS를 실제 앱에서 내려받아 사람이 한 번 연다.

## 현재 결론

이 문서는 제출 기준을 고정하는 운영 리포트다. 최종 판정은 `evaluation/submission-readiness/submission-readiness-summary.json`의 `overall` 값을 기준으로 한다. `blocked`가 하나라도 있으면 제출 전 수정 대상으로 남긴다.

## 2026-04-30 제출 스모크 결과

`npm.cmd run smoke:submission` 실행 결과는 아래와 같다.

| 게이트 | 결과 | 비고 |
|---|---|---|
| API 조합 문서 생성 | `pass` | 대표 시나리오 3건 모두 11종 산출물과 핵심 서식 문구 확인 |
| 관리자 저장 | `blocked` | 현재 실행 셸에 `SAFEGUARD_AUTH_TOKEN`이 없어 Production 저장 API 인증 호출 미실행 |
| 메일·문자 전파 | `pass_with_notice` | 현재 실행 셸에서 `SAFEGUARD_RUN_LIVE_DISPATCH=1`을 지정하지 않아 실제 발송 미실행 |
| 제출 서식 | `pass` | 대표 시나리오 3건 모두 PDF, HWPX, XLS, 전체 XLS 생성 확인 |

생성된 증거 파일:

- `evaluation/submission-readiness/submission-readiness-summary.json`
- `evaluation/submission-readiness/prod-storage-smoke.json`
- `evaluation/submission-readiness/prod-dispatch-smoke.json`
- `evaluation/submission-readiness/document-format-verification.json`

현재 제출 차단 항목은 코드 기능 실패가 아니라 Production 저장/전파 검증용 실행 토큰과 실제 발송 플래그 부재다. 제출 직전에는 관리자 로그인 후 발급된 Supabase access token과 실제 수신자 값을 넣고 같은 명령을 다시 실행해야 한다.

## 2026-05-01 제출 직전 스모크 결과

`npm.cmd run typecheck`, `npm.cmd run build`, `SAFEGUARD_AUTH_TOKEN`과 실제 수신자를 넣은 `npm.cmd run smoke:submission`을 다시 실행했다.

| 게이트 | 결과 | 비고 |
|---|---|---|
| 정적 빌드 | `pass` | Next.js production build 통과 |
| 타입 검사 | `pass` | `npm.cmd run typecheck` 단독 실행 통과 |
| API 조합 문서 생성 | `pass` | 서울 건설 강풍, 인천 물류 우천, 안산 제조 화기·외국인 포함 3개 시나리오 모두 11종 산출물 생성 |
| 관리자 저장 | `pass` | Supabase Auth 토큰으로 Production 저장 API 호출. `workpackId=b8f952ec-cdcb-4d9f-a823-93c3b1c9c1ac`, 근로자 1건, 교육기록 1건 저장 |
| 메일·문자 전파 | `pass_with_notice` | n8n `workflowRunId=58`. 메일은 SMTP `sent`, 전파 로그 2건 저장. 문자는 Solapi `failed/http 400`으로 provider 점검 필요 |
| 제출 서식 | `pass` | 3개 시나리오 모두 PDF, HWPX, XLS, 전체 XLS 생성 확인 |
| 전체 판정 | `pass_with_notice` | 제출 흐름은 닫혔고, SMS 실수신은 Solapi 발신번호·수신자·provider 응답 상세 재점검 항목으로 남김 |

생성된 증거 파일:

- `evaluation/submission-readiness/submission-readiness-summary.json`
- `evaluation/submission-readiness/prod-storage-smoke.json`
- `evaluation/submission-readiness/prod-dispatch-smoke.json`
- `evaluation/submission-readiness/document-format-verification.json`
- `evaluation/submission-readiness/formats/**/api-orchestration-download-smoke.json`
- `evaluation/submission-readiness/formats/**/files/*`

현재 기준 제출 전략은 `문서 생성·공공데이터 조합·관리자 저장·메일 전파·전파 로그·서식 다운로드는 pass`, `SMS 실수신은 Solapi provider notice`로 설명한다. 문자 기능은 UI와 n8n 경로, 로그 저장까지 닫혔으나 통신 provider가 오류를 반환했으므로, 제출 발표에서는 “메일은 실발송 완료, 문자는 provider 재점검 중이며 동일 전파 로그에 남는다”로 말한다.
