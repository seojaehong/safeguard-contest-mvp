import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, ensureWorkspaceContext, getWorkspaceUser, toJson } from "@/lib/supabase-admin";
import { isRecord, parseScenarioContext, readString } from "@/lib/workspace-api";

type DispatchLogDraft = {
  channel: string;
  targetLabel?: string;
  targetContact?: string;
  languageCode?: string;
  provider?: string;
  providerStatus?: string;
  workflowRunId?: string;
  failureReason?: string;
  payload?: unknown;
};

function parseDispatchLogs(value: unknown): DispatchLogDraft[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): DispatchLogDraft[] => {
    if (!isRecord(item)) return [];
    const channel = readString(item.channel);
    if (!channel) return [];

    return [{
      channel,
      targetLabel: readString(item.targetLabel) || undefined,
      targetContact: readString(item.targetContact) || undefined,
      languageCode: readString(item.languageCode) || undefined,
      provider: readString(item.provider) || undefined,
      providerStatus: readString(item.providerStatus) || undefined,
      workflowRunId: readString(item.workflowRunId) || undefined,
      failureReason: readString(item.failureReason) || undefined,
      payload: item.payload
    }];
  });
}

export async function GET(request: NextRequest) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({
      ok: true,
      configured: false,
      logs: [],
      summary: {
        dispatchLogCount: 0,
        lastDispatchedAt: null
      },
      message: "서버 아카이브 연결 전입니다. 운영 저장소를 연결하면 전파 이력이 표시됩니다."
    });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({
      ok: false,
      configured: true,
      logs: [],
      summary: {
        dispatchLogCount: 0,
        lastDispatchedAt: null
      },
      message: "관리자 세션이 확인되면 전파 이력을 불러옵니다."
    }, { status: 401 });
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit") || "30");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 30;

  const { data: organizations, error: organizationError } = await client
    .from("organizations")
    .select("id,name")
    .eq("owner_id", user.id);

  if (organizationError) {
    console.error("dispatch archive organization fetch failed", organizationError);
    return NextResponse.json({
      ok: false,
      configured: true,
      logs: [],
      summary: {
        dispatchLogCount: 0,
        lastDispatchedAt: null
      },
      message: "현재 전파 이력 저장소 응답을 확인하는 중입니다. 잠시 후 다시 조회해 주세요."
    }, { status: 500 });
  }

  const organizationIds = (organizations || []).map((organization) => organization.id);
  if (!organizationIds.length) {
    return NextResponse.json({
      ok: true,
      configured: true,
      logs: [],
      summary: {
        dispatchLogCount: 0,
        lastDispatchedAt: null
      },
      message: "아직 저장된 전파 이력이 없습니다. 메일·문자 전파 결과가 저장되면 이곳에 표시됩니다."
    });
  }

  const { data: logs, error: logError } = await client
    .from("dispatch_logs")
    .select("id,organization_id,site_id,workpack_id,channel,target_label,target_contact,language_code,provider,provider_status,workflow_run_id,failure_reason,created_at")
    .in("organization_id", organizationIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (logError) {
    console.error("dispatch archive fetch failed", logError);
    return NextResponse.json({
      ok: false,
      configured: true,
      logs: [],
      summary: {
        dispatchLogCount: 0,
        lastDispatchedAt: null
      },
      message: "전파 이력을 불러오지 못했습니다. 문서팩 작업은 계속 사용할 수 있습니다."
    }, { status: 500 });
  }

  const siteIds = Array.from(new Set((logs || []).map((log) => log.site_id).filter((id): id is string => Boolean(id))));
  const { data: sites, error: siteError } = siteIds.length
    ? await client.from("sites").select("id,name").in("id", siteIds)
    : { data: [], error: null };

  if (siteError) {
    console.error("dispatch archive site fetch failed", siteError);
  }

  const siteMap = new Map((sites || []).map((site) => [site.id, site.name]));
  const organizationMap = new Map((organizations || []).map((organization) => [organization.id, organization.name]));

  const archiveLogs = (logs || []).map((log) => ({
    id: log.id,
    organizationName: log.organization_id ? organizationMap.get(log.organization_id) || "SafeClaw Pilot" : "SafeClaw Pilot",
    siteName: log.site_id ? siteMap.get(log.site_id) || "기본 현장" : "기본 현장",
    workpackId: log.workpack_id,
    channel: log.channel,
    targetLabel: log.target_label,
    targetContact: log.target_contact,
    languageCode: log.language_code,
    provider: log.provider,
    providerStatus: log.provider_status,
    workflowRunId: log.workflow_run_id,
    failureReason: log.failure_reason,
    createdAt: log.created_at,
    reopenHref: log.workpack_id ? "/documents" : "/dispatch"
  }));

  return NextResponse.json({
    ok: true,
    configured: true,
    logs: archiveLogs,
    summary: {
      dispatchLogCount: archiveLogs.length,
      lastDispatchedAt: archiveLogs[0]?.createdAt || null
    },
    message: archiveLogs.length
      ? "저장된 전파 이력을 불러왔습니다."
      : "아직 저장된 전파 이력이 없습니다. 메일·문자 전파 결과가 저장되면 이곳에 표시됩니다."
  });
}

export async function POST(request: NextRequest) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, configured: false, savedCount: 0, message: "Supabase 저장소가 아직 설정되지 않았습니다." });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({ ok: false, configured: true, savedCount: 0, message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = await request.json().catch((): unknown => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const logs = parseDispatchLogs(body.logs);
  const workpackId = readString(body.workpackId) || null;
  if (!logs.length) {
    return NextResponse.json({ ok: false, configured: true, savedCount: 0, message: "저장할 전파 이력이 없습니다." }, { status: 400 });
  }

  const context = await ensureWorkspaceContext(client, user, parseScenarioContext(body.scenario));
  const rows = logs.map((log) => ({
    organization_id: context.organizationId,
    site_id: context.siteId,
    workpack_id: workpackId,
    channel: log.channel,
    target_label: log.targetLabel || null,
    target_contact: log.targetContact || null,
    language_code: log.languageCode || null,
    provider: log.provider || null,
    provider_status: log.providerStatus || null,
    workflow_run_id: log.workflowRunId || null,
    failure_reason: log.failureReason || null,
    payload: toJson(log.payload || {})
  }));

  const { error } = await client.from("dispatch_logs").insert(rows);

  if (error) {
    console.error("dispatch logs save failed", error);
    return NextResponse.json({ ok: false, configured: true, savedCount: 0, message: "전파 이력 저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, configured: true, savedCount: rows.length, message: "전파 이력을 저장했습니다." });
}
