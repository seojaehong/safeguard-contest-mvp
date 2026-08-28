import {
  applyPublicRateLimitHeader,
  checkPublicRateLimit,
  publicRateLimitResponse,
  type PublicRateLimitDecision,
} from "@/lib/public-distributed-rate-limit";
import { createRateLimiter } from "@/lib/rate-limit";

export const KNOWLEDGE_INGEST_ADMISSION_POLICY = {
  actor: { limit: 60, windowMs: 60 * 60_000 },
  organization: { limit: 500, windowMs: 24 * 60 * 60_000 },
  workUnit: "knowledge-ingest-write",
} as const;

const actorLimiter = createRateLimiter(KNOWLEDGE_INGEST_ADMISSION_POLICY.actor);
const organizationLimiter = createRateLimiter(KNOWLEDGE_INGEST_ADMISSION_POLICY.organization);

function checkKnowledgeIngestAdmission(input: {
  identifier: string;
  kind: "actor" | "organization";
  request: Request;
}): Promise<PublicRateLimitDecision> {
  const policy = KNOWLEDGE_INGEST_ADMISSION_POLICY[input.kind];
  return checkPublicRateLimit({
    request: input.request,
    identifier: input.identifier,
    namespace: `knowledge-ingest-${input.kind}`,
    limit: policy.limit,
    windowMs: policy.windowMs,
    instanceLimiter: input.kind === "actor" ? actorLimiter : organizationLimiter,
    requireDistributedInProduction: true,
  });
}

export function checkKnowledgeIngestActorAdmission(request: Request, userId: string) {
  return checkKnowledgeIngestAdmission({
    request,
    identifier: `user:${userId}`,
    kind: "actor",
  });
}

export function checkKnowledgeIngestOrganizationAdmission(request: Request, organizationId: string) {
  return checkKnowledgeIngestAdmission({
    request,
    identifier: `organization:${organizationId}`,
    kind: "organization",
  });
}

export function knowledgeIngestAdmissionResponse(
  decision: PublicRateLimitDecision,
): Response | null {
  const response = publicRateLimitResponse(decision);
  if (!response) return null;
  response.headers.set("X-SafeClaw-Work-Unit", KNOWLEDGE_INGEST_ADMISSION_POLICY.workUnit);
  return response;
}

export function applyKnowledgeIngestAdmissionHeaders<T extends Response>(
  response: T,
  decision: PublicRateLimitDecision,
): T {
  applyPublicRateLimitHeader(response, decision);
  response.headers.set("X-SafeClaw-Work-Unit", KNOWLEDGE_INGEST_ADMISSION_POLICY.workUnit);
  return response;
}
