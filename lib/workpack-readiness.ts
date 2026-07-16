import { assembleGraph, type OntologyGraph } from "./ontology/graph-store";
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

const REVALIDATION_TASK_RULES = [
  { label: "용접", keywords: ["용접", "절단", "불티", "용접흄"] },
  { label: "화기 작업", keywords: ["화기", "가연물", "화재감시"] },
  { label: "밀폐공간 작업", keywords: ["밀폐", "산소결핍", "질식"] },
  { label: "비계 조립·해체", keywords: ["비계"] },
  { label: "고소작업", keywords: ["고소", "추락", "외벽"] },
  { label: "전기 작업", keywords: ["전기", "감전", "활선"] },
  { label: "지게차 상하차", keywords: ["지게차"] },
  { label: "크레인 양중", keywords: ["크레인", "양중"] },
  { label: "하역·운반", keywords: ["하역", "운반"] },
  { label: "도장(스프레이)", keywords: ["도장", "스프레이"] }
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
  return !qa || !qa.reviewable || qa.verdict !== "통과";
}

function hasQualityBlocker(response: AskResponse) {
  return Boolean(response.qualityContract && response.qualityContract.overall !== "ready");
}

function hasDbHarnessBlocker(response: AskResponse) {
  if (!response.dbHarness) return true;
  return response.dbHarness.summary.missingEvidence.length > 0 || response.dbHarness.summary.ontologyStatus !== "ready";
}

function resolveRevalidationTask(response: AskResponse): string {
  const haystack = `${response.scenario.workSummary} ${response.question}`.normalize("NFC").toLowerCase();
  return REVALIDATION_TASK_RULES.find((rule) =>
    rule.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
  )?.label ?? response.scenario.workSummary.trim();
}

function buildRevalidationSource(response: AskResponse): { text: string; documentKeys: string[] } {
  const chunks = REVALIDATION_DOCUMENT_KEYS.flatMap((key) => {
    const body = response.deliverables[key];
    return body ? [`[${key}]\n${body}`] : [];
  });
  return {
    text: chunks.join("\n\n"),
    documentKeys: chunks.length ? [...REVALIDATION_DOCUMENT_KEYS] : []
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
  const candidate = payload as { ok?: unknown; graph?: unknown };
  if (candidate.ok !== true || typeof candidate.graph !== "object" || candidate.graph === null) return null;
  const graph = candidate.graph as { nodes?: unknown; edges?: unknown };
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return null;
  return assembleGraph(graph.nodes, graph.edges);
}

export function revalidateEditedWorkpack(
  response: AskResponse,
  graph: OntologyGraph,
  generatedAt = new Date().toISOString()
): AskResponse {
  const reviewTask = resolveRevalidationTask(response);
  const source = buildRevalidationSource(response);
  const result = reviewDocumentCoverage(reviewTask, source.text, graph);
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
