import { describe, expect, it, vi } from "vitest";
import { EDGE_RELS, KIND_KO, NODE_KINDS } from "@/lib/ontology/schema";
import type { OperationMemoryGraph } from "@/lib/ontology/operation-memory";
import {
  buildOperationMemoryVisualizationModel,
  ontologyRelationLabel,
  operationKindLabel
} from "@/lib/ontology/operation-memory-visualization";
import { SEED_NODES } from "@/lib/ontology/seed/core-triples";

function operationMemoryGraphWithTiedLabels(): OperationMemoryGraph {
  return {
    nodes: [
      { id: "workpack", kind: "Workpack", label: "현장 작업", meta: {} },
      { id: "hazard-a", kind: "Hazard", label: "가설 통로", meta: {} },
      { id: "hazard-b", kind: "Hazard", label: "난간 미설치", meta: {} },
      { id: "ack", kind: "Ack", label: "작업자 확인", meta: {} }
    ],
    edges: [
      { id: "workpack|mentionsHazard|hazard-a", sourceId: "workpack", targetId: "hazard-a", relation: "mentionsHazard", label: "위험" },
      { id: "workpack|mentionsHazard|hazard-b", sourceId: "workpack", targetId: "hazard-b", relation: "mentionsHazard", label: "위험" },
      { id: "workpack|confirmedBy|ack", sourceId: "workpack", targetId: "ack", relation: "confirmedBy", label: "확인" }
    ],
    summary: {
      workpackId: "workpack",
      hazardCount: 2,
      controlCount: 0,
      improvementCount: 0,
      evidenceCount: 0,
      ackCount: 1,
      relatedWorkpackCount: 0,
      reflectedDocumentCount: 0
    }
  };
}

describe("current target user-visible Korean localization", () => {
  it("keeps canonical ontology kinds at the data boundary while publishing Korean labels", () => {
    const publishedKinds = new Set([...NODE_KINDS, ...SEED_NODES.map((node) => node.kind)]);

    expect(publishedKinds).toContain("Duty");
    for (const kind of publishedKinds) {
      expect(KIND_KO[kind]).toMatch(/[가-힣]/u);
      expect(KIND_KO[kind]).not.toBe(kind);
    }
  });

  it("presents every ontology relation in Korean and neutralizes unknown values", () => {
    for (const relation of EDGE_RELS) {
      expect(ontologyRelationLabel(relation)).toMatch(/[가-힣]/u);
      expect(ontologyRelationLabel(relation)).not.toBe(relation);
    }

    expect(ontologyRelationLabel("future_relation_token")).toBe("분류 검토 필요");
  });

  it("keeps canonical operation-memory kinds while presenting Korean user labels", () => {
    const graph = operationMemoryGraphWithTiedLabels();
    const model = buildOperationMemoryVisualizationModel(graph);

    expect(graph.nodes.map((node) => node.kind)).toContain("Ack");
    expect(model.list.map((item) => item.kind)).toContain("Ack");
    expect(operationKindLabel("Ack")).toBe("확인");
    expect(operationKindLabel("Ack")).not.toMatch(/Ack|Node/u);
  });

  it("keeps canonical metadata for audit while excluding machine values from display rows", () => {
    const graph = operationMemoryGraphWithTiedLabels();
    graph.nodes.push({
      id: "improvement-known",
      kind: "Improvement",
      label: "사진 기반 개선",
      meta: {
        sourceType: "photo_analysis",
        visionStatus: "analyzed",
        analysisMode: "vision_ocr",
        photoPairAttached: true
      }
    }, {
      id: "improvement-unknown",
      kind: "Improvement",
      label: "신규 분류 개선",
      meta: {
        sourceType: "future_machine_token"
      }
    });

    const model = buildOperationMemoryVisualizationModel(graph);
    const knownCard = model.hoverCards.find((card) => card.id === "improvement-known");
    const unknownCard = model.hoverCards.find((card) => card.id === "improvement-unknown");
    const displayCorpus = [...(knownCard?.metaRows || []), ...(unknownCard?.metaRows || [])]
      .map((row) => `${row.label}: ${row.value}`)
      .join("\n");

    expect(graph.nodes.find((node) => node.id === "improvement-known")?.meta).toMatchObject({
      sourceType: "photo_analysis",
      visionStatus: "analyzed",
      analysisMode: "vision_ocr"
    });
    expect(displayCorpus).toContain("개선 전/개선 후");
    expect(displayCorpus).toContain("분류 검토 필요");
    expect(displayCorpus).not.toMatch(/photo_analysis|\banalyzed\b|vision_ocr|future_machine_token|비포\/애프터/u);
  });

  it("keeps server and client operation-memory ordering equal when locale collation differs", () => {
    const graph = operationMemoryGraphWithTiedLabels();
    const serverModel = buildOperationMemoryVisualizationModel(graph);
    const localeCompare = vi.spyOn(String.prototype, "localeCompare").mockImplementation(function compareReverse(this: string, other: string): number {
      if (this < other) return 1;
      if (this > other) return -1;
      return 0;
    });

    try {
      expect(buildOperationMemoryVisualizationModel(graph)).toEqual(serverModel);
    } finally {
      localeCompare.mockRestore();
    }
  });
});
