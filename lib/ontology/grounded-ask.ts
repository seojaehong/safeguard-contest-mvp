import { createLogger } from "@/lib/logger";
import { runAsk, type RunAskOptions } from "@/lib/search";
import {
  buildPhaseAGenerationGrounding,
  type PhaseAGenerationGrounding,
} from "@/lib/ontology/evidence-chain";
import type { OntologyGraph } from "@/lib/ontology/graph-store";
import {
  OntologyKnowledgeUnavailableError,
  resolveSafetyKnowledgeSnapshot,
} from "@/lib/ontology/knowledge-tool";
import {
  isOntologyDeadlineError,
  withOntologyDeadline,
} from "@/lib/ontology/deadline";
import { resolvePhaseAGroundingTimeoutMs } from "@/lib/ontology-deadline-policy";

const log = createLogger("ontology-grounded-ask");
export type PhaseAGroundingResolution = {
  phaseAGrounding: PhaseAGenerationGrounding;
  graphSnapshot: OntologyGraph | null;
};

export type ResolvePhaseAGroundingOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type RunPhaseAGroundedAskOptions = Omit<
  RunAskOptions,
  "phaseAGrounding" | "phaseAGraphSnapshot"
> & {
  phaseAGroundingTimeoutMs?: number;
  phaseAGroundingSignal?: AbortSignal;
};

function groundingErrorCode(error: unknown): string {
  if (isOntologyDeadlineError(error)) return error.code;
  if (error instanceof OntologyKnowledgeUnavailableError) return error.code;
  return "ontology_lookup_failed";
}

export async function resolvePhaseAGroundingSnapshot(
  question: string,
  options: ResolvePhaseAGroundingOptions = {},
): Promise<PhaseAGroundingResolution> {
  const timeoutMs = resolvePhaseAGroundingTimeoutMs(
    options.timeoutMs,
    process.env.PHASE_A_GROUNDING_TIMEOUT_MS,
  );
  try {
    const snapshot = await withOntologyDeadline(
      (signal) => resolveSafetyKnowledgeSnapshot(question, { signal, timeoutMs }),
      { timeoutMs, signal: options.signal },
    );
    return {
      phaseAGrounding: buildPhaseAGenerationGrounding({
        evidenceChainState: snapshot.evidence.evidenceChainState,
        evidencePack: snapshot.evidence.found ? snapshot.evidence.evidenceContract : null,
      }),
      graphSnapshot: snapshot.graphSnapshot,
    };
  } catch (error) {
    log.error("Phase A ontology lookup unavailable; using explicit missing grounding", {
      errorType: error instanceof Error ? error.name : typeof error,
      errorCode: groundingErrorCode(error),
    });
    return {
      phaseAGrounding: buildPhaseAGenerationGrounding({
        evidenceChainState: "not_evaluated",
        evidencePack: null,
      }),
      graphSnapshot: null,
    };
  }
}

export async function resolvePhaseAGrounding(
  question: string,
  options: ResolvePhaseAGroundingOptions = {},
): Promise<PhaseAGenerationGrounding> {
  return (await resolvePhaseAGroundingSnapshot(question, options)).phaseAGrounding;
}

export async function runPhaseAGroundedAsk(
  question: string,
  options: RunPhaseAGroundedAskOptions = {},
) {
  const {
    phaseAGroundingTimeoutMs,
    phaseAGroundingSignal,
    ...runAskOptions
  } = options;
  const resolution = await resolvePhaseAGroundingSnapshot(question, {
    timeoutMs: phaseAGroundingTimeoutMs,
    signal: phaseAGroundingSignal,
  });
  return runAsk(question, {
    ...runAskOptions,
    phaseAGrounding: resolution.phaseAGrounding,
    phaseAGraphSnapshot: resolution.graphSnapshot,
  });
}
