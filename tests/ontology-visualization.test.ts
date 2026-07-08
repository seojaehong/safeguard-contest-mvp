import { describe, expect, it } from "vitest";

import { assembleGraph } from "@/lib/ontology/graph-store";
import { buildOntologyVisualizationModel } from "@/lib/ontology/visualization";

const CITED = ["manual:온톨로지_시드트리플_감수용_v1"];

function node(nodeId: string, kind: string, label: string) {
  return {
    node_id: nodeId,
    kind,
    label,
    text_excerpt: null,
    cited_uids: CITED,
    meta: {},
    review_state: "published"
  };
}

function edge(src: string, rel: string, dst: string) {
  return { src, rel, dst, cited_uids: CITED, meta: {}, review_state: "published" };
}

describe("ontology visualization model", () => {
  it("creates list rows and hover cards from a published graph", () => {
    const graph = assembleGraph(
      [
        node("Task_paint", "Task", "외벽 도장"),
        node("Hazard_fall", "Hazard", "추락"),
        node("Control_guardrail", "Control", "난간 보강")
      ],
      [
        edge("Task_paint", "entailsHazard", "Hazard_fall"),
        edge("Hazard_fall", "mitigatedBy", "Control_guardrail")
      ]
    );

    const model = buildOntologyVisualizationModel(graph);
    const task = model.hoverCards.find((card) => card.id === "Task_paint");

    expect(model.list).toHaveLength(3);
    expect(model.list.find((item) => item.id === "Hazard_fall")?.incomingCount).toBe(1);
    expect(task?.subtitle).toBe("작업");
    expect(task?.related[0]).toMatchObject({
      rel: "entailsHazard",
      targetId: "Hazard_fall",
      targetLabel: "추락"
    });
  });
});
