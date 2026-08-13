import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, ensureWorkspaceContext, getWorkspaceUser } from "@/lib/supabase-admin";
import { isRecord, parseScenarioContext, parseWorkerProfiles } from "@/lib/workspace-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: true, configured: false, workers: [], message: "Supabase 저장소 설정 후 근로자 이력을 불러옵니다." });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({ ok: false, configured: true, workers: [], message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(client, user, {
    companyName: request.nextUrl.searchParams.get("companyName") || undefined,
    siteName: request.nextUrl.searchParams.get("siteName") || undefined,
    companyType: request.nextUrl.searchParams.get("companyType") || undefined
  });

  const { data, error } = await client
    .from("workers")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("site_id", context.siteId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("worker list load failed", error);
    return NextResponse.json({ ok: false, configured: true, workers: [], message: "근로자 명단을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, configured: true, workers: data });
}

export async function POST(request: NextRequest) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, configured: false, workerMap: {}, message: "Supabase 저장소가 아직 설정되지 않았습니다." });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({ ok: false, configured: true, workerMap: {}, message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = await request.json().catch((): unknown => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const workers = parseWorkerProfiles(body.workers);
  if (!workers.length) {
    return NextResponse.json({ ok: false, configured: true, workerMap: {}, message: "저장할 근로자 정보가 없습니다." }, { status: 400 });
  }

  const context = await ensureWorkspaceContext(client, user, parseScenarioContext(body.scenario));
  const rows = workers.map((worker) => ({
    organization_id: context.organizationId,
    site_id: context.siteId,
    external_key: worker.id,
    display_name: worker.displayName,
    role: worker.role,
    joined_at: worker.joinedAt || null,
    experience_summary: worker.experienceSummary || null,
    nationality: worker.nationality || null,
    language_code: worker.languageCode,
    language_label: worker.languageLabel,
    is_new_worker: worker.isNewWorker,
    is_foreign_worker: worker.isForeignWorker,
    training_status: worker.trainingStatus,
    training_summary: worker.trainingSummary || null,
    phone: worker.phone || null,
    email: worker.email || null,
    updated_at: new Date().toISOString()
  }));

  const externalKeys = Array.from(new Set(rows.map((row) => row.external_key)));
  const { data: existingWorkers, error: existingWorkersError } = await client
    .from("workers")
    .select("external_key, site_id")
    .eq("organization_id", context.organizationId)
    .in("external_key", externalKeys);

  if (existingWorkersError) {
    console.error("worker site binding lookup failed", existingWorkersError);
    return NextResponse.json({
      ok: false,
      configured: true,
      workerMap: {},
      message: "기존 근로자의 현장 연결을 확인하지 못했습니다."
    }, { status: 500 });
  }

  const conflictingWorkerKeys = ((existingWorkers || []) as Array<{
    external_key: string;
    site_id: string | null;
  }>).filter((worker) => worker.site_id !== context.siteId)
    .map((worker) => worker.external_key);
  if (conflictingWorkerKeys.length) {
    return NextResponse.json({
      ok: false,
      configured: true,
      workerMap: {},
      code: "WORKER_SITE_TRANSFER_REQUIRED",
      workerKeys: conflictingWorkerKeys,
      message: "다른 현장에 연결된 근로자는 별도 전환 절차 없이 재배정할 수 없습니다."
    }, { status: 409 });
  }

  const { data, error } = await client
    .from("workers")
    .upsert(rows, { onConflict: "organization_id,external_key" })
    .select("id, external_key");

  if (error) {
    console.error("worker upsert failed", error);
    return NextResponse.json({ ok: false, configured: true, workerMap: {}, message: "근로자 명단 저장에 실패했습니다." }, { status: 500 });
  }

  const workerMap = Object.fromEntries((data || []).map((item) => [item.external_key, item.id]));
  return NextResponse.json({ ok: true, configured: true, workerMap, message: "근로자 명단을 저장했습니다." });
}
