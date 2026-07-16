import type { AskResponse } from "@/lib/types";

export type WorkflowShareChannel = "email" | "sms" | "kakao";
export type WorkflowDispatchMessageTarget = "manager" | `foreign:${string}`;

export type LocalizedDispatchRecipient = {
  workerId: string;
  phone?: string;
  email?: string;
  dispatchLanguageCode: string;
  messageTarget: WorkflowDispatchMessageTarget;
  message: string;
};

export type LocalizedDispatchRecipientsResult =
  | { ok: true; recipients: LocalizedDispatchRecipient[] }
  | { ok: false; missingLanguageCodes: string[] };

export type CanonicalRecipientMessageVariantsResult =
  | { ok: true; messageVariants: Record<string, string> }
  | {
      ok: false;
      invalidLanguageCodes: string[];
      koreanLeakLanguageCodes: string[];
      malformedFields: string[];
    };

export type CanonicalDispatchLanguageCodesResult =
  | { ok: true; languageCodes: string[] }
  | { ok: false; malformedFields: string[] };

type CanonicalForeignWorkerLanguage = {
  code: string;
  nativeLabel: string;
  lines: string[];
};

type CanonicalDispatchDeliverables = {
  kakaoMessage: string;
  foreignWorkerLanguages: CanonicalForeignWorkerLanguage[];
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

type ShareSessionRequest = {
  authToken: string;
  workpackId: string;
  workerIds: string[];
};

type DispatchRequest = {
  authToken: string;
  workpackId: string;
  shareSessionId: string;
  idempotencyKey: string;
  channels: WorkflowShareChannel[];
  operatorNote: string;
  messageVariants: Record<string, string>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const providerIdempotencyKeyPattern = /^provider-dispatch-v1-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[0-9a-f]{8}$/i;
const foreignMessageTargetPattern = /^foreign:[a-z]{2,3}(?:-[A-Z]{2})?$/;
const internalMessagePattern = /(?:qualityContract|ontologyQa|directEvidence|DB\s*하네스|하네스\s*JSONL)/i;
const dispatchMessageMaxLength = 4_000;
const koreanTextPattern = /[가-힣]/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function buildLocalizedDispatchRecipients(input: {
  recipients: Array<Record<string, unknown>>;
  messageVariants: Record<string, string>;
  channels: WorkflowShareChannel[];
}): LocalizedDispatchRecipientsResult {
  const missingLanguageCodes = new Set<string>();
  const localizedRecipients = input.recipients.flatMap((recipient): LocalizedDispatchRecipient[] => {
    const workerId = typeof recipient.workerId === "string" ? recipient.workerId.trim() : "";
    const languageCode = typeof recipient.languageCode === "string" ? recipient.languageCode.trim() : "";
    const message = languageCode ? input.messageVariants[languageCode] : "";
    if (!workerId || !languageCode || !message) {
      missingLanguageCodes.add(languageCode || "unknown");
      return [];
    }
    const phone = typeof recipient.phone === "string" ? recipient.phone.trim() : "";
    const email = typeof recipient.email === "string" ? recipient.email.trim() : "";
    const localizedRecipient: LocalizedDispatchRecipient = {
      workerId,
      dispatchLanguageCode: languageCode,
      messageTarget: languageCode === "ko" ? "manager" : `foreign:${languageCode}`,
      message
    };
    if (input.channels.some((channel) => channel === "sms" || channel === "kakao") && phone) {
      localizedRecipient.phone = phone;
    }
    if (input.channels.includes("email") && email) {
      localizedRecipient.email = email;
    }
    return [localizedRecipient];
  });

  if (missingLanguageCodes.size) {
    return { ok: false, missingLanguageCodes: [...missingLanguageCodes].sort() };
  }
  return { ok: true, recipients: localizedRecipients };
}

export function buildLocalizedDispatchWebhookPayload(input: {
  idempotencyKey: string;
  channels: WorkflowShareChannel[];
  recipients: Array<Record<string, unknown>>;
  messageVariants: Record<string, string>;
  operatorNote: string;
  workpack: unknown;
  sentAt?: string;
}): { ok: true; payload: {
  event: "safeguard.workpack.dispatch";
  idempotencyKey: string;
  sentAt: string;
  channels: WorkflowShareChannel[];
  recipients: LocalizedDispatchRecipient[];
  messageVariants: Record<string, string>;
  recipientMessageContract: "saved-worker-language-v1";
  operatorNote: string;
  workpack: unknown;
} } | { ok: false; missingLanguageCodes: string[] } {
  const localized = buildLocalizedDispatchRecipients(input);
  if (!localized.ok) return localized;
  const messageVariants = localized.recipients.reduce<Record<string, string>>((variants, recipient) => {
    variants[recipient.dispatchLanguageCode] = recipient.message;
    return variants;
  }, {});
  return {
    ok: true,
    payload: {
      event: "safeguard.workpack.dispatch",
      idempotencyKey: input.idempotencyKey,
      sentAt: input.sentAt || new Date().toISOString(),
      channels: input.channels,
      recipients: localized.recipients,
      messageVariants,
      recipientMessageContract: "saved-worker-language-v1",
      operatorNote: input.operatorNote,
      workpack: input.workpack
    }
  };
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
  return new Error(`${readString(body.message) || fallback} (HTTP ${response.status})`);
}

export function validateWorkflowDispatchMessage(input: {
  messageTarget: string;
  message: string;
}): asserts input is {
  messageTarget: WorkflowDispatchMessageTarget;
  message: string;
} {
  if (input.messageTarget !== "manager" && !foreignMessageTargetPattern.test(input.messageTarget)) {
    throw new Error("전송 메시지 대상 언어 코드가 올바르지 않습니다.");
  }
  if (!input.message.trim()) throw new Error("전송할 메시지 본문이 필요합니다.");
  if (input.message.length > dispatchMessageMaxLength) {
    throw new Error("전송 메시지는 4,000자 이하여야 합니다.");
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(input.message)) {
    throw new Error("전송 메시지에 허용되지 않는 제어 문자가 있습니다.");
  }
  if (internalMessagePattern.test(input.message)) {
    throw new Error("전송 메시지에 내부 검수 정보가 포함되어 있습니다.");
  }
}

export function validateWorkflowDispatchMessageVariants(
  value: unknown
): asserts value is Record<string, string> {
  if (!isRecord(value) || !Object.keys(value).length) {
    throw new Error("수신자 언어별 전송 본문이 필요합니다.");
  }
  for (const [languageCode, message] of Object.entries(value)) {
    if (typeof message !== "string") {
      throw new Error("수신자 언어별 전송 본문은 문자열이어야 합니다.");
    }
    validateWorkflowDispatchMessage({
      messageTarget: languageCode === "ko" ? "manager" : `foreign:${languageCode}`,
      message
    });
  }
}

function parseCanonicalDispatchDeliverables(data: unknown):
  | { ok: true; deliverables: CanonicalDispatchDeliverables }
  | { ok: false; malformedFields: string[] } {
  if (!isRecord(data) || !isRecord(data.deliverables)) {
    return { ok: false, malformedFields: ["deliverables"] };
  }
  const deliverables = data.deliverables;
  if (typeof deliverables.kakaoMessage !== "string") {
    return { ok: false, malformedFields: ["deliverables.kakaoMessage"] };
  }
  if (!Array.isArray(deliverables.foreignWorkerLanguages)) {
    return { ok: false, malformedFields: ["deliverables.foreignWorkerLanguages"] };
  }

  const languages: CanonicalForeignWorkerLanguage[] = [];
  const languageCodes = new Set<string>();
  for (const [index, value] of deliverables.foreignWorkerLanguages.entries()) {
    const prefix = `deliverables.foreignWorkerLanguages[${index}]`;
    if (!isRecord(value)) {
      return { ok: false, malformedFields: [prefix] };
    }
    if (typeof value.code !== "string") {
      return { ok: false, malformedFields: [`${prefix}.code`] };
    }
    if (value.code === "ko" || languageCodes.has(value.code)) {
      return { ok: false, malformedFields: [`${prefix}.code`] };
    }
    languageCodes.add(value.code);
    if (typeof value.nativeLabel !== "string" || !value.nativeLabel.trim()) {
      return { ok: false, malformedFields: [`${prefix}.nativeLabel`] };
    }
    if (
      !Array.isArray(value.lines)
      || value.lines.length === 0
      || value.lines.some((line) => typeof line !== "string" || !line.trim())
    ) {
      return { ok: false, malformedFields: [`${prefix}.lines`] };
    }
    languages.push({
      code: value.code,
      nativeLabel: value.nativeLabel,
      lines: value.lines
    });
  }

  return {
    ok: true,
    deliverables: {
      kakaoMessage: deliverables.kakaoMessage,
      foreignWorkerLanguages: languages
    }
  };
}

function buildCanonicalForeignMessage(
  deliverables: CanonicalDispatchDeliverables,
  languageCode: string
): string | null {
  const language = deliverables.foreignWorkerLanguages.find((item) => item.code === languageCode);
  if (!language) return null;
  return [
    "[SafeClaw]",
    language.nativeLabel,
    "",
    ...language.lines.map((line) => `- ${line}`)
  ].join("\n").trim();
}

export function getCanonicalDispatchLanguageCodes(data: unknown): CanonicalDispatchLanguageCodesResult {
  const parsed = parseCanonicalDispatchDeliverables(data);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    languageCodes: [...new Set([
      "ko",
      ...parsed.deliverables.foreignWorkerLanguages.map((language) => language.code)
    ])].sort()
  };
}

export function buildCanonicalRecipientMessageVariants(input: {
  data: unknown;
  recipientLanguageCodes: string[];
}): CanonicalRecipientMessageVariantsResult {
  const parsed = parseCanonicalDispatchDeliverables(input.data);
  if (!parsed.ok) {
    return {
      ok: false,
      invalidLanguageCodes: [],
      koreanLeakLanguageCodes: [],
      malformedFields: parsed.malformedFields
    };
  }
  const allowedLanguageCodes = new Set([
    "ko",
    ...parsed.deliverables.foreignWorkerLanguages.map((language) => language.code)
  ]);
  const invalidLanguageCodes = new Set<string>();
  const koreanLeakLanguageCodes = new Set<string>();
  const messageVariants: Record<string, string> = {};

  for (const languageCode of [...new Set(input.recipientLanguageCodes)].sort()) {
    if (!languageCode || !allowedLanguageCodes.has(languageCode)) {
      invalidLanguageCodes.add(languageCode || "unknown");
      continue;
    }
    const message = languageCode === "ko"
      ? parsed.deliverables.kakaoMessage.trim()
      : buildCanonicalForeignMessage(parsed.deliverables, languageCode);
    if (!message) {
      invalidLanguageCodes.add(languageCode);
      continue;
    }
    if (languageCode !== "ko" && koreanTextPattern.test(message)) {
      koreanLeakLanguageCodes.add(languageCode);
      continue;
    }
    try {
      validateWorkflowDispatchMessage({
        messageTarget: languageCode === "ko" ? "manager" : `foreign:${languageCode}`,
        message
      });
    } catch (error) {
      console.warn("canonical workflow dispatch message validation failed", error);
      invalidLanguageCodes.add(languageCode);
      continue;
    }
    messageVariants[languageCode] = message;
  }

  if (invalidLanguageCodes.size || koreanLeakLanguageCodes.size) {
    return {
      ok: false,
      invalidLanguageCodes: [...invalidLanguageCodes].sort(),
      koreanLeakLanguageCodes: [...koreanLeakLanguageCodes].sort(),
      malformedFields: []
    };
  }
  return { ok: true, messageVariants };
}

export function resolveWorkflowMessagePreview(
  data: AskResponse,
  selectedTarget: WorkflowDispatchMessageTarget
): string {
  if (selectedTarget === "manager") return data.deliverables.kakaoMessage;
  const parsed = parseCanonicalDispatchDeliverables(data);
  if (!parsed.ok) return "";
  return buildCanonicalForeignMessage(parsed.deliverables, selectedTarget.replace("foreign:", "")) || "";
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

  const response = await fetcher(`/api/workpacks/${encodeURIComponent(request.workpackId)}/share-sessions`, {
    method: "POST",
    headers: buildHeaders(request.authToken),
    body: JSON.stringify({ recipients: request.workerIds })
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
  validateWorkflowDispatchMessageVariants(request.messageVariants);

  const response = await fetcher("/api/workflow/dispatch", {
    method: "POST",
    headers: buildHeaders(request.authToken),
    body: JSON.stringify({
      workpackId: request.workpackId,
      shareSessionId: request.shareSessionId,
      idempotencyKey: request.idempotencyKey,
      channels: request.channels,
      operatorNote: request.operatorNote,
      messageVariants: request.messageVariants
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
