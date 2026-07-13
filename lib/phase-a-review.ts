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
  connectionLabel: "근거 연결됨" | "근거 검토 필요";
  directEvidenceLabel: "직접 근거" | "연결 후보";
  supportingEvidenceLabel: "보조 근거" | "보조 후보";
  lawCitationLabel: "법제처 인용" | "법제처 확인 후보";
  evidenceHeading: "직접 근거와 보조 근거" | "근거 연결 후보";
  reflectionLabel: "반영 라벨" | "검토 위치 후보";
};

function hasExactMaterializationCoverage(review: PhaseAReview): boolean {
  const coverage = review.materializationCoverage;
  if (!coverage) return false;
  const expectedSet = new Set(coverage.expectedStableKeys);
  const materializedSet = new Set(coverage.materializedStableKeys);
  const unresolvedSet = new Set(coverage.unresolvedStableKeys);
  if (
    expectedSet.size === 0 ||
    expectedSet.size !== coverage.expectedStableKeys.length ||
    materializedSet.size !== coverage.materializedStableKeys.length ||
    unresolvedSet.size !== coverage.unresolvedStableKeys.length ||
    coverage.expectedRecordCount !== expectedSet.size ||
    coverage.materializedRecordCount !== materializedSet.size ||
    review.verifiedRecords !== materializedSet.size
  ) {
    return false;
  }
  if ([...materializedSet].some((stableKey) => !expectedSet.has(stableKey))) return false;
  const expectedUnresolved = [...expectedSet].filter((stableKey) => !materializedSet.has(stableKey));
  if (
    expectedUnresolved.length !== unresolvedSet.size ||
    expectedUnresolved.some((stableKey) => !unresolvedSet.has(stableKey))
  ) {
    return false;
  }
  return coverage.status === "complete" && expectedUnresolved.length === 0;
}

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
    hasExactMaterializationCoverage(review) &&
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

  const coverage = review.materializationCoverage;
  if (!hasExactMaterializationCoverage(review)) {
    if (coverage) {
      return {
        authoritative: false,
        reason: `Phase A 문서 반영 ${coverage.materializedRecordCount}/${coverage.expectedRecordCount}, 미해결 stableKey ${coverage.unresolvedStableKeys.length}건`,
      };
    }
    return {
      authoritative: false,
      reason: "Phase A 문서 반영 계약 확인 필요",
    };
  }

  if (review.humanConfirmation.status !== "confirmed" || !review.verified) {
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
  const authoritative = authority.authoritative;
  return {
    authoritative,
    status: authoritative ? "확인 완료" : "검토 필요",
    detail: authority.reason,
    tone: authoritative ? "ready" : "warn",
    connectionLabel: authoritative ? "근거 연결됨" : "근거 검토 필요",
    directEvidenceLabel: authoritative ? "직접 근거" : "연결 후보",
    supportingEvidenceLabel: authoritative ? "보조 근거" : "보조 후보",
    lawCitationLabel: authoritative ? "법제처 인용" : "법제처 확인 후보",
    evidenceHeading: authoritative ? "직접 근거와 보조 근거" : "근거 연결 후보",
    reflectionLabel: authoritative ? "반영 라벨" : "검토 위치 후보",
  };
}
