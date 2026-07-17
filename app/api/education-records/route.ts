import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, ensureWorkspaceContext, getWorkspaceUser, toJson } from "@/lib/supabase-admin";
import { isRecord, parseEducationRecordDrafts, parseScenarioContext, parseWorkerProfiles, readString } from "@/lib/workspace-api";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readWorkerMap(value: unknown) {
  if (!isRecord(value)) return new Map<string, string>();
  return new Map(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1]))
  );
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
  const records = parseEducationRecordDrafts(body.records);
  const workers = parseWorkerProfiles(body.workers);
  const workerMap = readWorkerMap(body.workerMap);
  const workpackId = readString(body.workpackId) || null;

  if (!records.length) {
    return NextResponse.json({ ok: false, configured: true, savedCount: 0, message: "저장할 교육기록이 없습니다." }, { status: 400 });
  }

  const referencedWorkerIds = Array.from(new Set(records.flatMap((record) => {
    const workerId = workerMap.get(record.workerId);
    return workerId ? [workerId] : [];
  })));
  if ((workpackId && !UUID_PATTERN.test(workpackId))
    || referencedWorkerIds.some((workerId) => !UUID_PATTERN.test(workerId))) {
    return NextResponse.json({
      ok: false,
      configured: true,
      savedCount: 0,
      code: "education_relationship_id_invalid",
      message: "문서팩 또는 작업자 식별자가 올바르지 않습니다.",
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
      console.error("education workpack ownership verification failed", workpackError);
      return NextResponse.json({
        ok: false,
        configured: true,
        savedCount: 0,
        code: "education_relationship_verification_failed",
        message: "교육기록의 문서팩 범위를 확인하지 못해 저장하지 않았습니다.",
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
        code: "education_relationship_not_owned",
        message: "현재 현장에서 확인할 수 없는 문서팩 또는 작업자입니다.",
      }, { status: 404 });
    }
  }

  if (referencedWorkerIds.length) {
    const { data: ownedWorkers, error: workerError } = await client
      .from("workers")
      .select("id,organization_id,site_id")
      .in("id", referencedWorkerIds)
      .eq("organization_id", context.organizationId)
      .eq("site_id", context.siteId);

    if (workerError) {
      console.error("education worker ownership verification failed", workerError);
      return NextResponse.json({
        ok: false,
        configured: true,
        savedCount: 0,
        code: "education_relationship_verification_failed",
        message: "교육기록의 작업자 범위를 확인하지 못해 저장하지 않았습니다.",
      }, { status: 500 });
    }

    const ownedWorkerIds = new Set((ownedWorkers || []).flatMap((worker) => (
      worker.organization_id === context.organizationId
      && worker.site_id === context.siteId
      && referencedWorkerIds.includes(worker.id)
        ? [worker.id]
        : []
    )));
    if (ownedWorkerIds.size !== referencedWorkerIds.length) {
      return NextResponse.json({
        ok: false,
        configured: true,
        savedCount: 0,
        code: "education_relationship_not_owned",
        message: "현재 현장에서 확인할 수 없는 문서팩 또는 작업자입니다.",
      }, { status: 404 });
    }
  }

  const rows = records.map((record) => {
    const worker = workers.find((item) => item.id === record.workerId);
    return {
      organization_id: context.organizationId,
      site_id: context.siteId,
      workpack_id: workpackId,
      worker_id: workerMap.get(record.workerId) || null,
      worker_external_key: record.workerId,
      worker_snapshot: toJson(worker || { id: record.workerId }),
      topic: record.topic,
      language_code: record.languageCode,
      language_label: record.languageLabel,
      confirmation_status: record.confirmationStatus,
      confirmation_method: record.confirmationMethod || null,
      memo: record.memo || null
    };
  });

  const { error } = await client.from("education_records").insert(rows);

  if (error) {
    console.error("education records save failed", error);
    return NextResponse.json({ ok: false, configured: true, savedCount: 0, message: "교육 확인 이력 저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, configured: true, savedCount: rows.length, message: "교육 확인 이력을 저장했습니다." });
}
