import type { AiMode } from "@/lib/ai-deliverables";
import type { McpAuthContext } from "@/lib/mcp-auth";
import {
  acquirePublicConcurrencyLease,
  checkPublicRateLimit,
} from "@/lib/public-distributed-rate-limit";
import { createRateLimiter } from "@/lib/rate-limit";

export const MCP_PROVIDER_ADMISSION_POLICY = {
  capacity: 12,
  leaseMs: 310_000,
  limit: 10,
  namespace: "mcp-provider-generation",
  windowMs: 60_000,
  weights: {
    template: 0,
    enhanced: 2,
    full: 12,
  } satisfies Record<AiMode, number>,
} as const;

const instanceLimiter = createRateLimiter({
  limit: MCP_PROVIDER_ADMISSION_POLICY.limit,
  windowMs: MCP_PROVIDER_ADMISSION_POLICY.windowMs,
});
let activeInstanceWorkUnits = 0;

export class McpProviderAdmissionError extends Error {
  readonly code:
    | "MCP_PROVIDER_ADMISSION_UNAVAILABLE"
    | "MCP_PROVIDER_CONCURRENCY_LIMIT"
    | "MCP_PROVIDER_RATE_LIMIT";

  constructor(code: McpProviderAdmissionError["code"], message: string) {
    super(message);
    this.name = "McpProviderAdmissionError";
    this.code = code;
  }
}

function admissionIdentifier(context: McpAuthContext): string {
  const tokenIdentity = context.admissionIdentity
    ?? (context.tokenId ? `db:${context.tokenId}` : `${context.source}:unbound-token`);
  return [
    tokenIdentity,
    `org:${context.orgId ?? "unbound"}`,
    `site:${context.siteId ?? "unbound"}`,
  ].join("|");
}

function acquireInstanceWorkUnits(weight: number): (() => Promise<void>) | null {
  if (activeInstanceWorkUnits + weight > MCP_PROVIDER_ADMISSION_POLICY.capacity) return null;
  activeInstanceWorkUnits += weight;
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    activeInstanceWorkUnits -= weight;
  };
}

export async function withMcpProviderAdmission<T>(
  authContext: McpAuthContext,
  mode: AiMode,
  work: () => Promise<T>,
): Promise<T> {
  const weight = MCP_PROVIDER_ADMISSION_POLICY.weights[mode];
  if (weight === 0) return work();

  const decision = await checkPublicRateLimit({
    request: new Request("https://safeclaw.invalid/internal/mcp-provider-admission"),
    identifier: admissionIdentifier(authContext),
    namespace: MCP_PROVIDER_ADMISSION_POLICY.namespace,
    limit: MCP_PROVIDER_ADMISSION_POLICY.limit,
    windowMs: MCP_PROVIDER_ADMISSION_POLICY.windowMs,
    instanceLimiter,
    requireDistributedInProduction: true,
  });
  if (!decision.allowed) {
    if (decision.reason === "distributed") {
      throw new McpProviderAdmissionError(
        "MCP_PROVIDER_RATE_LIMIT",
        "MCP provider generation rate limit exceeded",
      );
    }
    throw new McpProviderAdmissionError(
      "MCP_PROVIDER_ADMISSION_UNAVAILABLE",
      "MCP distributed provider admission is unavailable",
    );
  }

  let release: (() => Promise<void>) | null | undefined;
  try {
    const distributedRelease = await acquirePublicConcurrencyLease({
      concurrency: MCP_PROVIDER_ADMISSION_POLICY.capacity,
      leaseMs: MCP_PROVIDER_ADMISSION_POLICY.leaseMs,
      namespace: `${MCP_PROVIDER_ADMISSION_POLICY.namespace}-work`,
      requireDistributedInProduction: true,
      weight,
    });
    release = distributedRelease === undefined
      ? acquireInstanceWorkUnits(weight)
      : distributedRelease;
  } catch (error) {
    console.error("[mcp-provider-admission] distributed lease unavailable", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new McpProviderAdmissionError(
      "MCP_PROVIDER_ADMISSION_UNAVAILABLE",
      "MCP distributed provider lease is unavailable",
    );
  }
  if (!release) {
    throw new McpProviderAdmissionError(
      "MCP_PROVIDER_CONCURRENCY_LIMIT",
      "MCP provider generation concurrency limit exceeded",
    );
  }

  try {
    return await work();
  } finally {
    await release();
  }
}
