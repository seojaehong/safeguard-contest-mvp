import { NextRequest, NextResponse } from "next/server";
import {
  analyzeHazardPhotos,
  getPhotoVisionReadiness,
  type HazardPhotoAnalysisError,
  type HazardPhotoVisionAnalysis,
  type HazardPhotoVisionCandidate,
  MAX_HAZARD_PHOTO_FILES,
  MAX_HAZARD_PHOTO_REQUEST_BYTES,
  MAX_HAZARD_PHOTO_TOTAL_BYTES
} from "@/lib/photo-vision-analysis";
import { withPublicPhotoAnalysisAdmission } from "@/lib/public-distributed-rate-limit";
import { enforcePublicMultipartRequestBodyBudget } from "@/lib/public-work-budget";
import { createSupabaseAdminClient, getWorkspaceUser } from "@/lib/supabase-admin";
import { projectPublicFailure } from "@/lib/server/public-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function isFileValue(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function readQuestion(form: FormData) {
  const value = form.get("question");
  return typeof value === "string" ? value.trim().slice(0, 1200) : "";
}

function readPhotos(form: FormData) {
  return form.getAll("photos").filter(isFileValue);
}

function partialAnalysisMessage(counts: {
  analyzed: number;
  rejected: number;
  failed: number;
  unconfigured: number;
}) {
  return [
    `분석 ${counts.analyzed}장`,
    `거부 ${counts.rejected}장`,
    `실패 ${counts.failed}장`,
    `미설정 ${counts.unconfigured}장`
  ].join(" · ");
}

function publicPhotoError(error: HazardPhotoAnalysisError | null): HazardPhotoAnalysisError | null {
  if (!error) return null;
  if (
    error.code === "empty_file"
    || error.code === "unsupported_mime"
    || error.code === "file_too_large"
  ) {
    return error;
  }
  if (error.code === "invalid_signature") {
    return {
      code: "invalid_signature",
      message: "사진 파일 시그니처를 확인하지 못했습니다.",
      retryable: false,
    };
  }
  if (error.code === "provider_unconfigured") {
    return { ...error, message: "사진 분석 제공자 설정을 확인해야 합니다." };
  }
  if (error.code === "invalid_model_output") {
    return { ...error, message: "사진 분석 결과 형식을 확인하지 못했습니다." };
  }
  return { ...error, message: "사진 분석 제공자 응답을 확인하지 못했습니다." };
}

function publicCandidate(candidate: HazardPhotoVisionCandidate): HazardPhotoVisionCandidate {
  return {
    ...candidate,
    harness: {
      ...candidate.harness,
      errorMessage: candidate.harness.errorMessage
        ? "근거 하네스가 위험 후보를 확정하지 못했습니다."
        : null,
    },
  };
}

function publicPhotoAnalysis(analysis: HazardPhotoVisionAnalysis): HazardPhotoVisionAnalysis {
  return {
    ...analysis,
    images: analysis.images.map((image) => ({
      ...image,
      candidates: image.candidates.map(publicCandidate),
      error: publicPhotoError(image.error),
    })),
    candidates: analysis.candidates.map(publicCandidate),
    ...(analysis.harness ? {
      harness: {
        ...analysis.harness,
        errorMessage: analysis.harness.errorMessage
          ? "근거 하네스가 위험 후보를 확정하지 못했습니다."
          : null,
      },
    } : {}),
    errorMessage: analysis.status === "unconfigured"
      ? "사진 분석 제공자 설정을 확인해야 합니다."
      : analysis.status === "failed"
        ? "현장 사진 분석을 완료하지 못했습니다."
        : undefined,
  };
}

export async function GET(request: NextRequest) {
  void request;
  const readiness = getPhotoVisionReadiness();
  return NextResponse.json({
    ok: readiness.ok,
    status: readiness.ok ? "ready" : "unavailable",
    maxInputPhotos: readiness.maxInputPhotos,
    maxBytesPerPhoto: readiness.maxBytesPerPhoto,
    maxTotalPhotoBytes: readiness.maxTotalPhotoBytes,
    maxRequestBytes: readiness.maxRequestBytes,
    allowedMimeTypes: readiness.allowedMimeTypes,
    acceptedOnly: readiness.acceptedOnly,
    beforeAfterSupported: readiness.beforeAfterSupported,
    ocrSupported: readiness.ocrSupported,
    message: readiness.ok
      ? "사진 분석/OCR 기능을 사용할 수 있습니다."
      : "사진 분석/OCR 기능을 현재 사용할 수 없습니다."
  });
}

async function handlePost(request: NextRequest) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: "관리자 인증 저장소가 설정되지 않아 사진 분석을 시작할 수 없습니다."
    }, { status: 503 });
  }
  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({
      ok: false,
      configured: true,
      message: "관리자 로그인이 필요합니다."
    }, { status: 401 });
  }

  const contentLengthValue = request.headers.get("content-length");
  const contentLength = Number(contentLengthValue);
  if (!contentLengthValue || !Number.isFinite(contentLength) || contentLength <= 0) {
    return NextResponse.json({
      ok: false,
      code: "content_length_required",
      message: "사진 분석 요청의 Content-Length가 필요합니다."
    }, { status: 411 });
  }
  if (contentLength > MAX_HAZARD_PHOTO_REQUEST_BYTES) {
    return NextResponse.json({
      ok: false,
      code: "photo_payload_too_large",
      message: "사진 분석 요청 전체 용량이 허용 한도를 초과합니다."
    }, { status: 413 });
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({
      ok: false,
      message: "현장 사진 분석은 multipart/form-data 요청만 지원합니다."
    }, { status: 400 });
  }

  const bodyBudget = await enforcePublicMultipartRequestBodyBudget(
    request,
    MAX_HAZARD_PHOTO_REQUEST_BYTES,
    "photo analysis multipart body exceeds the request byte budget"
  );
  if (!bodyBudget.ok) return bodyBudget.response;
  const boundedRequest = bodyBudget.request === request
    ? request
    : new NextRequest(bodyBudget.request);
  const form = await boundedRequest.formData();
  const question = readQuestion(form);
  const photos = readPhotos(form);
  if (!photos.length) {
    return NextResponse.json({
      ok: false,
      message: "분석할 현장 사진을 1장 이상 첨부해 주세요."
    }, { status: 400 });
  }
  if (photos.length > MAX_HAZARD_PHOTO_FILES) {
    return NextResponse.json({
      ok: false,
      message: `현장 사진은 최대 ${MAX_HAZARD_PHOTO_FILES}장까지 분석할 수 있습니다.`
    }, { status: 400 });
  }
  const totalPhotoBytes = photos.reduce((total, photo) => total + photo.size, 0);
  if (totalPhotoBytes > MAX_HAZARD_PHOTO_TOTAL_BYTES) {
    return NextResponse.json({
      ok: false,
      code: "photo_payload_too_large",
      message: "첨부한 사진의 합계 용량이 허용 한도를 초과합니다."
    }, { status: 413 });
  }

  let analysis: HazardPhotoVisionAnalysis;
  try {
    analysis = await analyzeHazardPhotos({ question, photos }, { signal: request.signal });
  } catch (error) {
    if (request.signal.aborted) throw error;
    const failure = projectPublicFailure({
      scope: "photo-hazard-analysis",
      code: "PHOTO_ANALYSIS_FAILED",
      message: "현장 사진 분석을 완료하지 못했습니다.",
      error,
    });
    return NextResponse.json({
      ok: false,
      configured: true,
      ...failure,
    }, { status: 502 });
  }
  const publicAnalysis = publicPhotoAnalysis(analysis);
  const hasAnalysis = analysis.status === "analyzed" || analysis.status === "partial";
  return NextResponse.json({
    ok: hasAnalysis,
    configured: analysis.providerMode !== "unconfigured",
    ...(!hasAnalysis ? { code: "PHOTO_ANALYSIS_FAILED" } : {}),
    analysis: publicAnalysis,
    message: analysis.status === "analyzed"
      ? "현장 사진에서 위험요인 후보를 도출했습니다."
      : analysis.status === "partial"
        ? `현장 사진 일부 처리: ${partialAnalysisMessage(analysis.counts)}.`
        : "현장 사진 분석을 완료하지 못했습니다."
  });
}

export async function POST(request: NextRequest) {
  return withPublicPhotoAnalysisAdmission(request, () => handlePost(request));
}
