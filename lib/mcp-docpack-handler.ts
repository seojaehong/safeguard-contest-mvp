import type { AiMode } from "@/lib/ai-deliverables";
import type { McpAuthContext } from "@/lib/mcp-auth";
import {
  buildDocpackResult,
  buildReviewedDocpackResult,
  resolveReviewTaskLabel,
  toToolResult,
  type McpToolResult,
  type SafetyKnowledgeResult,
} from "@/lib/mcp-tools";
import { isEvidenceChainTaskBoundToQuestion } from "@/lib/ontology/evidence-chain";
import { materializePhaseAProductDocuments } from "@/lib/ontology/product-materialization";
import type { QaReviewResult } from "@/lib/ontology/qa-review";
import type { AskResponse } from "@/lib/types";
import {
  saveMcpDocpackWorkpackWithRepository,
  type McpWorkpackRepository,
} from "@/lib/workpack-store";

export type GenerateSafetyDocpackInput = {
  question: string;
  mode?: AiMode;
  includeFull?: boolean;
};

export type GenerateSafetyDocpackHandler = (
  input: GenerateSafetyDocpackInput,
  authContext: McpAuthContext,
) => Promise<McpToolResult>;

type GenerateSafetyDocpackHandlerDependencies = {
  defaultMode: AiMode;
  generateResponse: (question: string, mode: AiMode) => Promise<AskResponse>;
  queryKnowledge: (query: string) => Promise<SafetyKnowledgeResult>;
  getWorkpackRepository: () => McpWorkpackRepository | null;
  getGenerationEvidenceSecret: () => string | undefined;
};

export function createGenerateSafetyDocpackHandler(
  dependencies: GenerateSafetyDocpackHandlerDependencies,
): GenerateSafetyDocpackHandler {
  return async ({ question, mode, includeFull }, authContext) => {
    const generationEvidenceSecret = dependencies.getGenerationEvidenceSecret();
    const [generatedResponse, knowledge] = await Promise.all([
      dependencies.generateResponse(question, mode ?? dependencies.defaultMode),
      dependencies.queryKnowledge(question),
    ]);
    const response = knowledge.found && knowledge.phaseAProduct
      ? materializePhaseAProductDocuments(generatedResponse, knowledge.phaseAProduct, {
          generationEvidenceSecret,
        })
      : generatedResponse;
    const result = buildDocpackResult(response, includeFull ?? false) as Record<string, unknown>;

    if (authContext.siteId) {
      const repository = dependencies.getWorkpackRepository();
      result.attribution = repository
        ? await saveMcpDocpackWorkpackWithRepository(
            repository,
            { siteId: authContext.siteId, orgId: authContext.orgId },
            response,
            generationEvidenceSecret,
          )
        : {
            siteId: authContext.siteId,
            orgId: authContext.orgId,
            workpackId: null,
            saved: false,
          };
    }

    return toToolResult(result);
  };
}

export type GenerateReviewedSafetyDocpackInput = GenerateSafetyDocpackInput & {
  task: string;
};

export type GenerateReviewedSafetyDocpackHandler = (
  input: GenerateReviewedSafetyDocpackInput,
  authContext: McpAuthContext,
) => Promise<McpToolResult>;

type GenerateReviewedSafetyDocpackHandlerDependencies = {
  defaultMode: AiMode;
  generateResponse: (question: string, mode: AiMode) => Promise<AskResponse>;
  queryKnowledge: (query: string) => Promise<SafetyKnowledgeResult>;
  reviewResponse: (task: string, documentText: string) => Promise<QaReviewResult>;
  persistResponse: (
    authContext: McpAuthContext,
    response: AskResponse,
  ) => Promise<Record<string, unknown> | null>;
  getGenerationEvidenceSecret: () => string | undefined;
};

function selectReviewedQaText(response: AskResponse): string {
  return response.deliverables.riskAssessmentDraft
    || response.deliverables.tbmBriefing
    || response.deliverables.workPlanDraft
    || response.deliverables.safetyEducationRecordDraft
    || "";
}

export function createGenerateReviewedSafetyDocpackHandler(
  dependencies: GenerateReviewedSafetyDocpackHandlerDependencies,
): GenerateReviewedSafetyDocpackHandler {
  return async ({ question, task, mode, includeFull }, authContext) => {
    const generationEvidenceSecret = dependencies.getGenerationEvidenceSecret();
    const [generatedResponse, knowledge] = await Promise.all([
      dependencies.generateResponse(question, mode ?? dependencies.defaultMode),
      dependencies.queryKnowledge(task),
    ]);
    const reviewTask = knowledge.phaseAProduct?.task.label
      ?? resolveReviewTaskLabel(task, question);
    const response = knowledge.found && knowledge.phaseAProduct
      && isEvidenceChainTaskBoundToQuestion(task, question, knowledge.phaseAProduct.chainId)
      ? materializePhaseAProductDocuments(generatedResponse, knowledge.phaseAProduct, {
          generationEvidenceSecret,
        })
      : generatedResponse;
    const qa = await dependencies.reviewResponse(reviewTask, selectReviewedQaText(response));
    const result = buildReviewedDocpackResult(
      response,
      qa,
      reviewTask,
      includeFull ?? false,
    ) as Record<string, unknown>;

    if (authContext.siteId) {
      const attribution = await dependencies.persistResponse(authContext, response);
      if (attribution) result.attribution = attribution;
    }

    return toToolResult(result);
  };
}
