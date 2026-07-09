import type { AskResponse } from "./types";
import type { MissingControl, QaReviewFound, QaReviewResult } from "./ontology/qa-review";
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

function appendRemediationSection(text: string | undefined, heading: string, lines: string[]) {
  const body = (text || "").trim();
  if (!body || !lines.length || body.includes(heading)) return text || "";
  return `${body}\n\n${heading}\n${lines.map((line) => `- ${line}`).join("\n")}`;
}

function controlLine(item: MissingControl) {
  return item.articles.length
    ? `${item.control} (${item.articles.join(", ")})`
    : item.control;
}

function needsRemediation(result: QaReviewResult): result is QaReviewFound {
  return result.reviewable && (
    result.missing.hazards.length > 0 ||
    result.missing.controls.length > 0 ||
    result.missing.articles.length > 0
  );
}

export function applyOntologyQaRemediation(
  response: AskResponse,
  reviewTask: string,
  result: QaReviewFound
): AskResponse {
  const missingHazardLines = result.missing.hazards.map((hazard) =>
    `누락 위험요인 확인: ${hazard}`
  );
  const missingControlLines = result.missing.controls.map((control) =>
    `필수 안전조치 반영: ${controlLine(control)}`
  );
  const missingArticleLines = result.missing.articles.slice(0, 6).map((article) =>
    `관련 조문 확인: ${article}`
  );
  const commonLines = [
    `검수 보완 작업: ${reviewTask}`,
    ...missingHazardLines,
    ...missingControlLines,
    ...missingArticleLines,
    "현장 여건에 맞는 담당자·확인시각·측정값은 전파 전 관리자가 확인합니다."
  ];

  if (commonLines.length <= 2) return response;

  const tbmLines = [
    `검수 보완 전달: ${reviewTask}`,
    ...result.missing.controls.map((control) => `작업 전 확인: ${controlLine(control)}`),
    ...result.missing.hazards.map((hazard) => `작업자 질문: ${hazard} 위험을 확인했습니까?`)
  ];
  const logLines = [
    `검수 보완 확인: ${reviewTask}`,
    ...result.missing.controls.map((control) => `확인 항목: ${controlLine(control)} / 담당자 확인 필요`)
  ];

  return {
    ...response,
    deliverables: {
      ...response.deliverables,
      riskAssessmentDraft: appendRemediationSection(
        response.deliverables.riskAssessmentDraft,
        "[온톨로지 QA 보완 반영 - 위험성평가]",
        commonLines
      ),
      workPlanDraft: appendRemediationSection(
        response.deliverables.workPlanDraft,
        "[온톨로지 QA 보완 반영 - 작업계획]",
        commonLines
      ),
      tbmBriefing: appendRemediationSection(
        response.deliverables.tbmBriefing,
        "[온톨로지 QA 보완 반영 - TBM]",
        tbmLines.length ? tbmLines : commonLines
      ),
      tbmLogDraft: appendRemediationSection(
        response.deliverables.tbmLogDraft,
        "[온톨로지 QA 보완 반영 - TBM 기록]",
        logLines.length ? logLines : commonLines
      ),
      safetyEducationRecordDraft: appendRemediationSection(
        response.deliverables.safetyEducationRecordDraft,
        "[온톨로지 QA 보완 반영 - 교육]",
        commonLines
      ),
      emergencyResponseDraft: appendRemediationSection(
        response.deliverables.emergencyResponseDraft,
        "[온톨로지 QA 보완 반영 - 비상대응]",
        commonLines
      )
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
    if (!needsRemediation(result)) {
      return attachOntologyQaResult(response, reviewTask, result, source.documentKeys);
    }

    const remediated = applyOntologyQaRemediation(response, reviewTask, result);
    const remediatedSource = buildOntologyQaSource(remediated);
    const rereviewed = await reviewDocpack(reviewTask, remediatedSource.text);
    return attachOntologyQaResult(remediated, reviewTask, rereviewed, remediatedSource.documentKeys);
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
