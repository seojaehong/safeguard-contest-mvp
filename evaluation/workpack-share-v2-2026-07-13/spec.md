# SafeClaw 공유 화면 v2 제품 명세

- Spec ID: `workpack-share-v2-2026-07-13`
- Schema: `safeclaw-workpack-share-v2-product-spec/v1`
- 상태: `implementation-ready`
- 작성 기준 branch: `feat/workpack-share-v2`
- 작성 기준 SHA: `59f48123da62fb405e639da03912aa1ed6c000b9`
- 브라우저 문제 기준 SHA: `d3ad865`
- 제품 Job: **오늘 문서팩을 선택한 사람에게 보냅니다.**
- 화면 순서: **대상 -> 채널 -> 미리보기 -> 전송**
- 구현 전제: 이 명세 branch에서는 제품 코드, 테스트, DB, schema, migration, package, lock을 수정하지 않습니다.

## 1. 결정 요약

1. 공유 화면에는 문서팩 이름과 상태 한 줄, 오늘 대상 요약과 변경, 메일·문자 요약, 자동 언어 결정과 미리보기 dropdown, 선택 전달 메모, 단 하나의 primary action만 남깁니다.
2. 품질 fallback 예시처럼 `canShare=false`인 문서팩은 계속 fail-closed로 처리합니다. blocked 화면은 원인 확인을 위해 열 수 있지만 전송 권한은 열지 않습니다.
3. 작업자 등록과 오늘 참여자 snapshot은 `/workers`와 작업 입력/작업자 화면이 소유합니다. 공유 화면은 선택된 N명에게 보내는 행위만 소유합니다.
4. 관리자와 원청 보고 수신자는 작업자 대상과 섞지 않고 organization recipient group으로 관리합니다. 공유 화면은 해석된 결과만 표시합니다.
5. 12개 언어 기능은 유지하되 칩은 제거합니다. 언어는 작업자 snapshot에서 자동 결정하고 dropdown은 미리보기만 바꿉니다. 미리보기 변경은 실제 수신자의 언어를 덮어쓰지 않습니다.
6. 저장, provenance(출처 이력), 감사 이력, invited-only 세션, dispatch, 멱등 키(idempotency key, 같은 전송 요청의 중복 실행을 막는 키) 계약은 삭제하지 않습니다. 화면 표시와 route 소유권만 옮깁니다.
7. 실제 외부 provider 연동 확대, 실발송 검증, DB mutation, channel 승인, 작업자 계정 생성, 공개 링크는 v2 구현 범위가 아닙니다.

## 2. 근거와 현재 RED

### 2.1 브라우저 근거

| 항목 | 현재 측정값 | v2 판단 |
|---|---:|---|
| Mobile viewport | `391x844` | v2 기준 viewport는 `390x844`로 고정합니다. |
| Share section | `y=300`, `height~=3836px` | 필수 Job 밖 콘텐츠가 누적되어 있습니다. |
| Workflow panel | `height~=3654px` | 대상, 채널, 언어, 로그, 원문이 반복됩니다. |
| Document scroll height | `~4456px` | 모바일 작업 완료까지 지나치게 긴 단일 흐름입니다. |
| 언어 declaration box | `y=2099`, `height=292px` | 실제 컨트롤 범위를 담지 못합니다. |
| 언어 버튼 범위 | `y=2149..2672` | declaration box, invite, memo와 겹칩니다. |
| Invite 시작점 | `y=2403` | 언어 컨트롤과 실제 overlap이 있습니다. |
| Memo 시작점 | `y=2645` | 언어 컨트롤과 실제 overlap이 있습니다. |
| 44px 미만 touch target | `15개` | 전부 제거해야 합니다. |
| Desktop share root | `~968x2331px` | 비대칭 2열과 빈 공간이 있습니다. |
| Desktop document scroll | `~2620px` | 공유 Job만으로는 설명되지 않는 높이입니다. |

### 2.2 코드 근거

| 근거 | 현재 계약 | v2 처리 |
|---|---|---|
| `SafeGuardCommandCenter.tsx:2353+` | 상단 전송 CTA, 권한/참여자/열람/저장, Before/After를 share outer에 둡니다. | 상단 CTA와 부가 섹션을 제거하거나 route로 이동합니다. |
| `WorkflowSharePanel.tsx:1159+` | 제목, 권한 요약, 4단 카드, 12개 언어 UI, 초대, 로그, 미리보기, 복사, 확인 패널을 한 화면에 둡니다. | 대상 -> 채널 -> 미리보기 -> 전송으로 축소합니다. |
| `CurrentWorkpackModules.tsx:1007+` | 작업자 편집이 local worker/dispatch snapshot을 함께 갱신합니다. | today participant snapshot의 source of truth로 재사용합니다. |
| `WorkflowSharePolicy.ts` | target signature, evidence scope reset, invited-only, viewer, anonymous false, expiry, idempotency를 보존합니다. | v2 adapter가 그대로 사용하고 revision/digest를 추가 비교합니다. |
| `app/api/workpacks/[id]/share-sessions/route.ts:80-158`, `lib/workflow-share-client.ts:119-149` | 관리자 인증, session ID, 24시간 expiry는 보장하지만 per-recipient invitation artifact는 반환하지 않습니다. | 서버 서명 artifact가 없으면 fail-closed하고 Wave 2에서 token-gated read-only 계약을 추가합니다. |
| `workpack-readiness.ts` | quality, ontology QA, DB harness, placeholder, 편집 후 재검수로 `canShare`를 닫습니다. | CTA resolver보다 먼저 평가하는 hard gate로 유지합니다. |
| `current-workpack.ts` | `savedAt`, `generationFingerprint`, worker/dispatch snapshot을 localStorage에 보존합니다. | local cache adapter로만 사용하며 서버 권한을 만들지 않습니다. |
| `generation-evidence.ts` | `responseContentDigest`와 HMAC signature를 보존합니다. | workpack digest의 권위 있는 입력으로 사용합니다. |
| `globals.css:14369+` | 2열 shell, 내부 preview/pre 스크롤, 38px 버튼이 있습니다. | 단일 열, document-only scroll, 44px 이상 control로 바꿉니다. |

### 2.3 확인된 제품 모순

- 제목, 로그인 안내, 미리보기, 전송 CTA가 outer와 inner에 중복됩니다.
- outer CTA는 활성처럼 보일 수 있지만 실제 inner CTA는 disabled일 수 있습니다.
- `?theme=` query와 화면 toggle state가 함께 갱신되지 않습니다.
- 실제 예시는 quality fallback으로 `canShare=false`입니다. localStorage를 조작해 화면을 여는 감사 방법은 제품 계약이나 전송 권한이 아닙니다.
- 베트남어 선택 시 본문 3줄만 번역되고 제목, 현장, 작업, 핵심 위험의 라벨과 값은 한국어로 남습니다. 이는 부분 번역이며 완료로 표시하면 안 됩니다.
- `⚠️`, `🧱`, `🌬️`, `🚧` 등 emoji가 구조적 위험 표시를 대신합니다. locale별 텍스트 의미가 없는 장식은 접근 가능한 전송 계약이 아닙니다.

## 3. Current -> Target IA

### 3.1 Target 화면 구조

| 순서 | 영역 ID | 남는 내용 | 허용 상호작용 |
|---:|---|---|---|
| 1 | `workpack_status` | 문서팩 이름과 readiness 상태 한 줄 | 문서 보기 text link만 허용합니다. |
| 2 | `target` | 오늘 대상 N명, 최대 3명 이름 요약, 변경 | 작업자 선택 또는 quick add drawer를 엽니다. |
| 3 | `channel` | 메일 N명, 문자 N명, 보고 그룹 N명, 설정 필요 여부 | 메일/문자만 선택합니다. 설정은 `/settings`로 이동합니다. |
| 4 | `preview` | 자동 결정 언어 요약, 12개 언어 preview dropdown, 구조화된 전송본 | dropdown은 preview만 변경합니다. |
| 5 | `operator_note` | 선택 전달 메모 | 기본 collapsed, 선택 시 입력합니다. |
| 6 | `dispatch_result_strip` | 성공, 일부 완료, 실패, 결과 미확정의 채널별 요약 | 상세 이력은 `/archive` 또는 `/dispatch`로 이동합니다. |
| 7 | `primary_action` | 화면 전체에서 단 하나의 primary action | 상태별 authority resolver만 label과 action을 결정합니다. |

번호 장식, 중첩 카드, 별도 확인 modal, 메시지 복사 primary, 전체 원문 내부 scroll은 두지 않습니다.

### 3.2 Route ownership

| ID | 기능 | Current | Target | Route owner | 보존 계약 |
|---|---|---|---|---|---|
| `R1` | 공유 실행 | `/workspace` share outer와 `/dispatch`에 중복 | `/workspace` share가 현재 문서팩의 실행 화면, `/dispatch`는 운영 내역 | `/workspace` | readiness와 authenticated dispatch를 보존합니다. |
| `R2` | 작업자 등록 | share recipient 영역과 `/workers` 편집이 혼재 | 전체 등록과 수정은 `/workers` | `/workers` | worker server ID와 contact consent를 보존합니다. |
| `R3` | 오늘 참여자 | worker snapshot과 dispatch snapshot이 따로 존재 | 작업 입력/작업자 화면에서 today participant snapshot 생성 | `/workspace`, `/workers` | selected IDs, savedAt, language, contact를 보존합니다. |
| `R4` | 대상 empty | share 안에 긴 inline 입력을 둘 가능성 | 작업자 선택/quick add drawer | `/workers` data, share drawer display | 저장 후 오늘 참여자로 자동 선택합니다. |
| `R5` | 채널 연결 | channel card 안에 설정 설명 | 연결, 승인, 공개 링크 금지는 settings | `/settings` | share에는 resolved availability만 표시합니다. |
| `R6` | 공개 링크와 권한 | share permission grid에 반복 | `/settings` 정책, share info popover, token-gated `/invite/[token]` read-only 열람 | `/settings` policy, `/invite/[token]` recipient access | `shareScope=invited`, `anonymousAllowed=false`, `viewer`, expiry를 보존합니다. |
| `R7` | 관리자/원청 보고 | 메일 helper가 작업자와 보고 수신자를 혼합 | organization recipient group | `/settings` | worker 대상 N명과 별도 집계합니다. |
| `R8` | 전송 로그 | share 안에 4칸 ledger와 결과 | 운영 조회, 재확인, 중복 위험은 dispatch | `/dispatch` | provider 결과, idempotency key, duplicate risk를 보존합니다. |
| `R9` | 저장/열람 이력 | share permission grid와 status grid에 반복 | workpack, session, dispatch, read confirmation 이력 | `/archive` | 기존 저장 row와 audit trail을 삭제하지 않습니다. |
| `R10` | Before/After | share outer 하단 | improvement history와 기간 리포트 | `/reports`, `/archive` | 사진, 메모, 반영 문서, 분석 provenance를 보존합니다. |
| `R11` | 언어 | 12개 chip과 수동 target 선택 | 자동 결정 + 12개 preview dropdown | `/workers` source, share display | preview 변경은 recipient language를 변경하지 않습니다. |
| `R12` | 결과 표시 | toast, result box, ledger에 분산 | compact dispatch result strip 하나 | share display, `/dispatch` detail | copy 결과와 provider 결과를 분리합니다. |

## 4. 상태 기계

### 4.1 평가 우선순위

동시에 여러 조건이 참이면 다음 순서로 한 상태만 노출합니다.

`sending -> success|partial|fail -> stale_revalidation_required -> quality_blocked -> offline -> no_recipients -> logged_out -> selected -> ready`

대상, workpack, source revision, digest가 바뀌면 기존 session/result/log display scope를 먼저 비우고 상태를 다시 계산합니다.

### 4.2 상태 정의

| 상태 ID | 진입 조건 | 화면 계약 | Primary action | 종료 조건 |
|---|---|---|---|---|
| `quality_blocked` | `readiness.canShare=false` | blocker 원인과 문서 복구 경로를 표시합니다. 전송 함수는 호출하지 않습니다. | `문서를 보완합니다` | 재검수 결과 `canShare=true`가 됩니다. |
| `no_recipients` | quality ready, selected count `0` | fake/example 대상 없이 empty copy와 drawer 진입만 표시합니다. | `작업자를 선택합니다` | 한 명 이상 저장하고 오늘 참여자로 선택합니다. |
| `selected` | 대상은 있으나 contact, channel, language, invitation artifact, authority 중 하나가 미완료 | 누락 이유와 번역/초대 검토 필요를 해당 영역 바로 아래에 표시합니다. | 누락 정보에 따라 drawer/settings/session 확인으로 이동하거나 disabled입니다. | 모든 ready guard를 만족합니다. |
| `logged_out` | 대상과 문서가 있으나 관리자 session이 없음 | 저장 연락처 사용과 초대 세션 생성 전에 로그인 필요를 표시합니다. | `로그인하고 계속합니다` | 관리자 session을 확인하고 server ID/revision을 다시 해석합니다. |
| `ready` | quality ready, selected N명, auth, source fresh, channel resolved, 모든 recipient 언어 complete, invitation artifact ready, authority resolvable | 전송 대상, 채널, 언어, 메모, invitation-only를 한 번에 검토합니다. | `선택한 {N}명에게 전송합니다` | 클릭 시 동일 snapshot을 잠그고 `sending`으로 갑니다. |
| `sending` | 전송 attempt가 시작됨 | `saving_workpack`, `creating_session`, `dispatching`, `saving_log` phase를 `aria-live=polite`로 표시합니다. | `전송하고 있습니다` disabled | 한 번의 attempt가 terminal result를 반환합니다. |
| `success` | 모든 요청 채널이 `sent`, validation-only가 아님, duplicate risk 없음 | 전송 건수와 log 저장 상태를 result strip에 표시합니다. 열람 확인과 혼동하지 않습니다. | `전파 이력을 확인합니다` | `/archive` 또는 `/dispatch`로 이동합니다. |
| `partial` | 채널 결과에 `sent`와 `failed|unconfigured|skipped|partial`이 함께 있음 | 완료/미완료 채널을 텍스트로 구분합니다. 전체 재전송을 자동 제안하지 않습니다. | `전파 이력을 확인합니다` | 운영자가 이력에서 채널별 후속 조치를 합니다. |
| `fail` | 전송 시작 전 거부, 모든 채널 실패, provider 결과 미확정 또는 duplicate risk | provider 호출 여부와 재전송 금지 여부를 분리합니다. | `전파 이력을 확인합니다` | 명시적 새 attempt는 이력 확인과 source 재확인 뒤에만 만듭니다. |
| `offline` | `navigator.onLine=false` 또는 provider 미호출 network failure | provider를 호출하지 않았음을 표시합니다. 결과가 미확정이면 `fail`로 분류합니다. | `연결을 다시 확인합니다` | online 확인 뒤 source와 authority를 다시 확인합니다. |
| `stale_revalidation_required` | workpack/participant `sourceRevision` 또는 `digest`가 validated 값과 다름, 또는 편집 후 재검수 필요 | 이전 preview, session, result를 숨기고 변경 범위를 표시합니다. | `다시 검수합니다` | 최신 digest로 quality와 대상 snapshot을 다시 검증합니다. |

### 4.3 핵심 전이

| From | Event | To | 보장 |
|---|---|---|---|
| any non-sending | workpack 또는 target scope 변경 | `stale_revalidation_required` 또는 재평가 상태 | 이전 session/result를 재사용하지 않습니다. |
| `quality_blocked` | revalidation pass | `no_recipients|logged_out|selected|ready` | `canShare=true`를 서버와 클라이언트에서 다시 확인합니다. |
| `no_recipients` | quick add 저장 | `logged_out|selected|ready` | 새 작업자를 오늘 참여자로 자동 선택합니다. |
| `logged_out` | login success | `selected|ready|stale_revalidation_required` | server worker ID와 revision을 새로 해석합니다. |
| `selected` | 모든 guard 충족 | `ready` | preview dropdown 선택은 guard 결과를 바꾸지 않습니다. |
| `ready` | primary click | `sending` | snapshot과 idempotency key를 attempt 단위로 고정합니다. |
| `sending` | all sent | `success` | validation-only 응답은 success로 분류하지 않습니다. |
| `sending` | mixed results | `partial` | 성공 채널을 다시 보내지 않습니다. |
| `sending` | failed 또는 uncertain | `fail` | providerCalled/duplicateRisk가 있으면 자동 retry를 금지합니다. |
| `offline` | reconnect | 재평가 | 바로 전송하지 않고 freshness를 다시 확인합니다. |

## 5. 데이터 계약

### 5.1 Today participant snapshot

```ts
type SupportedLanguageCode =
  | "ko" | "vi" | "zh" | "th" | "uz" | "mn"
  | "ne" | "km" | "id" | "my" | "tl" | "en";

type TodayParticipantSnapshotV2 = {
  version: "today-participant-snapshot/v2";
  snapshotId: string;
  workDate: string; // YYYY-MM-DD
  siteId: string | null;
  source: "workspace" | "workers";
  sourceRevision: string;
  digest: `sha256:${string}`;
  savedAt: string; // RFC3339 offset timestamp
  participants: Array<{
    participantId: string;
    workerId: string | null; // server UUID after authenticated save
    displayName: string;
    role?: string;
    nationality?: string;
    languageCode: SupportedLanguageCode;
    contacts: { email?: string; sms?: string };
    todaySelected: boolean;
  }>;
  selectedParticipantIds: string[];
};
```

- `digest`는 정렬된 participant field와 selected IDs의 canonical JSON을 SHA-256으로 계산합니다.
- quick add 최소 필수값은 표시명, 연락수단 1개, 언어입니다. 역할과 국적은 선택값입니다.
- 저장 성공 후 `todaySelected=true`로 바꾸고 snapshot revision/digest를 새로 만듭니다.
- share는 snapshot을 편집하지 않습니다. drawer는 `/workers` 소유 command를 호출하고 결과 snapshot만 받습니다.

### 5.2 Reporting recipient group

```ts
type ReportingRecipientGroupV1 = {
  version: "reporting-recipient-group/v1";
  groupId: string;
  organizationId: string;
  label: string;
  sourceRevision: string;
  recipients: Array<{
    recipientId: string;
    displayName: string;
    role: "administrator" | "principal_report";
    languageCode: SupportedLanguageCode;
    contacts: { email?: string; sms?: string };
  }>;
  enabledChannels: Array<"email" | "sms">;
};
```

- 작업자 selected N명과 reporting group N명을 합산하지 않습니다.
- 설정, 승인, 개인 추가/삭제는 `/settings`만 소유합니다.
- share에는 `보고 그룹 {N}명`, `미설정`, `채널 설정 필요`의 해석 결과만 표시합니다.
- group이 없다는 이유만으로 작업자 전송을 막지 않습니다.

### 5.3 Channel and language resolution

```ts
type DispatchPlanV2 = {
  version: "dispatch-plan/v2";
  workpackId: string;
  sourceRevision: string;
  workpackDigest: `sha256:${string}`;
  participantSnapshotId: string;
  participantSnapshotDigest: `sha256:${string}`;
  channels: Array<"email" | "sms">;
  deliveries: Array<{
    audience: "worker" | "reporting_group";
    recipientId: string;
    channel: "email" | "sms";
    languageCode: SupportedLanguageCode;
    messageDigest: `sha256:${string}`;
    status: "ready" | "missing_contact" | "channel_unconfigured" | "translation_incomplete" | "invitation_unavailable";
  }>;
};
```

- 작업자 language는 today participant snapshot에서 자동 결정합니다.
- preview dropdown은 `ko, vi, zh, th, uz, mn, ne, km, id, my, tl, en` 12개를 유지합니다.
- dropdown 변경은 `DispatchPlanV2.deliveries[].languageCode`를 변경하지 않습니다.
- 선택된 작업자는 선택한 메일/문자 중 최소 한 채널에 유효한 연락처가 있어야 합니다.
- 미설정 provider와 채널 승인은 settings 결과로만 읽고 share에서 승인하지 않습니다.

### 5.4 Localized message completeness

```ts
type LocalizedDispatchMessageV2 = {
  version: "localized-dispatch-message/v2";
  locale: SupportedLanguageCode;
  subject: string;
  meta: {
    siteLabel: string;
    siteValue: string;
    workLabel: string;
    workValue: string;
    topRiskLabel: string;
    topRiskValue: string;
  };
  bodyLines: [string, string, string, ...string[]];
  meaningTokens: Array<"warning" | "scaffold" | "strong_wind" | "restricted_area">;
  translationStatus: "complete" | "incomplete" | "unavailable";
  translationRevision: string;
  digest: `sha256:${string}`;
};
```

- `translationStatus=complete`는 subject, meta label, meta value, body 전체가 같은 locale로 준비된 경우에만 허용합니다.
- 비한국어 전송본의 meta label/value에는 Hangul 범위 `[가-힣ㄱ-ㅎㅏ-ㅣ]`가 남으면 안 됩니다.
- 번역된 라벨만 붙이고 한국어 site/work/topRisk 값을 유지하면 `incomplete`입니다.
- 비한국어 필수 번역이 없거나 `incomplete|unavailable`이면 `selected` 상태에서 `번역 검토가 필요합니다. 번역을 확인하기 전에는 전송할 수 없습니다.`를 표시하고 send authority를 부여하지 않습니다.
- 원문과 label만 다른 값, fallback 문구, 빈 body line은 완료로 처리하지 않습니다.
- 베트남어 browser gate는 제목, 현장, 작업, 핵심 위험의 라벨과 값, 본문 3줄을 모두 검사합니다.
- 구조적 emoji `⚠️ 🧱 🌬️ 🚧 🧪 🔥 🫁 ⚡ 🌡️ 💧 📦 🏗️ ⛏️`는 share DOM과 외부 채널 payload에서 사용하지 않습니다.
- 기본 표현은 locale별 text-only 의미 토큰입니다. 예시는 `warning`, `scaffold`, `strong_wind`, `restricted_area`에 대응하는 번역 텍스트입니다. 아이콘을 추가하더라도 텍스트를 함께 제공해야 하며 아이콘만으로 의미를 전달하지 않습니다.

### 5.5 Invitation-only read-only session

```ts
type InvitationRecipientV2 = {
  workerId: string;
  contactChannel: "email" | "sms";
  invitationId: string;
  access: "read_only";
  expiresAt: string;
  invitationStatus: "planned" | "created" | "delivered" | "failed";
};

type InvitationOnlySessionV2 = {
  version: "invitation-only-session/v2";
  shareSessionId: string;
  workpackId: string;
  shareScope: "invited";
  anonymousAllowed: false;
  recipientRole: "viewer";
  expiresAt: string;
  workpackDigest: `sha256:${string}`;
  participantSnapshotDigest: `sha256:${string}`;
  invitationArtifactStatus: "ready" | "unavailable";
  recipients: InvitationRecipientV2[];
};
```

- 관리자 로그인 후에만 session을 만듭니다.
- 수신자에게 계정 생성을 요구하지 않습니다.
- 링크는 서버가 서명한 bearer credential이며 session expiry 안에서 만료되고, 초대 snapshot에 포함된 한 사람의 read-only 열람에만 사용합니다. 링크 보유는 본인 확인, 실제 열람, 교육 이수의 증거가 아닙니다.
- 공개 링크, 익명 browse, edit 권한, 링크 재사용 범위 확대를 허용하지 않습니다.
- raw token과 URL은 share DOM, localStorage, dispatch log에 저장하지 않습니다. 관리자 preview에는 `만료되는 초대 링크가 포함됩니다.`라는 token-free placeholder만 표시하고 서버가 provider payload를 만들 때 수신자별 URL을 붙입니다.
- 서버 signing key는 배포 secret `SHARE_INVITATION_SIGNING_SECRET`에서만 읽습니다. 누락되면 artifact를 만들지 않고 `unavailable`로 처리하며 secret 값을 응답이나 로그에 출력하지 않습니다.
- `/invite/[token]`은 signature, expiry, active session, worker audience를 검증한 뒤 HttpOnly·Secure·SameSite=Lax cookie로 교환하고 token-free read-only route로 redirect합니다. 검증 실패는 내용을 렌더링하지 않습니다.
- 현재 session API는 `shareSessionId`와 `expiresAt`만 반환하므로 per-recipient artifact가 준비됐다고 주장할 근거가 없습니다. v2 adapter는 `invitationArtifactStatus=unavailable`로 두고 `selected` 상태에서 fail-closed 처리합니다.
- 링크의 `delivered` 상태는 provider 응답이 있을 때만 사용합니다. session 생성, URL 생성, copy는 전달 완료가 아닙니다.

### 5.6 Dispatch result strip

```ts
type DispatchResultStripV2 = {
  version: "dispatch-result-strip/v2";
  attemptId: string;
  overall: "success" | "partial" | "fail" | "uncertain";
  requestedCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  providerCalled: boolean | null;
  duplicateRisk: boolean;
  logStatus: "saved" | "uncertain" | "not_saved";
  channelResults: Array<{
    channel: "email" | "sms";
    status: "sent" | "failed" | "skipped" | "unconfigured" | "partial";
    count: number;
  }>;
  completedAt: string;
};
```

- 결과 strip은 전송 결과만 말합니다. 열람 확인, 교육 이수, 법적 증빙 확정을 주장하지 않습니다.
- `copy` 결과와 validation-only 응답은 provider 전송 성공에 포함하지 않습니다.
- `duplicateRisk=true` 또는 `providerCalled=true`인데 결과가 미확정이면 같은 화면에서 retry하지 않습니다.

### 5.7 Existing adapter and freshness

| Existing source | v2 adapter | 규칙 |
|---|---|---|
| `StoredCurrentWorkpack.savedAt` | workpack `sourceRevision` fallback | 서버 `updatedAt`이 있으면 서버 값을 우선합니다. |
| `generationEvidence.snapshot.responseContentDigest` | `workpackDigest` | 서명 검증이 성공한 값을 우선합니다. |
| `generationFingerprint` | `legacyFingerprint` | 짧은 local identity이며 SHA-256 digest나 서버 권한으로 승격하지 않습니다. |
| `CurrentWorkerSnapshot` | `TodayParticipantSnapshotV2` | workers와 selected IDs를 canonicalize합니다. |
| `CurrentDispatchSnapshot` | legacy read adapter | worker snapshot에서 다시 계산하고 mismatch면 stale로 처리합니다. |
| `ShareAuthority` | workpack/server worker authority | 실제 UUID 개수와 selected N명이 일치해야 합니다. |
| `ShareSessionPolicyRecord` | invitation session adapter | invited, viewer, anonymous false, active, future expiry를 그대로 검증합니다. |
| `WorkflowShareEvidenceState.scopeKey` | v2 attempt scope | workpack revision/digest와 participant digest를 scope에 추가합니다. |
| `WorkflowDispatchResult` | result strip | channelResults, providerCalled, duplicateRisk를 손실 없이 매핑합니다. |
| `dispatch_logs`와 share/read rows | `/archive`, `/dispatch` | row를 삭제하지 않고 share에서 상세 표시만 이동합니다. |

Freshness 규칙은 다음과 같습니다.

1. `validatedWorkpackRevision`, `validatedWorkpackDigest`, `validatedParticipantRevision`, `validatedParticipantDigest`를 ready 시점에 고정합니다.
2. 현재 값 중 하나라도 달라지면 `stale_revalidation_required`로 전환합니다.
3. workpack digest 변경은 quality, ontology QA, DB harness를 다시 확인합니다.
4. participant digest 변경은 contact, server worker ID, channel, language, invitation snapshot을 다시 확인합니다.
5. localStorage는 복원 cache입니다. 값을 조작해 `canShare`, auth, server UUID, invitation, dispatch 성공을 만들 수 없습니다.

### 5.8 DB follow-up proposal

이번 구현 wave에는 migration이 없습니다. 다음 항목은 별도 승인 뒤 검토할 후속 제안입니다.

- workpack/share session에 `source_revision`, `content_digest`, `participant_snapshot_digest`를 직접 저장합니다.
- recipient별 만료 token과 전달 상태를 별도 테이블로 분리합니다.
- organization reporting recipient group의 revision과 channel 정책을 서버 저장합니다.
- 기존 JSON column adapter로 충분한지 먼저 검증하고, 기존 data mutation이 필요한 migration은 사용자 승인 전 실행하지 않습니다.

## 6. CTA authority

### 6.1 단일 authority 규칙

- 화면에 visible한 `[data-share-primary]`는 정확히 1개입니다.
- header, outer shell, confirmation panel, result box에 추가 primary button을 두지 않습니다.
- drawer가 열리면 background는 `inert`이며 drawer 안의 저장 button 하나만 primary입니다.
- primary label, action, enabled는 하나의 pure resolver가 같은 state와 guard에서 계산합니다.
- send action은 `ready`에서만 존재합니다. 다른 상태의 primary는 선택, 로그인, 복구, 이력 이동입니다.

### 6.2 Send enable 조건

다음 조건이 모두 참일 때만 전송 action을 enable합니다.

1. `readiness.canShare === true`
2. `requiresRevalidation === false`
3. 관리자 auth token이 있습니다.
4. today participant selected count가 1 이상입니다.
5. selected participant 전부에 유효한 server worker UUID가 있습니다.
6. selected participant 전부에 선택 채널 중 최소 한 개의 저장 연락처가 있습니다.
7. 선택 channel이 1개 이상이고 settings에서 usable입니다.
8. selected participant 전부의 language resolution이 `complete`입니다.
9. 수신자별 invitation artifact가 `ready`이고 expiry가 미래 시각입니다.
10. current revision/digest가 validated revision/digest와 같습니다.
11. 기존 attempt가 sending이 아니고 unresolved duplicate risk가 없습니다.

### 6.3 상태별 primary

| 상태 | Label | Enabled | Action |
|---|---|---:|---|
| `quality_blocked` | `문서를 보완합니다` | yes | 문서 검수 화면으로 이동합니다. |
| `stale_revalidation_required` | `다시 검수합니다` | yes | 최신 source로 재검수를 시작합니다. |
| `no_recipients` | `작업자를 선택합니다` | yes | worker selection/quick add drawer를 엽니다. |
| `logged_out` | `로그인하고 계속합니다` | yes | return URL과 theme을 보존해 로그인합니다. |
| `selected` missing worker data | `작업자 정보를 확인합니다` | yes | drawer 또는 `/workers`로 이동합니다. |
| `selected` missing channel choice | `채널을 선택합니다` | no | channel 영역에 inline reason을 표시합니다. |
| `selected` missing invitation artifact | `초대 세션을 확인합니다` | yes | session authority를 다시 확인하며 artifact가 없으면 계속 전송을 막습니다. |
| `offline` | `연결을 다시 확인합니다` | yes | network와 freshness를 다시 확인합니다. |
| `ready` | `선택한 {N}명에게 전송합니다` | yes | 한 번의 dispatch attempt를 시작합니다. |
| `sending` | `전송하고 있습니다` | no | 중복 click을 차단합니다. |
| `success|partial|fail` | `전파 이력을 확인합니다` | yes | `/archive` 또는 `/dispatch`로 이동합니다. |

## 7. Accessibility and responsive acceptance

### 7.1 공통 exact acceptance

| 항목 | GREEN 조건 |
|---|---|
| Touch target | 모든 button, link, select, checkbox hit area가 `>=44x44px`입니다. |
| Touch gap | 인접 interactive rect의 가장 가까운 간격이 `>=8px`입니다. |
| Overlap | visible interactive/text 영역의 의도하지 않은 교차 면적이 `0px`입니다. |
| Horizontal overflow | document와 `[data-share-v2-body]`의 `scrollWidth <= clientWidth`입니다. |
| Nested scrolling | share body 내부에 `overflow-y:auto|scroll`인 container가 없습니다. document만 scroll합니다. drawer open 시 background scroll을 잠그고 drawer 하나만 scroll합니다. |
| Focus order | 대상 -> 채널 -> preview dropdown -> memo -> primary 순서입니다. |
| Focus visibility | keyboard focus에 2px 이상 visible outline이 있습니다. |
| Dynamic text | browser text zoom `200%`에서도 overlap, clipping, horizontal scroll이 없습니다. |
| Contrast | 일반 텍스트 `>=4.5:1`, 큰 텍스트와 UI 경계 `>=3:1`을 Day/Night에서 각각 확인합니다. |
| State semantics | disabled는 native `disabled`, toggle은 `aria-pressed`, result는 `aria-live=polite`, blocking error는 `role=alert`를 사용합니다. |
| Drawer | focus trap, Escape close, visible close button, trigger focus restore, unsaved change 확인을 제공합니다. |
| Motion | `prefers-reduced-motion`에서 smooth scroll과 비필수 transition을 제거합니다. |
| Icons | 구조적 emoji를 사용하지 않습니다. text-only 의미가 기본이며 아이콘 사용 시 텍스트를 함께 제공합니다. |
| Theme sync | query, shell class, toggle `aria-pressed`가 동일하며 toggle, back, reload 후에도 일치합니다. |

### 7.2 Mobile content priority

`390x844`에서 다음 순서를 바꾸지 않습니다.

1. 문서팩 이름/상태 한 줄
2. 오늘 대상 N명과 변경
3. 메일/문자/보고 그룹 요약
4. 자동 언어와 preview dropdown
5. 전체 전송본 preview
6. 선택 전달 메모
7. result strip 또는 blocker
8. 단 하나의 primary action

권한 장문, 공개 링크 설명, 저장/전송/열람 ledger, Before/After, 전체 history는 mobile share body에 렌더링하지 않습니다.

### 7.3 Share body height budget

측정 selector는 `[data-share-v2-body]`이며 global topbar/sidebar와 닫힌 drawer는 제외합니다.

| Viewport/state | Share body max | Document scroll max |
|---|---:|---:|
| Desktop `1440x1000`, empty/selected/login/blocked/ready/sending/offline/stale | `760px` | `1100px` |
| Desktop `1440x1000`, result success/partial/fail | `900px` | `1240px` |
| Mobile `390x844`, empty/selected/login/blocked/ready/sending/offline/stale | `1040px` | `1500px` |
| Mobile `390x844`, result success/partial/fail | `1200px` | `1660px` |

Mobile ready budget의 근거는 다음과 같습니다.

| 구성 | Budget |
|---|---:|
| 문서팩/status | `56px` |
| 대상 | `120px` |
| 채널 | `104px` |
| preview dropdown + 전체 구조화 preview | `304px` |
| memo collapsed | `44px` |
| primary | `52px` |
| padding과 8/16px vertical gaps | `176px` |
| 합계 | `856px` |
| memo expanded 여유 | `108px` |
| wrap/error 여유 | `76px` |
| ready ceiling | `1040px` |

Result strip은 최대 `144px`와 gap을 추가하고 mobile ceiling `1200px` 안에 둡니다. Desktop은 `max-width:960px` 단일 열로 두며, 비대칭 2열 빈 공간을 만들지 않습니다. Day/Night geometry 차이는 각 rect에서 `<=1px`입니다.

## 8. Browser RED/GREEN matrix

### 8.1 Environment dimension

| Env ID | Theme | Viewport | RED | GREEN |
|---|---|---|---|---|
| `day-desktop` | Day | `1440x1000` | root 높이 약 2331px, 비대칭 2열, query desync | 단일 열, height budget 충족, query/class/toggle sync |
| `night-desktop` | Night | `1440x1000` | Day와 다른 geometry 또는 중복 CTA | Day와 geometry 차이 1px 이하, primary 1개 |
| `day-mobile` | Day | `390x844` | 3836px share, overlap, 44px 미만 target 15개 | mobile budget, overlap 0, touch 44px, gap 8px |
| `night-mobile` | Night | `390x844` | declaration box와 control overlap, 내부 scroll | Day와 같은 geometry, document-only scroll, theme sync |

### 8.2 State dimension

| Fixture ID | RED | GREEN |
|---|---|---|
| `empty` | fake/example 대상 또는 긴 inline worker form | 실제 대상 0명, 한 줄 empty copy, worker drawer primary |
| `selected` | recipient chip 장문과 12개 언어 chip | 오늘 N명 요약, 자동 language summary, option 12개인 dropdown 하나 |
| `login` | outer와 inner 로그인 안내/CTA 중복 | login 안내 1개와 primary 1개, return state 유지 |
| `blocked` | share 진입 불가 또는 outer enabled/inner disabled 모순 | blocker는 보이고 send는 없음, 문서 보완 primary만 표시 |
| `ready` | 상단 CTA, panel CTA, confirmation CTA가 중복 | send authority가 만든 enabled primary 정확히 1개 |
| `sending` | layout shift, 중복 click, phase 부재 | 동일 geometry, disabled primary, phase live text, request 1회 |
| `result_success` | toast만 표시하거나 열람/전송을 혼합 | sent count, log state, history primary가 있는 strip |
| `result_partial` | 전체 성공 색상 또는 성공 채널까지 재전송 | 채널별 완료/미완료 텍스트와 자동 retry 금지 |
| `result_fail` | generic error와 즉시 재전송 | providerCalled, duplicateRisk, recovery가 분리된 strip |
| `offline` | provider 호출 뒤 silent failure | preflight에서 차단하고 reconnect 뒤 freshness 재검사 |
| `stale` | 이전 preview/session/result 유지 | digest mismatch로 모두 무효화하고 재검수 primary 표시 |

### 8.3 Cartesian execution matrix

아래 4개 environment에서 11개 fixture를 모두 실행하므로 browser case는 44개입니다.

| Environment | Case IDs |
|---|---|
| `day-desktop` | `day-desktop__empty`, `__selected`, `__login`, `__blocked`, `__ready`, `__sending`, `__result_success`, `__result_partial`, `__result_fail`, `__offline`, `__stale` |
| `night-desktop` | `night-desktop__empty`, `__selected`, `__login`, `__blocked`, `__ready`, `__sending`, `__result_success`, `__result_partial`, `__result_fail`, `__offline`, `__stale` |
| `day-mobile` | `day-mobile__empty`, `__selected`, `__login`, `__blocked`, `__ready`, `__sending`, `__result_success`, `__result_partial`, `__result_fail`, `__offline`, `__stale` |
| `night-mobile` | `night-mobile__empty`, `__selected`, `__login`, `__blocked`, `__ready`, `__sending`, `__result_success`, `__result_partial`, `__result_fail`, `__offline`, `__stale` |

각 case는 다음을 공통 검사합니다.

- visible primary count `===1`
- send primary enabled count는 `ready`에서만 `===1`, 나머지는 `===0`
- touch target과 gap, overlap, overflow, nested scroll, height budget을 검사합니다.
- theme query, shell class, toggle state를 검사하고 toggle -> back -> reload를 반복합니다.
- sending은 dispatch request count `===1`을 확인합니다.
- result는 validation-only/copy를 success로 표시하지 않습니다.
- browser fixture는 network route interception과 explicit component state를 사용합니다. localStorage를 조작해 readiness/auth/server authority를 만들지 않습니다.
- raw invitation token은 share DOM, localStorage, sessionStorage, token-free route의 URL/history에 남지 않습니다.

### 8.4 Vietnamese and 12-language gate

`selected`와 `ready` case는 today participant snapshot의 `languageCode=vi` 작업자를 포함합니다. 실제 전송 언어는 자동으로 `vi`로 해석되고 dropdown도 `vi`를 기본 표시합니다. 운영자가 dropdown을 바꾸는 행위는 수동 preview override일 뿐 dispatch plan이나 수신자 언어를 바꾸지 않습니다.

1. dropdown은 하나이며 option은 정확히 12개이고 code 순서는 `ko, vi, zh, th, uz, mn, ne, km, id, my, tl, en`입니다.
2. auto-resolved dispatch delivery의 `languageCode`는 `vi`이고 compiled outbound artifact도 `vi`입니다.
3. preview를 다른 언어로 바꿨다가 `vi`로 되돌려도 실제 dispatch plan의 recipient language와 digest는 바뀌지 않습니다.
4. 복원된 preview root의 `lang`은 `vi`입니다.
5. subject에 `[SafeClaw 베트남어 안전공지]` 같은 한국어 제목이 남지 않습니다.
6. site/work/topRisk meta label과 value에 Hangul이 남지 않습니다.
7. body 3줄만 번역하고 meta를 남기는 부분 번역은 `translation_incomplete`와 review-required로 표시하고 send를 fail-closed 처리합니다.
8. preview DOM과 `vi` outbound payload에 `⚠️`, `🧱`, `🌬️`, `🚧` 또는 다른 structural hazard emoji가 없습니다.
9. 각 의미 토큰은 locale text를 가지며 색상이나 기호만으로 의미를 전달하지 않습니다.
10. 12개 language fixture 모두 subject, meta, body, digest, translation revision을 unit contract로 검사합니다.

## 9. Implementation waves

### Wave 0. Final integrated base gate

**시작 조건**

- 이 spec branch에서 구현을 시작하지 않습니다.
- export, ontology, KOSHA, document-editor workstream의 최종 commit이 통합된 `FINAL_INTEGRATED_SHA`를 coordinator가 확정해야 합니다.
- `WorkflowSharePanel.tsx`, `SafeGuardCommandCenter.tsx`, `app/globals.css`에 미통합 작업이 없어야 합니다.
- 확정 SHA에서 새 branch와 새 worktree를 만듭니다. 다른 worktree를 수정하거나 기존 branch를 강제로 맞추지 않습니다.

**Files**: none

**Commands**

```powershell
git fetch origin
git show --no-patch --oneline $env:FINAL_INTEGRATED_SHA
git worktree add C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\workpack-share-v2-impl -b feat/workpack-share-v2-impl $env:FINAL_INTEGRATED_SHA
git status --short --branch
git diff --name-only $env:FINAL_INTEGRATED_SHA...HEAD
```

**Gate**: 마지막 command 결과가 비어 있지 않거나 통합 SHA가 확정되지 않으면 중단합니다.

**Rollback**: 변경이 없으므로 구현을 시작하지 않습니다. 다른 worktree나 branch를 되돌리지 않습니다.

### Wave 1. Pure state, data adapters, localization completeness

**Exact files**

- `components/WorkflowSharePolicy.ts`
- `lib/current-workpack.ts`
- `lib/foreign-worker.ts`
- `tests/workflow-share-panel-behavior.test.ts`
- `tests/foreign-worker-languages.test.ts`
- `tests/workpack-readiness.test.ts`

**Tests and commands**

```powershell
npm.cmd test -- tests/workflow-share-panel-behavior.test.ts tests/foreign-worker-languages.test.ts tests/workpack-readiness.test.ts --maxWorkers=1 --no-file-parallelism
npm.cmd run typecheck
git diff --check
```

**Exit**: state priority, CTA resolver, digest invalidation, 12-language completeness, emoji-free message compiler가 pure test에서 통과합니다.

**Rollback**: wave를 한 commit으로 만든 뒤 `git revert <wave-1-sha>`를 사용합니다. DB나 저장 row를 변경하지 않습니다.

### Wave 2. Invitation-only read-only session link

**Exact files** (`new` 표시는 새 파일입니다.)

- `lib/share-invitation.ts` (new)
- `lib/workflow-share-client.ts`
- `lib/workpack-commercial-store.ts`
- `app/api/workpacks/[id]/share-sessions/route.ts`
- `app/api/workflow/dispatch/route.ts`
- `app/invite/[token]/route.ts` (new)
- `app/invite/session/page.tsx` (new)
- `tests/share-invitation.test.ts` (new)
- `tests/workflow-dispatch-invitation.test.ts` (new)
- `tests/workflow-share-client.test.ts`
- `tests/workpack-share-authority-routes.test.ts`

**Tests and commands**

```powershell
npm.cmd test -- tests/share-invitation.test.ts tests/workflow-dispatch-invitation.test.ts tests/workflow-share-client.test.ts tests/workpack-share-authority-routes.test.ts --maxWorkers=1 --no-file-parallelism
npm.cmd run typecheck
git diff --check
```

**Exit**: 관리자 인증 뒤 기존 active session과 recipient snapshot으로 수신자별 서명 token을 만들고, expiry/audience/signature를 검증해 token-free read-only session으로 교환합니다. signing secret이나 artifact 근거가 없으면 send를 차단합니다. raw token은 DOM/localStorage/log에 없고 fixture provider payload에서만 확인합니다. GET 검증과 browser test는 DB write와 실제 provider 호출을 하지 않습니다.

**Rollback**: `git revert <wave-2-sha>`로 invitation compiler, exchange route, read-only surface만 되돌립니다. 기존 share-session/storage/dispatch row와 다른 workstream commit은 되돌리지 않습니다.

### Wave 3. Today participants, drawer, single share flow

**Exact files**

- `components/CurrentWorkpackModules.tsx`
- `components/FieldOperationsWorkspace.tsx`
- `components/WorkflowSharePanel.tsx`
- `components/WorkflowSharePanel.module.css`
- `app/globals.css`
- `tests/workspace-workers.test.ts`
- `tests/workflow-share-panel-behavior.test.ts`

**Tests and commands**

```powershell
npm.cmd test -- tests/workspace-workers.test.ts tests/workflow-share-panel-behavior.test.ts --maxWorkers=1 --no-file-parallelism
npm.cmd run typecheck
git diff --check
```

**Exit**: quick add 최소 field, 저장 후 자동 선택, one primary, target/channel/preview/send 순서, no chip, no nested scroll이 component contract로 통과합니다.

**Rollback**: `git revert <wave-3-sha>`로 Wave 3만 되돌립니다. Wave 1-2 adapter와 기존 audit/storage/dispatch 계약은 유지합니다.

### Wave 4. Command center IA and route ownership

**Exact files**

- `components/SafeGuardCommandCenter.tsx`
- `components/CurrentWorkpackModules.tsx`
- `lib/workspace-pages.ts`
- `lib/module-navigation.ts`
- `app/workers/page.tsx`
- `app/settings/page.tsx`
- `app/dispatch/page.tsx`
- `app/archive/page.tsx`
- `app/reports/page.tsx`
- `app/globals.css`
- `tests/workspace-pages.test.ts`
- `tests/frontend-shared-surfaces.test.ts`
- `tests/product-module-shell.test.ts`

**Tests and commands**

```powershell
npm.cmd test -- tests/workspace-pages.test.ts tests/frontend-shared-surfaces.test.ts tests/product-module-shell.test.ts --maxWorkers=1 --no-file-parallelism
npm.cmd run typecheck
git diff --check
```

**Exit**: blocked 화면은 inspectable이지만 send는 fail-closed이고, history/settings/reporting/worker ownership이 표 `R1..R12`와 일치합니다. 기존 row/API는 삭제하지 않습니다.

**Rollback**: `git revert <wave-4-sha>`로 route display 변경만 되돌립니다. 다른 workstream commit은 revert하지 않습니다.

### Wave 5. Browser matrix and final gate

**Required exact files**

- `tests/workpack-share-v2-browser.test.ts`
- `tests/foreign-worker-languages.test.ts`

**Conditional exact fix files**: gate 실패를 고치는 경우에만 `components/WorkflowSharePanel.tsx`, `components/WorkflowSharePanel.module.css`, `components/SafeGuardCommandCenter.tsx`, `app/globals.css`를 수정합니다.

**Tests and commands**

```powershell
npm.cmd test -- tests/workpack-share-v2-browser.test.ts --maxWorkers=1 --no-file-parallelism
npm.cmd test -- tests/workflow-share-panel-behavior.test.ts tests/workspace-workers.test.ts tests/workspace-pages.test.ts tests/foreign-worker-languages.test.ts --maxWorkers=1 --no-file-parallelism
npm.cmd run typecheck
npm.cmd run build
npm.cmd run audit:frontend-consistency
git diff --check
```

**Browser safety**

- `tests/workpack-share-v2-browser.test.ts`는 기존 `tests/helpers/isolated-next-browser-harness.ts`의 `startIsolatedNextBrowserHarness`와 Playwright Chromium을 사용합니다. jsdom, 정적 markup snapshot, 계산값 대체는 44-case browser gate로 인정하지 않습니다.
- Playwright는 provider route를 interception하고 validation fixture만 사용합니다.
- 실제 email/SMS/Kakao provider credential을 사용하지 않습니다.
- Supabase insert/update/delete를 실행하지 않습니다.
- localStorage 변경으로 quality/auth/authority를 우회하지 않습니다.

**Exit**: 44개 browser case와 Vietnamese gate, 12-language unit contract, build, frontend audit가 GREEN입니다.

**Rollback**: `git revert <wave-5-sha>`로 browser gate와 해당 gate 수정만 되돌립니다. provider, DB, migration rollback은 없습니다.

### Wave 공통 규칙

- 각 wave 시작 전 `git status --short --branch`가 clean이어야 합니다.
- 각 wave는 한 commit으로 닫고 다음 wave를 시작합니다.
- 파일 목록 밖 변경이 보이면 중단하고 coordinator와 확인합니다.
- 충돌 시 ours/theirs 일괄 선택을 하지 않고 final integrated base의 최신 코드를 기준으로 다시 적용합니다.
- package와 lock 변경이 필요하다는 이유로 임의 icon dependency를 추가하지 않습니다. 이번 계약은 text-only 위험 의미를 기본으로 합니다.

## 10. Non-goals

1. 신규 외부 전송 provider 실행 또는 실발송 테스트
2. 신규 DB mutation, schema 변경, migration 실행 또는 browser gate의 DB write. 기존 authenticated session/storage/dispatch write 계약은 보존만 합니다.
3. channel 승인이나 template 승인
4. worker account provisioning 또는 계정 생성 초대
5. public link 또는 anonymous access
6. export, ontology, KOSHA, document-editor 기능 변경
7. 기존 provenance, audit, storage, dispatch row/API 삭제
8. 법적 증빙이나 교육 이수 확정 표시

## 11. 제출 가능한 사용자 문구

| 상황 | 문구 |
|---|---|
| 문서팩 | `오늘 문서팩 · {문서팩명} · {상태}입니다.` |
| 대상 선택 | `오늘 참여자 {N}명을 선택했습니다.` |
| 대상 변경 | `작업자를 변경합니다.` |
| 대상 empty | `오늘 참여자가 없습니다. 작업자를 선택하거나 빠르게 추가합니다.` |
| 채널 | `메일 {emailCount}명 · 문자 {smsCount}명에게 보냅니다.` |
| 보고 그룹 | `보고 수신자 그룹 {reportingCount}명이 함께 설정되어 있습니다.` |
| 언어 | `작업자 정보에 따라 언어를 자동으로 정했습니다.` |
| Preview label | `전송본 미리보기 언어` |
| 번역 검토 | `번역 검토가 필요합니다. 번역을 확인하기 전에는 전송할 수 없습니다.` |
| 초대 세션 | `만료되는 초대 링크를 준비할 수 없어 전송할 수 없습니다. 초대 세션을 다시 확인합니다.` |
| Memo | `전달 메모를 추가합니다.` |
| Login | `관리자 로그인 후 저장된 연락처로 전송할 수 있습니다.` |
| Blocked | `문서팩 검수가 완료되지 않아 전송할 수 없습니다. 문서를 보완한 뒤 다시 확인합니다.` |
| Stale | `문서팩 또는 참여자 정보가 변경되어 다시 확인해야 합니다.` |
| Offline | `네트워크 연결을 확인한 뒤 다시 시도합니다.` |
| Sending | `선택한 대상에게 전송하고 있습니다.` |
| Success | `선택한 채널로 전송했습니다. 자세한 결과는 전파 이력에서 확인합니다.` |
| Partial | `일부 채널 전송이 완료되지 않았습니다. 채널별 결과를 확인합니다.` |
| Fail | `전송을 완료하지 못했습니다. 결과를 확인한 뒤 다음 조치를 진행합니다.` |
| Uncertain | `전송 결과를 확정하지 못했습니다. 중복 전송을 피하기 위해 다시 보내지 않고 전파 이력을 확인합니다.` |

과장 금지 규칙은 다음과 같습니다.

- 전송 성공을 열람 완료, 교육 완료, 서명 완료로 바꾸지 않습니다.
- 저장 성공을 법적 증빙 확정으로 바꾸지 않습니다.
- 부분 번역을 번역 완료로 표시하지 않습니다.
- validation-only, copy, local cache를 실전송으로 표시하지 않습니다.

## 12. 구현 승인 checklist

- [ ] `FINAL_INTEGRATED_SHA`에서 새 implementation branch/worktree를 만들었습니다.
- [ ] quality fallback 예시가 `quality_blocked`이며 send 함수가 호출되지 않습니다.
- [ ] visible primary가 모든 state에서 정확히 1개입니다.
- [ ] target -> channel -> preview -> send 순서가 Day/Night와 desktop/mobile에서 같습니다.
- [ ] quick add가 표시명, 연락수단 1개, 언어를 요구하고 저장 후 오늘 참여자로 선택합니다.
- [ ] 12개 preview option을 유지하고 실제 recipient language는 자동 결정합니다.
- [ ] 베트남어 subject/meta label/meta value/body가 전체 번역 gate를 통과합니다.
- [ ] structural hazard emoji가 share DOM과 outbound payload에 없습니다.
- [ ] sourceRevision/digest mismatch가 session/result를 무효화합니다.
- [ ] invited-only, viewer, anonymous false, expiry를 유지합니다.
- [ ] 44px touch, 8px gap, overlap 0, no overflow, no nested scroll을 충족합니다.
- [ ] body/document height budget을 충족합니다.
- [ ] 44개 browser case가 GREEN입니다.
- [ ] 실제 provider 호출과 DB mutation 없이 검증했습니다.

## 13. MD/JSON parity contract

`spec.json`은 이 문서의 machine-readable twin입니다. 다음 값은 반드시 동일해야 합니다.

| Key | Value |
|---|---|
| `specId` | `workpack-share-v2-2026-07-13` |
| `baseSha` | `59f48123da62fb405e639da03912aa1ed6c000b9` |
| `baselineCommit` | `d3ad865` |
| `job` | `오늘 문서팩을 선택한 사람에게 보냅니다.` |
| `sequence` | `target, channel, preview, send` |
| `supportedLanguageCount` | `12` |
| `touchTargetMinPx` | `44` |
| `touchGapMinPx` | `8` |
| `desktopViewport` | `1440x1000` |
| `mobileViewport` | `390x844` |
| `desktopReadyBodyMaxPx` | `760` |
| `desktopResultBodyMaxPx` | `900` |
| `mobileReadyBodyMaxPx` | `1040` |
| `mobileResultBodyMaxPx` | `1200` |
| `environmentCount` | `4` |
| `browserStateCount` | `11` |
| `browserCaseCount` | `44` |
| `routeOwnershipCount` | `12` |
| `implementationWaveCount` | `6` |

Parity validation은 JSON parse, 위 scalar 비교, route/state/language/case ID 집합 비교, 필수 section 존재 검사를 포함해야 합니다.
