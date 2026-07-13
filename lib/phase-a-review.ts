import type { PhaseAReview } from "@/lib/types";

export type PhaseAReviewAuthority = {
  authoritative: boolean;
  reason: string;
};

export type PhaseAReviewUiState = {
  authoritative: boolean;
  status: "확인 완료" | "검토 필요";
  detail: string;
  tone: "ready" | "warn";
};

export function assessPhaseAReviewAuthority(
  review: PhaseAReview | undefined,
): PhaseAReviewAuthority {
  if (!review) {
    return {
      authoritative: false,
      reason: "Phase A 근거 검토 정보 확인 필요",
    };
  }

  const authoritative =
    review.verdict === "통과" &&
    review.verified &&
    review.evidenceChainState === "resolved" &&
    review.groundingStatus === "resolved" &&
    review.outputStatus === "grounded_draft" &&
    review.verifiedRecords > 0 &&
    review.humanConfirmation.status === "confirmed";

  if (authoritative) {
    return {
      authoritative: true,
      reason: "Phase A 근거와 문서 반영 실적을 사람이 확인했습니다.",
    };
  }

  if (review.groundingStatus !== "resolved" || review.evidenceChainState !== "resolved") {
    return {
      authoritative: false,
      reason: "Phase A 근거 및 사람 확인 미완료",
    };
  }

  if (review.verifiedRecords === 0 || review.humanConfirmation.status !== "confirmed" || !review.verified) {
    return {
      authoritative: false,
      reason: "Phase A 근거 및 사람 확인 미완료",
    };
  }

  return {
    authoritative: false,
    reason: review.actionableReason || "Phase A 근거 검토 필요",
  };
}

export function buildPhaseAReviewUiState(
  review: PhaseAReview | undefined,
): PhaseAReviewUiState {
  const authority = assessPhaseAReviewAuthority(review);
  return {
    authoritative: authority.authoritative,
    status: authority.authoritative ? "확인 완료" : "검토 필요",
    detail: authority.reason,
    tone: authority.authoritative ? "ready" : "warn",
  };
}
