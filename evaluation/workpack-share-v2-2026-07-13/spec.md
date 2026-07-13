# SafeClaw 공유 화면 v2 제품 명세

- Spec ID: workpack-share-v2-2026-07-13
- Revision: independent-review-remediation-6
- 상태: HOLD_PENDING_FRESH_REVIEW
- Review status: pending
- 기준 branch: feat/workpack-share-v2
- Source base: 8804e33421d4b7ea75dd32022acf728f7adb5c43
- Candidate evidence: evaluation/workpack-share-v2-2026-07-13/review-evidence.json의 full candidate SHA
- Review claim: 없음. candidate와 source base는 machine-resolvable해야 하고 fresh independent review는 pending입니다.
- 쓰기 범위: spec candidate commit은 evaluation/workpack-share-v2-2026-07-13/spec.md, spec.json, validate-spec.cjs만, 후속 evidence-only commit은 review-evidence.json만 수정합니다.
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
| workpack-commercial.ts | cleanLanguageCode가 빈 값을 ko로 바꾸고 allowlist를 강제하지 않습니다. | 서버 allowlist parser는 missing/unsupported/malformed/conflicting locale을 recipient_locale_invalid review_required로 반환하고, supported locale의 translation 결함은 translation_incomplete로 분리하며 non-Korean target에 ko fallback을 절대 만들지 않습니다. |
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
10. 번역 검토 route는 /workspace?step=document&document=foreignWorkerTransmission&language={validatedSupportedCode}&returnStep=share&theme={theme}입니다. server allowlist 통과 뒤에만 이 route를 만들며 저장 및 검토 완료 뒤 canonical share path로 돌아옵니다.
11. invalid locale owner route는 /workers?focus=language&next={encoded canonical share return path}이고 language query를 사용하지 않습니다.

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
| recipient_locale_invalid | /workers recipient-language owner | 작업자 언어 확인; missing/unsupported/malformed/region-tag/conflicting recipient locale 수정 | /workers?focus=language&next={encoded shareReturn} |
| translation_incomplete | foreignWorkerTransmission editor | 번역본 보완; allowlisted locale의 missing/partial/stale/conflicting envelope 수정 | /workspace?step=document&document=foreignWorkerTransmission&language={validatedSupportedCode}&returnStep=share&theme={theme} |
| translation_not_reviewed | foreignWorkerTransmission editor | 번역본 검토 | returnStep=share |
| translation_rejected | foreignWorkerTransmission editor | 번역본 수정 | returnStep=share |
| workpack_revalidation | document review | 문서 다시 검수 | returnStep=share |
| participant_snapshot_stale | input/workers | 오늘 참여자 다시 확인 | next={shareReturn} |

recipient_locale_invalid는 language query를 만들지 않으며 raw locale, `{code}`, partial prefix를 URL에 보간하지 않습니다. translation_incomplete/not_reviewed/rejected만 server allowlist parser가 반환한 validatedSupportedCode를 document route에 넣을 수 있습니다. 비한국어 artifact blocker는 실제 recipient language에 필요한 artifact에만 적용하며 dropdown으로 미사용 언어를 미리보기만 한 경우 dispatch plan은 바뀌지 않습니다.

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
  configurationVersion: "channel-configuration/v2";
  configurationRevision: number;
  configurationDigestKeyId: string;
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
4. configurationVersion은 channel-configuration/v2입니다. configurationRevision은 server-held positive monotonic revision입니다. 기존 Settings revision이 없으면 SAFECLAW_CHANNEL_CONFIG_REVISION을 사용하며 endpoint, provider/relay, sender, template, approval, credential, idempotency policy가 바뀔 때마다 운영자가 반드시 증가시킵니다. 누락, 0 이하, parse failure는 unresolved이며 ready=false, session=0입니다.
5. configurationDigest는 SAFECLAW_CHANNEL_CONFIG_BINDING_SECRET으로 아래 NormalizedChannelConfigurationIdentity의 canonical JSON을 HMAC-SHA256한 값입니다. configured/approved boolean만 digest하는 것은 금지합니다.

~~~ts
type NormalizedChannelConfigurationIdentity = {
  schema: "channel-configuration-identity/v2";
  revision: number;
  dispatchMode: "fixture" | "live";
  provider: string;
  relay: {
    provider: string;
    normalizedEndpointIdentity: string;
  };
  channels: Array<{
    channel: DispatchChannel;
    senderKeyOrId: string | null;
    templateId: string | null;
    templateVersion: string | null;
    approvalState: string;
    providerCredentialFingerprint: string;
  }>;
  idempotencyPolicyVersion: string;
};
~~~

6. normalizedEndpointIdentity는 scheme/host/effective port/path와 의미 있는 query를 server에서 canonicalize한 실제 endpoint identity입니다. query credential을 포함한 raw endpoint, sender key/ID, template ID/version, provider credential은 HMAC input으로만 사용하고 response, log, binding JSONB에는 절대 노출하지 않습니다. providerCredentialFingerprint도 binding secret으로 credential bytes를 HMAC한 내부 input이며 외부로 반환하지 않습니다.
7. configurationDigestKeyId는 비밀이 아닌 HMAC key rotation identifier입니다. resolver response와 access_policy.dispatchBinding에는 configurationVersion/revision/digestKeyId/digest만 저장합니다.
8. availabilityToken은 SAFECLAW_CHANNEL_AVAILABILITY_SECRET으로 user/org/site/workpack, canonicalWorkpackRevision, recipientDigest, requestedChannels, dispatchMode, configurationVersion, configurationRevision, configurationDigestKeyId, configurationDigest, resolvedAt, expiresAt을 HMAC-SHA256으로 묶으며 TTL은 120초입니다. secret 미설정은 503, token 없음, ready=false입니다.
9. resolver, share-session creation, dispatch preflight는 모두 같은 pure function으로 current normalized identity와 HMAC을 새로 계산합니다. session creation은 token 값과 recomputed 값이 모두 같을 때만 insert하고, dispatch는 persisted binding과 recomputed version/revision/keyId/digest를 모두 exact compare한 뒤에만 provider를 호출합니다.
10. endpoint/sender/template/provider/approval/credential rotation은 revision 증가와 digest 변경을 함께 일으킵니다. binding HMAC secret rotation은 keyId와 digest를 바꾸며 이전 resolver token은 session=0, 이전 session은 created 상태에서 provider dispatch/log insert=0으로 stale 처리합니다. old-key digest를 grace fallback으로 승인하지 않습니다.
11. ready는 response가 인증됐고 만료되지 않았으며 선택한 모든 channel.available=true일 때만 가능합니다. unresolved, expired, recipient/channel/revision/config identity mismatch는 selected 또는 stale이며 session POST는 0입니다.
12. share-session route는 token 서명과 binding을 검증하고 같은 pure resolver를 현재 서버 설정으로 다시 실행합니다. 하나라도 unavailable이면 row를 만들지 않고 Settings reason을 반환합니다.
13. resolver route, share-session route, dispatch route는 같은 resolveServerChannelAvailability pure preflight를 사용합니다. dispatch의 현재 env/provider/template/contact/idempotency 검사는 제거하지 않고 defense-in-depth로 다시 실행합니다.
14. unavailable Kakao는 선택 control로 노출하지 않고 Settings 상태와 이동 경로만 표시합니다. typed union, resolver, session request, dispatch payload, result/log adapter는 email|sms|kakao를 모두 보존합니다.
15. Share에는 channel 연결, template 승인, sender key 입력 UI가 없습니다.

- organization reporting recipient group은 worker count와 분리하며 Settings가 소유합니다.

지원 언어 code는 ko, vi, zh, th, uz, mn, ne, km, id, my, tl, en입니다.

### 4.2.1 Server Runtime Configuration Sources

Wave 1은 기존에 없는 typed seam `lib/workpack-share-server-config.ts`를 만들고 첫 줄에서 `import "server-only"`를 사용합니다. `readWorkpackShareServerConfig(process.env)`는 resolver, share-session creation, dispatch preflight, localization envelope verification이 호출할 때마다 아래 값을 strict parse합니다. 빈 문자열, placeholder, 32-byte 미만 secret, 0 이하 revision, 공백 key ID는 configuration unresolved입니다.

| Environment key | Kind | Server source | Rotation | Missing or invalid |
|---|---|---|---|---|
| SAFECLAW_CHANNEL_CONFIG_REVISION | positive monotonic integer | server process.env through typed config module | increment for endpoint, sender, template, provider, relay, approval, credential, or idempotency change | unresolved, ready=false, session=0 |
| SAFECLAW_CHANNEL_CONFIG_DIGEST_KEY_ID | non-secret key identifier | server process.env through typed config module | change atomically with SAFECLAW_CHANNEL_CONFIG_BINDING_SECRET | unresolved, ready=false, session=0 |
| SAFECLAW_CHANNEL_AVAILABILITY_SECRET | server-only secret at least 32 bytes | server process.env through typed config module | reject every prior availability token and require a new resolver run | 503, token absent, ready=false, session=0 |
| SAFECLAW_CHANNEL_CONFIG_BINDING_SECRET | server-only secret at least 32 bytes | server process.env through typed config module | change digest key ID and revision, reject prior binding digests, no old-key grace | 503, configuration unresolved, ready=false, session=0 |
| SAFECLAW_REVIEWED_LOCALIZATION_SECRET | server-only secret at least 32 bytes | server process.env through typed config module | invalidate prior envelopes, require re-review and re-sign, produce a new canonical revision before session | 503, localization review write=0, readiness blocked, session=0 |

`.env.example`에는 위 다섯 이름과 빈 placeholder만 추가하고 실제 secret, digest, sender key 또는 endpoint credential을 넣지 않습니다. typed module은 secret 값을 client module이 import하지 못하게 하고 HTTP response로 never returns, serializes, or logs secret values into JSONB or logs. 반환하는 public identity는 revision, configurationDigestKeyId, HMAC digest뿐입니다.

`tests/workpack-share-server-config.test.ts`는 다섯 값의 valid parse, blank/placeholder/short-secret rejection, positive monotonic revision, non-secret key ID, three-secret redaction, process.env 재조회, rotation fail-closed를 검사합니다. binding secret rotation은 key ID와 revision을 함께 바꾸고 old-key grace가 없습니다. availability secret rotation은 기존 token을 모두 거부합니다. localization secret rotation은 기존 envelope를 무효화하고 re-review/re-sign으로 새 canonicalWorkpackRevision을 만든 뒤에만 새 session을 허용합니다.

### 4.2.2 Allowlisted Locale Parser

~~~ts
type SupportedLanguageCode = "ko" | "vi" | "zh" | "th" | "uz" | "mn" | "ne" | "km" | "id" | "my" | "tl" | "en";

type LocaleParseResult =
  | { status: "supported"; locale: SupportedLanguageCode }
  | {
      status: "review_required";
      reason: "missing" | "unsupported" | "malformed" | "conflict";
      raw: string | null;
    };
~~~

1. server parser는 trim과 ASCII lowercase 뒤 정확히 12개 code만 허용합니다. prefix, alias, 지역 tag(예: vi-VN), 임의 첫 두 글자 절단은 malformed 또는 unsupported이며 자동 보정하지 않습니다.
2. worker row의 language_code, recipients_snapshot의 languageCode와 workerSnapshot.languageCode가 하나의 allowlisted 값으로 정확히 일치해야 합니다. locale 자체의 누락, unknown, unsupported, malformed region tag, source conflict는 recipient_locale_invalid review_required입니다.
3. ko는 authoritative target locale가 정확히 ko일 때만 결과가 될 수 있습니다. is_foreign_worker=true이거나 non-Korean target인데 locale가 불완전하면 ko, en 또는 다른 언어로 fallback하지 않습니다.
4. locale가 supported이지만 required envelope가 missing/partial/stale이거나 같은 locale artifact/source binding이 conflict이면 translation_incomplete review_required입니다. 이때만 validatedSupportedCode를 document preview route에 사용합니다.
5. dropdown은 12개 언어를 모두 유지하고 자동 선택 결과와 별도의 manual preview override만 제공합니다. preview override는 recipient locale, localePayloadDigest 또는 dispatch plan을 바꾸지 않습니다.

| Detection stage | Reason | Primary/action | Session rows created in this attempt | Provider dispatch | Log insert |
|---|---|---|---:|---:|---:|
| production resolver before click | recipient_locale_invalid | 작업자 언어 확인 -> /workers?focus=language&next={encoded shareReturn} | 0 | 0 | 0 |
| share-session server revalidation | recipient_locale_invalid | same owner edit; return and explicitly click a new attempt | 0 | 0 | 0 |
| production resolver before click | translation_incomplete | 번역본 보완 -> allowlisted document route | 0 | 0 | 0 |
| share-session server revalidation | translation_incomplete | same document edit; return and explicitly click a new attempt | 0 | 0 | 0 |
| dispatch reload after a valid session insert | recipient_locale_invalid | existing session remains created; worker-language edit; no automatic retry | 1 existing | 0 | 0 |
| dispatch reload after a valid session insert | translation_incomplete | existing session remains created; document edit; no automatic retry | 1 existing | 0 | 0 |

모든 행의 UI state는 review_required입니다. owner 작업 완료 뒤 canonical Share return에서 production resolver를 처음부터 다시 실행하고 사용자가 primary를 다시 눌러야 새 session attempt가 생깁니다. 이전 session 재사용과 자동 dispatch retry는 0입니다. browser의 review_required fixture는 missing, xx, vi-VN, conflicting locale source, supported vi + missing/partial/conflicting envelope, non-Korean target의 ko fallback 금지를 table-driven 하위 검증으로 실행하며 새 fixture ID를 만들지 않습니다.

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
  channelConfigurationVersion: "channel-configuration/v2";
  channelConfigurationRevision: number;
  channelConfigurationDigestKeyId: string;
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
4. channelConfigurationVersion/revision/digestKeyId/digest는 session creation이 current server identity에서 다시 계산한 결과를 bind합니다. client resolver response를 그대로 신뢰하지 않습니다.
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
3. session identity는 DB row id/org/site/workpack/created_by와 authenticated user, request lookup key 모두에 exact equality여야 합니다. 그 뒤 canonicalWorkpackRevision, normalizedWorkpackDigest, recipientSnapshotDigest, requestedChannels, channelConfigurationVersion/revision/digestKeyId/digest, localePayloadDigest, bindingDigest를 전부 exact compare합니다.
4. client cache, React state, localStorage, availabilityToken response copy, operatorNote는 freshness authority가 아닙니다.
5. mismatch는 provider 함수와 dispatch-log adapter 전에 종료합니다. 이미 저장된 session은 created 상태로 남고 새 session을 만들거나 자동 retry하지 않습니다.

| Dispatch preflight reasonCode | UI state | Session | Provider dispatch | Log insert |
|---|---|---:|---:|---:|
| session_binding_missing_or_malformed | stale | created | 0 | 0 |
| session_identity_mismatch | stale | created | 0 | 0 |
| workpack_revision_or_digest_changed | stale | created | 0 | 0 |
| recipient_snapshot_changed | stale | created | 0 | 0 |
| channel_configuration_changed | stale | created | 0 | 0 |
| translation_incomplete | review_required | created | 0 | 0 |
| recipient_locale_invalid | review_required | created | 0 | 0 |

현재 JSONB가 object가 아니거나 기존 strict consumer가 unknown key를 거부하거나 binding을 원자적으로 저장·재조회할 수 없다는 구현 증거가 나오면 그 시점에서 중단하고 migration approval gate를 엽니다. 승인 없이 schema/migration/data 변경, recipients_snapshot shape 변경, client binding 대체를 하지 않습니다. 현재 코드와 migration 확인 결과 이 revision은 access_policy JSONB 경로를 사용하므로 databaseMigrationRequired=false입니다.

### 4.5 Ready Guards And Send Lifecycle

ready는 다음 pre-session guard가 모두 참인 상태입니다.

1. requiresRevalidation=false를 먼저 확인한 뒤 readiness.canShare=true를 확인합니다.
2. today participant가 1명 이상이며 server worker UUID와 선택 channel 연락처가 있습니다.
3. 선택 channel이 1개 이상이고 authenticated server ChannelAvailabilityResolution이 resolved, unexpired이며 모두 available=true입니다.
4. 필요한 모든 non-Korean ReviewedLocalizationEnvelope가 server-verified, source-matching, approved입니다.
5. canonicalWorkpackRevision, participant sourceRevision/digest, channel configurationVersion/revision/digestKeyId/digest와 token binding이 validated 값과 같습니다.
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

각 browser case는 normal_100과 computed_text_200 두 mode로 실행합니다. canonical application tokens가 fixed px이므로 root font 변경은 delivery로 인정하지 않습니다. computed_text_200은 모든 representative node의 100% computed font-size와 line-height를 어떠한 mutation보다 먼저 immutable baseline으로 캡처하고, 각 node에 그 baseline의 정확히 2배를 한 번만 적용해 layout reflow를 일으킵니다. 조상을 먼저 변경한 뒤 descendant computed style을 읽는 순차 scaling은 금지합니다.

Executable invariant table:

| Invariant ID | Normative value |
|---|---|
| representative_source | complete derived visible text-leaf owners plus visible interactables with rendered text |
| ancestor_traversal | each representative itself through every parentElement until documentElement HTML |
| device_scale_factor | 1 |
| device_pixel_ratio | 1 |
| visual_viewport_scale | 1 |
| configured_css_viewport | exact equality |
| immutable_baseline_passes | 1 before any style mutation |
| text_scaling_passes | 1 from immutable per-node baselines |
| font_and_line_ratio | 1.9..2.1 for every representative |
| genuine_fresh_dom_runs | 2 |
| same_dom_repeated_runs | 0 |
| nested_scroll_result | empty array |
| body_scroll_region_roots | exactly 1 |
| preview_scroll_region_roots | exactly 1 |

Geometry coverage table:

| Coverage set | Derived source | Independent expected-count contract |
|---|---|---|
| visibleElements | share root plus every descendant whose computed box is visible | static fixture manifest exact positive count |
| interactables | every visible native or ARIA interactive element derived from visibleElements | static fixture manifest exact positive count |
| textLeaves | every non-empty visible DOM Text node, deduplicated to its owning HTMLElement | static fixture manifest exact positive count |
| ownerMappings | every visibleElements entry resolved through nearest mandatory data-share-owner | exact equality with visibleElements count and static owner allowlist |
| scrollRegionMappings | every visibleElements entry resolved through nearest mandatory data-share-scroll-region | exact body/preview counts from static fixture manifest |

`WORKPACK_SHARE_GEOMETRY_COVERAGE`는 `tests/fixtures/workpack-share-v2.ts`에 fixture ID별 exact positive integer counts, exact owner allowlist, `body`와 `preview` 두 required region, required text owner, meaning owner를 렌더링 전에 정적으로 선언합니다. DOM 측정 결과로 expectation을 생성하거나 갱신하면 contract failure입니다. `data-share-owner`와 `data-share-scroll-region`은 optional probe marker가 아니라 모든 visible element가 해석할 수 있어야 하는 production ownership mapping입니다. 개별 font/overlap/reflow marker는 사용하지 않습니다.

<!-- normative-code:accessibility-and-geometry/v3 -->
~~~ts
type TextMetrics = {
  fontSizePx: number;
  lineHeightPx: number;
  lineCount: number;
  heightPx: number;
};

type GeometryCoverageExpectation = {
  counts: {
    visibleElements: number;
    interactables: number;
    textLeaves: number;
    ownerMappings: number;
    bodyMappings: number;
    previewMappings: number;
  };
  owners: readonly string[];
  requiredTextOwners: readonly string[];
  meaningOwners: readonly string[];
  requiredScrollRegions: readonly ["body", "preview"];
  reflowProbeMinCharacters: number;
};

test.use({ deviceScaleFactor: 1 });
async function assertComputedText200(
  page: Page,
  testInfo: TestInfo,
  fixtureId: WorkpackShareFixtureId
) {
  expect(testInfo.project.use.deviceScaleFactor).toBe(1);
  const configuredViewport = page.viewportSize();
  if (!configuredViewport) throw new Error("The browser case must configure an explicit viewport");
  const expectation: GeometryCoverageExpectation = WORKPACK_SHARE_GEOMETRY_COVERAGE[fixtureId];
  expect(expectation).toBeDefined();
  for (const count of Object.values(expectation.counts)) {
    expect(Number.isInteger(count) && count > 0).toBe(true);
  }
  expect(expectation.owners.length).toBeGreaterThan(0);
  expect(expectation.requiredTextOwners.length).toBeGreaterThan(0);
  expect(expectation.meaningOwners.length).toBeGreaterThan(0);
  expect(expectation.requiredScrollRegions).toEqual(["body", "preview"]);

  const browserScaleInvariant = await page.evaluate(() => ({
    devicePixelRatio: window.devicePixelRatio,
    visualViewportScale: window.visualViewport?.scale ?? 1,
    cssViewportWidth: document.documentElement.clientWidth
  }));
  expect(browserScaleInvariant.devicePixelRatio).toBe(1);
  expect(browserScaleInvariant.visualViewportScale).toBe(1);
  expect(browserScaleInvariant.cssViewportWidth).toBe(configuredViewport.width);

  const result = await page.locator("[data-share-root]").evaluate(async (rootNode, expected) => {
    const root = rootNode as HTMLElement;
    const interactiveSelector = [
      "a[href]",
      "button",
      "input",
      "select",
      "textarea",
      "summary",
      "[role=button]",
      "[role=link]",
      "[role=checkbox]",
      "[role=radio]",
      "[role=switch]",
      "[tabindex]:not([tabindex='-1'])"
    ].join(",");
    const isVisible = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" &&
        style.opacity !== "0" && rect.width > 0 && rect.height > 0;
    };
    const allElements = [root, ...root.querySelectorAll<HTMLElement>("*")];
    const visibleElements = allElements.filter(isVisible);
    const interactables = visibleElements.filter((element) => element.matches(interactiveSelector));
    const textLeafSet = new Set<HTMLElement>();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const value = node.textContent?.replace(/\s+/gu, " ").trim() ?? "";
      const owner = node.parentElement;
      if (value && owner && !owner.matches("script,style,noscript") && isVisible(owner)) {
        textLeafSet.add(owner);
      }
    }
    const textLeaves = [...textLeafSet];
    const withinRootClosest = (element: HTMLElement, selector: string) => {
      const match = element.closest<HTMLElement>(selector);
      return match && (match === root || root.contains(match)) ? match : null;
    };
    const coverage = visibleElements.map((element, index) => {
      const owner = withinRootClosest(element, "[data-share-owner]")?.dataset.shareOwner;
      const scrollRegion = withinRootClosest(
        element,
        "[data-share-scroll-region]"
      )?.dataset.shareScrollRegion;
      if (!owner || !scrollRegion) {
        throw new Error(`Unmapped visible element at derived index ${index}`);
      }
      if (!expected.owners.includes(owner)) {
        throw new Error(`Unexpected geometry owner: ${owner}`);
      }
      if (!expected.requiredScrollRegions.includes(scrollRegion as "body" | "preview")) {
        throw new Error(`Unexpected scroll region: ${scrollRegion}`);
      }
      return { element, owner, scrollRegion };
    });
    const regionRoots = Object.fromEntries(expected.requiredScrollRegions.map((region) => [
      region,
      root.querySelectorAll(`[data-share-scroll-region="${region}"]`).length
    ]));
    if (regionRoots.body !== 1 || regionRoots.preview !== 1) {
      throw new Error(`Required body/preview region roots missing: ${JSON.stringify(regionRoots)}`);
    }
    const actualCounts = {
      visibleElements: visibleElements.length,
      interactables: interactables.length,
      textLeaves: textLeaves.length,
      ownerMappings: coverage.length,
      bodyMappings: coverage.filter((entry) => entry.scrollRegion === "body").length,
      previewMappings: coverage.filter((entry) => entry.scrollRegion === "preview").length
    };
    for (const [key, count] of Object.entries(actualCounts)) {
      if (count <= 0 || count !== expected.counts[key as keyof typeof actualCounts]) {
        throw new Error(`Geometry expected-count mismatch for ${key}: ${count}`);
      }
    }
    if (actualCounts.ownerMappings !== actualCounts.visibleElements) {
      throw new Error("Every visible element must have ownership and scroll-region coverage");
    }
    const actualOwners = [...new Set(coverage.map((entry) => entry.owner))].sort();
    const expectedOwners = [...expected.owners].sort();
    if (JSON.stringify(actualOwners) !== JSON.stringify(expectedOwners)) {
      throw new Error("Geometry owner allowlist coverage mismatch");
    }
    const textOwners = new Set(textLeaves.map((element) =>
      withinRootClosest(element, "[data-share-owner]")?.dataset.shareOwner
    ));
    for (const owner of expected.requiredTextOwners) {
      if (!textOwners.has(owner)) throw new Error(`Missing required text owner: ${owner}`);
    }

  const readMetrics = (element: HTMLElement): TextMetrics => {
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

  await document.fonts.ready;
  const representatives = [...new Set([
    ...textLeaves,
    ...interactables.filter((element) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        return Boolean(element.value || element.placeholder || element.getAttribute("aria-label"));
      }
      return Boolean(element.innerText.trim() || element.getAttribute("aria-label"));
    })
  ])];
  if (representatives.length === 0) throw new Error("Derived representative set is empty");
  if (root.getAttribute("data-share-text-scale-run") !== null) {
    throw new Error("Repeated computed_text_200 evaluation requires a fresh production fixture DOM");
  }

  const rootFontSizeBefore = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const rootInlineFontBefore = document.documentElement.style.fontSize;

  // Capture every computed baseline before the first style mutation.
  const immutableBaselines = representatives.map((element, index) => {
    const before = readMetrics(element);
    if (!Number.isFinite(before.fontSizePx) || before.fontSizePx <= 0 ||
        !Number.isFinite(before.lineHeightPx) || before.lineHeightPx <= 0) {
      throw new Error(`Non-numeric representative metrics at index ${index}`);
    }
    return {
      element,
      key: `derived-representative:${visibleElements.indexOf(element)}:${index}`,
      before
    };
  });

  const representativePaths = immutableBaselines.map((baseline) => {
    const mechanisms = [];
    for (let element: Element | null = baseline.element; element; element = element.parentElement) {
      const style = getComputedStyle(element);
      mechanisms.push({
        tag: element.tagName,
        transform: style.transform,
        zoom: style.getPropertyValue("zoom") || "1"
      });
      if (element === document.documentElement) break;
    }
    if (mechanisms.at(-1)?.tag !== "HTML") {
      throw new Error(`Representative path does not reach document root: ${baseline.key}`);
    }
    for (const mechanism of mechanisms) {
      if (mechanism.transform !== "none" || mechanism.zoom !== "1") {
        throw new Error(`Forbidden scale mechanism on ${baseline.key}/${mechanism.tag}`);
      }
    }
    return { key: baseline.key, mechanisms };
  });

  root.setAttribute("data-share-text-scale-run", "computed_text_200/v2");
  const scaled = new Set<HTMLElement>();
  for (const baseline of immutableBaselines) {
    if (scaled.has(baseline.element)) throw new Error(`Duplicate scaling: ${baseline.key}`);
    baseline.element.style.setProperty(
      "font-size",
      `${baseline.before.fontSizePx * 2}px`,
      "important"
    );
    baseline.element.style.setProperty(
      "line-height",
      `${baseline.before.lineHeightPx * 2}px`,
      "important"
    );
    scaled.add(baseline.element);
  }

  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const nodes = immutableBaselines.map((baseline) => ({
    key: baseline.key,
    before: baseline.before,
    after: readMetrics(baseline.element)
  }));
  const probeBaseline = immutableBaselines.find((baseline) => {
    const owner = withinRootClosest(baseline.element, "[data-share-owner]")?.dataset.shareOwner;
    return owner === "preview-body" &&
      (baseline.element.textContent?.trim().length ?? 0) >= expected.reflowProbeMinCharacters;
  });
  const probe = nodes.find((node) => node.key === probeBaseline?.key);
  if (!probe) throw new Error("The natural preview-body reflow probe is missing");

  const collisionNodes = [...new Set([
    ...interactables,
    ...textLeaves.filter((textElement) =>
      !interactables.some((interactive) => interactive.contains(textElement))
    )
  ])];
  const overlapPairs: string[] = [];
  for (let left = 0; left < collisionNodes.length; left += 1) {
    for (let right = left + 1; right < collisionNodes.length; right += 1) {
      const a = collisionNodes[left];
      const b = collisionNodes[right];
      if (a.contains(b) || b.contains(a)) continue;
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const intersectionWidth = Math.min(ar.right, br.right) - Math.max(ar.left, br.left);
      const intersectionHeight = Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top);
      if (intersectionWidth > 0.5 && intersectionHeight > 0.5) {
        overlapPairs.push(`${left}:${right}`);
      }
    }
  }
  const clippedText = textLeaves.filter((element) => {
    const style = getComputedStyle(element);
    const clipsX = ["hidden", "clip"].includes(style.overflowX) &&
      element.scrollWidth > element.clientWidth + 1;
    const clipsY = ["hidden", "clip"].includes(style.overflowY) &&
      element.scrollHeight > element.clientHeight + 1;
    const lineClamp = style.getPropertyValue("-webkit-line-clamp");
    return clipsX || clipsY || style.textOverflow === "ellipsis" ||
      (lineClamp !== "" && lineClamp !== "none");
  }).map((element) => withinRootClosest(element, "[data-share-owner]")?.dataset.shareOwner);
  const nestedScroll = visibleElements.filter((element) => {
    const style = getComputedStyle(element);
    return ["auto", "scroll"].includes(style.overflowY) &&
      element.scrollHeight > element.clientHeight + 1;
  }).map((element) => withinRootClosest(element, "[data-share-owner]")?.dataset.shareOwner);
  const undersizedTargets = interactables.filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width < 44 || rect.height < 44;
  }).map((element) => withinRootClosest(element, "[data-share-owner]")?.dataset.shareOwner);

  return {
    nodes,
    probe,
    coverageCounts: actualCounts,
    overlapPairs,
    clippedText,
    nestedScroll,
    undersizedTargets,
    documentHorizontalOverflowPx:
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    shareHorizontalOverflowPx: root.scrollWidth - root.clientWidth,
    scaledCount: scaled.size,
    rootFontSizeBefore,
    rootFontSizeAfter: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    rootInlineFontBefore,
    rootInlineFontAfter: document.documentElement.style.fontSize,
    representativePaths,
    rootTransform: getComputedStyle(document.documentElement).transform,
    shareTransform: getComputedStyle(root).transform,
    rootZoom: getComputedStyle(document.documentElement).getPropertyValue("zoom") || "1",
    shareZoom: getComputedStyle(root).getPropertyValue("zoom") || "1"
  };
  }, expectation);

expect(result.coverageCounts).toEqual(expectation.counts);
expect(result.scaledCount).toBe(result.nodes.length);
for (const node of result.nodes) {
  const fontRatio = node.after.fontSizePx / node.before.fontSizePx;
  const lineRatio = node.after.lineHeightPx / node.before.lineHeightPx;
  expect(fontRatio, node.key).toBeGreaterThanOrEqual(1.9);
  expect(fontRatio, node.key).toBeLessThanOrEqual(2.1);
  expect(lineRatio, node.key).toBeGreaterThanOrEqual(1.9);
  expect(lineRatio, node.key).toBeLessThanOrEqual(2.1);
}
expect(result.probe.after.lineCount).toBeGreaterThan(result.probe.before.lineCount);
expect(result.probe.after.heightPx).toBeGreaterThan(result.probe.before.heightPx);
expect(result.rootFontSizeAfter).toBeCloseTo(result.rootFontSizeBefore, 5);
expect(result.rootInlineFontAfter).toBe(result.rootInlineFontBefore);
expect([result.rootTransform, result.shareTransform]).toEqual(["none", "none"]);
expect([result.rootZoom, result.shareZoom]).toEqual(["1", "1"]);
expect(result.representativePaths.every(
  (path) => path.mechanisms.at(-1)?.tag === "HTML" && path.mechanisms.every(
    (mechanism) => mechanism.transform === "none" && mechanism.zoom === "1"
  )
)).toBe(true);
expect(result.overlapPairs).toEqual([]);
expect(result.clippedText).toEqual([]);
expect(result.nestedScroll).toEqual([]);
expect(result.undersizedTargets).toEqual([]);
expect(result.documentHorizontalOverflowPx).toBeLessThanOrEqual(0);
expect(result.shareHorizontalOverflowPx).toBeLessThanOrEqual(0);
}

for (const independentRun of [1, 2]) {
  await page.goto(caseUrl);
  await settleProductionFixture(page, fixtureId);
  expect(await page.locator("[data-share-root]").getAttribute("data-share-text-scale-run")).toBeNull();
  await assertComputedText200(page, testInfo, fixtureId);
}
await expect(assertComputedText200(page, testInfo, fixtureId)).rejects.toThrow(
  "Repeated computed_text_200 evaluation requires a fresh production fixture DOM"
);
~~~

- representative는 complete derived textLeaves와 rendered-text interactables의 합집합입니다. data-share-font-node, data-share-font-role, data-share-overlap-node, data-share-reflow-probe가 0개여도 coverage가 줄지 않으며 이 marker들을 검사 근거로 사용하면 contract failure입니다.
- `baselineCaptureBeforeAnyMutation=true`이며 representativePaths는 각 derived representative 자체, 모든 internal wrapper, share root, outer body, document root HTML을 빠짐없이 포함합니다. root 하나의 ancestor path만 검사하는 결과는 contract failure입니다.
- overlap은 derived textLeaves와 interactables에서 containment를 정규화한 complete collision set으로 검사하고, clipping은 complete textLeaves로 검사합니다. 위 geometry block은 200% 적용 뒤 Day/Night desktop/mobile 모든 case에서 실행합니다.
- reflow probe는 mandatory owner mapping `preview-body` 아래 실제 localized text leaf에서 text length threshold로 도출합니다. 별도 marker나 test-only element를 삽입하지 않습니다.
- 모든 node의 100% computed font-size와 line-height는 첫 mutation 전에 finite positive px로 캡처되어야 합니다. line-height=normal이면 contract failure이며 제품 token을 명시적 line-height로 고친 뒤 다시 측정합니다.
- scale은 immutableBaselines second pass에서 node당 정확히 한 번만 적용합니다. 모든 node의 font/line ratio upper bound 2.1이 ancestor 누적 4x/8x를 차단합니다.
- page.setViewportSize는 mode 적용 전에 desktop 1440x1000 또는 mobile 391x844로 고정하고 mode 도중 바꾸지 않습니다.
- browser context deviceScaleFactor, window.devicePixelRatio, window.visualViewport.scale은 각각 정확히 1이고 documentElement.clientWidth는 configured viewport width와 같아야 합니다. CSS transform, CSS zoom, browser/device/page scale, viewport 변경, screenshot 확대·축소를 delivery로 사용하지 않습니다.
- fixture는 production resolver/action으로 목표 state에 도달한 뒤 text override를 적용하고 document.fonts.ready와 두 animation frame을 기다립니다. screenshot은 증거 보조일 뿐이며 사용 시 scale="css"로만 캡처합니다.
- genuine positive는 동일 case를 fresh production fixture DOM으로 두 번 새로 열어 각각 baseline 1x -> computed text 2x를 검증합니다. 첫 DOM marker가 남은 상태의 repeated evaluation은 즉시 실패하며 4x 누적을 측정 성공으로 취급하지 않습니다.
- 200%에서는 고정 total height, body height, task distance 상한을 적용하지 않습니다. normal_100 task-distance gate와 별도 결과로 기록합니다.

- 모든 representative node font-size/line-height ratio 1.9 이상 2.1 이하
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

Negative fixture contract:

| Fixture ID | DOM or browser mutation | Required result |
|---|---|---|
| internal_wrapper_transform | representative와 share root 사이 wrapper에 transform:scale(2) | fail before text mutation |
| internal_zoom | representative와 share root 사이 wrapper에 zoom:2 | fail before text mutation |
| outer_transform | share root 바깥 body wrapper에 transform:scale(2) | fail before text mutation |
| repeated_evaluation | fresh DOM에서 한 번 성공한 helper를 reload 없이 다시 호출 | fail on data-share-text-scale-run marker |
| device_scale_factor | context deviceScaleFactor와 devicePixelRatio를 2로 설정 | fail before text mutation |
| page_zoom | visualViewport.scale 또는 CSS viewport width를 configured viewport와 다르게 설정 | fail before text mutation |

Geometry coverage fixture contract:

| Geometry fixture ID | DOM ownership mutation | Required result |
|---|---|---|
| marker_removal | body/preview ownership and scroll-region mappings removed from the derived visible set | fail on unmapped visible element or missing required region |
| partial_marker | one derived visible text leaf loses resolvable owner or scroll-region mapping | fail before geometry assertions |

`tests/workpack-share-v2-browser.test.ts`는 위 여섯 zoom negative fixture와 두 geometry coverage fixture를 실제 DOM/browser case로 실행하고, genuine fresh-DOM positive와 complete geometry positive를 각각 두 번 실행합니다. spec validator의 contract fixtures는 이 실패/성공 산술만 검증하며 128개 browser case 실행을 주장하지 않습니다.

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
| review_required | invalid locale missing/xx/vi-VN/conflict와 supported vi envelope missing/partial/stale/conflict를 분리 | locale invalid는 /workers?focus=language route와 language query 0; translation incomplete는 validated vi document route; 모든 pre-session variant share-session/dispatch 0 |
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
20. normal_100은 task distance를 포함한 공통 geometry를 검사합니다. computed_text_200은 Day/Night desktop/mobile 각 exact viewport에서 모든 representative computed font-size/line-height ratio 1.9 이상 2.1 이하, line count와 rendered height 증가, overlap/clipping/horizontal overflow/nested scroll 0, DOM/focus order를 검사합니다.
21. review_required의 missing/unsupported/malformed/conflicting locale variant는 /workers?focus=language owner, language query count 0, auto locale/outbound payload/Korean fallback/share-session/dispatch 0을 검사합니다. supported vi + missing/partial/stale/conflicting envelope variant는 validated vi document route와 share-session/dispatch 0을 검사합니다.
22. stale의 post-session variant는 session row가 created인 상태에서 각 binding reasonCode별 provider dispatch와 log insert가 0임을 검사합니다.
23. computed_text_200은 각 representative text node에서 document root까지 모든 internal/outer ancestor의 transform과 zoom을 검사합니다.
24. context deviceScaleFactor, window.devicePixelRatio, visualViewport.scale은 1이고 CSS viewport width는 configured viewport와 같아야 합니다.
25. fresh production DOM positive를 두 번 독립 실행하며 같은 DOM repeated evaluation과 internal wrapper transform/zoom, outer transform fixture는 실패합니다.
26. server authority auto loop는 12개 SupportedLanguageCode를 각각 선택하고 title, metadata labels, metadata values, body를 렌더링해 script allowlist와 non-ko Hangul residual 0을 검사합니다.
27. manual loop도 12개 option을 각각 실제 선택하고 같은 surface를 검사하되 recipient language, dispatch language와 DispatchPlan digest는 바뀌지 않습니다.
28. invalid locale CTA는 exact static workers owner route이며 raw locale와 language query 보간 0, share-session/dispatch 0입니다.
29. geometry는 share root의 complete visibleElements/interactables/textLeaves를 도출해 static exact positive counts, owner mapping, body/preview mapping과 각각 한 region root를 검사합니다. 누락 또는 부분 mapping은 실패합니다.
30. fixture별 meaning owner는 localized visible text와 accessible name을 가지며 emoji는 유일한 의미가 될 수 없습니다.

### 6.5 Vietnamese And Language Gates

ready fixture family는 각 SupportedLanguageCode recipient와 review route가 저장한 source-matching, approved, server-signed envelope 12개를 workpack GET mock으로 제공합니다. 언어 loop는 fixture ID를 추가하지 않고 각 ready browser case 내부의 table-driven assertion으로 실행하므로 128 case 산술은 변하지 않습니다.

Language script policy:

| Language code | Allowed letter script plus neutral identifiers | Auto render | Manual render | Hangul residual rule |
|---|---|---|---|---|
| ko | Hangul and Han | required | required | target script, not residual |
| vi | Latin | required | required | 0 |
| zh | Han | required | required | 0 |
| th | Thai | required | required | 0 |
| uz | Latin | required | required | 0 |
| mn | Cyrillic | required | required | 0 |
| ne | Devanagari | required | required | 0 |
| km | Khmer | required | required | 0 |
| id | Latin | required | required | 0 |
| my | Myanmar | required | required | 0 |
| tl | Latin | required | required | 0 |
| en | Latin | required | required | 0 |

Localized surface coverage:

| Surface ID | Semantic source | Auto assertion | Manual assertion | Script assertion |
|---|---|---|---|---|
| title | preview-title owner | required non-empty | required non-empty | language policy |
| metadataLabels | preview-metadata owner dt elements | required non-empty set | required non-empty set | language policy |
| metadataValues | preview-metadata owner dd elements | required non-empty set | required non-empty set | language policy or neutral identifier |
| body | preview-body owner | required non-empty | required non-empty | language policy |

Language authority cases:

| Case ID | Preview authority | Dispatch authority | Required result |
|---|---|---|---|
| auto_all_languages | server allowlisted recipient locale | same server locale | all 12 selected and rendered; localized surface contract; non-ko Hangul residual 0 |
| manual_all_languages | operator dropdown preview override | original server auto locale and unchanged DispatchPlan digest | all 12 manually selected and rendered; no recipient or dispatch mutation |
| invalid_locale | none | none | review_required; exact static workers owner CTA; no language query/raw interpolation; session 0; dispatch 0 |
| semantic_meaning | localized visible text | not applicable | accessible icon plus visible text or visible text-only; emoji is never sole meaning |

Neutral identifiers are only URL/email, ASCII uppercase/digit IDs, dates, times and punctuation tokens recognized by the executable allowlist. They do not permit arbitrary fallback prose. Every non-`ko` title, metadata label, metadata value and body has Hangul residual count 0. Vietnamese retains the stricter named title/site/task/core-risk/body residual-0 assertions from the reviewed artifact contract.

<!-- normative-code:language-matrix/v2 -->
~~~ts
const SUPPORTED_LANGUAGE_CASES = [
  { code: "ko", allowedLetter: /[\p{Script_Extensions=Hangul}\p{Script_Extensions=Han}]/u },
  { code: "vi", allowedLetter: /\p{Script_Extensions=Latin}/u },
  { code: "zh", allowedLetter: /\p{Script_Extensions=Han}/u },
  { code: "th", allowedLetter: /\p{Script_Extensions=Thai}/u },
  { code: "uz", allowedLetter: /\p{Script_Extensions=Latin}/u },
  { code: "mn", allowedLetter: /\p{Script_Extensions=Cyrillic}/u },
  { code: "ne", allowedLetter: /\p{Script_Extensions=Devanagari}/u },
  { code: "km", allowedLetter: /\p{Script_Extensions=Khmer}/u },
  { code: "id", allowedLetter: /\p{Script_Extensions=Latin}/u },
  { code: "my", allowedLetter: /\p{Script_Extensions=Myanmar}/u },
  { code: "tl", allowedLetter: /\p{Script_Extensions=Latin}/u },
  { code: "en", allowedLetter: /\p{Script_Extensions=Latin}/u }
] as const satisfies readonly {
  code: SupportedLanguageCode;
  allowedLetter: RegExp;
}[];

const LOCALIZED_SURFACES = [
  { id: "title", selector: '[data-share-owner="preview-title"]' },
  { id: "metadataLabels", selector: '[data-share-owner="preview-metadata"] dt' },
  { id: "metadataValues", selector: '[data-share-owner="preview-metadata"] dd' },
  { id: "body", selector: '[data-share-owner="preview-body"]' }
] as const;

const HANGUL = /\p{Script_Extensions=Hangul}/gu;
const LETTER_OR_MARK = /[\p{L}\p{M}]/u;
const EMOJI = /\p{Extended_Pictographic}/gu;
const NEUTRAL_IDENTIFIER = /^(?:https?:\/\/\S+|[^\s@]+@[^\s@]+|[A-Z0-9][A-Z0-9._:/-]*|\d[\d.:/-]*)$/u;

async function assertLocalizedSurfaceContract(
  page: Page,
  languageCase: (typeof SUPPORTED_LANGUAGE_CASES)[number]
) {
  const collected: Record<(typeof LOCALIZED_SURFACES)[number]["id"], string[]> = {
    title: [],
    metadataLabels: [],
    metadataValues: [],
    body: []
  };
  for (const surface of LOCALIZED_SURFACES) {
    const locator = page.locator(surface.selector);
    const count = await locator.count();
    expect(count, `${languageCase.code}/${surface.id}`).toBeGreaterThan(0);
    collected[surface.id] = (await locator.allTextContents())
      .map((value) => value.replace(/\s+/gu, " ").trim())
      .filter(Boolean);
    expect(collected[surface.id].length, `${languageCase.code}/${surface.id}`).toBe(count);
    for (const text of collected[surface.id]) {
      if (languageCase.code !== "ko") {
        expect(text.match(HANGUL) ?? [], `${languageCase.code}/${surface.id}`).toHaveLength(0);
      }
      for (const token of text.split(/\s+/u)) {
        if (NEUTRAL_IDENTIFIER.test(token)) continue;
        for (const character of token) {
          if (LETTER_OR_MARK.test(character)) {
            expect(
              languageCase.allowedLetter.test(character),
              `${languageCase.code}/${surface.id}/${character}`
            ).toBe(true);
          }
        }
      }
    }
  }
  expect(collected.title.join(" ")).not.toBe("");
  expect(collected.metadataLabels.join(" ")).not.toBe("");
  expect(collected.metadataValues.join(" ")).not.toBe("");
  expect(collected.body.join(" ")).not.toBe("");
}

async function assertEmojiIsNotSoleMeaning(page: Page, fixtureId: WorkpackShareFixtureId) {
  const meaningOwners = WORKPACK_SHARE_GEOMETRY_COVERAGE[fixtureId].meaningOwners;
  expect(meaningOwners.length).toBeGreaterThan(0);
  for (const owner of meaningOwners) {
    const meaning = page.locator(`[data-share-owner="${owner}"]`);
    await expect(meaning).toBeVisible();
    const visibleText = (await meaning.innerText()).replace(/\s+/gu, " ").trim();
    const nonEmojiText = visibleText.replace(EMOJI, "").trim();
    expect(nonEmojiText, owner).not.toBe("");
    const accessibleName = (await meaning.getAttribute("aria-label"))?.trim() || visibleText;
    expect(accessibleName, owner).not.toBe("");
  }
}

for (const autoLanguage of SUPPORTED_LANGUAGE_CASES) {
  await page.goto(readyCaseUrl({ recipientLanguage: autoLanguage.code }));
  await settleProductionFixture(page, "ready");
  const authority = await readServerResolvedShareAuthority(page);
  expect(authority.recipientLanguage).toBe(autoLanguage.code);
  expect(authority.dispatchLanguage).toBe(autoLanguage.code);
  await expect(page.getByRole("combobox", { name: "미리보기 언어" })).toHaveValue(autoLanguage.code);
  await expect(page.locator("[data-share-preview]")).toHaveAttribute("lang", autoLanguage.code);
  await assertLocalizedSurfaceContract(page, autoLanguage);
  await assertEmojiIsNotSoleMeaning(page, "ready");
}

for (const manualLanguage of SUPPORTED_LANGUAGE_CASES) {
  await page.goto(readyCaseUrl({ recipientLanguage: "vi" }));
  await settleProductionFixture(page, "ready");
  const before = await readServerResolvedShareAuthority(page);
  await page.getByRole("combobox", { name: "미리보기 언어" }).selectOption(manualLanguage.code);
  await expect(page.locator("[data-share-preview]")).toHaveAttribute("lang", manualLanguage.code);
  await assertLocalizedSurfaceContract(page, manualLanguage);
  await assertEmojiIsNotSoleMeaning(page, "ready");
  const after = await readServerResolvedShareAuthority(page);
  expect(after.recipientLanguage).toBe(before.recipientLanguage);
  expect(after.dispatchLanguage).toBe(before.dispatchLanguage);
  expect(after.dispatchPlanDigest).toBe(before.dispatchPlanDigest);
}

for (const invalidLocale of [null, "", "xx", "vi-VN", "ko|vi"] as const) {
  await page.goto(reviewRequiredCaseUrl({ invalidLocale }));
  await settleProductionFixture(page, "review_required");
  const canonicalShareReturn = "/workspace?step=share&theme=day";
  const expectedOwnerHref = `/workers?focus=language&next=${encodeURIComponent(canonicalShareReturn)}`;
  const ownerCta = page.getByRole("link", { name: "작업자 언어 확인" });
  await expect(ownerCta).toHaveAttribute("href", expectedOwnerHref);
  const actualOwnerUrl = new URL(await ownerCta.getAttribute("href") ?? "", "https://safeclaw.invalid");
  expect(actualOwnerUrl.searchParams.has("language")).toBe(false);
  expect(actualOwnerUrl.searchParams.get("next")).toBe(canonicalShareReturn);
  expect(requestLog.shareSession).toHaveLength(0);
  expect(requestLog.dispatch).toHaveLength(0);
  await expect(page.locator("[data-share-state]")).toHaveAttribute("data-share-state", "review_required");
}
~~~

- dropdown은 하나이고 option 순서는 ko, vi, zh, th, uz, mn, ne, km, id, my, tl, en입니다.
- allowlisted server parser가 auto-resolved recipient/dispatch language를 결정하고, manual dropdown은 preview만 바꿉니다.
- preview override 전후 recipient language, dispatch language와 DispatchPlan digest는 같습니다.
- Vietnamese title/subject, site label/value, task label/value, core-risk label/value, body 전체의 Korean residual count는 각각 0입니다.
- Korean-only non-ko title/site/task/core-risk/body value가 없습니다.
- structural emoji가 outbound artifact에 없고, 모든 상태/위험 의미는 accessible icon+visible text 또는 visible text-only입니다. icon-only와 emoji-only meaning count는 0입니다.
- provenance, reviewer, reviewedAt, generationRevision, sourceDocumentDigest, artifactRevision, artifactDigest, signature를 검사합니다.
- body 3줄만 바꾼 artifact, 영어 fallback, unknown/malformed locale fallback은 review_required이며 share-session/dispatch count는 0입니다.
- 12개 언어 auto fixture와 12개 manual selection 모두 같은 artifact completeness와 surface contract를 통과해야 합니다.

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

### Wave 1. Authority Foundation And Session Binding

Exact files:

- .env.example
- lib/types.ts
- lib/workpack-share-server-config.ts (new)
- lib/reviewed-localization-envelope.ts (new)
- lib/foreign-worker.ts
- lib/current-workpack.ts
- lib/workpack-store.ts
- lib/workpack-commercial.ts
- lib/workpack-commercial-store.ts
- lib/workpack-readiness.ts
- lib/channel-availability.ts (new)
- app/api/settings/channels/resolve/route.ts (new)
- app/api/workpacks/[id]/route.ts
- app/api/workpacks/[id]/localized-dispatch-artifacts/[locale]/review/route.ts (new)
- app/api/workpacks/[id]/share-sessions/route.ts
- app/api/workflow/dispatch/route.ts
- app/api/dispatch-logs/route.ts
- tests/reviewed-localization-envelope.test.ts (new)
- tests/workpack-share-server-config.test.ts (new)
- tests/reviewed-localization-route.test.ts (new)
- tests/workpack-generation-evidence-route.test.ts
- tests/workpack-share-authority.test.ts
- tests/foreign-worker-languages.test.ts
- tests/workpack-commercial.test.ts
- tests/channel-availability.test.ts (new)
- tests/channel-availability-route.test.ts (new)
- tests/dispatch-logs-route.test.ts (new)
- tests/workpack-share-authority-routes.test.ts

~~~powershell
npm.cmd test -- tests/workpack-share-server-config.test.ts tests/reviewed-localization-envelope.test.ts tests/reviewed-localization-route.test.ts tests/workpack-generation-evidence-route.test.ts tests/workpack-share-authority.test.ts tests/foreign-worker-languages.test.ts tests/workpack-commercial.test.ts tests/channel-availability.test.ts tests/channel-availability-route.test.ts tests/dispatch-logs-route.test.ts tests/workpack-share-authority-routes.test.ts --maxWorkers=1 --no-file-parallelism
npm.cmd run typecheck
git diff --check
~~~

Exit: 이 wave만으로 placeholder-only `.env.example`, typed server-only runtime config와 rotation test, generationEvidence/deliverables 불변, authenticated signed envelope, canonicalWorkpackRevision, localePayloadDigest, readiness, allowlisted locale parser, channel configuration v2 monotonic revision/HMAC identity, access_policy.dispatchBinding atomic insert/reload, 모든 server freshness value exact compare가 GREEN입니다. invalid pre-session locale/translation은 session=0/dispatch=0이고 post-session mismatch는 session=created/provider dispatch=0/log insert=0입니다. UI component 구현에 의존하지 않습니다.

Rollback: git revert <wave-1-sha>. DB row나 다른 workstream commit을 되돌리지 않습니다.

### Wave 2. Return Resolver, Share IA, And Owner Routes

Exact files:

- app/workspace/page.tsx
- components/SafeGuardCommandCenter.tsx
- lib/workspace-pages.ts
- components/WorkflowSharePolicy.ts
- lib/workflow-share-client.ts
- components/WorkflowSharePanel.tsx
- components/FieldOperationsWorkspace.tsx
- components/CurrentWorkpackModules.tsx
- app/workers/page.tsx
- app/settings/page.tsx
- lib/module-navigation.ts
- components/WorkflowSharePanel.module.css
- tests/workspace-pages.test.ts
- tests/workflow-share-client.test.ts
- tests/workflow-share-panel-behavior.test.ts
- tests/workspace-workers.test.ts
- tests/frontend-shared-surfaces.test.ts
- tests/product-module-shell.test.ts
- tests/documents-editor-layout.test.ts

~~~powershell
npm.cmd test -- tests/workspace-pages.test.ts tests/workflow-share-client.test.ts tests/workflow-share-panel-behavior.test.ts tests/workspace-workers.test.ts tests/frontend-shared-surfaces.test.ts tests/product-module-shell.test.ts tests/documents-editor-layout.test.ts --maxWorkers=1 --no-file-parallelism
npm.cmd run typecheck
git diff --check
~~~

Exit: committed Wave 1 authority API를 사용해 revalidation precedence, exact split locale CTA/owner routes, target->channel->localized preview->one CTA, Share worker mutation 0, no history/improvement panel, no chip wall, no nested scroll이 GREEN입니다. 이 wave는 Wave 1 server files를 수정하지 않습니다.

Rollback: git revert <wave-2-sha>. Wave 1 authority와 /workers roster, 기존 storage/dispatch API를 되돌리지 않습니다.

### Wave 3. Real Browser Gate

Required exact files:

- tests/workpack-share-v2-browser.test.ts (new)
- tests/fixtures/workpack-share-v2.ts (new)

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

Exit: 128개 Chromium case, 12-language auto/manual localization과 channel authority, request order/payload, stage-specific CTA routing, normal task distance, executable computed_text_200 reflow, complete geometry coverage가 GREEN입니다.

Authority assertion이 실패하면 Wave 3에서 server file을 고치지 않고 Wave 1을 다시 엽니다. UI geometry/semantics failure만 conditional fix files에서 수정합니다.

Rollback: git revert <wave-3-sha>. 실제 provider와 DB mutation rollback은 없습니다.

Wave 공통 규칙:

- 시작 전 clean status를 확인합니다.
- 각 wave는 한 commit입니다.
- Wave 1 -> Wave 2 -> Wave 3 순서를 강제하며 뒤 wave는 앞 wave의 GREEN commit을 parent로 사용합니다.
- exactFiles ownership은 wave 간 중복 0이어야 합니다. browser conditional fix만 Wave 2 UI file을 다시 열 수 있습니다.
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
| 작업자 언어 blocker | 작업자 언어 정보가 올바르지 않습니다. 작업자 화면에서 언어를 확인합니다. |
| 작업자 언어 CTA | 작업자 언어 확인 |
| 번역 blocker | 검토된 {language} 전송본이 필요합니다. 번역본을 보완한 뒤 돌아옵니다. |
| 번역 미완료 CTA | 번역본 보완 |
| Revalidation | 문서팩이 변경되어 다시 검수해야 합니다. |
| Session 실패 | 초대 세션을 만들지 못해 전송을 시작하지 않았습니다. |
| Session 실패 CTA | 초대 세션 다시 시도 |
| Accepted + log | 선택한 채널이 전송 요청을 접수했습니다. 전달 여부는 전파 이력에서 확인합니다. |
| Partial | 일부 채널은 요청을 접수했고 일부는 실패하거나 결과를 확인하지 못했습니다. |
| Unknown + no log | 전송 결과를 확정하지 못했습니다. 자동으로 다시 보내지 말고 중복 전송 방지 안내를 확인합니다. |
| Stale | 문서팩 또는 오늘 참여자 정보가 변경되어 다시 확인해야 합니다. |

저장 성공을 법적 증빙, 접수 성공을 전달 또는 열람 완료, 부분 번역을 번역 완료로 표현하지 않습니다.
제품 런타임은 기존 session/log storage API를 사용하지만 이 revision은 호출하거나 저장 구조를 바꾸지 않습니다.

## 9. Executable Structural MD/JSON Parity

`evaluation/workpack-share-v2-2026-07-13/validate-spec.cjs`가 유일한 parity validator입니다. validator는 embedded JSON, 전체 Markdown hash, `parityManifest`, `normativeParity`를 authority로 사용하지 않습니다. 실제 Markdown front matter, section heading, route/state/blocker/failure/fixture/environment table, TypeScript type/union, authority/fallback 문장, language/script/surface/geometry invariant table, Wave heading/order/exact file list를 구조적으로 파싱해 spec.json의 해당 계약과 비교합니다. 추가로 사람용 table에서 독립적으로 도출한 요구사항을 유지한 채 두 normative executable code block 전체를 CRLF->LF 정규화 SHA-256으로 결속하므로 code 내부의 ancestor traversal, DSF, nested-scroll, fresh-DOM, language loop 또는 CTA 한 줄 변경도 실패합니다.

TDD contract:

1. RED source `69a022ac2a03ed509022d12d219b1483c9d0cbe7`의 embedded validator false-green count는 아래 original mutation list length에서 13으로 도출하며, 과거 prose의 12는 오기입니다.
2. RED source `8804e33421d4b7ea75dd32022acf728f7adb5c43`에서 reviewer attack harness의 semantic Markdown 12개와 evidence 1개가 모두 exit 0으로 false-green임을 먼저 관찰했습니다.
3. GREEN candidate의 full matrix는 surface omission과 expected-count 약화까지 추가한 semantic Markdown 19개와 evidence 1개를 포함하며, 모든 MD/JSON/evidence mutation은 원본 file을 쓰지 않는 memory copy에서 exit 1이어야 합니다.
4. 사람용 invariant/language/coverage table은 JSON 의미 모델과 비교하고, accessibility/geometry 및 language normative code block 전체는 CRLF를 LF로 정규화한 SHA-256으로 결속합니다. token presence만으로 승인하지 않습니다.
5. computed text와 complete geometry positive는 각각 fresh fixture 두 개에서 exit 0이어야 하고, zoom 6개와 geometry 2개 negative fixture는 각각 exit 1이어야 합니다.
6. REFACTOR 뒤 JSON parse, exact commit scope, source/candidate parent, evidence-only parent와 changedFiles exact diff-tree, git diff --check를 다시 검사합니다.

Original MD-only mutation modes:

- revision
- authority
- wave_heading
- wave_order
- route
- state
- blocker
- channel
- language
- fixture
- one_send_job
- locale_fallback
- evidence_binding

Semantic MD-only mutation modes:

- ancestor_traversal_removed
- device_scale_factor_2
- nested_scroll_inverted
- fresh_dom_once
- unknown_locale_cta_parameterized
- language_matrix_single
- non_target_hangul_allowed
- auto_selection_client_authority
- manual_override_dispatch_authority
- emoji_only_semantics
- manual_language_matrix_single
- language_title_omitted
- language_metadata_labels_omitted
- language_metadata_values_omitted
- language_body_omitted
- invalid_locale_session_allowed
- geometry_marker_removal
- geometry_partial_marker
- geometry_expected_counts_empty

Language contract mutation subset:

- unknown_locale_cta_parameterized
- language_matrix_single
- non_target_hangul_allowed
- auto_selection_client_authority
- manual_override_dispatch_authority
- emoji_only_semantics
- manual_language_matrix_single
- language_title_omitted
- language_metadata_labels_omitted
- language_metadata_values_omitted
- language_body_omitted
- invalid_locale_session_allowed

JSON-only mutation modes:

- revision
- authority
- wave_order
- route
- state
- blocker
- channel
- language
- fixture
- one_send_job
- locale_fallback
- evidence_binding
- zoom_ancestor
- zoom_device_scale_factor
- zoom_nested_scroll
- zoom_fresh_dom
- language_auto_count
- language_manual_count
- language_surface
- language_hangul
- language_manual_authority
- language_invalid_cta
- language_emoji
- geometry_coverage
- geometry_regions
- geometry_expected_counts
- accessibility_executable_hash
- language_executable_hash

Evidence mutation modes:

- contradictory_changed_files

Zoom contract modes:

- positive_twice
- internal_wrapper_transform
- internal_zoom
- outer_transform
- repeated_evaluation
- device_scale_factor
- page_zoom

Geometry coverage modes:

- positive_twice
- marker_removal
- partial_marker

Candidate 전에는 evidence chain만 건너뛰고 구조 계약을 실행합니다.

~~~powershell
node evaluation/workpack-share-v2-2026-07-13/validate-spec.cjs --skip-evidence
~~~

Evidence-only commit 뒤 최종 정상 명령은 두 번 실행합니다.

~~~powershell
node evaluation/workpack-share-v2-2026-07-13/validate-spec.cjs
~~~

각 mutation과 negative fixture는 다음 형태로 실행하고 Node exit code가 정확히 1인지 wrapper가 확인합니다.

~~~powershell
node evaluation/workpack-share-v2-2026-07-13/validate-spec.cjs --md-mutation revision
node evaluation/workpack-share-v2-2026-07-13/validate-spec.cjs --json-mutation revision
node evaluation/workpack-share-v2-2026-07-13/validate-spec.cjs --evidence-mutation contradictory_changed_files
node evaluation/workpack-share-v2-2026-07-13/validate-spec.cjs --zoom-fixture internal_wrapper_transform
node evaluation/workpack-share-v2-2026-07-13/validate-spec.cjs --geometry-fixture marker_removal
~~~

Completion gate:

- spec.json과 review-evidence.json JSON parse
- structural validator normal 2회 exit 0
- MD-only mutation 32개 각각 2회 exit 1
- JSON-only mutation 28개 각각 2회 exit 1
- evidence mutation 1개 각각 2회 exit 1
- language contract mutation subset 12개 각각 2회 exit 1
- zoom positive_twice 2회 exit 0
- zoom negative fixture 6개 각각 2회 exit 1
- geometry positive_twice 2회 exit 0
- geometry negative fixture 2개 각각 2회 exit 1
- candidate direct parent = full sourceBase SHA
- candidate changed files = spec.md, spec.json, validate-spec.cjs
- evidence-only HEAD direct parent = candidate
- evidence-only changed file = review-evidence.json
- evidence manifest는 evidence commit SHA를 기록하지 않으므로 self-reference 없음
- git pull --rebase, push, remote SHA match, clean worktree
- 128은 4 environment x 16 fixture x 2 zoom mode 산술 계약이며 spec-only validator는 browser case 실행을 주장하지 않음
- final status는 fresh independent review 전까지 HOLD_PENDING_FRESH_REVIEW
