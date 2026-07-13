import { createLogger } from "@/lib/logger";
import { runAsk, type RunAskOptions } from "@/lib/search";
import {
  buildPhaseAGenerationGrounding,
  type PhaseAGenerationGrounding,
} from "@/lib/ontology/evidence-chain";
import { querySafetyKnowledge } from "@/lib/ontology/knowledge-tool";

const log = createLogger("ontology-grounded-ask");

export async function resolvePhaseAGrounding(
  question: string,
): Promise<PhaseAGenerationGrounding> {
  try {
    const evidence = await querySafetyKnowledge(question);
    return buildPhaseAGenerationGrounding({
      evidenceChainState: evidence.evidenceChainState,
      evidencePack: evidence.found ? evidence.evidenceContract : null,
    });
  } catch (error) {
    log.error("Phase A ontology lookup unavailable; using explicit missing grounding", {
      errorType: error instanceof Error ? error.name : typeof error,
    });
    return buildPhaseAGenerationGrounding({
      evidenceChainState: "not_evaluated",
      evidencePack: null,
    });
  }
}

export async function runPhaseAGroundedAsk(
  question: string,
  options: Omit<RunAskOptions, "phaseAGrounding"> = {},
) {
  const phaseAGrounding = await resolvePhaseAGrounding(question);
  return runAsk(question, { ...options, phaseAGrounding });
}
