import { NextRequest, NextResponse } from "next/server";
import { analyzeHazardPhotos, type HazardPhotoVisionAnalysis } from "@/lib/photo-vision-analysis";
import { partialAnalysisMessage, publicPhotoAnalysis } from "@/lib/photo-vision-public";
import { withPublicPhotoAnalysisAdmission } from "@/lib/public-distributed-rate-limit";
import { enforcePublicMultipartRequestBodyBudget } from "@/lib/public-work-budget";
import { createSupabaseAdminClient, getWorkspaceUser } from "@/lib/supabase-admin";
import { projectPublicFailure } from "@/lib/server/public-error";
import {
  VIDEO_MAX_DURATION_SEC,
  VIDEO_MAX_SCENES,
  VIDEO_REQUEST_MAX_BYTES,
  VIDEO_SCENE_MAX_BYTES,
  VIDEO_SCENES_PER_REQUEST
} from "@/lib/video-hazard-frames";
import {
  buildVideoCheckQuestion,
  buildVideoHazardReport,
  missedScenesOf,
  validateVideoCheckInput,
  type VideoSceneMeta
} from "@/lib/video-hazard-report";

/**
 * 동영상 위험 점검 v0 — 장면 사진 묶음 분석.
 * 원본 영상은 받지 않는다. 브라우저가 고르고 줄이고 얼굴을 흐린 장면 사진(최대 4장)과
 * 장면 시각만 받는다. 위험 후보·근거 확정은 사진 위험분석(analyzeHazardPhotos)을 그대로 쓰고,
 * 영상 보고 형식과 생성 규칙 4종은 lib/video-hazard-report.ts 가 맡는다.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** 장면 1장 서버 허용치. 브라우저 목표치(450KB)보다 여유를 둔다. */
const SERVER_SCENE_MAX_BYTES = VIDEO_SCENE_MAX_BYTES * 2;

function isFileValue(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function readText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function readNumber(form: FormData, key: string) {
  const value = Number(readText(form, key));
  return Number.isFinite(value) ? value : NaN;
}

function readSceneTimes(form: FormData, names: readonly string[]): VideoSceneMeta[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readText(form, "sceneTimes") || "null");
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length !== names.length) return null;
  const scenes: VideoSceneMeta[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) return null;
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : "";
    const time = typeof record.time === "number" ? record.time : NaN;
    if (!names.includes(name) || !Number.isFinite(time) || time < 0 || time > VIDEO_MAX_DURATION_SEC + 1) return null;
    scenes.push({ name, time });
  }
  return scenes;
}

function badRequest(code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, code, message, ...extra }, { status: 400 });
}

async function handlePost(request: NextRequest) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: "관리자 인증 저장소가 설정되지 않아 동영상 위험 점검을 시작할 수 없습니다."
    }, { status: 503 });
  }
  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({ ok: false, configured: true, message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const contentLengthValue = request.headers.get("content-length");
  const contentLength = Number(contentLengthValue);
  if (!contentLengthValue || !Number.isFinite(contentLength) || contentLength <= 0) {
    return NextResponse.json({
      ok: false,
      code: "content_length_required",
      message: "장면 점검 요청의 Content-Length가 필요합니다."
    }, { status: 411 });
  }
  if (contentLength > VIDEO_REQUEST_MAX_BYTES) {
    return NextResponse.json({
      ok: false,
      code: "video_scene_payload_too_large",
      message: "장면 사진 용량이 한도를 넘었습니다. 화면에서 다시 줄여 보내 주세요."
    }, { status: 413 });
  }
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return badRequest("multipart_required", "장면 점검은 multipart/form-data 요청만 받습니다.");
  }

  const bodyBudget = await enforcePublicMultipartRequestBodyBudget(
    request,
    VIDEO_REQUEST_MAX_BYTES,
    "video scene multipart body exceeds the request byte budget"
  );
  if (!bodyBudget.ok) return bodyBudget.response;
  const boundedRequest = bodyBudget.request === request ? request : new NextRequest(bodyBudget.request);
  const form = await boundedRequest.formData();

  // 생성 규칙 (4): 장소·작업·걱정되는 점은 필수
  const input = validateVideoCheckInput({
    site: readText(form, "site"),
    task: readText(form, "task"),
    concern: readText(form, "concern")
  });
  if (!input.ok) return badRequest("video_check_fields_required", input.message, { missing: input.missing });

  if (form.getAll("video").length) {
    return badRequest("video_upload_not_accepted", "원본 영상은 받지 않습니다. 화면에서 뽑은 장면 사진만 보내 주세요.");
  }
  const scenes = form.getAll("scenes").filter(isFileValue);
  if (!scenes.length) return badRequest("video_scenes_required", "점검할 장면 사진이 없습니다.");
  if (scenes.length > VIDEO_SCENES_PER_REQUEST) {
    return badRequest("video_scenes_too_many", `장면 사진은 한 번에 ${VIDEO_SCENES_PER_REQUEST}장까지 보냅니다.`);
  }
  if (scenes.some((scene) => scene.size > SERVER_SCENE_MAX_BYTES)) {
    return NextResponse.json({
      ok: false,
      code: "video_scene_payload_too_large",
      message: "장면 사진 한 장의 용량이 한도를 넘었습니다."
    }, { status: 413 });
  }
  const names = scenes.map((scene) => scene.name);
  const sceneTimes = readSceneTimes(form, names);
  if (!sceneTimes) return badRequest("video_scene_times_invalid", "장면 시각 정보가 장면 사진과 맞지 않습니다.");

  const durationSec = readNumber(form, "durationSec");
  if (!Number.isFinite(durationSec) || durationSec <= 0 || durationSec > VIDEO_MAX_DURATION_SEC + 1) {
    return badRequest("video_duration_invalid", "영상 길이 정보가 올바르지 않습니다.");
  }
  const sceneCountRaw = readNumber(form, "sceneCount");
  const sceneCount = Number.isInteger(sceneCountRaw) && sceneCountRaw >= scenes.length && sceneCountRaw <= VIDEO_MAX_SCENES
    ? sceneCountRaw
    : scenes.length;

  let analysis: HazardPhotoVisionAnalysis;
  try {
    analysis = await analyzeHazardPhotos({
      question: buildVideoCheckQuestion(input.value, sceneTimes.map((scene) => scene.time)),
      photos: scenes
    }, { signal: request.signal });
  } catch (error) {
    if (request.signal.aborted) throw error;
    const failure = projectPublicFailure({
      scope: "video-hazard-analysis",
      code: "VIDEO_SCENE_ANALYSIS_FAILED",
      message: "장면 사진 점검을 완료하지 못했습니다.",
      error,
    });
    return NextResponse.json({ ok: false, configured: true, ...failure }, { status: 502 });
  }

  const publicAnalysis = publicPhotoAnalysis(analysis);
  const analysisSummary = {
    status: publicAnalysis.status,
    counts: publicAnalysis.counts,
    errorMessage: publicAnalysis.errorMessage,
    scenes: publicAnalysis.images.map((image) => ({ name: image.name, status: image.status }))
  };
  const configured = analysis.providerMode !== "unconfigured";

  // 분석이 안 됐으면(전 장면 실패·거부, 제공자 미설정) 보고서를 만들지 않는다.
  // 빈 후보로 보고서를 만들면 화면에 「위험 후보를 찾지 못했습니다」로 보인다.
  if (analysis.status !== "analyzed" && analysis.status !== "partial") {
    const unconfigured = analysis.status === "unconfigured";
    return NextResponse.json({
      ok: false,
      configured,
      code: unconfigured ? "VIDEO_SCENE_ANALYSIS_UNCONFIGURED" : "VIDEO_SCENE_ANALYSIS_FAILED",
      analysis: analysisSummary,
      message: unconfigured
        ? "사진 분석 제공자 설정이 안 되어 장면을 점검하지 못했습니다. 위험이 없다는 뜻이 아닙니다."
        : "장면 사진 점검을 완료하지 못했습니다. 위험이 없다는 뜻이 아닙니다. 잠시 뒤 다시 시도해 주세요."
    }, { status: unconfigured ? 503 : 502 });
  }

  const report = buildVideoHazardReport({
    candidates: publicAnalysis.candidates,
    scenes: sceneTimes,
    durationSec,
    sceneCount,
    missedScenes: missedScenesOf(analysisSummary.scenes, sceneTimes)
  });
  return NextResponse.json({
    ok: true,
    configured,
    analysis: analysisSummary,
    report,
    message: analysis.status === "analyzed"
      ? "장면 사진에서 위험 후보를 정리했습니다."
      : `장면 일부 처리: ${partialAnalysisMessage(analysis.counts)}.`
  });
}

export async function POST(request: NextRequest) {
  return withPublicPhotoAnalysisAdmission(request, () => handlePost(request));
}
