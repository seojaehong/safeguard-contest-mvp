import { describe, expect, it } from "vitest";

import { assembleGraph } from "@/lib/ontology/graph-store";
import { buildOntologyVisualizationModel } from "@/lib/ontology/visualization";

const MANUAL = "manual:온톨로지_시드트리플_감수용_v1";

function node(nodeId: string, kind: string, label = nodeId) {
  return {
    node_id: nodeId,
    kind,
    label,
    text_excerpt: `${label} excerpt`,
    cited_uids: [MANUAL],
    meta: {},
    review_state: "published"
  };
}

function edge(src: string, rel: string, dst: string) {
  return { src, rel, dst, cited_uids: [MANUAL], meta: {}, review_state: "published" };
}

describe("buildOntologyVisualizationModel", () => {
  it("keeps list and hover-card surfaces while adding an Obsidian-style map model", () => {
    const graph = assembleGraph(
      [
        node("Task_paint", "Task", "외벽 도장"),
        node("Hazard_fall", "Hazard", "추락"),
        node("Control_guardrail", "Control", "난간 보강"),
        node("Article_rule", "Article", "산업안전보건기준"),
        node("Document_tbm", "Document", "TBM 브리핑")
      ],
      [
        edge("Task_paint", "entailsHazard", "Hazard_fall"),
        edge("Hazard_fall", "mitigatedBy", "Control_guardrail"),
        edge("Control_guardrail", "basedOnArticle", "Article_rule"),
        edge("Task_paint", "documentedIn", "Document_tbm")
      ]
    );

    const model = buildOntologyVisualizationModel(graph);

    expect(model.list).toHaveLength(5);
    expect(model.hoverCards.find((card) => card.id === "Task_paint")?.related).toEqual(expect.arrayContaining([
      expect.objectContaining({ rel: "entailsHazard", direction: "outgoing", targetId: "Hazard_fall" }),
      expect.objectContaining({ rel: "documentedIn", direction: "outgoing", targetId: "Document_tbm" })
    ]));
    expect(model.hoverCards.find((card) => card.id === "Hazard_fall")?.related).toEqual(expect.arrayContaining([
      expect.objectContaining({
        rel: "entailsHazard",
        direction: "incoming",
        sourceId: "Task_paint",
        sourceLabel: "외벽 도장"
      }),
      expect.objectContaining({
        rel: "mitigatedBy",
        direction: "outgoing",
        targetId: "Control_guardrail",
        targetLabel: "난간 보강"
      })
    ]));
    expect(model.hoverCards.find((card) => card.id === "Hazard_fall")?.excerpt).toBe("추락 excerpt");
    expect(model.map.nodes.map((item) => item.id)).toContain("Task_paint");
    expect(model.map.edges.map((item) => item.id)).toContain("Task_paint|entailsHazard|Hazard_fall");
    expect(model.map.nodes.every((item) => item.x >= 7 && item.x <= 93 && item.y >= 7 && item.y <= 93)).toBe(true);
  });

  it("bounds the visual map without removing the full list ontology", () => {
    const rawNodes = Array.from({ length: 42 }, (_, index) =>
      node(`Task_${String(index).padStart(2, "0")}`, "Task", `작업 ${index}`)
    );
    const rawEdges = rawNodes.slice(1).map((item) => edge(rawNodes[0].node_id, "relatedTo", item.node_id));
    const graph = assembleGraph(rawNodes, rawEdges);

    const model = buildOntologyVisualizationModel(graph);

    expect(model.list).toHaveLength(42);
    expect(model.map.nodes).toHaveLength(32);
    expect(model.map.edges.length).toBeLessThanOrEqual(72);
  });
});
