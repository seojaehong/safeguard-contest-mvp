import { assembleGraph, type OntologyGraph } from "./ontology/graph-store";
import { queryByTask } from "./ontology/query";
import { reviewDocumentCoverage, type QaReviewResult } from "./ontology/qa-review";
import type {
  AskResponse,
  QualityContract,
  QualityContractStatus
} from "./types";

const REVALIDATION_DOCUMENT_KEYS = [
  "riskAssessmentDraft",
  "workPlanDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft"
] as const;

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

export type WorkpackRevalidationBasis = {
  reviewTasks: string[];
  source: "generated-ontology-qa";
};

const APPROVAL_PLACEHOLDER_PATTERNS = [
  /\[결재\]/,
  /작성\s*_{2,}/,
  /검토\s*_{2,}/,
  /승인\s*_{2,}/,
  /_{6,}/
];

export function buildWorkpackRevalidationBasis(response: AskResponse): WorkpackRevalidationBasis | null {
  const reviewTask = response.ontologyQa?.reviewTask.trim();
  if (!reviewTask) return null;
  return {
    reviewTasks: [reviewTask],
    source: "generated-ontology-qa"
  };
}

function canonicalizeFingerprintValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeFingerprintValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((record, key) => {
    record[key] = canonicalizeFingerprintValue((value as Record<string, unknown>)[key]);
    return record;
  }, {});
}

export function buildWorkpackDeliverablesFingerprint(deliverables: AskResponse["deliverables"]): string {
  const serialized = JSON.stringify(canonicalizeFingerprintValue(deliverables));
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

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
  return !qa || !qa.reviewable || qa.verdict !== "통과";
}

function hasQualityBlocker(response: AskResponse) {
  return Boolean(response.qualityContract && response.qualityContract.overall !== "ready");
}

function hasDbHarnessBlocker(response: AskResponse) {
  if (!response.dbHarness) return true;
  return response.dbHarness.summary.missingEvidence.length > 0 || response.dbHarness.summary.ontologyStatus !== "ready";
}

function buildRevalidationSource(response: AskResponse): { text: string; documentKeys: string[] } {
  const chunks = REVALIDATION_DOCUMENT_KEYS.flatMap((key) => {
    const body = response.deliverables[key];
    return body?.trim() ? [{ key, text: `[${key}]\n${body}` }] : [];
  });
  return {
    text: chunks.map((chunk) => chunk.text).join("\n\n"),
    documentKeys: chunks.map((chunk) => chunk.key)
  };
}

function attachRevalidatedQa(
  response: AskResponse,
  reviewTask: string,
  result: QaReviewResult,
  sourceDocumentKeys: string[]
): AskResponse {
  return {
    ...response,
    ontologyQa: {
      reviewTask,
      result,
      sourceDocumentKeys,
      detail: result.reviewable
        ? `편집된 문서 안전조치 검수 ${result.verdict}`
        : result.message
    }
  };
}

function invalidateQualityContract(contract: QualityContract): QualityContract {
  return {
    ...contract,
    overall: "blocked",
    summary: "편집된 문서의 안전조치를 다시 검수해야 합니다.",
    items: contract.items.map((item) => item.key === "ontology"
      ? {
          ...item,
          status: "pending",
          detail: "편집된 문서 본문으로 재검수해야 합니다."
        }
      : item),
    ontology: {
      ...contract.ontology,
      status: "pending",
      verdict: undefined,
      missingControlCount: undefined,
      detail: "편집된 문서 본문으로 재검수해야 합니다."
    }
  };
}

function qaContractStatus(result: QaReviewResult): Exclude<QualityContractStatus, "pending"> {
  if (!result.reviewable) return "blocked";
  if (result.verdict === "통과") return "ready";
  return result.verdict === "보완 권장" ? "degraded" : "blocked";
}

function refreshedOverall(
  contract: QualityContract,
  ontologyStatus: Exclude<QualityContractStatus, "pending">
): QualityContract["overall"] {
  const statuses: QualityContractStatus[] = [
    ontologyStatus,
    contract.evidence.status,
    contract.structured.status,
    contract.persistence.status,
    contract.dbHarness.status,
    ...contract.items.filter((item) => item.key !== "ontology").map((item) => item.status)
  ];
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.some((status) => status === "degraded" || status === "pending")) return "degraded";
  return contract.fallback.hasFallback ? "degraded" : "ready";
}

function refreshQualityContract(
  contract: QualityContract,
  reviewTask: string,
  result: QaReviewResult,
  generatedAt: string
): QualityContract {
  const ontologyStatus = qaContractStatus(result);
  const overall = refreshedOverall(contract, ontologyStatus);
  const detail = result.reviewable
    ? result.verdict === "통과"
      ? `${reviewTask} 작업의 편집된 문서가 안전조치 검수를 통과했습니다.`
      : `${reviewTask} 작업의 편집된 문서에 안전조치 ${result.missing.controls.length}건을 보완해야 합니다.`
    : result.message;

  return {
    ...contract,
    overall,
    summary: overall === "ready"
      ? "편집된 문서의 안전조치 재검수가 완료됐습니다."
      : "편집된 문서의 재검수에서 보완 항목을 확인했습니다.",
    generatedAt,
    items: contract.items.map((item) => item.key === "ontology"
      ? { ...item, status: ontologyStatus, detail }
      : item),
    ontology: {
      ...contract.ontology,
      status: ontologyStatus,
      reviewTask,
      verdict: result.reviewable ? result.verdict : undefined,
      missingControlCount: result.reviewable ? result.missing.controls.length : undefined,
      detail
    }
  };
}

export function parsePublishedOntologyGraph(payload: unknown): OntologyGraph | null {
  if (typeof payload !== "object" || payload === null || !("ok" in payload) || !("graph" in payload)) {
    return null;
  }
  const candidate = payload as { ok?: unknown; scope?: unknown; graph?: unknown };
  if (
    candidate.ok !== true
    || candidate.scope !== "published"
    || typeof candidate.graph !== "object"
    || candidate.graph === null
  ) return null;
  const graph = candidate.graph as { nodes?: unknown; edges?: unknown };
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return null;
  const assembled = assembleGraph(graph.nodes, graph.edges);
  if (
    assembled.nodes.length === 0
    || assembled.edges.length === 0
    || assembled.nodes.length !== graph.nodes.length
    || assembled.edges.length !== graph.edges.length
    || assembled.nodes.some((node) => node.review_state !== "published")
    || assembled.edges.some((edge) => edge.review_state !== "published")
  ) return null;
  return assembled;
}

export function revalidateEditedWorkpack(
  response: AskResponse,
  basis: WorkpackRevalidationBasis | null,
  graph: OntologyGraph,
  generatedAt = new Date().toISOString()
): AskResponse {
  const reviewTask = basis?.reviewTasks.length === 1 ? basis.reviewTasks[0] : "";
  const source = buildRevalidationSource(response);
  const taskEvidence = reviewTask ? queryByTask(graph, reviewTask) : null;
  const result: QaReviewResult = !reviewTask
    ? {
        reviewable: false,
        errorCode: "ontology_qa_failed",
        message: "편집 전 authoritative 검수 작업을 하나로 확인할 수 없습니다.",
        registeredTasks: []
      }
    : !taskEvidence || taskEvidence.hazards.length === 0 || taskEvidence.controls.length === 0
      ? {
          reviewable: false,
          errorCode: "ontology_qa_failed",
          message: `published 온톨로지에서 '${reviewTask}'의 필수 위험요인-안전조치 근거 경로를 확인할 수 없습니다.`,
          registeredTasks: []
        }
      : reviewDocumentCoverage(reviewTask, source.text, graph);
  const reviewed = attachRevalidatedQa(response, reviewTask, result, source.documentKeys);
  return {
    ...reviewed,
    qualityContract: response.qualityContract
      ? refreshQualityContract(response.qualityContract, reviewTask, result, generatedAt)
      : undefined
  };
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
    ontologyQa: undefined,
    qualityContract: nextResponse.qualityContract
      ? invalidateQualityContract(nextResponse.qualityContract)
      : undefined
  };
}

export function assessWorkpackReadiness(
  response: AskResponse,
  options: WorkpackReadinessOptions = {}
): WorkpackReadiness {
  const reasons = [
    ...(options.requiresRevalidation ? ["편집된 문서 재검수 필요"] : []),
    ...(!response.ontologyQa
      ? ["안전조치 검수 정보 확인 필요"]
      : hasOntologyReviewBlocker(response) ? ["안전조치 검수 미통과"] : []),
    ...(!response.qualityContract
      ? ["품질 검수 확인 필요"]
      : hasQualityBlocker(response) ? ["품질 검수 보완 필요"] : []),
    ...(hasDbHarnessBlocker(response) ? ["검증 근거 보강 필요"] : []),
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
