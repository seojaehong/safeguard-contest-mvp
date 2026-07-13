import type { AskResponse } from "./types";
import { assessPhaseAReviewAuthority } from "./phase-a-review";

export type WorkpackReadinessStatus = "ready" | "blocked";

export type WorkpackReadiness = {
  canShare: boolean;
  status: WorkpackReadinessStatus;
  summary: string;
  reasons: string[];
};

export type WorkpackReadinessOptions = {
  requiresRevalidation?: boolean;
};

const APPROVAL_PLACEHOLDER_PATTERNS = [
  /\[결재\]/,
  /작성\s*_{2,}/,
  /검토\s*_{2,}/,
  /승인\s*_{2,}/,
  /_{6,}/
];

function textDeliverables(response: AskResponse) {
  return Object.values(response.deliverables)
    .filter((value): value is string => typeof value === "string")
    .join("\n");
}

function hasApprovalPlaceholders(response: AskResponse) {
  const text = textDeliverables(response);
  return APPROVAL_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text));
}

function hasOntologyReviewBlocker(response: AskResponse) {
  const qa = response.ontologyQa?.result;
  return Boolean(qa?.reviewable && qa.verdict !== "통과");
}

function hasQualityBlocker(response: AskResponse) {
  return Boolean(response.qualityContract && response.qualityContract.overall !== "ready");
}

function hasDbHarnessBlocker(response: AskResponse) {
  if (!response.dbHarness) return true;
  return response.dbHarness.summary.missingEvidence.length > 0 || response.dbHarness.summary.ontologyStatus !== "ready";
}

export function applyWorkpackDeliverablesChange(
  response: AskResponse,
  deliverables: Partial<AskResponse["deliverables"]>,
  options: WorkpackReadinessOptions = {}
): AskResponse {
  const nextResponse: AskResponse = {
    ...response,
    deliverables: {
      ...response.deliverables,
      ...deliverables
    }
  };
  if (!options.requiresRevalidation) return nextResponse;

  return {
    ...nextResponse,
    phaseAReview: undefined,
    ontologyQa: undefined,
    qualityContract: undefined,
    dbHarness: undefined
  };
}

export function assessWorkpackReadiness(
  response: AskResponse,
  options: WorkpackReadinessOptions = {}
): WorkpackReadiness {
  const phaseA = assessPhaseAReviewAuthority(response.phaseAReview);
  const reasons = [
    ...(options.requiresRevalidation ? ["편집된 문서 재검수 필요"] : []),
    ...(!phaseA.authoritative ? [phaseA.reason] : []),
    ...(!response.ontologyQa
      ? ["안전조치 검수 정보 확인 필요"]
      : hasOntologyReviewBlocker(response) ? ["안전조치 검수 미통과"] : []),
    ...(!response.qualityContract
      ? ["품질 계약 확인 필요"]
      : hasQualityBlocker(response) ? ["품질 계약 보완 필요"] : []),
    ...(hasDbHarnessBlocker(response) ? ["DB 하네스 근거 보강 필요"] : []),
    ...(hasApprovalPlaceholders(response) ? ["결재·서명 placeholder 확인 필요"] : [])
  ];

  if (reasons.length) {
    return {
      canShare: false,
      status: "blocked",
      summary: options.requiresRevalidation ? "편집 후 재검수 필요" : "공유 전 보완 필요",
      reasons
    };
  }

  return {
    canShare: true,
    status: "ready",
    summary: "공유 준비됨",
    reasons: []
  };
}
