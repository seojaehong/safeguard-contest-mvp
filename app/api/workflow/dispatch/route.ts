import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { enforceRateLimit } from "@/lib/api-guard";
import {
  buildChannelRuntimeConfiguration,
  buildShareRecipientDigest,
  resolveServerChannelAvailability,
  validateShareDispatchBinding
} from "@/lib/channel-availability";
import { parseWorkflowShareChannels, type WorkflowShareChannel } from "@/lib/channel-resolution-contract";
import { isLiveDispatchEnabled, resolveWebhookConfig } from "@/lib/n8n-webhook";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  readReviewedLocalizationEnvelopes,
  resolveReviewedLocalizationAuthority
} from "@/lib/reviewed-localization-envelope";
import {
  createSupabaseAdminClient,
  getWorkspaceUser,
  toJson,
  type WorkspaceDatabase
} from "@/lib/supabase-admin";
import { validateDispatchContacts } from "@/lib/workpack-commercial";
import {
  loadActiveOwnedShareSession,
  loadOwnedWorkpackOperationContext,
  loadServerShareRecipients
} from "@/lib/workpack-commercial-store";
import {
  completeServerDispatchGate,
  markServerDispatchGateUncertain,
  parseServerDispatchGate,
  reserveServerDispatchGate,
  type ServerDispatchGate,
  type ServerDispatchOutcome
} from "@/lib/workpack-dispatch-gate";
import { readWorkpackShareServerConfig } from "@/lib/workpack-share-server-config";
import {
  dispatchWithConfiguredProvider,
  type ConfiguredProviderChannelResult
} from "@/lib/workflow-dispatch-provider";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });
const allowedFields = new Set(["workpackId", "shareSessionId", "idempotencyKey", "channels", "operatorNote"]);
const idempotencyKeyPattern = /^provider-dispatch-v1-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[0-9a-f]{8}$/i;

type DispatchGateRow = {
  id: string;
  accessPolicy: Record<string, unknown>;
  updatedAt: string;
  gate: ServerDispatchGate;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBodyChannels(value: unknown): {
  channels: WorkflowShareChannel[] | null;
  lockedChannels: string[];
  unsupportedChannels: string[];
} {
  const raw = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim())
    : [];
  return {
    channels: parseWorkflowShareChannels(value),
    lockedChannels: raw.filter((channel) => channel === "band"),
    unsupportedChannels: raw.filter((channel) => !["email", "sms", "kakao", "band"].includes(channel))
  };
}

function gateMatchesRequest(gate: ServerDispatchGate, input: {
  shareSessionId: string;
  workpackId: string;
  canonicalWorkpackRevision: string;
  channels: WorkflowShareChannel[];
  idempotencyKey: string;
}): boolean {
  return gate.shareSessionId === input.shareSessionId
    && gate.workpackId === input.workpackId
    && gate.canonicalWorkpackRevision === input.canonicalWorkpackRevision
    && gate.idempotencyKey === input.idempotencyKey
    && JSON.stringify(gate.requestedChannels) === JSON.stringify(input.channels);
}

function nextCasTimestamp(previous: string): string {
  const previousTime = Date.parse(previous);
  const minimum = Number.isFinite(previousTime) ? previousTime + 1 : 0;
  return new Date(Math.max(Date.now(), minimum)).toISOString();
}

async function loadDispatchGateRow(
  client: SupabaseClient<WorkspaceDatabase>,
  input: { shareSessionId: string; workpackId: string; organizationId: string; userId: string }
): Promise<{ ok: true; row: DispatchGateRow } | { ok: false; status: number; reasonCode: string; message: string }> {
  const { data, error } = await client
    .from("workpack_share_sessions")
    .select("id,organization_id,workpack_id,created_by,status,access_policy,updated_at")
    .eq("id", input.shareSessionId)
    .eq("workpack_id", input.workpackId)
    .eq("organization_id", input.organizationId)
    .eq("created_by", input.userId)
    .maybeSingle();
  if (error) {
    console.error("dispatch gate read failed", error);
    return { ok: false, status: 500, reasonCode: "dispatch_gate_read_failed", message: "서버 dispatch gate를 읽지 못했습니다." };
  }
  if (!data || data.status !== "active" || !isRecord(data.access_policy)) {
    return { ok: false, status: 409, reasonCode: "dispatch_gate_missing", message: "활성 공유 세션의 서버 dispatch gate를 찾지 못했습니다." };
  }
  const gate = parseServerDispatchGate(data.access_policy.dispatchGate);
  if (!gate) {
    return { ok: false, status: 409, reasonCode: "dispatch_gate_invalid", message: "공유 세션의 서버 dispatch gate가 올바르지 않습니다." };
  }
  return {
    ok: true,
    row: { id: data.id, accessPolicy: data.access_policy, updatedAt: data.updated_at, gate }
  };
}

async function compareAndSwapDispatchGate(
  client: SupabaseClient<WorkspaceDatabase>,
  row: DispatchGateRow,
  gate: ServerDispatchGate,
  changedAt: string
): Promise<{ ok: true; row: DispatchGateRow } | { ok: false; reasonCode: string }> {
  const accessPolicy = { ...row.accessPolicy, dispatchGate: gate };
  const { data, error } = await client
    .from("workpack_share_sessions")
    .update({ access_policy: toJson(accessPolicy), updated_at: changedAt })
    .eq("id", row.id)
    .eq("updated_at", row.updatedAt)
    .eq("status", "active")
    .select("id,access_policy,updated_at")
    .maybeSingle();
  if (error) {
    console.error("dispatch gate compare-and-swap failed", error);
    return { ok: false, reasonCode: "dispatch_gate_cas_failed" };
  }
  if (!data || !isRecord(data.access_policy)) {
    return { ok: false, reasonCode: "dispatch_already_reserved" };
  }
  const persistedGate = parseServerDispatchGate(data.access_policy.dispatchGate);
  if (!persistedGate || persistedGate.integrityDigest !== gate.integrityDigest) {
    return { ok: false, reasonCode: "dispatch_gate_persistence_mismatch" };
  }
  return {
    ok: true,
    row: { id: data.id, accessPolicy: data.access_policy, updatedAt: data.updated_at, gate: persistedGate }
  };
}

async function persistServerDispatchLogs(
  client: SupabaseClient<WorkspaceDatabase>,
  input: {
    organizationId: string;
    siteId: string | null;
    workpackId: string;
    shareSessionId: string;
    canonicalWorkpackRevision: string;
    idempotencyKey: string;
    receiptId: string;
    outcome: ServerDispatchOutcome;
    workflowRunId: string;
    recipientCount: number;
    channelResults: ConfiguredProviderChannelResult[];
  }
): Promise<{ ok: true; logIds: string[] } | { ok: false }> {
  const rows: WorkspaceDatabase["public"]["Tables"]["dispatch_logs"]["Insert"][] = input.channelResults.map((result) => ({
    organization_id: input.organizationId,
    site_id: input.siteId,
    workpack_id: input.workpackId,
    channel: result.channel,
    target_label: `${input.recipientCount}명`,
    target_contact: null,
    language_code: null,
    provider: result.provider,
    provider_status: result.status,
    workflow_run_id: input.workflowRunId,
    failure_reason: result.status === "failed" ? result.message : null,
    payload: toJson({
      version: "server-dispatch-evidence/v1",
      receiptId: input.receiptId,
      shareSessionId: input.shareSessionId,
      idempotencyKey: input.idempotencyKey,
      workpackId: input.workpackId,
      canonicalWorkpackRevision: input.canonicalWorkpackRevision,
      outcome: input.outcome,
      channel: result.channel,
      channelOutcome: result.status,
      providerCalled: true
    })
  }));
  const { data, error } = await client.from("dispatch_logs").insert(rows).select("id");
  if (error) {
    console.error("server dispatch evidence insert failed", error);
    return { ok: false };
  }
  const logIds = (data || []).flatMap((item) => (
    typeof item.id === "string" && item.id.trim() ? [item.id] : []
  ));
  if (logIds.length !== rows.length) {
    console.error("server dispatch evidence identities incomplete", { expected: rows.length, actual: logIds.length });
    return { ok: false };
  }
  return { ok: true, logIds };
}

function classifyOutcome(results: ConfiguredProviderChannelResult[]): ServerDispatchOutcome {
  const sent = results.filter((result) => result.status === "sent").length;
  if (sent === results.length) return "accepted";
  if (sent > 0) return "partial";
  return "failed";
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, limiter);
  if (limited) return limited;
  const webhook = resolveWebhookConfig();

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json() as unknown;
    body = isRecord(parsed) ? parsed : {};
  } catch (error) {
    console.warn("workflow dispatch body parse failed", error);
    return NextResponse.json({ ok: false, configured: false, providerCalled: false, message: "요청 본문을 해석하지 못했습니다." }, { status: 400 });
  }

  const rejectedFields = Object.keys(body).filter((key) => !allowedFields.has(key));
  const parsedChannels = parseBodyChannels(body.channels);
  if (rejectedFields.length || parsedChannels.lockedChannels.length || parsedChannels.unsupportedChannels.length) {
    return NextResponse.json({
      ok: false,
      configured: Boolean(webhook.url && webhook.token),
      providerCalled: false,
      rejectedFields,
      lockedChannels: parsedChannels.lockedChannels,
      unsupportedChannels: parsedChannels.unsupportedChannels,
      message: "전파 요청에는 서버가 허용한 작업팩, 세션, idempotency key와 메일·문자·카카오 채널만 사용할 수 있습니다."
    }, { status: 400 });
  }

  const workpackId = typeof body.workpackId === "string" ? body.workpackId.trim() : "";
  const shareSessionId = typeof body.shareSessionId === "string" ? body.shareSessionId.trim() : "";
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  const channels = parsedChannels.channels;
  if (!workpackId || !shareSessionId || !idempotencyKeyPattern.test(idempotencyKey) || !channels) {
    return NextResponse.json({ ok: false, configured: false, providerCalled: false, message: "작업팩, 공유 세션, 서버 idempotency key, 전파 채널을 확인해 주세요." }, { status: 400 });
  }

  const client = createSupabaseAdminClient();
  if (!client) return NextResponse.json({ ok: false, configured: false, providerCalled: false, message: "Supabase 저장소가 아직 설정되지 않았습니다." }, { status: 503 });
  const user = await getWorkspaceUser(client, request.headers);
  if (!user) return NextResponse.json({ ok: false, configured: true, providerCalled: false, message: "관리자 로그인이 필요합니다." }, { status: 401 });

  const owned = await loadOwnedWorkpackOperationContext(client, user, workpackId);
  if (!owned.ok) return NextResponse.json({ ok: false, configured: true, providerCalled: false, message: owned.message }, { status: owned.status });
  if (!owned.context.shareAuthority.readiness.canShare || !owned.context.shareAuthority.workpack) {
    return NextResponse.json({
      ok: false,
      configured: true,
      state: "stale",
      reasonCode: "workpack_revalidation",
      providerCalled: false,
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
  if (!activeSession.ok) return NextResponse.json({ ok: false, configured: true, providerCalled: false, message: activeSession.message }, { status: activeSession.status });

  const serverConfig = readWorkpackShareServerConfig(process.env);
  if (!serverConfig.ok) {
    return NextResponse.json({
      ok: false,
      configured: false,
      state: "stale",
      reasonCode: "channel_configuration_changed",
      providerCalled: false,
      invalidConfigurationKeys: serverConfig.invalidKeys,
      message: "전송 binding을 검증할 서버 설정이 준비되지 않았습니다."
    }, { status: 503 });
  }

  const workerIds = activeSession.session.recipients.flatMap((recipient) => recipient.workerId ? [recipient.workerId] : []);
  const currentRecipients = await loadServerShareRecipients(client, {
    organizationId: owned.context.organizationId,
    siteId: owned.context.siteId,
    requestedWorkerIds: workerIds
  });
  if (!currentRecipients.ok) {
    return NextResponse.json({ ok: false, configured: true, state: "review_required", reasonCode: "recipient_locale_invalid", providerCalled: false, message: currentRecipients.message }, { status: 409 });
  }
  const localization = resolveReviewedLocalizationAuthority({
    workpackId: owned.context.workpackId,
    response: owned.context.shareAuthority.workpack,
    reviewedEnvelopes: readReviewedLocalizationEnvelopes(owned.context.evidenceSummary),
    recipients: currentRecipients.recipients,
    secret: serverConfig.config.reviewedLocalizationSecret
  });
  if (!localization.ok) {
    return NextResponse.json({ ...localization, configured: true, state: "review_required", providerCalled: false }, { status: 409 });
  }

  const runtime = buildChannelRuntimeConfiguration({
    environment: process.env,
    liveDispatch: isLiveDispatchEnabled(),
    relayEndpoint: webhook.url || null,
    relayCredential: webhook.token || null
  });
  const channelResolution = resolveServerChannelAvailability({
    config: serverConfig.config,
    runtime,
    userId: user.id,
    organizationId: owned.context.organizationId,
    siteId: owned.context.siteId,
    workpackId: owned.context.workpackId,
    canonicalWorkpackRevision: localization.canonicalWorkpackRevision,
    recipients: currentRecipients.recipients,
    requestedChannels: channels,
    now: new Date()
  });
  if (!channelResolution.ok || !channelResolution.ready) {
    return NextResponse.json({
      ok: false,
      configured: Boolean(webhook.url && webhook.token),
      state: "stale",
      reasonCode: channelResolution.ok ? "channel_unavailable" : channelResolution.reasonCode,
      channels: channelResolution.ok ? channelResolution.channels : [],
      providerCalled: false,
      message: "현재 서버 채널 상태가 전송 준비 조건을 충족하지 않습니다."
    }, { status: 409 });
  }
  const binding = validateShareDispatchBinding({
    binding: activeSession.session.dispatchBinding,
    sessionIdentity: {
      shareSessionId: activeSession.session.id,
      organizationId: activeSession.session.organizationId,
      siteId: activeSession.session.siteId,
      workpackId: activeSession.session.workpackId,
      createdBy: activeSession.session.createdBy
    },
    localization,
    recipientSnapshotDigest: buildShareRecipientDigest(currentRecipients.recipients),
    channelResolution
  });
  if (!binding.ok) {
    return NextResponse.json({
      ok: false,
      configured: true,
      state: binding.reasonCode === "translation_incomplete" ? "review_required" : "stale",
      reasonCode: binding.reasonCode,
      providerCalled: false,
      message: "공유 세션 생성 후 전송 조건이 변경되어 provider 호출을 시작하지 않았습니다."
    }, { status: 409 });
  }
  const contacts = validateDispatchContacts({ channels, recipients: currentRecipients.recipients });
  if (!contacts.ok) {
    return NextResponse.json({ ok: false, configured: true, state: "stale", reasonCode: "recipient_contact_missing", providerCalled: false, message: contacts.message }, { status: 409 });
  }

  if (!isLiveDispatchEnabled() || runtime.dispatchMode !== "live" || !webhook.url || !webhook.token) {
    return NextResponse.json({
      ok: false,
      configured: false,
      state: "blocked",
      reasonCode: "provider_adapter_unavailable",
      idempotencySupported: true,
      duplicateRisk: false,
      providerCalled: false,
      idempotencyKey,
      message: "설정된 live provider adapter가 없어 실제 전송을 차단했습니다."
    }, { status: 409 });
  }

  const loadedGate = await loadDispatchGateRow(client, {
    shareSessionId,
    workpackId: owned.context.workpackId,
    organizationId: owned.context.organizationId,
    userId: user.id
  });
  if (!loadedGate.ok) {
    return NextResponse.json({ ok: false, configured: true, state: "blocked", reasonCode: loadedGate.reasonCode, providerCalled: false, idempotencySupported: true, duplicateRisk: false, message: loadedGate.message }, { status: loadedGate.status });
  }
  if (!gateMatchesRequest(loadedGate.row.gate, {
    shareSessionId,
    workpackId: owned.context.workpackId,
    canonicalWorkpackRevision: localization.canonicalWorkpackRevision,
    channels,
    idempotencyKey
  })) {
    return NextResponse.json({ ok: false, configured: true, state: "stale", reasonCode: "dispatch_gate_binding_mismatch", providerCalled: false, idempotencySupported: true, duplicateRisk: false, message: "서버 발급 dispatch gate와 요청 binding이 일치하지 않습니다." }, { status: 409 });
  }

  const receiptId = randomUUID();
  const reservedAt = nextCasTimestamp(loadedGate.row.updatedAt);
  const reservation = reserveServerDispatchGate(loadedGate.row.gate, { idempotencyKey, receiptId, reservedAt });
  if (!reservation.ok) {
    return NextResponse.json({ ok: false, configured: true, state: "blocked", reasonCode: reservation.reasonCode, providerCalled: false, idempotencySupported: true, duplicateRisk: false, message: "이미 예약되었거나 일치하지 않는 전송 요청입니다." }, { status: 409 });
  }
  const reserved = await compareAndSwapDispatchGate(client, loadedGate.row, reservation.gate, reservedAt);
  if (!reserved.ok) {
    return NextResponse.json({ ok: false, configured: true, state: "blocked", reasonCode: reserved.reasonCode, providerCalled: false, idempotencySupported: true, duplicateRisk: false, message: "다른 요청이 먼저 전송 gate를 예약했습니다." }, { status: 409 });
  }

  const localizedByWorker = new Map(localization.dispatchRecipients.map((recipient) => [recipient.workerId, recipient]));
  const providerPayload = {
    event: "safeguard.workpack.dispatch",
    receiptId,
    shareSessionId,
    idempotencyKey,
    workpackId: owned.context.workpackId,
    canonicalWorkpackRevision: localization.canonicalWorkpackRevision,
    sentAt: reservedAt,
    channels,
    recipients: currentRecipients.recipients.map((recipient) => ({
      ...(recipient.workerSnapshot || {}),
      localizedDispatch: recipient.workerId ? localizedByWorker.get(recipient.workerId) || null : null
    })),
    operatorNote: typeof body.operatorNote === "string" ? body.operatorNote.trim() : "",
    workpack: owned.context.shareAuthority.workpack
  };

  let providerReceipt;
  try {
    providerReceipt = await dispatchWithConfiguredProvider({
      url: webhook.url,
      token: webhook.token,
      requestedChannels: channels,
      payload: providerPayload
    });
  } catch (error) {
    console.error("configured workflow provider dispatch failed", error);
    const completedAt = nextCasTimestamp(reserved.row.updatedAt);
    const uncertain = markServerDispatchGateUncertain(reserved.row.gate, {
      receiptId,
      failureReason: error instanceof Error ? error.message : "provider receipt unavailable",
      completedAt
    });
    if (uncertain) await compareAndSwapDispatchGate(client, reserved.row, uncertain, completedAt);
    return NextResponse.json({
      ok: false,
      configured: true,
      state: "uncertain",
      reasonCode: "provider_receipt_uncertain",
      providerStatus: "provider-response-uncertain",
      idempotencyKey,
      idempotencySupported: true,
      duplicateRisk: true,
      providerCalled: true,
      message: error instanceof Error ? error.message : "provider 응답을 검증하지 못했습니다."
    }, { status: 502 });
  }

  const outcome = classifyOutcome(providerReceipt.channelResults);
  const persisted = await persistServerDispatchLogs(client, {
    organizationId: owned.context.organizationId,
    siteId: owned.context.siteId,
    workpackId: owned.context.workpackId,
    shareSessionId,
    canonicalWorkpackRevision: localization.canonicalWorkpackRevision,
    idempotencyKey,
    receiptId,
    outcome,
    workflowRunId: providerReceipt.workflowRunId,
    recipientCount: currentRecipients.recipients.length,
    channelResults: providerReceipt.channelResults
  });
  if (!persisted.ok) {
    const completedAt = nextCasTimestamp(reserved.row.updatedAt);
    const uncertain = markServerDispatchGateUncertain(reserved.row.gate, {
      receiptId,
      failureReason: "server dispatch evidence persistence failed",
      completedAt,
      workflowRunId: providerReceipt.workflowRunId
    });
    if (uncertain) await compareAndSwapDispatchGate(client, reserved.row, uncertain, completedAt);
    return NextResponse.json({ ok: false, configured: true, state: "uncertain", reasonCode: "dispatch_evidence_unpersisted", providerCalled: true, duplicateRisk: true, idempotencySupported: true, idempotencyKey, message: "provider 결과를 서버 이력에 완전하게 저장하지 못해 성공으로 처리하지 않았습니다." }, { status: 500 });
  }

  const completedAt = nextCasTimestamp(reserved.row.updatedAt);
  const completed = completeServerDispatchGate(reserved.row.gate, {
    receiptId,
    outcome,
    workflowRunId: providerReceipt.workflowRunId,
    logIds: persisted.logIds,
    completedAt
  });
  if (!completed.ok) {
    console.error("dispatch receipt completion failed", completed);
    return NextResponse.json({ ok: false, configured: true, state: "uncertain", reasonCode: completed.reasonCode, providerCalled: true, duplicateRisk: true, idempotencySupported: true, idempotencyKey, message: "서버 receipt 완료 binding을 만들지 못해 성공으로 처리하지 않았습니다." }, { status: 500 });
  }
  const recorded = await compareAndSwapDispatchGate(client, reserved.row, completed.gate, completedAt);
  if (!recorded.ok) {
    return NextResponse.json({ ok: false, configured: true, state: "uncertain", reasonCode: recorded.reasonCode, providerCalled: true, duplicateRisk: true, idempotencySupported: true, idempotencyKey, message: "서버 receipt 최종 CAS를 확인하지 못해 성공으로 처리하지 않았습니다." }, { status: 500 });
  }

  return NextResponse.json({
    ok: outcome === "accepted" || outcome === "partial",
    configured: true,
    state: "recorded",
    outcome,
    workflowRunId: providerReceipt.workflowRunId,
    providerStatus: providerReceipt.providerStatus,
    idempotencyKey,
    idempotencySupported: true,
    duplicateRisk: false,
    providerCalled: true,
    channelResults: providerReceipt.channelResults,
    logIds: persisted.logIds,
    receipt: {
      version: "server-dispatch-receipt/v1",
      receiptId,
      shareSessionId,
      idempotencyKey,
      workpackId: owned.context.workpackId,
      canonicalWorkpackRevision: localization.canonicalWorkpackRevision,
      outcome,
      workflowRunId: providerReceipt.workflowRunId,
      logIds: persisted.logIds,
      recordedAt: completedAt
    },
    message: outcome === "accepted"
      ? "설정된 provider가 전송을 접수했고 서버 receipt와 이력을 저장했습니다."
      : outcome === "partial"
        ? "일부 채널이 전송을 접수했고 서버 receipt와 이력을 저장했습니다."
        : "provider가 모든 채널을 거절했으며 서버 receipt와 이력을 저장했습니다."
  });
}
