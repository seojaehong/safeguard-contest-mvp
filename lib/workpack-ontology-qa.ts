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
  return {
    ...response,
    ontologyQa: {
      reviewTask,
      result,
      sourceDocumentKeys,
      detail: result.reviewable
        ? `온톨로지 QA ${result.verdict}: ${sourceDocumentKeys.join(", ")} 문서를 검수했습니다.`
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
      qaErrorResult("온톨로지 QA에 사용할 문서 본문이 없어 검수를 수행하지 못했습니다."),
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
      qaErrorResult(`온톨로지 QA 실행 실패: ${message}`),
      source.documentKeys
    );
  }
}
