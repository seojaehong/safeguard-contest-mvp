import type { WorkpackDispatchChannel } from "@/lib/workpack-commercial";

export type ConfiguredProviderChannelResult = {
  channel: WorkpackDispatchChannel;
  provider: "n8n-relay";
  status: "sent" | "failed";
  message: string;
  httpStatus?: number;
};

export type ConfiguredProviderReceipt = {
  workflowRunId: string;
  providerStatus: "live";
  channelResults: ConfiguredProviderChannelResult[];
};

const timeoutMs = 20_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseProviderReceipt(
  value: unknown,
  requestedChannels: WorkpackDispatchChannel[]
): ConfiguredProviderReceipt | null {
  if (!isRecord(value) || value.ok !== true || typeof value.workflowRunId !== "string" || !value.workflowRunId.trim()) {
    return null;
  }
  if (!Array.isArray(value.channelResults) || value.channelResults.length !== requestedChannels.length) return null;
  const byChannel = new Map<WorkpackDispatchChannel, ConfiguredProviderChannelResult>();
  for (const raw of value.channelResults) {
    if (!isRecord(raw)) return null;
    const channel = raw.channel;
    if (channel !== "email" && channel !== "sms" && channel !== "kakao") return null;
    if (!requestedChannels.includes(channel) || byChannel.has(channel)) return null;
    if (raw.status !== "sent" && raw.status !== "failed") return null;
    const result: ConfiguredProviderChannelResult = {
      channel,
      provider: "n8n-relay",
      status: raw.status,
      message: typeof raw.message === "string" && raw.message.trim()
        ? raw.message.trim()
        : raw.status === "sent" ? "provider가 전송 요청을 접수했습니다." : "provider가 전송 요청을 거절했습니다."
    };
    if (typeof raw.httpStatus === "number" && Number.isFinite(raw.httpStatus)) {
      result.httpStatus = raw.httpStatus;
    }
    byChannel.set(channel, result);
  }
  if (requestedChannels.some((channel) => !byChannel.has(channel))) return null;
  return {
    workflowRunId: value.workflowRunId.trim(),
    providerStatus: "live",
    channelResults: requestedChannels.map((channel) => byChannel.get(channel) as ConfiguredProviderChannelResult)
  };
}

export async function dispatchWithConfiguredProvider(input: {
  url: string;
  token: string;
  requestedChannels: WorkpackDispatchChannel[];
  payload: Record<string, unknown>;
}): Promise<ConfiguredProviderReceipt> {
  if (!input.url.trim() || !input.token.trim() || !input.requestedChannels.length) {
    throw new Error("provider receipt unavailable: configured adapter is required");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-safeguard-secret": input.token
      },
      body: JSON.stringify(input.payload),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`provider receipt unavailable: HTTP ${response.status} ${text.slice(0, 200)}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch (error) {
      console.warn("workflow provider receipt parse failed", error);
      throw new Error("provider receipt unavailable: strict JSON response required");
    }
    const receipt = parseProviderReceipt(parsed, input.requestedChannels);
    if (!receipt) throw new Error("provider receipt unavailable: incomplete or conflicting channel evidence");
    return receipt;
  } finally {
    clearTimeout(timeout);
  }
}
