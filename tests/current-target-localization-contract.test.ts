import { describe, expect, it, vi } from "vitest";
import { KIND_KO, NODE_KINDS } from "@/lib/ontology/schema";
import type { OperationMemoryGraph } from "@/lib/ontology/operation-memory";
import {
  buildOperationMemoryVisualizationModel,
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

  it("keeps canonical operation-memory kinds while presenting Korean user labels", () => {
    const graph = operationMemoryGraphWithTiedLabels();
    const model = buildOperationMemoryVisualizationModel(graph);

    expect(graph.nodes.map((node) => node.kind)).toContain("Ack");
    expect(model.list.map((item) => item.kind)).toContain("Ack");
    expect(operationKindLabel("Ack")).toBe("확인");
    expect(operationKindLabel("Ack")).not.toMatch(/Ack|Node/u);
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
