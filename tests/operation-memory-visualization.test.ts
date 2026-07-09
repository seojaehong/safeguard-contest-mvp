import { describe, expect, it } from "vitest";

import type { HarnessImprovement } from "@/lib/db-harness";
import { buildOperationMemoryGraph } from "@/lib/ontology/operation-memory";
import { buildOperationMemoryVisualizationModel } from "@/lib/ontology/operation-memory-visualization";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";
import { buildWorkpackLearningFile } from "@/lib/workpack-learning-export";

function reference(): SafetyReferenceItem {
  return {
    id: "sif-visual-1",
    source_id: "sif",
    item_type: "sif-case",
    category: "건설",
    subcategory: null,
    title: "외벽 도장 중 이동식 비계 추락 사례",
    summary: "작업발판 난간 상태 미확인으로 추락 위험이 확인된 사례",
    keywords: ["외벽", "도장"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표", "TBM 브리핑"],
    controls: ["작업발판 난간 보강", "강풍 시 작업중지 기준 공유"],
    evidence_role: "direct",
    reflected_documents: ["TBM 기록"]
  };
}

function improvement(id = "imp-visual-1"): HarnessImprovement {
  return {
    id,
    taskLabel: "성수동 외벽 도장",
    hazardLabel: "추락",
    improvementText: "난간 누락 구간 보강",
    reflectedDocuments: ["위험성평가표", "TBM 기록"],
    sourceType: "photo_analysis",
    visionStatus: "analyzed",
    analysisMode: "vision_ocr",
    photoPairAttached: true,
    visionUserLabel: "vision/OCR 분석 완료",
    visionSummary: "after 사진에서 난간 보강이 보입니다.",
    detectedHazards: ["추락"],
    observedImprovement: "작업발판 외측 난간 보강",
    ocrText: "작업중 출입금지"
  };
}

describe("buildOperationMemoryVisualizationModel", () => {
  it("turns workpack operation memory into a list, map, and hover-card model", () => {
    const graph = buildOperationMemoryGraph({
      workpack: {
        id: "wp-visual-1",
        question: "성수동 외벽 도장 작업",
        generatedAt: "2026-07-09T00:00:00.000Z",
        taskLabel: "성수동 외벽 도장"
      },
      references: [reference()],
      improvements: [improvement()],
      confirmations: [{ displayName: "Nguyen", languageCode: "vi", readAt: "2026-07-09T09:20:00.000Z" }]
    });

    const model = buildOperationMemoryVisualizationModel(graph);
    const improvementCard = model.hoverCards.find((card) => card.id.includes("imp-visual-1"));

    expect(model.list.map((item) => item.kind)).toEqual(expect.arrayContaining([
      "Workpack",
      "Evidence",
      "Hazard",
      "Control",
      "Improvement",
      "Ack"
    ]));
    expect(model.map.nodes.find((node) => node.kind === "Workpack")).toMatchObject({ x: 50, y: 50 });
    expect(model.map.edges.map((edge) => edge.rel)).toEqual(expect.arrayContaining([
      "usesEvidence",
      "hasImprovement",
      "addressesHazard",
      "confirmedBy"
    ]));
    expect(model.focusNodeId).toBe("workpack:wp-visual-1");
    expect(model.stats).toMatchObject({
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      hiddenNodes: 0,
      hiddenEdges: 0
    });
    expect(improvementCard?.metaRows).toEqual(expect.arrayContaining([
      { key: "analysisMode", label: "분석 방식", value: "vision_ocr" },
      { key: "photoPairAttached", label: "비포/애프터", value: "예" },
      { key: "visionLabel", label: "이미지 분석", value: "vision/OCR 분석 완료" }
    ]));
    expect(improvementCard?.related).toEqual(expect.arrayContaining([
      expect.objectContaining({ rel: "addressesHazard", direction: "outgoing" }),
      expect.objectContaining({ rel: "hasImprovement", direction: "incoming" })
    ]));
  });

  it("bounds only the visual map while keeping the full operation list", () => {
    const improvements = Array.from({ length: 30 }, (_, index) => improvement(`imp-${index}`));
    const graph = buildOperationMemoryGraph({
      workpack: {
        id: "wp-many",
        question: "반복 개선 작업",
        generatedAt: "2026-07-09T00:00:00.000Z"
      },
      references: [],
      improvements,
      confirmations: []
    });

    const model = buildOperationMemoryVisualizationModel(graph);

    expect(model.list.length).toBeGreaterThan(24);
    expect(model.map.nodes.length).toBeLessThanOrEqual(24);
    expect(model.map.edges.length).toBeLessThanOrEqual(48);
    expect(model.stats.hiddenNodes).toBeGreaterThan(0);
  });

  it("exports the same operation memory surface as Markdown and JSONL files", () => {
    const input = {
      workpackId: "wp-visual-1",
      question: "성수동 외벽 도장 작업",
      generatedAt: "2026-07-09T00:00:00.000Z",
      taskLabel: "성수동 외벽 도장",
      references: [reference()],
      improvements: [improvement()],
      confirmations: [{ displayName: "Nguyen", languageCode: "vi", readAt: "2026-07-09T09:20:00.000Z" }]
    };

    const markdown = buildWorkpackLearningFile(input, "markdown");
    const jsonl = buildWorkpackLearningFile(input, "jsonl");

    expect(markdown.fileName).toBe("성수동-외벽-도장-learning.md");
    expect(markdown.content).toContain("## 운영 메모리 계약");
    expect(markdown.content).toContain("authority: operator_review_corpus");
    expect(markdown.content).toContain("## 운영 그래프");
    expect(markdown.content).toContain("visionStatus: analyzed");
    expect(markdown.content).toContain("ocr: 작업중 출입금지");
    expect(jsonl.fileName).toBe("성수동-외벽-도장-learning.jsonl");
    expect(jsonl.content).toContain("\"eventType\":\"governance\"");
    expect(jsonl.content).toContain("\"authority\":\"operator_review_corpus\"");
    expect(jsonl.content).toContain("\"eventType\":\"operation_graph\"");
    expect(jsonl.content).toContain("\"eventType\":\"improvement\"");
    expect(jsonl.content).toContain("\"photoPairAttached\":true");
  });
});
