export type WorkflowShareChannel = "email" | "sms" | "kakao";

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
  channels: WorkflowShareChannel[];
  operatorNote: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  return new Error(`${readString(body.message) || fallback} (HTTP ${response.status})`);
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
): Promise<{ shareSessionId: string; message: string }> {
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
  return {
    shareSessionId,
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
  if (!request.channels.length) throw new Error("전파 채널을 하나 이상 선택해 주세요.");

  const response = await fetcher("/api/workflow/dispatch", {
    method: "POST",
    headers: buildHeaders(request.authToken),
    body: JSON.stringify({
      workpackId: request.workpackId,
      shareSessionId: request.shareSessionId,
      channels: request.channels,
      operatorNote: request.operatorNote
    })
  });
  const body = await readResponseBody(response);
  if (!response.ok) throw buildHttpError(body, response, "전파 요청에 실패했습니다.");

  return {
    ok: body.ok === true,
    configured: body.configured === true,
    message: readString(body.message) || (body.ok === true ? "전파 요청을 접수했습니다." : "전파 요청이 완료되지 않았습니다."),
    workflowRunId: readString(body.workflowRunId),
    providerStatus: readString(body.providerStatus),
    channelResults: parseChannelResults(body.channelResults)
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
  if (!result.ok || isValidationOnlyMarker(result.providerStatus)) return false;
  return Boolean(result.channelResults?.some((item) => (
    item.status === "sent" && !isValidationOnlyMarker(item.provider)
  )));
}
