import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, ensureWorkspaceContext, getWorkspaceUser, toJson } from "@/lib/supabase-admin";
import { isRecord, parseEducationRecordDrafts, parseScenarioContext, parseWorkerProfiles, readString } from "@/lib/workspace-api";

export const dynamic = "force-dynamic";

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

  const context = await ensureWorkspaceContext(client, user, parseScenarioContext(body.scenario));
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
