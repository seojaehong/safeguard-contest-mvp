import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, ensureWorkspaceContext, getWorkspaceUser, toJson } from "@/lib/supabase-admin";
import { isRecord, parseScenarioContext, readString } from "@/lib/workspace-api";

export async function POST(request: NextRequest) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, configured: false, workpackId: null, message: "Supabase 저장소가 아직 설정되지 않았습니다." });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({ ok: false, configured: true, workpackId: null, message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = await request.json().catch((): unknown => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const question = readString(body.question, "현장 작업 문서팩");
  const scenario = isRecord(body.scenario) ? body.scenario : {};
  const context = await ensureWorkspaceContext(client, user, parseScenarioContext(scenario));

  const { data, error } = await client
    .from("workpacks")
    .insert({
      organization_id: context.organizationId,
      site_id: context.siteId,
      question,
      scenario: toJson(scenario),
      deliverables: toJson(body.deliverables || {}),
      evidence_summary: toJson(body.evidenceSummary || {}),
      worker_summary: toJson(body.workerSummary || {}),
      status: toJson(body.status || {}),
      created_by: user.id
    })
    .select("id")
    .single();

  if (error) {
    console.error("workpack save failed", error);
    return NextResponse.json({ ok: false, configured: true, workpackId: null, message: "문서팩 저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, configured: true, workpackId: data.id, message: "문서팩과 작업 배치 요약을 저장했습니다." });
}
