import type { AskResponse } from "./types";
import type { QueryableGraph } from "./ontology/query";
import { reviewDocumentCoverage } from "./ontology/qa-review";
import { ontologyEdgeSchema, ontologyNodeSchema } from "./ontology/schema";
import { buildQualityContract } from "./quality-contract";

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
  reviewTask: string;
  dbHarness: NonNullable<AskResponse["dbHarness"]>;
};

const ONTOLOGY_QA_DOCUMENT_KEYS = [
  "riskAssessmentDraft",
  "workPlanDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft"
] as const;

const REVIEW_TASK_INFERENCE: ReadonlyArray<{ task: string; keywords: readonly string[] }> = [
  { task: "용접", keywords: ["용접", "절단", "불티", "용접흄"] },
  { task: "화기 작업", keywords: ["화기", "가연물", "화재감시"] },
  { task: "밀폐공간 작업", keywords: ["밀폐", "산소결핍", "질식"] },
  { task: "비계 조립·해체", keywords: ["비계"] },
  { task: "고소작업", keywords: ["고소", "추락", "외벽"] },
  { task: "전기 작업", keywords: ["전기", "감전", "활선"] },
  { task: "지게차 상하차", keywords: ["지게차"] },
  { task: "크레인 양중", keywords: ["크레인", "양중"] },
  { task: "하역·운반", keywords: ["하역", "운반"] },
  { task: "도장(스프레이)", keywords: ["도장", "스프레이"] }
];

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseWorkpackRevalidationGraph(value: unknown): QueryableGraph | null {
  if (!isRecord(value) || !isRecord(value.graph)) return null;
  const rawNodes = value.graph.nodes;
  const rawEdges = value.graph.edges;
  if (!Array.isArray(rawNodes) || !Array.isArray(rawEdges)) return null;

  const nodes = rawNodes.flatMap((node) => {
    const parsed = ontologyNodeSchema.safeParse(node);
    return parsed.success ? [parsed.data] : [];
  });
  const edges = rawEdges.flatMap((edge) => {
    const parsed = ontologyEdgeSchema.safeParse(edge);
    return parsed.success ? [parsed.data] : [];
  });
  if (nodes.length !== rawNodes.length || edges.length !== rawEdges.length || nodes.length === 0) return null;
  return { nodes, edges };
}

export function buildWorkpackRevalidationBasis(response: AskResponse): WorkpackRevalidationBasis | null {
  const reviewTask = response.ontologyQa?.reviewTask.trim()
    || REVIEW_TASK_INFERENCE.find((candidate) =>
      candidate.keywords.some((keyword) => response.question.includes(keyword))
    )?.task;
  if (!reviewTask || !response.dbHarness) return null;
  return {
    reviewTask,
    dbHarness: response.dbHarness
  };
}

export function revalidateEditedWorkpack(
  response: AskResponse,
  basis: WorkpackRevalidationBasis | null,
  graph: QueryableGraph,
  generatedAt = new Date().toISOString()
): AskResponse {
  if (!basis) return response;

  const sourceDocumentKeys = ONTOLOGY_QA_DOCUMENT_KEYS.filter((key) =>
    Boolean(response.deliverables[key]?.trim())
  );
  const documentText = sourceDocumentKeys
    .map((key) => `[${key}]\n${response.deliverables[key]}`)
    .join("\n\n");
  const result = reviewDocumentCoverage(basis.reviewTask, documentText, graph);
  const ontologyReady = result.reviewable && result.verdict === "통과";
  const dbHarness = {
    ...basis.dbHarness,
    packet: {
      ...basis.dbHarness.packet,
      ontologyChecklist: {
        status: ontologyReady ? "ready" as const : "review_required" as const,
        missing: result.reviewable
          ? result.missing.controls.map((control) => control.control)
          : [result.message]
      }
    },
    summary: {
      ...basis.dbHarness.summary,
      ontologyStatus: ontologyReady ? "ready" as const : "review_required" as const
    }
  };
  const reviewed: AskResponse = {
    ...response,
    dbHarness,
    ontologyQa: {
      reviewTask: basis.reviewTask,
      result,
      sourceDocumentKeys: [...sourceDocumentKeys],
      detail: result.reviewable
        ? `안전조치 검수 ${result.verdict}: 편집된 문서 본문을 다시 확인했습니다.`
        : result.message
    }
  };

  return {
    ...reviewed,
    qualityContract: buildQualityContract(reviewed, generatedAt)
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
    qualityContract: undefined,
    dbHarness: nextResponse.dbHarness
      ? {
        ...nextResponse.dbHarness,
        packet: {
          ...nextResponse.dbHarness.packet,
          ontologyChecklist: {
            status: "review_required",
            missing: ["편집된 문서 재검수 필요"]
          }
        },
        summary: {
          ...nextResponse.dbHarness.summary,
          ontologyStatus: "review_required"
        }
      }
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
