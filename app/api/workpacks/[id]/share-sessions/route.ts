import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  getWorkspaceUser,
  toJson,
  type WorkspaceDatabase
} from "@/lib/supabase-admin";
import { isRecord } from "@/lib/workspace-api";
import { buildShareSessionDraft, parseShareRecipientIds } from "@/lib/workpack-commercial";
import {
  loadOwnedWorkpackOperationContext,
  loadServerShareRecipients
} from "@/lib/workpack-commercial-store";

export const dynamic = "force-dynamic";

const SHARE_SESSION_TTL_MS = 24 * 60 * 60 * 1_000;

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

  let sessionQuery = client
    .from("workpack_share_sessions")
    .select("id,share_scope,recipients_snapshot,access_policy,status,expires_at,created_at,updated_at")
    .eq("workpack_id", owned.context.workpackId)
    .eq("organization_id", owned.context.organizationId);
  sessionQuery = owned.context.siteId === null
    ? sessionQuery.is("site_id", null)
    : sessionQuery.eq("site_id", owned.context.siteId);
  const { data: sessions, error: sessionError } = await sessionQuery
    .order("created_at", { ascending: false });

  if (sessionError) {
    console.error("share sessions fetch failed", sessionError);
    return NextResponse.json({ ok: false, configured: true, sessions: [], confirmations: [], message: "공유 세션을 불러오지 못했습니다." }, { status: 500 });
  }

  let confirmationQuery = client
    .from("workpack_read_confirmations")
    .select("id,share_session_id,worker_display_name,language_code,read_at")
    .eq("workpack_id", owned.context.workpackId)
    .eq("organization_id", owned.context.organizationId);
  confirmationQuery = owned.context.siteId === null
    ? confirmationQuery.is("site_id", null)
    : confirmationQuery.eq("site_id", owned.context.siteId);
  const { data: confirmations, error: confirmationError } = await confirmationQuery
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
  if (!recipientIds.ok) {
    return NextResponse.json({ ok: false, configured: true, shareSessionId: null, message: recipientIds.message }, { status: 400 });
  }

  const serverRecipients = await loadServerShareRecipients(client, {
    organizationId: owned.context.organizationId,
    siteId: owned.context.siteId,
    requestedWorkerIds: recipientIds.workerIds
  });
  if (!serverRecipients.ok) {
    return NextResponse.json({ ok: false, configured: true, shareSessionId: null, message: serverRecipients.message }, { status: 400 });
  }

  const draft = buildShareSessionDraft({
    organizationId: owned.context.organizationId,
    siteId: owned.context.siteId,
    workpackId: owned.context.workpackId,
    createdBy: user.id,
    recipients: serverRecipients.recipients
  });
  const expiresAt = new Date(Date.now() + SHARE_SESSION_TTL_MS).toISOString();

  const insert: WorkspaceDatabase["public"]["Tables"]["workpack_share_sessions"]["Insert"] = {
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
