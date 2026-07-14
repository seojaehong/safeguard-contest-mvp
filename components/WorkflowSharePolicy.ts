import {
  isProviderDispatchConfirmed,
  type WorkflowDispatchResult
} from "@/lib/workflow-share-client";
import {
  buildShareOwnerHref,
  type WorkspaceTheme
} from "@/lib/workspace-pages";

export type ShareAuthority = {
  workpackId: string;
  workerIds: string[];
};

export type ShareWorkerSnapshot = {
  workerId: string;
  displayName: string;
  languageCode: string;
  languageLabel: string;
};

export type ShareSessionRecipient = {
  workerId: string;
  displayName: string;
  languageCode: string;
  role: string;
  workerSnapshot: ShareWorkerSnapshot | null;
};

export type ShareSessionPolicyRecord = {
  id: string;
  status: string;
  shareScope: string;
  anonymousAllowed: boolean;
  expiresAt: string | null;
  recipients: ShareSessionRecipient[];
};

export type ShareSessionArchiveRecord = ShareSessionPolicyRecord & {
  createdAt: string | null;
};

export type ShareReadConfirmation = {
  id: string;
  shareSessionId: string;
  workerDisplayName: string;
  languageCode: string;
  readAt: string | null;
  confirmationKind: "admin_marked" | "worker_confirmed";
  reportedMethod: string;
};

export type WorkflowShareResultSource = "copy" | "dispatch" | null;
export type WorkflowShareLogSaveStatus = "idle" | "saving" | "saved" | "skipped" | "error" | "duplicate-risk";

export type WorkflowShareLogSaveState = {
  status: WorkflowShareLogSaveStatus;
  message: string;
  savedCount: number;
  knownTotal: number;
};

export type WorkflowShareEvidenceState = {
  scopeKey: string;
  result: WorkflowDispatchResult | null;
  shareSessionId: string | null;
  resultSource: WorkflowShareResultSource;
  logSaveState: WorkflowShareLogSaveState;
};

export type WorkflowShareEvidenceAction =
  | { type: "scope_changed"; scopeKey: string }
  | { type: "begin_dispatch"; scopeKey: string }
  | {
    type: "set_result";
    scopeKey: string;
    result: WorkflowDispatchResult;
    resultSource: Exclude<WorkflowShareResultSource, null>;
  }
  | { type: "set_session"; scopeKey: string; shareSessionId: string }
  | { type: "set_log"; scopeKey: string; logSaveState: WorkflowShareLogSaveState };

export type WorkflowShareRequestScopeInput = {
  authorityScope: string;
  eligible: boolean;
  operatorNote: string;
  authority: null | {
    workpackId: string;
    canonicalWorkpackRevision: string;
    workerIds: readonly string[];
  };
  selectedChannels: readonly string[];
  channelResolution: null | {
    ready: boolean;
    workpackId: string;
    canonicalWorkpackRevision: string;
    requestedChannels: readonly string[];
    availabilityToken: string;
    expiresAt: string;
  };
};

type WorkflowShareTargetSignatureInput = {
  displayName: string;
  role: string;
  nationality: string;
  languageCode: string;
  languageLabel: string;
  trainingStatus: string;
  phoneMasked?: string;
  emailMasked?: string;
};

export const DISPATCH_LOG_IDEMPOTENCY_SUPPORTED = false;

const EMPTY_LOG_SAVE_STATE: WorkflowShareLogSaveState = {
  status: "idle",
  message: "실제 provider 결과가 생기면 저장합니다.",
  savedCount: 0,
  knownTotal: 0
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isShareUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function createWorkflowShareEvidenceState(scopeKey: string): WorkflowShareEvidenceState {
  return {
    scopeKey,
    result: null,
    shareSessionId: null,
    resultSource: null,
    logSaveState: { ...EMPTY_LOG_SAVE_STATE }
  };
}

export function buildWorkflowShareTargetSignature(
  targets: readonly WorkflowShareTargetSignatureInput[]
): string {
  return JSON.stringify(targets.map((target) => ({
    displayName: target.displayName,
    role: target.role,
    nationality: target.nationality,
    languageCode: target.languageCode,
    languageLabel: target.languageLabel,
    trainingStatus: target.trainingStatus,
    phoneMasked: target.phoneMasked || "",
    emailMasked: target.emailMasked || ""
  })));
}

export function buildWorkflowShareEvidenceScopeKey(input: {
  workpackId: string | null;
  targetSignature: string;
  workerIds: readonly string[];
}): string {
  return JSON.stringify({
    workpackId: input.workpackId || "unsaved",
    targetSignature: input.targetSignature,
    workerIds: [...input.workerIds]
  });
}

export function buildWorkflowShareRequestScopeKey(input: WorkflowShareRequestScopeInput): string {
  return JSON.stringify({
    authorityScope: input.authorityScope,
    eligible: input.eligible,
    operatorNote: input.operatorNote,
    authority: input.authority ? {
      workpackId: input.authority.workpackId,
      canonicalWorkpackRevision: input.authority.canonicalWorkpackRevision,
      workerIds: [...input.authority.workerIds]
    } : null,
    selectedChannels: [...input.selectedChannels],
    channelResolution: input.channelResolution ? {
      ready: input.channelResolution.ready,
      workpackId: input.channelResolution.workpackId,
      canonicalWorkpackRevision: input.channelResolution.canonicalWorkpackRevision,
      requestedChannels: [...input.channelResolution.requestedChannels],
      availabilityToken: input.channelResolution.availabilityToken,
      expiresAt: input.channelResolution.expiresAt
    } : null
  });
}

export function readWorkflowShareEvidenceForScope(
  state: WorkflowShareEvidenceState,
  scopeKey: string
): WorkflowShareEvidenceState {
  return state.scopeKey === scopeKey ? state : createWorkflowShareEvidenceState(scopeKey);
}

export function reduceWorkflowShareEvidence(
  state: WorkflowShareEvidenceState,
  action: WorkflowShareEvidenceAction
): WorkflowShareEvidenceState {
  if (action.type === "scope_changed") {
    return action.scopeKey === state.scopeKey ? state : createWorkflowShareEvidenceState(action.scopeKey);
  }
  if (action.scopeKey !== state.scopeKey) return state;
  if (action.type === "begin_dispatch") {
    return {
      ...createWorkflowShareEvidenceState(state.scopeKey),
      resultSource: "dispatch"
    };
  }
  if (action.type === "set_result") {
    return {
      ...state,
      result: action.result,
      resultSource: action.resultSource
    };
  }
  if (action.type === "set_session") {
    return { ...state, shareSessionId: action.shareSessionId };
  }
  return { ...state, logSaveState: action.logSaveState };
}

export function parseShareSessionRows(value: unknown): ShareSessionArchiveRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ShareSessionArchiveRecord[] => {
    if (!isRecord(item)) return [];
    const id = readString(item.id);
    if (!id) return [];
    const accessPolicy = isRecord(item.access_policy) ? item.access_policy : {};
    const recipients = Array.isArray(item.recipients_snapshot)
      ? item.recipients_snapshot.flatMap((recipient): ShareSessionRecipient[] => {
          if (!isRecord(recipient)) return [];
          const workerId = readString(recipient.workerId);
          const displayName = readString(recipient.displayName);
          if (!workerId || !displayName) return [];
          const rawSnapshot = isRecord(recipient.workerSnapshot) ? recipient.workerSnapshot : null;
          const snapshotWorkerId = readString(rawSnapshot?.workerId);
          const snapshotDisplayName = readString(rawSnapshot?.displayName);
          return [{
            workerId,
            displayName,
            languageCode: readString(recipient.languageCode) || "und",
            role: readString(recipient.role) || "unknown",
            workerSnapshot: rawSnapshot && snapshotWorkerId && snapshotDisplayName
              ? {
                  workerId: snapshotWorkerId,
                  displayName: snapshotDisplayName,
                  languageCode: readString(rawSnapshot.languageCode) || "und",
                  languageLabel: readString(rawSnapshot.languageLabel)
                }
              : null
          }];
        })
      : [];
    return [{
      id,
      status: readString(item.status) || "unknown",
      shareScope: readString(item.share_scope) || "unknown",
      anonymousAllowed: accessPolicy.anonymousAllowed === true,
      expiresAt: readString(item.expires_at) || null,
      recipients,
      createdAt: readString(item.created_at) || null
    }];
  });
}

export function validateShareAuthority(
  authority: ShareAuthority | null,
  targetCount: number
): { ok: true } | {
  ok: false;
  reason: "authority_missing" | "target_missing" | "workpack_id_invalid" | "worker_ids_invalid";
} {
  if (!authority) return { ok: false, reason: "authority_missing" };
  if (targetCount < 1) return { ok: false, reason: "target_missing" };
  if (!isShareUuid(authority.workpackId)) return { ok: false, reason: "workpack_id_invalid" };
  if (
    authority.workerIds.length !== targetCount
    || new Set(authority.workerIds).size !== authority.workerIds.length
    || authority.workerIds.some((workerId) => !isShareUuid(workerId))
  ) {
    return { ok: false, reason: "worker_ids_invalid" };
  }
  return { ok: true };
}

function recipientIdsMatch(session: ShareSessionPolicyRecord, authority: ShareAuthority): boolean {
  if (session.recipients.length !== authority.workerIds.length) return false;
  const recipientIds = session.recipients.map((recipient) => recipient.workerId).sort();
  const authorityIds = [...authority.workerIds].sort();
  return recipientIds.every((workerId, index) => workerId === authorityIds[index]);
}

export function isShareSessionPermissionReady(session: ShareSessionPolicyRecord): boolean {
  return isShareUuid(session.id)
    && session.status === "active"
    && session.shareScope === "invited"
    && !session.anonymousAllowed
    && session.recipients.length > 0
    && session.recipients.every((recipient) => (
      recipient.role === "viewer"
      && isShareUuid(recipient.workerId)
      && recipient.workerSnapshot !== null
      && recipient.workerSnapshot.workerId === recipient.workerId
      && recipient.workerSnapshot.displayName === recipient.displayName
    ));
}

export type ShareSessionReuseReason =
  | "authority_missing"
  | "target_missing"
  | "workpack_id_invalid"
  | "worker_ids_invalid"
  | "status_not_active"
  | "recipient_mismatch"
  | "permission_not_ready"
  | "expiry_missing"
  | "expiry_invalid"
  | "expired";

export function evaluateShareSessionReuse(
  session: ShareSessionPolicyRecord,
  authority: ShareAuthority | null,
  targetCount: number,
  nowMs: number
): { reusable: true } | { reusable: false; reason: ShareSessionReuseReason } {
  const authorityValidation = validateShareAuthority(authority, targetCount);
  if (!authorityValidation.ok) return { reusable: false, reason: authorityValidation.reason };
  if (!authority) return { reusable: false, reason: "authority_missing" };
  if (session.status !== "active") return { reusable: false, reason: "status_not_active" };
  if (!recipientIdsMatch(session, authority)) return { reusable: false, reason: "recipient_mismatch" };
  if (!isShareSessionPermissionReady(session)) return { reusable: false, reason: "permission_not_ready" };
  if (!session.expiresAt) return { reusable: false, reason: "expiry_missing" };
  const expiresAt = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresAt)) return { reusable: false, reason: "expiry_invalid" };
  if (expiresAt <= nowMs) return { reusable: false, reason: "expired" };
  return { reusable: true };
}

export function selectAuthorityShareSession<T extends ShareSessionPolicyRecord>(
  sessions: T[],
  authority: ShareAuthority | null,
  targetCount: number
): T | null {
  if (!validateShareAuthority(authority, targetCount).ok || !authority) return null;
  return sessions.find((session) => (
    session.status === "active" && recipientIdsMatch(session, authority)
  )) || null;
}

export function selectReusableShareSession<T extends ShareSessionPolicyRecord>(
  sessions: T[],
  authority: ShareAuthority | null,
  targetCount: number,
  nowMs: number
): T | null {
  if (!validateShareAuthority(authority, targetCount).ok || !authority) return null;
  return sessions.find((session) => evaluateShareSessionReuse(
    session,
    authority,
    targetCount,
    nowMs
  ).reusable) || null;
}

export function parseAdminConfirmationRows(value: unknown): ShareReadConfirmation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ShareReadConfirmation[] => {
    if (!isRecord(item)) return [];
    const id = readString(item.id);
    const shareSessionId = readString(item.share_session_id);
    if (!id || !shareSessionId) return [];
    return [{
      id,
      shareSessionId,
      workerDisplayName: readString(item.worker_display_name),
      languageCode: readString(item.language_code) || "und",
      readAt: readString(item.read_at) || null,
      confirmationKind: "admin_marked",
      reportedMethod: readString(item.confirmation_method) || "unknown"
    }];
  });
}

export function summarizeReadConfirmations(
  confirmations: ShareReadConfirmation[],
  shareSessionId: string | null
): { workerConfirmedCount: number; adminMarkedCount: number } {
  if (!shareSessionId) return { workerConfirmedCount: 0, adminMarkedCount: 0 };
  const linked = confirmations.filter((confirmation) => confirmation.shareSessionId === shareSessionId);
  return {
    workerConfirmedCount: linked.filter((confirmation) => confirmation.confirmationKind === "worker_confirmed").length,
    adminMarkedCount: linked.filter((confirmation) => confirmation.confirmationKind === "admin_marked").length
  };
}

export function buildReadConfirmationStatus(input: {
  hasSession: boolean;
  recipientCount: number;
  workerConfirmedCount: number;
  adminMarkedCount: number;
  historyError: boolean;
}): { label: string; detail: string; nextAction: string } {
  if (!input.hasSession) {
    return {
      label: "확인 대상 없음",
      detail: "열람 확인은 현재 대상과 일치하는 공유 세션에만 연결됩니다.",
      nextAction: "공유 세션 생성"
    };
  }
  return {
    label: `${input.workerConfirmedCount}/${input.recipientCount}명 작업자 확인`,
    detail: input.adminMarkedCount > 0
      ? `전송 완료와 별도 · 관리자 표시 ${input.adminMarkedCount}건은 작업자 확인 집계에서 제외`
      : "전송 완료와 별도 · 작업자 전용 인증 확인은 아직 연결되지 않음",
    nextAction: input.workerConfirmedCount >= input.recipientCount && input.recipientCount > 0
      ? "초대 대상 확인 완료"
      : input.historyError
        ? "열람 이력 다시 조회"
        : "invitee-scoped 인증 경로 연결 후 확인 수집"
  };
}

export function getSessionLanguageLabels(session: ShareSessionPolicyRecord | null): string[] {
  if (!session) return [];
  return Array.from(new Set(session.recipients.flatMap((recipient) => {
    const snapshot = recipient.workerSnapshot;
    if (!snapshot) return [];
    const label = snapshot.languageLabel || snapshot.languageCode;
    return label && label !== "und" ? [label] : [];
  })));
}

export function resolveShareLanguagePresentation(input: {
  session: ShareSessionPolicyRecord | null;
  sessionReusable: boolean;
  plannedLanguageLabels: string[];
}): { label: string; basis: string } {
  if (input.sessionReusable && input.session) {
    const labels = getSessionLanguageLabels(input.session);
    return {
      label: labels.join(" · ") || "snapshot 언어 미확인",
      basis: "재사용 session workerSnapshot 기준"
    };
  }
  const plannedLabels = Array.from(new Set(input.plannedLanguageLabels.map((label) => label.trim()).filter(Boolean)));
  return {
    label: plannedLabels.join(" · ") || "언어 없음",
    basis: "선택 대상 기준 · 새 세션의 서버 snapshot 생성 후 재확인"
  };
}

export function buildShareEvidenceSummary(input: {
  workpackSaved: boolean;
  sessionSaved: boolean;
  dispatchLogState: "saved" | "planned" | "uncertain";
  workerConfirmationSupported: boolean;
}): { headline: string; detail: string } {
  const dispatchLabel = input.dispatchLogState === "saved"
    ? "provider 로그 저장 확인"
    : input.dispatchLogState === "uncertain"
      ? "provider 로그 저장 미확인"
      : "provider 로그 저장 계획";
  return {
    headline: "저장 확인과 계획 분리",
    detail: [
      input.workpackSaved ? "workpack 저장 확인" : "workpack 저장 계획",
      input.sessionSaved ? "초대 snapshot 저장 확인" : "초대 snapshot 생성 계획",
      dispatchLabel,
      input.workerConfirmationSupported ? "작업자 확인 수집 가능" : "작업자 확인 인증 경로 미연결"
    ].join(" · ")
  };
}

export function classifyWorkflowDispatchPresentation(input: {
  result: WorkflowDispatchResult | null;
  resultSource: WorkflowShareResultSource;
  validationOnly: boolean;
}): { succeeded: boolean; hasFailure: boolean; fullySent: boolean } {
  if (!input.result) return { succeeded: false, hasFailure: false, fullySent: false };
  if (input.resultSource === "copy") {
    return {
      succeeded: input.result.ok,
      hasFailure: !input.result.ok,
      fullySent: false
    };
  }
  if (input.validationOnly) return { succeeded: false, hasFailure: false, fullySent: false };
  const channelResults = input.result.channelResults || [];
  const fullySent = Boolean(
    isProviderDispatchConfirmed(input.result)
    && channelResults.length > 0
    && channelResults.every((item) => item.status === "sent")
  );
  return {
    succeeded: fullySent,
    hasFailure: !fullySent,
    fullySent
  };
}

export type ShareProductState =
  | "sending"
  | "success"
  | "partial"
  | "fail"
  | "stale"
  | "workpack_revalidation"
  | "blocked"
  | "offline"
  | "no_recipients"
  | "logged_out"
  | "review_required"
  | "selected"
  | "ready";

export type ShareProductAuthorityStatus =
  | "idle"
  | "loading"
  | "ready"
  | "workpack_not_saved"
  | "workpack_revision_or_digest_changed"
  | "recipient_locale_invalid"
  | "translation_incomplete"
  | "translation_not_reviewed"
  | "translation_rejected";

export type ShareProductChannelStatus = "idle" | "empty" | "loading" | "ready" | "unavailable" | "error";

export type ShareProductOutcome = {
  stage: "accepted" | "partial" | "session_failed" | "dispatch_failed" | "log_unpersisted" | "unknown";
  logIds: string[];
  channelOutcomes?: Array<{
    channel: string;
    label: string;
    outcome: "accepted" | "failed" | "unknown";
    message: string;
  }>;
};

export type ShareProductPresentation = {
  state: ShareProductState;
  headline: string;
  detail: string;
  primary: {
    kind: "button" | "link";
    label: string;
    href?: string;
    action?: "send" | "recheck";
    disabled: boolean;
  };
};

export type ShareProductPresentationInput = {
  theme: WorkspaceTheme;
  sending: boolean;
  outcome: ShareProductOutcome | null;
  staleReason: string | null;
  requiresRevalidation: boolean;
  readinessCanShare: boolean;
  online: boolean;
  targetCount: number;
  authenticated: boolean;
  authorityStatus: ShareProductAuthorityStatus;
  channelStatus: ShareProductChannelStatus;
  validatedLanguage?: unknown;
};

function linkPresentation(
  state: ShareProductState,
  headline: string,
  detail: string,
  label: string,
  href: string
): ShareProductPresentation {
  return {
    state,
    headline,
    detail,
    primary: { kind: "link", label, href, disabled: false }
  };
}

function buttonPresentation(
  state: ShareProductState,
  headline: string,
  detail: string,
  label: string,
  action: "send" | "recheck",
  disabled = false
): ShareProductPresentation {
  return {
    state,
    headline,
    detail,
    primary: { kind: "button", label, action, disabled }
  };
}

function staleOwnerHref(input: ShareProductPresentationInput): string {
  if (input.staleReason === "recipient_snapshot_changed" || input.staleReason === "recipient_locale_invalid") {
    return buildShareOwnerHref({ owner: "worker-language", theme: input.theme });
  }
  if (input.staleReason === "channel_configuration_changed") {
    return buildShareOwnerHref({ owner: "settings", theme: input.theme });
  }
  if (input.staleReason === "translation_incomplete") {
    return buildShareOwnerHref({ owner: "translation", theme: input.theme, language: input.validatedLanguage });
  }
  return buildShareOwnerHref({ owner: "document", theme: input.theme });
}

export function resolveShareProductPresentation(input: ShareProductPresentationInput): ShareProductPresentation {
  if (input.sending) {
    return buttonPresentation("sending", "전송 중", "초대 세션과 채널 요청을 순서대로 확인하고 있습니다.", "전송 중", "send", true);
  }
  if (input.outcome) {
    const hasPersistedLogs = input.outcome.logIds.length > 0;
    if (input.outcome.stage === "accepted" && hasPersistedLogs) {
      return linkPresentation(
        "success",
        "전송 요청 접수",
        "선택한 채널이 전송 요청을 접수했습니다. 전달 여부는 전파 이력에서 확인합니다.",
        "전파 이력 확인",
        "/dispatch"
      );
    }
    if (input.outcome.stage === "partial" && hasPersistedLogs) {
      return linkPresentation(
        "partial",
        "일부 채널 확인 필요",
        "일부 채널은 요청을 접수했고 일부는 실패하거나 결과를 확인하지 못했습니다.",
        "전파 이력 확인",
        "/dispatch"
      );
    }
    if (input.outcome.stage === "session_failed") {
      return buttonPresentation(
        "fail",
        "초대 세션 생성 실패",
        "초대 세션을 만들지 못해 전송을 시작하지 않았습니다.",
        "초대 세션 다시 시도",
        "recheck"
      );
    }
    if (hasPersistedLogs) {
      return linkPresentation(
        "fail",
        "전송 결과 확인 필요",
        "채널 전송 결과를 전파 이력에서 확인합니다.",
        "전파 이력 확인",
        "/dispatch"
      );
    }
    return buttonPresentation(
      "fail",
      "중복 전송 방지 확인 필요",
      "전송 결과를 확정하지 못했습니다. 자동으로 다시 보내지 말고 연결 상태를 확인합니다.",
      "연결 다시 확인",
      "recheck"
    );
  }
  if (input.staleReason) {
    if (input.staleReason === "channel_configuration_changed" || input.staleReason === "channel_unavailable") {
      return buttonPresentation(
        "blocked",
        "채널 연결 준비 필요",
        "현재 제품에는 이 채널 설정을 변경하는 운영 화면이 연결되지 않았습니다.",
        "채널 연결 대기",
        "recheck",
        true
      );
    }
    return linkPresentation(
      "stale",
      "변경사항 확인 필요",
      "문서팩 또는 오늘 참여자 정보가 변경되어 다시 확인해야 합니다.",
      "변경사항 다시 확인",
      staleOwnerHref(input)
    );
  }
  if (input.requiresRevalidation) {
    return linkPresentation(
      "workpack_revalidation",
      "문서팩 재검수 필요",
      "문서팩이 변경되어 다시 검수해야 합니다.",
      "문서 다시 검수",
      buildShareOwnerHref({ owner: "document", theme: input.theme })
    );
  }
  if (!input.readinessCanShare) {
    return linkPresentation(
      "blocked",
      "문서 보완 필요",
      "공유 전 검수 항목을 보완해야 합니다.",
      "문서 보완",
      buildShareOwnerHref({ owner: "document", theme: input.theme })
    );
  }
  if (!input.online) {
    return buttonPresentation(
      "offline",
      "인터넷 연결 확인",
      "연결이 복구되면 서버 권위를 다시 확인합니다.",
      "연결 다시 확인",
      "recheck"
    );
  }
  if (input.targetCount < 1) {
    return linkPresentation(
      "no_recipients",
      "오늘 참여자가 없습니다",
      "작업자 화면에서 오늘 참여자를 선택합니다.",
      "오늘 참여자 선택",
      buildShareOwnerHref({ owner: "workers", theme: input.theme })
    );
  }
  if (!input.authenticated) {
    return linkPresentation(
      "logged_out",
      "관리자 로그인 필요",
      "로그인한 관리자만 서버 검증 후 전송할 수 있습니다.",
      "로그인하고 전송",
      buildShareOwnerHref({ owner: "login", theme: input.theme })
    );
  }
  if (input.authorityStatus === "recipient_locale_invalid") {
    return linkPresentation(
      "review_required",
      "작업자 언어 확인 필요",
      "작업자 언어 정보가 올바르지 않습니다. 작업자 화면에서 언어를 확인합니다.",
      "작업자 언어 확인",
      buildShareOwnerHref({ owner: "worker-language", theme: input.theme })
    );
  }
  if (
    input.authorityStatus === "translation_incomplete"
    || input.authorityStatus === "translation_not_reviewed"
    || input.authorityStatus === "translation_rejected"
  ) {
    const label = input.authorityStatus === "translation_not_reviewed"
      ? "번역본 검토"
      : input.authorityStatus === "translation_rejected"
        ? "번역본 수정"
        : "번역본 보완";
    return linkPresentation(
      "review_required",
      "검토된 번역본 필요",
      "검토된 전송본을 보완한 뒤 Share로 돌아옵니다.",
      label,
      buildShareOwnerHref({ owner: "translation", theme: input.theme, language: input.validatedLanguage })
    );
  }
  if (
    input.authorityStatus === "workpack_not_saved"
    || input.authorityStatus === "workpack_revision_or_digest_changed"
  ) {
    return linkPresentation(
      "selected",
      "현재 문서팩 확인 필요",
      "서버에 저장된 현재 문서팩을 확인한 뒤 전송합니다.",
      "문서팩 확인",
      buildShareOwnerHref({ owner: "document", theme: input.theme })
    );
  }
  if (input.authorityStatus !== "ready") {
    return buttonPresentation(
      "selected",
      "전송 준비 확인 중",
      "서버 문서팩, 참여자, 번역본을 확인하고 있습니다.",
      "전송 준비 확인 중",
      "recheck",
      true
    );
  }
  if (input.channelStatus === "unavailable" || input.channelStatus === "error") {
    return buttonPresentation(
      "blocked",
      "채널 연결 준비 필요",
      "현재 제품에는 이 채널 설정을 변경하는 운영 화면이 연결되지 않았습니다.",
      "채널 연결 대기",
      "recheck",
      true
    );
  }
  if (input.channelStatus === "empty") {
    return buttonPresentation(
      "selected",
      "전송 채널 선택",
      "메일, 문자, 카카오 중 하나 이상을 선택합니다.",
      "전송 채널 선택",
      "recheck"
    );
  }
  if (input.channelStatus !== "ready") {
    return buttonPresentation(
      "selected",
      "채널 확인 중",
      "선택한 채널의 서버 설정과 연락처를 확인하고 있습니다.",
      "채널 확인 중",
      "recheck",
      true
    );
  }
  return buttonPresentation(
    "ready",
    "전송 준비 완료",
    `오늘 참여자 ${input.targetCount}명을 선택했습니다.`,
    `${input.targetCount}명에게 전송`,
    "send"
  );
}
