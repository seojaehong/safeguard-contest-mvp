import { describe, expect, it } from "vitest";

import { buildDbHarnessPacket, type DbHarnessPacket, type HarnessImprovement } from "@/lib/db-harness";
import { buildMockAskResponse } from "@/lib/mock-data";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";
import type { AskResponse } from "@/lib/types";
import {
  buildWorkspaceOperationMemoryGraph,
  buildWorkspaceOperationMemoryInput
} from "@/lib/workspace-operation-graph";

function reference(overrides: Partial<SafetyReferenceItem> = {}): SafetyReferenceItem {
  return {
    id: "sif-workspace-001",
    source_id: "sif",
    item_type: "sif-case",
    category: "건설",
    subcategory: "외벽",
    title: "이동식 비계 외벽 도장 추락 사례",
    summary: "외벽 도장 중 이동식 비계 단부 방호가 미흡해 추락 위험이 확인된 사례",
    keywords: ["외벽", "도장", "비계"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표", "TBM 브리핑"],
    controls: ["단부 난간 설치", "강풍 시 작업중지 기준 공유"],
    evidence_role: "direct",
    reflected_documents: ["TBM 기록"],
    retrieval_source: "ranked",
    ...overrides
  };
}

function improvement(overrides: Partial<HarnessImprovement> = {}): HarnessImprovement {
  return {
    id: "photo-improvement-001",
    taskLabel: "성수동 외벽 도장",
    hazardLabel: "추락",
    improvementText: "Before 사진의 난간 누락 구간을 보강하고 After 사진에서 출입통제선을 확인",
    reflectedDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    sourceType: "photo_analysis",
    visionStatus: "analyzed",
    analysisMode: "vision_ocr",
    photoPairAttached: true,
    visionUserLabel: "vision/OCR 분석 완료",
    visionSummary: "난간 보강과 출입통제선이 확인됩니다.",
    detectedHazards: ["추락", "하부 통제 미흡"],
    observedImprovement: "작업발판 외측 난간 보강",
    sourcePhotoNames: ["before.jpg", "after.jpg"],
    ...overrides
  };
}

function attachDbHarness(response: AskResponse, packet: DbHarnessPacket): AskResponse {
  return {
    ...response,
    dbHarness: {
      packet,
      promptContext: "DB 하네스가 고정한 근거를 LLM이 문장화만 합니다.",
      summary: {
        mode: packet.mode,
        llmRole: packet.generationContract.llmRole,
        llmOutputScope: packet.generationContract.llmOutputScope,
        evidenceAuthority: packet.generationContract.evidenceAuthority,
        providerRetryScope: packet.generationContract.providerRetryScope,
        fallbackChainAllowed: packet.generationContract.fallbackChainAllowed,
        genericProseSubstitutionAllowed: packet.generationContract.genericProseSubstitutionAllowed,
        missingEvidencePolicy: packet.generationContract.missingEvidencePolicy,
        directEvidence: packet.directEvidence.length,
        sifCases: packet.sifCases.length,
        supportingEvidence: packet.supportingEvidence.length,
        improvementMemory: packet.improvementMemory.length,
        workpackMemory: packet.workpackMemory.length,
        missingEvidence: packet.generationContract.missingEvidence,
        documentCoverage: packet.generationContract.documentCoverage,
        retrievalContract: packet.retrievalContract,
        ontologyStatus: packet.ontologyChecklist.status
      }
    }
  };
}

describe("buildWorkspaceOperationMemoryGraph", () => {
  it("turns the current AskResponse DB harness packet into an operation graph", () => {
    const packet = buildDbHarnessPacket({
      question: "성수동 외벽 도장 작업",
      references: [reference()],
      improvements: [improvement()],
      workpackMemory: [
        {
          id: "wp-previous-001",
          question: "지난주 성수동 외벽 보수 작업",
          generatedAt: "2026-07-02T09:00:00.000Z",
          reflectedDocuments: ["위험성평가표", "TBM 기록"],
          statusLabel: "난간 보강 개선 반영"
        }
      ]
    });
    const response = attachDbHarness(
      buildMockAskResponse("성수동 외벽 도장 작업", [], "mock", "test"),
      packet
    );

    const graph = buildWorkspaceOperationMemoryGraph(response, {
      workpackId: "wp-current-001",
      generatedAt: "2026-07-09T09:00:00.000Z"
    });

    expect(graph.summary).toMatchObject({
      workpackId: "wp-current-001",
      evidenceCount: 1,
      improvementCount: 1,
      ackCount: 0,
      relatedWorkpackCount: 1
    });
    expect(graph.nodes.map((node) => node.kind)).toEqual(expect.arrayContaining([
      "Workpack",
      "Evidence",
      "Hazard",
      "Control",
      "Improvement"
    ]));
    expect(graph.edges.map((edge) => edge.relation)).toEqual(expect.arrayContaining([
      "similarWorkpack",
      "usesEvidence",
      "mentionsHazard",
      "mitigatedBy",
      "hasImprovement",
      "addressesHazard"
    ]));
    expect(graph.nodes.find((node) => node.id.includes("photo-improvement-001"))?.meta).toMatchObject({
      sourceType: "photo_analysis",
      photoPairAttached: true,
      sourcePhotos: "before.jpg, after.jpg"
    });
  });

  it("keeps read confirmations empty until the share acknowledgement flow creates them", () => {
    const packet = buildDbHarnessPacket({
      question: "부산 밀폐공간 누수 점검",
      references: [reference({ id: "confined-space-001", risk_tags: ["질식"], controls: ["산소농도 측정", "감시인 배치"] })],
      improvements: []
    });
    const response = attachDbHarness(
      buildMockAskResponse("부산 밀폐공간 누수 점검", [], "mock", "test"),
      packet
    );

    const withoutAck = buildWorkspaceOperationMemoryGraph(response, {
      workpackId: null,
      generatedAt: "2026-07-09T10:00:00.000Z"
    });
    const withAck = buildWorkspaceOperationMemoryGraph(response, {
      workpackId: "wp-confined-001",
      generatedAt: "2026-07-09T10:00:00.000Z",
      confirmations: [
        { displayName: "Nguyen", languageCode: "vi", readAt: "2026-07-09T10:20:00.000Z" }
      ]
    });

    expect(withoutAck.summary.ackCount).toBe(0);
    expect(withoutAck.edges.some((edge) => edge.relation === "confirmedBy")).toBe(false);
    expect(withAck.summary.ackCount).toBe(1);
    expect(withAck.edges.some((edge) => edge.relation === "confirmedBy")).toBe(true);
  });

  it("deduplicates repeated past workpack memory before graph construction", () => {
    const packet = buildDbHarnessPacket({
      question: "외벽 도장 작업",
      references: [],
      improvements: [],
      workpackMemory: [
        {
          id: "wp-dup",
          question: "과거 외벽 도장",
          generatedAt: "2026-07-01T09:00:00.000Z",
          reflectedDocuments: ["TBM 기록"],
          statusLabel: "반복 개선"
        },
        {
          id: "wp-dup",
          question: "과거 외벽 도장",
          generatedAt: "2026-07-01T09:00:00.000Z",
          reflectedDocuments: ["TBM 기록"],
          statusLabel: "반복 개선"
        }
      ]
    });
    const response = attachDbHarness(
      buildMockAskResponse("외벽 도장 작업", [], "mock", "test"),
      packet
    );

    const input = buildWorkspaceOperationMemoryInput(response, {
      workpackId: "wp-current",
      generatedAt: "2026-07-09T09:00:00.000Z"
    });

    expect(input.relatedWorkpacks).toHaveLength(1);
  });
});
