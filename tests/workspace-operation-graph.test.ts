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

  it("keeps contaminated fall-case controls out of the exterior-painting operation graph", () => {
    const question = [
      "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업.",
      "이동식 비계를 사용하고 작업자 5명 중 신규 투입자 1명이 포함된다.",
      "오후 강풍 예보가 있으며 자재 반입 지게차 동선과 작업자 통행 동선이 겹친다."
    ].join(" ");
    const packet = buildDbHarnessPacket({
      question,
      references: [
        reference({
          id: "d-c-13-exterior-painting",
          source_id: "kosha-technical-support-regulations-2025",
          item_type: "technical-support-regulation",
          title: "D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정",
          summary: "외벽 도장 보수공사의 비계, 추락방지, 작업발판 안전 기준",
          keywords: ["외벽도장", "비계", "추락"],
          risk_tags: ["추락", "비계"],
          controls: ["가동부 방호덮개 설치", "정비 전 전원 차단 및 잠금표지"],
          evidence_role: "direct"
        }),
        reference({
          id: "b-e-17-paint-fire",
          source_id: "kosha-technical-support-regulations-2025",
          item_type: "technical-support-regulation",
          title: "B-E-17-2026 도장 공정에서의 화재·폭발위험방지에 관한 기술지원규정",
          summary: "도료와 유기용제 증기 점화 방지 기준",
          keywords: ["도장", "도료", "유기용제"],
          risk_tags: ["화재", "폭발"],
          controls: ["정전도장기·피도장물 접지", "정비 전 전원 차단 및 잠금표지(LOTO)"],
          evidence_role: "direct"
        }),
        reference({
          id: "b-m-11-forklift-traffic",
          source_id: "kosha-technical-support-regulations-2025",
          item_type: "technical-support-regulation",
          title: "B-M-11-2025 지게차의 안전작업에 관한 기술지원규정",
          summary: "지게차 안전작업의 일반 원칙",
          keywords: ["지게차"],
          risk_tags: ["지게차"],
          controls: ["가동부 방호덮개 설치", "정비 전 전원 차단 및 잠금표지(LOTO)"],
          evidence_role: "direct"
        }),
        reference({
          id: "sif-archive-construction-01005",
          title: "1004 / 4. 마감공사 / 4.2 방수 작업",
          summary: "옥상 경사 지붕에서 방수작업 중 지붕 단부 아래로 추락한 사례",
          keywords: ["마감공사", "방수 작업", "지붕"],
          risk_tags: ["추락", "비계", "고소"],
          controls: [
            "작업발판·난간·개구부 상태 확인",
            "안전대 체결 및 작업반경 출입통제",
            "가동부 방호덮개 설치 및 비상정지장치 작동 확인",
            "정비 전 전원 차단 및 잠금표지(LOTO)"
          ],
          evidence_role: "supporting"
        })
      ]
    });
    const legacyFallCase = packet.sifCases.find((item) => item.id === "sif-archive-construction-01005");
    expect(legacyFallCase).toBeDefined();
    if (!legacyFallCase) return;
    legacyFallCase.controls = [
      "가동부 방호덮개 설치 및 비상정지장치 작동 확인",
      "정비 전 전원 차단 및 잠금표지(LOTO)"
    ];
    legacyFallCase.short_summary = "가동부 방호덮개 설치 · 정비 전 전원 차단 및 잠금표지(LOTO)";
    const legacyRawControls = [...legacyFallCase.controls];
    const response = attachDbHarness(
      buildMockAskResponse(question, [], "mock", "test"),
      packet
    );

    const graph = buildWorkspaceOperationMemoryGraph(response, {
      workpackId: "wp-exterior-painting",
      generatedAt: "2026-07-10T09:00:00.000Z"
    });
    const controlText = graph.nodes
      .filter((node) => node.kind === "Control")
      .map((node) => node.label)
      .join("\n");
    const evidenceDetailText = graph.nodes
      .filter((node) => node.kind === "Evidence")
      .map((node) => node.detail || "")
      .join("\n");

    expect(controlText).toMatch(/지게차.*동선|동선.*지게차/);
    expect(controlText).toMatch(/비계|작업발판|안전난간/);
    expect(controlText).toMatch(/강풍.*작업중지|작업중지.*강풍/);
    expect(controlText).toMatch(/도료|유기용제/);
    expect(controlText).toMatch(/점화원|소화기|MSDS|환기/);
    expect(controlText).not.toMatch(/방호덮개|비상정지장치|잠금표지|LOTO|정전도장|피도장물 접지/);
    expect(evidenceDetailText).not.toMatch(/방호덮개|비상정지장치|잠금표지|LOTO|정전도장|피도장물 접지/);
    expect(legacyFallCase.controls).toEqual(legacyRawControls);
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
