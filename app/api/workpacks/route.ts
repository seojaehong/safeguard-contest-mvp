import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, ensureWorkspaceContext, getWorkspaceUser, toJson } from "@/lib/supabase-admin";
import { isRecord, parseScenarioContext, readString } from "@/lib/workspace-api";

export async function GET(request: NextRequest) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({
      ok: true,
      configured: false,
      workpacks: [],
      message: "Supabase 저장소 설정 후 서버 이력을 불러옵니다."
    });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({
      ok: false,
      configured: true,
      workpacks: [],
      message: "관리자 로그인이 필요합니다."
    }, { status: 401 });
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit") || "20");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;

  const { data: organizations, error: organizationError } = await client
    .from("organizations")
    .select("id,name")
    .eq("owner_id", user.id);

  if (organizationError) {
    console.error("workpack archive organization fetch failed", organizationError);
    return NextResponse.json({
      ok: false,
      configured: true,
      workpacks: [],
      message: "조직 이력 조회에 실패했습니다."
    }, { status: 500 });
  }

  const organizationIds = (organizations || []).map((organization) => organization.id);
  if (!organizationIds.length) {
    return NextResponse.json({
      ok: true,
      configured: true,
      workpacks: [],
      message: "아직 저장된 관리자 이력이 없습니다."
    });
  }

  const { data: workpacks, error: workpackError } = await client
    .from("workpacks")
    .select("id,organization_id,site_id,question,scenario,worker_summary,status,created_at,updated_at")
    .in("organization_id", organizationIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (workpackError) {
    console.error("workpack archive fetch failed", workpackError);
    return NextResponse.json({
      ok: false,
      configured: true,
      workpacks: [],
      message: "문서팩 이력 조회에 실패했습니다."
    }, { status: 500 });
  }

  const siteIds = Array.from(new Set((workpacks || []).map((workpack) => workpack.site_id).filter((id): id is string => Boolean(id))));
  const { data: sites, error: siteError } = siteIds.length
    ? await client.from("sites").select("id,name,industry,region").in("id", siteIds)
    : { data: [], error: null };

  if (siteError) {
    console.error("workpack archive site fetch failed", siteError);
  }

  const siteMap = new Map((sites || []).map((site) => [site.id, site]));
  const organizationMap = new Map((organizations || []).map((organization) => [organization.id, organization.name]));

  return NextResponse.json({
    ok: true,
    configured: true,
    workpacks: (workpacks || []).map((workpack) => {
      const site = workpack.site_id ? siteMap.get(workpack.site_id) : null;
      return {
        id: workpack.id,
        organizationName: organizationMap.get(workpack.organization_id) || "SafeClaw Pilot",
        siteName: site?.name || "기본 현장",
        industry: site?.industry || null,
        region: site?.region || null,
        question: workpack.question,
        scenario: workpack.scenario,
        workerSummary: workpack.worker_summary,
        status: workpack.status,
        createdAt: workpack.created_at,
        updatedAt: workpack.updated_at
      };
    }),
    message: "관리자 문서팩 이력을 불러왔습니다."
  });
}

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
