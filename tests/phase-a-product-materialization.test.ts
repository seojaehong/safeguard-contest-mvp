import { describe, expect, test } from "vitest";

import { buildDocpackResult } from "@/lib/mcp-tools";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import {
  buildPhaseAProductMaterialization,
  materializePhaseAProductDocuments,
} from "@/lib/ontology/product-materialization";
import { assembleGraph } from "@/lib/ontology/graph-store";
import { buildPublishedSafetyKnowledge } from "@/lib/ontology/knowledge-tool";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";

const publishedGraph = assembleGraph(
  SEED_NODES.filter((node) => node.review_state === "published"),
  SEED_EDGES.filter((edge) => edge.review_state === "published"),
);

const cases = [
  {
    input: "고소작업",
    chainId: "work-at-height-fall",
    taskNodeId: "Task_work_at_height",
    hazardNodeId: "Hazard_추락",
    sifCount: 2,
    controlCount: 3,
  },
  {
    input: "지게차 상하차",
    chainId: "vehicle-machinery-entrapment",
    taskNodeId: "Task_forklift_loading",
    hazardNodeId: "Hazard_충돌_협착_끼임",
    sifCount: 2,
    controlCount: 1,
  },
  {
    input: "전기 작업",
    chainId: "electrical-work-electrocution",
    taskNodeId: "Task_electrical_work",
    hazardNodeId: "Hazard_감전_직접_간접_접촉",
    sifCount: 3,
    controlCount: 5,
  },
] as const;

describe("Phase A product materialization", () => {
  test.each(cases)(
    "connects $chainId retrieval provenance to review-required document rows",
    ({ input, chainId, taskNodeId, hazardNodeId, sifCount, controlCount }) => {
      const knowledge = buildPublishedSafetyKnowledge(publishedGraph, input);

      expect(knowledge.found).toBe(true);
      if (!knowledge.found || !knowledge.phaseAProduct) {
        throw new Error(`expected Phase A product evidence for ${input}`);
      }

      const product = knowledge.phaseAProduct;
      expect(product).toMatchObject({
        schemaVersion: "phase-a-product-materialization/v1",
        chainId,
        evidenceChainState: "review_required",
        authorityState: "review_required",
        task: { nodeId: taskNodeId },
        hazard: { nodeId: hazardNodeId },
      });
      expect(product.accidents).toHaveLength(sifCount);
      expect(product.controls).toHaveLength(controlCount);
      expect(product.documentRows).toHaveLength(controlCount * 2);
      expect(product.verifiedDocumentRows).toEqual([]);
      expect(product.controls.every((control) => control.classification === "review_required")).toBe(true);
      expect(product.documentRows.every((row) => row.classification === "review_required")).toBe(true);
      expect(product.documentRows.every((row) => row.verificationStatus === "review_required")).toBe(true);

      for (const row of product.documentRows) {
        expect(row.provenance.taskNodeId).toBe(taskNodeId);
        expect(row.provenance.sifAccidentCitedUids).toHaveLength(sifCount);
        expect(row.provenance.hazardNodeId).toBe(hazardNodeId);
        expect(row.provenance.controlNodeId).toMatch(/^Control_/);
        expect(row.provenance.lawCitedUids.length).toBeGreaterThan(0);
        expect(row.provenance.articleNodeIds.every((nodeId) => nodeId.startsWith("Article_"))).toBe(true);
      }

      const response = materializePhaseAProductDocuments(
        buildMockAskResponse(input, mockSearchResults.slice(0, 3), "mock", "Phase A materialization test"),
        product,
      );
      const docpack = buildDocpackResult(response, true);
      const riskDocument = docpack.documents.riskAssessmentDraft;
      const tbmDocument = docpack.documents.tbmBriefing;

      expect(docpack.phaseAProduct).toEqual(product);
      expect(typeof riskDocument).toBe("string");
      expect(typeof tbmDocument).toBe("string");
      if (typeof riskDocument !== "string" || typeof tbmDocument !== "string") {
        throw new Error("expected full Phase A documents");
      }
      for (const row of product.documentRows) {
        const document = row.document === "risk_assessment" ? riskDocument : tbmDocument;
        expect(document).toContain(row.stableKey);
        expect(document).toContain(row.provenance.taskNodeId);
        expect(document).toContain(row.provenance.hazardNodeId);
        expect(document).toContain(row.provenance.controlNodeId);
        for (const citedUid of row.provenance.sifAccidentCitedUids) {
          expect(document).toContain(citedUid);
        }
        for (const citedUid of row.provenance.lawCitedUids) {
          expect(document).toContain(citedUid);
        }
      }
      expect(response.structured?.riskAssessmentRows.slice(-controlCount)).toHaveLength(controlCount);
      expect(
        response.structured?.riskAssessmentRows
          .slice(-controlCount)
          .every((row) => row.verificationStatus === "needsReview"),
      ).toBe(true);
      expect(response.structured?.riskAssessmentValidation.ok).toBe(true);
    },
  );

  test("fails closed when a caller labels draft and unresolved sources as resolved", () => {
    const knowledge = buildPublishedSafetyKnowledge(publishedGraph, "고소작업");
    expect(knowledge.found).toBe(true);
    if (!knowledge.found || !knowledge.evidenceContract) {
      throw new Error("expected assembled evidence contract");
    }

    const forged = buildPhaseAProductMaterialization({
      evidenceChainState: "resolved",
      evidencePack: structuredClone(knowledge.evidenceContract),
    });

    expect(forged).not.toBeNull();
    expect(forged?.evidenceChainState).toBe("review_required");
    expect(forged?.authorityState).toBe("review_required");
    expect(forged?.verifiedDocumentRows).toEqual([]);
    expect(forged?.controls.every((control) => control.classification === "review_required")).toBe(true);
  });

  test("materialization is idempotent by stable document row key", () => {
    const knowledge = buildPublishedSafetyKnowledge(publishedGraph, "전기 작업");
    expect(knowledge.found).toBe(true);
    if (!knowledge.found || !knowledge.phaseAProduct) {
      throw new Error("expected electrical Phase A product evidence");
    }
    const original = buildMockAskResponse(
      "전기 작업",
      mockSearchResults.slice(0, 3),
      "mock",
      "Phase A idempotency test",
    );

    const once = materializePhaseAProductDocuments(original, knowledge.phaseAProduct);
    const twice = materializePhaseAProductDocuments(once, knowledge.phaseAProduct);

    expect(twice.deliverables.riskAssessmentDraft).toBe(once.deliverables.riskAssessmentDraft);
    expect(twice.deliverables.tbmBriefing).toBe(once.deliverables.tbmBriefing);
    expect(twice.structured?.riskAssessmentRows).toEqual(once.structured?.riskAssessmentRows);
  });
});
