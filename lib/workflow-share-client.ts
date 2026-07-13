import {
  parseSupportedLanguageCode,
  SUPPORTED_LANGUAGE_CODES,
  type SupportedLanguageCode
} from "@/lib/foreign-worker";

export type WorkflowShareChannel = "email" | "sms" | "kakao";

export type LocalizedSharePreview = {
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

export type AuthenticatedShareAuthorityFailure = {
  ok: false;
  reasonCode:
    | "workpack_not_saved"
    | "workpack_revision_or_digest_changed"
    | "recipient_locale_invalid"
    | "translation_incomplete"
    | "translation_not_reviewed"
    | "translation_rejected";
  validatedSupportedCode?: SupportedLanguageCode;
};

export type AuthenticatedShareAuthority = {
  ok: true;
  workpackId: string;
  workerIds: string[];
  recipientLocales: SupportedLanguageCode[];
  canonicalWorkpackRevision: string;
  previews: Partial<Record<SupportedLanguageCode, LocalizedSharePreview>>;
};

export type AuthenticatedChannelResolution = {
  ok: true;
  ready: boolean;
  workpackId: string;
  canonicalWorkpackRevision: string;
  requestedChannels: WorkflowShareChannel[];
  availabilityToken: string;
  expiresAt: string;
  channels: Array<{
    channel: WorkflowShareChannel;
    available: boolean;
    reasonCode: string;
  }>;
};

export type WorkflowDispatchChannelResult = {
  channel?: string;
  provider?: string;
  status?: string;
  message?: string;
  httpStatus?: number;
};

export type WorkflowDispatchResult = {
  ok: boolean;
  configured: boolean;
  message: string;
  workflowRunId?: string;
  providerStatus?: string;
  idempotencyKey?: string;
  idempotencySupported?: boolean;
  duplicateRisk?: boolean;
  providerCalled?: boolean;
  channelResults?: WorkflowDispatchChannelResult[];
};

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export class WorkflowShareRequestError extends Error {
  readonly reasonCode: string | null;

  constructor(message: string, reasonCode: string | null = null) {
    super(message);
    this.name = "WorkflowShareRequestError";
    this.reasonCode = reasonCode;
  }
}

type ShareSessionRequest = {
  authToken: string;
  workpackId: string;
  workerIds: string[];
  channels: readonly WorkflowShareChannel[];
  canonicalWorkpackRevision: string;
  availabilityToken: string;
};

type DispatchRequest = {
  authToken: string;
  workpackId: string;
  shareSessionId: string;
  idempotencyKey: string;
  channels: WorkflowShareChannel[];
  operatorNote: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digestPattern = /^[0-9a-f]{64}$/i;
const providerIdempotencyKeyPattern = /^provider-dispatch-v1-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[0-9a-f]{8}$/i;
const hangulPattern = /[가-힣]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function readResponseBody(response: Response): Promise<Record<string, unknown>> {
  try {
    const body = await response.json() as unknown;
    return isRecord(body) ? body : {};
  } catch (error) {
    console.warn("workflow share response parse failed", error);
    return {};
  }
}

function requireBearerContext(authToken: string, workpackId: string): void {
  if (!authToken.trim()) throw new Error("관리자 인증 토큰이 필요합니다.");
  if (!uuidPattern.test(workpackId)) throw new Error("서버 workpackId가 올바른 UUID가 아닙니다.");
}

function buildHeaders(authToken: string): Record<string, string> {
  return {
    authorization: `Bearer ${authToken}`,
    "content-type": "application/json"
  };
}

function buildHttpError(body: Record<string, unknown>, response: Response, fallback: string): Error {
  return new WorkflowShareRequestError(
    `${readString(body.message) || fallback} (HTTP ${response.status})`,
    readString(body.reasonCode) || null
  );
}

function parseChannelResults(value: unknown): WorkflowDispatchChannelResult[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const results = value.filter(isRecord).map((item) => ({
    channel: readString(item.channel),
    provider: readString(item.provider),
    status: readString(item.status),
    message: readString(item.message),
    httpStatus: typeof item.httpStatus === "number" ? item.httpStatus : undefined
  }));
  return results.length ? results : undefined;
}

function readRequiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const items = value.map(readRequiredString);
  return items.every((item): item is string => item !== null) ? items : null;
}

function parseLocalizedPreview(value: unknown, locale: SupportedLanguageCode): {
  ok: true;
  preview: LocalizedSharePreview;
} | AuthenticatedShareAuthorityFailure {
  if (!isRecord(value)) {
    return { ok: false, reasonCode: "translation_incomplete", validatedSupportedCode: locale };
  }
  if (value.targetLocale !== locale || !digestPattern.test(readString(value.artifactDigest) || "")) {
    return { ok: false, reasonCode: "translation_incomplete", validatedSupportedCode: locale };
  }
  if (!isRecord(value.review)) {
    return { ok: false, reasonCode: "translation_not_reviewed", validatedSupportedCode: locale };
  }
  if (value.review.state === "rejected") {
    return { ok: false, reasonCode: "translation_rejected", validatedSupportedCode: locale };
  }
  if (value.review.state !== "approved" || !isRecord(value.artifact) || value.artifact.targetLocale !== locale) {
    return { ok: false, reasonCode: "translation_not_reviewed", validatedSupportedCode: locale };
  }
  const localized = isRecord(value.artifact.localized) ? value.artifact.localized : null;
  const metadata = localized && isRecord(localized.metadata) ? localized.metadata : null;
  const subject = readRequiredString(localized?.subject);
  const siteLabel = readRequiredString(metadata?.siteLabel);
  const siteValue = readRequiredString(metadata?.siteValue);
  const taskLabel = readRequiredString(metadata?.taskLabel);
  const taskValue = readRequiredString(metadata?.taskValue);
  const coreRiskLabel = readRequiredString(metadata?.coreRiskLabel);
  const coreRiskValue = readRequiredString(metadata?.coreRiskValue);
  const bodyLines = readStringArray(localized?.bodyLines);
  const semanticRiskLabels = readStringArray(localized?.semanticRiskLabels);
  if (
    !subject
    || !siteLabel
    || !siteValue
    || !taskLabel
    || !taskValue
    || !coreRiskLabel
    || !coreRiskValue
    || !bodyLines
    || !semanticRiskLabels
  ) {
    return { ok: false, reasonCode: "translation_incomplete", validatedSupportedCode: locale };
  }
  const preview: LocalizedSharePreview = {
    subject,
    metadata: { siteLabel, siteValue, taskLabel, taskValue, coreRiskLabel, coreRiskValue },
    bodyLines,
    semanticRiskLabels
  };
  if (locale !== "ko" && hangulPattern.test(JSON.stringify(preview))) {
    return { ok: false, reasonCode: "translation_incomplete", validatedSupportedCode: locale };
  }
  return { ok: true, preview };
}

function buildKoreanPreview(reopenData: Record<string, unknown>): LocalizedSharePreview | null {
  const scenario = isRecord(reopenData.scenario) ? reopenData.scenario : null;
  const riskSummary = isRecord(reopenData.riskSummary) ? reopenData.riskSummary : null;
  const deliverables = isRecord(reopenData.deliverables) ? reopenData.deliverables : null;
  const companyName = readRequiredString(scenario?.companyName);
  const siteName = readRequiredString(scenario?.siteName);
  const workSummary = readRequiredString(scenario?.workSummary);
  const topRisk = readRequiredString(riskSummary?.topRisk);
  const transmission = readRequiredString(deliverables?.foreignWorkerTransmission);
  if (!companyName || !siteName || !workSummary || !topRisk || !transmission) return null;
  const immediateActions = Array.isArray(riskSummary?.immediateActions)
    ? riskSummary.immediateActions.flatMap((item): string[] => {
        const action = readRequiredString(item);
        return action ? [action] : [];
      })
    : [];
  return {
    subject: `[SafeClaw 안전공지] ${companyName}`,
    metadata: {
      siteLabel: "현장",
      siteValue: siteName,
      taskLabel: "작업",
      taskValue: workSummary,
      coreRiskLabel: "핵심 위험",
      coreRiskValue: topRisk
    },
    bodyLines: transmission.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    semanticRiskLabels: [topRisk, ...immediateActions]
  };
}

export function parseAuthenticatedWorkpackShareAuthority(input: {
  expectedWorkpackId: string;
  expectedGenerationEvidenceSignature: string;
  recipientLocales: SupportedLanguageCode[];
  payload: unknown;
}): Omit<AuthenticatedShareAuthority, "workerIds" | "recipientLocales"> | AuthenticatedShareAuthorityFailure {
  const body = isRecord(input.payload) ? input.payload : {};
  const workpack = isRecord(body.workpack) ? body.workpack : null;
  const reopenData = workpack && isRecord(workpack.reopenData) ? workpack.reopenData : null;
  const generationEvidence = reopenData && isRecord(reopenData.generationEvidence)
    ? reopenData.generationEvidence
    : null;
  if (
    body.ok !== true
    || !workpack
    || workpack.id !== input.expectedWorkpackId
    || !reopenData
    || generationEvidence?.signature !== input.expectedGenerationEvidenceSignature
  ) {
    return { ok: false, reasonCode: "workpack_revision_or_digest_changed" };
  }
  const localization = isRecord(body.shareLocalization) ? body.shareLocalization : null;
  if (!localization || localization.ok !== true) {
    const reasonCode = localization?.reasonCode;
    if (
      reasonCode === "recipient_locale_invalid"
      || reasonCode === "translation_incomplete"
      || reasonCode === "translation_not_reviewed"
      || reasonCode === "translation_rejected"
    ) {
      const supported = parseSupportedLanguageCode(localization?.validatedSupportedCode);
      return {
        ok: false,
        reasonCode,
        ...(supported.status === "supported" ? { validatedSupportedCode: supported.locale } : {})
      };
    }
    return { ok: false, reasonCode: "workpack_revision_or_digest_changed" };
  }
  const canonicalWorkpackRevision = readRequiredString(localization.canonicalWorkpackRevision);
  if (!canonicalWorkpackRevision || !digestPattern.test(canonicalWorkpackRevision)) {
    return { ok: false, reasonCode: "workpack_revision_or_digest_changed" };
  }
  const reviewedEnvelopes = isRecord(localization.reviewedEnvelopes)
    ? localization.reviewedEnvelopes
    : {};
  const previews: Partial<Record<SupportedLanguageCode, LocalizedSharePreview>> = {};
  const koreanPreview = buildKoreanPreview(reopenData);
  if (koreanPreview) previews.ko = koreanPreview;
  for (const locale of SUPPORTED_LANGUAGE_CODES) {
    if (locale === "ko" || reviewedEnvelopes[locale] === undefined) continue;
    const parsed = parseLocalizedPreview(reviewedEnvelopes[locale], locale);
    if (parsed.ok) previews[locale] = parsed.preview;
  }
  for (const locale of new Set(input.recipientLocales)) {
    if (locale === "ko") {
      if (!previews.ko) return { ok: false, reasonCode: "translation_incomplete", validatedSupportedCode: "ko" };
      continue;
    }
    const requiredEnvelope = parseLocalizedPreview(reviewedEnvelopes[locale], locale);
    if (!requiredEnvelope.ok) return requiredEnvelope;
    previews[locale] = requiredEnvelope.preview;
  }
  return {
    ok: true,
    workpackId: input.expectedWorkpackId,
    canonicalWorkpackRevision,
    previews
  };
}

async function readAuthenticatedJson(
  fetcher: Fetcher,
  input: string,
  authToken: string
): Promise<Record<string, unknown>> {
  const response = await fetcher(input, {
    method: "GET",
    headers: { authorization: `Bearer ${authToken}` }
  });
  const body = await readResponseBody(response);
  if (!response.ok || body.ok !== true) throw buildHttpError(body, response, "Share 권위 조회에 실패했습니다.");
  return body;
}

function readWorkpackCandidateIds(payload: Record<string, unknown>, question: string): string[] {
  if (!Array.isArray(payload.workpacks)) return [];
  return payload.workpacks.flatMap((item): string[] => {
    if (!isRecord(item) || item.question !== question) return [];
    const id = readRequiredString(item.id);
    return id && uuidPattern.test(id) ? [id] : [];
  }).slice(0, 10);
}

function detailGenerationSignature(payload: Record<string, unknown>): string | null {
  const workpack = isRecord(payload.workpack) ? payload.workpack : null;
  const reopenData = workpack && isRecord(workpack.reopenData) ? workpack.reopenData : null;
  const generationEvidence = reopenData && isRecord(reopenData.generationEvidence)
    ? reopenData.generationEvidence
    : null;
  return readRequiredString(generationEvidence?.signature);
}

export async function loadAuthenticatedShareAuthority(fetcher: Fetcher, request: {
  authToken: string;
  knownWorkpackId: string | null;
  question: string;
  generationEvidenceSignature: string;
  scenario: { companyName: string; siteName: string; companyType: string };
  selectedWorkers: Array<{ externalKey: string; displayName: string; languageCode: string }>;
}): Promise<AuthenticatedShareAuthority | AuthenticatedShareAuthorityFailure> {
  if (!request.authToken.trim()) throw new Error("관리자 인증 토큰이 필요합니다.");
  if (!request.selectedWorkers.length) return { ok: false, reasonCode: "recipient_locale_invalid" };
  const candidateIds = request.knownWorkpackId && uuidPattern.test(request.knownWorkpackId)
    ? [request.knownWorkpackId]
    : readWorkpackCandidateIds(
        await readAuthenticatedJson(fetcher, "/api/workpacks?limit=50", request.authToken),
        request.question
      );
  let workpackId: string | null = null;
  let workpackPayload: Record<string, unknown> | null = null;
  for (const candidateId of candidateIds) {
    const payload = await readAuthenticatedJson(
      fetcher,
      `/api/workpacks/${encodeURIComponent(candidateId)}`,
      request.authToken
    );
    if (detailGenerationSignature(payload) === request.generationEvidenceSignature) {
      workpackId = candidateId;
      workpackPayload = payload;
      break;
    }
  }
  if (!workpackId || !workpackPayload) return { ok: false, reasonCode: "workpack_not_saved" };

  const query = new URLSearchParams({
    companyName: request.scenario.companyName,
    siteName: request.scenario.siteName,
    companyType: request.scenario.companyType
  });
  const workerPayload = await readAuthenticatedJson(fetcher, `/api/workers?${query.toString()}`, request.authToken);
  const rows = Array.isArray(workerPayload.workers) ? workerPayload.workers.filter(isRecord) : [];
  const workerIds: string[] = [];
  const recipientLocales: SupportedLanguageCode[] = [];
  for (const selected of request.selectedWorkers) {
    const matches = rows.filter((row) => row.external_key === selected.externalKey);
    if (matches.length !== 1) return { ok: false, reasonCode: "recipient_locale_invalid" };
    const row = matches[0];
    const workerId = readRequiredString(row.id);
    const serverLocale = parseSupportedLanguageCode(row.language_code);
    const selectedLocale = parseSupportedLanguageCode(selected.languageCode);
    if (
      !workerId
      || !uuidPattern.test(workerId)
      || serverLocale.status !== "supported"
      || selectedLocale.status !== "supported"
      || serverLocale.locale !== selectedLocale.locale
    ) {
      return { ok: false, reasonCode: "recipient_locale_invalid" };
    }
    workerIds.push(workerId);
    recipientLocales.push(serverLocale.locale);
  }
  if (new Set(workerIds).size !== workerIds.length) {
    return { ok: false, reasonCode: "recipient_locale_invalid" };
  }
  const authority = parseAuthenticatedWorkpackShareAuthority({
    expectedWorkpackId: workpackId,
    expectedGenerationEvidenceSignature: request.generationEvidenceSignature,
    recipientLocales,
    payload: workpackPayload
  });
  if (!authority.ok) return authority;
  return { ...authority, workerIds, recipientLocales };
}

export function resolveSavedWorkerIds(
  workerMap: Record<string, string>,
  selectedWorkerIds: string[]
): string[] {
  const missingWorkerIds: string[] = [];
  const savedWorkerIds = selectedWorkerIds.map((workerId) => {
    const savedWorkerId = workerMap[workerId]?.trim();
    if (!savedWorkerId) {
      missingWorkerIds.push(workerId);
      return "";
    }
    if (!uuidPattern.test(savedWorkerId)) {
      throw new Error(`선택한 작업자의 서버 저장 ID가 UUID가 아닙니다: ${workerId}`);
    }
    return savedWorkerId;
  });

  if (missingWorkerIds.length) {
    throw new Error(`선택한 작업자의 서버 저장 ID를 찾지 못했습니다: ${missingWorkerIds.join(", ")}`);
  }
  if (!savedWorkerIds.length) {
    throw new Error("공유 세션에 포함할 저장된 작업자가 없습니다.");
  }
  return [...new Set(savedWorkerIds)];
}

export async function createAuthenticatedShareSession(
  fetcher: Fetcher,
  request: ShareSessionRequest
): Promise<{ shareSessionId: string; expiresAt: string; message: string }> {
  requireBearerContext(request.authToken, request.workpackId);
  if (!request.workerIds.length || request.workerIds.some((workerId) => !uuidPattern.test(workerId))) {
    throw new Error("공유 세션에는 실제 서버 작업자 UUID가 필요합니다.");
  }
  if (
    !request.channels.length
    || new Set(request.channels).size !== request.channels.length
    || request.channels.some((channel) => channel !== "email" && channel !== "sms" && channel !== "kakao")
  ) {
    throw new Error("공유 세션에는 중복되지 않은 전파 채널이 필요합니다.");
  }
  if (!digestPattern.test(request.canonicalWorkpackRevision)) {
    throw new Error("공유 세션의 canonicalWorkpackRevision이 올바르지 않습니다.");
  }
  if (!request.availabilityToken.trim()) {
    throw new Error("공유 세션의 channel availability token이 필요합니다.");
  }

  const response = await fetcher(`/api/workpacks/${encodeURIComponent(request.workpackId)}/share-sessions`, {
    method: "POST",
    headers: buildHeaders(request.authToken),
    body: JSON.stringify({
      recipients: request.workerIds,
      channels: [...request.channels],
      canonicalWorkpackRevision: request.canonicalWorkpackRevision,
      availabilityToken: request.availabilityToken
    })
  });
  const body = await readResponseBody(response);
  if (!response.ok || body.ok !== true) {
    throw buildHttpError(body, response, "공유 세션 생성에 실패했습니다.");
  }

  const shareSessionId = readString(body.shareSessionId);
  if (!shareSessionId) throw new Error("공유 세션 응답에 shareSessionId가 없습니다.");
  if (!uuidPattern.test(shareSessionId)) {
    throw new Error("공유 세션 응답의 shareSessionId가 올바른 UUID가 아닙니다.");
  }
  const expiresAt = readString(body.expiresAt);
  if (!expiresAt || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) {
    throw new Error("공유 세션 응답의 expiresAt이 유효한 미래 시각이 아닙니다.");
  }
  return {
    shareSessionId,
    expiresAt,
    message: readString(body.message) || "공유 세션을 만들었습니다."
  };
}

function parseWorkflowShareChannel(value: unknown): WorkflowShareChannel | null {
  return value === "email" || value === "sms" || value === "kakao" ? value : null;
}

export async function resolveAuthenticatedShareChannels(fetcher: Fetcher, request: {
  authToken: string;
  workpackId: string;
  canonicalWorkpackRevision: string;
  workerIds: string[];
  requestedChannels: WorkflowShareChannel[];
}): Promise<AuthenticatedChannelResolution> {
  requireBearerContext(request.authToken, request.workpackId);
  if (!digestPattern.test(request.canonicalWorkpackRevision)) {
    throw new Error("채널 확인의 canonicalWorkpackRevision이 올바르지 않습니다.");
  }
  if (
    !request.workerIds.length
    || request.workerIds.some((workerId) => !uuidPattern.test(workerId))
    || new Set(request.workerIds).size !== request.workerIds.length
  ) {
    throw new Error("채널 확인에는 중복되지 않은 서버 작업자 UUID가 필요합니다.");
  }
  if (!request.requestedChannels.length || new Set(request.requestedChannels).size !== request.requestedChannels.length) {
    throw new Error("확인할 채널을 하나 이상 선택해 주세요.");
  }
  const response = await fetcher("/api/settings/channels/resolve", {
    method: "POST",
    headers: buildHeaders(request.authToken),
    body: JSON.stringify({
      workpackId: request.workpackId,
      canonicalWorkpackRevision: request.canonicalWorkpackRevision,
      recipients: request.workerIds,
      requestedChannels: request.requestedChannels
    })
  });
  const body = await readResponseBody(response);
  if (!response.ok || body.ok !== true) {
    throw buildHttpError(body, response, "전송 채널 확인에 실패했습니다.");
  }
  const responseChannels = Array.isArray(body.requestedChannels)
    ? body.requestedChannels.map(parseWorkflowShareChannel)
    : [];
  const channelResults = Array.isArray(body.channels)
    ? body.channels.flatMap((item): AuthenticatedChannelResolution["channels"] => {
        if (!isRecord(item)) return [];
        const channel = parseWorkflowShareChannel(item.channel);
        const reasonCode = readRequiredString(item.reasonCode);
        if (!channel || !reasonCode || typeof item.available !== "boolean") return [];
        return [{ channel, available: item.available, reasonCode }];
      })
    : [];
  const availabilityToken = readRequiredString(body.availabilityToken);
  const expiresAt = readRequiredString(body.expiresAt);
  if (
    body.version !== "channel-availability/v1"
    || body.workpackId !== request.workpackId
    || body.canonicalWorkpackRevision !== request.canonicalWorkpackRevision
    || responseChannels.some((channel): channel is null => channel === null)
    || JSON.stringify(responseChannels) !== JSON.stringify(request.requestedChannels)
    || channelResults.length !== request.requestedChannels.length
    || !availabilityToken
    || !expiresAt
    || !Number.isFinite(Date.parse(expiresAt))
    || Date.parse(expiresAt) <= Date.now()
    || typeof body.ready !== "boolean"
  ) {
    throw new Error("채널 확인 응답의 서버 binding이 올바르지 않습니다.");
  }
  const ready = body.ready === true && channelResults.every((channel) => channel.available);
  return {
    ok: true,
    ready,
    workpackId: request.workpackId,
    canonicalWorkpackRevision: request.canonicalWorkpackRevision,
    requestedChannels: responseChannels as WorkflowShareChannel[],
    availabilityToken,
    expiresAt,
    channels: channelResults
  };
}

export type DispatchLogClientDraft = {
  channel: string;
  targetLabel?: string;
  languageCode?: string;
  provider?: string;
  providerStatus?: string;
  workflowRunId?: string;
  failureReason?: string;
  payload?: unknown;
};

export async function persistAuthenticatedDispatchLogs(fetcher: Fetcher, request: {
  authToken: string;
  workpackId: string;
  logs: DispatchLogClientDraft[];
}): Promise<{ savedCount: number; logIds: string[]; message: string }> {
  requireBearerContext(request.authToken, request.workpackId);
  if (!request.logs.length || request.logs.some((log) => !log.channel.trim())) {
    throw new Error("저장할 전파 이력이 없습니다.");
  }
  const response = await fetcher("/api/dispatch-logs", {
    method: "POST",
    headers: buildHeaders(request.authToken),
    body: JSON.stringify({ workpackId: request.workpackId, logs: request.logs })
  });
  const body = await readResponseBody(response);
  if (!response.ok || body.ok !== true) {
    throw buildHttpError(body, response, "전파 이력 저장에 실패했습니다.");
  }
  const logIds = Array.isArray(body.logIds)
    ? body.logIds.flatMap((item): string[] => {
        const id = readRequiredString(item);
        return id && uuidPattern.test(id) ? [id] : [];
      })
    : [];
  const savedCount = typeof body.savedCount === "number" && Number.isSafeInteger(body.savedCount)
    ? body.savedCount
    : 0;
  if (savedCount !== request.logs.length || logIds.length !== request.logs.length) {
    throw new Error("전파 이력 ID가 완전하지 않아 저장 완료로 처리하지 않았습니다.");
  }
  return {
    savedCount,
    logIds,
    message: readRequiredString(body.message) || "전파 이력을 저장했습니다."
  };
}

export async function dispatchAuthenticatedShareSession(
  fetcher: Fetcher,
  request: DispatchRequest
): Promise<WorkflowDispatchResult> {
  requireBearerContext(request.authToken, request.workpackId);
  if (!uuidPattern.test(request.shareSessionId)) {
    throw new Error("서버 shareSessionId가 올바른 UUID가 아닙니다.");
  }
  if (!providerIdempotencyKeyPattern.test(request.idempotencyKey)) {
    throw new Error("provider 전송 idempotency key가 올바르지 않습니다.");
  }
  if (!request.channels.length) throw new Error("전파 채널을 하나 이상 선택해 주세요.");

  const response = await fetcher("/api/workflow/dispatch", {
    method: "POST",
    headers: buildHeaders(request.authToken),
    body: JSON.stringify({
      workpackId: request.workpackId,
      shareSessionId: request.shareSessionId,
      idempotencyKey: request.idempotencyKey,
      channels: request.channels,
      operatorNote: request.operatorNote
    })
  });
  const body = await readResponseBody(response);
  const responseIdempotencyKey = readString(body.idempotencyKey);
  const result: WorkflowDispatchResult = {
    ok: body.ok === true,
    configured: body.configured === true,
    message: readString(body.message) || (body.ok === true ? "전파 요청을 접수했습니다." : "전파 요청이 완료되지 않았습니다."),
    workflowRunId: readString(body.workflowRunId),
    providerStatus: readString(body.providerStatus),
    idempotencyKey: responseIdempotencyKey,
    idempotencySupported: typeof body.idempotencySupported === "boolean" ? body.idempotencySupported : undefined,
    duplicateRisk: typeof body.duplicateRisk === "boolean" ? body.duplicateRisk : undefined,
    providerCalled: typeof body.providerCalled === "boolean" ? body.providerCalled : undefined,
    channelResults: parseChannelResults(body.channelResults)
  };
  if (!response.ok && !result.duplicateRisk) {
    throw buildHttpError(body, response, "전파 요청에 실패했습니다.");
  }
  if (responseIdempotencyKey !== request.idempotencyKey) {
    throw new Error("provider 전송 응답의 idempotency key가 요청과 일치하지 않습니다.");
  }
  return result;
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

export function isProviderDispatchConfirmed(result: WorkflowDispatchResult): boolean {
  if (
    !result.ok
    || result.duplicateRisk
    || result.providerCalled === false
    || isValidationOnlyMarker(result.providerStatus)
  ) return false;
  return Boolean(result.channelResults?.some((item) => (
    item.status === "sent" && !isValidationOnlyMarker(item.provider)
  )));
}
