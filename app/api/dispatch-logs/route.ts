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
