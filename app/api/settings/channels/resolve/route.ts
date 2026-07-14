import { NextRequest, NextResponse } from "next/server";

import {
  buildChannelRuntimeConfiguration,
  resolveServerChannelAvailability
} from "@/lib/channel-availability";
import { parseChannelResolutionRequest } from "@/lib/channel-resolution-contract";
import { isLiveDispatchEnabled, resolveWebhookConfig } from "@/lib/n8n-webhook";
import {
  readReviewedLocalizationEnvelopes,
  resolveReviewedLocalizationAuthority
} from "@/lib/reviewed-localization-envelope";
import { createSupabaseAdminClient, getWorkspaceUser } from "@/lib/supabase-admin";
import {
  loadOwnedWorkpackOperationContext,
  loadServerShareRecipients
} from "@/lib/workpack-commercial-store";
import { readWorkpackShareServerConfig } from "@/lib/workpack-share-server-config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, ready: false, message: "Supabase 저장소가 설정되지 않았습니다." }, { status: 503 });
  }
  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({ ok: false, ready: false, message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }
  const parsed = await request.json().catch((error): unknown => {
    console.warn("channel availability body parse failed", error);
    return {};
  });
  const body = parseChannelResolutionRequest(parsed);
  if (!body) {
    return NextResponse.json({
      ok: false,
      ready: false,
      message: "작업팩 revision, 참여자, requestedChannels를 확인해 주세요."
    }, { status: 400 });
  }
  const { workpackId, canonicalWorkpackRevision: requestedRevision, recipients: recipientIds, requestedChannels } = body;

  const serverConfig = readWorkpackShareServerConfig(process.env);
  if (!serverConfig.ok) {
    return NextResponse.json({
      ok: false,
      ready: false,
      invalidConfigurationKeys: serverConfig.invalidKeys,
      message: "공유 채널의 서버 설정을 확인해 주세요."
    }, { status: 503 });
  }
  const owned = await loadOwnedWorkpackOperationContext(client, user, workpackId);
  if (!owned.ok) {
    return NextResponse.json({ ok: false, ready: false, message: owned.message }, { status: owned.status });
  }
  if (!owned.context.shareAuthority.readiness.canShare || !owned.context.shareAuthority.workpack) {
    return NextResponse.json({
      ok: false,
      ready: false,
      reasonCode: "workpack_revalidation",
      readiness: owned.context.shareAuthority.readiness,
      message: "서버 검수에서 공유 준비가 확인되지 않았습니다."
    }, { status: 409 });
  }
  const recipients = await loadServerShareRecipients(client, {
    organizationId: owned.context.organizationId,
    siteId: owned.context.siteId,
    requestedWorkerIds: recipientIds
  });
  if (!recipients.ok) {
    return NextResponse.json({ ok: false, ready: false, message: recipients.message }, { status: 400 });
  }
  const localization = resolveReviewedLocalizationAuthority({
    workpackId: owned.context.workpackId,
    response: owned.context.shareAuthority.workpack,
    reviewedEnvelopes: readReviewedLocalizationEnvelopes(owned.context.evidenceSummary),
    recipients: recipients.recipients,
    secret: serverConfig.config.reviewedLocalizationSecret
  });
  if (!localization.ok) {
    return NextResponse.json({ ...localization, ready: false }, { status: 409 });
  }
  if (localization.canonicalWorkpackRevision !== requestedRevision) {
    return NextResponse.json({
      ok: false,
      ready: false,
      reasonCode: "workpack_revision_or_digest_changed",
      message: "작업팩 revision이 변경되어 채널 상태를 다시 확인해야 합니다."
    }, { status: 409 });
  }

  const webhook = resolveWebhookConfig();
  const runtime = buildChannelRuntimeConfiguration({
    environment: process.env,
    liveDispatch: isLiveDispatchEnabled(),
    relayEndpoint: webhook.url || null,
    relayCredential: webhook.token || null
  });
  const resolution = resolveServerChannelAvailability({
    config: serverConfig.config,
    runtime,
    userId: user.id,
    organizationId: owned.context.organizationId,
    siteId: owned.context.siteId,
    workpackId: owned.context.workpackId,
    canonicalWorkpackRevision: localization.canonicalWorkpackRevision,
    recipients: recipients.recipients,
    requestedChannels,
    now: new Date()
  });
  if (!resolution.ok) {
    return NextResponse.json({ ...resolution, ready: false }, { status: 409 });
  }
  return NextResponse.json(resolution);
}
