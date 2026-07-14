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
import type { DbHarnessPacket } from "@/lib/db-harness";
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
  evidencePacket: DbHarnessPacket;
  emitText: (output: HermesPlannerTextOutput) => void;
  signal: AbortSignal;
  requestReadTool: (intent: HermesReadToolIntent) => Promise<unknown>;
};

export type HermesPlannerTextOutput = {
  text: string;
  evidencePacket: DbHarnessPacket;
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

function readEvidencePacket(result: unknown): DbHarnessPacket {
  if (typeof result !== "object" || result === null) {
    throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
  }
  const candidate = result as { engine?: unknown; packet?: unknown };
  if (candidate.engine !== "safeclaw-db-harness"
    || typeof candidate.packet !== "object"
    || candidate.packet === null) {
    throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
  }
  const packet = candidate.packet as Partial<DbHarnessPacket>;
  if (packet.mode !== "db_harness_first"
    || packet.generationContract?.llmRole !== "naturalize_only"
    || packet.generationContract.evidenceAuthority !== "db_harness"
    || packet.generationContract.fallbackChainAllowed !== false
    || packet.generationContract.genericProseSubstitutionAllowed !== false) {
    throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
  }
  return packet as DbHarnessPacket;
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
      let evidencePacket: DbHarnessPacket;
      try {
        const harnessResult = await dependencies.composition.readExecutor.execute({
          context: input.context,
          toolName: "run_safeclaw_harness_agent",
          input: { question: input.prompt },
          signal: input.signal,
        });
        evidencePacket = readEvidencePacket(harnessResult);
      } catch (error) {
        if (error instanceof BrokerError) throw error;
        throw new BrokerError("ENGINE_EXECUTION_FAILED", 500, error);
      }
      await dependencies.composition.planner({
        contractVersion: ENGINE_ADAPTER_CONTRACT_VERSION,
        authority: SAFECLAW_ENGINE_AUTHORITY,
        context: input.context,
        prompt: input.prompt,
        evidencePacket,
        emitText: (output) => {
          if (typeof output !== "object"
            || output === null
            || output.evidencePacket !== evidencePacket
            || typeof output.text !== "string") {
            throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
          }
          input.emit({ kind: "text-delta", text: output.text });
        },
        signal: input.signal,
        async requestReadTool(intent): Promise<unknown> {
          if (intent.toolName === "run_safeclaw_harness_agent"
            || !isReadOnlyMcpTool(intent.toolName)) {
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
