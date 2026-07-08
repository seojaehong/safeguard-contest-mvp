import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  getWorkspaceUser,
  toJson,
  type WorkspaceDatabase
} from "@/lib/supabase-admin";
import { isRecord, readString } from "@/lib/workspace-api";
import { buildReadConfirmationDraft } from "@/lib/workpack-commercial";
import { loadOwnedWorkpackOperationContext } from "@/lib/workpack-commercial-store";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, configured: false, confirmations: [], message: "Supabase 저장소가 아직 설정되지 않았습니다." });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({ ok: false, configured: true, confirmations: [], message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  const owned = await loadOwnedWorkpackOperationContext(client, user, id);
  if (!owned.ok) {
    return NextResponse.json({ ok: false, configured: true, confirmations: [], message: owned.message }, { status: owned.status });
  }

  const { data, error } = await client
    .from("workpack_read_confirmations")
    .select("id,share_session_id,worker_id,worker_display_name,worker_snapshot,language_code,confirmation_method,read_at")
    .eq("workpack_id", owned.context.workpackId)
    .order("read_at", { ascending: false });

  if (error) {
    console.error("read confirmations fetch failed", error);
    return NextResponse.json({ ok: false, configured: true, confirmations: [], message: "열람 확인 이력을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    confirmations: data || [],
    message: "열람 확인 이력을 불러왔습니다."
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, configured: false, confirmationId: null, message: "Supabase 저장소가 아직 설정되지 않았습니다." });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({ ok: false, configured: true, confirmationId: null, message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  const owned = await loadOwnedWorkpackOperationContext(client, user, id);
  if (!owned.ok) {
    return NextResponse.json({ ok: false, configured: true, confirmationId: null, message: owned.message }, { status: owned.status });
  }

  const parsed = await request.json().catch((): unknown => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const draft = buildReadConfirmationDraft({
    organizationId: owned.context.organizationId,
    siteId: owned.context.siteId,
    workpackId: owned.context.workpackId,
    shareSessionId: readString(body.shareSessionId) || null,
    workerId: readString(body.workerId) || null,
    displayName: readString(body.displayName),
    workerSnapshot: isRecord(body.workerSnapshot) ? body.workerSnapshot : {},
    languageCode: readString(body.languageCode, "ko")
  });

  if (!draft.ok) {
    return NextResponse.json({ ok: false, configured: true, confirmationId: null, message: draft.message }, { status: 400 });
  }

  const insert: WorkspaceDatabase["public"]["Tables"]["workpack_read_confirmations"]["Insert"] = {
    ...draft.insert,
    worker_snapshot: toJson(draft.insert.worker_snapshot)
  };

  const { data, error } = await client
    .from("workpack_read_confirmations")
    .insert(insert)
    .select("id")
    .single();

  if (error) {
    console.error("read confirmation create failed", error);
    return NextResponse.json({ ok: false, configured: true, confirmationId: null, message: "열람 확인 저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    confirmationId: data.id,
    message: "작업자 열람 확인을 저장했습니다."
  });
}
