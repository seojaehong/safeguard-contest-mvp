import {
  EVIDENCE_CHAIN_REGISTRY,
  PHASE_A_AUTHORITY_PLAN_DIGESTS,
} from "@/lib/ontology/evidence-chain-registry";
import type {
  EvidenceMaterializationCoverage,
  PhaseAPlanBinding,
} from "@/lib/ontology/evidence-chain";
import type { PhaseAReviewerPrincipal, PhaseAReview } from "@/lib/types";

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
const SESSION_FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CONFIRMATION_FUTURE_SKEW_MS = 5 * 60_000;
const PENDING_AUTHORITY_MARKER = [
  "법령 근거: 검토 필요",
  "공식자료 연결 후보",
].join("\n");
const LABELED_AUTHORITY_STATUS_PATTERN = /((?:법령\s*(?:근거|의무)?|KOSHA\s*(?:자료|근거|지침)|공식자료)\s*[:：]\s*)(?:연결됨|확인\s*완료|검증됨|확정됨|\b(?:official|connected|mandated|verified)\b)/giu;
const ACTION_AUTHORITY_STATUS_PATTERN = /(?:조치가\s*(?:연결됨|검증됨|확정됨|\b(?:official|connected|mandated|verified)\b)|조치\s*상태\s*[:：]\s*(?:연결됨|검증됨|확정됨|\b(?:official|connected|mandated|verified)\b))/giu;
const GENERIC_AUTHORITY_STATUS_PATTERN = /((?:authority|evidence|source|citation|provenance|materialization|grounding|review)(?:\s+(?:status|state|상태))?\s*[:：]\s*)(?:official|connected|mandated|verified)\b/giu;
const KOSHA_AUTHORITY_ASSERTION_PATTERN = /KOSHA(?:\s*·\s*[\p{L}\p{N}_-]+)?\s*(?:공식\s*자료|자료)\s*(?:URL\s*)?(?:\d+\s*건\s*)?(?:확인(?:\s*완료|됨)?|검증됨|연결됨)/giu;
const STANDALONE_AUTHORITY_STATUS_PATTERN = /^(\s*(?:[-*]\s*)?)(?:official|connected|mandated|verified)(\s*[.!]?\s*)$/iu;

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

function parseReviewerPrincipal(value: unknown): PhaseAReviewerPrincipal | null {
  if (
    !isRecord(value) ||
    value.principalType !== "authenticated_workspace_user" ||
    typeof value.userId !== "string" ||
    value.userId.trim().length === 0 ||
    typeof value.sessionFingerprint !== "string" ||
    !SESSION_FINGERPRINT_PATTERN.test(value.sessionFingerprint)
  ) {
    return null;
  }
  return {
    principalType: "authenticated_workspace_user",
    userId: value.userId.trim(),
    sessionFingerprint: value.sessionFingerprint,
  };
}

function confirmationTimeIsAllowed(confirmedAt: string, nowMs: number): boolean {
  if (!isStrictIsoTimestamp(confirmedAt)) return false;
  return Date.parse(confirmedAt) <= nowMs + MAX_CONFIRMATION_FUTURE_SKEW_MS;
}

function parseHumanConfirmation(
  value: unknown,
  nowMs: number,
): PhaseAReview["humanConfirmation"] | null {
  if (!isRecord(value) || value.required !== true) return null;
  if (value.status === "pending") return { required: true, status: "pending" };
  if (value.status !== "confirmed") return null;
  const chainId = parseChainId(value.chainId);
  const planDigest = parseDigest(value.planDigest);
  const reviewer = parseReviewerPrincipal(value.reviewer);
  if (
    typeof value.confirmationId !== "string" ||
    !UUID_PATTERN.test(value.confirmationId) ||
    typeof value.confirmedAt !== "string" ||
    !confirmationTimeIsAllowed(value.confirmedAt, nowMs) ||
    value.issuedBy !== "safeclaw_server" ||
    typeof value.workpackId !== "string" ||
    !UUID_PATTERN.test(value.workpackId) ||
    !reviewer ||
    !chainId ||
    !planDigest
  ) {
    return null;
  }
  return {
    required: true,
    status: "confirmed",
    confirmationId: value.confirmationId,
    confirmedAt: value.confirmedAt,
    issuedBy: "safeclaw_server",
    workpackId: value.workpackId,
    reviewer,
    chainId,
    planDigest,
  };
}

export function parsePhaseAReview(
  value: unknown,
  options: { nowMs?: number } = {},
): PhaseAReview | null {
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
  const humanConfirmation = parseHumanConfirmation(
    value.humanConfirmation,
    options.nowMs ?? Date.now(),
  );
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
    UUID_PATTERN.test(confirmation.confirmationId) &&
    confirmation.issuedBy === "safeclaw_server" &&
    UUID_PATTERN.test(confirmation.workpackId) &&
    confirmation.reviewer.principalType === "authenticated_workspace_user" &&
    confirmation.reviewer.userId.trim().length > 0 &&
    SESSION_FINGERPRINT_PATTERN.test(confirmation.reviewer.sessionFingerprint) &&
    confirmationTimeIsAllowed(confirmation.confirmedAt, Date.now()) &&
    confirmation.chainId === binding.chainId &&
    confirmation.planDigest === binding.planDigest,
  );
}

export function isPhaseAReviewReadyForConfirmation(review: PhaseAReview): boolean {
  return review.humanConfirmation.status === "pending" &&
    review.evidenceChainState === "resolved" &&
    review.groundingStatus === "resolved" &&
    review.outputStatus === "grounded_draft" &&
    hasExactMaterializationCoverage(review);
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

export function normalizePendingPhaseAAuthorityText(value: string): string {
  return value
    .split(/(\r?\n)/u)
    .map((line) => {
      if (/^\r?\n$/u.test(line)) return line;
      return line
        .replace(/공식자료\s*기반/gu, "공식자료 연결 후보")
        .replace(KOSHA_AUTHORITY_ASSERTION_PATTERN, "KOSHA 자료: 검토 필요")
        .replace(LABELED_AUTHORITY_STATUS_PATTERN, "$1검토 필요")
        .replace(GENERIC_AUTHORITY_STATUS_PATTERN, "$1검토 필요")
        .replace(/(?:법령상|법적)\s*의무로\s*확정(?:됨)?/gu, "법령 의무: 검토 필요")
        .replace(ACTION_AUTHORITY_STATUS_PATTERN, "조치 검토 필요")
        .replace(/공식자료\s*(?:확인\s*완료|검증됨|확정됨)/gu, "공식자료 검토 필요")
        .replace(STANDALONE_AUTHORITY_STATUS_PATTERN, "$1검토 필요$2");
    })
    .join("");
}

function normalizePendingAuthorityValue(value: unknown): unknown {
  if (typeof value === "string") return normalizePendingPhaseAAuthorityText(value);
  if (Array.isArray(value)) return value.map(normalizePendingAuthorityValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalizePendingAuthorityValue(item)]),
  );
}

export function normalizePhaseAAuthorityValue<T>(
  value: T,
  review: PhaseAReview | undefined,
): T {
  return assessPhaseAReviewAuthority(review).authoritative
    ? value
    : normalizePendingAuthorityValue(value) as T;
}

export function applyPhaseADocumentAuthorityMarker(
  body: string,
  review: PhaseAReview | undefined,
): string {
  const authoritative = assessPhaseAReviewAuthority(review).authoritative;
  const marker = buildPhaseADocumentAuthorityMarker(review);
  const normalizedBody = authoritative ? body : normalizePendingPhaseAAuthorityText(body);
  const withoutExistingMarker = normalizedBody
    .replace(/^[ \t]*(?:[-*]\s*)?법령 근거:\s*(?:연결됨|검토 필요)[^\r\n]*\r?\n?/gm, "")
    .replace(/^[ \t]*(?:[-*]\s*)?공식자료\s*(?:확인 완료|연결 후보)[ \t]*(?=\r?$)\r?\n?/gm, "")
    .trim();
  return `${marker}\n\n${withoutExistingMarker}`.trim();
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
