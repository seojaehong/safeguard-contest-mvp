import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  createSupabaseAdminClient,
  getWorkspaceUser,
  toJson,
  type WorkspaceDatabase
} from "@/lib/supabase-admin";
import { isRecord } from "@/lib/workspace-api";
import { buildShareSessionDraft, parseShareRecipientIds } from "@/lib/workpack-commercial";
import type { WorkpackDispatchChannel } from "@/lib/workpack-commercial";
import {
  loadOwnedWorkpackOperationContext,
  loadServerShareRecipients
} from "@/lib/workpack-commercial-store";
import {
  buildChannelRuntimeConfiguration,
  buildShareDispatchBinding,
  verifyChannelAvailabilityToken
} from "@/lib/channel-availability";
import { isLiveDispatchEnabled, resolveWebhookConfig } from "@/lib/n8n-webhook";
import {
  readReviewedLocalizationEnvelopes,
  resolveReviewedLocalizationAuthority
} from "@/lib/reviewed-localization-envelope";
import { readWorkpackShareServerConfig } from "@/lib/workpack-share-server-config";

export const dynamic = "force-dynamic";

const SHARE_SESSION_TTL_MS = 24 * 60 * 60 * 1_000;
const SHARE_CHANNELS: WorkpackDispatchChannel[] = ["email", "sms", "kakao"];

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseChannels(value: unknown): WorkpackDispatchChannel[] {
  if (!Array.isArray(value)) return [];
  const channels = value.filter((item): item is WorkpackDispatchChannel => (
    typeof item === "string" && SHARE_CHANNELS.includes(item as WorkpackDispatchChannel)
  ));
  return channels.length === value.length && new Set(channels).size === channels.length ? channels : [];
}

export async function GET(request: NextRequest, context: RouteContext) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, configured: false, sessions: [], confirmations: [], message: "Supabase 저장소가 아직 설정되지 않았습니다." });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({ ok: false, configured: true, sessions: [], confirmations: [], message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  const owned = await loadOwnedWorkpackOperationContext(client, user, id);
  if (!owned.ok) {
    return NextResponse.json({ ok: false, configured: true, sessions: [], confirmations: [], message: owned.message }, { status: owned.status });
  }

  const { data: sessions, error: sessionError } = await client
    .from("workpack_share_sessions")
    .select("id,share_scope,recipients_snapshot,access_policy,status,expires_at,created_at,updated_at")
    .eq("workpack_id", owned.context.workpackId)
    .order("created_at", { ascending: false });

  if (sessionError) {
    console.error("share sessions fetch failed", sessionError);
    return NextResponse.json({ ok: false, configured: true, sessions: [], confirmations: [], message: "공유 세션을 불러오지 못했습니다." }, { status: 500 });
  }

  const { data: confirmations, error: confirmationError } = await client
    .from("workpack_read_confirmations")
    .select("id,share_session_id,worker_display_name,language_code,read_at")
    .eq("workpack_id", owned.context.workpackId)
    .order("read_at", { ascending: false });

  if (confirmationError) {
    console.error("share session confirmations fetch failed", confirmationError);
    return NextResponse.json({
      ok: false,
      configured: true,
      sessions: sessions || [],
      confirmations: [],
      message: "공유 세션은 조회됐지만 확인 이력 저장소를 불러오지 못했습니다. Phase 2 migration 적용 상태를 확인해 주세요."
    }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    sessions: sessions || [],
    confirmations: confirmations || [],
    message: "작업팩 공유 세션과 확인 현황을 불러왔습니다."
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, configured: false, shareSessionId: null, message: "Supabase 저장소가 아직 설정되지 않았습니다." });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({ ok: false, configured: true, shareSessionId: null, message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  const owned = await loadOwnedWorkpackOperationContext(client, user, id);
  if (!owned.ok) {
    return NextResponse.json({ ok: false, configured: true, shareSessionId: null, message: owned.message }, { status: owned.status });
  }
  if (!owned.context.shareAuthority.readiness.canShare || !owned.context.shareAuthority.workpack) {
    return NextResponse.json({
      ok: false,
      configured: true,
      shareSessionId: null,
      readiness: owned.context.shareAuthority.readiness,
      message: "서버 검수에서 공유 준비가 확인된 작업팩만 공유 세션을 만들 수 있습니다."
    }, { status: 409 });
  }

  const parsed = await request.json().catch((): unknown => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const recipientIds = parseShareRecipientIds(body.recipients);
  const channels = parseChannels(body.channels);
  const requestedRevision = typeof body.canonicalWorkpackRevision === "string"
    ? body.canonicalWorkpackRevision.trim()
    : "";
  const availabilityToken = typeof body.availabilityToken === "string" ? body.availabilityToken.trim() : "";
  if (!recipientIds.ok || !channels.length || !requestedRevision || !availabilityToken) {
    return NextResponse.json({
      ok: false,
      configured: true,
      shareSessionId: null,
      message: recipientIds.ok
        ? "공유 대상, 채널, 작업팩 revision, 채널 확인 token을 확인해 주세요."
        : recipientIds.message
    }, { status: 400 });
  }
  const serverConfig = readWorkpackShareServerConfig(process.env);
  if (!serverConfig.ok) {
    return NextResponse.json({
      ok: false,
      configured: false,
      shareSessionId: null,
      invalidConfigurationKeys: serverConfig.invalidKeys,
      message: "공유 세션의 서버 설정을 확인해 주세요."
    }, { status: 503 });
  }

  const serverRecipients = await loadServerShareRecipients(client, {
    organizationId: owned.context.organizationId,
    siteId: owned.context.siteId,
    requestedWorkerIds: recipientIds.workerIds
  });
  if (!serverRecipients.ok) {
    return NextResponse.json({ ok: false, configured: true, shareSessionId: null, message: serverRecipients.message }, { status: 400 });
  }

  const localization = resolveReviewedLocalizationAuthority({
    workpackId: owned.context.workpackId,
    response: owned.context.shareAuthority.workpack,
    reviewedEnvelopes: readReviewedLocalizationEnvelopes(owned.context.evidenceSummary),
    recipients: serverRecipients.recipients,
    secret: serverConfig.config.reviewedLocalizationSecret
  });
  if (!localization.ok) {
    return NextResponse.json({
      ...localization,
      configured: true,
      shareSessionId: null
    }, { status: 409 });
  }
  if (localization.canonicalWorkpackRevision !== requestedRevision) {
    return NextResponse.json({
      ok: false,
      configured: true,
      shareSessionId: null,
      reasonCode: "workpack_revision_or_digest_changed",
      message: "작업팩 revision이 변경되어 세션을 만들지 않았습니다."
    }, { status: 409 });
  }

  const webhook = resolveWebhookConfig();
  const runtime = buildChannelRuntimeConfiguration({
    environment: process.env,
    liveDispatch: isLiveDispatchEnabled(),
    relayEndpoint: webhook.url || null,
    relayCredential: webhook.token || null
  });
  const channelVerification = verifyChannelAvailabilityToken({
    config: serverConfig.config,
    runtime,
    userId: user.id,
    organizationId: owned.context.organizationId,
    siteId: owned.context.siteId,
    workpackId: owned.context.workpackId,
    canonicalWorkpackRevision: localization.canonicalWorkpackRevision,
    recipients: serverRecipients.recipients,
    requestedChannels: channels,
    now: new Date()
  }, availabilityToken);
  if (!channelVerification.ok || !channelVerification.resolution.ready) {
    return NextResponse.json({
      ok: false,
      configured: true,
      shareSessionId: null,
      reasonCode: channelVerification.ok ? "channel_unavailable" : channelVerification.reasonCode,
      channels: channelVerification.ok ? channelVerification.resolution.channels : [],
      message: "현재 서버 채널 상태가 전송 준비 조건을 충족하지 않아 세션을 만들지 않았습니다."
    }, { status: 409 });
  }

  const shareSessionId = randomUUID();
  const createdAt = new Date().toISOString();
  const dispatchBinding = buildShareDispatchBinding({
    sessionIdentity: {
      shareSessionId,
      organizationId: owned.context.organizationId,
      siteId: owned.context.siteId,
      workpackId: owned.context.workpackId,
      createdBy: user.id
    },
    localization,
    channelResolution: channelVerification.resolution,
    createdAt
  });

  const draft = buildShareSessionDraft({
    organizationId: owned.context.organizationId,
    siteId: owned.context.siteId,
    workpackId: owned.context.workpackId,
    createdBy: user.id,
    recipients: serverRecipients.recipients,
    dispatchBinding
  });
  const expiresAt = new Date(Date.now() + SHARE_SESSION_TTL_MS).toISOString();

  const insert: WorkspaceDatabase["public"]["Tables"]["workpack_share_sessions"]["Insert"] = {
    id: shareSessionId,
    organization_id: draft.organization_id,
    site_id: draft.site_id,
    workpack_id: draft.workpack_id,
    share_scope: draft.share_scope,
    recipients_snapshot: toJson(draft.recipients_snapshot),
    access_policy: toJson(draft.access_policy),
    status: draft.status,
    expires_at: expiresAt,
    created_by: draft.created_by
  };

  const { data, error } = await client
    .from("workpack_share_sessions")
    .insert(insert)
    .select("id,expires_at")
    .single();

  if (error) {
    console.error("share session create failed", error);
    return NextResponse.json({ ok: false, configured: true, shareSessionId: null, message: "공유 세션 생성에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    shareSessionId: data.id,
    expiresAt: data.expires_at || expiresAt,
    message: "초대된 작업자 기준 공유 세션을 만들었습니다."
  });
}
