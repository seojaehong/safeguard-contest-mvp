import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, ensureWorkspaceContext, getWorkspaceUser, toJson } from "@/lib/supabase-admin";
import { isRecord, parseScenarioContext, readString } from "@/lib/workspace-api";
import { dispatchLogRowId, isDispatchLogReplayError } from "@/lib/dispatch-log-idempotency";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DISPATCH_LOG_IDEMPOTENCY_PATTERN = /^dispatch-v1-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[0-9a-f]{8}$/i;
const MAX_DISPATCH_LOGS_PER_REQUEST = 100;

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

  const archiveLogs = (logs || []).map((log) => {
    const workpackId = log.workpack_id;
    return {
      id: log.id,
      organizationName: log.organization_id ? organizationMap.get(log.organization_id) || "SafeClaw Pilot" : "SafeClaw Pilot",
      siteName: log.site_id ? siteMap.get(log.site_id) || "기본 현장" : "기본 현장",
      workpackId,
      channel: log.channel,
      targetLabel: log.target_label,
      targetContact: log.target_contact,
      languageCode: log.language_code,
      provider: log.provider,
      providerStatus: log.provider_status,
      workflowRunId: log.workflow_run_id,
      failureReason: log.failure_reason,
      createdAt: log.created_at,
      reopenHref: workpackId ? `/documents?workpackId=${encodeURIComponent(workpackId)}` : "/dispatch"
    };
  });

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
  const idempotencyKey = readString(body.idempotencyKey);
  if (!logs.length) {
    return NextResponse.json({ ok: false, configured: true, savedCount: 0, message: "저장할 전파 이력이 없습니다." }, { status: 400 });
  }
  if (logs.length > MAX_DISPATCH_LOGS_PER_REQUEST) {
    return NextResponse.json({
      ok: false,
      configured: true,
      savedCount: 0,
      code: "dispatch_log_batch_too_large",
      message: "한 번에 저장할 수 있는 전파 이력 수를 초과했습니다.",
    }, { status: 413 });
  }
  if (!DISPATCH_LOG_IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
    return NextResponse.json({
      ok: false,
      configured: true,
      savedCount: 0,
      code: "dispatch_log_idempotency_key_invalid",
      message: "전파 이력 저장 요청 키가 올바르지 않습니다.",
    }, { status: 400 });
  }
  if (workpackId && !UUID_PATTERN.test(workpackId)) {
    return NextResponse.json({
      ok: false,
      configured: true,
      savedCount: 0,
      code: "dispatch_workpack_id_invalid",
      message: "문서팩 식별자가 올바르지 않습니다.",
    }, { status: 400 });
  }

  const context = await ensureWorkspaceContext(client, user, parseScenarioContext(body.scenario));
  if (workpackId) {
    const { data: ownedWorkpack, error: workpackError } = await client
      .from("workpacks")
      .select("id,organization_id,site_id")
      .eq("id", workpackId)
      .eq("organization_id", context.organizationId)
      .eq("site_id", context.siteId)
      .maybeSingle();

    if (workpackError) {
      console.error("dispatch workpack ownership verification failed", workpackError);
      return NextResponse.json({
        ok: false,
        configured: true,
        savedCount: 0,
        code: "dispatch_workpack_verification_failed",
        message: "문서팩 소유 범위를 확인하지 못해 전파 이력을 저장하지 않았습니다.",
      }, { status: 500 });
    }

    if (!ownedWorkpack
      || ownedWorkpack.id !== workpackId
      || ownedWorkpack.organization_id !== context.organizationId
      || ownedWorkpack.site_id !== context.siteId) {
      return NextResponse.json({
        ok: false,
        configured: true,
        savedCount: 0,
        code: "dispatch_workpack_not_owned",
        message: "현재 현장에서 확인할 수 없는 문서팩입니다.",
      }, { status: 404 });
    }
  }

  const rows = logs.map((log, rowIndex) => ({
    id: dispatchLogRowId({
      organizationId: context.organizationId,
      siteId: context.siteId,
      idempotencyKey,
      rowIndex,
    }),
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
    payload: toJson({
      ...(isRecord(log.payload) ? log.payload : {}),
      idempotencyKey
    })
  }));

  const { error } = await client.from("dispatch_logs").insert(rows);

  if (error) {
    if (isDispatchLogReplayError(error)) {
      return NextResponse.json({
        ok: false,
        configured: true,
        savedCount: 0,
        code: "dispatch_log_idempotency_key_reused",
        message: "이미 처리된 전파 이력 저장 요청입니다.",
      }, { status: 409 });
    }
    console.error("dispatch logs save failed", error);
    return NextResponse.json({ ok: false, configured: true, savedCount: 0, message: "전파 이력 저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, configured: true, savedCount: rows.length, message: "전파 이력을 저장했습니다." });
}
