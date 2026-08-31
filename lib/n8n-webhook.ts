// n8n 웹훅 relay 공통 로직. app/api/workflow/dispatch(현장 전파)와
// app/api/briefing/run(아침 자동 브리핑)이 함께 쓴다. Vercel(hosted)에서는
// N8N_PUBLIC_BASE(HTTPS relay)만 쓰고, 로컬/오라클 내부망에서는 N8N_INTERNAL_BASE를
// 우선한다 — N8N_INTERNAL_BASE는 Vercel에 설정하면 안 된다(.env.example 참고).

import { safeServerErrorContext } from "@/lib/server/public-error";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type WebhookConfig = {
  url: string;
  token: string;
};

export type WebhookResponse = {
  ok?: boolean;
  workflowRunId?: string;
  providerStatus?: string;
  message?: string;
  channelResults?: unknown;
  summary?: unknown;
};

const PUBLIC_PROVIDER_STATUSES = new Set([
  "accepted",
  "completed",
  "failed",
  "ok",
  "partial",
  "queued",
  "sent",
  "success",
]);

const PUBLIC_CHANNELS = new Set(["email", "sms", "kakao", "band"]);
const PUBLIC_CHANNEL_STATUSES = new Set(["sent", "failed", "unconfigured", "skipped", "partial"]);

class N8nWebhookRequestError extends Error {
  readonly code = "N8N_WEBHOOK_REQUEST_FAILED";
  readonly status?: number;

  constructor(status?: number) {
    super("n8n webhook request failed");
    this.name = "N8nWebhookRequestError";
    this.status = status;
  }
}

function publicReceiptId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const receipt = value.trim();
  return receipt && receipt.length <= 128 && /^[a-z0-9_.:-]+$/iu.test(receipt) ? receipt : undefined;
}

function publicProviderStatus(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const status = value.trim().toLowerCase();
  return PUBLIC_PROVIDER_STATUSES.has(status) ? status : "response-received";
}

function publicChannelResults(value: unknown): unknown[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    if (!isRecord(item) || !PUBLIC_CHANNELS.has(String(item.channel))) return [];
    const status = typeof item.status === "string" && PUBLIC_CHANNEL_STATUSES.has(item.status)
      ? item.status
      : "skipped";
    const httpStatus = typeof item.httpStatus === "number"
      && Number.isInteger(item.httpStatus)
      && item.httpStatus >= 100
      && item.httpStatus <= 599
      ? item.httpStatus
      : undefined;
    return [{
      channel: item.channel,
      status,
      ...(httpStatus !== undefined ? { httpStatus } : {}),
    }];
  });
}

function projectWebhookResponse(value: Record<string, unknown>): WebhookResponse {
  const workflowRunId = publicReceiptId(value.workflowRunId);
  const providerStatus = publicProviderStatus(value.providerStatus);
  const channelResults = publicChannelResults(value.channelResults);
  return {
    ok: value.ok !== false,
    ...(workflowRunId ? { workflowRunId } : {}),
    ...(providerStatus ? { providerStatus } : {}),
    ...(channelResults ? { channelResults } : {}),
    message: "n8n 웹훅이 요청을 접수했습니다.",
  };
}

export function isLiveDispatchEnabled(): boolean {
  return process.env.SAFEGUARD_RUN_LIVE_DISPATCH === "1";
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

export function resolveWebhookConfig(): WebhookConfig {
  const explicitUrl = process.env.N8N_WEBHOOK_URL?.trim();
  const publicBase = process.env.N8N_PUBLIC_BASE?.trim();
  const internalBase = process.env.N8N_INTERNAL_BASE?.trim();
  const path = process.env.N8N_WEBHOOK_PATH?.trim();
  const token = (process.env.N8N_WEBHOOK_TOKEN || process.env.N8N_WEBHOOK_SECRET || "").trim();
  const isHosted = Boolean(process.env.VERCEL || process.env.VERCEL_URL);

  if (explicitUrl && token) {
    return { url: explicitUrl, token };
  }

  const base = isHosted ? publicBase : internalBase || publicBase;
  if (base && path && token) {
    return {
      url: `${base.replace(/\/+$/g, "")}/webhook/${trimSlashes(path)}`,
      token
    };
  }

  return {
    url: "",
    token: token || ""
  };
}

const TIMEOUT_MS = 20_000;
const RETRY_COUNT = 1;

export async function postWebhookWithTimeout(url: string, secret: string, payload: Record<string, unknown>): Promise<WebhookResponse> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-safeguard-secret": secret
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeout);

      const text = await response.text();
      if (!response.ok) {
        throw new N8nWebhookRequestError(response.status);
      }

      if (!text) {
        return { ok: true, message: "n8n 웹훅이 요청을 접수했습니다." };
      }

      try {
        const parsed = JSON.parse(text) as unknown;
        if (isRecord(parsed)) {
          return projectWebhookResponse(parsed);
        }
      } catch (error) {
        console.warn("n8n webhook returned non-JSON response", error);
      }

      return { ok: true, message: "n8n 웹훅이 요청을 접수했습니다." };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      console.warn(`n8n webhook attempt ${attempt + 1} failed`, safeServerErrorContext(error));
    }
  }

  throw lastError instanceof Error ? lastError : new N8nWebhookRequestError();
}
