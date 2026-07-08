import { describe, expect, it } from "vitest";

import type { HarnessImprovement } from "@/lib/db-harness";
import { buildOperationMemoryGraph } from "@/lib/ontology/operation-memory";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";

function reference(overrides: Partial<SafetyReferenceItem> = {}): SafetyReferenceItem {
  return {
    id: "sif-001",
    source_id: "sif",
    item_type: "sif-case",
    category: "추락",
    subcategory: null,
    title: "외벽 도장 중 이동식 비계 추락 사례",
    summary: "비계 작업발판 난간 미설치로 추락 위험이 발생한 사례",
    keywords: ["외벽", "비계"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표", "TBM 브리핑"],
    controls: ["작업발판 난간 설치", "강풍 시 작업중지 기준 공유"],
    evidence_role: "direct",
    reflected_documents: ["위험성평가표"],
    ...overrides
  };
}

const photoImprovement: HarnessImprovement = {
  id: "improvement-001",
  taskLabel: "외벽 도장",
  hazardLabel: "추락",
  improvementText: "작업 전 난간 누락 구간을 보강하고 접근 금지선을 설치함",
  reflectedDocuments: ["TBM 기록"],
  sourceType: "photo_analysis",
  visionStatus: "analyzed",
  visionModel: "gpt-4.1-mini",
  visionSummary: "before 사진에서 난간 누락, after 사진에서 보강 완료 확인",
  detectedHazards: ["추락", "낙하물"],
  observedImprovement: "난간과 출입통제 라인이 추가됨"
};

describe("buildOperationMemoryGraph", () => {
  it("connects workpack, evidence, hazard, control, improvement, and ack nodes", () => {
    const graph = buildOperationMemoryGraph({
      workpack: {
        id: "wp-001",
        question: "성수동 외벽 도장 작업",
        generatedAt: "2026-07-09T00:00:00.000Z",
        taskLabel: "성수동 외벽 도장"
      },
      references: [reference()],
      improvements: [photoImprovement],
      confirmations: [
        { displayName: "김현장", languageCode: "ko", readAt: "2026-07-09T08:20:00.000Z" }
      ]
    });

    expect(graph.summary).toMatchObject({
      workpackId: "wp-001",
      hazardCount: 1,
      controlCount: 2,
      improvementCount: 1,
      evidenceCount: 1,
      ackCount: 1,
      reflectedDocumentCount: 3
    });
    expect(graph.nodes.map((node) => node.kind)).toEqual(expect.arrayContaining([
      "Workpack",
      "Evidence",
      "Hazard",
      "Control",
      "Improvement",
      "Ack"
    ]));
    expect(graph.edges.map((edge) => edge.relation)).toEqual(expect.arrayContaining([
      "usesEvidence",
      "mentionsHazard",
      "mitigatedBy",
      "hasImprovement",
      "addressesHazard",
      "confirmedBy"
    ]));
    expect(graph.nodes.find((node) => node.kind === "Improvement")?.meta).toMatchObject({
      sourceType: "photo_analysis",
      visionStatus: "analyzed",
      visionModel: "gpt-4.1-mini"
    });
  });

  it("deduplicates hazards shared by SIF evidence and photo improvements", () => {
    const graph = buildOperationMemoryGraph({
      workpack: {
        id: "wp-002",
        question: "외벽 도장 작업",
        generatedAt: "2026-07-09T00:00:00.000Z"
      },
      references: [
        reference({ id: "sif-001", risk_tags: ["추락"] }),
        reference({ id: "kosha-001", item_type: "kosha-guide", title: "외벽 작업 안전지침", risk_tags: ["추락"] })
      ],
      improvements: [photoImprovement],
      confirmations: []
    });

    const hazards = graph.nodes.filter((node) => node.kind === "Hazard" && node.label === "추락");
    expect(hazards).toHaveLength(1);
    expect(graph.edges.filter((edge) => edge.targetId === hazards[0]?.id).length).toBeGreaterThanOrEqual(3);
  });
});
