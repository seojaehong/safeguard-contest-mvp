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
import { acquirePublicAskWorkLease } from "@/lib/public-ask-admission";
import {
  enforcePublicJsonRequestBodyBudget,
  PUBLIC_KNOWLEDGE_REGENERATION_REQUEST_MAX_BYTES
} from "@/lib/public-work-budget";

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
  mutationGateway: BLOCKED_KNOWLEDGE_MUTATION_GATEWAY,
  acquireGenerationLease: () => acquirePublicAskWorkLease("enhanced")
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

  const bodyBudget = await enforcePublicJsonRequestBodyBudget(
    request,
    PUBLIC_KNOWLEDGE_REGENERATION_REQUEST_MAX_BYTES,
    "request body exceeds the public knowledge regeneration byte budget"
  );
  if (!bodyBudget.ok) return applyPublicRateLimitHeader(bodyBudget.response, rateLimit);

  return applyPublicRateLimitHeader(await postCandidate(bodyBudget.request), rateLimit);
}
