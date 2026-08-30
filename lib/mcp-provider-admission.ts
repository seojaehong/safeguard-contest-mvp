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
  sharedLeaseNamespace: "mcp-provider-generation-work",
  windowMs: 60_000,
  weights: {
    template: 0,
    enhanced: 2,
    full: 12,
  } satisfies Record<AiMode, number>,
} as const;

export const MCP_READ_PROVIDER_ADMISSION_POLICY = {
  leaseMs: 60_000,
  limit: 20,
  namespace: "mcp-provider-read",
  windowMs: 60_000,
  weights: {
    // Conservative work units reflect each tool's provider-capable fanout.
    run_safeclaw_harness_agent: 3,
    get_weather_signals: 8,
    search_accident_cases: 4,
  },
} as const;

export type McpReadProviderTool = keyof typeof MCP_READ_PROVIDER_ADMISSION_POLICY.weights;

export function isMcpReadProviderTool(toolName: string): toolName is McpReadProviderTool {
  return Object.prototype.hasOwnProperty.call(MCP_READ_PROVIDER_ADMISSION_POLICY.weights, toolName);
}

const generationInstanceLimiter = createRateLimiter({
  limit: MCP_PROVIDER_ADMISSION_POLICY.limit,
  windowMs: MCP_PROVIDER_ADMISSION_POLICY.windowMs,
});
const readInstanceLimiter = createRateLimiter({
  limit: MCP_READ_PROVIDER_ADMISSION_POLICY.limit,
  windowMs: MCP_READ_PROVIDER_ADMISSION_POLICY.windowMs,
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

type ProviderAdmission = {
  instanceLimiter: ReturnType<typeof createRateLimiter>;
  leaseMs: number;
  limit: number;
  namespace: string;
  weight: number;
  windowMs: number;
};

async function withProviderAdmission<T>(
  authContext: McpAuthContext,
  admission: ProviderAdmission,
  work: () => Promise<T>,
): Promise<T> {
  if (admission.weight === 0) return work();

  const decision = await checkPublicRateLimit({
    request: new Request("https://safeclaw.invalid/internal/mcp-provider-admission"),
    identifier: admissionIdentifier(authContext),
    namespace: admission.namespace,
    limit: admission.limit,
    windowMs: admission.windowMs,
    instanceLimiter: admission.instanceLimiter,
    requireDistributedInProduction: true,
  });
  if (!decision.allowed) {
    if (decision.reason === "distributed") {
      throw new McpProviderAdmissionError(
        "MCP_PROVIDER_RATE_LIMIT",
        "MCP provider rate limit exceeded",
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
      keyTtlMs: MCP_PROVIDER_ADMISSION_POLICY.leaseMs,
      leaseMs: admission.leaseMs,
      namespace: MCP_PROVIDER_ADMISSION_POLICY.sharedLeaseNamespace,
      requireDistributedInProduction: true,
      weight: admission.weight,
    });
    release = distributedRelease === undefined
      ? acquireInstanceWorkUnits(admission.weight)
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
      "MCP provider concurrency limit exceeded",
    );
  }

  try {
    return await work();
  } finally {
    await release();
  }
}

export async function withMcpProviderAdmission<T>(
  authContext: McpAuthContext,
  mode: AiMode,
  work: () => Promise<T>,
): Promise<T> {
  const weight = MCP_PROVIDER_ADMISSION_POLICY.weights[mode];
  return withProviderAdmission(authContext, {
    instanceLimiter: generationInstanceLimiter,
    leaseMs: MCP_PROVIDER_ADMISSION_POLICY.leaseMs,
    limit: MCP_PROVIDER_ADMISSION_POLICY.limit,
    namespace: MCP_PROVIDER_ADMISSION_POLICY.namespace,
    windowMs: MCP_PROVIDER_ADMISSION_POLICY.windowMs,
    weight,
  }, work);
}

export async function withMcpReadProviderAdmission<T>(
  authContext: McpAuthContext,
  toolName: McpReadProviderTool,
  work: () => Promise<T>,
): Promise<T> {
  return withProviderAdmission(authContext, {
    instanceLimiter: readInstanceLimiter,
    leaseMs: MCP_READ_PROVIDER_ADMISSION_POLICY.leaseMs,
    limit: MCP_READ_PROVIDER_ADMISSION_POLICY.limit,
    namespace: MCP_READ_PROVIDER_ADMISSION_POLICY.namespace,
    windowMs: MCP_READ_PROVIDER_ADMISSION_POLICY.windowMs,
    weight: MCP_READ_PROVIDER_ADMISSION_POLICY.weights[toolName],
  }, work);
}
