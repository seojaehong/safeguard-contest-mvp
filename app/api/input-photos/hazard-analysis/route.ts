import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api-guard";
import { analyzeHazardPhotos, MAX_HAZARD_PHOTO_FILES } from "@/lib/photo-vision-analysis";
import { createRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const limiter = createRateLimiter({ limit: 8, windowMs: 60_000 });

function isFileValue(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File && value.size > 0;
}

function readQuestion(form: FormData) {
  const value = form.get("question");
  return typeof value === "string" ? value.trim().slice(0, 1200) : "";
}

function readPhotos(form: FormData) {
  return form.getAll("photos").filter(isFileValue);
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, limiter);
  if (limited) return limited;

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({
      ok: false,
      message: "현장 사진 분석은 multipart/form-data 요청만 지원합니다."
    }, { status: 400 });
  }

  const form = await request.formData();
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

  const analysis = await analyzeHazardPhotos({ question, photos });
  return NextResponse.json({
    ok: analysis.status === "analyzed",
    configured: analysis.status !== "unconfigured",
    analysis,
    message: analysis.status === "analyzed"
      ? "현장 사진에서 위험요인 후보를 도출했습니다."
      : analysis.errorMessage || "현장 사진 분석을 완료하지 못했습니다."
  });
}
