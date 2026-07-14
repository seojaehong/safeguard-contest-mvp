import type { AiMode } from "@/lib/ai-deliverables";
import type { McpAuthContext } from "@/lib/mcp-auth";
import {
  buildDocpackResult,
  toToolResult,
  type McpToolResult,
  type SafetyKnowledgeResult,
} from "@/lib/mcp-tools";
import { materializePhaseAProductDocuments } from "@/lib/ontology/product-materialization";
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
