// n8n 웹훅 relay 공통 로직. app/api/workflow/dispatch(현장 전파)와
// app/api/briefing/run(아침 자동 브리핑)이 함께 쓴다. Vercel(hosted)에서는
// N8N_PUBLIC_BASE(HTTPS relay)만 쓰고, 로컬/오라클 내부망에서는 N8N_INTERNAL_BASE를
// 우선한다 — N8N_INTERNAL_BASE는 Vercel에 설정하면 안 된다(.env.example 참고).

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
        throw new Error(`n8n webhook returned ${response.status}: ${text.slice(0, 300)}`);
      }

      if (!text) {
        return { ok: true, message: "n8n 웹훅이 요청을 접수했습니다." };
      }

      try {
        const parsed = JSON.parse(text) as unknown;
        if (isRecord(parsed)) {
          return parsed as WebhookResponse;
        }
      } catch (error) {
        console.warn("n8n webhook returned non-JSON response", error);
      }

      return { ok: true, message: text.slice(0, 300) };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      console.warn(`n8n webhook attempt ${attempt + 1} failed`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("n8n webhook request failed");
}
