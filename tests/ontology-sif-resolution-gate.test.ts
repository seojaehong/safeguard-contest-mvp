import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ontology/evidence-chain-registry", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ontology/evidence-chain-registry")>();
  return {
    ...original,
    KOSHA_CORPUS_STATE: Object.freeze({
      launchReady: true,
      bodyMissingCount: 0,
      downloadProvenance: "complete",
      productionChunkBridge: "present",
    }),
  };
});

import {
  buildPhaseAGenerationGrounding,
  resolveEvidenceChain,
  verifyEvidenceMaterialization,
} from "@/lib/ontology/evidence-chain";
import { assembleGraph } from "@/lib/ontology/graph-store";
import { buildPublishedSafetyKnowledge } from "@/lib/ontology/knowledge-tool";
import * as mcpTools from "@/lib/mcp-tools";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";

const publishedGraph = assembleGraph(
  SEED_NODES.filter((node) => node.review_state === "published"),
  SEED_EDGES.filter((edge) => edge.review_state === "published"),
);

describe("Phase A SIF resolution gate", () => {
  it("keeps the chain review-required when KOSHA is ready but SIF is draft and unresolved", () => {
    const question = "차량계·기계 인접작업";
    const resolution = resolveEvidenceChain(publishedGraph, question);

    expect(resolution).toMatchObject({
      resolved: false,
      published: false,
      graphPublicationState: "published",
      inferenceState: "review_required",
      reason: "evidence_chain_review_required",
    });
    if (resolution.resolved || !("pack" in resolution)) {
      throw new Error("expected review-required pack");
    }
    expect(resolution.pack.provenance.guidanceOverlay).toMatchObject({
      launchReady: true,
      bodyMissingCount: 0,
      downloadProvenance: "complete",
      productionChunkBridge: "present",
    });
    expect(resolution.pack.hazardPriority).not.toHaveLength(0);
    expect(resolution.pack.hazardPriority.every((source) =>
      source.reviewState === "draft" && source.resolution === "unresolved"
    )).toBe(true);

    const knowledge = buildPublishedSafetyKnowledge(publishedGraph, question);
    expect(knowledge).toMatchObject({ found: true, evidenceChainState: "review_required" });
    if (!knowledge.found || !knowledge.evidenceContract) {
      throw new Error("expected review-required evidence contract");
    }
    const projector = Reflect.get(mcpTools, "buildSafetyKnowledgeCandidateResult");
    expect(typeof projector).toBe("function");
    if (typeof projector !== "function") {
      throw new Error("standalone knowledge projection is missing");
    }
    expect(projector(knowledge)).toMatchObject({
      found: true,
      authority: "review_required",
      authoritative: false,
      evidenceChainState: "review_required",
    });
    const grounding = buildPhaseAGenerationGrounding({
      evidenceChainState: knowledge.evidenceChainState,
      evidencePack: knowledge.evidenceContract,
    });
    expect(grounding).toMatchObject({
      groundingStatus: "review_required",
      allowedCitedUids: [],
      allowedEvidence: [],
      generationPolicy: { outputStatus: "review_required_draft" },
    });

    const target = knowledge.evidenceContract.materializationTargets[0];
    const lawUid = target?.lawCitedUids[0];
    if (!target || !lawUid) throw new Error("expected planned current-law materialization");
    expect(verifyEvidenceMaterialization({
      evidenceChainState: knowledge.evidenceChainState,
      pack: knowledge.evidenceContract,
      documents: {
        riskAssessmentDraft: `${target.controlLabel} | ${lawUid}`,
      },
    })).toEqual([]);
  });

  it("downgrades a caller-forced resolved state before allow-list and post-check", () => {
    const knowledge = buildPublishedSafetyKnowledge(publishedGraph, "차량계·기계 인접작업");
    if (!knowledge.found || !knowledge.evidenceContract) {
      throw new Error("expected review-required evidence contract");
    }
    const grounding = buildPhaseAGenerationGrounding({
      evidenceChainState: "resolved",
      evidencePack: knowledge.evidenceContract,
    });

    expect(grounding).toMatchObject({
      evidenceChainState: "review_required",
      groundingStatus: "review_required",
      allowedCitedUids: [],
      allowedEvidence: [],
    });
    const target = grounding.materializationTargets[0];
    const lawUid = target?.lawCitedUids[0];
    if (!grounding.evidencePack || !target || !lawUid) {
      throw new Error("expected planned current-law materialization");
    }
    expect(verifyEvidenceMaterialization({
      evidenceChainState: grounding.evidenceChainState,
      pack: grounding.evidencePack,
      documents: { riskAssessmentDraft: `${target.controlLabel} | ${lawUid}` },
    })).toEqual([]);
  });
});
