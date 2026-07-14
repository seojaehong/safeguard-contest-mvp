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
  type McpToolName,
} from "@/lib/mcp-auth";

export type HermesReadToolIntent = {
  toolName: string;
  input: unknown;
};

export type HermesReadToolExecution = {
  context: BrokerRequestContext;
  toolName: McpToolName;
  input: unknown;
  signal: AbortSignal;
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
export type HermesReadToolExecutor = (execution: HermesReadToolExecution) => Promise<unknown>;

export type ExperimentalHermesAdapterDependencies = {
  env: EnvLike;
  planner: HermesPlanner;
  executeReadTool: HermesReadToolExecutor;
};

export function createExperimentalHermesAdapter(
  dependencies: ExperimentalHermesAdapterDependencies,
): EngineAdapter {
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
      await dependencies.planner({
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
          return dependencies.executeReadTool({
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
