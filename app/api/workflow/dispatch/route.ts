import { NextRequest, NextResponse } from "next/server";

type WorkflowChannel = "email" | "sms" | "kakao" | "band";

type WorkflowRequest = {
  channels?: WorkflowChannel[];
  recipients?: string[];
  operatorNote?: string;
  workpack?: unknown;
};

type WorkflowSuccessResponse = {
  ok?: boolean;
  workflowRunId?: string;
  providerStatus?: string;
  message?: string;
  channelResults?: unknown;
  summary?: unknown;
};

type WorkflowChannelStatus = "sent" | "failed" | "unconfigured" | "skipped" | "partial";

type WorkflowChannelResult = {
  channel: WorkflowChannel;
  provider: string;
  status: WorkflowChannelStatus;
  message: string;
  httpStatus?: number;
};

type WorkflowSummary = {
  requested: number;
  sent: number;
  partial: number;
  failed: number;
  unconfigured: number;
  skipped: number;
};

const ALLOWED_CHANNELS: WorkflowChannel[] = ["email", "sms", "kakao", "band"];
const TIMEOUT_MS = 20_000;
const RETRY_COUNT = 1;

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function resolveWebhookConfig() {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseChannels(value: unknown): WorkflowChannel[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is WorkflowChannel => (
    typeof item === "string" && ALLOWED_CHANNELS.includes(item as WorkflowChannel)
  ));
}

function parseRecipients(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function parseChannelStatus(value: unknown): WorkflowChannelStatus {
  if (value === "sent" || value === "failed" || value === "unconfigured" || value === "skipped" || value === "partial") {
    return value;
  }

  return "skipped";
}

function parseHttpStatus(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeChannelResults(value: unknown, requestedChannels: WorkflowChannel[]): WorkflowChannelResult[] {
  const byChannel = new Map<WorkflowChannel, WorkflowChannelResult>();

  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isRecord(item)) continue;
      const channel = item.channel;
      if (typeof channel !== "string" || !ALLOWED_CHANNELS.includes(channel as WorkflowChannel)) continue;
      byChannel.set(channel as WorkflowChannel, {
        channel: channel as WorkflowChannel,
        provider: typeof item.provider === "string" ? item.provider : "n8n",
        status: parseChannelStatus(item.status),
        message: typeof item.message === "string" ? item.message : "채널 처리 결과가 반환되었습니다.",
        httpStatus: parseHttpStatus(item.httpStatus)
      });
    }
  }

  return requestedChannels.map((channel) => (
    byChannel.get(channel) || {
      channel,
      provider: "n8n",
      status: "skipped",
      message: "n8n 응답에서 이 채널의 provider 결과를 확인하지 못했습니다."
    }
  ));
}

function summarizeChannelResults(results: WorkflowChannelResult[]): WorkflowSummary {
  return results.reduce<WorkflowSummary>((summary, item) => {
    if (item.status === "sent") summary.sent += 1;
    if (item.status === "partial") summary.partial += 1;
    if (item.status === "failed") summary.failed += 1;
    if (item.status === "unconfigured") summary.unconfigured += 1;
    if (item.status === "skipped") summary.skipped += 1;
    return summary;
  }, {
    requested: results.length,
    sent: 0,
    partial: 0,
    failed: 0,
    unconfigured: 0,
    skipped: 0
  });
}

async function postWithTimeout(url: string, secret: string, payload: Record<string, unknown>) {
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
        return { ok: true, message: "n8n 웹훅이 전파 요청을 접수했습니다." } satisfies WorkflowSuccessResponse;
      }

      try {
        const parsed = JSON.parse(text) as unknown;
        if (isRecord(parsed)) {
          return parsed as WorkflowSuccessResponse;
        }
      } catch (error) {
        console.warn("n8n webhook returned non-JSON response", error);
      }

      return { ok: true, message: text.slice(0, 300) } satisfies WorkflowSuccessResponse;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      console.warn(`n8n webhook attempt ${attempt + 1} failed`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("n8n webhook request failed");
}

export async function POST(request: NextRequest) {
  const webhookConfig = resolveWebhookConfig();

  let body: WorkflowRequest;
  try {
    const parsed = await request.json() as unknown;
    body = isRecord(parsed) ? parsed : {};
  } catch (error) {
    console.warn("workflow dispatch body parse failed", error);
    return NextResponse.json({
      ok: false,
      configured: Boolean(webhookConfig.url && webhookConfig.token),
      message: "요청 본문을 해석하지 못했습니다."
    }, { status: 400 });
  }

  const channels = parseChannels(body.channels);
  const recipients = parseRecipients(body.recipients);

  if (!body.workpack || channels.length === 0) {
    return NextResponse.json({
      ok: false,
      configured: Boolean(webhookConfig.url && webhookConfig.token),
      message: "문서팩과 전파 채널을 확인해 주세요."
    }, { status: 400 });
  }

  if (!webhookConfig.url || !webhookConfig.token) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: "현장 전파 연결을 확인해야 합니다. 메일·문자·카카오·밴드 전송 설정을 점검해 주세요."
    });
  }

  const payload = {
    event: "safeguard.workpack.dispatch",
    sentAt: new Date().toISOString(),
    channels,
    recipients,
    operatorNote: typeof body.operatorNote === "string" ? body.operatorNote : "",
    workpack: body.workpack
  };

  try {
    const workflowResponse = await postWithTimeout(webhookConfig.url, webhookConfig.token, payload);
    const channelResults = normalizeChannelResults(workflowResponse.channelResults, channels);
    const summary = summarizeChannelResults(channelResults);
    return NextResponse.json({
      ok: workflowResponse.ok ?? true,
      configured: true,
      workflowRunId: workflowResponse.workflowRunId,
      providerStatus: workflowResponse.providerStatus,
      channelResults,
      summary,
      message: workflowResponse.message || "n8n 웹훅이 전파 요청을 접수했습니다."
    });
  } catch (error) {
    console.error("workflow dispatch failed", error);
    return NextResponse.json({
      ok: false,
      configured: true,
      message: error instanceof Error ? error.message : "n8n 전파 요청에 실패했습니다."
    }, { status: 502 });
  }
}
