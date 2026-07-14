import { createHash } from "node:crypto";

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
  isKoshaSupportingCitationEligible,
  type SafetyReferenceItem,
} from "@/lib/safety-reference-catalog";
import {
  createSafeClawScopedMcpReadExecutor,
  isSafeClawScopedMcpReadExecutor,
  type SafeClawScopedMcpReadExecutor,
} from "@/lib/safeclaw-mcp-read-executor";

export type HermesReadToolIntent = {
  toolName: string;
  input: unknown;
};

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type ImmutableEvidencePacket = DeepReadonly<DbHarnessPacket>;

export type HermesPlannerInput = {
  contractVersion: typeof ENGINE_ADAPTER_CONTRACT_VERSION;
  authority: EngineAuthority;
  context: BrokerRequestContext;
  prompt: string;
  evidencePacket: ImmutableEvidencePacket;
  emitText: (output: HermesPlannerTextOutput) => void;
  signal: AbortSignal;
  requestReadTool: (intent: HermesReadToolIntent) => Promise<unknown>;
};

export type HermesPlannerTextOutput = {
  text: string;
  evidencePacket: ImmutableEvidencePacket;
};

export type HermesPlanner = (input: HermesPlannerInput) => Promise<void>;

export type HermesRuntimeAttestation = (
  context: BrokerRequestContext,
  signal?: AbortSignal,
) => Promise<void>;

const SAFECLAW_HERMES_COMPOSITION = Symbol("safeclaw-hermes-composition");

export type SafeClawHermesComposition = {
  readonly planner: HermesPlanner;
  readonly readExecutor: SafeClawScopedMcpReadExecutor;
  readonly attestRuntime?: HermesRuntimeAttestation;
  readonly [SAFECLAW_HERMES_COMPOSITION]: true;
};

export function createSafeClawHermesComposition(
  planner: HermesPlanner,
  options: { attestRuntime?: HermesRuntimeAttestation } = {},
): SafeClawHermesComposition {
  return Object.freeze({
    planner,
    readExecutor: createSafeClawScopedMcpReadExecutor(),
    attestRuntime: options.attestRuntime,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGroundedKoshaReference(value: unknown): boolean {
  return isRecord(value)
    && typeof value.item_type === "string"
    && isKoshaSupportingCitationEligible(value as SafetyReferenceItem);
}

function isSuccessfulRequiredSearch(
  value: unknown,
  source: "sif_cases" | "supporting_evidence",
): boolean {
  return isRecord(value)
    && value.source === source
    && value.ok === true
    && value.configured === true
    && typeof value.count === "number"
    && Number.isInteger(value.count)
    && value.count > 0
    && typeof value.retrievalMode === "string"
    && value.retrievalMode !== "unconfigured";
}

function normalizePrompt(prompt: string): string {
  return prompt.trim();
}

function hasNonNegativeIntegerFields(
  value: Record<string, unknown>,
  fields: readonly string[],
): boolean {
  return fields.every((field) => (
    typeof value[field] === "number"
    && Number.isInteger(value[field])
    && (value[field] as number) >= 0
  ));
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

function isRecursivelyFrozen(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value !== "object" || value === null) return true;
  if (!Object.isFrozen(value)) return false;
  if (seen.has(value)) return true;
  seen.add(value);
  return Object.values(value).every((child) => isRecursivelyFrozen(child, seen));
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
}

function digestEvidencePacket(packet: unknown): string {
  return createHash("sha256").update(canonicalJson(packet), "utf8").digest("hex");
}

function readEvidencePacket(result: unknown, expectedQuestion: string): DbHarnessPacket {
  if (!isRecord(result)) {
    throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
  }
  if (result.engine !== "safeclaw-db-harness" || !isRecord(result.packet)) {
    throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
  }
  const packet = result.packet;
  const retrieval = packet.retrievalContract;
  const ontology = packet.ontologyChecklist;
  const generation = packet.generationContract;
  const directEvidence = packet.directEvidence;
  const sifCases = packet.sifCases;
  const supportingEvidence = packet.supportingEvidence;
  const referenceSearch = result.referenceSearch;
  const retrievalVector = isRecord(retrieval) ? retrieval.vector : undefined;
  const sourceCounts = isRecord(retrieval) ? retrieval.sourceCounts : undefined;
  if (!Array.isArray(referenceSearch)
    || !referenceSearch.some((item) => isSuccessfulRequiredSearch(item, "sif_cases"))
    || !referenceSearch.some((item) => isSuccessfulRequiredSearch(item, "supporting_evidence"))
    || !isRecord(retrieval)
    || !isRecord(retrievalVector)
    || !isRecord(sourceCounts)
    || !isRecord(ontology)
    || !isRecord(generation)
    || !Array.isArray(directEvidence)
    || !Array.isArray(sifCases)
    || !Array.isArray(supportingEvidence)
    || !Array.isArray(packet.improvementMemory)
    || !Array.isArray(packet.workpackMemory)
    || !Array.isArray(ontology.missing)
    || !Array.isArray(generation.requiredDocuments)
    || !Array.isArray(generation.missingEvidence)
    || !Array.isArray(generation.documentCoverage)
    || packet.mode !== "db_harness_first"
    || packet.question !== expectedQuestion
    || retrieval.source !== "safety_reference_items"
    || retrieval.errorCode !== undefined
    || typeof retrieval.mode !== "string"
    || retrieval.mode === "unconfigured"
    || typeof retrieval.message !== "string"
    || (retrievalVector.enabled !== false && retrievalVector.enabled !== true)
    || (retrievalVector.attempted !== false && retrievalVector.attempted !== true)
    || (retrievalVector.ready !== false && retrievalVector.ready !== true)
    || typeof retrievalVector.reason !== "string"
    || typeof retrievalVector.message !== "string"
    || !hasNonNegativeIntegerFields(sourceCounts, [
      "directEvidence",
      "sifCases",
      "supportingEvidence",
      "rest",
      "ranked",
      "vector",
      "hybrid",
      "localTag",
      "localRanked",
      "localHybrid",
    ])
    || sourceCounts.directEvidence !== directEvidence.length
    || sourceCounts.sifCases !== sifCases.length
    || sourceCounts.supportingEvidence !== supportingEvidence.length
    || sifCases.length === 0
    || !sifCases.some((item) => isRecord(item) && item.item_type === "sif-case")
    || !supportingEvidence.some(isGroundedKoshaReference)
    || ontology.status !== "ready"
    || ontology.missing.length !== 0
    || generation.requiredDocuments.length === 0
    || generation.missingEvidence.length !== 0
    || generation.documentCoverage.length !== generation.requiredDocuments.length
    || generation.requiredDocuments.some((item) => typeof item !== "string" || !item.trim())
    || generation.documentCoverage.some((item) => (
      !isRecord(item)
      || typeof item.document !== "string"
      || item.covered !== true
      || !Array.isArray(item.evidenceTypes)
    ))
    || generation.llmRole !== "naturalize_only"
    || generation.llmOutputScope !== "rewrite_fixed_evidence_only"
    || generation.evidenceAuthority !== "db_harness"
    || generation.providerRetryScope !== "naturalization_retry_only"
    || generation.fallbackChainAllowed !== false
    || generation.genericProseSubstitutionAllowed !== false
    || generation.missingEvidencePolicy !== "surface_review_required") {
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
    async checkAvailability(context, signal): Promise<void> {
      assertEnabled();
      await dependencies.composition.attestRuntime?.(context, signal);
    },
    async run(input): Promise<void> {
      assertEnabled();
      await dependencies.composition.attestRuntime?.(input.context, input.signal);
      let evidencePacket: ImmutableEvidencePacket;
      let evidenceDigest: string;
      try {
        const harnessResult = await dependencies.composition.readExecutor.execute({
          context: input.context,
          toolName: "run_safeclaw_harness_agent",
          input: { question: input.prompt },
          signal: input.signal,
        });
        const validatedPacket = readEvidencePacket(harnessResult, normalizePrompt(input.prompt));
        evidencePacket = deepFreeze(structuredClone(validatedPacket));
        evidenceDigest = digestEvidencePacket(evidencePacket);
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
            || !isRecord(output.evidencePacket)
            || output.evidencePacket === evidencePacket
            || !isRecursivelyFrozen(output.evidencePacket)
            || typeof output.text !== "string") {
            throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
          }
          const expectedQuestion = normalizePrompt(input.prompt);
          if (output.evidencePacket.question !== expectedQuestion
            || digestEvidencePacket(evidencePacket) !== evidenceDigest
            || digestEvidencePacket(output.evidencePacket) !== evidenceDigest) {
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
