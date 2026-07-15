import { generateKnowledgeText } from "@/lib/ai";
import {
  BLOCKED_KNOWLEDGE_MUTATION_GATEWAY,
  createKnowledgeCandidatePostHandler
} from "@/lib/knowledge-candidate-route";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2min — single Vertex call with 1 retry

export const POST = createKnowledgeCandidatePostHandler({
  generateText: generateKnowledgeText,
  mutationGateway: BLOCKED_KNOWLEDGE_MUTATION_GATEWAY
});
