"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import styles from "@/components/WorkflowSharePanel.module.css";
import type { AskResponse } from "@/lib/types";
import type { WorkpackReadiness } from "@/lib/workpack-readiness";
import {
  type RecipientSuggestion,
  type WorkerDispatchTarget
} from "@/lib/workspace";
import {
  buildProviderDispatchUiContract,
  buildCanonicalRecipientMessageVariants,
  createAuthenticatedShareSession,
  dispatchAuthenticatedShareSession,
  loadProviderDispatchCapability,
  resolveWorkflowMessagePreview,
  type ProviderDispatchCapability,
  type WorkflowDispatchChannelResult,
  type WorkflowDispatchResult
} from "@/lib/workflow-share-client";
import {
  buildDispatchLogIdempotencyKey,
  buildProviderDispatchIdempotencyKey,
  buildReadConfirmationStatus,
  buildWorkflowShareEvidenceScopeKey,
  buildWorkflowShareTargetSignature,
  classifyWorkflowDispatchPresentation,
  createWorkflowShareEvidenceState,
  DISPATCH_LOG_IDEMPOTENCY_SUPPORTED,
  evaluateShareSessionReuse,
  getDispatchLogRetryPolicy,
  isShareSessionPermissionReady,
  isShareUuid,
  parseAdminConfirmationRows,
  parseShareSessionRows,
  readWorkflowShareEvidenceForScope,
  reduceWorkflowShareEvidence,
  selectAuthorityShareSession,
  selectReusableShareSession,
  summarizeReadConfirmations,
  validateShareAuthority,
  type ShareAuthority,
  type ShareReadConfirmation,
  type ShareSessionArchiveRecord,
  type ShareSessionReuseReason,
  type WorkflowShareLogSaveStatus
} from "@/components/WorkflowSharePolicy";

type Channel = "email" | "sms" | "kakao" | "band";
type ActiveChannel = Extract<Channel, "email" | "sms" | "kakao">;
type MessageTarget = "manager" | `foreign:${string}`;
type WorkflowSharePhase = "idle" | "saving-workpack" | "creating-session" | "dispatching" | "saving-log";
type RemoteRecordStatus = "idle" | "loading" | "ready" | "unconfigured" | "error";
type WorkflowSharePanelProps = {
  data: AskResponse;
  recipientSuggestions?: RecipientSuggestion[];
  targetWorkers?: WorkerDispatchTarget[];
  authToken?: string;
  workpackId?: string | null;
  workerIds?: string[];
  ensureWorkpackSaved?: () => Promise<{ workpackId: string; workerIds: string[] } | null>;
  readiness?: WorkpackReadiness;
};

type PersistedShareSession = ShareSessionArchiveRecord;

type PersistedReadConfirmation = ShareReadConfirmation;

type PersistedDispatchLog = {
  id: string;
  workpackId: string;
  channel: string;
  provider: string;
  providerStatus: string;
  workflowRunId: string;
  failureReason: string;
  createdAt: string | null;
};

type WorkflowShareArchive = {
  shareOk: boolean;
  shareConfigured: boolean;
  shareMessage: string;
  dispatchOk: boolean;
  dispatchConfigured: boolean;
  dispatchMessage: string;
  sessions: PersistedShareSession[];
  confirmations: PersistedReadConfirmation[];
  logs: PersistedDispatchLog[];
};

type ShareRecordsState = {
  status: RemoteRecordStatus;
  message: string;
  sessions: PersistedShareSession[];
  confirmations: PersistedReadConfirmation[];
};

type DispatchRecordsState = {
  status: RemoteRecordStatus;
  message: string;
  logs: PersistedDispatchLog[];
};

type DispatchLogDraft = {
  channel: string;
  targetLabel: string;
  provider?: string;
  providerStatus: string;
  workflowRunId?: string;
  failureReason?: string;
  payload: {
    workpackId: string;
    shareSessionId: string;
    accessScope: "invited";
    recipientWorkerIds: string[];
    channelStatus?: string;
    providerMessage?: string;
    responseMessage: string;
    idempotencyKey?: string;
  };
};

type DispatchArchiveRequest = {
  scenario: AskResponse["scenario"];
  workpackId: string;
  idempotencyKey: string;
  logs: DispatchLogDraft[];
};

type ShareStateDescriptor = {
  label: string;
  detail: string;
  nextAction: string;
};

type WorkflowShareStatusInput = {
  authenticated: boolean;
  targetCount: number;
  workpackId: string | null;
  serverWorkerIdCount: number;
  phase: WorkflowSharePhase;
  shareRecordsStatus: RemoteRecordStatus;
  dispatchRecordsStatus: RemoteRecordStatus;
  logSaveStatus: WorkflowShareLogSaveStatus;
  activeSession: PersistedShareSession | null;
  sessionReusable: boolean;
  sessionReuseReason: ShareSessionReuseReason | null;
  dispatchLogCount: number;
  workerConfirmationCount: number;
  adminMarkedCount: number;
};

const channelOptions: Array<{
  key: Channel;
  label: string;
  helper: string;
  nextAction: string;
  badge: string;
  enabled: boolean;
}> = [
  {
    key: "email",
    label: "메일",
    helper: "관리자·원청 보고",
    nextAction: "초대 대상의 이메일 확인",
    badge: "사용 가능",
    enabled: true
  },
  {
    key: "sms",
    label: "문자",
    helper: "작업자 즉시 공지",
    nextAction: "초대 대상의 휴대전화 확인",
    badge: "사용 가능",
    enabled: true
  },
  {
    key: "kakao",
    label: "카카오",
    helper: "채널·템플릿 승인을 서버에서 확인",
    nextAction: "승인된 발신 채널과 템플릿 연결",
    badge: "승인 확인 필요",
    enabled: true
  }
];
const activeDispatchChannels: ActiveChannel[] = ["email", "sms", "kakao"];
const EMPTY_SHARE_RECORDS: ShareRecordsState = {
  status: "idle",
  message: "문서팩을 저장하면 공유 준비 이력을 확인할 수 있습니다.",
  sessions: [],
  confirmations: []
};
const EMPTY_DISPATCH_RECORDS: DispatchRecordsState = {
  status: "idle",
  message: "문서팩을 저장하면 전송 이력을 확인할 수 있습니다.",
  logs: []
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function parseWorkflowShareArchive(
  sharePayload: unknown,
  dispatchPayload: unknown,
  workpackId: string
): WorkflowShareArchive {
  const shareBody = isRecord(sharePayload) ? sharePayload : {};
  const dispatchBody = isRecord(dispatchPayload) ? dispatchPayload : {};
  const sessions: PersistedShareSession[] = parseShareSessionRows(shareBody.sessions);
  const confirmations: PersistedReadConfirmation[] = parseAdminConfirmationRows(shareBody.confirmations);
  const parsedLogs = readArray(dispatchBody.logs).flatMap((item): PersistedDispatchLog[] => {
    if (!isRecord(item)) return [];
    const id = readString(item.id);
    const savedWorkpackId = readString(item.workpackId);
    if (!id || !savedWorkpackId) return [];
    return [{
      id,
      workpackId: savedWorkpackId,
      channel: readString(item.channel),
      provider: readString(item.provider),
      providerStatus: readString(item.providerStatus),
      workflowRunId: readString(item.workflowRunId),
      failureReason: readString(item.failureReason),
      createdAt: readString(item.createdAt) || null
    }];
  });
  const logs = parsedLogs.filter((log) => log.workpackId === workpackId);

  return {
    shareOk: shareBody.ok === true,
    shareConfigured: shareBody.configured === true,
    shareMessage: readString(shareBody.message) || "공유 세션 이력 응답을 확인하지 못했습니다.",
    dispatchOk: dispatchBody.ok === true,
    dispatchConfigured: dispatchBody.configured === true,
    dispatchMessage: readString(dispatchBody.message) || "전송 로그 응답을 확인하지 못했습니다.",
    sessions,
    confirmations,
    logs
  };
}

function isValidationOnlyMarker(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ["fixture", "validation-only", "dry-run", "mock", "test"].some((marker) => (
    normalized === marker
    || normalized.startsWith(`${marker}-`)
    || normalized.endsWith(`-${marker}`)
    || normalized.includes(`-${marker}-`)
  ));
}

export function isValidationOnlyDispatch(result: WorkflowDispatchResult): boolean {
  return [
    result.providerStatus,
    result.workflowRunId,
    ...(result.channelResults || []).map((item) => item.provider)
  ].some(isValidationOnlyMarker);
}

export function buildDispatchLogDrafts(input: {
  result: WorkflowDispatchResult;
  workpackId: string;
  shareSessionId: string;
  workerIds: string[];
}): DispatchLogDraft[] {
  if (isValidationOnlyDispatch(input.result) || input.result.providerCalled === false || input.result.duplicateRisk) return [];
  return (input.result.channelResults || []).flatMap((item): DispatchLogDraft[] => {
    if (!item.channel) return [];
    return [{
      channel: item.channel,
      targetLabel: `초대 작업자 ${input.workerIds.length}명`,
      provider: item.provider,
      providerStatus: item.status || "unknown",
      workflowRunId: input.result.workflowRunId,
      failureReason: item.status === "sent" ? undefined : item.message,
      payload: {
        workpackId: input.workpackId,
        shareSessionId: input.shareSessionId,
        accessScope: "invited",
        recipientWorkerIds: input.workerIds,
        channelStatus: item.status,
        providerMessage: item.message,
        responseMessage: input.result.message
      }
    }];
  });
}

function formatSessionReuseReason(reason: ShareSessionReuseReason | null): string {
  if (reason === "expiry_missing") return "이전 공유의 만료 시간을 확인할 수 없어 새로 준비합니다.";
  if (reason === "expiry_invalid") return "이전 공유의 만료 시간이 올바르지 않아 새로 준비합니다.";
  if (reason === "expired") return "만료된 세션이라 재사용하지 않습니다.";
  if (reason === "permission_not_ready") return "선택한 대상의 공유 준비 상태를 다시 확인해야 합니다.";
  if (reason === "recipient_mismatch") return "현재 참여자와 이전에 저장한 참여자가 달라 새로 준비합니다.";
  return "현재 대상과 재사용 정책을 모두 충족한 세션이 아닙니다.";
}

export function deriveWorkflowShareStatus(input: WorkflowShareStatusInput): {
  storage: ShareStateDescriptor;
  session: ShareStateDescriptor;
  dispatch: ShareStateDescriptor;
  acknowledgment: ShareStateDescriptor;
} {
  const authorityReady = Boolean(
    input.authenticated
    && input.workpackId
    && input.targetCount > 0
    && input.serverWorkerIdCount === input.targetCount
  );
  let storage: ShareStateDescriptor;
  if (!input.authenticated) {
    storage = {
      label: "로그인 필요",
      detail: "로그인하면 문서팩과 전송 이력을 서버에 안전하게 저장합니다.",
      nextAction: "관리자 로그인"
    };
  } else if (!input.targetCount) {
    storage = {
      label: "대상 선택 필요",
      detail: "저장할 작업자 대상이 없습니다.",
      nextAction: "공유할 작업자 선택"
    };
  } else if (input.phase === "saving-workpack") {
    storage = {
      label: "문서팩 저장 중",
      detail: "문서팩과 작업자 정보를 안전하게 저장하고 있습니다.",
      nextAction: "잠시만 기다려 주세요"
    };
  } else if (authorityReady) {
    storage = {
      label: "저장됨",
      detail: `문서팩 · 작업자 ${input.serverWorkerIdCount}명 저장`,
      nextAction: "공유 설정 확인"
    };
  } else if (input.workpackId) {
    storage = {
      label: "작업자 저장 확인",
      detail: `대상 ${input.targetCount}명 · 저장 완료 ${input.serverWorkerIdCount}명`,
      nextAction: "작업자 저장 완료 후 다시 확인"
    };
  } else {
    storage = {
      label: "전송 시 안전하게 저장",
      detail: "문서팩과 작업자 정보는 전송 전에 저장됩니다.",
      nextAction: "대상과 채널 확인"
    };
  }

  const recipientCount = input.activeSession?.recipients.length || 0;
  let session: ShareStateDescriptor;
  if (input.phase === "creating-session") {
    session = {
      label: "공유 설정 중",
      detail: "선택한 대상과 공유 준비 정보를 저장하고 있습니다.",
      nextAction: "잠시만 기다려 주세요"
    };
  } else if (input.activeSession) {
    session = {
      label: input.sessionReusable ? `활성 · ${recipientCount}명` : `재사용 불가 · ${recipientCount}명`,
      detail: input.sessionReusable && isShareSessionPermissionReady(input.activeSession)
        ? "선택한 대상 · 전송 준비"
        : formatSessionReuseReason(input.sessionReuseReason),
      nextAction: input.shareRecordsStatus === "error"
        ? "세션 이력 다시 조회"
        : input.sessionReusable
          ? "채널별 전송 결과 확인"
          : "전송 시 새 공유 세션 생성"
    };
  } else if (!authorityReady) {
    session = {
      label: "저장 후 생성",
      detail: "문서팩과 작업자를 저장한 뒤 공유를 준비합니다.",
      nextAction: "문서팩 저장"
    };
  } else if (input.shareRecordsStatus === "loading") {
    session = {
      label: "공유 이력 확인 중",
      detail: "저장된 공유 설정을 확인하고 있습니다.",
      nextAction: "잠시만 기다려 주세요"
    };
  } else if (input.shareRecordsStatus === "unconfigured") {
    session = {
      label: "로그인 후 공유 가능",
      detail: "로그인하면 공유 설정을 서버에 안전하게 저장합니다.",
      nextAction: "로그인"
    };
  } else if (input.shareRecordsStatus === "error") {
    session = {
      label: "공유 이력 확인 필요",
      detail: "이전 공유 이력을 불러오지 못했습니다.",
      nextAction: "공유 이력 다시 확인"
    };
  } else {
    session = {
      label: "아직 없음",
      detail: "전송 전에 선택한 참여자로 공유 설정을 만듭니다.",
      nextAction: "전송할 채널 확인"
    };
  }

  let dispatch: ShareStateDescriptor;
  if (input.phase === "dispatching") {
    dispatch = {
      label: "채널 전송 중",
      detail: "채널별 전송 결과를 기다리고 있습니다.",
      nextAction: "전송 창을 닫지 않기"
    };
  } else if (input.phase === "saving-log") {
    dispatch = {
      label: "전송 결과 · 로그 저장 중",
      detail: "채널별 전송 결과를 안전하게 저장하고 있습니다.",
      nextAction: "잠시만 기다려 주세요"
    };
  } else if (input.logSaveStatus === "duplicate-risk") {
    dispatch = {
      label: "저장 미확인 · 중복 가능",
      detail: "중복 전송을 막기 위해 자동 재시도를 중단했습니다.",
      nextAction: "관리자에게 저장 여부 대조 요청"
    };
  } else if (input.logSaveStatus === "error") {
    dispatch = {
      label: "로그 저장 실패",
      detail: "전송 결과를 서버에 저장하지 못했습니다.",
      nextAction: "관리자에게 저장 상태 확인 요청"
    };
  } else if (input.dispatchRecordsStatus === "loading") {
    dispatch = {
      label: "전송 이력 확인 중",
      detail: "현재 문서팩의 전송 이력을 확인하고 있습니다.",
      nextAction: "잠시만 기다려 주세요"
    };
  } else if (input.dispatchLogCount > 0) {
    dispatch = {
      label: `저장 로그 ${input.dispatchLogCount}건`,
      detail: input.dispatchRecordsStatus === "error"
        ? "조회 오류 · 마지막 확인 기록 기준"
        : "채널과 전송 결과 저장",
      nextAction: input.dispatchRecordsStatus === "error" ? "전송 로그 다시 조회" : "채널별 결과 검토"
    };
  } else if (input.dispatchRecordsStatus === "unconfigured") {
    dispatch = {
      label: "로그인 후 이력 저장",
      detail: "로그인하면 전송 이력을 서버에 안전하게 저장합니다.",
      nextAction: "로그인"
    };
  } else if (input.dispatchRecordsStatus === "error") {
    dispatch = {
      label: "전송 이력 확인 필요",
      detail: "저장된 전송 로그를 확인하지 못했습니다.",
      nextAction: "전송 로그 다시 조회"
    };
  } else {
    dispatch = {
      label: "첫 전송 전",
      detail: "이 문서팩의 최근 전송 이력이 없습니다.",
      nextAction: "채널 선택 후 전송"
    };
  }

  const acknowledgment: ShareStateDescriptor = buildReadConfirmationStatus({
    hasSession: Boolean(input.activeSession),
    recipientCount,
    workerConfirmedCount: input.workerConfirmationCount,
    adminMarkedCount: input.adminMarkedCount,
    historyError: input.shareRecordsStatus === "error"
  });

  return { storage, session, dispatch, acknowledgment };
}

function formatChannelName(channel?: string) {
  const option = channelOptions.find((item) => item.key === channel);
  return option?.label || "기타 채널";
}

function formatChannelStatus(status?: string, validationOnly = false) {
  if (validationOnly && status === "sent") return "검증 전용";
  if (status === "sent") return "전송 완료";
  if (status === "failed") return "전송 실패";
  if (status === "unconfigured") return "설정 필요";
  if (status === "skipped") return "보류";
  if (status === "partial") return "일부 전송";
  return "결과 확인 필요";
}

function customerSafeMessage(message: string | undefined, fallback: string) {
  void message;
  return fallback;
}

function formatChannelMeta(item: WorkflowDispatchChannelResult) {
  return customerSafeMessage(item.message, "채널별 전송 결과를 확인해 주세요.");
}

function previewLines(message: string) {
  return message.split(/\r?\n/).filter(Boolean);
}

function formatMessageTargetLabel(data: AskResponse, selectedTarget: MessageTarget) {
  if (selectedTarget === "manager") return "관리자용 한국어";
  const languageCode = selectedTarget.replace("foreign:", "");
  const language = data.deliverables.foreignWorkerLanguages.find((item) => item.code === languageCode);
  return language ? `${language.label}(${language.nativeLabel})` : "외국인 근로자 전송본";
}

function formatMessagePreviewHeading(data: AskResponse, selectedTarget: MessageTarget) {
  if (selectedTarget === "manager") return "한국어 전송본 미리보기";
  return `${formatMessageTargetLabel(data, selectedTarget)} 전송본 미리보기`;
}

export function WorkflowSharePanel({
  data,
  recipientSuggestions = [],
  targetWorkers = [],
  authToken,
  workpackId,
  workerIds = [],
  ensureWorkpackSaved,
  readiness
}: WorkflowSharePanelProps) {
  const [selectedChannels, setSelectedChannels] = useState<Channel[]>(["email", "sms"]);
  const [selectedMessageTarget, setSelectedMessageTarget] = useState<MessageTarget>("manager");
  const [isSending, setIsSending] = useState(false);
  const [phase, setPhase] = useState<WorkflowSharePhase>("idle");
  const [resolvedAuthority, setResolvedAuthority] = useState<(ShareAuthority & { targetSignature: string }) | null>(null);
  const [shareRecords, setShareRecords] = useState<ShareRecordsState>(EMPTY_SHARE_RECORDS);
  const [dispatchRecords, setDispatchRecords] = useState<DispatchRecordsState>(EMPTY_DISPATCH_RECORDS);
  const [providerDispatchCapability, setProviderDispatchCapability] = useState<ProviderDispatchCapability | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const selectedMessage = useMemo(() => {
    return resolveWorkflowMessagePreview(data, selectedMessageTarget);
  }, [data, selectedMessageTarget]);
  const targetSignature = useMemo(
    () => buildWorkflowShareTargetSignature(targetWorkers),
    [targetWorkers]
  );
  const propAuthority = useMemo<ShareAuthority | null>(() => {
    if (!workpackId || !targetWorkers.length || workerIds.length !== targetWorkers.length) return null;
    const candidate = { workpackId, workerIds };
    return validateShareAuthority(candidate, targetWorkers.length).ok ? candidate : null;
  }, [targetWorkers.length, workerIds, workpackId]);
  const resolvedAuthorityCandidate = resolvedAuthority
    && resolvedAuthority.targetSignature === targetSignature
    && (!workpackId || resolvedAuthority.workpackId === workpackId)
      ? { workpackId: resolvedAuthority.workpackId, workerIds: resolvedAuthority.workerIds }
      : null;
  const effectiveAuthority = propAuthority || (
    validateShareAuthority(resolvedAuthorityCandidate, targetWorkers.length).ok
      ? resolvedAuthorityCandidate
      : null
  );
  const archiveWorkpackId = authToken
    ? effectiveAuthority?.workpackId || (workpackId && isShareUuid(workpackId) ? workpackId : null)
    : null;
  const dispatchEvidenceScopeKey = buildWorkflowShareEvidenceScopeKey({
    workpackId: archiveWorkpackId,
    targetSignature,
    workerIds: effectiveAuthority?.workerIds || []
  });
  const [dispatchEvidence, updateDispatchEvidence] = useReducer(
    reduceWorkflowShareEvidence,
    dispatchEvidenceScopeKey,
    createWorkflowShareEvidenceState
  );
  const visibleDispatchEvidence = readWorkflowShareEvidenceForScope(
    dispatchEvidence,
    dispatchEvidenceScopeKey
  );
  const { result, resultSource, shareSessionId, logSaveState } = visibleDispatchEvidence;
  const targetSignatureRef = useRef(targetSignature);
  const archiveWorkpackIdRef = useRef(archiveWorkpackId);
  const dispatchInFlightRef = useRef(false);
  targetSignatureRef.current = targetSignature;
  archiveWorkpackIdRef.current = archiveWorkpackId;

  useEffect(() => {
    let active = true;
    loadProviderDispatchCapability(fetch)
      .then((capability) => {
        if (active) setProviderDispatchCapability(capability);
      })
      .catch((error: unknown) => {
        console.warn("provider dispatch capability lookup failed", error);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    updateDispatchEvidence({ type: "scope_changed", scopeKey: dispatchEvidenceScopeKey });
  }, [dispatchEvidenceScopeKey]);

  useEffect(() => {
    if (!authToken || !archiveWorkpackId) {
      setShareRecords(EMPTY_SHARE_RECORDS);
      setDispatchRecords(EMPTY_DISPATCH_RECORDS);
      return;
    }

    let cancelled = false;
    setShareRecords((current) => ({ ...current, status: "loading", message: "공유 세션과 준비 이력을 조회하고 있습니다." }));
    setDispatchRecords((current) => ({ ...current, status: "loading", message: "현재 workpack의 전송 로그를 조회하고 있습니다." }));

    const requestJson = async (url: string): Promise<{ httpOk: boolean; payload: unknown }> => {
      const response = await fetch(url, {
        headers: { authorization: `Bearer ${authToken}` }
      });
      let payload: unknown = {};
      try {
        payload = await response.json() as unknown;
      } catch (error) {
        console.warn("workflow share archive response parse failed", error);
      }
      return { httpOk: response.ok, payload };
    };

    void Promise.allSettled([
      requestJson(`/api/workpacks/${encodeURIComponent(archiveWorkpackId)}/share-sessions`),
      requestJson("/api/dispatch-logs?limit=100")
    ]).then(([shareOutcome, dispatchOutcome]) => {
      if (cancelled) return;
      const shareResponse = shareOutcome.status === "fulfilled" ? shareOutcome.value : null;
      const dispatchResponse = dispatchOutcome.status === "fulfilled" ? dispatchOutcome.value : null;
      const archive = parseWorkflowShareArchive(
        shareResponse?.payload || {},
        dispatchResponse?.payload || {},
        archiveWorkpackId
      );
      const shareStatus: RemoteRecordStatus = shareOutcome.status === "rejected"
        ? "error"
        : !archive.shareConfigured
          ? "unconfigured"
          : !shareResponse?.httpOk || !archive.shareOk
            ? "error"
            : "ready";
      const dispatchStatus: RemoteRecordStatus = dispatchOutcome.status === "rejected"
        ? "error"
        : !archive.dispatchConfigured
          ? "unconfigured"
          : !dispatchResponse?.httpOk || !archive.dispatchOk
            ? "error"
            : "ready";
      const shareFailure = shareOutcome.status === "rejected"
        ? shareOutcome.reason instanceof Error ? shareOutcome.reason.message : "공유 세션 조회 요청에 실패했습니다."
        : archive.shareMessage;
      const dispatchFailure = dispatchOutcome.status === "rejected"
        ? dispatchOutcome.reason instanceof Error ? dispatchOutcome.reason.message : "전송 로그 조회 요청에 실패했습니다."
        : archive.dispatchMessage;

      setShareRecords({
        status: shareStatus,
        message: shareFailure,
        sessions: archive.sessions,
        confirmations: archive.confirmations
      });
      setDispatchRecords({
        status: dispatchStatus,
        message: dispatchFailure,
        logs: archive.logs
      });
    });

    return () => {
      cancelled = true;
    };
  }, [archiveWorkpackId, authToken, historyRefreshKey]);

  const sessionPolicyNow = Date.now();
  const reusableSession = selectReusableShareSession(
    shareRecords.sessions,
    effectiveAuthority,
    targetWorkers.length,
    sessionPolicyNow
  );
  const authoritySession = selectAuthorityShareSession(
    shareRecords.sessions,
    effectiveAuthority,
    targetWorkers.length
  );
  const activeSession = reusableSession || authoritySession;
  const sessionReuseDecision = activeSession
    ? evaluateShareSessionReuse(activeSession, effectiveAuthority, targetWorkers.length, sessionPolicyNow)
    : null;
  const sessionReuseReason = sessionReuseDecision && !sessionReuseDecision.reusable
    ? sessionReuseDecision.reason
    : null;
  const confirmationSummary = summarizeReadConfirmations(
    shareRecords.confirmations,
    activeSession?.id || null
  );
  const dispatchLogCount = Math.max(dispatchRecords.logs.length, logSaveState.knownTotal);
  const statusModel = deriveWorkflowShareStatus({
    authenticated: Boolean(authToken),
    targetCount: targetWorkers.length,
    workpackId: archiveWorkpackId,
    serverWorkerIdCount: effectiveAuthority?.workerIds.length || 0,
    phase,
    shareRecordsStatus: shareRecords.status,
    dispatchRecordsStatus: dispatchRecords.status,
    logSaveStatus: logSaveState.status,
    activeSession,
    sessionReusable: Boolean(reusableSession),
    sessionReuseReason,
    dispatchLogCount,
    workerConfirmationCount: confirmationSummary.workerConfirmedCount,
    adminMarkedCount: confirmationSummary.adminMarkedCount
  });

  function toggleChannel(channel: Channel) {
    const option = channelOptions.find((item) => item.key === channel);
    if (!option?.enabled) return;
    setSelectedChannels((current) => (
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel]
    ));
  }

  async function saveDispatchHistory(request: DispatchArchiveRequest, evidenceScopeKey: string): Promise<void> {
    if (!authToken) {
      updateDispatchEvidence({
        type: "set_log",
        scopeKey: evidenceScopeKey,
        logSaveState: {
          status: "error",
          message: "관리자 세션이 없어 provider 결과를 저장하지 못했습니다.",
          savedCount: 0,
          knownTotal: dispatchRecords.logs.length
        }
      });
      return;
    }

    setPhase("saving-log");
    updateDispatchEvidence({
      type: "set_log",
      scopeKey: evidenceScopeKey,
      logSaveState: {
        status: "saving",
        message: "provider 결과를 dispatch_logs에 저장하고 있습니다.",
        savedCount: 0,
        knownTotal: dispatchRecords.logs.length
      }
    });
    try {
      const response = await fetch("/api/dispatch-logs", {
        method: "POST",
        headers: {
          authorization: `Bearer ${authToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(request)
      });
      let body: unknown = {};
      try {
        body = await response.json() as unknown;
      } catch (error) {
        console.warn("dispatch log save response parse failed", error);
      }
      const payload = isRecord(body) ? body : {};
      if (!response.ok || payload.ok !== true) {
        throw new Error(readString(payload.message) || `전송 로그 저장 실패 (HTTP ${response.status})`);
      }
      const savedCount = typeof payload.savedCount === "number" ? payload.savedCount : request.logs.length;
      updateDispatchEvidence({
        type: "set_log",
        scopeKey: evidenceScopeKey,
        logSaveState: {
          status: "saved",
          message: `provider 결과 ${savedCount}건을 전송 로그로 저장했습니다.`,
          savedCount,
          knownTotal: dispatchRecords.logs.length + savedCount
        }
      });
      setHistoryRefreshKey((current) => current + 1);
    } catch (error) {
      console.error("dispatch log save failed", error);
      const retryPolicy = getDispatchLogRetryPolicy(DISPATCH_LOG_IDEMPOTENCY_SUPPORTED);
      const failureMessage = error instanceof Error
        ? error.message
        : "전송 로그 저장 중 알 수 없는 오류가 발생했습니다.";
      updateDispatchEvidence({
        type: "set_log",
        scopeKey: evidenceScopeKey,
        logSaveState: {
          status: retryPolicy.duplicateRisk ? "duplicate-risk" : "error",
          message: `${failureMessage} ${retryPolicy.message} 요청 키 ${request.idempotencyKey}`,
          savedCount: 0,
          knownTotal: dispatchRecords.logs.length
        }
      });
    }
  }

  async function dispatchWorkflow() {
    if (dispatchInFlightRef.current) return;
    if (!providerDispatchUi.canDispatch) return;
    let evidenceScopeKey = dispatchEvidenceScopeKey;
    const activeChannels = selectedChannels.filter((channel): channel is ActiveChannel => (
      activeDispatchChannels.includes(channel as ActiveChannel)
    ));
    if (!authToken) {
      updateDispatchEvidence({
        type: "set_result",
        scopeKey: evidenceScopeKey,
        result: {
          ok: false,
          configured: true,
          message: "관리자 로그인 후 서버 공유 세션을 만들 수 있습니다. 비회원 초안은 서버 전파 기록으로 남지 않습니다."
        },
        resultSource: "dispatch"
      });
      return;
    }
    if (!targetWorkers.length) {
      updateDispatchEvidence({
        type: "set_result",
        scopeKey: evidenceScopeKey,
        result: { ok: false, configured: true, message: "공유할 작업자를 한 명 이상 선택해 주세요." },
        resultSource: "dispatch"
      });
      return;
    }
    if (!activeChannels.length) {
      updateDispatchEvidence({
        type: "set_result",
        scopeKey: evidenceScopeKey,
        result: {
          ok: false,
          configured: true,
          message: "현재 활성 전파 채널은 메일·문자·카카오 알림톡입니다. 하나 이상의 채널을 선택해 주세요."
        },
        resultSource: "dispatch"
      });
      return;
    }
    const recipientMessageVariants = buildCanonicalRecipientMessageVariants({
      data,
      recipientLanguageCodes: targetWorkers.map((worker) => worker.languageCode)
    });
    if (!recipientMessageVariants.ok) {
      updateDispatchEvidence({
        type: "set_result",
        scopeKey: evidenceScopeKey,
        result: {
          ok: false,
          configured: true,
          providerCalled: false,
          message: `저장할 작업자 언어 본문을 검증하지 못했습니다: ${[
            ...recipientMessageVariants.invalidLanguageCodes,
            ...recipientMessageVariants.koreanLeakLanguageCodes,
            ...recipientMessageVariants.malformedFields
          ].join(", ")}`
        },
        resultSource: "dispatch"
      });
      return;
    }

    dispatchInFlightRef.current = true;
    setIsSending(true);
    updateDispatchEvidence({ type: "begin_dispatch", scopeKey: evidenceScopeKey });
    try {
      let authority = effectiveAuthority;
      if (!authority) {
        setPhase("saving-workpack");
        authority = await ensureWorkpackSaved?.() || null;
      }
      if (!authority) {
        throw new Error("문서팩과 작업자 서버 저장이 완료되지 않아 공유 세션을 만들 수 없습니다.");
      }
      const authorityValidation = validateShareAuthority(authority, targetWorkers.length);
      if (!authorityValidation.ok) {
        if (authorityValidation.reason === "workpack_id_invalid") {
          throw new Error("서버가 반환한 workpack ID가 올바른 UUID가 아니어서 공유를 중단했습니다.");
        }
        throw new Error(`대상 ${targetWorkers.length}명과 유효한 서버 작업자 UUID가 일치하지 않습니다.`);
      }
      setResolvedAuthority({ ...authority, targetSignature });
      const authorityScopeKey = buildWorkflowShareEvidenceScopeKey({
        workpackId: authority.workpackId,
        targetSignature,
        workerIds: authority.workerIds
      });
      if (
        targetSignatureRef.current !== targetSignature
        || Boolean(archiveWorkpackIdRef.current && archiveWorkpackIdRef.current !== authority.workpackId)
      ) {
        throw new Error("공유 대상 또는 workpack이 변경되어 provider 전송을 시작하지 않았습니다.");
      }
      if (authorityScopeKey !== evidenceScopeKey) {
        updateDispatchEvidence({ type: "scope_changed", scopeKey: authorityScopeKey });
        evidenceScopeKey = authorityScopeKey;
      }

      const reusableSession = selectReusableShareSession(
        shareRecords.sessions,
        authority,
        targetWorkers.length,
        Date.now()
      );
      let activeShareSessionId = reusableSession?.id || null;
      if (!activeShareSessionId) {
        setPhase("creating-session");
        const session = await createAuthenticatedShareSession(fetch, {
          authToken,
          workpackId: authority.workpackId,
          workerIds: authority.workerIds
        });
        activeShareSessionId = session.shareSessionId;
        setHistoryRefreshKey((current) => current + 1);
      }
      if (
        targetSignatureRef.current !== targetSignature
        || Boolean(archiveWorkpackIdRef.current && archiveWorkpackIdRef.current !== authority.workpackId)
      ) {
        throw new Error("공유 대상 또는 workpack이 변경되어 provider 전송을 시작하지 않았습니다.");
      }
      updateDispatchEvidence({
        type: "set_session",
        scopeKey: evidenceScopeKey,
        shareSessionId: activeShareSessionId
      });

      setPhase("dispatching");
      const dispatchAttemptId = crypto.randomUUID();
      const providerIdempotencyKey = buildProviderDispatchIdempotencyKey({
        workpackId: authority.workpackId,
        shareSessionId: activeShareSessionId,
        dispatchAttemptId,
        channels: activeChannels
      });
      const payload = await dispatchAuthenticatedShareSession(fetch, {
        authToken,
        workpackId: authority.workpackId,
        shareSessionId: activeShareSessionId,
        idempotencyKey: providerIdempotencyKey,
        channels: activeChannels,
        operatorNote: "",
        messageVariants: recipientMessageVariants.messageVariants
      });
      updateDispatchEvidence({
        type: "set_result",
        scopeKey: evidenceScopeKey,
        result: payload,
        resultSource: "dispatch"
      });
      const logs = buildDispatchLogDrafts({
        result: payload,
        workpackId: authority.workpackId,
        shareSessionId: activeShareSessionId,
        workerIds: authority.workerIds
      });
      if (payload.duplicateRisk || payload.providerStatus === "idempotency-unsupported") {
        updateDispatchEvidence({
          type: "set_log",
          scopeKey: evidenceScopeKey,
          logSaveState: {
            status: "skipped",
            message: payload.providerCalled === true
              ? `Provider 응답 미확정 · 중복 가능 · 재전송 금지 · 요청 키 ${providerIdempotencyKey}`
              : `Provider 호출 차단 · 영속 idempotency 미지원 · 요청 키 ${providerIdempotencyKey}`,
            savedCount: 0,
            knownTotal: dispatchRecords.logs.length
          }
        });
      } else if (isValidationOnlyDispatch(payload)) {
        updateDispatchEvidence({
          type: "set_log",
          scopeKey: evidenceScopeKey,
          logSaveState: {
            status: "skipped",
            message: "Fixture·검증 전용 응답은 실제 전송 로그로 저장하지 않았습니다.",
            savedCount: 0,
            knownTotal: dispatchRecords.logs.length
          }
        });
      } else if (payload.providerCalled === false) {
        updateDispatchEvidence({
          type: "set_log",
          scopeKey: evidenceScopeKey,
          logSaveState: {
            status: "skipped",
            message: `Provider 호출 없음 · ${payload.message}`,
            savedCount: 0,
            knownTotal: dispatchRecords.logs.length
          }
        });
      } else if (!logs.length) {
        updateDispatchEvidence({
          type: "set_log",
          scopeKey: evidenceScopeKey,
          logSaveState: {
            status: "error",
            message: "채널별 provider 결과가 없어 저장할 전송 로그를 만들지 못했습니다.",
            savedCount: 0,
            knownTotal: dispatchRecords.logs.length
          }
        });
      } else {
        const idempotencyKey = buildDispatchLogIdempotencyKey({
          workpackId: authority.workpackId,
          shareSessionId: activeShareSessionId,
          dispatchAttemptId,
          workflowRunId: payload.workflowRunId,
          logs
        });
        const idempotentLogs = logs.map((log) => ({
          ...log,
          payload: { ...log.payload, idempotencyKey }
        }));
        await saveDispatchHistory({
          scenario: data.scenario,
          workpackId: authority.workpackId,
          idempotencyKey,
          logs: idempotentLogs
        }, evidenceScopeKey);
      }
    } catch (error) {
      console.error("workflow dispatch request failed", error);
      updateDispatchEvidence({
        type: "set_result",
        scopeKey: evidenceScopeKey,
        result: {
          ok: false,
          configured: true,
          message: error instanceof Error ? error.message : "전파 요청 중 알 수 없는 오류가 발생했습니다."
        },
        resultSource: "dispatch"
      });
    } finally {
      dispatchInFlightRef.current = false;
      setPhase("idle");
      setIsSending(false);
    }
  }

  const recipientLabel = targetWorkers.length ? `${targetWorkers.length}명 선택` : "작업자 선택 필요";
  const previewItems = previewLines(selectedMessage);
  const storageReady = Boolean(authToken && effectiveAuthority);
  const sessionReady = Boolean(reusableSession);
  const validationOnlyResult = Boolean(
    resultSource === "dispatch" && result && isValidationOnlyDispatch(result)
  );
  const dispatchPresentation = classifyWorkflowDispatchPresentation({
    result,
    resultSource,
    validationOnly: validationOnlyResult
  });
  const resultSucceeded = dispatchPresentation.succeeded;
  const resultHasFailure = dispatchPresentation.hasFailure;
  const resultClassName = resultSucceeded
    ? "workflow-result ok"
    : resultHasFailure
      ? "workflow-result error"
      : "workflow-result";
  const shareBlocked = Boolean(readiness && !readiness.canShare);
  const shareDisabledReasons = readiness?.reasons.length
    ? readiness.reasons
    : ["서버 검수 조건을 확인해 주세요."];
  const canResolveAuthority = Boolean(effectiveAuthority || ensureWorkpackSaved);
  const providerDispatchUi = buildProviderDispatchUiContract(providerDispatchCapability);
  const primaryDisabled = Boolean(
    providerDispatchUi.primaryDisabled
    || !authToken
    || shareBlocked
    || isSending
    || shareRecords.status === "loading"
    || shareRecords.status === "error"
    || !selectedChannels.length
    || !targetWorkers.length
    || !canResolveAuthority
  );
  const phaseLabel: Record<WorkflowSharePhase, string> = {
    idle: "문서팩 전송하기",
    "saving-workpack": "문서팩 저장 중",
    "creating-session": "공유 준비 중",
    dispatching: "전송 중",
    "saving-log": "전송 결과 저장 중"
  };
  const primaryLabel = isSending
    ? phaseLabel[phase]
    : !providerDispatchUi.canDispatch
      ? providerDispatchUi.primaryLabel
      : !authToken
      ? "로그인하고 전송하기"
      : shareBlocked
        ? "보완 후 전송할 수 있어요"
        : shareRecords.status === "loading"
          ? "공유 이력 확인 중"
          : shareRecords.status === "error"
            ? "공유 이력 확인 필요"
        : !targetWorkers.length
          ? "작업자 선택 필요"
          : !canResolveAuthority
            ? "작업공간에서 저장 필요"
            : !effectiveAuthority
              ? "저장 후 전송하기"
              : "문서팩 전송하기";
  return (
    <article className={`share-panel workflow-panel ${styles.panel}`} id="dispatch" data-share-root>
      <header className="share-workflow-header">
        <div>
          <span className="eyebrow">오늘 작업</span>
          <strong>{providerDispatchUi.canDispatch ? "문서팩 보내기" : "언어별 전송본 미리보기"}</strong>
          <p>선택한 대상의 작업자 언어로 안전 내용을 준비하고 확인합니다.</p>
        </div>
        <div className="share-status-pill" aria-label="공유 워크플로 상태" aria-live="polite">
          <span>{providerDispatchUi.canDispatch ? (shareBlocked ? "보완 필요" : sessionReady ? "공유 가능" : storageReady ? "저장 완료" : "전송 준비") : "미리보기 전용"}</span>
          <strong>{shareBlocked ? readiness?.summary : isSending ? phaseLabel[phase] : statusModel.dispatch.label}</strong>
        </div>
      </header>

      <div className="share-form-shell">
        <section className="share-form-card share-recipient-card" aria-labelledby="workflow-recipient-heading" data-share-owner="targets">
          <div className="recipient-section-head">
            <span className="share-form-step">01</span>
            <span className="field-label" id="workflow-recipient-heading">오늘 대상</span>
            <span>{recipientLabel}</span>
          </div>
          {targetWorkers.length ? (
            <div className="recipient-chip-list" aria-label="선택된 공유 대상">
              {targetWorkers.map((worker) => (
                <span key={`${worker.displayName}-${worker.languageCode}`} className="recipient-chip">
                  {worker.displayName} · {worker.languageLabel}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted small">오늘 작업에 참여할 작업자를 먼저 선택해 주세요.</p>
          )}
          {recipientSuggestions.length ? (
            <p className="muted small">선택한 대상에게 언어별 전송본을 준비합니다.</p>
          ) : targetWorkers.length ? (
            <p className="muted small">선택한 참여자의 연락처를 확인해 주세요.</p>
          ) : null}
          <a className="button secondary" href="/workers">대상 변경</a>
        </section>

        <section className="share-form-card" aria-labelledby="workflow-channel-heading" data-share-owner="channels">
          <div className="share-form-card-head">
            <span>02</span>
            <strong id="workflow-channel-heading">채널</strong>
          </div>
          <div className="channel-grid" aria-label="전파 채널 선택">
            {channelOptions.map((channel) => {
              const channelEnabled = channel.enabled && providerDispatchUi.canDispatch;
              const channelBadge = providerDispatchUi.canDispatch ? channel.badge : providerDispatchUi.channelBadge;
              const channelSelected = channelEnabled && selectedChannels.includes(channel.key);
              return (
                <button
                  key={channel.key}
                  type="button"
                  className={`channel-card ${channelSelected ? "active" : ""} ${channelEnabled ? "" : "disabled"}`}
                  onClick={() => toggleChannel(channel.key)}
                  disabled={!channelEnabled}
                  aria-disabled={!channelEnabled}
                  aria-pressed={channelSelected}
                  aria-label={`${channel.label} · ${channelBadge}. 다음 행동: ${channel.nextAction}`}
                >
                  <strong>{channel.label}</strong>
                  {channelBadge !== "사용 가능" ? <em>{channelBadge}</em> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="share-form-card" aria-labelledby="workflow-language-heading" data-share-owner="language-preview">
          <div className="share-form-card-head">
            <span>03</span>
            <strong id="workflow-language-heading">언어 미리보기</strong>
          </div>
          <label className="field-label" htmlFor="workflow-language-select">전송본 확인 언어</label>
          <select
            id="workflow-language-select"
            className="input"
            value={selectedMessageTarget}
            onChange={(event) => setSelectedMessageTarget(event.target.value as MessageTarget)}
          >
            <option value="manager">관리자용 한국어</option>
            {data.deliverables.foreignWorkerLanguages.map((language) => (
              <option key={language.code} value={`foreign:${language.code}`}>
                {language.label} · {language.nativeLabel}
              </option>
            ))}
          </select>
          <p className="channel-readiness-note">
            미리보기 선택은 전송 본문을 바꾸지 않습니다. 요청에는 작업자별 저장 언어 본문을 각각 포함합니다.
          </p>
        </section>

      </div>

      {authToken && !archiveWorkpackId ? (
        <p className="share-inline-note">
          전송을 확정하면 문서팩과 선택한 작업자를 먼저 안전하게 저장합니다.
        </p>
      ) : null}

      {shareBlocked ? (
        <section className="share-readiness-warning" aria-label="공유 전 보완 항목" role="status">
          <span>전송 전 확인</span>
          <strong>{readiness?.summary || "공유 전 보완 필요"}</strong>
          <p className="share-inline-note">{shareDisabledReasons.join(" · ")}</p>
        </section>
      ) : null}

      <section className="message-preview-panel" aria-label={formatMessagePreviewHeading(data, selectedMessageTarget)} data-share-preview>
        <div className="compact-head">
          <span className="eyebrow">메시지 미리보기</span>
          <strong>{formatMessagePreviewHeading(data, selectedMessageTarget)}</strong>
        </div>
        <div className="message-preview-lines">
          {previewItems.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
        </div>
      </section>

      <div className="command-actions">
        {!authToken && providerDispatchUi.canDispatch ? (
          <a href="/login" className="button command-primary workbench-primary-action" data-share-primary>{primaryLabel}</a>
        ) : (
          <button
            type="button"
            className="button command-primary workbench-primary-action"
            onClick={dispatchWorkflow}
            disabled={primaryDisabled}
            data-share-primary
          >
            {primaryLabel}
          </button>
        )}
      </div>

      {result ? (
        <div className={resultClassName}>
          <p>
            {customerSafeMessage(result.message, "채널별 전송 결과를 확인해 주세요.")}
          </p>
          {validationOnlyResult ? (
            <p>미리 확인용 응답입니다. 실제 전송 기록으로 저장하지 않습니다.</p>
          ) : null}
          {result.duplicateRisk ? (
            <p role="alert">
              {result.providerCalled === true
                ? "전송 결과를 확정하지 못했습니다. 실제 발송되었을 수 있으므로 재전송하지 말고 관리자에게 확인하세요."
                : "중복 전송을 안전하게 막을 수 없어 전송을 시작하지 않았습니다. 관리자에게 확인해 주세요."}
            </p>
          ) : null}
          {resultSource === "dispatch" ? (
            <p>전송 이력 · {customerSafeMessage(logSaveState.message, "저장 상태를 확인해 주세요.")}</p>
          ) : null}
          {result.channelResults?.length ? (
            <div className="workflow-channel-results" aria-label="채널별 전송 결과">
              {result.channelResults.map((item, index) => (
                <div
                  key={`${item.channel || "channel"}-${index}`}
                  className={`workflow-channel-result ${validationOnlyResult ? "validation-only" : item.status || "received"}`}
                >
                  <strong>{formatChannelName(item.channel)}</strong>
                  <span>{formatChannelStatus(item.status, validationOnlyResult)}</span>
                  {formatChannelMeta(item) ? <small>{formatChannelMeta(item)}</small> : null}
                </div>
              ))}
            </div>
          ) : null}
          {logSaveState.status === "duplicate-risk" ? (
            <p role="alert">전송 로그는 자동 재시도하지 않습니다. 관리자에게 요청 키로 저장 여부를 먼저 대조해 주세요.</p>
          ) : null}
        </div>
      ) : null}

    </article>
  );
}
