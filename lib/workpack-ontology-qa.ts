import type { AskResponse } from "./types";
import type { QaReviewResult } from "./ontology/qa-review";
import { resolveReviewTaskLabel } from "./mcp-tools";
import { reviewDocpack } from "./ontology/qa-review-tool";
import { createLogger } from "@/lib/logger";

const log = createLogger("workpack-ontology-qa");

export const ONTOLOGY_QA_DOCUMENT_KEYS = [
  "riskAssessmentDraft",
  "workPlanDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft"
] as const;

const USER_DOCUMENT_LABELS: Record<(typeof ONTOLOGY_QA_DOCUMENT_KEYS)[number], string> = {
  riskAssessmentDraft: "위험성평가표",
  workPlanDraft: "작업계획서",
  tbmBriefing: "TBM 브리핑",
  tbmLogDraft: "TBM 기록",
  safetyEducationRecordDraft: "안전보건교육 기록",
  emergencyResponseDraft: "비상대응 절차"
};

export type OntologyQaSource = {
  text: string;
  documentKeys: string[];
};

export function buildOntologyQaSource(response: AskResponse): OntologyQaSource {
  const chunks = ONTOLOGY_QA_DOCUMENT_KEYS.flatMap((key) => {
    const body = response.deliverables[key];
    if (!body) return [];
    return [`[${key}]\n${body}`];
  });

  return {
    text: chunks.join("\n\n"),
    documentKeys: chunks.length ? [...ONTOLOGY_QA_DOCUMENT_KEYS] : []
  };
}

export function attachOntologyQaResult(
  response: AskResponse,
  reviewTask: string,
  result: QaReviewResult,
  sourceDocumentKeys: string[]
): AskResponse {
  const sourceDocumentLabels = sourceDocumentKeys
    .map((key) => USER_DOCUMENT_LABELS[key as keyof typeof USER_DOCUMENT_LABELS])
    .filter(Boolean);
  return {
    ...response,
    ontologyQa: {
      reviewTask,
      result,
      sourceDocumentKeys,
      detail: result.reviewable
        ? `안전조치 검수 ${result.verdict}: ${sourceDocumentLabels.join(", ")} 문서를 확인했습니다.`
        : result.message
    }
  };
}

function qaErrorResult(message: string): QaReviewResult {
  return {
    reviewable: false,
    message,
    registeredTasks: []
  };
}

export async function attachWebOntologyQa(response: AskResponse, question: string): Promise<AskResponse> {
  const reviewTask = resolveReviewTaskLabel("일반 작업", question);
  const source = buildOntologyQaSource(response);

  if (!source.text.trim()) {
    return attachOntologyQaResult(
      response,
      reviewTask,
      qaErrorResult("안전조치 검수에 사용할 문서 본문이 없어 확인을 보류했습니다."),
      source.documentKeys
    );
  }

  try {
    const result = await reviewDocpack(reviewTask, source.text);
    return attachOntologyQaResult(response, reviewTask, result, source.documentKeys);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn("ontology QA failed", { reviewTask, message });
    return attachOntologyQaResult(
      response,
      reviewTask,
      qaErrorResult(`안전조치 검수를 완료하지 못했습니다: ${message}`),
      source.documentKeys
    );
  }
}
