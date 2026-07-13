# SafeClaw 공유 화면 v2 제품 명세

- Spec ID: workpack-share-v2-2026-07-13
- Revision: independent-review-remediation-8
- 상태: SPEC_REVIEW_ONLY
- Implementation status: IMPLEMENTATION_BLOCKED
- Browser/TDD status: IMPLEMENTATION_BLOCKED_PENDING_REAL_TDD
- Browser executions: 0
- Review status: pending
- 기준 branch: feat/workpack-share-v2
- Source base: 1d4938675cee330dd7bfa1cdb040b27bf24fceba
- Candidate evidence: evaluation/workpack-share-v2-2026-07-13/review-evidence.json의 full candidate SHA
- Review claim: 구조와 identity만 검증했습니다. semantic PASS, implementation-ready, browser PASS claim은 없으며 fresh independent review는 pending입니다.
- 쓰기 범위: spec candidate commit은 evaluation/workpack-share-v2-2026-07-13/spec.md, spec.json, validate-spec.cjs만, 후속 evidence-only commit은 review-evidence.json만 수정합니다.
- 제품 Job: 오늘 문서팩을 선택된 오늘 참여자에게 보냅니다.
- 화면 순서: 대상 -> 채널 -> 현지화 미리보기 -> 전송
- 구현 상태: 이 revision은 명세만 수정합니다. 제품 코드, 테스트, DB, CSS, package, lock을 수정하거나 구현을 시작하지 않습니다. 실제 Playwright RED와 fresh independent review 전에는 어떤 implementation wave도 시작할 수 없습니다.

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
| browser handoff d3ad865 | 베트남어 선택에서 본문 3줄만 번역되고 `[SafeClaw 베트남어 안전공지]`, 현장, 작업, 핵심 위험 label/value가 한국어로 남았습니다. | 부분 번역이며 ready가 아닙니다. 전체 locale completeness가 충족될 때까지 review_required, session=0, dispatch=0입니다. |
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

| Order | Section ID | Role | Content | Action node ID |
|---:|---|---|---|---|
| 1 | workpack_status | status | 문서팩 이름과 readiness 한 줄 | document_link |
| 2 | target | target_summary | 오늘 참여자 N명과 최대 3명 이름 | target_owner_link |
| 3 | channel | channel_selection | 메일, 문자, 승인된 카카오 선택과 수신 가능 수 | channel_controls |
| 4 | localized_preview | localized_preview | 자동 해석 언어, option 12개 dropdown, 검토 artifact 미리보기 | language_dropdown |
| 5 | operator_note | optional_input | 선택 전달 메모 | operator_note_input |
| 6 | result_strip | result_status | accepted, failed, unknown 채널/request 요약 | history_link |
| 7 | primary_action | primary_action | 현재 state의 primary 하나 | primary_send |

CTA inventory:

| Action node ID | Section ID | Kind | Send capable | Maximum visible count |
|---|---|---|---:|---:|
| document_link | workpack_status | secondary_navigation | no | 1 |
| target_owner_link | target | secondary_navigation | no | 1 |
| channel_controls | channel | selection_control | no | 1 |
| language_dropdown | localized_preview | preview_control | no | 1 |
| operator_note_input | operator_note | input_control | no | 1 |
| history_link | result_strip | conditional_navigation | no | 1 |
| primary_send | primary_action | primary_send | yes | 1 |

Share body에는 번호 장식, worker form, quick add, worker drawer, channel setup, 공개 링크 생성, 중복 CTA, confirmation modal, 내부 preview scroll을 두지 않습니다.
SafeGuardCommandCenter가 화면 제목 하나를 소유하고 WorkflowSharePanel은 제목, 로그인 prompt, preview를 반복하지 않습니다. [data-share-preview]는 하나이며 logged_out도 하단 primary 외 로그인 CTA를 만들지 않습니다.
1440px에서는 하나의 reading column을 사용하고 내용 없는 두 번째 grid track을 만들지 않습니다.

### 2.2 Route Ownership

| ID | Purpose | Owner route | Return path | Exclusion semantics |
|---|---|---|---|---|
| R1 | roster registration, update, and quick add | /workers | /workers?next={encoded shareReturn} | Share is read-only; roster and quick-add mutation requests are 0 |
| R2 | today participant snapshot selection | /workspace?step=input, /workers | /workers?next={encoded shareReturn} | Share does not mutate or persist the participant snapshot |
| R3 | current workpack send orchestration | /workspace?step=share | /workspace?step=share&theme={theme} | only the single session-then-dispatch action is send-capable |
| R4 | localization generation, edit, review, and signed persistence | document-editor:foreignWorkerTransmission, /api/workpacks/{id}/localized-dispatch-artifacts/{locale}/review | /workspace?step=document&document=foreignWorkerTransmission&language={validatedSupportedCode}&returnStep=share&theme={theme} | Share cannot generate, edit, approve, sign, or persist localization |
| R5 | email, sms, and kakao configuration, approval, and availability | /settings, /api/settings/channels/resolve | /settings?next={encoded shareReturn} | Share exposes no secret, channel setup, template approval, or sender input |
| R6 | organization reporting recipient group | /settings | /settings?next={encoded shareReturn} | reporting recipients never change worker count or own the send primary |
| R7 | dispatch request and channel results | /dispatch | /dispatch | Share shows only a compact result strip and links only with persisted log IDs |
| R8 | session, save, and read history | /archive | /archive | Share contains no session, save, or full-history panel |
| R9 | Before/After improvement history | /reports, /archive | not_available_from_share_body | improvement and history panels are excluded from Share |
| R10 | login and canonical return | /login, /auth/callback, /workspace | /login?next={encoded shareReturn} | unvalidated next, step, document, language, or returnStep is forbidden |
| R11 | invitation access policy | share-session API, /settings policy | /settings?next={encoded shareReturn} | no public link or worker provisioning; compact policy info only |

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

Dispatch channel catalog:

| Channel ID | Owner | Share contract |
|---|---|---|
| email | Settings and server resolver | resolved availability only |
| sms | Settings and server resolver | resolved availability only |
| kakao | Settings, approval state, and server resolver | approved resolved availability only |

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

| 항목 | Planned acceptance |
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

구현 후 각 browser case는 normal_100과 computed_text_200 두 mode로 실행해야 합니다. canonical application tokens가 fixed px이므로 root font 변경은 delivery로 인정하지 않습니다. computed_text_200은 모든 representative node의 100% computed font-size와 line-height를 어떠한 mutation보다 먼저 immutable baseline으로 캡처하고, 각 node에 그 baseline의 정확히 2배를 한 번만 적용해 layout reflow를 일으켜야 합니다. 조상을 먼저 변경한 뒤 descendant computed style을 읽는 순차 scaling은 금지합니다.

Planned browser requirement table (human normative, unexecuted):

| Requirement ID | Normative value | Current evidence |
|---|---|---|
| representative_source | complete derived visible text-leaf owners plus visible interactables with rendered text | browser execution 0 |
| immutable_baseline | capture every representative computed font-size and numeric line-height before any mutation | browser execution 0 |
| text_scaling | apply each representative's immutable baseline exactly once; every font-size and line-height ratio is 1.9..2.1 | browser execution 0 |
| ancestor_inspection | inspect each representative itself and every internal/outer ancestor through documentElement | browser execution 0 |
| prohibited_delivery | root-font-only change, CSS transform, CSS zoom, device/page/browser scale, viewport change, and screenshot scale | browser execution 0 |
| scale_invariants | deviceScaleFactor=1, devicePixelRatio=1, visualViewport.scale=1, configured CSS viewport exact | browser execution 0 |
| reflow | at least one real localized preview text leaf has increased line count and rendered height | browser execution 0 |
| fresh_dom_runs | run each genuine case twice from two fresh production fixture DOMs; same-DOM cumulative evaluation is forbidden | browser execution 0 |
| viewport_matrix | Day/Night at 1440x1000 and 391x844 | browser execution 0 |
| scroll_regions | exactly one body region root and one preview region root | browser execution 0 |
| browser_execution_count | 0 | IMPLEMENTATION_BLOCKED_PENDING_REAL_TDD |

Geometry coverage table:

| Coverage set | Derived source | Required implementation expectation |
|---|---|---|
| visibleElements | literal census `[root, ...root.querySelectorAll("*")]` filtered to rendered visible boxes | non-empty exact fixture count declared before render |
| interactables | every visible native or ARIA interactive element derived from visibleElements | non-empty exact fixture count |
| textLeaves | every non-empty visible DOM Text node, deduplicated to its owning HTMLElement | non-empty exact fixture count |
| ownerMappings | every visibleElements entry resolved through nearest mandatory data-share-owner | count equals visibleElements and owner is allowlisted |
| scrollRegionMappings | every visibleElements entry resolved through nearest mandatory data-share-scroll-region | every visible element belongs to exactly one body or preview region |

The future browser census must begin with the literal `[root, ...root.querySelectorAll("*")]` construction. `querySelectorAll("*")` supplies descendants only, the explicit first item supplies the share root, and the test must fail unless identity deduplication proves the root occurs exactly once. An empty visible census is a failure, and rendered DOM results may never be used to invent or update expected counts.

Exactly one body scroll-region root and one preview scroll-region root are required. Every visible element must resolve to exactly one nearest region owner: the share root and visible nodes outside the preview subtree belong to `body`; the preview root and its visible subtree belong to `preview`. A preview descendant cannot also be counted as body-owned. The document is the sole vertical scroll owner; either region becoming an independent vertical scroll container is a failure.

Geometry failure categories:

| Category ID | Human normative failure condition | Required future browser result |
|---|---|---|
| empty_census | complete visible census has zero entries or any required derived set has no expected positive count | fail |
| unmapped_owner | any relevant visible element lacks an allowlisted owner or exactly one scroll-region mapping | fail |
| overlap | non-contained visible text/interactable collision has positive unintended overlap | fail |
| cross_parent_overlap | visible nodes under different parent owners collide after containment normalization | fail |
| text_clipping | a complete text leaf is clipped by its own box | fail |
| clipping_ancestor | any internal or outer ancestor clips a representative text leaf | fail |
| nested_scroll | body or preview becomes an independent vertical scroll container | fail |
| horizontal_overflow | document or share root has horizontal overflow | fail |
| fixed_obstruction | fixed content obscures preceding or following content or the primary action | fail |
| sticky_obstruction | sticky content obscures preceding or following content or the primary action | fail |

Additional planned browser requirements:

- Derived representatives do not depend on optional font, overlap, or reflow markers.
- A real localized text leaf under the `preview-body` owner must prove wrapping and height growth; no test-only probe is inserted.
- Every baseline must be a finite positive pixel value. A computed `line-height: normal` is a failure until product CSS supplies a measurable line-height.
- The upper ratio bound blocks cumulative 4x or 8x scaling.
- Each viewport is fixed before measurement and is unchanged throughout the mode.
- Production fixture routes and actions establish state before text scaling; fonts and layout settling are awaited by the future Playwright test.
- At 200%, fixed page-height and task-distance ceilings do not apply.
- All representatives satisfy the 1.9..2.1 font-size and line-height ratios.
- At least one representative has increased line count and rendered height.
- Unintended overlap, text clipping, horizontal overflow, nested vertical scroll, fixed obstruction, and sticky obstruction are all zero.
- Interactive targets remain at least 44x44 CSS px.
- Target -> channel -> preview -> memo -> primary DOM and focus order remains intact.
- Preview expansion and primary action remain keyboard operable.

These are human normative requirements, not pseudo-code and not execution evidence. This revision ran zero browser cases. Actual acceptance requires implementation-time Playwright tests in `tests/workpack-share-v2-browser.test.ts`, two fresh-DOM runs, the full 128-case matrix, and fresh independent review.

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

## 6. Planned Real Browser Acceptance Matrix (Unexecuted)

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
| computed_text_200 | future Playwright test applies each representative's immutable computed application font-size/line-height baseline at 2x | no |

Planned case ID는 {envId}:{fixtureId}:{zoomId}이며 구현 후 모든 fixture를 두 zoom mode에서 실행해야 합니다. 이 revision의 실제 browser 실행은 0입니다.

### 6.2 Fixture Ingress Contract

구현 시 모든 fixture는 tests/helpers/isolated-next-browser-harness.ts와 Playwright Chromium을 사용해야 합니다.

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

| Fixture ID | Production resolver input/action | Planned result |
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

미래의 실제 browser test는 request log를 수집해 다음을 검사해야 합니다. 아래 항목은 계획된 acceptance이며 이 revision에서 실행되지 않았습니다.

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
26. server authority auto loop는 12개 SupportedLanguageCode를 각각 선택하고 title, site, task, core-risk, body, action과 그 metadata label/value를 렌더링해 language policy와 non-ko Korean residual 0을 검사합니다.
27. manual loop도 12개 option을 각각 실제 선택하고 같은 completeness surface를 검사하되 recipient language, dispatch language와 DispatchPlan digest는 바뀌지 않습니다.
28. invalid locale CTA는 exact static workers owner route이며 raw locale와 language query 보간 0, share-session/dispatch 0입니다.
29. geometry는 share root의 complete visibleElements/interactables/textLeaves를 도출해 static exact positive counts, owner mapping, body/preview mapping과 각각 한 region root를 검사합니다. 누락 또는 부분 mapping은 실패합니다.
30. fixture별 meaning owner는 localized visible text와 accessible name을 가지며 ⚠️, 🧱, 🌬️, 🚧 emoji는 장식 전용이고 유일한 의미가 될 수 없습니다.

### 6.5 All-Language Browser Requirements (Unexecuted)

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

Locale completeness surface inventory:

| Completeness surface ID | Required localized content | Korean residue for non-ko target | Missing/partial result |
|---|---|---:|---|
| title | full outbound title and subject | 0 | review_required; session 0; dispatch 0 |
| site | site metadata label and value | 0 | review_required; session 0; dispatch 0 |
| task | task metadata label and value | 0 | review_required; session 0; dispatch 0 |
| coreRisk | core-risk metadata label and value | 0 | review_required; session 0; dispatch 0 |
| body | every outbound body line | 0 | review_required; session 0; dispatch 0 |
| action | visible action label and accessible action name | 0 | review_required; session 0; dispatch 0 |

Language authority cases:

| Case ID | Preview authority | Dispatch authority | Required result |
|---|---|---|---|
| auto_all_languages | server allowlisted recipient locale | same server locale | all 12 selected and rendered; localized surface contract; non-ko Hangul residual 0 |
| manual_all_languages | operator dropdown preview override | original server auto locale and unchanged DispatchPlan digest | all 12 manually selected and rendered; no recipient or dispatch mutation |
| invalid_locale | none | none | review_required; exact static workers owner CTA; no language query/raw interpolation; session 0; dispatch 0 |
| semantic_meaning | localized visible text | not applicable | accessible icon plus visible text or visible text-only; emoji is never sole meaning |

Default language UI contract:

| Control ID | Visible count | Authority | Required behavior |
|---|---:|---|---|
| autoSelection | 1 | allowlisted server recipient locale | selects the initial localized preview |
| manualDropdown | 1 | operator preview override only | contains all 12 locale options without changing dispatch authority |
| localizedPreview | 1 | selected auto or manual preview locale | renders one complete selected-language artifact |
| languageCardGrid | 0 | none | no per-language card, button wall, or parallel preview |

Decorative emoji semantics:

| Symbol | Allowed role | Required semantic presentation | Accessibility contract |
|---|---|---|---|
| ⚠️ | decorative only | standard warning icon plus localized visible text | emoji aria-hidden; icon has localized accessible label matching the visible meaning |
| 🧱 | decorative only | standard barrier icon plus localized visible text | emoji aria-hidden; icon has localized accessible label matching the visible meaning |
| 🌬️ | decorative only | standard ventilation icon plus localized visible text | emoji aria-hidden; icon has localized accessible label matching the visible meaning |
| 🚧 | decorative only | standard work-zone icon plus localized visible text | emoji aria-hidden; icon has localized accessible label matching the visible meaning |

Neutral identifiers are only URL/email, ASCII uppercase/digit IDs, dates, times and punctuation tokens listed in the reviewed language policy. They do not permit arbitrary fallback prose. Every non-`ko` title, metadata label, metadata value and body has Hangul residual count 0. Vietnamese retains the stricter named title/site/task/core-risk/body residual-0 assertions from the reviewed artifact contract.

No executable example is normative in this section. A future implementation must exercise all language rows with real Playwright selection and rendered-DOM assertions; this spec records zero browser executions.

- dropdown은 하나이고 option 순서는 ko, vi, zh, th, uz, mn, ne, km, id, my, tl, en입니다.
- allowlisted server parser가 auto-resolved recipient/dispatch language를 결정하고, manual dropdown은 preview만 바꿉니다.
- preview override 전후 recipient language, dispatch language와 DispatchPlan digest는 같습니다.
- Vietnamese title/subject, site label/value, task label/value, core-risk label/value, body 전체의 Korean residual count는 각각 0입니다.
- 선택한 모든 non-`ko` 전송본은 title, site, task, core-risk, body, action 전체에서 한국어 metadata label과 한국어 value 잔존이 0이어야 합니다.
- Korean-only non-ko title/site/task/core-risk/body value가 없습니다.
- structural emoji가 outbound artifact에 없고, 모든 상태/위험 의미는 accessible icon+visible text 또는 visible text-only입니다. icon-only와 emoji-only meaning count는 0입니다.
- provenance, reviewer, reviewedAt, generationRevision, sourceDocumentDigest, artifactRevision, artifactDigest, signature를 검사합니다.
- body 3줄만 바꾼 artifact, 영어 fallback, unknown/malformed locale fallback은 review_required이며 share-session/dispatch count는 0입니다.
- 12개 언어 auto fixture와 12개 manual selection 모두 같은 artifact completeness와 surface contract를 통과해야 합니다.

실제 signing secret, provider credential, provider call, Supabase insert/update/delete는 browser gate에서 사용하지 않습니다.

## 7. Implementation Waves

모든 implementation wave는 export, ontology, KOSHA, document-editor workstream이 통합된 FINAL_INTEGRATED_SHA에서 새 branch와 새 worktree를 만든 뒤에만 시작합니다. 이 spec branch에서 구현하지 않습니다.

현재 gate는 `IMPLEMENTATION_BLOCKED_PENDING_REAL_TDD`입니다. fresh independent spec review가 이 human normative contract를 승인하고, 구현 branch에서 실제 Playwright RED를 먼저 관찰하기 전에는 Wave 0을 포함한 어떤 implementation wave도 시작할 수 없습니다. spec validator 결과는 이 gate를 해제하지 않습니다.

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

Exit: 실제 Playwright가 128개 Chromium case를 실행해 12-language auto/manual localization과 channel authority, request order/payload, stage-specific CTA routing, normal task distance, computed_text_200 real reflow, complete geometry coverage를 모두 만족한 실행 증거를 남기고 fresh independent implementation review를 받습니다.

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

## 9. Spec-Only Structural Verification

`evaluation/workpack-share-v2-2026-07-13/validate-spec.cjs` is a deliberately narrow spec-review tool. It may establish only the following facts:

| Validator concern | Allowed assertion |
|---|---|
| candidate/evidence identity | full source and candidate SHAs resolve, candidate parent is source, evidence parent is candidate, and actual diff-tree scope is exact |
| JSON structure | required objects, fields, types, non-empty contract arrays, exact enum members, counts, and arithmetic relationships are present |
| human Markdown structure | front metadata, required headings, table row identities, exact counts, and selected scalar values agree with JSON |
| browser semantics | not evaluated; browser executions remain 0 |
| implementation readiness | blocked; validator cannot release the implementation gate |
| review outcome | SPEC_REVIEW_ONLY; fresh independent manual review remains required |

The validator must not treat embedded mirrors, prose-authored code, hashes of code blocks, token presence, or synthetic geometry/zoom models as semantic authority. It does not execute application code, a browser, Playwright, DOM measurement, language rendering, provider calls, or database operations. It must never emit an implementation-ready or browser-pass claim.

Structural Markdown parity must derive data from the actual human sections and tables: revision/status metadata; every route ID, purpose, owner route, return path, and exclusion semantic; every screen section and CTA inventory row; state and blocker catalogs; channels; runtime configuration; supported-language policy; localized surfaces; language authority; accessibility requirements; geometry sets and failure categories; environments; zoom modes; fixtures; validation command rows; and Wave heading/order/exact-file ownership. A duplicated embedded metadata object is not evidence.

The full JSON structural schema must reject missing or empty required contract collections. In particular it requires all 11 complete route rows; the exact seven section IDs/orders/roles/action-node references; the exact CTA inventory with one send-capable primary and zero secondary or duplicate send actions; all 12 supported languages and both auto/manual authority contracts; the four structural localized groups and the exact title/site/task/core-risk/body/action completeness inventory; zero Korean metadata labels and values for every non-ko target; the static invalid-locale CTA and zero session/dispatch fallback rule; the exact ⚠️/🧱/🌬️/🚧 decorative inventory with standard icon, localized text, and accessible-label semantics; all geometry failure categories; the explicit root-once census and body/preview ownership rules; all runtime configuration keys and rotation fields; all fail-closed blockers; 4 environments, 16 fixtures, 2 zoom modes, and 128 planned cases; and browser execution count 0.

Documented validation command contract:

| Command ID | Executable token | Argument tokens | Stage | Required runs |
|---|---|---|---|---:|
| candidate_structure | node | evaluation/workpack-share-v2-2026-07-13/validate-spec.cjs --skip-evidence | candidate before evidence | 2 |
| evidence_identity | node | evaluation/workpack-share-v2-2026-07-13/validate-spec.cjs | evidence child | 2 |
| markdown_mutation | node | evaluation/workpack-share-v2-2026-07-13/validate-spec.cjs --skip-evidence --md-mutation {allowlistedMode} | candidate mutation matrix | 2 each |
| json_mutation | node | evaluation/workpack-share-v2-2026-07-13/validate-spec.cjs --skip-evidence --json-mutation {allowlistedMode} | candidate mutation matrix | 2 each |
| identity_mutation | node | evaluation/workpack-share-v2-2026-07-13/validate-spec.cjs --identity-mutation {allowlistedMode} | evidence mutation matrix | 2 each |
| validator_syntax | node | --check evaluation/workpack-share-v2-2026-07-13/validate-spec.cjs | final static check | 1 |

The validator compares these rows with a fixed internal token-and-argument allowlist. It never passes Markdown or JSON command text to a shell or process API. `Write-Output`, shell builtins, separators, redirections, substituted executables, extra arguments, and arbitrary spec-authored text are not allowed command identities.

Review attack TDD record:

| Attack ID | Reviewed candidate | Observed baseline exit | Required remediated exit |
|---|---|---:|---:|
| md_route_owner | 0c6603adf7159dc98df6b6b365d3a03cddb65be1 | 0 | 1 |
| json_route_owner | 0c6603adf7159dc98df6b6b365d3a03cddb65be1 | 0 | 1 |
| secondary_send_injection | 0c6603adf7159dc98df6b6b365d3a03cddb65be1 | 0 | 1 |
| forged_validation_command | 0c6603adf7159dc98df6b6b365d3a03cddb65be1 | 0 | 1 |

Structural Markdown mutation modes:

- revision
- review_status
- implementation_status
- browser_status
- route_row
- state_row
- blocker_row
- channel_row
- language_row
- localized_surface
- invalid_locale
- emoji_semantics
- geometry_category
- scroll_root
- runtime_config
- one_send_job
- wave_order
- planned_case_count
- handoff_observation
- locale_completeness
- emoji_inventory
- default_language_ui
- route_owner
- screen_section_relabel
- documented_command_forgery

Structural JSON mutation modes:

- missing_status
- missing_implementation_status
- missing_browser_status
- empty_languages
- missing_auto_contract
- missing_manual_contract
- empty_localized_surfaces
- invalid_cta_interpolation
- emoji_semantics
- empty_geometry_categories
- missing_geometry_category
- empty_runtime_config
- missing_rotation
- multi_send_job
- empty_blockers
- planned_case_count
- browser_execution_nonzero
- implementation_unblocked
- empty_locale_completeness
- empty_emoji_inventory
- fallback_unblocked
- default_language_ui
- route_owner
- screen_section_injection
- screen_section_relabel
- screen_section_removal
- cta_inventory_injection
- command_identity_forgery

Identity mutation modes:

- contradictory_changed_files
- candidate_parent
- candidate_scope
- browser_executed_claim
- semantic_pass_claim
- evidence_command_forgery

The validator derives each mutation count from its own exported mode array and compares it with the corresponding JSON count. Every listed mutation operates on an in-memory copy and must exit 1 without modifying the source files. There are no zoom-positive, geometry-positive, or synthetic browser fixture commands.

Candidate preparation uses the `candidate_structure` command identity twice. After the evidence-only child commit, `evidence_identity` runs twice. Every structural Markdown, structural JSON, and identity mutation uses only its corresponding allowlisted command identity and runs twice per mode. JSON parse, Node syntax check, `git diff --check`, exact candidate/evidence scope, pull --rebase, remote SHA equality, and clean worktree are separate delivery checks.

The evidence manifest proves only source/candidate identity, commit parentage, exact changed-file scopes, and the honest unexecuted state. It contains `SPEC_REVIEW_ONLY`, `IMPLEMENTATION_BLOCKED`, `IMPLEMENTATION_BLOCKED_PENDING_REAL_TDD`, browser executions 0, semantic-pass claim false, implementation-ready claim false, and browser-pass claim false. It never claims its own commit SHA.

Completion of this spec-only verification does not approve implementation. The planned browser arithmetic remains 4 environments x 16 fixtures x 2 zoom modes = 128, while actual browser execution remains 0. The final boundary is `SPEC_REVIEW_ONLY` / `IMPLEMENTATION_BLOCKED` / `IMPLEMENTATION_BLOCKED_PENDING_REAL_TDD` until fresh independent review.
