import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { enforceRateLimit } from "@/lib/api-guard";
import { isLiveDispatchEnabled, postWebhookWithTimeout, resolveWebhookConfig } from "@/lib/n8n-webhook";
import { createSupabaseAdminClient, getWorkspaceUser } from "@/lib/supabase-admin";
import { validateDispatchContacts, type WorkpackDispatchChannel } from "@/lib/workpack-commercial";
import {
  validateWorkflowDispatchMessage,
  type WorkflowDispatchMessageTarget
} from "@/lib/workflow-share-client";
import {
  loadActiveOwnedShareSession,
  loadOwnedWorkpackOperationContext
} from "@/lib/workpack-commercial-store";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

type WorkflowChannel = "email" | "sms" | "kakao" | "band";

type WorkflowRequest = {
  workpackId?: string;
  shareSessionId?: string;
  idempotencyKey?: string;
  channels?: WorkflowChannel[];
  operatorNote?: string;
  messageTarget?: string;
  message?: string;
};

type WorkflowSuccessResponse = {
  ok?: boolean;
  workflowRunId?: string;
  providerStatus?: string;
  message?: string;
  channelResults?: unknown;
  summary?: unknown;
  idempotencySupported?: boolean;
  duplicateRisk?: boolean;
  providerCalled?: boolean;
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

const ACTIVE_CHANNELS: WorkflowChannel[] = ["email", "sms", "kakao"];
const LOCKED_CHANNELS: WorkflowChannel[] = ["band"];
const PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED = false;
const PROVIDER_IDEMPOTENCY_KEY_PATTERN = /^provider-dispatch-v1-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[0-9a-f]{8}$/i;

function isKakaoDispatchEnabled() {
  return process.env.SAFEGUARD_KAKAO_ENABLED === "1" || process.env.SAFECLAW_KAKAO_ENABLED === "1";
}

function isKakaoProviderConfigured() {
  const senderKey = process.env.SOLAPI_KAKAO_SENDER_KEY?.trim();
  const templateId = process.env.SOLAPI_KAKAO_TEMPLATE_ID?.trim();
  const templateCode = process.env.SOLAPI_KAKAO_TEMPLATE_CODE?.trim();
  return isKakaoDispatchEnabled() && Boolean(senderKey || templateId || templateCode);
}

function formatChannelLabel(channel: WorkflowChannel) {
  if (channel === "email") return "메일";
  if (channel === "sms") return "문자";
  if (channel === "kakao") return "카카오 알림톡";
  return "밴드";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseChannels(value: unknown): WorkflowChannel[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is WorkflowChannel => (
    typeof item === "string" && ACTIVE_CHANNELS.includes(item as WorkflowChannel)
  ));
}

function parseLockedChannels(value: unknown): WorkflowChannel[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is WorkflowChannel => (
    typeof item === "string" && LOCKED_CHANNELS.includes(item as WorkflowChannel)
  ));
}

function parseUnsupportedChannels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>([...ACTIVE_CHANNELS, ...LOCKED_CHANNELS]);
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item && !allowed.has(item));
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
      if (typeof channel !== "string" || !ACTIVE_CHANNELS.includes(channel as WorkflowChannel)) continue;
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

function buildFixtureDispatchResponse(channels: WorkflowChannel[], recipients: Array<Record<string, unknown>>): WorkflowSuccessResponse {
  return {
    ok: true,
    workflowRunId: `fixture-${Date.now()}`,
    providerStatus: "fixture",
    idempotencySupported: false,
    duplicateRisk: false,
    providerCalled: false,
    channelResults: channels.map((channel) => ({
      channel,
      provider: "safe-fixture",
      status: "sent",
      message: `SAFEGUARD_RUN_LIVE_DISPATCH=1이 아니므로 실제 ${formatChannelLabel(channel)} provider 호출 없이 fixture 접수로 기록했습니다.`,
      httpStatus: 202
    })),
    summary: {
      mode: "fixture",
      recipientCount: recipients.length
    },
    message: "안전 fixture 모드로 전파 요청을 검증했습니다. 실제 provider 전송은 실행하지 않았습니다."
  };
}

function buildPreflightChannelResults(channels: WorkflowChannel[], webhookConfigured: boolean): WorkflowChannelResult[] {
  return channels.flatMap((channel) => {
    if (channel !== "kakao") return [];

    if (!isKakaoDispatchEnabled()) {
      return [{
        channel,
        provider: "solapi-alimtalk",
        status: "unconfigured",
        message: "카카오 알림톡은 채널 연동과 승인 템플릿 설정 후 활성화됩니다."
      }];
    }

    if (!webhookConfigured && !isKakaoProviderConfigured()) {
      return [{
        channel,
        provider: "solapi-alimtalk",
        status: "unconfigured",
        message: "카카오 알림톡 전송 설정을 확인해야 합니다. n8n relay 또는 Solapi 템플릿 설정이 필요합니다."
      }];
    }

    return [];
  });
}

function isPreflightBlocked(channel: WorkflowChannel, preflightResults: WorkflowChannelResult[]) {
  return preflightResults.some((item) => item.channel === channel && item.status === "unconfigured");
}

type DispatchWebhookPayloadInput = {
  idempotencyKey: string;
  channels: WorkflowChannel[];
  recipients: Array<Record<string, unknown>>;
  operatorNote: string;
  messageTarget: WorkflowDispatchMessageTarget;
  message: string;
  workpack: unknown;
  sentAt?: string;
};

export function buildDispatchWebhookPayload(input: DispatchWebhookPayloadInput) {
  validateWorkflowDispatchMessage(input);
  return {
    event: "safeguard.workpack.dispatch" as const,
    idempotencyKey: input.idempotencyKey,
    sentAt: input.sentAt || new Date().toISOString(),
    channels: input.channels,
    recipients: input.recipients,
    operatorNote: input.operatorNote,
    messageTarget: input.messageTarget,
    message: input.message,
    workpack: input.workpack
  };
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, limiter);
  if (limited) return limited;
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
  const lockedChannels = parseLockedChannels(body.channels);
  const unsupportedChannels = parseUnsupportedChannels(body.channels);
  const allowedFields = new Set([
    "workpackId",
    "shareSessionId",
    "idempotencyKey",
    "channels",
    "operatorNote",
    "messageTarget",
    "message"
  ]);
  const rejectedFields = Object.keys(body).filter((key) => !allowedFields.has(key));

  if (rejectedFields.length) {
    return NextResponse.json({
      ok: false,
      configured: Boolean(webhookConfig.url && webhookConfig.token),
      rejectedFields,
      message: "전파 요청에는 서버 권한 식별자, 채널, 대상 언어, 검증된 메시지만 사용할 수 있습니다."
    }, { status: 400 });
  }

  if (lockedChannels.length) {
    return NextResponse.json({
      ok: false,
      configured: Boolean(webhookConfig.url && webhookConfig.token),
      lockedChannels,
      message: "밴드 전파는 승인 대기 상태입니다. 현재 서버 전파는 메일·문자와 설정된 카카오 알림톡만 허용합니다."
    }, { status: 400 });
  }

  if (unsupportedChannels.length) {
    return NextResponse.json({
      ok: false,
      configured: Boolean(webhookConfig.url && webhookConfig.token),
      unsupportedChannels,
      message: "지원하지 않는 전파 채널입니다. 현재 활성 채널은 메일·문자와 설정된 카카오 알림톡입니다."
    }, { status: 400 });
  }

  const workpackId = typeof body.workpackId === "string" ? body.workpackId.trim() : "";
  const shareSessionId = typeof body.shareSessionId === "string" ? body.shareSessionId.trim() : "";
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  const dispatchMessage = {
    messageTarget: typeof body.messageTarget === "string" ? body.messageTarget : "",
    message: typeof body.message === "string" ? body.message : ""
  };
  if (!workpackId || !shareSessionId || !PROVIDER_IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey) || channels.length === 0) {
    return NextResponse.json({
      ok: false,
      configured: Boolean(webhookConfig.url && webhookConfig.token),
      message: "작업팩, 공유 세션, provider idempotency key, 전파 채널을 확인해 주세요."
    }, { status: 400 });
  }
  try {
    validateWorkflowDispatchMessage(dispatchMessage);
  } catch (error) {
    return NextResponse.json({
      ok: false,
      configured: Boolean(webhookConfig.url && webhookConfig.token),
      message: error instanceof Error ? error.message : "전송 메시지를 확인해 주세요."
    }, { status: 400 });
  }

  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, configured: false, message: "Supabase 저장소가 아직 설정되지 않았습니다." }, { status: 503 });
  }
  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({ ok: false, configured: true, message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const owned = await loadOwnedWorkpackOperationContext(client, user, workpackId);
  if (!owned.ok) {
    return NextResponse.json({ ok: false, configured: true, message: owned.message }, { status: owned.status });
  }
  if (!owned.context.shareAuthority.readiness.canShare || !owned.context.shareAuthority.workpack) {
    return NextResponse.json({
      ok: false,
      configured: true,
      readiness: owned.context.shareAuthority.readiness,
      message: "서버 검수에서 공유 준비가 확인되지 않은 작업팩은 전파할 수 없습니다."
    }, { status: 409 });
  }

  const activeSession = await loadActiveOwnedShareSession(client, {
    organizationId: owned.context.organizationId,
    siteId: owned.context.siteId,
    workpackId: owned.context.workpackId,
    shareSessionId,
    userId: user.id
  });
  if (!activeSession.ok) {
    return NextResponse.json({ ok: false, configured: true, message: activeSession.message }, { status: activeSession.status });
  }

  const contactValidation = validateDispatchContacts({
    channels: channels as WorkpackDispatchChannel[],
    recipients: activeSession.session.recipients
  });
  if (!contactValidation.ok) {
    return NextResponse.json({ ok: false, configured: true, message: contactValidation.message }, { status: 409 });
  }
  const recipients = activeSession.session.recipients.map((recipient) => recipient.workerSnapshot || {});

  if (isLiveDispatchEnabled() && !PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED) {
    return NextResponse.json({
      ok: false,
      configured: false,
      providerStatus: "idempotency-unsupported",
      idempotencySupported: false,
      duplicateRisk: true,
      providerCalled: false,
      idempotencyKey,
      message: "영속 provider idempotency를 보장할 저장 계약이 없어 실제 provider 호출을 차단했습니다. 중복방지 지원 전에는 재전송하지 마세요."
    }, { status: 409 });
  }

  const webhookConfigured = Boolean(webhookConfig.url && webhookConfig.token);
  const preflightChannelResults = buildPreflightChannelResults(channels, webhookConfigured);
  const dispatchChannels = channels.filter((channel) => !isPreflightBlocked(channel, preflightChannelResults));

  if (!dispatchChannels.length) {
    const summary = summarizeChannelResults(preflightChannelResults);
    return NextResponse.json({
      ok: false,
      configured: webhookConfigured,
      idempotencyKey,
      idempotencySupported: PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED,
      duplicateRisk: false,
      providerCalled: false,
      channelResults: preflightChannelResults,
      summary,
      message: "선택한 전파 채널 중 즉시 전송 가능한 채널이 없습니다. 카카오 알림톡 채널·템플릿 설정을 확인해 주세요."
    });
  }

  if (isLiveDispatchEnabled() && (!webhookConfig.url || !webhookConfig.token)) {
    const channelResults = [
      ...dispatchChannels.map((channel) => ({
        channel,
        provider: "n8n",
        status: "unconfigured" as const,
        message: `${formatChannelLabel(channel)} 전송을 위한 n8n relay 설정을 확인해야 합니다.`
      })),
      ...preflightChannelResults
    ];
    return NextResponse.json({
      ok: false,
      configured: false,
      idempotencyKey,
      idempotencySupported: PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED,
      duplicateRisk: false,
      providerCalled: false,
      channelResults,
      summary: summarizeChannelResults(channelResults),
      message: "현장 전파 연결을 확인해야 합니다. n8n relay 또는 provider 설정을 점검해 주세요."
    });
  }

  const payload = buildDispatchWebhookPayload({
    idempotencyKey,
    channels: dispatchChannels,
    recipients,
    operatorNote: typeof body.operatorNote === "string" ? body.operatorNote : "",
    messageTarget: dispatchMessage.messageTarget,
    message: dispatchMessage.message,
    workpack: owned.context.shareAuthority.workpack
  });

  try {
    const workflowResponse = isLiveDispatchEnabled()
      ? await postWebhookWithTimeout(webhookConfig.url, webhookConfig.token, payload)
      : buildFixtureDispatchResponse(dispatchChannels, recipients);
    const channelResults = [
      ...normalizeChannelResults(workflowResponse.channelResults, dispatchChannels),
      ...preflightChannelResults
    ];
    const summary = summarizeChannelResults(channelResults);
    return NextResponse.json({
      ok: (workflowResponse.ok ?? true) && summary.failed === 0,
      configured: true,
      workflowRunId: workflowResponse.workflowRunId,
      providerStatus: workflowResponse.providerStatus,
      idempotencyKey,
      idempotencySupported: PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED,
      duplicateRisk: false,
      providerCalled: isLiveDispatchEnabled(),
      channelResults,
      summary,
      message: workflowResponse.message || "n8n 웹훅이 전파 요청을 접수했습니다."
    });
  } catch (error) {
    console.error("workflow dispatch failed", error);
    return NextResponse.json({
      ok: false,
      configured: true,
      providerStatus: "provider-response-uncertain",
      idempotencyKey,
      idempotencySupported: PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED,
      duplicateRisk: true,
      providerCalled: true,
      message: error instanceof Error ? error.message : "n8n 전파 요청에 실패했습니다."
    }, { status: 502 });
  }
}
