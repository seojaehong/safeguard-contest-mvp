import { NextRequest } from "next/server";
import { generateKnowledgeText } from "@/lib/ai";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  applyPublicRateLimitHeader,
  checkPublicRateLimit,
  publicRateLimitResponse
} from "@/lib/public-distributed-rate-limit";
import {
  BLOCKED_KNOWLEDGE_MUTATION_GATEWAY,
  createKnowledgeCandidatePostHandler
} from "@/lib/knowledge-candidate-route";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2min — single Vertex call with 1 retry

const KNOWLEDGE_REGENERATION_RATE_LIMIT = 20;
const KNOWLEDGE_REGENERATION_RATE_WINDOW_MS = 60_000;
const limiter = createRateLimiter({
  limit: KNOWLEDGE_REGENERATION_RATE_LIMIT,
  windowMs: KNOWLEDGE_REGENERATION_RATE_WINDOW_MS
});
const postCandidate = createKnowledgeCandidatePostHandler({
  generateText: generateKnowledgeText,
  mutationGateway: BLOCKED_KNOWLEDGE_MUTATION_GATEWAY
});

export async function POST(request: NextRequest) {
  const rateLimit = await checkPublicRateLimit({
    request,
    namespace: "knowledge-regeneration",
    limit: KNOWLEDGE_REGENERATION_RATE_LIMIT,
    windowMs: KNOWLEDGE_REGENERATION_RATE_WINDOW_MS,
    instanceLimiter: limiter
  });
  const limited = publicRateLimitResponse(rateLimit);
  if (limited) return limited;

  return applyPublicRateLimitHeader(await postCandidate(request), rateLimit);
}
