import {
  BrokerError,
  ENGINE_ADAPTER_CONTRACT_VERSION,
  SAFECLAW_ENGINE_AUTHORITY,
  resolveEngineMode,
  type BrokerRequestContext,
  type EngineAdapter,
  type EngineAuthority,
  type EnvLike,
} from "@/lib/engine-adapter";
import {
  isReadOnlyMcpTool,
} from "@/lib/mcp-auth";
import {
  createSafeClawScopedMcpReadExecutor,
  isSafeClawScopedMcpReadExecutor,
  type SafeClawScopedMcpReadExecutor,
} from "@/lib/safeclaw-mcp-read-executor";

export type HermesReadToolIntent = {
  toolName: string;
  input: unknown;
};

export type HermesPlannerInput = {
  contractVersion: typeof ENGINE_ADAPTER_CONTRACT_VERSION;
  authority: EngineAuthority;
  context: BrokerRequestContext;
  prompt: string;
  emitText: (text: string) => void;
  signal: AbortSignal;
  requestReadTool: (intent: HermesReadToolIntent) => Promise<unknown>;
};

export type HermesPlanner = (input: HermesPlannerInput) => Promise<void>;

const SAFECLAW_HERMES_COMPOSITION = Symbol("safeclaw-hermes-composition");

export type SafeClawHermesComposition = {
  readonly planner: HermesPlanner;
  readonly readExecutor: SafeClawScopedMcpReadExecutor;
  readonly [SAFECLAW_HERMES_COMPOSITION]: true;
};

export function createSafeClawHermesComposition(
  planner: HermesPlanner,
): SafeClawHermesComposition {
  return Object.freeze({
    planner,
    readExecutor: createSafeClawScopedMcpReadExecutor(),
    [SAFECLAW_HERMES_COMPOSITION]: true as const,
  });
}

function isSafeClawHermesComposition(value: unknown): value is SafeClawHermesComposition {
  return typeof value === "object"
    && value !== null
    && (value as { [SAFECLAW_HERMES_COMPOSITION]?: unknown })[SAFECLAW_HERMES_COMPOSITION] === true
    && isSafeClawScopedMcpReadExecutor(
      (value as { readExecutor?: unknown }).readExecutor,
    );
}

export type ExperimentalHermesAdapterDependencies = {
  env: EnvLike;
  composition: SafeClawHermesComposition;
};

export function createExperimentalHermesAdapter(
  dependencies: ExperimentalHermesAdapterDependencies,
): EngineAdapter {
  if (!isSafeClawHermesComposition(dependencies.composition)) {
    throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
  }

  function assertEnabled(): void {
    if (resolveEngineMode(dependencies.env) !== "experimental-hermes") {
      throw new BrokerError("ENGINE_UNAVAILABLE", 503);
    }
  }

  return {
    id: "experimental-hermes",
    contractVersion: ENGINE_ADAPTER_CONTRACT_VERSION,
    runtime: "hermes",
    authority: SAFECLAW_ENGINE_AUTHORITY,
    capabilities: ["stream_text", "request_read_tool"],
    async checkAvailability(): Promise<void> {
      assertEnabled();
    },
    async run(input): Promise<void> {
      assertEnabled();
      await dependencies.composition.planner({
        contractVersion: ENGINE_ADAPTER_CONTRACT_VERSION,
        authority: SAFECLAW_ENGINE_AUTHORITY,
        context: input.context,
        prompt: input.prompt,
        emitText: (text) => input.emit({ kind: "text-delta", text }),
        signal: input.signal,
        async requestReadTool(intent): Promise<unknown> {
          if (!isReadOnlyMcpTool(intent.toolName)) {
            throw new BrokerError("ENGINE_TOOL_FORBIDDEN", 403);
          }
          return dependencies.composition.readExecutor.execute({
            context: input.context,
            toolName: intent.toolName,
            input: intent.input,
            signal: input.signal,
          });
        },
      });
    },
  };
}
