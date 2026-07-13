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
    reflected_documents: ["TBM 기록"],
    retrieval_source: "hybrid"
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
      { key: "sourceType", label: "수집 방식", value: "개선 사진 분석" },
      { key: "visionStatus", label: "이미지 상태", value: "분석 완료" },
      { key: "analysisMode", label: "분석 방식", value: "이미지·문자 인식 분석" },
      { key: "photoPairAttached", label: "개선 전/개선 후", value: "예" },
      { key: "visionLabel", label: "이미지 분석", value: "이미지·문자 인식 분석 완료" }
    ]));
    expect(improvementCard?.related).toEqual(expect.arrayContaining([
      expect.objectContaining({ rel: "addressesHazard", direction: "outgoing" }),
      expect.objectContaining({ rel: "hasImprovement", direction: "incoming" })
    ]));
  });

  it("presents every known typed metadata value without changing canonical storage", () => {
    const graph = buildOperationMemoryGraph({
      workpack: {
        id: "wp-known-metadata",
        question: "알려진 메타데이터 분류 검사",
        generatedAt: "2026-07-09T00:00:00.000Z"
      },
      references: [],
      improvements: [improvement("imp-known-metadata")],
      confirmations: []
    });
    const node = graph.nodes.find((item) => item.kind === "Improvement");
    if (!node) throw new Error("Expected operation-memory improvement fixture node");
    const cases = [
      ["sourceType", "manual", "수기 입력"],
      ["sourceType", "photo_analysis", "개선 사진 분석"],
      ["sourceType", "operator_note", "작업자 메모"],
      ["visionStatus", "analyzed", "분석 완료"],
      ["visionStatus", "unconfigured", "분석 설정 필요"],
      ["visionStatus", "failed", "분석 실패"],
      ["analysisMode", "vision_ocr", "이미지·문자 인식 분석"],
      ["analysisMode", "photo_pair_unanalyzed", "개선 전/개선 후 사진 미분석"],
      ["analysisMode", "manual_text", "수기 입력"],
      ["itemType", "sif-case", "중대위험 사례"],
      ["itemType", "technical-guideline", "기술 지침"],
      ["itemType", "technical-support-regulation", "기술지원 규정"],
      ["itemType", "machinery", "기계 안전 자료"],
      ["itemType", "kosha-guide", "KOSHA 가이드"],
      ["itemType", "guide", "안전 가이드"],
      ["itemType", "guideline", "안전 지침"],
      ["itemType", "source", "원문 근거"],
      ["evidenceRole", "direct", "직접 근거"],
      ["evidenceRole", "supporting", "보조 근거"],
      ["source", "safety_reference_items", "안전 근거 카탈로그"],
      ["source", "manual", "수기 입력"],
      ["source", "photo_analysis", "개선 사진 분석"],
      ["source", "operator_note", "작업자 메모"],
      ["languageCode", "ko", "한국어"],
      ["languageCode", "vi", "베트남어"],
      ["languageCode", "zh", "중국어"],
      ["languageCode", "mn", "몽골어"],
      ["languageCode", "th", "태국어"],
      ["languageCode", "tl", "타갈로그어"],
      ["languageCode", "uz", "우즈베크어"],
      ["languageCode", "km", "크메르어"],
      ["languageCode", "id", "인도네시아어"],
      ["languageCode", "ne", "네팔어"],
      ["visionLabel", "vision/OCR 분석 완료", "이미지·문자 인식 분석 완료"],
      ["visionLabel", "수기 개선사항", "수기 개선사항"],
      ["visionModel", "gpt-4.1-mini", "이미지 분석 모델"],
      ["visionModel", "gemini-2.5-flash", "이미지 분석 모델"]
    ] as const;

    for (const [key, value, expected] of cases) {
      node.meta = { [key]: value };
      const row = buildOperationMemoryVisualizationModel(graph)
        .hoverCards.find((card) => card.id === node.id)
        ?.metaRows[0];
      expect(row?.value, `${key}=${value}`).toBe(expected);
      expect(node.meta[key], `${key} canonical`).toBe(value);
      if (value !== expected) expect(row?.value).not.toBe(value);
    }
  });

  it("uses a neutral display label for unknown metadata without changing canonical values", () => {
    const graph = buildOperationMemoryGraph({
      workpack: {
        id: "wp-unknown-metadata",
        question: "알 수 없는 분석 분류 검사",
        generatedAt: "생성 시각 확인 전"
      },
      references: [],
      improvements: [improvement("imp-unknown-metadata")],
      confirmations: []
    });
    const improvementNode = graph.nodes.find((node) => node.kind === "Improvement");
    const workpackNode = graph.nodes.find((node) => node.kind === "Workpack");
    if (!improvementNode || !workpackNode) throw new Error("Expected operation-memory fixture nodes");
    improvementNode.meta.sourceType = "future_machine_token";
    improvementNode.meta.analysisMode = "future_analysis_mode";
    workpackNode.meta.future_metadata_key = "future_metadata_value";

    const model = buildOperationMemoryVisualizationModel(graph);
    const card = model.hoverCards.find((item) => item.id === improvementNode.id);
    const generatedAt = model.hoverCards
      .find((item) => item.id === workpackNode.id)
      ?.metaRows.find((row) => row.key === "generatedAt");
    const unknownMetadata = model.hoverCards
      .find((item) => item.id === workpackNode.id)
      ?.metaRows.find((row) => row.key === "reviewRequired");

    expect(improvementNode.meta).toMatchObject({
      sourceType: "future_machine_token",
      analysisMode: "future_analysis_mode"
    });
    expect(workpackNode.meta.future_metadata_key).toBe("future_metadata_value");
    expect(card?.metaRows).toEqual(expect.arrayContaining([
      { key: "sourceType", label: "수집 방식", value: "분류 검토 필요" },
      { key: "analysisMode", label: "분석 방식", value: "분류 검토 필요" }
    ]));
    expect(workpackNode.meta.generatedAt).toBeNull();
    expect(generatedAt).toEqual({ key: "generatedAt", label: "생성 시각", value: "생성 시각 확인 전" });
    expect(unknownMetadata).toEqual({
      key: "reviewRequired",
      label: "분류 검토 필요",
      value: "분류 검토 필요"
    });
    expect(JSON.stringify(model.hoverCards)).not.toMatch(/future_metadata_key|future_metadata_value/u);
  });

  it("keeps fire controls and energy isolation visible in evidence and control nodes", () => {
    const maintenanceFire: SafetyReferenceItem = {
      ...reference(),
      id: "sif-forklift-maintenance-fire-graph",
      title: "LPG 지게차 연료계통 정비 중 화재·폭발 사례",
      summary: "지게차 연료계통을 수리하던 중 잔류 가스가 누출되고 점화원과 접촉해 화재가 발생",
      keywords: ["지게차", "정비", "연료 누출", "화재", "폭발", "LOTO"],
      risk_tags: ["지게차", "화재", "폭발"],
      controls: ["충전 구역 환기", "정비 전 전원 차단 및 잠금표지(LOTO)"]
    };
    const graph = buildOperationMemoryGraph({
      workpack: {
        id: "wp-maintenance-fire",
        question: "LPG 지게차 연료계통 정비 작업",
        generatedAt: "2026-07-10T00:00:00.000Z"
      },
      references: [maintenanceFire],
      improvements: [],
      confirmations: []
    });
    const evidence = graph.nodes.find((node) => node.kind === "Evidence");
    const controlText = graph.nodes
      .filter((node) => node.kind === "Control")
      .map((node) => `${node.label} ${node.detail || ""}`)
      .join(" ");

    expect(evidence?.detail).toMatch(/연료|가스|누출/);
    expect(evidence?.detail).toMatch(/환기|점화원|소화기/);
    expect(evidence?.detail).toMatch(/차단|잠금표지|LOTO/);
    expect(controlText).toMatch(/차단|잠금표지|LOTO/);
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

    expect(model.list.length).toBe(graph.nodes.length);
    expect(model.list.length).toBeGreaterThan(24);
    expect(model.map.nodes.length).toBeLessThanOrEqual(9);
    expect(model.map.edges.length).toBeLessThanOrEqual(48);
    expect(model.map.edges.length).toBe(model.stats.visibleEdges);
    expect(model.map.edges.every((edge) => edge.x1 !== edge.x2 || edge.y1 !== edge.y2)).toBe(true);
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
    const obsidian = buildWorkpackLearningFile(input, "obsidian");

    expect(markdown.fileName).toBe("성수동-외벽-도장-learning.md");
    expect(markdown.content).toContain("## 운영 메모리 계약");
    expect(markdown.content).toContain("authority: operator_review_corpus");
    expect(markdown.content).toContain("retrieval: hybrid-vector-rpc");
    expect(markdown.content).toContain("## 운영 그래프");
    expect(markdown.content).toContain("visionStatus: analyzed");
    expect(markdown.content).toContain("ocr: 작업중 출입금지");
    expect(jsonl.fileName).toBe("성수동-외벽-도장-learning.jsonl");
    expect(jsonl.content).toContain("\"eventType\":\"governance\"");
    expect(jsonl.content).toContain("\"authority\":\"operator_review_corpus\"");
    expect(jsonl.content).toContain("\"retrievalSource\":\"hybrid\"");
    expect(jsonl.content).toContain("\"retrievalMode\":\"hybrid-vector-rpc\"");
    expect(jsonl.content).toContain("\"eventType\":\"operation_graph\"");
    expect(jsonl.content).toContain("\"eventType\":\"improvement\"");
    expect(jsonl.content).toContain("\"photoPairAttached\":true");
    expect(obsidian.fileName).toBe("성수동-외벽-도장-learning-obsidian.md");
    expect(obsidian.content).toContain("safeclaw_memory_scope: operation_memory_export");
    expect(obsidian.content).toContain("runtime_authority: false");
    expect(obsidian.content).toContain("model_fine_tuning: false");
    expect(obsidian.content).toContain("[[Workpack/성수동 외벽 도장]]");
    expect(obsidian.content).toContain("[[Hazard/추락]]");
    expect(obsidian.content).toContain("[[Evidence/외벽 도장 중 이동식 비계 추락 사례]]");
    expect(obsidian.content).toContain("--hasImprovement-->");
    expect(obsidian.content).toContain("## 승격 전 체크");
  });
});
