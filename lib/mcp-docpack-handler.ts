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
import {
  buildPhaseAGenerationGrounding,
  isEvidenceChainTaskBoundToQuestion,
  type ActiveEvidenceChainPack,
  type PhaseAGenerationGrounding,
} from "@/lib/ontology/evidence-chain";
import {
  buildPhaseAProductMaterialization,
  materializePhaseAProductDocuments,
} from "@/lib/ontology/product-materialization";
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
  generateResponse: (
    question: string,
    mode: AiMode,
    grounding?: PhaseAGenerationGrounding,
  ) => Promise<AskResponse>;
  queryKnowledge: (query: string) => Promise<SafetyKnowledgeResult>;
  getWorkpackRepository: () => McpWorkpackRepository | null;
  getGenerationEvidenceSecret: () => string | undefined;
};

export function createGenerateSafetyDocpackHandler(
  dependencies: GenerateSafetyDocpackHandlerDependencies,
): GenerateSafetyDocpackHandler {
  return async ({ question, mode, includeFull }, authContext) => {
    const generationEvidenceSecret = dependencies.getGenerationEvidenceSecret();
    const knowledge = await dependencies.queryKnowledge(question);
    const grounding = knowledge.evidenceContract
      ? buildPhaseAGenerationGrounding({
          evidenceChainState: knowledge.evidenceChainState,
          evidencePack: knowledge.evidenceContract,
        })
      : undefined;
    const generatedResponse = await dependencies.generateResponse(
      question,
      mode ?? dependencies.defaultMode,
      grounding,
    );
    const product = grounding ? buildPhaseAProductMaterialization({
      evidenceChainState: grounding.groundingStatus === "resolved"
        ? "resolved"
        : grounding.evidencePack
          ? "review_required"
          : grounding.evidenceChainState,
      evidencePack: grounding.evidencePack as ActiveEvidenceChainPack | null,
    }) : null;
    const response = product
      ? materializePhaseAProductDocuments(generatedResponse, product, {
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
  generateResponse: (
    question: string,
    mode: AiMode,
    grounding?: PhaseAGenerationGrounding,
  ) => Promise<AskResponse>;
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
    const knowledge = await dependencies.queryKnowledge(task);
    const taskBound = knowledge.found
      && knowledge.evidenceContract !== null
      && isEvidenceChainTaskBoundToQuestion(task, question, knowledge.evidenceContract.chainId);
    const grounding = taskBound && knowledge.evidenceContract
      ? buildPhaseAGenerationGrounding({
          evidenceChainState: knowledge.evidenceChainState,
          evidencePack: knowledge.evidenceContract,
        })
      : undefined;
    const generatedResponse = await dependencies.generateResponse(
      question,
      mode ?? dependencies.defaultMode,
      grounding,
    );
    const reviewTask = grounding?.evidencePack?.task.label
      ?? resolveReviewTaskLabel(task, question);
    const product = grounding ? buildPhaseAProductMaterialization({
      evidenceChainState: grounding.groundingStatus === "resolved"
        ? "resolved"
        : grounding.evidencePack
          ? "review_required"
          : grounding.evidenceChainState,
      evidencePack: grounding.evidencePack as ActiveEvidenceChainPack | null,
    }) : null;
    const response = product
      ? materializePhaseAProductDocuments(generatedResponse, product, {
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
