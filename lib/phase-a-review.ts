import {
  EVIDENCE_CHAIN_REGISTRY,
  PHASE_A_AUTHORITY_PLAN_DIGESTS,
} from "@/lib/ontology/evidence-chain-registry";
import type {
  EvidenceMaterializationCoverage,
  PhaseAPlanBinding,
} from "@/lib/ontology/evidence-chain";
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

const PLAN_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const PENDING_AUTHORITY_MARKER = [
  "법령 근거: 검토 필요",
  "공식자료 연결 후보",
].join("\n");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseChainId(value: unknown): PhaseAPlanBinding["chainId"] | null {
  if (typeof value !== "string") return null;
  return EVIDENCE_CHAIN_REGISTRY.find((definition) => definition.chainId === value)?.chainId ?? null;
}

function parseDigest(value: unknown): string | null {
  return typeof value === "string" && PLAN_DIGEST_PATTERN.test(value) ? value : null;
}

function parseNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const values: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) return null;
    values.push(item);
  }
  return values;
}

function isStrictIsoTimestamp(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function parsePlanBinding(value: unknown): PhaseAPlanBinding | null {
  if (!isRecord(value)) return null;
  const chainId = parseChainId(value.chainId);
  const planDigest = parseDigest(value.planDigest);
  const expectedRecordCount = parseNonNegativeInteger(value.expectedRecordCount);
  const expectedStableKeys = parseStringArray(value.expectedStableKeys);
  if (!chainId || !planDigest || expectedRecordCount === null || !expectedStableKeys) return null;
  return { chainId, planDigest, expectedRecordCount, expectedStableKeys };
}

function parseCoverage(value: unknown): EvidenceMaterializationCoverage | null {
  if (!isRecord(value)) return null;
  const status = value.status;
  if (status !== "complete" && status !== "partial" && status !== "missing") return null;
  const chainId = value.chainId === null ? null : parseChainId(value.chainId);
  const planDigest = value.planDigest === null ? null : parseDigest(value.planDigest);
  const expectedRecordCount = parseNonNegativeInteger(value.expectedRecordCount);
  const materializedRecordCount = parseNonNegativeInteger(value.materializedRecordCount);
  const expectedStableKeys = parseStringArray(value.expectedStableKeys);
  const materializedStableKeys = parseStringArray(value.materializedStableKeys);
  const unresolvedStableKeys = parseStringArray(value.unresolvedStableKeys);
  if (
    (value.chainId !== null && !chainId) ||
    (value.planDigest !== null && !planDigest) ||
    expectedRecordCount === null ||
    materializedRecordCount === null ||
    !expectedStableKeys ||
    !materializedStableKeys ||
    !unresolvedStableKeys
  ) {
    return null;
  }
  return {
    status,
    chainId,
    planDigest,
    expectedRecordCount,
    materializedRecordCount,
    expectedStableKeys,
    materializedStableKeys,
    unresolvedStableKeys,
  };
}

function parseHumanConfirmation(value: unknown): PhaseAReview["humanConfirmation"] | null {
  if (!isRecord(value) || value.required !== true) return null;
  if (value.status === "pending") return { required: true, status: "pending" };
  if (value.status !== "confirmed") return null;
  const chainId = parseChainId(value.chainId);
  const planDigest = parseDigest(value.planDigest);
  if (
    typeof value.reviewerId !== "string" ||
    value.reviewerId.trim().length === 0 ||
    typeof value.confirmedAt !== "string" ||
    !isStrictIsoTimestamp(value.confirmedAt) ||
    !chainId ||
    !planDigest
  ) {
    return null;
  }
  return {
    required: true,
    status: "confirmed",
    reviewerId: value.reviewerId.trim(),
    confirmedAt: value.confirmedAt,
    chainId,
    planDigest,
  };
}

export function parsePhaseAReview(value: unknown): PhaseAReview | null {
  if (!isRecord(value)) return null;
  const verdict = value.verdict;
  const evidenceChainState = value.evidenceChainState;
  const groundingStatus = value.groundingStatus;
  const outputStatus = value.outputStatus;
  if (
    (verdict !== "통과" && verdict !== "검토 필요") ||
    typeof value.verified !== "boolean" ||
    !["resolved", "review_required", "unverified", "not_registered", "not_evaluated"].includes(
      typeof evidenceChainState === "string" ? evidenceChainState : "",
    ) ||
    (groundingStatus !== "resolved" && groundingStatus !== "review_required" && groundingStatus !== "missing") ||
    (outputStatus !== "grounded_draft" &&
      outputStatus !== "review_required_draft" &&
      outputStatus !== "missing_evidence_draft") ||
    typeof value.actionableReason !== "string"
  ) {
    return null;
  }
  const verifiedRecords = parseNonNegativeInteger(value.verifiedRecords);
  const planBinding = value.planBinding === null ? null : parsePlanBinding(value.planBinding);
  const materializationCoverage = parseCoverage(value.materializationCoverage);
  const humanConfirmation = parseHumanConfirmation(value.humanConfirmation);
  if (
    verifiedRecords === null ||
    (value.planBinding !== null && !planBinding) ||
    !materializationCoverage ||
    !humanConfirmation
  ) {
    return null;
  }
  if (
    evidenceChainState !== "resolved" &&
    evidenceChainState !== "review_required" &&
    evidenceChainState !== "unverified" &&
    evidenceChainState !== "not_registered" &&
    evidenceChainState !== "not_evaluated"
  ) {
    return null;
  }
  return {
    verdict,
    verified: value.verified,
    evidenceChainState,
    groundingStatus,
    outputStatus,
    verifiedRecords,
    planBinding,
    materializationCoverage,
    humanConfirmation,
    actionableReason: value.actionableReason,
  };
}

function hasExactMaterializationCoverage(review: PhaseAReview): boolean {
  const binding = review.planBinding;
  const coverage = review.materializationCoverage;
  if (!binding || !PLAN_DIGEST_PATTERN.test(binding.planDigest)) return false;
  const plannedSet = new Set(binding.expectedStableKeys);
  const definition = EVIDENCE_CHAIN_REGISTRY.find(
    (candidate) => candidate.chainId === binding.chainId,
  );
  const canonicalStableKeys = definition?.controls.flatMap((control) => [
    `${binding.chainId}:risk-assessment:${control.controlId}`,
    `${binding.chainId}:tbm:${control.controlId}`,
  ]) ?? [];
  const expectedSet = new Set(coverage.expectedStableKeys);
  const materializedSet = new Set(coverage.materializedStableKeys);
  const unresolvedSet = new Set(coverage.unresolvedStableKeys);
  if (
    plannedSet.size === 0 ||
    binding.planDigest !== PHASE_A_AUTHORITY_PLAN_DIGESTS[binding.chainId] ||
    binding.expectedRecordCount !== canonicalStableKeys.length ||
    binding.expectedStableKeys.length !== canonicalStableKeys.length ||
    binding.expectedStableKeys.some(
      (stableKey, index) => stableKey !== canonicalStableKeys[index],
    ) ||
    plannedSet.size !== binding.expectedStableKeys.length ||
    binding.expectedRecordCount !== plannedSet.size ||
    coverage.chainId !== binding.chainId ||
    coverage.planDigest !== binding.planDigest ||
    coverage.expectedStableKeys.length !== binding.expectedStableKeys.length ||
    coverage.expectedStableKeys.some((stableKey, index) => stableKey !== binding.expectedStableKeys[index]) ||
    expectedSet.size !== coverage.expectedStableKeys.length ||
    materializedSet.size !== coverage.materializedStableKeys.length ||
    unresolvedSet.size !== coverage.unresolvedStableKeys.length ||
    coverage.expectedRecordCount !== binding.expectedRecordCount ||
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

function hasBoundHumanConfirmation(review: PhaseAReview): boolean {
  const confirmation = review.humanConfirmation;
  const binding = review.planBinding;
  return Boolean(
    binding &&
    confirmation.status === "confirmed" &&
    confirmation.reviewerId.trim().length > 0 &&
    isStrictIsoTimestamp(confirmation.confirmedAt) &&
    confirmation.chainId === binding.chainId &&
    confirmation.planDigest === binding.planDigest,
  );
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
    hasBoundHumanConfirmation(review);

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
    return {
      authoritative: false,
      reason: `Phase A 문서 반영 ${coverage.materializedRecordCount}/${coverage.expectedRecordCount}, 미해결 stableKey ${coverage.unresolvedStableKeys.length}건`,
    };
  }

  if (!hasBoundHumanConfirmation(review) || !review.verified) {
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

export function buildPhaseADocumentAuthorityMarker(review: PhaseAReview | undefined): string {
  return assessPhaseAReviewAuthority(review).authoritative
    ? ["법령 근거: 연결됨", "공식자료 확인 완료"].join("\n")
    : PENDING_AUTHORITY_MARKER;
}

export function applyPhaseADocumentAuthorityMarker(
  body: string,
  review: PhaseAReview | undefined,
): string {
  const authoritative = assessPhaseAReviewAuthority(review).authoritative;
  const marker = buildPhaseADocumentAuthorityMarker(review);
  const withoutExistingMarker = body
    .replace(/^[ \t]*(?:[-*]\s*)?법령 근거:\s*(?:연결됨|검토 필요)[^\r\n]*\r?\n?/gm, "")
    .replace(/^[ \t]*(?:[-*]\s*)?공식자료\s*(?:확인 완료|연결 후보)[^\r\n]*\r?\n?/gm, "")
    .trim();
  const authoritySafeBody = authoritative
    ? withoutExistingMarker
    : withoutExistingMarker.replace(/공식자료 기반/g, "공식자료 연결 후보");
  return `${marker}\n\n${authoritySafeBody}`.trim();
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
