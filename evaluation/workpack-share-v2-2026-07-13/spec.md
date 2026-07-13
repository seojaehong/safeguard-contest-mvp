# SafeClaw 공유 화면 v2 제품 명세

- Spec ID: workpack-share-v2-2026-07-13
- Revision: independent-review-remediation-2
- 상태: HOLD_PENDING_INDEPENDENT_PASS
- Review status: pending
- 기준 branch: feat/workpack-share-v2
- Source base: 7509d84d37e4ccef7e6ed38f24f6f6b7c44415b7
- Candidate evidence: evaluation/workpack-share-v2-2026-07-13/review-evidence.json의 full candidate SHA
- Review claim: 없음. candidate와 source base는 machine-resolvable해야 하고 fresh independent review는 pending입니다.
- 쓰기 범위: spec candidate commit은 evaluation/workpack-share-v2-2026-07-13/spec.md, spec.json만, 후속 evidence-only commit은 review-evidence.json만 수정합니다.
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
| workpack_share_sessions.access_policy | 현재 정적 access policy object만 저장하고 dispatch route는 이 JSONB를 읽지 않습니다. | 기존 JSONB의 dispatchBinding에 server-generated session-to-dispatch binding을 저장하고 dispatch에서 전부 다시 계산·비교합니다. |
| workpack-commercial.ts | cleanLanguageCode가 빈 값을 ko로 바꾸고 allowlist를 강제하지 않습니다. | 서버 allowlist parser는 missing/unsupported/partial/conflict를 review_required로 반환하며 non-Korean target에 ko fallback을 절대 만들지 않습니다. |
| generation-evidence.ts, /api/workpacks | responseContentDigest가 원본 deliverables를 포함한 응답 전체를 봉인하고 저장 때 다시 검증합니다. | 원본 deliverables를 수정하지 않고 별도 server-signed reviewed localization envelope를 인증 route로 저장합니다. |
| workflow dispatch route | provider와 Kakao 환경 설정은 현재 dispatch 시점에 검사합니다. | Settings 소유 server resolver를 session 전에 호출하고 dispatch 검사는 defense-in-depth로 유지합니다. |
| foreignWorkerLanguages | 언어별 본문 줄만 있고 review/provenance/source binding이 없습니다. | Share가 번역하지 않고 문서 편집 owner가 저장한 server-signed envelope만 소비합니다. |
| d3ad865, 391x844 | share 약 3836px, overlap, 44px 미만 target 15개가 확인됐습니다. | 391x844를 고정 mobile gate로 사용합니다. |
| d3ad865 베트남어 | 본문 3줄만 번역되고 제목과 meta label/value는 한국어입니다. | 부분 번역은 review_required이며 전송 완료 번역으로 취급하지 않습니다. |

결정은 다음과 같습니다.

1. Share는 roster나 today participant snapshot을 만들거나 변경하지 않습니다.
2. no_recipients는 /workers로 돌아가는 CTA 하나만 표시합니다.
3. ready는 session이나 invitation artifact가 이미 있다는 뜻이 아닙니다. session을 만들 수 있는 입력이 유효하다는 뜻입니다.
4. ready 전 validate_reviewed_localization -> resolve_channels를 완료하고, primary 이후 create_session -> dispatch -> save_channel_log 순서입니다. session 실패 시 dispatch count는 0입니다.
5. 결과는 request/channel 단위 accepted, failed, unknown만 말합니다. 수신자별 전달, 열람, 교육 이수는 주장하지 않습니다.
6. Kakao는 Settings에서 사전 설정 및 승인된 경우에만 Share에 나타나지만 production 호환성에서 제거하지 않습니다.
7. 비한국어 전송본은 source-bound, server-signed reviewed localization envelope가 있을 때만 사용합니다.
8. quality fallback example의 canShare=false를 그대로 보존합니다. localStorage 값으로 readiness나 revalidation을 우회하지 않습니다.
9. 정상 배율에서는 primary까지 task distance를 측정합니다. 200% 배율에서는 실제 application text의 computed font-size와 line-height를 2배로 적용해 reflow를 만들고 고정 높이 상한을 사용하지 않습니다.

## 2. Target IA And Ownership

### 2.1 Share Body

| 순서 | 영역 | 표시 | Share가 할 수 있는 일 |
|---:|---|---|---|
| 1 | workpack_status | 문서팩 이름과 readiness 한 줄 | 문서 보기 route 이동 |
| 2 | target | 오늘 참여자 N명과 최대 3명 이름 | owner route로 돌아가기 |
| 3 | channel | 메일, 문자, 승인된 카카오의 선택 및 수신 가능 수 | 준비된 채널 선택 |
| 4 | localized_preview | 자동 해석 언어, option 12개 dropdown, 검토 artifact 미리보기 | preview 언어만 변경 |
| 5 | operator_note | 선택 전달 메모 | 메모 입력 |
| 6 | result_strip | accepted, failed, unknown 채널/request 요약 | persistedLogIds>0일 때만 이력 route 이동 |
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
| R4 | 번역 생성, 수정, 검토, 서명 저장 | foreignWorkerTransmission editor + authenticated review route | Share는 서버가 검증한 approved envelope만 소비합니다. |
| R5 | email, sms, kakao 설정·승인·availability | /settings + server channel resolver | Share는 secret 없는 resolved availability와 검증 토큰만 소비합니다. |
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

sending -> success|partial|fail -> stale -> review_required(workpack_revalidation) -> blocked -> offline -> no_recipients -> logged_out -> review_required(localization|participant) -> selected -> ready

| State | 진입 조건 | Primary label | Enabled | Action |
|---|---|---|---:|---|
| blocked | readiness.canShare=false AND requiresRevalidation=false | 문서 보완 | yes | generic document review route |
| no_recipients | today selected count=0 | 오늘 참여자 선택 | yes | /workers?next={shareReturn} |
| selected | 대상은 있으나 worker/channel 입력이 미완료 | reason별 label | reason별 | 아래 reason catalog |
| logged_out | 입력은 유효하지만 관리자 session 없음 | 로그인하고 전송 | yes | /login?next={shareReturn} |
| review_required | requiresRevalidation=true 또는 번역/participant 검토 필요 | reason별 label | yes | 아래 review catalog |
| ready | 모든 pre-session guard가 유효함 | {N}명에게 전송 | yes | create_session 시작 |
| sending | session 생성 또는 dispatch 진행 중 | 전송 중 | no | 중복 action 차단 |
| success | 모든 요청 channel accepted + persistedLogIds>0 | 전파 이력 확인 | yes | /dispatch |
| partial | accepted와 failed|unknown 혼합 + persistedLogIds>0 | 전파 이력 확인 | yes | /dispatch |
| fail | channel resolver, session, dispatch, log 단계 실패 | failure stage별 label | stage별 | 아래 failure CTA catalog |
| offline | network preflight 실패, provider 미호출 | 연결 다시 확인 | yes | resolver 재평가 |
| stale | non-locale sourceRevision, binding identity 또는 digest mismatch | 변경사항 다시 확인 | yes | stale owner route |

한 화면에서 visible [data-share-primary]는 정확히 하나입니다. header, outer shell, result strip, modal에 별도 primary를 만들지 않습니다.
no_recipients에서는 target 영역의 별도 변경 link를 렌더링하지 않습니다. /workers?next={shareReturn}로 가는 오늘 참여자 선택 primary 하나만 route-back control입니다.

허용 전이:

- initial, owner return, auth callback, reconnect, workpack/snapshot/channel 변경 -> production resolver -> 우선순위상 첫 state
- ready primary -> sending; sending + session failure -> fail; sending + non-locale freshness mismatch -> stale; sending + locale payload/parse mismatch -> review_required
- sending + dispatch outcomes all accepted -> success; mixed -> partial; accepted 0 또는 all unknown -> fail
- blocked, no_recipients, selected, logged_out, review_required, stale의 owner action 완료 -> canonical share return -> production resolver
- offline에서는 전송 요청을 만들지 않고 reconnect 뒤 resolver를 다시 실행합니다.
- requiresRevalidation=true이면 readiness.canShare=false여도 generic blocked보다 workpack_revalidation reason을 먼저 선택합니다.

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
| translation_missing | foreignWorkerTransmission editor 또는 worker locale owner | 번역본 검토; envelope missing과 locale missing/unsupported/partial/conflict를 함께 소유 | returnStep=share |
| translation_stale | foreignWorkerTransmission editor | 번역본 검토 | returnStep=share |
| translation_not_reviewed | foreignWorkerTransmission editor | 번역본 검토 | returnStep=share |
| translation_rejected | foreignWorkerTransmission editor | 번역본 검토 | returnStep=share |
| workpack_revalidation | document review | 문서 다시 검수 | returnStep=share |
| participant_snapshot_stale | input/workers | 오늘 참여자 다시 확인 | next={shareReturn} |

비한국어 artifact blocker는 실제 recipient language에 필요한 artifact에만 적용합니다. unknown locale는 ko로 바꾸지 않고 translation_missing reason 안에서 worker locale owner로 연결합니다. dropdown으로 미사용 언어를 미리보기만 한 경우 dispatch plan은 바뀌지 않으며, 그 언어의 검토 route만 보여줍니다.

### 3.3 Failure CTA Catalog

| Failure stage/reason | Persisted dispatch/log | Primary label | Action/route |
|---|---:|---|---|
| channel_resolution_unresolved | no | 채널 상태 다시 확인 | server resolver 재호출; session POST 0 |
| channel_unavailable | no | 채널 설정 확인 | /settings?next={shareReturn}; session POST 0 |
| session_create_failed | no | 초대 세션 다시 시도 | canonical Share에서 workpack/envelope/channel을 재검증한 뒤 새 session attempt |
| dispatch_rejected_before_provider | no | 전송 조건 다시 확인 | canonical Share resolver 재실행; 자동 재전송 없음 |
| dispatch_result_log_missing | no | 중복 전송 방지 확인 | accepted|failed|unknown 응답을 Share에 유지; 자동 재전송과 /dispatch 이동 없음 |
| dispatch_failed_log_persisted | yes | 전파 이력 확인 | /dispatch |
| sent_or_partial_log_persisted | yes | 전파 이력 확인 | /dispatch |

전파 이력 CTA는 현재 workpack과 attempt를 가리키는 dispatch log ID가 1개 이상 서버에 저장됐을 때만 표시합니다. session 생성 실패나 log 저장 실패는 /dispatch로 보내지 않습니다.

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
  reasonCode:
    | "available"
    | "recipient_contact_missing"
    | "provider_unconfigured"
    | "relay_unconfigured"
    | "idempotency_unsupported"
    | "template_unapproved"
    | "policy_disabled";
  ownerRoute: "/settings";
};

type ChannelAvailabilityResolution = {
  version: "channel-availability/v1";
  workpackId: string;
  canonicalWorkpackRevision: string;
  recipientDigest: string;
  requestedChannels: DispatchChannel[];
  dispatchMode: "fixture" | "live";
  channels: ResolvedChannel[];
  configurationVersion: "channel-configuration/v1";
  configurationDigest: string;
  resolvedAt: string;
  expiresAt: string;
  availabilityToken: string;
};
~~~

Authoritative resolver 계약:

1. Owner는 Settings/channel configuration이며 route는 authenticated POST /api/settings/channels/resolve, pure server function은 resolveServerChannelAvailability입니다.
2. Request는 workpackId, canonicalWorkpackRevision, recipients: serverWorkerUuid[], requestedChannels만 받습니다. 서버는 관리자 auth, workpack 조직 소유권, server worker snapshot을 다시 확인합니다.
3. email/sms는 recipient contact, dispatchMode, relay/provider, persistent idempotency policy를 검사합니다. live mode인데 idempotency가 지원되지 않으면 idempotency_unsupported로 unavailable입니다. kakao는 여기에 SAFEGUARD_KAKAO_ENABLED|SAFECLAW_KAKAO_ENABLED, provider, sender/template 승인까지 검사합니다.
4. configurationVersion은 channel-configuration/v1이고 configurationDigest는 secret을 제외한 provider/relay 존재, dispatch mode, sender/template 승인, idempotency policy를 canonical JSON SHA-256으로 계산한 opaque server digest입니다. 응답은 token, webhook URL, sender key, template ID, credential을 노출하지 않습니다.
5. availabilityToken은 SAFECLAW_CHANNEL_AVAILABILITY_SECRET으로 user/org/site/workpack, canonicalWorkpackRevision, recipientDigest, requestedChannels, dispatchMode, configurationVersion, configurationDigest, resolvedAt, expiresAt을 HMAC-SHA256으로 묶으며 TTL은 120초입니다. secret 미설정은 503, token 없음, ready=false입니다.
6. ready는 response가 인증됐고 만료되지 않았으며 선택한 모든 channel.available=true일 때만 가능합니다. unresolved, expired, recipient/channel/revision mismatch는 selected 또는 stale이며 session POST는 0입니다.
7. share-session route는 token 서명과 binding을 검증하고 같은 pure resolver를 현재 서버 설정으로 다시 실행합니다. 하나라도 unavailable이면 row를 만들지 않고 Settings reason을 반환합니다.
8. resolver route, share-session route, dispatch route는 같은 resolveServerChannelAvailability pure preflight를 사용합니다. dispatch의 현재 env/provider/template/contact/idempotency 검사는 제거하지 않고 defense-in-depth로 다시 실행합니다.
9. unavailable Kakao는 선택 control로 노출하지 않고 Settings 상태와 이동 경로만 표시합니다. typed union, resolver, session request, dispatch payload, result/log adapter는 email|sms|kakao를 모두 보존합니다.
10. Share에는 channel 연결, template 승인, sender key 입력 UI가 없습니다.

- organization reporting recipient group은 worker count와 분리하며 Settings가 소유합니다.

지원 언어 code는 ko, vi, zh, th, uz, mn, ne, km, id, my, tl, en입니다.

### 4.2.1 Allowlisted Locale Parser

~~~ts
type SupportedLanguageCode = "ko" | "vi" | "zh" | "th" | "uz" | "mn" | "ne" | "km" | "id" | "my" | "tl" | "en";

type LocaleParseResult =
  | { status: "supported"; locale: SupportedLanguageCode }
  | {
      status: "review_required";
      reason: "missing" | "unsupported" | "partial" | "conflict";
      raw: string | null;
    };
~~~

1. server parser는 trim과 ASCII lowercase 뒤 정확히 12개 code만 허용합니다. prefix, alias, 지역 tag(예: vi-VN), 임의 첫 두 글자 절단은 partial 또는 unsupported이며 자동 보정하지 않습니다.
2. worker row의 language_code, recipients_snapshot의 languageCode와 workerSnapshot.languageCode가 하나의 allowlisted 값으로 정확히 일치해야 합니다. 누락, unknown, unsupported, partial, conflict는 review_required입니다.
3. ko는 authoritative target locale가 정확히 ko일 때만 결과가 될 수 있습니다. is_foreign_worker=true이거나 non-Korean target인데 locale가 불완전하면 ko, en 또는 다른 언어로 fallback하지 않습니다.
4. review_required locale는 자동 언어 선택과 outbound payload를 만들지 않습니다. ready 전이면 share-session POST 0, dispatch POST 0입니다. session 생성 뒤 server reload에서 발견되면 기존 session은 created로 남기되 provider dispatch 0, log insert 0으로 종료합니다.
5. browser의 review_required fixture는 missing, xx, vi-VN, conflicting snapshot과 non-Korean target의 ko fallback 금지를 table-driven 하위 검증으로 실행합니다. 이는 새 fixture ID가 아니므로 16-fixture 산식은 유지됩니다.
6. dropdown은 12개 언어를 모두 유지하고 자동 선택 결과와 별도의 manual preview override만 제공합니다. preview override는 recipient locale, localePayloadDigest 또는 dispatch plan을 바꾸지 않습니다.

### 4.3 Source-Bound Localized Dispatch Artifact

~~~ts
type LocalizedDispatchArtifact = {
  version: "localized-dispatch-artifact/v1";
  artifactId: string;
  targetLocale: SupportedLanguageCode;
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
  artifactRevision: number;
};

type ReviewedLocalizationEnvelope = {
  version: "reviewed-localization-envelope/v1";
  workpackId: string;
  generationRevision: string;
  sourceDocumentKey: "foreignWorkerTransmission";
  sourceDocumentDigest: string;
  targetLocale: SupportedLanguageCode;
  artifact: LocalizedDispatchArtifact;
  review: {
    state: "approved" | "rejected";
    reviewerId: string;
    reviewerDisplayName: string;
    reviewedAt: string;
  };
  artifactDigest: string;
  signedAt: string;
  signature: string;
};

type ReviewRouteRequest = {
  expectedWorkpackRevision: string;
  sourceDocumentDigest: string;
  artifact: LocalizedDispatchArtifact;
  decision: "approved" | "rejected";
};

type ReviewRouteResponse = {
  ok: true;
  workpackId: string;
  targetLocale: SupportedLanguageCode;
  envelope: ReviewedLocalizationEnvelope;
  canonicalWorkpackRevision: string;
};
~~~

Authority rules:

1. UI owner는 foreignWorkerTransmission document editor이고 server authority는 authenticated PUT /api/workpacks/{id}/localized-dispatch-artifacts/{locale}/review와 lib/reviewed-localization-envelope.ts입니다. Share는 생성, 수정, 승인, 저장하지 않습니다.
2. 원본 workpacks.deliverables와 generationEvidence는 불변입니다. responseContentDigest를 깨는 deliverables.localizedDispatchArtifacts client mutation은 금지합니다.
3. review route는 getWorkspaceUser, organization ownership, locale allowlist를 검증하고 저장된 generationEvidence를 verifyAskResponseGenerationEvidence로 다시 확인합니다.
   검증 순서는 raw evidence_summary에서 reviewedLocalizationEnvelopes를 분리 -> 원본 AskResponse/generationEvidence 검증 -> source document digest 계산 -> candidate 검토 -> envelope 서명 -> 조건부 저장입니다. envelope를 deliverables에 merge한 뒤 generation seal을 검사하지 않습니다.
4. generationRevision = sha256(canonical { workpackId, generationEvidence.version, generationEvidence.signature, responseContentDigest })입니다.
5. sourceDocumentDigest는 서버가 sealed foreignWorkerTransmission 문서와 companyName, siteName, workSummary, topRisk를 canonical JSON SHA-256으로 계산합니다. client가 보낸 digest는 비교용일 뿐 authority가 아닙니다.
6. route는 expectedWorkpackRevision compare-and-swap을 요구하고 reviewerId/name은 auth session, reviewedAt/signedAt은 server clock, artifactRevision은 locale별 server increment로 결정합니다. UPDATE는 eq(updated_at, loadedUpdatedAt) 조건과 updated_at=serverNow를 함께 쓰며 0행이면 409 stale입니다.
7. artifactDigest = sha256(canonical { generationRevision, sourceDocumentKey, sourceDocumentDigest, targetLocale, localized, provenance, artifactRevision, review })입니다. reviewer/time/source/locale가 달라지면 digest도 달라집니다.
8. envelope signature는 SAFECLAW_REVIEWED_LOCALIZATION_SECRET으로 위 필드와 artifactDigest를 server HMAC-SHA256으로 봉인합니다. secret 미설정은 503, write 0, readiness blocked이며 signature secret과 원문 provider credential은 응답에 노출하지 않습니다.
9. envelope는 기존 evidence_summary.reviewedLocalizationEnvelopes[locale] JSON 경계에 저장합니다. generationEvidence를 다시 쓰지 않고 새 column, schema, migration을 만들지 않습니다.
10. reviewSetDigest = sha256(canonical locale 순으로 정렬한 signed envelope 집합), canonicalWorkpackRevision = sha256(canonical { generationRevision, reviewSetDigest })입니다. review 저장마다 새 revision을 반환하며 workpack GET/readiness/channel token/session은 이 값을 사용합니다.
11. 비한국어 recipient는 envelope signature, generationRevision, sourceDocumentDigest, targetLocale, artifactDigest가 모두 유효하고 review.state=approved여야 합니다. missing, rejected, malformed, signature invalid, stale, revision mismatch는 review_required이며 fail-closed입니다.
12. non-Korean subject, metadata label/value, body에는 Hangul 범위가 남지 않습니다. 한국어 site/task/risk 값을 label만 바꾼 값, 영어 fallback, static line, body 3줄만 번역한 값은 완료가 아닙니다.
13. structural emoji는 의미 전달에 사용하지 않습니다. localized text-only가 기본이며 아이콘을 쓰면 accessible name과 같은 의미의 text를 함께 둡니다.
14. dropdown은 12개 option을 유지하지만 preview만 바꿉니다. recipient locale, recipientDigest, canonicalWorkpackRevision, dispatch plan을 바꾸지 않습니다.
15. localStorage와 client state는 envelope, signature, review authority, canonicalWorkpackRevision을 만들거나 덮어쓸 수 없습니다.

베트남어 gate는 subject, site/task/core-risk label과 value, body 전체, semanticRiskLabels, provenance, review, artifactRevision, sourceDocumentDigest, artifactDigest, signature를 검사합니다. browser fixture는 review route response와 workpack GET response를 mock하고 production parser/readiness를 거쳐 envelope를 주입합니다. 임의 client object를 붙이거나 fixture가 한국어 값을 즉석 번역했다고 가정하지 않습니다.

### 4.4 Server-Authoritative Session-To-Dispatch Binding

현재 migration 010의 workpack_share_sessions.access_policy는 JSONB object이고, buildShareSessionDraft도 object를 쓰며 기존 reader는 알려진 policy key만 소비합니다. 따라서 새 column 없이 access_policy.dispatchBinding에 다음 binding을 저장할 수 있습니다. recipients_snapshot array에 object metadata를 섞거나 client state를 authority로 사용하지 않습니다.

~~~ts
type ShareDispatchBindingV1 = {
  version: "share-dispatch-binding/v1";
  sessionIdentity: {
    shareSessionId: string;
    organizationId: string;
    siteId: string | null;
    workpackId: string;
    createdBy: string;
  };
  canonicalWorkpackRevision: string;
  normalizedWorkpackDigest: string;
  recipientSnapshotDigest: string;
  requestedChannels: DispatchChannel[];
  channelConfigurationVersion: "channel-configuration/v1";
  channelConfigurationDigest: string;
  localePayloadDigest: string;
  createdAt: string;
  bindingDigest: string;
};
~~~

Digest rules:

1. normalizeDispatchWorkpack은 dispatch가 provider payload에 넣을 현재 server-loaded workpack만 canonical key order로 정규화합니다. normalizedWorkpackDigest = sha256(canonical normalizeDispatchWorkpack(workpack))이고 canonicalWorkpackRevision과 둘 다 binding에 저장합니다.
2. recipientSnapshotDigest = sha256(canonical workerId 오름차순의 complete server recipient snapshot)입니다. 표시 이름뿐 아니라 locale와 선택 channel 연락처를 포함합니다.
3. requestedChannels는 중복 제거 후 email, sms, kakao canonical 순서로 저장하며 dispatch request와 exact equality를 검사합니다.
4. channelConfigurationVersion과 channelConfigurationDigest는 session 시점 server resolver 결과를 그대로 bind합니다.
5. localePayloadDigest = sha256(canonical workerId 오름차순의 { workerId, targetLocale, artifactDigest, localizedPayload })입니다. ko recipient도 server가 선택한 Korean outbound payload를 포함하며 non-Korean은 검증된 envelope payload만 포함합니다.
6. bindingDigest = sha256(canonical 위 binding의 bindingDigest 제외 전 필드)입니다. 모든 digest는 server pure function에서 생성하고 client가 보낸 digest는 비교 입력으로도 사용하지 않습니다.

Session create contract:

1. app/api/workpacks/[id]/share-sessions/route.ts는 auth 뒤 workpack, recipients, allowlisted locale, signed envelope, channel resolver를 서버에서 다시 읽습니다.
2. route는 crypto.randomUUID()로 shareSessionId를 insert 전에 만들고 server clock createdAt과 함께 sessionIdentity를 구성합니다. row.id와 binding.sessionIdentity.shareSessionId는 같은 값이어야 합니다.
3. 하나의 insert에 id, complete recipients_snapshot, 기존 policy key, access_policy.dispatchBinding을 함께 저장합니다. 성공 응답은 이 insert가 완전하게 저장된 뒤에만 반환합니다.
4. pre-session workpack/token/recipient/channel/locale mismatch는 stage=session_create와 구체 reasonCode를 반환하고 row insert 0, shareSessionId null, dispatch 0입니다.

Dispatch reload contract:

1. app/api/workflow/dispatch/route.ts는 client가 보낸 workpackId/shareSessionId/channels를 lookup key로만 사용합니다. lib/workpack-commercial-store.ts가 session의 recipients_snapshot과 access_policy를 함께 select하고 strict binding parser를 통과시킵니다.
2. 서버는 current workpack, current worker rows, current channel configuration, current locale artifacts를 모두 다시 읽고 같은 pure normalizer/digest functions로 값을 다시 계산합니다.
3. session identity는 DB row id/org/site/workpack/created_by와 authenticated user, request lookup key 모두에 exact equality여야 합니다. 그 뒤 canonicalWorkpackRevision, normalizedWorkpackDigest, recipientSnapshotDigest, requestedChannels, channelConfigurationVersion/digest, localePayloadDigest, bindingDigest를 전부 exact compare합니다.
4. client cache, React state, localStorage, availabilityToken response copy, operatorNote는 freshness authority가 아닙니다.
5. mismatch는 provider 함수와 dispatch-log adapter 전에 종료합니다. 이미 저장된 session은 created 상태로 남고 새 session을 만들거나 자동 retry하지 않습니다.

| Dispatch preflight reasonCode | UI state | Session | Provider dispatch | Log insert |
|---|---|---:|---:|---:|
| session_binding_missing_or_malformed | stale | created | 0 | 0 |
| session_identity_mismatch | stale | created | 0 | 0 |
| workpack_revision_or_digest_changed | stale | created | 0 | 0 |
| recipient_snapshot_changed | stale | created | 0 | 0 |
| channel_configuration_changed | stale | created | 0 | 0 |
| locale_payload_changed | review_required | created | 0 | 0 |
| locale_missing_unsupported_partial_or_conflict | review_required | created | 0 | 0 |

현재 JSONB가 object가 아니거나 기존 strict consumer가 unknown key를 거부하거나 binding을 원자적으로 저장·재조회할 수 없다는 구현 증거가 나오면 그 시점에서 중단하고 migration approval gate를 엽니다. 승인 없이 schema/migration/data 변경, recipients_snapshot shape 변경, client binding 대체를 하지 않습니다. 현재 코드와 migration 확인 결과 이 revision은 access_policy JSONB 경로를 사용하므로 databaseMigrationRequired=false입니다.

### 4.5 Ready Guards And Send Lifecycle

ready는 다음 pre-session guard가 모두 참인 상태입니다.

1. requiresRevalidation=false를 먼저 확인한 뒤 readiness.canShare=true를 확인합니다.
2. today participant가 1명 이상이며 server worker UUID와 선택 channel 연락처가 있습니다.
3. 선택 channel이 1개 이상이고 authenticated server ChannelAvailabilityResolution이 resolved, unexpired이며 모두 available=true입니다.
4. 필요한 모든 non-Korean ReviewedLocalizationEnvelope가 server-verified, source-matching, approved입니다.
5. canonicalWorkpackRevision, participant sourceRevision/digest, channel configurationVersion/digest와 token binding이 validated 값과 같습니다.
6. 관리자 auth session이 있습니다.
7. online이며 unresolved duplicate risk가 없습니다.
8. 아직 share session이나 recipient invitation artifact를 만들지 않았어도 됩니다.

Primary click lifecycle:

1. UI는 validated canonicalWorkpackRevision, recipient snapshot/digest, selected channels, availabilityToken, idempotency attempt scope를 화면 중복 클릭 방지용으로 잠급니다. 이 client lock은 authority가 아닙니다.
2. POST /api/workpacks/{workpackId}/share-sessions를 정확히 한 번 호출합니다.
3. request body는 recipients: serverWorkerUuid[], channels, canonicalWorkpackRevision, availabilityToken만 사용합니다.
4. share-session route는 generationEvidence, required reviewed envelopes, canonicalWorkpackRevision, allowlisted recipient locale, availabilityToken을 검증하고 server channel resolver를 현재 설정으로 재실행한 뒤 4.4 binding을 생성합니다. unresolved/unavailable/locale-invalid이면 insert와 dispatch는 모두 0입니다.
5. session row의 recipients_snapshot과 access_policy.dispatchBinding은 서버가 다시 읽은 recipients 전체를 포함한 하나의 원자적 insert입니다. 일부 recipient나 일부 binding만 담긴 결과는 session_created가 아닙니다.
6. response가 ok=true, UUID shareSessionId, 미래 expiresAt을 모두 반환해야 session_created입니다.
7. session 생성이 실패하거나 malformed이면 fail(session_create_failed)로 종료하고 /api/workflow/dispatch 호출 수는 0이며 /dispatch CTA를 표시하지 않습니다.
8. session_created 뒤에만 POST /api/workflow/dispatch를 정확히 한 번 호출합니다.
9. dispatch payload는 workpackId, 새 shareSessionId, idempotencyKey, channels, operatorNote만 포함합니다.
10. dispatch route는 4.4의 server reload/exact comparison을 먼저 수행하고 contact/env/provider/template 검사를 defense-in-depth로 유지합니다.
11. dispatch 결과 뒤 기존 /api/dispatch-logs adapter가 지원하는 request/channel-level log만 저장합니다.
12. 성공한 sessionId, expiresAt, workflowRunId, idempotencyKey, log ID는 기존 응답/저장이 제공할 때만 보존합니다.
13. session과 dispatch 사이 binding 값이 하나라도 변하면 위 reasonCode로 종료하며 provider dispatch와 log insert는 0입니다. locale 값/내용 문제만 review_required이고 나머지 freshness mismatch는 stale입니다.

각 전송 attempt는 새 session을 만듭니다. 기존 session 재사용은 v2 send lifecycle에 사용하지 않습니다.

### 4.6 Honest Result Classification

~~~ts
type RequestOutcome = "accepted" | "failed" | "unknown";

type DispatchResultStripV2 = {
  stage: "session_create" | "dispatch" | "log_persist";
  requestOutcome: RequestOutcome;
  shareSessionId: string | null;
  workflowRunId: string | null;
  idempotencyKey: string | null;
  providerCalled: boolean | null;
  duplicateRisk: boolean;
  persistedLogIds: string[];
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
- fail state는 stage와 persistedLogIds를 함께 보존합니다. session 실패, accepted channel 0개, 또는 전체 결과 unknown을 같은 CTA로 합치지 않습니다.
- /dispatch CTA는 persistedLogIds.length>0인 dispatch_failed, partial, success 결과에서만 허용합니다.
- authenticated POST /api/dispatch-logs는 기존 dispatch_logs insert에 select("id")를 붙여 logIds를 반환해야 합니다. savedCount, client cache, workflowRunId만으로 persistence를 추정하지 않으며 새 column/migration은 없습니다.
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

각 browser case는 normal_100과 computed_text_200 두 mode로 실행합니다. canonical application tokens가 fixed px이므로 root font 변경은 delivery로 인정하지 않습니다. computed_text_200은 실제 share application text element의 100% computed font-size와 line-height를 캡처한 뒤 각각 2배의 px inline override를 적용해 layout reflow를 일으킵니다.

~~~ts
type TextMetrics = {
  fontSizePx: number;
  lineHeightPx: number;
  lineCount: number;
  heightPx: number;
};

const metrics = (element: HTMLElement): TextMetrics => {
  const style = getComputedStyle(element);
  const range = document.createRange();
  range.selectNodeContents(element);
  const lineTops = new Set(
    [...range.getClientRects()].map((rect) => Math.round(rect.top * 100) / 100)
  );
  return {
    fontSizePx: Number.parseFloat(style.fontSize),
    lineHeightPx: Number.parseFloat(style.lineHeight),
    lineCount: lineTops.size,
    heightPx: element.getBoundingClientRect().height
  };
};

const before = await page.locator("[data-share-reflow-probe]").evaluate(metrics);

await page.locator("[data-share-root]").evaluate((root) => {
  const elements = [root, ...root.querySelectorAll<HTMLElement>("*")]
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .filter((element) => {
      const tag = element.tagName;
      return element.childNodes.length > 0 || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON";
    });

  for (const element of elements) {
    const style = getComputedStyle(element);
    const fontSizePx = Number.parseFloat(style.fontSize);
    const lineHeightPx = Number.parseFloat(style.lineHeight);
    if (Number.isFinite(fontSizePx) && fontSizePx > 0) {
      element.style.setProperty("font-size", `${fontSizePx * 2}px`, "important");
    }
    if (Number.isFinite(lineHeightPx) && lineHeightPx > 0) {
      element.style.setProperty("line-height", `${lineHeightPx * 2}px`, "important");
    }
  }
});

const after = await page.locator("[data-share-reflow-probe]").evaluate(metrics);
expect(after.fontSizePx / before.fontSizePx).toBeGreaterThanOrEqual(1.9);
expect(after.lineHeightPx / before.lineHeightPx).toBeGreaterThanOrEqual(1.9);
expect(after.lineCount).toBeGreaterThan(before.lineCount);
expect(after.heightPx).toBeGreaterThan(before.heightPx);
~~~

- [data-share-reflow-probe]는 실제 localized preview의 자연스러운 text block이며 fixture가 desktop에서도 200%에서 줄바꿈이 증가할 만큼 긴 검토된 문장을 제공합니다. 별도 test-only element를 삽입하지 않습니다.
- probe의 100% computed font-size와 line-height는 finite positive px여야 합니다. line-height=normal이면 contract failure이며 제품 token을 명시적 line-height로 고친 뒤 다시 측정합니다.
- page.setViewportSize는 mode 적용 전에 desktop 1440x1000 또는 mobile 391x844로 고정하고 mode 도중 바꾸지 않습니다.
- browser context deviceScaleFactor는 정확히 1입니다. CSS transform, CSS zoom, browser/device scale, viewport 변경, screenshot 확대·축소를 delivery로 사용하지 않습니다.
- fixture는 production resolver/action으로 목표 state에 도달한 뒤 text override를 적용하고 document.fonts.ready와 두 animation frame을 기다립니다. screenshot은 증거 보조일 뿐이며 사용 시 scale="css"로만 캡처합니다.
- 200%에서는 고정 total height, body height, task distance 상한을 적용하지 않습니다. normal_100 task-distance gate와 별도 결과로 기록합니다.

- representative probe font-size ratio >= 1.9
- representative probe line-height ratio >= 1.9
- representative probe line count 증가와 rendered height 증가
- overlap 0
- text clipping 0
- document와 share root horizontal overflow 0
- interactive target 44x44 CSS px 이상
- target -> channel -> preview -> memo -> primary DOM/focus order 유지
- preview expand/collapse와 primary가 keyboard로 동작
- document-only vertical scroll
- 앞뒤 content를 가리는 fixed CTA 없음
- share body와 preview nested vertical scroll 0

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

| Zoom ID | Delivery | Task-distance gate |
|---|---|---:|
| normal_100 | browser default root font | yes |
| computed_text_200 | 5.3의 page.evaluate computed application text font-size/line-height 2x | no |

case ID는 {envId}:{fixtureId}:{zoomId}이며 모든 fixture를 두 zoom mode에서 실행합니다.

### 6.2 Fixture Ingress Contract

모든 fixture는 tests/helpers/isolated-next-browser-harness.ts와 Playwright Chromium을 사용합니다.

허용되는 입력:

- 실제 URL /workspace?step=share&theme={theme}
- buildStoredCurrentWorkpack 및 parseStoredCurrentWorkpack 형식의 current workpack restore input
- production auth resolver가 읽는 mocked Supabase session response
- page.route로 mocking한 workpack GET, localization review, channel resolver, share-session, dispatch, dispatch-log production API response
- 실제 button, link, select click과 keyboard action
- navigator online/offline event

금지되는 입력:

- React state setter 직접 호출
- window.__fixtureState 같은 test-only state
- CSS class나 data attribute를 붙여 state를 꾸미는 injection
- localStorage로 auth, server UUID, readiness 결과, dispatch 성공을 위조
- component 내부 함수 직접 호출
- jsdom/static markup을 browser 결과로 계산

current workpack cache는 문서와 snapshot 복원 입력으로만 사용할 수 있습니다. signed localization envelope, canonicalWorkpackRevision, channel token, auth, session/dispatch/log 결과는 production parser가 읽는 mocked route response로만 들어옵니다.

### 6.3 Fixtures

| Fixture ID | Production resolver input/action | 핵심 GREEN |
|---|---|---|
| empty | selectedWorkerIds=[] | route-back/primary 각 1개인 오늘 참여자 선택, /workers next route, worker mutation request 0 |
| selected | channel 미선택 | Share channel focus action, session request 0 |
| channel_unavailable | resolver deferred 후 idempotency_unsupported 또는 available=false | unresolved 동안 session 0, Settings CTA, unavailable 뒤에도 session 0 |
| review_required | signed envelope missing/stale/rejected/invalid 또는 locale missing/xx/vi-VN/conflict | 각 table-driven variant에서 번역본/worker locale owner route, Korean fallback 0, share-session/dispatch 0 |
| workpack_revalidation | requiresRevalidation=true와 canShare=false | 문서 다시 검수 copy/route가 generic 문서 보완보다 우선, session/dispatch 0 |
| logged_out | auth resolver session 없음 | 로그인하고 전송, encoded share return |
| blocked | requiresRevalidation=false, canShare=false | 문서 보완 blocker, session/dispatch 0 |
| ready | server-verified envelopes와 unexpired channel token, valid snapshot/auth | {N}명에게 전송, session은 아직 없음 |
| sending | ready CTA click, session response deferred | session request 1, dispatch 0 until session success, layout stable |
| result_accepted | session success, provider accepted, dispatch log persisted | request/channel accepted, 전파 이력 CTA, 전달 완료 문구 없음 |
| result_partial | mixed channel outcome과 dispatch log persisted | partial strip, 전파 이력 CTA |
| fail_session | session route failure 또는 malformed response | 초대 세션 다시 시도, dispatch 0, /dispatch href 0 |
| fail_dispatch | dispatch failed와 log persisted | 전파 이력 확인, /dispatch route |
| fail_dispatch_unpersisted | dispatch accepted/failed/unknown 뒤 log save failure | 중복 전송 방지 확인, 자동 retry 0, /dispatch href 0 |
| offline | offline event before click | session/dispatch 0, reconnect 후 resolver 재평가 |
| stale | pre-session binding mismatch 또는 session success 뒤 identity/workpack/recipient/channel binding mismatch | pre-session은 session/dispatch 0; post-session은 session created, provider dispatch/log insert 0, reasonCode별 owner route |

4개 environment, 16개 fixture, 2개 zoom mode의 완전 교차곱이므로 총 128개 browser case입니다. normal_100 64개와 computed_text_200 64개를 별도 집계합니다. review_required locale variant와 stale binding variant는 각 fixture case 안의 table-driven assertion이며 새 case ID를 만들지 않습니다.

### 6.4 Request And Routing Assertions

browser test는 request log를 수집해 다음을 검사합니다.

1. workpack GET의 signed envelope와 canonicalWorkpackRevision만 production parser/readiness로 들어가며 local mutation은 0입니다.
2. 선택 channel 뒤 POST /api/settings/channels/resolve body는 workpackId, revision, recipients, channels와 deep equality입니다.
3. channel response가 unresolved, expired, unavailable, binding mismatch이면 share-session request는 0입니다.
4. ready CTA click 전 share-session request는 0이고 유효한 resolver token이 있어야 ready가 됩니다.
5. click 뒤 첫 send POST는 /api/workpacks/{id}/share-sessions입니다.
6. session body는 recipients, channels, canonicalWorkpackRevision, availabilityToken과 deep equality입니다.
7. dispatch POST는 session success 뒤에만 발생하고 새 shareSessionId를 사용합니다. route는 access_policy.dispatchBinding을 reload하고 모든 current server digest를 재계산합니다.
8. session failure case는 dispatch count 0, primary 초대 세션 다시 시도, /dispatch href count 0입니다.
9. dispatch channels는 UI 선택과 같고 approved Kakao fixture에서 resolver, session, dispatch payload에 kakao가 남습니다.
10. dispatch body는 workpackId, 새 shareSessionId, idempotencyKey, channels, operatorNote와 deep equality입니다.
11. dispatch payload에 worker form 값, translation fallback, public URL을 추가하지 않습니다.
12. request log index로 channel resolve -> session success -> dispatch -> log persist 순서를 검사합니다.
13. result classifier는 accepted, failed, unknown을 route response에서 계산합니다.
14. mocked dispatch-log POST가 반환한 logIds만 persistence authority입니다. savedCount-only 또는 logIds 없음이면 /dispatch href count는 0이고, logIds가 있는 failure/sent result만 전파 이력 확인을 표시합니다.
15. requiresRevalidation=true fixture는 문서 다시 검수와 document return route를, generic blocked fixture는 문서 보완을 각각 검사합니다.
16. no_recipients와 owner blocker CTA는 실제 URL과 next를 확인합니다.
17. login callback 뒤 /workspace?step=share&theme={theme}로 복귀하고 production resolver가 share를 엽니다.
18. 모든 case에서 visible primary count는 1입니다.
19. 화면 title, 로그인 action, [data-share-preview] count는 각각 최대 1입니다.
20. normal_100은 task distance를 포함한 공통 geometry를 검사합니다. computed_text_200은 exact viewport에서 representative computed font-size/line-height ratio >=1.9, line count와 rendered height 증가, overlap/clipping/horizontal overflow/nested scroll 0, DOM/focus order를 검사합니다.
21. review_required의 missing/unsupported/partial/conflict locale variant는 auto locale, outbound payload, Korean fallback, share-session, dispatch가 모두 0임을 검사합니다.
22. stale의 post-session variant는 session row가 created인 상태에서 각 binding reasonCode별 provider dispatch와 log insert가 0임을 검사합니다.

### 6.5 Vietnamese And Language Gates

ready fixture에는 languageCode=vi recipient와 review route가 저장한 source-matching, approved, server-signed Vietnamese envelope를 workpack GET mock으로 넣습니다.

- dropdown은 하나이고 option 순서는 ko, vi, zh, th, uz, mn, ne, km, id, my, tl, en입니다.
- allowlisted server parser가 auto-resolved dispatch language를 vi로 결정하고, manual dropdown은 preview만 바꿉니다.
- preview override 전후 recipient language와 DispatchPlan digest는 같습니다.
- Vietnamese title/subject, site label/value, task label/value, core-risk label/value, body 전체의 Korean residual count는 각각 0입니다.
- Korean-only title/site/task/core-risk/body value가 없습니다.
- structural emoji가 preview DOM과 outbound artifact에 없고, 모든 상태/위험 의미는 accessible icon+text 또는 text-only입니다. icon-only와 emoji-only meaning count는 0입니다.
- provenance, reviewer, reviewedAt, generationRevision, sourceDocumentDigest, artifactRevision, artifactDigest, signature를 검사합니다.
- body 3줄만 바꾼 artifact, 영어 fallback, unknown/partial locale fallback은 review_required이며 share-session/dispatch count는 0입니다.
- 12개 언어 unit fixture 모두 같은 artifact completeness contract를 통과해야 합니다.

실제 signing secret, provider credential, provider call, Supabase insert/update/delete는 browser gate에서 사용하지 않습니다.

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
- lib/workpack-commercial.ts
- lib/workpack-commercial-store.ts
- lib/channel-availability.ts (new)
- app/api/settings/channels/resolve/route.ts (new)
- app/api/workpacks/[id]/share-sessions/route.ts
- app/api/workflow/dispatch/route.ts
- app/api/dispatch-logs/route.ts
- tests/workspace-pages.test.ts
- tests/workflow-share-client.test.ts
- tests/workflow-share-panel-behavior.test.ts
- tests/workpack-commercial.test.ts
- tests/channel-availability.test.ts (new)
- tests/channel-availability-route.test.ts (new)
- tests/dispatch-logs-route.test.ts (new)
- tests/workpack-share-authority-routes.test.ts

~~~powershell
npm.cmd test -- tests/channel-availability.test.ts tests/channel-availability-route.test.ts tests/dispatch-logs-route.test.ts tests/workpack-share-authority-routes.test.ts tests/workpack-commercial.test.ts tests/workspace-pages.test.ts tests/workflow-share-client.test.ts tests/workflow-share-panel-behavior.test.ts --maxWorkers=1 --no-file-parallelism
npm.cmd run typecheck
git diff --check
~~~

Exit: revalidation precedence, exact CTA strings, authenticated channel resolver/token, allowlisted locale parser, access_policy.dispatchBinding atomic insert/reload, 모든 server freshness digest exact compare, pre-session mismatch session=0, post-session mismatch session=created/provider dispatch=0/log insert=0, stage-specific CTA, Kakao union과 dispatch defense-in-depth가 통과합니다.

Rollback: git revert <wave-1-sha>. DB row나 다른 workstream commit을 되돌리지 않습니다.

### Wave 2. Localized Artifact Authority

Exact files:

- lib/types.ts
- lib/reviewed-localization-envelope.ts (new)
- lib/foreign-worker.ts
- lib/current-workpack.ts
- lib/workpack-store.ts
- lib/workpack-commercial-store.ts
- lib/workpack-readiness.ts
- app/api/workpacks/[id]/route.ts
- app/api/workpacks/[id]/localized-dispatch-artifacts/[locale]/review/route.ts (new)
- components/CurrentWorkpackModules.tsx
- components/SafeGuardCommandCenter.tsx
- tests/reviewed-localization-envelope.test.ts (new)
- tests/reviewed-localization-route.test.ts (new)
- tests/workpack-generation-evidence-route.test.ts
- tests/workpack-share-authority.test.ts
- tests/foreign-worker-languages.test.ts
- tests/documents-editor-layout.test.ts

~~~powershell
npm.cmd test -- tests/reviewed-localization-envelope.test.ts tests/reviewed-localization-route.test.ts tests/workpack-generation-evidence-route.test.ts tests/workpack-share-authority.test.ts tests/foreign-worker-languages.test.ts tests/documents-editor-layout.test.ts --maxWorkers=1 --no-file-parallelism
npm.cmd run typecheck
git diff --check
~~~

Exit: 원본 generationEvidence/deliverables 불변, authenticated review route, envelope HMAC, canonicalWorkpackRevision, compare-and-swap, stale fail-closed, 12-language completeness가 기존 evidence_summary JSON 경계에서 통과합니다.

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
- components/WorkflowSharePanel.module.css
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

~~~powershell
npm.cmd test -- tests/workpack-share-v2-browser.test.ts --maxWorkers=1 --no-file-parallelism
npm.cmd test -- tests/workspace-pages.test.ts tests/workflow-share-client.test.ts tests/workflow-share-panel-behavior.test.ts tests/workspace-workers.test.ts tests/foreign-worker-languages.test.ts --maxWorkers=1 --no-file-parallelism
npm.cmd run typecheck
npm.cmd run build
npm.cmd run audit:frontend-consistency
git diff --check
~~~

Exit: 128개 Chromium case, localization/channel authority, request order/payload, stage-specific CTA routing, normal task distance, executable computed_text_200 reflow, Vietnamese gate가 GREEN입니다.

Rollback: git revert <wave-4-sha>. 실제 provider와 DB mutation rollback은 없습니다.

Wave 공통 규칙:

- 시작 전 clean status를 확인합니다.
- 각 wave는 한 commit입니다.
- exact/conditional 목록 밖 변경은 중단 사유입니다.
- ours/theirs 일괄 선택을 하지 않습니다.
- package, lock, app/globals.css를 변경하지 않습니다.

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
| Revalidation | 문서팩이 변경되어 다시 검수해야 합니다. |
| Session 실패 | 초대 세션을 만들지 못해 전송을 시작하지 않았습니다. |
| Session 실패 CTA | 초대 세션 다시 시도 |
| Accepted + log | 선택한 채널이 전송 요청을 접수했습니다. 전달 여부는 전파 이력에서 확인합니다. |
| Partial | 일부 채널은 요청을 접수했고 일부는 실패하거나 결과를 확인하지 못했습니다. |
| Unknown + no log | 전송 결과를 확정하지 못했습니다. 자동으로 다시 보내지 말고 중복 전송 방지 안내를 확인합니다. |
| Stale | 문서팩 또는 오늘 참여자 정보가 변경되어 다시 확인해야 합니다. |

저장 성공을 법적 증빙, 접수 성공을 전달 또는 열람 완료, 부분 번역을 번역 완료로 표현하지 않습니다.
제품 런타임은 기존 session/log storage API를 사용하지만 이 revision은 호출하거나 저장 구조를 바꾸지 않습니다.

## 9. Executable MD/JSON Parity

TDD-style consistency 순서는 다음과 같습니다.

1. RED: sourceBase 7509d84d37e4ccef7e6ed38f24f6f6b7c44415b7은 machine-resolvable candidate evidence, computed text reflow, server session-dispatch binding, allowlisted locale fail-closed assertion을 통과하지 못해야 합니다.
2. GREEN: spec candidate commit 뒤 evidence-only commit이 review-evidence.json에 exact full candidate/sourceBase SHA를 기록하고, embedded command가 MD/JSON equality, resolvable refs, direct parent, exact commit scope를 모두 통과해야 합니다.
3. REFACTOR: 중복 문구를 줄인 뒤에도 JSON parse, forbidden contradiction scan, 2-file candidate scope, 1-file evidence scope, git diff --check를 다시 통과해야 합니다.

아래 manifest는 spec.json의 parityManifest와 byte-for-byte JSON 의미가 같아야 합니다.

<!-- PARITY_MANIFEST_START -->
~~~json
{
  "status": "HOLD_PENDING_INDEPENDENT_PASS",
  "review": {
    "sourceBase": "7509d84d37e4ccef7e6ed38f24f6f6b7c44415b7",
    "evidenceManifest": "evaluation/workpack-share-v2-2026-07-13/review-evidence.json",
    "reviewStatus": "pending",
    "reviewedClaim": false
  },
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
    "translationPersistenceOwner": "/api/workpacks/{id}/localized-dispatch-artifacts/{locale}/review",
    "channelSetupOwner": "/settings"
  },
  "cta": {
    "no_recipients": "오늘 참여자 선택",
    "logged_out": "로그인하고 전송",
    "ready": "{N}명에게 전송",
    "review_required": "번역본 검토",
    "workpack_revalidation": "문서 다시 검수",
    "session_create_failed": "초대 세션 다시 시도"
  },
  "lifecycle": [
    "validate_reviewed_localization",
    "resolve_channels",
    "create_session",
    "dispatch",
    "save_channel_log"
  ],
  "sessionFailureDispatchCount": 0,
  "sessionFailureHistoryAllowed": false,
  "revalidationBeforeBlocked": true,
  "historyRequiresPersistedLog": true,
  "localizationPersistence": {
    "mode": "separate_server_signed_review_envelope",
    "storage": "evidence_summary.reviewedLocalizationEnvelopes",
    "originalDeliverablesMutable": false,
    "originalGenerationEvidenceMutable": false
  },
  "channelResolver": {
    "route": "/api/settings/channels/resolve",
    "tokenTtlSeconds": 120,
    "sessionBeforeResolvedAvailable": false,
    "configurationVersion": "channel-configuration/v1",
    "configurationDigestRequired": true
  },
  "sessionDispatchBinding": {
    "storage": "workpack_share_sessions.access_policy.dispatchBinding",
    "serverGenerated": true,
    "dispatchReloadsAndComparesAllFields": true,
    "clientStateAuthority": false,
    "preSessionMismatchSessionCount": 0,
    "postSessionMismatchSessionState": "created",
    "postSessionMismatchProviderDispatchCount": 0,
    "postSessionMismatchLogInsertCount": 0
  },
  "localeParser": {
    "allowlistCount": 12,
    "invalidState": "review_required",
    "invalidSessionCount": 0,
    "invalidDispatchCount": 0,
    "nonKoreanKoreanFallbackAllowed": false
  },
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
  "zoomModes": [
    "normal_100",
    "computed_text_200"
  ],
  "zoom200Delivery": "page_evaluate_computed_text_font_and_line_height_2x",
  "zoom200MinComputedRatios": {
    "fontSize": 1.9,
    "lineHeight": 1.9
  },
  "zoom200RequiresWrapAndHeightChange": true,
  "fixtureIngress": "production_resolver_inputs_and_mocked_routes",
  "browserFixtureIds": [
    "empty",
    "selected",
    "channel_unavailable",
    "review_required",
    "workpack_revalidation",
    "logged_out",
    "blocked",
    "ready",
    "sending",
    "result_accepted",
    "result_partial",
    "fail_session",
    "fail_dispatch",
    "fail_dispatch_unpersisted",
    "offline",
    "stale"
  ],
  "browserCaseCount": 128,
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
  "publicLinkAllowed": false,
  "databaseMigrationCount": 0
}
~~~
<!-- PARITY_MANIFEST_END -->

Windows PowerShell parity command:

~~~powershell
@'
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");

const md = fs.readFileSync("evaluation/workpack-share-v2-2026-07-13/spec.md", "utf8");
const spec = JSON.parse(fs.readFileSync("evaluation/workpack-share-v2-2026-07-13/spec.json", "utf8"));
const evidencePath = "evaluation/workpack-share-v2-2026-07-13/review-evidence.json";
const reviewEvidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const git = (...args) => childProcess.execFileSync("git", args, { encoding: "utf8" }).trim();
const sortedLines = (value) => value.split(/\r?\n/u).filter(Boolean).sort();
const fullSha = /^[0-9a-f]{40}$/u;
const match = md.match(/<!-- PARITY_MANIFEST_START -->\s*~~~json\s*([\s\S]*?)\s*~~~\s*<!-- PARITY_MANIFEST_END -->/u);
assert.ok(match, "Markdown parity manifest is missing");
const markdownManifest = JSON.parse(match[1]);
assert.deepEqual(markdownManifest, spec.parityManifest);

assert.equal(spec.metadata.sourceBase, "7509d84d37e4ccef7e6ed38f24f6f6b7c44415b7");
assert.equal(spec.metadata.reviewEvidenceManifest, evidencePath);
assert.equal(spec.metadata.reviewStatus, "pending");
assert.equal(spec.metadata.reviewedClaim, false);
assert.equal(Object.hasOwn(spec.metadata, ["review", "Range"].join("")), false);
assert.equal(Object.hasOwn(spec.metadata, "reviewedCommit"), false);
assert.match(reviewEvidence.sourceBase, fullSha);
assert.match(reviewEvidence.candidate, fullSha);
assert.equal(reviewEvidence.sourceBase, spec.metadata.sourceBase);
assert.equal(reviewEvidence.reviewStatus, "pending");
assert.equal(reviewEvidence.reviewedClaim, false);
git("cat-file", "-e", `${reviewEvidence.sourceBase}^{commit}`);
git("cat-file", "-e", `${reviewEvidence.candidate}^{commit}`);
assert.equal(git("rev-parse", `${reviewEvidence.candidate}^`), reviewEvidence.sourceBase);
assert.equal(git("rev-parse", "HEAD^"), reviewEvidence.candidate);
assert.deepEqual(
  sortedLines(git("diff-tree", "--no-commit-id", "--name-only", "-r", reviewEvidence.candidate)),
  [...spec.metadata.candidateWriteFiles].sort()
);
assert.deepEqual(
  sortedLines(git("diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD")),
  [spec.metadata.evidenceOnlyWriteFile]
);
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
assert.equal(spec.stateMachine.primaryCta.workpack_revalidation, "문서 다시 검수");
assert.ok(spec.stateMachine.precedence.indexOf("workpack_revalidation") < spec.stateMachine.precedence.indexOf("blocked"));
assert.equal(spec.stateMachine.revalidationDecisionRule.evaluateBeforeGenericBlocked, true);
assert.equal(spec.stateMachine.states.find((state) => state.id === "no_recipients").routeBackControlCount, 1);
assert.equal(spec.stateMachine.nonBlockingStatus.mayOwnPrimary, false);
assert.equal(spec.stateMachine.transitions.find((transition) => transition.event === "session failure").dispatchRequestCount, 0);
assert.equal(spec.stateMachine.failureCta.session_create_failed.primaryLabel, "초대 세션 다시 시도");
assert.equal(spec.stateMachine.failureCta.session_create_failed.historyHrefAllowed, false);
assert.equal(spec.stateMachine.failureCta.dispatch_failed_log_persisted.route, "/dispatch");
assert.ok(Object.values(spec.stateMachine.failureCta).every((failure) =>
  failure.historyHrefAllowed ? failure.persistedDispatchLog === true : failure.route !== "/dispatch"
));
assert.deepEqual(spec.dataContracts.dispatchChannels, ["email", "sms", "kakao"]);
assert.equal(spec.dataContracts.channelAvailability.route, "/api/settings/channels/resolve");
assert.equal(spec.dataContracts.channelAvailability.token.ttlSeconds, 120);
assert.equal(spec.dataContracts.channelAvailability.unresolvedOrUnavailableSessionRequestCount, 0);
assert.equal(spec.dataContracts.channelAvailability.dispatchDefenseInDepthPreserved, true);
assert.equal(spec.dataContracts.channelAvailability.serverChecks.persistentIdempotencyPolicy, true);
assert.equal(spec.dataContracts.channelAvailability.dispatchRouteUsesSameServerFunction, true);
assert.ok(spec.dataContracts.channelAvailability.responseFields.includes("configurationVersion"));
assert.ok(spec.dataContracts.channelAvailability.responseFields.includes("configurationDigest"));
assert.deepEqual(spec.dataContracts.localeParser.allowlist, spec.dataContracts.supportedLanguageCodes);
assert.equal(spec.dataContracts.localeParser.invalidState, "review_required");
assert.equal(spec.dataContracts.localeParser.invalidBeforeSession.shareSessionRequestCount, 0);
assert.equal(spec.dataContracts.localeParser.invalidBeforeSession.dispatchRequestCount, 0);
assert.equal(spec.dataContracts.localeParser.koreanAllowedOnlyWhenAuthoritativeLocaleIsExactlyKo, true);
assert.equal(spec.dataContracts.localizedDispatchArtifact.serverAuthority.route, "/api/workpacks/{id}/localized-dispatch-artifacts/{locale}/review");
assert.equal(spec.dataContracts.localizedDispatchArtifact.persistence.mode, "separate_server_signed_review_envelope");
assert.equal(spec.dataContracts.localizedDispatchArtifact.persistence.originalDeliverablesMutable, false);
assert.equal(spec.dataContracts.localizedDispatchArtifact.persistence.originalGenerationEvidenceMutable, false);
assert.equal(spec.dataContracts.localizedDispatchArtifact.persistence.clientOrLocalMutationAllowed, false);
assert.equal(spec.dataContracts.localizedDispatchArtifact.reviewRouteContract.mergeEnvelopeIntoDeliverablesBeforeGenerationVerification, false);
assert.ok(spec.dataContracts.localizedDispatchArtifact.reviewRouteContract.clientCannotSet.includes("reviewedAt"));
assert.equal(spec.dataContracts.localizedDispatchArtifact.reviewWrite.expectedWorkpackRevisionRequired, true);
assert.equal(spec.dataContracts.localizedDispatchArtifact.reviewWrite.newEnvelopeSigned, true);
assert.equal(spec.dataContracts.localizedDispatchArtifact.reviewWrite.routeWritesUpdatedAt, "server clock");
assert.ok(spec.dataContracts.localizedDispatchArtifact.artifactDigest.bindings.includes("reviewedAt"));
assert.equal(spec.dataContracts.sessionDispatchBinding.storage, "workpack_share_sessions.access_policy.dispatchBinding");
assert.equal(spec.dataContracts.sessionDispatchBinding.serverAuthoritative, true);
assert.equal(spec.dataContracts.sessionDispatchBinding.dispatchReload.clientStateAuthority, false);
assert.equal(spec.dataContracts.sessionDispatchBinding.databaseMigrationRequired, false);
assert.ok(spec.dataContracts.sessionDispatchBinding.mismatchOutcomes.every((outcome) =>
  outcome.session === "created" && outcome.providerDispatchCount === 0 && outcome.dispatchLogInsertCount === 0
));
assert.deepEqual(spec.sendLifecycle.order, ["validate_reviewed_localization", "resolve_channels", "create_session", "dispatch", "save_channel_log"]);
assert.deepEqual(Object.keys(spec.sendLifecycle.createSession.requestBody), ["recipients", "channels", "canonicalWorkpackRevision", "availabilityToken"]);
assert.deepEqual(spec.sendLifecycle.createSession.atomicScope, ["one share session row containing complete recipients_snapshot and access_policy.dispatchBinding"]);
assert.equal(spec.sendLifecycle.onSessionFailure.dispatchRequestCount, 0);
assert.equal(spec.sendLifecycle.onSessionFailure.historyHrefCount, 0);
assert.equal(spec.resultContract.recipientLevelDeliveredPersistence, false);
assert.equal(spec.resultContract.historyRequiresPersistedLog, true);
assert.equal(spec.resultContract.persistenceProof.savedCountAloneIsAuthority, false);
assert.equal(spec.resultContract.persistenceProof.databaseMigrationRequired, false);
assert.equal(spec.accessibility.viewports.mobile, "391x844");
assert.equal(spec.accessibility.zoom200.fixedHeightCeiling, false);
assert.equal(spec.accessibility.zoom200.deviceScaleFactorUsedForZoom, false);
assert.equal(spec.accessibility.zoom200.rootFontChangeAccepted, false);
assert.equal(spec.accessibility.zoom200.cssTransformUsedForZoom, false);
assert.equal(spec.accessibility.zoom200.cssZoomUsedForZoom, false);
assert.equal(spec.accessibility.zoom200.screenshotScalingUsedForZoom, false);
assert.ok(spec.accessibility.zoom200.fontSizeRatioMin >= 1.9);
assert.ok(spec.accessibility.zoom200.lineHeightRatioMin >= 1.9);
assert.match(spec.accessibility.zoom200.wrappingAssertion, /lineCount/u);
assert.match(spec.accessibility.zoom200.heightAssertion, /height/u);
assert.match(spec.accessibility.zoom200.delivery, /page\.evaluate/u);
assert.equal(spec.browserGate.fixtureIngress, "production_resolver_inputs_and_mocked_routes");
assert.deepEqual(spec.browserGate.zoomModes.map((mode) => mode.id), ["normal_100", "computed_text_200"]);
assert.equal(spec.browserGate.environments.length * spec.browserGate.fixtures.length * spec.browserGate.zoomModes.length, 128);
assert.equal(spec.browserGate.caseCount, 128);
assert.equal(spec.browserGate.caseCountByZoom.normal_100 + spec.browserGate.caseCountByZoom.computed_text_200, 128);
assert.ok(spec.browserGate.fixtures.every((fixture) => fixture.entry === "production_resolver"));
assert.deepEqual(spec.browserGate.fixtures.map((fixture) => fixture.id), spec.parityManifest.browserFixtureIds);
assert.deepEqual(spec.browserGate.environments.map((env) => env.viewport), ["1440x1000", "1440x1000", "391x844", "391x844"]);
assert.ok(spec.browserGate.fixtures.find((fixture) => fixture.id === "workpack_revalidation").assertions.includes("generic 문서 보완 primary absent"));
assert.ok(spec.browserGate.fixtures.find((fixture) => fixture.id === "fail_session").assertions.includes("/dispatch href count 0"));
assert.ok(spec.browserGate.fixtures.find((fixture) => fixture.id === "fail_dispatch_unpersisted").assertions.includes("/dispatch href count 0"));
assert.ok(spec.stateMachine.blockingReasons.every((reason) => reason.owner && reason.action && reason.returnRoute));
assert.equal(spec.dataContracts.localizedDispatchArtifact.owner, "document-editor:foreignWorkerTransmission");
assert.equal(spec.dataContracts.localizedDispatchArtifact.shareMayGenerate, false);
assert.equal(spec.dataContracts.localizedDispatchArtifact.languageUi.optionCount, 12);
assert.equal(spec.browserGate.languageGate.nonKoreanTargetKoreanFallbackAllowed, false);
assert.equal(spec.browserGate.languageGate.invalidLocaleSessionRequestCount, 0);
assert.equal(spec.browserGate.languageGate.invalidLocaleDispatchRequestCount, 0);
assert.equal(spec.browserGate.languageGate.vietnameseKoreanResidualZeroSurfaces.length, 5);
assert.equal(spec.browserGate.languageGate.iconOnlyMeaningAllowed, false);
assert.equal(spec.browserGate.languageGate.emojiOnlyMeaningAllowed, false);
assert.equal(spec.sendLifecycle.invitationPolicy.publicLinkAllowed, false);
assert.equal(spec.parityManifest.databaseMigrationCount, 0);
assert.equal(spec.routeOwnership.length, 11);
assert.equal(spec.stateMachine.states.length, 12);
assert.equal(spec.stateMachine.blockingReasons.length, 11);
assert.equal(spec.browserGate.fixtures.length, 16);
assert.equal(spec.parityManifest.languageCodes.length, 12);
const waveOneFiles = spec.implementation.waves.find((wave) => wave.id === 1).exactFiles;
for (const file of [
  "lib/workpack-commercial.ts",
  "lib/workpack-commercial-store.ts",
  "app/api/workpacks/[id]/share-sessions/route.ts",
  "app/api/workflow/dispatch/route.ts"
]) assert.ok(waveOneFiles.includes(file), `Wave 1 missing freshness owner: ${file}`);
assert.ok(spec.implementation.waves.every((wave) =>
  ![...(wave.exactFiles || []), ...(wave.conditionalFixFiles || [])].includes("app/globals.css")
));

const forbidden = [
  ["quick add", "drawer"].join(" "),
  ["로그인하고", "계속합니다"].join(" "),
  ["선택한 {N}명에게", "전송합니다"].join(" "),
  ["390", "x844"].join(""),
  ["mobileReadyBody", "MaxPx"].join(""),
  ["explicit component", "state"].join(" "),
  ["2ad", "ca4e"].join(""),
  ["root", "_font_200"].join(""),
  ["59f4812", "..next-candidate"].join(""),
  ["configuration", "Revision"].join(""),
  ["browserCaseCount", "52"].join(String.fromCharCode(34, 58, 32))
];
for (const value of forbidden) {
  assert.equal(md.includes(value), false, "Forbidden Markdown contradiction: " + value);
  assert.equal(JSON.stringify(spec).includes(value), false, "Forbidden JSON contradiction: " + value);
}

console.log(JSON.stringify({
  result: "PARITY_PASS",
  routes: spec.routeOwnership.length,
  states: spec.stateMachine.states.length,
  blockers: spec.stateMachine.blockingReasons.length,
  channels: spec.dataContracts.dispatchChannels.length,
  fixtures: spec.browserGate.fixtures.length,
  zoomModes: spec.browserGate.zoomModes.length,
  browserCases: spec.parityManifest.browserCaseCount,
  languages: spec.parityManifest.languageCodes.length,
  sourceBase: reviewEvidence.sourceBase,
  candidate: reviewEvidence.candidate
}, null, 2));
'@ | node
~~~

Completion gate for this spec revision:

- JSON parse passes.
- parity command prints PARITY_PASS.
- git diff --check passes.
- sourceBase와 candidate가 full 40-character SHA이고 git cat-file로 resolve됩니다.
- candidate의 direct parent는 sourceBase이며 candidate commit은 spec.md/spec.json 두 파일만 변경합니다.
- evidence-only HEAD의 parent는 candidate이며 review-evidence.json 한 파일만 변경합니다. evidence manifest는 evidence commit 자체 SHA를 기록하지 않아 self-reference가 없습니다.
- pull --rebase, 두 conventional commit, push, remote SHA match, clean worktree가 확인됩니다.
- final status remains HOLD_PENDING_INDEPENDENT_PASS until a fresh independent review passes.
