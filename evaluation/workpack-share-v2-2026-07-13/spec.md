# SafeClaw 공유 화면 v2 제품 명세

- Spec ID: workpack-share-v2-2026-07-13
- Revision: independent-review-remediation-1
- 상태: HOLD_PENDING_INDEPENDENT_PASS
- 기준 branch: feat/workpack-share-v2
- 기준 commit: 2adca4e98bab7854982bdd840c48a48944dc705e
- 최초 base: 59f48123da62fb405e639da03912aa1ed6c000b9
- 쓰기 범위: evaluation/workpack-share-v2-2026-07-13/spec.md, spec.json
- 제품 Job: 오늘 문서팩을 선택된 오늘 참여자에게 보냅니다.
- 화면 순서: 대상 -> 채널 -> 현지화 미리보기 -> 전송
- 구현 상태: 이 revision은 명세만 수정합니다. 제품 코드, 테스트, DB, CSS, package, lock을 수정하거나 구현을 시작하지 않습니다.

## 1. Current Truth And Decisions

| 근거 | 확인된 현재 계약 | v2 결정 |
|---|---|---|
| app/workspace/page.tsx | q, scenario, theme만 읽습니다. | 검증된 step/document/language/returnStep query를 추가해야 합니다. |
| SafeGuardCommandCenter.tsx:1056 | workspacePage는 항상 input으로 시작합니다. | 저장 문서팩 복원 뒤 요청 step을 production resolver로 결정합니다. |
| AdminLoginPanel, AuthCallbackClient | 안전한 next 경로를 이미 전달하고 복귀합니다. | 로그인 CTA는 canonical share return path를 next로 넘깁니다. |
| CurrentWorkpackModules.tsx, /workers | 작업자 명부, quick add, 오늘 선택 snapshot을 소유합니다. | Share의 작업자 입력, drawer, 저장 command를 모두 금지합니다. |
| share-sessions API | 관리자 인증 뒤 session ID와 expiry를 생성합니다. | ready 이후 첫 network 단계로 원자적 session 생성만 수행합니다. |
| workflow dispatch API/client | email, sms, kakao를 production channel로 허용합니다. | typed union과 payload에서 세 채널을 손실 없이 유지합니다. |
| foreignWorkerLanguages | 언어별 본문 줄만 있고 review/provenance/source binding이 없습니다. | Share가 번역하지 않고 문서 편집 owner가 승인한 artifact만 소비합니다. |
| d3ad865, 391x844 | share 약 3836px, overlap, 44px 미만 target 15개가 확인됐습니다. | 391x844를 고정 mobile gate로 사용합니다. |
| d3ad865 베트남어 | 본문 3줄만 번역되고 제목과 meta label/value는 한국어입니다. | 부분 번역은 review_required이며 전송 완료 번역으로 취급하지 않습니다. |

결정은 다음과 같습니다.

1. Share는 roster나 today participant snapshot을 만들거나 변경하지 않습니다.
2. no_recipients는 /workers로 돌아가는 CTA 하나만 표시합니다.
3. ready는 session이나 invitation artifact가 이미 있다는 뜻이 아닙니다. session을 만들 수 있는 입력이 유효하다는 뜻입니다.
4. 전송 순서는 create_session -> dispatch -> save_channel_log입니다. session 실패 시 dispatch count는 0입니다.
5. 결과는 request/channel 단위 accepted, failed, unknown만 말합니다. 수신자별 전달, 열람, 교육 이수는 주장하지 않습니다.
6. Kakao는 Settings에서 사전 설정 및 승인된 경우에만 Share에 나타나지만 production 호환성에서 제거하지 않습니다.
7. 비한국어 전송본은 source-bound, reviewed LocalizedDispatchArtifact가 있을 때만 사용합니다.
8. quality fallback example의 canShare=false를 그대로 보존합니다. localStorage 값으로 readiness나 revalidation을 우회하지 않습니다.
8. 정상 배율에서는 primary까지 task distance를 측정합니다. 200% 배율에서는 고정 높이 상한을 사용하지 않습니다.

## 2. Target IA And Ownership

### 2.1 Share Body

| 순서 | 영역 | 표시 | Share가 할 수 있는 일 |
|---:|---|---|---|
| 1 | workpack_status | 문서팩 이름과 readiness 한 줄 | 문서 보기 route 이동 |
| 2 | target | 오늘 참여자 N명과 최대 3명 이름 | owner route로 돌아가기 |
| 3 | channel | 메일, 문자, 승인된 카카오의 선택 및 수신 가능 수 | 준비된 채널 선택 |
| 4 | localized_preview | 자동 해석 언어, option 12개 dropdown, 검토 artifact 미리보기 | preview 언어만 변경 |
| 5 | operator_note | 선택 전달 메모 | 메모 입력 |
| 6 | result_strip | accepted, failed, unknown 채널/request 요약 | 이력 route 이동 |
| 7 | primary_action | 현재 state의 primary 하나 | resolver가 정한 action 하나 |

Share body에는 번호 장식, worker form, quick add, worker drawer, channel setup, 공개 링크 생성, 중복 CTA, confirmation modal, 내부 preview scroll을 두지 않습니다.
SafeGuardCommandCenter가 화면 제목 하나를 소유하고 WorkflowSharePanel은 제목, 로그인 prompt, preview를 반복하지 않습니다. [data-share-preview]는 하나이며 logged_out도 하단 primary 외 로그인 CTA를 만들지 않습니다.
1440px에서는 하나의 reading column을 사용하고 내용 없는 두 번째 grid track을 만들지 않습니다.

### 2.2 Route Ownership

| ID | 기능 | Owner | Share 계약 |
|---|---|---|---|
| R1 | roster 등록, 수정, quick add | /workers | Share는 읽기만 합니다. |
| R2 | 오늘 참여자 선택 snapshot | /workspace?step=input, /workers | Share는 snapshot을 변경하지 않습니다. |
| R3 | 현재 문서팩 전송 orchestration | /workspace?step=share | session 생성과 dispatch action만 소유합니다. |
| R4 | 번역 생성, 수정, 검토 | document editor의 foreignWorkerTransmission | Share는 approved artifact만 소비합니다. |
| R5 | email, sms, kakao 설정과 승인 | /settings | Share는 resolved availability만 표시합니다. |
| R6 | organization reporting recipient group | /settings | 작업자 N명과 분리된 결과만 표시합니다. |
| R7 | 전송 request/channel 결과 | /dispatch | Share는 compact result strip만 표시합니다. |
| R8 | session, 저장, 열람 이력 | /archive | 기존 ID와 row를 삭제하지 않습니다. |
| R9 | Before/After 개선 이력 | /reports, /archive | Share body에서 제거합니다. |
| R10 | 로그인과 복귀 | /login, /auth/callback, /workspace | 검증된 next와 step query를 사용합니다. |
| R11 | invitation access policy | session API, /settings policy | invited, viewer, anonymous false, expiry를 유지하고 compact info popover에서 Settings로 연결하며 public link를 만들지 않습니다. |

### 2.3 Workspace Return Contract

Canonical share return path는 다음 두 값만 허용합니다.

- /workspace?step=share&theme=day
- /workspace?step=share&theme=night

구현 계약:

1. app/workspace/page.tsx는 step을 input|document|share로, theme을 day|night로 allowlist 검증합니다.
2. document와 language는 step=document에서만 허용합니다. document는 foreignWorkerTransmission을 포함한 기존 DocumentKey여야 하고 language는 지원 언어 code여야 합니다.
3. returnStep은 share만 허용합니다.
4. SafeGuardCommandCenter는 initialWorkspacePage를 prop으로 받고, StoredCurrentWorkpack을 production parser로 복원한 뒤 canOpenWorkspacePage와 readiness를 사용해 최종 step을 정합니다.
5. step=share인데 복원할 문서팩이 없으면 input으로 이동하고 이유를 표시합니다.
6. blocked 문서팩은 share 화면을 열어 blocker를 볼 수 있지만 session/dispatch는 호출하지 않습니다.
7. step 변경은 query를 갱신하고 theme을 보존합니다. 뒤로가기와 reload도 같은 step을 복원합니다.
8. 로그인 CTA href는 /login?next={encoded canonical share return path}입니다. 기존 resolveSafeNextPath와 AuthCallbackClient가 callback 뒤 해당 path로 복귀합니다.
9. /workers와 /settings의 owner CTA도 next={encoded canonical share return path}를 사용합니다. owner 작업 완료 후 해당 next로 돌아옵니다.
10. 번역 검토 route는 /workspace?step=document&document=foreignWorkerTransmission&language={code}&returnStep=share&theme={theme}입니다. 저장 및 검토 완료 뒤 canonical share path로 돌아옵니다.

현재 app/workspace/page.tsx와 SafeGuardCommandCenter는 이 계약을 구현하지 않았으므로 browser GREEN 전에 두 파일과 lib/workspace-pages.ts에서 구현해야 합니다. 단순 href 표기만으로 복귀 완료를 주장하지 않습니다.

## 3. State Machine And CTA Authority

평가 우선순위:

sending -> success|partial|fail -> stale -> blocked -> offline -> no_recipients -> logged_out -> review_required -> selected -> ready

| State | 진입 조건 | Primary label | Enabled | Action |
|---|---|---|---:|---|
| blocked | readiness.canShare=false | 문서 보완 | yes | document review route |
| no_recipients | today selected count=0 | 오늘 참여자 선택 | yes | /workers?next={shareReturn} |
| selected | 대상은 있으나 worker/channel 입력이 미완료 | reason별 label | reason별 | 아래 reason catalog |
| logged_out | 입력은 유효하지만 관리자 session 없음 | 로그인하고 전송 | yes | /login?next={shareReturn} |
| review_required | workpack 또는 번역 검토가 필요함 | reason별 label | yes | 아래 review catalog |
| ready | 모든 pre-session guard가 유효함 | {N}명에게 전송 | yes | create_session 시작 |
| sending | session 생성 또는 dispatch 진행 중 | 전송 중 | no | 중복 action 차단 |
| success | 모든 요청 channel이 provider accepted | 전파 이력 확인 | yes | /dispatch |
| partial | accepted와 failed|unknown이 함께 있음 | 전파 이력 확인 | yes | /dispatch |
| fail | session 실패, 모든 channel 실패, 또는 결과 unknown | 전파 이력 확인 | yes | /dispatch 또는 owner recovery |
| offline | network preflight 실패, provider 미호출 | 연결 다시 확인 | yes | resolver 재평가 |
| stale | sourceRevision 또는 digest mismatch | 변경사항 다시 확인 | yes | stale owner route |

한 화면에서 visible [data-share-primary]는 정확히 하나입니다. header, outer shell, result strip, modal에 별도 primary를 만들지 않습니다.
no_recipients에서는 target 영역의 별도 변경 link를 렌더링하지 않습니다. /workers?next={shareReturn}로 가는 오늘 참여자 선택 primary 하나만 route-back control입니다.

허용 전이:

- initial, owner return, auth callback, reconnect, workpack/snapshot/channel 변경 -> production resolver -> 우선순위상 첫 state
- ready primary -> sending; sending + session failure -> fail; sending + freshness mismatch -> stale
- sending + dispatch outcomes all accepted -> success; mixed -> partial; accepted 0 또는 all unknown -> fail
- blocked, no_recipients, selected, logged_out, review_required, stale의 owner action 완료 -> canonical share return -> production resolver
- offline에서는 전송 요청을 만들지 않고 reconnect 뒤 resolver를 다시 실행합니다.

### 3.1 Selected Reasons

| Reason ID | Owner | Primary label/action | Return |
|---|---|---|---|
| channel_not_selected | Share channel section | 채널 선택, 첫 channel control focus | 같은 canonical share path |
| worker_contact_missing | /workers | 작업자 정보 확인, owner route 이동 | next={shareReturn} |
| worker_server_id_missing | /workers | 작업자 저장 확인, owner route 이동 | next={shareReturn} |
| channel_unconfigured | /settings | 채널 설정 확인, owner route 이동 | next={shareReturn} |
| kakao_not_approved | /settings | 카카오 설정 확인, owner route 이동 | next={shareReturn} |

동시에 여러 reason이 있으면 위 표 순서에서 가장 먼저 나온 reason 하나가 primary를 소유하고 나머지는 inline text link로 표시합니다.
reporting_group_unavailable은 작업자 전송 state를 바꾸지 않는 inline 상태입니다. Settings가 소유하며 /settings?next={shareReturn} text link만 표시합니다.

### 3.2 Review Required Reasons

| Reason ID | Owner | Primary label/action | Return |
|---|---|---|---|
| translation_missing | foreignWorkerTransmission editor | 번역본 검토 | returnStep=share |
| translation_stale | foreignWorkerTransmission editor | 번역본 검토 | returnStep=share |
| translation_not_reviewed | foreignWorkerTransmission editor | 번역본 검토 | returnStep=share |
| translation_rejected | foreignWorkerTransmission editor | 번역본 검토 | returnStep=share |
| workpack_revalidation | document review | 문서 다시 검수 | returnStep=share |
| participant_snapshot_stale | input/workers | 오늘 참여자 다시 확인 | next={shareReturn} |

비한국어 artifact blocker는 실제 recipient language에 필요한 artifact에만 적용합니다. dropdown으로 미사용 언어를 미리보기만 한 경우 dispatch plan은 바뀌지 않으며, 그 언어의 검토 route만 보여줍니다.

## 4. Data And Lifecycle Contracts

### 4.1 Today Participant Snapshot

~~~ts
type TodayParticipantSnapshotV2 = {
  version: "today-participant-snapshot/v2";
  workDate: string;
  source: "workspace_input" | "workers";
  sourceRevision: string;
  digest: string;
  selectedWorkerIds: string[];
  workers: Array<{
    workerId: string;
    displayName: string;
    languageCode: SupportedLanguageCode;
    email?: string;
    phone?: string;
  }>;
};
~~~

- /workers가 roster와 quick add를 소유합니다.
- workspace input 또는 /workers가 selectedWorkerIds를 저장합니다.
- Share는 POST /api/workers, roster mutation, snapshot mutation을 절대 실행하지 않습니다.
- localStorage snapshot은 복원 cache이며 server worker UUID나 auth authority를 만들지 않습니다.

### 4.2 Channels And Reporting Group

~~~ts
type DispatchChannel = "email" | "sms" | "kakao";

type ResolvedChannel = {
  channel: DispatchChannel;
  configured: boolean;
  approved: boolean;
  available: boolean;
  recipientCount: number;
  ownerRoute: "/settings";
};
~~~

- email과 sms는 현재 연락처 및 provider 설정으로 해석합니다.
- kakao는 SAFEGUARD_KAKAO_ENABLED 또는 SAFECLAW_KAKAO_ENABLED와 provider/template 설정이 모두 충족된 경우에만 available입니다.
- unavailable Kakao는 선택 control로 노출하지 않고 Settings 상태와 이동 경로만 표시합니다.
- Share에는 channel 연결, template 승인, sender key 입력 UI가 없습니다.
- organization reporting recipient group은 worker count와 분리하며 Settings가 소유합니다.
- typed channel union, request payload, result mapping, log adapter는 email|sms|kakao를 모두 보존합니다.

지원 언어 code는 ko, vi, zh, th, uz, mn, ne, km, id, my, tl, en입니다.

### 4.3 Source-Bound Localized Dispatch Artifact

~~~ts
type LocalizedDispatchArtifact = {
  version: "localized-dispatch-artifact/v1";
  artifactId: string;
  sourceRevision: string;
  sourceDigest: string;
  targetLanguage: SupportedLanguageCode;
  localized: {
    subject: string;
    metadata: {
      siteLabel: string;
      siteValue: string;
      taskLabel: string;
      taskValue: string;
      coreRiskLabel: string;
      coreRiskValue: string;
    };
    bodyLines: string[];
    semanticRiskLabels: string[];
  };
  provenance: {
    method: "human" | "provider" | "hybrid";
    provider: string | null;
    modelOrVersion: string | null;
    generatedAt: string;
  };
  review: {
    state: "not_reviewed" | "approved" | "rejected";
    reviewerId: string | null;
    reviewerDisplayName: string | null;
    reviewedAt: string | null;
  };
  revision: string;
  artifactDigest: string;
};
~~~

Authority rules:

1. Owner는 foreignWorkerTransmission document editor입니다. Share는 artifact를 생성, 수정, 자동 승인하지 않습니다.
2. sourceDigest는 companyName, siteName, workSummary, topRisk, source foreignWorkerTransmission, sourceRevision의 canonical JSON SHA-256입니다.
3. sourceDigest 또는 sourceRevision이 현재 문서팩과 다르면 stale입니다.
4. 비한국어 recipient는 artifact가 존재하고 review.state=approved이며 reviewerId와 reviewedAt이 있어야 합니다.
5. non-Korean subject, metadata label/value, body에는 Hangul 범위가 남지 않습니다.
6. 한국어 site/task/risk 값을 label만 바꾼 artifact는 incomplete입니다.
7. 영어 fallback, static fixture line, body 3줄만 있는 값은 번역 완료 근거가 아닙니다.
8. structural emoji는 의미 전달에 사용하지 않습니다. localized text-only가 기본이며 아이콘을 쓰면 accessible name과 같은 의미의 text를 함께 둡니다.
9. dropdown은 12개 option을 유지하지만 preview artifact만 바꿉니다. recipient language와 DispatchPlan digest는 바꾸지 않습니다.
10. 기존 workpack JSON/request/reopenData 경계의 deliverables.localizedDispatchArtifacts에 저장합니다. 새 DB column이나 migration은 만들지 않습니다.

베트남어 gate는 subject, site/task/core-risk label과 value, body 전체, semanticRiskLabels, provenance, review, revision, digest를 검사합니다. 임의의 한국어 값을 browser fixture가 즉석 번역했다고 가정하지 않습니다. fixture는 editor owner가 승인한 source-matching artifact를 production workpack JSON으로 제공합니다.

### 4.4 Ready Guards And Send Lifecycle

ready는 다음 pre-session guard가 모두 참인 상태입니다.

1. readiness.canShare=true이고 requiresRevalidation=false입니다.
2. today participant가 1명 이상이며 server worker UUID와 선택 channel 연락처가 있습니다.
3. 선택 channel이 1개 이상이고 ResolvedChannel.available=true입니다.
4. 필요한 모든 non-Korean LocalizedDispatchArtifact가 source-matching, approved입니다.
5. workpack/participant sourceRevision과 digest가 validated 값과 같습니다.
6. 관리자 auth session이 있습니다.
7. online이며 unresolved duplicate risk가 없습니다.
8. 아직 share session을 만들지 않았어도 됩니다.

Primary click lifecycle:

1. UI는 input snapshot과 idempotency attempt scope를 잠급니다.
2. POST /api/workpacks/{workpackId}/share-sessions를 정확히 한 번 호출합니다.
3. request body는 recipients: serverWorkerUuid[]만 사용합니다.
4. session row와 잠근 recipients 전체의 invitation binding은 하나의 원자적 결과입니다. 일부 binding만 성공한 상태는 session_created가 아니며 route는 실패해야 합니다.
5. response가 ok=true, UUID shareSessionId, 미래 expiresAt을 모두 반환해야 session_created입니다.
6. session 생성이 실패하거나 malformed이면 fail로 종료하고 /api/workflow/dispatch 호출 수는 0입니다.
7. session_created 뒤에만 POST /api/workflow/dispatch를 정확히 한 번 호출합니다.
8. dispatch payload는 workpackId, 새 shareSessionId, idempotencyKey, channels, operatorNote만 포함합니다.
9. dispatch 결과 뒤 기존 /api/dispatch-logs adapter가 지원하는 channel-level log만 저장합니다.
10. 성공한 sessionId, expiresAt, workflowRunId, idempotencyKey, log ID는 기존 응답/저장이 제공할 때만 보존합니다.
11. session과 dispatch 사이 대상, revision, digest가 변하면 dispatch하지 않고 stale로 종료합니다.

각 전송 attempt는 새 session을 만듭니다. 기존 session 재사용은 v2 send lifecycle에 사용하지 않습니다.

### 4.5 Honest Result Classification

~~~ts
type RequestOutcome = "accepted" | "failed" | "unknown";

type DispatchResultStripV2 = {
  requestOutcome: RequestOutcome;
  shareSessionId: string | null;
  workflowRunId: string | null;
  idempotencyKey: string | null;
  providerCalled: boolean | null;
  duplicateRisk: boolean;
  channels: Array<{
    channel: DispatchChannel;
    outcome: RequestOutcome;
    providerStatus: string | null;
    logId: string | null;
  }>;
};
~~~

- accepted는 provider가 request/channel을 접수했다는 뜻입니다. 전달, 열람, 교육 이수를 뜻하지 않습니다.
- failed는 provider 미호출 거부 또는 명시적 실패입니다.
- unknown은 provider 호출 후 응답 미확정, 누락 channel result, validation-only/copy 응답, 또는 provider accepted 근거가 없는 결과입니다. browser mock 사용 자체는 outcome을 정하지 않습니다.
- success state는 요청한 모든 channel이 accepted이고 duplicateRisk=false일 때만 사용합니다.
- partial state는 accepted와 failed|unknown이 함께 있을 때 사용합니다.
- fail state는 session 실패, accepted channel 0개, 또는 전체 결과 unknown일 때 사용합니다.
- current provider/log가 channel-level이므로 recipient별 delivered 상태나 persistence를 만들지 않습니다.
- session 생성만으로 invitation 전달을 주장하지 않습니다.
- public link, anonymous access, worker account provisioning은 만들지 않습니다. session policy는 invited, viewer, anonymousAllowed=false, future expiry를 유지합니다.

## 5. Accessibility And Responsive Acceptance

### 5.1 Exact Common Gates

| 항목 | GREEN |
|---|---|
| Touch target | 모든 interactive hit rect가 44x44 CSS px 이상입니다. |
| Touch gap | 인접 interactive rect의 최소 간격이 8px 이상입니다. |
| Overlap | 의도하지 않은 visible text/interactive 교차 면적이 0입니다. |
| Horizontal overflow | document와 share root의 scrollWidth <= clientWidth입니다. |
| Nested scroll | share body와 preview에 overflow-y auto|scroll이 없습니다. document만 scroll합니다. |
| Focus | DOM/focus 순서가 target -> channel -> preview -> memo -> primary입니다. |
| State semantics | disabled, aria-pressed, aria-live=polite, role=alert를 상태에 맞게 사용합니다. |
| Contrast | 일반 text 4.5:1 이상, 큰 text와 UI boundary 3:1 이상을 Day/Night에서 확인합니다. |
| Theme | query, shell class, toggle aria-pressed가 back/reload 뒤에도 일치합니다. |
| Motion | prefers-reduced-motion에서 비필수 motion을 제거합니다. |
| Meaning | 색, emoji, icon만으로 위험 또는 결과를 전달하지 않습니다. |

### 5.2 Normal Zoom Task Distance

측정은 browser zoom 100%, preview collapsed에서 수행합니다.

taskDistancePx = primary.getBoundingClientRect().top - shareRoot.getBoundingClientRect().top

| Viewport/state | 최대 taskDistancePx |
|---|---:|
| 1440x1000 pre-send blocker/owner state | 560 |
| 1440x1000 ready | 640 |
| 1440x1000 sending/result | 760 |
| 391x844 pre-send blocker/owner state | 760 |
| 391x844 ready | 960 |
| 391x844 sending/result | 1120 |

근거:

- collapsed preview는 subject, 3개 metadata row, 핵심 body를 합쳐 최대 8개 visual row만 표시합니다.
- 추가 body는 44px 이상 펼치기 control로 document flow 안에서 엽니다.
- 펼친 preview에도 내부 scroll을 만들지 않으며 펼친 상태에는 task distance 상한을 적용하지 않습니다.
- 이 gate는 현재 3836px mobile path를 줄이되 번역 내용 길이를 고정 page height로 자르지 않습니다.
- total page/share height ceiling은 acceptance에 사용하지 않습니다.

### 5.3 Text Zoom 200%

200%에서는 고정 total height와 task distance 상한을 적용하지 않습니다. 다음만 측정합니다.

- overlap 0
- text clipping 0
- horizontal overflow 0
- interactive target 44x44 CSS px 이상
- target -> channel -> preview -> memo -> primary DOM/focus order 유지
- preview expand/collapse와 primary가 keyboard로 동작
- document-only vertical scroll
- 앞뒤 content를 가리는 fixed CTA 없음

### 5.4 Mobile Priority

391x844 순서:

1. workpack status
2. 오늘 참여자 요약과 owner route
3. available channel summary
4. 자동 언어와 12-option dropdown
5. collapsed localized artifact preview
6. 선택 메모
7. blocker 또는 result strip
8. primary 하나

권한 장문, channel setup, worker input, Before/After, 전체 history는 mobile Share에 렌더링하지 않습니다.

## 6. Real Browser RED/GREEN Matrix

### 6.1 Environments

| Env ID | Theme | Viewport |
|---|---|---|
| day-desktop | Day | 1440x1000 |
| night-desktop | Night | 1440x1000 |
| day-mobile | Day | 391x844 |
| night-mobile | Night | 391x844 |

### 6.2 Fixture Ingress Contract

모든 fixture는 tests/helpers/isolated-next-browser-harness.ts와 Playwright Chromium을 사용합니다.

허용되는 입력:

- 실제 URL /workspace?step=share&theme={theme}
- buildStoredCurrentWorkpack 및 parseStoredCurrentWorkpack 형식의 current workpack restore input
- production auth resolver가 읽는 mocked Supabase session response
- page.route로 mocking한 production API response
- 실제 button, link, select click과 keyboard action
- navigator online/offline event

금지되는 입력:

- React state setter 직접 호출
- window.__fixtureState 같은 test-only state
- CSS class나 data attribute를 붙여 state를 꾸미는 injection
- localStorage로 auth, server UUID, readiness 결과, dispatch 성공을 위조
- component 내부 함수 직접 호출
- jsdom/static markup을 browser 결과로 계산

current workpack cache는 문서와 snapshot 복원 입력으로만 사용할 수 있습니다. auth, server authority, session/dispatch 결과는 production resolver와 mocked route response로만 들어옵니다.

### 6.3 Fixtures

| Fixture ID | Production resolver input/action | 핵심 GREEN |
|---|---|---|
| empty | selectedWorkerIds=[] | route-back/primary 각 1개인 오늘 참여자 선택, /workers next route, worker mutation request 0 |
| selected | worker contact 또는 channel 미완료 | reason owner/action/return route 일치 |
| review_required | required artifact missing/stale/not_reviewed | 번역본 검토 route, session/dispatch 0 |
| logged_out | auth resolver session 없음 | 로그인하고 전송, encoded share return |
| blocked | canShare=false workpack restore | blocker 표시, session/dispatch 0 |
| ready | valid snapshot, approved artifacts, available channels, auth | {N}명에게 전송, session은 아직 없음 |
| sending | ready CTA click, session response deferred | session request 1, dispatch 0 until session success, layout stable |
| result_accepted | session success then provider accepted | request/channel accepted, 전달 완료 문구 없음 |
| result_partial | accepted와 failed|unknown channel 혼합 | partial strip과 channel text |
| fail_session | session route failure 또는 malformed response | dispatch request 0, fail reason 표시 |
| fail_dispatch | session success 뒤 dispatch failure/unknown | 새 session ID 보존, duplicate recovery 정확 |
| offline | offline event before click | session/dispatch 0, reconnect 후 resolver 재평가 |
| stale | sourceRevision/digest mismatch | 이전 preview/session/result 숨김, owner route |

4개 environment에서 13개 fixture를 실행하므로 총 52개 browser case입니다.

### 6.4 Request And Routing Assertions

browser test는 request log를 수집해 다음을 검사합니다.

1. share CTA click 전 share-session request는 0입니다.
2. click 뒤 첫 POST는 /api/workpacks/{id}/share-sessions입니다.
3. session body는 현재 selected server worker UUID 집합과 정확히 일치합니다.
4. dispatch POST는 session success 뒤에만 발생하고 새 shareSessionId를 사용합니다.
5. session failure case의 dispatch POST count는 0입니다.
6. dispatch channels는 UI 선택과 같고 kakao를 선택한 approved fixture에서 kakao가 payload에 남습니다.
7. dispatch body는 fixture의 workpackId, 새 shareSessionId, idempotencyKey, 선택 channels, operatorNote와 deep equality로 비교합니다.
8. dispatch payload에 worker form 값, translation fallback, public URL을 추가하지 않습니다.
9. request log index로 session success가 dispatch보다 먼저임을 검사합니다.
10. result classifier는 accepted, failed, unknown을 route response에서 계산합니다.
11. no_recipients와 owner blocker CTA는 실제 URL과 next를 확인합니다.
12. login callback 뒤 /workspace?step=share&theme={theme}로 복귀하고 production resolver가 share를 엽니다.
13. 모든 case에서 visible primary count는 1입니다.
14. 화면 title, 로그인 action, [data-share-preview] count는 각각 최대 1입니다.
15. task distance, touch, gap, overlap, overflow, nested scroll, preview row cap을 실제 rect와 computed style로 검사합니다.

### 6.5 Vietnamese And Language Gates

ready fixture에는 languageCode=vi recipient와 source-matching approved Vietnamese artifact를 넣습니다.

- dropdown은 하나이고 option 순서는 ko, vi, zh, th, uz, mn, ne, km, id, my, tl, en입니다.
- auto-resolved dispatch language는 vi입니다.
- preview override 전후 recipient language와 DispatchPlan digest는 같습니다.
- Vietnamese subject, metadata label/value, body에 Hangul이 없습니다.
- Korean-only site/task/core-risk value가 없습니다.
- structural emoji가 preview DOM과 outbound artifact에 없습니다.
- provenance, reviewer, reviewedAt, sourceDigest, revision, artifactDigest를 검사합니다.
- body 3줄만 바꾼 artifact와 영어 fallback은 review_required입니다.
- 12개 언어 unit fixture 모두 같은 artifact completeness contract를 통과해야 합니다.

실제 provider credential, provider call, Supabase insert/update/delete는 browser gate에서 사용하지 않습니다.

## 7. Implementation Waves

모든 implementation wave는 export, ontology, KOSHA, document-editor workstream이 통합된 FINAL_INTEGRATED_SHA에서 새 branch와 새 worktree를 만든 뒤에만 시작합니다. 이 spec branch에서 구현하지 않습니다.

### Wave 0. Integrated Base Gate

Files: none

~~~powershell
git fetch origin
git show --no-patch --oneline $env:FINAL_INTEGRATED_SHA
git worktree add C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\workpack-share-v2-impl -b feat/workpack-share-v2-impl $env:FINAL_INTEGRATED_SHA
git -C C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\workpack-share-v2-impl status --short --branch
~~~

Exit: 새 worktree가 clean이고 conflict files가 final integrated version입니다.

Rollback: 구현을 시작하지 않습니다. 다른 worktree나 branch를 수정하거나 되돌리지 않습니다.

### Wave 1. Return Resolver, State, Lifecycle

Exact files:

- app/workspace/page.tsx
- components/SafeGuardCommandCenter.tsx
- lib/workspace-pages.ts
- components/WorkflowSharePolicy.ts
- lib/workflow-share-client.ts
- tests/workspace-pages.test.ts
- tests/workflow-share-client.test.ts
- tests/workflow-share-panel-behavior.test.ts

~~~powershell
npm.cmd test -- tests/workspace-pages.test.ts tests/workflow-share-client.test.ts tests/workflow-share-panel-behavior.test.ts --maxWorkers=1 --no-file-parallelism
npm.cmd run typecheck
git diff --check
~~~

Exit: validated step return, exact CTA strings, new-session-before-dispatch, session failure dispatch=0, accepted/failed/unknown classifier, Kakao union이 pure/route contract에서 통과합니다.

Rollback: git revert <wave-1-sha>. DB row나 다른 workstream commit을 되돌리지 않습니다.

### Wave 2. Localized Artifact Authority

Exact files:

- lib/types.ts
- lib/localized-dispatch-artifact.ts (new)
- lib/foreign-worker.ts
- lib/current-workpack.ts
- components/CurrentWorkpackModules.tsx
- components/SafeGuardCommandCenter.tsx
- tests/localized-dispatch-artifact.test.ts (new)
- tests/foreign-worker-languages.test.ts
- tests/documents-editor-layout.test.ts

~~~powershell
npm.cmd test -- tests/localized-dispatch-artifact.test.ts tests/foreign-worker-languages.test.ts tests/documents-editor-layout.test.ts --maxWorkers=1 --no-file-parallelism
npm.cmd run typecheck
git diff --check
~~~

Exit: editor owner, sourceDigest/revision, provenance, human review, stale detection, 12-language completeness가 기존 workpack JSON boundary에서 통과합니다.

Rollback: git revert <wave-2-sha>. schema/migration을 만들지 않습니다.

### Wave 3. Share IA And Route Owners

Exact files:

- components/WorkflowSharePanel.tsx
- components/FieldOperationsWorkspace.tsx
- components/CurrentWorkpackModules.tsx
- components/SafeGuardCommandCenter.tsx
- app/workers/page.tsx
- app/settings/page.tsx
- lib/module-navigation.ts
- app/globals.css
- tests/workspace-workers.test.ts
- tests/frontend-shared-surfaces.test.ts
- tests/product-module-shell.test.ts
- tests/workflow-share-panel-behavior.test.ts

~~~powershell
npm.cmd test -- tests/workspace-workers.test.ts tests/frontend-shared-surfaces.test.ts tests/product-module-shell.test.ts tests/workflow-share-panel-behavior.test.ts --maxWorkers=1 --no-file-parallelism
npm.cmd run typecheck
git diff --check
~~~

Exit: Share worker mutation 0, owner next routes, target->channel->localized preview->one CTA, no chip wall, no nested scroll을 통과합니다.

Rollback: git revert <wave-3-sha>. /workers roster와 기존 storage/dispatch API를 삭제하지 않습니다.

### Wave 4. Real Browser Gate

Required exact files:

- tests/workpack-share-v2-browser.test.ts (new)
- tests/foreign-worker-languages.test.ts

Conditional fix files:

- app/workspace/page.tsx
- components/SafeGuardCommandCenter.tsx
- components/WorkflowSharePanel.tsx
- components/WorkflowSharePanel.module.css
- app/globals.css

~~~powershell
npm.cmd test -- tests/workpack-share-v2-browser.test.ts --maxWorkers=1 --no-file-parallelism
npm.cmd test -- tests/workspace-pages.test.ts tests/workflow-share-client.test.ts tests/workflow-share-panel-behavior.test.ts tests/workspace-workers.test.ts tests/foreign-worker-languages.test.ts --maxWorkers=1 --no-file-parallelism
npm.cmd run typecheck
npm.cmd run build
npm.cmd run audit:frontend-consistency
git diff --check
~~~

Exit: 52개 Chromium case, request order/payload, return routing, task distance, 200% zoom, Vietnamese gate가 GREEN입니다.

Rollback: git revert <wave-4-sha>. 실제 provider와 DB mutation rollback은 없습니다.

Wave 공통 규칙:

- 시작 전 clean status를 확인합니다.
- 각 wave는 한 commit입니다.
- exact/conditional 목록 밖 변경은 중단 사유입니다.
- ours/theirs 일괄 선택을 하지 않습니다.
- package와 lock을 변경하지 않습니다.

## 8. Non-Goals And User Copy

Non-goals:

1. Share 안의 worker quick add, roster mutation, today participant 저장
2. 이 spec 작업과 browser gate에서 실제 외부 provider 실행
3. 이 spec 작업과 browser gate에서 실제 DB mutation 실행, 새 schema, migration
4. channel 연결 또는 Kakao template 승인
5. worker account provisioning
6. public link 또는 anonymous access
7. 임의 fallback 번역을 reviewed artifact로 승격
8. recipient별 delivered/read/training/legal evidence claim
9. export, ontology, KOSHA, document-editor workstream 변경을 이 spec branch에서 실행

제출 가능한 문구:

| 상황 | 문구 |
|---|---|
| 대상 | 오늘 참여자 {N}명을 선택했습니다. |
| 대상 없음 | 오늘 참여자가 없습니다. 작업자 화면에서 오늘 참여자를 선택합니다. |
| 대상 CTA | 오늘 참여자 선택 |
| 로그인 CTA | 로그인하고 전송 |
| 전송 CTA | {N}명에게 전송 |
| 언어 | 작업자 정보와 검토된 번역본에 따라 언어를 정했습니다. |
| 번역 blocker | 검토된 {language} 전송본이 필요합니다. 번역본을 검토한 뒤 돌아옵니다. |
| Session 실패 | 초대 세션을 만들지 못해 전송을 시작하지 않았습니다. |
| Accepted | 선택한 채널이 전송 요청을 접수했습니다. 전달 여부는 전파 이력에서 확인합니다. |
| Partial | 일부 채널은 요청을 접수했고 일부는 실패하거나 결과를 확인하지 못했습니다. |
| Unknown | 전송 결과를 확정하지 못했습니다. 중복 전송을 피하고 전파 이력을 확인합니다. |
| Stale | 문서팩 또는 오늘 참여자 정보가 변경되어 다시 확인해야 합니다. |

저장 성공을 법적 증빙, 접수 성공을 전달 또는 열람 완료, 부분 번역을 번역 완료로 표현하지 않습니다.
제품 런타임은 기존 session/log storage API를 사용하지만 이 revision은 호출하거나 저장 구조를 바꾸지 않습니다.

## 9. Executable MD/JSON Parity

아래 manifest는 spec.json의 parityManifest와 byte-for-byte JSON 의미가 같아야 합니다.

<!-- PARITY_MANIFEST_START -->
~~~json
{
  "status": "HOLD_PENDING_INDEPENDENT_PASS",
  "sequence": [
    "target",
    "channel",
    "localized_preview",
    "send"
  ],
  "ownership": {
    "shareMutatesWorkers": false,
    "rosterOwner": "/workers",
    "todaySnapshotOwners": [
      "/workspace?step=input",
      "/workers"
    ],
    "translationOwner": "document-editor:foreignWorkerTransmission",
    "channelSetupOwner": "/settings"
  },
  "cta": {
    "no_recipients": "오늘 참여자 선택",
    "logged_out": "로그인하고 전송",
    "ready": "{N}명에게 전송",
    "review_required": "번역본 검토"
  },
  "lifecycle": [
    "validate_ready_inputs",
    "create_session",
    "dispatch",
    "save_channel_log"
  ],
  "sessionFailureDispatchCount": 0,
  "channels": [
    "email",
    "sms",
    "kakao"
  ],
  "viewports": {
    "desktop": "1440x1000",
    "mobile": "391x844"
  },
  "zoom200FixedHeightCeiling": false,
  "fixtureIngress": "production_resolver_inputs_and_mocked_routes",
  "browserFixtureIds": [
    "empty",
    "selected",
    "review_required",
    "logged_out",
    "blocked",
    "ready",
    "sending",
    "result_accepted",
    "result_partial",
    "fail_session",
    "fail_dispatch",
    "offline",
    "stale"
  ],
  "browserCaseCount": 52,
  "languageCodes": [
    "ko",
    "vi",
    "zh",
    "th",
    "uz",
    "mn",
    "ne",
    "km",
    "id",
    "my",
    "tl",
    "en"
  ],
  "publicLinkAllowed": false
}
~~~
<!-- PARITY_MANIFEST_END -->

Windows PowerShell parity command:

~~~powershell
@'
const assert = require("node:assert/strict");
const fs = require("node:fs");

const md = fs.readFileSync("evaluation/workpack-share-v2-2026-07-13/spec.md", "utf8");
const spec = JSON.parse(fs.readFileSync("evaluation/workpack-share-v2-2026-07-13/spec.json", "utf8"));
const match = md.match(/<!-- PARITY_MANIFEST_START -->\s*~~~json\s*([\s\S]*?)\s*~~~\s*<!-- PARITY_MANIFEST_END -->/u);
assert.ok(match, "Markdown parity manifest is missing");
const markdownManifest = JSON.parse(match[1]);
assert.deepEqual(markdownManifest, spec.parityManifest);

assert.equal(spec.product.screenSequence.join(">"), "target>channel>localized_preview>send");
assert.equal(spec.product.singletonSurfaces.localizedPreviewMaxCount, 1);
assert.equal(spec.product.singletonSurfaces.loggedOutAdditionalLoginCtaCount, 0);
assert.equal(spec.ownership.shareCanMutateRoster, false);
assert.equal(spec.ownership.shareCanMutateTodaySnapshot, false);
assert.equal(spec.ownership.shareCanCreateWorkers, false);
assert.equal(spec.ownership.noRecipientsPrimaryCount, 1);
assert.equal(spec.evidence.currentQualityFallback.localStorageMayOverrideReadiness, false);
assert.deepEqual(spec.routeOwnership.map((route) => route.id), ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11"]);
assert.deepEqual(spec.returnContract.implementationOwners, ["app/workspace/page.tsx", "components/SafeGuardCommandCenter.tsx", "lib/workspace-pages.ts"]);
assert.equal(spec.stateMachine.primaryCta.logged_out, "로그인하고 전송");
assert.equal(spec.stateMachine.primaryCta.ready, "{N}명에게 전송");
assert.equal(spec.stateMachine.states.find((state) => state.id === "no_recipients").routeBackControlCount, 1);
assert.equal(spec.stateMachine.nonBlockingStatus.mayOwnPrimary, false);
assert.equal(spec.stateMachine.transitions.find((transition) => transition.event === "session failure").dispatchRequestCount, 0);
assert.deepEqual(spec.dataContracts.dispatchChannels, ["email", "sms", "kakao"]);
assert.deepEqual(spec.sendLifecycle.order, ["validate_ready_inputs", "create_session", "dispatch", "save_channel_log"]);
assert.deepEqual(spec.sendLifecycle.createSession.atomicScope, ["share session row", "invitation binding for every locked recipient"]);
assert.equal(spec.sendLifecycle.onSessionFailure.dispatchRequestCount, 0);
assert.equal(spec.resultContract.recipientLevelDeliveredPersistence, false);
assert.equal(spec.accessibility.viewports.mobile, "391x844");
assert.equal(spec.accessibility.zoom200.fixedHeightCeiling, false);
assert.equal(spec.browserGate.fixtureIngress, "production_resolver_inputs_and_mocked_routes");
assert.equal(spec.browserGate.environments.length * spec.browserGate.fixtures.length, 52);
assert.ok(spec.browserGate.fixtures.every((fixture) => fixture.entry === "production_resolver"));
assert.deepEqual(spec.browserGate.fixtures.map((fixture) => fixture.id), spec.parityManifest.browserFixtureIds);
assert.deepEqual(spec.browserGate.environments.map((env) => env.viewport), ["1440x1000", "1440x1000", "391x844", "391x844"]);
assert.ok(spec.stateMachine.blockingReasons.every((reason) => reason.owner && reason.action && reason.returnRoute));
assert.equal(spec.dataContracts.localizedDispatchArtifact.owner, "document-editor:foreignWorkerTransmission");
assert.equal(spec.dataContracts.localizedDispatchArtifact.shareMayGenerate, false);
assert.equal(spec.dataContracts.localizedDispatchArtifact.languageUi.optionCount, 12);
assert.equal(spec.sendLifecycle.invitationPolicy.publicLinkAllowed, false);

const forbidden = [
  ["quick add", "drawer"].join(" "),
  ["로그인하고", "계속합니다"].join(" "),
  ["선택한 {N}명에게", "전송합니다"].join(" "),
  ["390", "x844"].join(""),
  ["mobileReadyBody", "MaxPx"].join(""),
  ["explicit component", "state"].join(" ")
];
for (const value of forbidden) {
  assert.equal(md.includes(value), false, "Forbidden Markdown contradiction: " + value);
  assert.equal(JSON.stringify(spec).includes(value), false, "Forbidden JSON contradiction: " + value);
}

console.log(JSON.stringify({
  result: "PARITY_PASS",
  routes: spec.routeOwnership.length,
  states: spec.stateMachine.states.length,
  channels: spec.dataContracts.dispatchChannels.length,
  fixtures: spec.browserGate.fixtures.length,
  browserCases: spec.parityManifest.browserCaseCount,
  languages: spec.parityManifest.languageCodes.length
}, null, 2));
'@ | node
~~~

Completion gate for this spec revision:

- JSON parse passes.
- parity command prints PARITY_PASS.
- git diff --check passes.
- only spec.md and spec.json are changed.
- commit, pull --rebase, push, remote SHA match, clean worktree are confirmed.
- final status remains HOLD_PENDING_INDEPENDENT_PASS until a fresh independent review passes.
