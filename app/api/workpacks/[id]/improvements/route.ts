import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  getWorkspaceUser,
  toJson,
  type WorkspaceDatabase
} from "@/lib/supabase-admin";
import { isRecord, readString } from "@/lib/workspace-api";
import { analyzeImprovementPhotos } from "@/lib/photo-vision-analysis";
import { buildImprovementDraft, buildImprovementPhotoPath } from "@/lib/workpack-commercial";
import { loadOwnedWorkpackOperationContext } from "@/lib/workpack-commercial-store";

export const dynamic = "force-dynamic";

const IMPROVEMENT_PHOTO_BUCKET = "safeclaw-improvement-photos";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ImprovementRequest = {
  taskLabel: string;
  hazardLabel: string;
  improvementText: string;
  reflectedDocuments: string[];
  beforePhoto: File | null;
  afterPhoto: File | null;
};

type PhotoUploadResult = {
  ok: true;
  storagePath: string | null;
  message: string;
} | {
  ok: false;
  storagePath: string | null;
  message: string;
};

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function isFileValue(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File && value.size > 0;
}

function readFormString(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function readImprovementRequest(request: NextRequest): Promise<ImprovementRequest> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const reflectedDocumentsRaw = readFormString(form, "reflectedDocuments");
    const reflectedDocuments = reflectedDocumentsRaw
      ? reflectedDocumentsRaw.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
    const beforeValue = form.get("beforePhoto");
    const afterValue = form.get("afterPhoto");
    return {
      taskLabel: readFormString(form, "taskLabel"),
      hazardLabel: readFormString(form, "hazardLabel"),
      improvementText: readFormString(form, "improvementText"),
      reflectedDocuments,
      beforePhoto: isFileValue(beforeValue) ? beforeValue : null,
      afterPhoto: isFileValue(afterValue) ? afterValue : null
    };
  }

  const parsed = await request.json().catch((): unknown => ({}));
  const body = isRecord(parsed) ? parsed : {};
  return {
    taskLabel: readString(body.taskLabel),
    hazardLabel: readString(body.hazardLabel),
    improvementText: readString(body.improvementText),
    reflectedDocuments: readStringArray(body.reflectedDocuments),
    beforePhoto: null,
    afterPhoto: null
  };
}

async function uploadPhoto(input: {
  client: ReturnType<typeof createSupabaseAdminClient>;
  organizationId: string;
  siteId: string | null;
  workpackId: string;
  improvementId: string;
  createdBy: string;
  role: "before" | "after";
  file: File;
}) {
  if (!input.client) {
    return { ok: false, storagePath: null, message: "Supabase 저장소가 아직 설정되지 않았습니다." } satisfies PhotoUploadResult;
  }

  const storagePath = buildImprovementPhotoPath({
    organizationId: input.organizationId,
    workpackId: input.workpackId,
    improvementId: input.improvementId,
    kind: input.role,
    fileName: input.file.name
  });

  const { error: uploadError } = await input.client.storage
    .from(IMPROVEMENT_PHOTO_BUCKET)
    .upload(storagePath, input.file, {
      contentType: input.file.type || undefined,
      upsert: true
    });

  if (uploadError) {
    console.error("improvement photo upload failed", uploadError);
    return { ok: false, storagePath, message: "개선사항 사진 업로드에 실패했습니다." } satisfies PhotoUploadResult;
  }

  const insert: WorkspaceDatabase["public"]["Tables"]["workpack_improvement_photos"]["Insert"] = {
    organization_id: input.organizationId,
    site_id: input.siteId,
    workpack_id: input.workpackId,
    improvement_id: input.improvementId,
    photo_role: input.role,
    storage_bucket: IMPROVEMENT_PHOTO_BUCKET,
    storage_path: storagePath,
    original_filename: input.file.name,
    content_type: input.file.type || null,
    analysis_payload: toJson({ status: "queued_for_review" }),
    created_by: input.createdBy
  };

  const { error: photoError } = await input.client
    .from("workpack_improvement_photos")
    .insert(insert);

  if (photoError) {
    console.error("improvement photo metadata insert failed", photoError);
    return { ok: false, storagePath, message: "개선사항 사진 메타데이터 저장에 실패했습니다." } satisfies PhotoUploadResult;
  }

  return { ok: true, storagePath, message: "개선사항 사진을 저장했습니다." } satisfies PhotoUploadResult;
}

async function cleanupFailedImprovement(input: {
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  improvementId: string;
  uploadedPaths: string[];
}) {
  let cleaned = true;
  const { error: deleteError } = await input.client
    .from("workpack_improvements")
    .delete()
    .eq("id", input.improvementId);

  if (deleteError) {
    cleaned = false;
    console.error("failed improvement cleanup delete failed", deleteError);
  }

  if (!input.uploadedPaths.length) return cleaned;

  const { error: storageError } = await input.client.storage
    .from(IMPROVEMENT_PHOTO_BUCKET)
    .remove(input.uploadedPaths);

  if (storageError) {
    cleaned = false;
    console.error("failed improvement storage cleanup failed", storageError);
  }

  return cleaned;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, configured: false, improvements: [], message: "Supabase 저장소가 아직 설정되지 않았습니다." });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({ ok: false, configured: true, improvements: [], message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  const owned = await loadOwnedWorkpackOperationContext(client, user, id);
  if (!owned.ok) {
    return NextResponse.json({ ok: false, configured: true, improvements: [], message: owned.message }, { status: owned.status });
  }

  const { data, error } = await client
    .from("workpack_improvements")
    .select("id,task_label,hazard_label,improvement_text,reflected_documents,review_status,source_type,photo_summary,analysis_payload,created_at,updated_at")
    .eq("workpack_id", owned.context.workpackId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("workpack improvements fetch failed", error);
    return NextResponse.json({ ok: false, configured: true, improvements: [], message: "개선사항 이력을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    improvements: data || [],
    message: "작업팩 개선사항 이력을 불러왔습니다."
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, configured: false, improvementId: null, message: "Supabase 저장소가 아직 설정되지 않았습니다." });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({ ok: false, configured: true, improvementId: null, message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  const owned = await loadOwnedWorkpackOperationContext(client, user, id);
  if (!owned.ok) {
    return NextResponse.json({ ok: false, configured: true, improvementId: null, message: owned.message }, { status: owned.status });
  }

  const body = await readImprovementRequest(request);
  const reflectedDocuments = body.reflectedDocuments.length
    ? body.reflectedDocuments
    : ["위험성평가표", "TBM 브리핑", "TBM 기록"];
  const vision = await analyzeImprovementPhotos({
    taskLabel: body.taskLabel || owned.context.question,
    hazardLabel: body.hazardLabel,
    reflectedDocuments,
    beforePhoto: body.beforePhoto,
    afterPhoto: body.afterPhoto
  });
  const draft = buildImprovementDraft({
    organizationId: owned.context.organizationId,
    siteId: owned.context.siteId,
    workpackId: owned.context.workpackId,
    taskLabel: body.taskLabel || owned.context.question,
    hazardLabel: body.hazardLabel,
    improvementText: body.improvementText || vision.observedImprovement,
    beforePhotoName: body.beforePhoto?.name || null,
    afterPhotoName: body.afterPhoto?.name || null,
    reflectedDocuments: vision.reflectedDocuments.length ? vision.reflectedDocuments : reflectedDocuments,
    createdBy: user.id
  });

  const insert: WorkspaceDatabase["public"]["Tables"]["workpack_improvements"]["Insert"] = {
    organization_id: draft.organization_id,
    site_id: draft.site_id,
    workpack_id: draft.workpack_id,
    task_label: draft.task_label,
    hazard_label: draft.hazard_label,
    improvement_text: draft.improvement_text,
    reflected_documents: draft.reflected_documents,
    review_status: draft.review_status,
    source_type: draft.source_type,
    photo_summary: toJson(draft.photo_summary),
    analysis_payload: toJson({
      status: vision.status,
      provider: vision.provider,
      model: vision.model,
      candidateText: draft.improvement_text,
      summary: vision.summary,
      detectedHazards: vision.detectedHazards,
      observedImprovement: vision.observedImprovement,
      ocrText: vision.ocrText,
      errorMessage: vision.errorMessage || null
    }),
    created_by: draft.created_by
  };

  const { data, error } = await client
    .from("workpack_improvements")
    .insert(insert)
    .select("id")
    .single();

  if (error) {
    console.error("workpack improvement create failed", error);
    return NextResponse.json({ ok: false, configured: true, improvementId: null, message: "개선사항 저장에 실패했습니다." }, { status: 500 });
  }

  const uploads = await Promise.all([
    body.beforePhoto
      ? uploadPhoto({
        client,
        organizationId: owned.context.organizationId,
        siteId: owned.context.siteId,
        workpackId: owned.context.workpackId,
        improvementId: data.id,
        createdBy: user.id,
        role: "before",
        file: body.beforePhoto
      })
      : Promise.resolve({ ok: true, storagePath: null, message: "before 사진 없음" } satisfies PhotoUploadResult),
    body.afterPhoto
      ? uploadPhoto({
        client,
        organizationId: owned.context.organizationId,
        siteId: owned.context.siteId,
        workpackId: owned.context.workpackId,
        improvementId: data.id,
        createdBy: user.id,
        role: "after",
        file: body.afterPhoto
      })
      : Promise.resolve({ ok: true, storagePath: null, message: "after 사진 없음" } satisfies PhotoUploadResult)
  ]);

  const failedUpload = uploads.find((result) => !result.ok);
  if (failedUpload) {
    const uploadedPaths = uploads
      .map((result) => result.storagePath)
      .filter((storagePath): storagePath is string => Boolean(storagePath));
    const cleanupOk = await cleanupFailedImprovement({
      client,
      improvementId: data.id,
      uploadedPaths
    });

    return NextResponse.json({
      ok: false,
      configured: true,
      improvementId: data.id,
      message: cleanupOk
        ? `${failedUpload.message} 생성된 개선사항 후보는 정리했습니다.`
        : `${failedUpload.message} 생성된 개선사항 후보 정리에 실패했습니다. 운영자가 저장소 상태를 확인해야 합니다.`
    }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    improvementId: data.id,
    sourceType: draft.source_type,
    vision: {
      status: vision.status,
      provider: vision.provider,
      model: vision.model,
      summary: vision.summary,
      observedImprovement: vision.observedImprovement,
      detectedHazards: vision.detectedHazards,
      ocrText: vision.ocrText
    },
    message: draft.source_type === "photo_analysis"
      ? "Before/After 사진 기반 개선사항 후보를 저장했습니다."
      : "개선사항 후보를 저장했습니다."
  });
}
