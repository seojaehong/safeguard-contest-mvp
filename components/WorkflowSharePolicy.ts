import type { WorkflowDispatchResult } from "@/lib/workflow-share-client";

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

export type DispatchIdempotencyLog = {
  channel: string;
  provider?: string;
  providerStatus: string;
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
    input.result.ok
    && !input.result.duplicateRisk
    && input.result.providerCalled !== false
    && channelResults.length > 0
    && channelResults.every((item) => item.status === "sent")
  );
  return {
    succeeded: fullySent,
    hasFailure: !fullySent,
    fullySent
  };
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildProviderDispatchIdempotencyKey(input: {
  workpackId: string;
  shareSessionId: string;
  dispatchAttemptId: string;
  channels: string[];
}): string {
  const canonical = [
    input.workpackId,
    input.shareSessionId,
    input.dispatchAttemptId,
    [...input.channels].sort().join(";")
  ].join("::");
  return `provider-dispatch-v1-${input.dispatchAttemptId}-${fnv1a32(canonical)}`;
}

export function buildDispatchLogIdempotencyKey(input: {
  workpackId: string;
  shareSessionId: string;
  dispatchAttemptId: string;
  workflowRunId?: string;
  logs: DispatchIdempotencyLog[];
}): string {
  const canonicalLogs = input.logs
    .map((log) => [log.channel, log.provider || "", log.providerStatus].join("|"))
    .sort()
    .join(";");
  const canonical = [
    input.workpackId,
    input.shareSessionId,
    input.dispatchAttemptId,
    input.workflowRunId || "no-workflow-run",
    canonicalLogs
  ].join("::");
  return `dispatch-v1-${input.dispatchAttemptId}-${fnv1a32(canonical)}`;
}

export function getDispatchLogRetryPolicy(serverSupportsIdempotency: boolean): {
  retryAllowed: boolean;
  duplicateRisk: boolean;
  message: string;
} {
  if (serverSupportsIdempotency) {
    return {
      retryAllowed: true,
      duplicateRisk: false,
      message: "동일 idempotency key로 전송 로그 저장을 다시 시도할 수 있습니다."
    };
  }
  return {
    retryAllowed: false,
    duplicateRisk: true,
    message: "서버가 idempotency key 중복 방지를 지원하지 않아 자동 재시도를 중단했습니다. 다시 전송하면 로그가 중복될 수 있습니다."
  };
}
