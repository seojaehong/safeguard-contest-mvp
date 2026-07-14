import {
  parseSupportedLanguageCode,
  SUPPORTED_LANGUAGE_CODES,
  type SupportedLanguageCode
} from "@/lib/foreign-worker";
import {
  buildChannelResolutionRequest,
  parseWorkflowShareChannels,
  type WorkflowShareChannel
} from "@/lib/channel-resolution-contract";
import {
  containsHangulResidue,
  hasLocalizedSemanticText,
  isFullEnglishFallback
} from "@/lib/localized-content-policy";

export type { WorkflowShareChannel } from "@/lib/channel-resolution-contract";

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

export type WorkflowShareAuthorityIdentity = {
  workpackId: string;
  contentBinding: string;
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
  state?: "recorded";
  outcome?: "accepted" | "partial" | "failed";
  message: string;
  workflowRunId?: string;
  providerStatus?: string;
  idempotencyKey?: string;
  idempotencySupported?: boolean;
  duplicateRisk?: boolean;
  providerCalled?: boolean;
  channelResults?: WorkflowDispatchChannelResult[];
  logIds?: string[];
  receipt?: {
    version: "server-dispatch-receipt/v1";
    receiptId: string;
    shareSessionId: string;
    idempotencyKey: string;
    workpackId: string;
    canonicalWorkpackRevision: string;
    outcome: "accepted" | "partial" | "failed";
    workflowRunId: string;
    logIds: string[];
    recordedAt: string;
  };
};

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export class WorkflowShareRequestError extends Error {
  readonly reasonCode: string | null;
  readonly status: number;
  readonly state: string | null;
  readonly owner: string | null;
  readonly validatedLanguage: string | null;

  constructor(message: string, input: {
    reasonCode?: string | null;
    status?: number;
    state?: string | null;
    owner?: string | null;
    validatedLanguage?: string | null;
  } = {}) {
    super(message);
    this.name = "WorkflowShareRequestError";
    this.reasonCode = input.reasonCode || null;
    this.status = input.status || 0;
    this.state = input.state || null;
    this.owner = input.owner || null;
    this.validatedLanguage = input.validatedLanguage || null;
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
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function canonicalizeShareContent(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeShareContent);
  if (!isRecord(value)) return value;
  return Object.keys(value).sort().reduce<Record<string, unknown>>((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalizeShareContent(value[key]);
    return result;
  }, {});
}

export function buildWorkflowShareContentBinding(value: unknown): string {
  if (!isRecord(value)) return "";
  return JSON.stringify(canonicalizeShareContent({
    question: value.question,
    scenario: value.scenario,
    riskSummary: value.riskSummary,
    deliverables: value.deliverables,
    generationEvidence: value.generationEvidence
  }));
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
    {
      reasonCode: readString(body.reasonCode),
      status: response.status,
      state: readString(body.state),
      owner: readString(body.owner),
      validatedLanguage: readString(body.validatedSupportedCode)
    }
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
  const values = [
    preview.subject,
    ...Object.values(preview.metadata),
    ...preview.bodyLines,
    ...preview.semanticRiskLabels
  ];
  if (
    values.some((value) => !hasLocalizedSemanticText(value))
    || isFullEnglishFallback(values, locale)
    || (locale !== "ko" && containsHangulResidue(JSON.stringify(preview)))
  ) {
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
  expectedContentBinding: string;
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
    || buildWorkflowShareContentBinding(reopenData) !== input.expectedContentBinding
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

function detailContentBinding(payload: Record<string, unknown>): string | null {
  const workpack = isRecord(payload.workpack) ? payload.workpack : null;
  const reopenData = workpack && isRecord(workpack.reopenData) ? workpack.reopenData : null;
  return reopenData ? buildWorkflowShareContentBinding(reopenData) : null;
}

export async function loadAuthenticatedShareAuthority(fetcher: Fetcher, request: {
  authToken: string;
  knownWorkpackId: string | null;
  question: string;
  generationEvidenceSignature: string;
  expectedContentBinding: string;
  scenario: { companyName: string; siteName: string; companyType: string };
  selectedWorkers: Array<{ externalKey: string; displayName: string; languageCode: string }>;
}): Promise<AuthenticatedShareAuthority | AuthenticatedShareAuthorityFailure> {
  if (!request.authToken.trim()) throw new Error("관리자 인증 토큰이 필요합니다.");
  if (!request.selectedWorkers.length) return { ok: false, reasonCode: "recipient_locale_invalid" };
  if (!request.expectedContentBinding) return { ok: false, reasonCode: "workpack_not_saved" };
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
    if (
      detailGenerationSignature(payload) === request.generationEvidenceSignature
      && detailContentBinding(payload) === request.expectedContentBinding
    ) {
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
    expectedContentBinding: request.expectedContentBinding,
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
): Promise<{ shareSessionId: string; dispatchIdempotencyKey: string; expiresAt: string; message: string }> {
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
  const dispatchIdempotencyKey = readString(body.dispatchIdempotencyKey);
  if (!dispatchIdempotencyKey || !providerIdempotencyKeyPattern.test(dispatchIdempotencyKey)) {
    throw new Error("공유 세션 응답의 서버 dispatch idempotency key가 올바르지 않습니다.");
  }
  const expiresAt = readString(body.expiresAt);
  if (!expiresAt || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) {
    throw new Error("공유 세션 응답의 expiresAt이 유효한 미래 시각이 아닙니다.");
  }
  return {
    shareSessionId,
    dispatchIdempotencyKey,
    expiresAt,
    message: readString(body.message) || "공유 세션을 만들었습니다."
  };
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
    body: JSON.stringify(buildChannelResolutionRequest({
      workpackId: request.workpackId,
      canonicalWorkpackRevision: request.canonicalWorkpackRevision,
      recipients: request.workerIds,
      requestedChannels: request.requestedChannels
    }))
  });
  const body = await readResponseBody(response);
  if (!response.ok || body.ok !== true) {
    throw buildHttpError(body, response, "전송 채널 확인에 실패했습니다.");
  }
  const responseChannels = parseWorkflowShareChannels(body.requestedChannels);
  const channelResults = Array.isArray(body.channels)
    ? body.channels.flatMap((item): AuthenticatedChannelResolution["channels"] => {
        if (!isRecord(item)) return [];
        const channel = parseWorkflowShareChannels([item.channel])?.[0] || null;
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
    || !responseChannels
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
    requestedChannels: responseChannels,
    availabilityToken,
    expiresAt,
    channels: channelResults
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
  if (!response.ok) {
    throw buildHttpError(body, response, "전파 요청에 실패했습니다.");
  }
  const responseIdempotencyKey = readString(body.idempotencyKey);
  if (responseIdempotencyKey !== request.idempotencyKey) {
    throw new Error("provider 전송 응답의 idempotency key가 요청과 일치하지 않습니다.");
  }
  const receipt = isRecord(body.receipt) ? body.receipt : null;
  const outcome = body.outcome === "accepted" || body.outcome === "partial" || body.outcome === "failed"
    ? body.outcome
    : null;
  const receiptOutcome = receipt?.outcome === "accepted" || receipt?.outcome === "partial" || receipt?.outcome === "failed"
    ? receipt.outcome
    : null;
  const workflowRunId = readRequiredString(body.workflowRunId);
  const receiptWorkflowRunId = readRequiredString(receipt?.workflowRunId);
  const canonicalWorkpackRevision = readRequiredString(receipt?.canonicalWorkpackRevision);
  const logIds = Array.isArray(body.logIds)
    ? body.logIds.flatMap((item): string[] => {
        const id = readRequiredString(item);
        return id && uuidPattern.test(id) ? [id] : [];
      })
    : [];
  const receiptLogIds = Array.isArray(receipt?.logIds)
    ? receipt.logIds.flatMap((item): string[] => {
        const id = readRequiredString(item);
        return id && uuidPattern.test(id) ? [id] : [];
      })
    : [];
  const channelResults = parseChannelResults(body.channelResults) || [];
  const channelNames = channelResults.map((item) => item.channel);
  const sentCount = channelResults.filter((item) => item.status === "sent").length;
  const expectedOutcome = sentCount === channelResults.length
    ? "accepted"
    : sentCount > 0 ? "partial" : "failed";
  if (
    body.state !== "recorded"
    || !outcome
    || !receipt
    || receipt.version !== "server-dispatch-receipt/v1"
    || !uuidPattern.test(readRequiredString(receipt.receiptId) || "")
    || receipt.shareSessionId !== request.shareSessionId
    || receipt.workpackId !== request.workpackId
    || receipt.idempotencyKey !== request.idempotencyKey
    || !canonicalWorkpackRevision
    || !digestPattern.test(canonicalWorkpackRevision)
    || receiptOutcome !== outcome
    || !workflowRunId
    || receiptWorkflowRunId !== workflowRunId
    || !Number.isFinite(Date.parse(readRequiredString(receipt.recordedAt) || ""))
    || logIds.length === 0
    || JSON.stringify(logIds) !== JSON.stringify(receiptLogIds)
    || body.configured !== true
    || body.providerStatus !== "live"
    || body.providerCalled !== true
    || body.idempotencySupported !== true
    || body.duplicateRisk !== false
    || channelResults.length !== request.channels.length
    || JSON.stringify(channelNames) !== JSON.stringify(request.channels)
    || channelResults.some((item) => item.provider !== "n8n-relay" || (item.status !== "sent" && item.status !== "failed"))
    || outcome !== expectedOutcome
    || body.ok !== (outcome === "accepted" || outcome === "partial")
  ) {
    throw new Error("전파 응답의 서버 receipt binding이 올바르지 않습니다.");
  }
  return {
    ok: body.ok === true,
    configured: true,
    state: "recorded",
    outcome,
    message: readString(body.message) || "서버 receipt와 전파 이력을 저장했습니다.",
    workflowRunId,
    providerStatus: "live",
    idempotencyKey: request.idempotencyKey,
    idempotencySupported: true,
    duplicateRisk: false,
    providerCalled: true,
    channelResults,
    logIds,
    receipt: {
      version: "server-dispatch-receipt/v1",
      receiptId: receipt.receiptId as string,
      shareSessionId: request.shareSessionId,
      idempotencyKey: request.idempotencyKey,
      workpackId: request.workpackId,
      canonicalWorkpackRevision,
      outcome,
      workflowRunId,
      logIds,
      recordedAt: receipt.recordedAt as string
    }
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

export function isProviderDispatchConfirmed(result: WorkflowDispatchResult): boolean {
  return Boolean(result.state === "recorded"
    && (result.outcome === "accepted" || result.outcome === "partial")
    && result.ok
    && result.providerCalled
    && result.idempotencySupported
    && !result.duplicateRisk
    && Boolean(result.logIds?.length)
    && result.receipt?.logIds.length === result.logIds?.length
    && Boolean(result.channelResults?.some((item) => item.status === "sent" && !isValidationOnlyMarker(item.provider))));
}
