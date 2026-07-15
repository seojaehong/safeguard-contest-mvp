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
  isKoshaTechnicalReference,
  isSafetyReferenceDirectEligible,
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

export const HERMES_OUTPUT_ATTESTATION_VERSION = "hermes-output-attestation/v1" as const;

export type HermesEvidenceClaim = {
  claimId: string;
  text: string;
  citations: readonly {
    citationId: string;
    label: string;
  }[];
};

export type HermesPlannerInput = {
  contractVersion: typeof ENGINE_ADAPTER_CONTRACT_VERSION;
  authority: EngineAuthority;
  context: BrokerRequestContext;
  prompt: string;
  evidencePacket: ImmutableEvidencePacket;
  evidenceDigest: string;
  evidenceClaims: readonly HermesEvidenceClaim[];
  emitText: (output: HermesPlannerTextOutput) => void;
  signal: AbortSignal;
  requestReadTool: (intent: HermesReadToolIntent) => Promise<unknown>;
};

export type HermesPlannerTextOutput = {
  evidencePacket: ImmutableEvidencePacket;
  attestation: {
    schemaVersion: typeof HERMES_OUTPUT_ATTESTATION_VERSION;
    evidenceDigest: string;
    claims: readonly {
      claimId: string;
      citationIds: readonly string[];
    }[];
  };
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
  readonly trustedKoshaReference?: (item: SafetyReferenceItem) => boolean;
  readonly [SAFECLAW_HERMES_COMPOSITION]: true;
};

export function createSafeClawHermesComposition(
  planner: HermesPlanner,
  options: {
    attestRuntime?: HermesRuntimeAttestation;
    trustedKoshaReference?: (item: SafetyReferenceItem) => boolean;
  } = {},
): SafeClawHermesComposition {
  return Object.freeze({
    planner,
    readExecutor: createSafeClawScopedMcpReadExecutor(),
    attestRuntime: options.attestRuntime,
    trustedKoshaReference: options.trustedKoshaReference,
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

function isGroundedKoshaReference(
  value: unknown,
  trustedKoshaReference?: (item: SafetyReferenceItem) => boolean,
): boolean {
  return isRecord(value)
    && typeof value.item_type === "string"
    && isKoshaSupportingCitationEligible(value as SafetyReferenceItem)
    && (trustedKoshaReference?.(value as SafetyReferenceItem) ?? false);
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

type EligibleClaimReference = Readonly<{
  item: SafetyReferenceItem;
  authorityLabel: string;
  controls: readonly string[];
}>;

function normalizeEvidenceText(value: string): string {
  return value.normalize("NFC").replace(/\s+/gu, " ").trim();
}

function extractableKoshaClaims(item: SafetyReferenceItem): readonly string[] {
  const body = normalizeEvidenceText(item.body ?? "");
  if (!body) return [];
  const candidates = [
    ...item.controls,
    ...(item.kosha_guide?.anchors.map((anchor) => anchor.excerpt) ?? []),
  ];
  return [...new Set(candidates.filter((candidate) => {
    const extract = normalizeEvidenceText(candidate);
    return extract.length > 0 && body.includes(extract);
  }))];
}

function buildEvidenceClaims(
  packet: DbHarnessPacket,
  trustedKoshaReference?: (item: SafetyReferenceItem) => boolean,
): readonly HermesEvidenceClaim[] {
  const claims = new Map<string, HermesEvidenceClaim>();
  const koshaReferences = [...packet.directEvidence, ...packet.supportingEvidence]
    .filter(isKoshaTechnicalReference)
    .filter((item) => isGroundedKoshaReference(item, trustedKoshaReference));
  const uniqueKoshaReferences = [...new Map(
    koshaReferences.map((item) => [item.id, item]),
  ).values()];
  const references: EligibleClaimReference[] = [
    ...packet.directEvidence
      .filter((item) => !isKoshaTechnicalReference(item) && isSafetyReferenceDirectEligible(item))
      .map((item) => ({ item, authorityLabel: "직접 근거", controls: item.controls })),
    ...packet.sifCases
      .filter((item) => item.item_type === "sif-case")
      .map((item) => ({
        item,
        authorityLabel: "SIF 사례 근거(위험 우선순위)",
        controls: item.controls,
      })),
    ...uniqueKoshaReferences
      .map((item) => ({
        item,
        authorityLabel: "KOSHA 실행지침",
        controls: extractableKoshaClaims(item),
      })),
  ];
  for (const { item: reference, authorityLabel, controls } of references) {
    const sourceLabel = reference.kosha_guide?.evidenceRef?.trim() || reference.title.trim();
    const label = sourceLabel ? `${authorityLabel}: ${sourceLabel}` : "";
    if (!label) continue;
    const citationId = `citation:${createHash("sha256")
      .update(canonicalJson({ id: reference.id, label }), "utf8")
      .digest("hex")}`;
    for (const control of controls) {
      const text = control.trim();
      if (!text) continue;
      const claimId = `claim:${createHash("sha256")
          .update(canonicalJson({ citationId, text }), "utf8")
          .digest("hex")}`;
      claims.set(claimId, {
        claimId,
        text,
        citations: [{ citationId, label }],
      });
    }
  }
  return deepFreeze([...claims.values()]);
}

function renderAttestedClaims(
  output: HermesPlannerTextOutput,
  evidenceDigest: string,
  evidenceClaims: readonly HermesEvidenceClaim[],
): string {
  const attestation = output.attestation;
  if (!isRecord(attestation)
    || attestation.schemaVersion !== HERMES_OUTPUT_ATTESTATION_VERSION
    || attestation.evidenceDigest !== evidenceDigest
    || !Array.isArray(attestation.claims)
    || attestation.claims.length === 0) {
    throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
  }
  const allowlist = new Map(evidenceClaims.map((claim) => [claim.claimId, claim]));
  const rendered: string[] = [];
  const seenClaims = new Set<string>();
  for (const selected of attestation.claims) {
    if (!isRecord(selected)
      || typeof selected.claimId !== "string"
      || seenClaims.has(selected.claimId)
      || !Array.isArray(selected.citationIds)
      || selected.citationIds.length === 0
      || selected.citationIds.some((id) => typeof id !== "string")) {
      throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
    }
    const claim = allowlist.get(selected.claimId);
    const allowedCitations = new Map(claim?.citations.map((citation) => [citation.citationId, citation]));
    if (!claim
      || new Set(selected.citationIds).size !== selected.citationIds.length
      || selected.citationIds.some((id) => !allowedCitations.has(id))) {
      throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
    }
    seenClaims.add(selected.claimId);
    rendered.push(`${claim.text} [${selected.citationIds
      .map((id) => allowedCitations.get(id)?.label)
      .join(", ")}]`);
  }
  return rendered.join("\n");
}

function readEvidencePacket(
  result: unknown,
  expectedQuestion: string,
  trustedKoshaReference?: (item: SafetyReferenceItem) => boolean,
): DbHarnessPacket {
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
    || ![...directEvidence, ...supportingEvidence].some((item) => (
      isGroundedKoshaReference(item, trustedKoshaReference)
    ))
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
      let evidenceClaims: readonly HermesEvidenceClaim[];
      try {
        const harnessResult = await dependencies.composition.readExecutor.execute({
          context: input.context,
          toolName: "run_safeclaw_harness_agent",
          input: { question: input.prompt },
          signal: input.signal,
        });
        const validatedPacket = readEvidencePacket(
          harnessResult,
          normalizePrompt(input.prompt),
          dependencies.composition.trustedKoshaReference,
        );
        evidencePacket = deepFreeze(structuredClone(validatedPacket));
        evidenceDigest = digestEvidencePacket(evidencePacket);
        evidenceClaims = buildEvidenceClaims(
          validatedPacket,
          dependencies.composition.trustedKoshaReference,
        );
        if (evidenceClaims.length === 0) {
          throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
        }
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
        evidenceDigest,
        evidenceClaims,
        emitText: (output) => {
          if (typeof output !== "object"
            || output === null
            || !isRecord(output.evidencePacket)
            || output.evidencePacket === evidencePacket
            || !isRecursivelyFrozen(output.evidencePacket)) {
            throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
          }
          const expectedQuestion = normalizePrompt(input.prompt);
          if (output.evidencePacket.question !== expectedQuestion
            || digestEvidencePacket(evidencePacket) !== evidenceDigest
            || digestEvidencePacket(output.evidencePacket) !== evidenceDigest) {
            throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
          }
          input.emit({
            kind: "text-delta",
            text: renderAttestedClaims(output, evidenceDigest, evidenceClaims),
          });
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
