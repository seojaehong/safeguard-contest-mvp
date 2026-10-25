/**
 * 사진 위험분석 결과를 화면에 내보내기 전 공개 형태로 줄인다.
 * 동영상 장면 경로(app/api/input-videos/hazard-analysis)가 쓴다.
 * 사진 경로(app/api/input-photos/hazard-analysis/route.ts)에 같은 함수가 들어 있으나, 그 파일은
 * 보안 게이트 관리 경로라 이번 변경에서 손대지 않았다. 내용은 그 파일과 같다(2026-10-25 복사).
 * 사진 경로를 다음에 고칠 때 이 파일을 가져다 쓰도록 합친다.
 */
import type {
  HazardPhotoAnalysisError,
  HazardPhotoVisionAnalysis,
  HazardPhotoVisionCandidate
} from "@/lib/photo-vision-analysis";

export function partialAnalysisMessage(counts: {
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

export function publicPhotoError(error: HazardPhotoAnalysisError | null): HazardPhotoAnalysisError | null {
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

export function publicCandidate(candidate: HazardPhotoVisionCandidate): HazardPhotoVisionCandidate {
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

export function publicPhotoAnalysis(analysis: HazardPhotoVisionAnalysis): HazardPhotoVisionAnalysis {
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
