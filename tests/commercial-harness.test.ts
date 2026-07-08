import { describe, expect, it } from "vitest";

import { buildDbHarnessPacket, buildHarnessPromptContext, hasDocumentCoverage } from "@/lib/db-harness";
import { buildSifEmbeddingBatchManifest, buildSifEmbeddingCorpus, isEmbeddableSifReferenceItem, toSifEmbeddingJsonl } from "@/lib/sif-embedding-corpus";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";
import {
  buildWorkpackLearningFile,
  buildWorkpackLearningJsonl,
  buildWorkpackLearningMarkdown,
  normalizeLearningVisionPayload,
  normalizeWorkpackLearningFormat
} from "@/lib/workpack-learning-export";

function reference(overrides: Partial<SafetyReferenceItem> = {}): SafetyReferenceItem {
  return {
    id: "sif-1",
    source_id: "kosha-sif-archive-20260401",
    item_type: "sif-case",
    category: "건설",
    subcategory: null,
    title: "외벽 도장 중 추락 사례",
    summary: "이동식 비계에서 추락 위험이 확인된 사례",
    body: "재해개요: 작업발판과 난간 상태 미확인으로 추락 위험이 확인됨. 위험성 감소대책: 작업발판·난간 확인.",
    keywords: ["외벽", "도장", "추락"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["작업발판·난간 확인", "안전대 체결"],
    evidence_role: "supporting",
    ...overrides
  };
}

describe("SIF embedding corpus", () => {
  it("keeps only SIF cases and creates stable embedding text", () => {
    const corpus = buildSifEmbeddingCorpus([
      reference(),
      reference({ id: "guide-1", item_type: "technical-guideline", title: "기술지침" })
    ]);

    expect(corpus).toHaveLength(1);
    expect(corpus[0].referenceItemId).toBe("sif-1");
    expect(corpus[0].embeddingText).toContain("산업재해 고위험요인(SIF) 사례");
    expect(corpus[0].embeddingText).toContain("작업발판");
    expect(corpus[0].contentHash).toHaveLength(64);
    expect(toSifEmbeddingJsonl(corpus)).toContain("\"referenceItemId\":\"sif-1\"");
  });

  it("skips SIF spreadsheet header rows before embedding", () => {
    const header = reference({
      id: "sif-header",
      title: "공종 / 작업명",
      summary: "고위험작업·상황: 공종 column_4: 작업명",
      body: "고위험작업·상황: 공종 column_4: 작업명",
      risk_tags: []
    });

    expect(isEmbeddableSifReferenceItem(header)).toBe(false);
    expect(buildSifEmbeddingCorpus([header])).toEqual([]);
  });

  it("builds an approval-gated deterministic batch manifest before embedding upload", () => {
    const corpus = buildSifEmbeddingCorpus([
      reference({ id: "sif-1" }),
      reference({ id: "sif-2", title: "지게차 동선 충돌 사례" }),
      reference({ id: "sif-3", title: "작업발판 단부 추락 사례" })
    ]);
    const manifest = buildSifEmbeddingBatchManifest(corpus, {
      embeddingModel: "text-embedding-3-small",
      batchSize: 2,
      generatedAt: "2026-07-09T00:00:00.000Z"
    });

    expect(manifest.recordCount).toBe(3);
    expect(manifest.batchCount).toBe(2);
    expect(manifest.batches.map((batch) => batch.recordCount)).toEqual([2, 1]);
    expect(manifest.corpusHash).toHaveLength(64);
    expect(manifest.batches[0].referenceItemIds).toEqual(["sif-1", "sif-2"]);
    expect(manifest.approvalGate.dbMutationPerformed).toBe(false);
    expect(manifest.approvalGate.requiresApprovedUploadFlag).toBe(true);
  });
});

describe("DB harness packet", () => {
  it("requires SIF evidence and locks the LLM into naturalization only", () => {
    const packet = buildDbHarnessPacket({
      question: "성수동 외벽 도장 작업",
      references: [reference()],
      improvements: [{
        id: "imp-1",
        taskLabel: "성수동 외벽 도장",
        hazardLabel: "추락",
        improvementText: "작업발판 난간 보강",
        reflectedDocuments: ["위험성평가표", "TBM 브리핑"],
        sourceType: "photo_analysis",
        visionStatus: "analyzed",
        visionSummary: "난간이 보강된 것으로 보입니다.",
        detectedHazards: ["추락", "하부 통제 미흡"],
        observedImprovement: "작업발판 외측 난간 보강",
        ocrText: "추락주의"
      }]
    });
    const promptContext = buildHarnessPromptContext(packet);

    expect(packet.mode).toBe("db_harness_first");
    expect(packet.sifCases).toHaveLength(1);
    expect(packet.generationContract.llmRole).toBe("naturalize_only");
    expect(packet.generationContract.fallbackChainAllowed).toBe(false);
    expect(hasDocumentCoverage(packet, "TBM 기록")).toBe(true);
    expect(promptContext).toContain("DB harness가 고정한 근거");
    expect(promptContext).toContain("visionStatus: analyzed");
    expect(promptContext).toContain("detected: 추락, 하부 통제 미흡");
    expect(promptContext).toContain("observed: 작업발판 외측 난간 보강");
    expect(promptContext).toContain("ocr: 추락주의");
  });

  it("marks missing SIF as review-required", () => {
    const packet = buildDbHarnessPacket({
      question: "성수동 외벽 도장 작업",
      references: [reference({ item_type: "technical-guideline", evidence_role: "direct" })]
    });

    expect(packet.ontologyChecklist.status).toBe("review_required");
    expect(packet.ontologyChecklist.missing).toContain("SIF 유사사례");
  });
});

describe("workpack learning export", () => {
  it("exports daily work memory as markdown and jsonl", () => {
    const input = {
      workpackId: "wp-1",
      generatedAt: "2026-07-08T00:00:00.000Z",
      question: "성수동 외벽 도장 작업",
      taskLabel: "성수동 외벽 도장",
      references: [reference()],
      improvements: [{
        id: "imp-1",
        taskLabel: "성수동 외벽 도장",
        hazardLabel: "추락",
        improvementText: "난간 보강",
        reflectedDocuments: ["위험성평가표"],
        sourceType: "photo_analysis" as const,
        visionStatus: "analyzed" as const,
        visionProvider: "openai",
        visionModel: "gpt-4.1-mini",
        visionSummary: "난간 보강이 확인됩니다.",
        detectedHazards: ["추락"],
        observedImprovement: "난간 보강 후 작업구역 통제가 보입니다.",
        ocrText: "추락주의"
      }],
      confirmations: [{ displayName: "Nguyen", languageCode: "vi", readAt: "2026-07-08T09:20:00.000Z" }]
    };

    const markdown = buildWorkpackLearningMarkdown(input);
    const jsonl = buildWorkpackLearningJsonl(input);
    const file = buildWorkpackLearningFile(input, "jsonl");

    expect(markdown).toContain("# 성수동 외벽 도장");
    expect(markdown).toContain("난간 보강");
    expect(markdown).toContain("visionStatus: analyzed");
    expect(markdown).toContain("visionModel: gpt-4.1-mini");
    expect(markdown).toContain("detectedHazards: 추락");
    expect(markdown).toContain("observedImprovement: 난간 보강 후 작업구역 통제가 보입니다.");
    expect(markdown).toContain("ocr: 추락주의");
    expect(jsonl.split("\n")).toHaveLength(4);
    expect(jsonl).toContain("\"eventType\":\"improvement\"");
    expect(jsonl).toContain("\"visionStatus\":\"analyzed\"");
    expect(jsonl).toContain("\"visionModel\":\"gpt-4.1-mini\"");
    expect(jsonl).toContain("\"detectedHazards\":[\"추락\"]");
    expect(jsonl).toContain("\"observedImprovement\":\"난간 보강 후 작업구역 통제가 보입니다.\"");
    expect(jsonl).toContain("\"ocrText\":\"추락주의\"");
    expect(file.fileName).toBe("성수동-외벽-도장-learning.jsonl");
    expect(file.contentType).toContain("application/x-ndjson");
    expect(file.content.endsWith("\n")).toBe(true);
    expect(normalizeWorkpackLearningFormat("jsonl")).toBe("jsonl");
    expect(normalizeWorkpackLearningFormat("bad")).toBe("markdown");
  });

  it("preserves long vision/OCR payloads for memory export instead of clipping to UI summary length", () => {
    const longOcr = `작업중 출입금지 ${"비계 하부 통제 표지 ".repeat(20)}`.trim();
    const observedImprovement = `난간 설치와 하부 통제선 보강 확인. ${"작업발판 단부 보강 ".repeat(12)}`.trim();
    const normalized = normalizeLearningVisionPayload({
      status: "analyzed",
      provider: "openai",
      model: "gpt-4.1-mini",
      summary: "개선 후 난간과 통제선이 보입니다.",
      detectedHazards: ["추락", "하부 통제 미흡"],
      observedImprovement,
      ocrText: longOcr,
      errorMessage: ""
    });

    expect(normalized.visionStatus).toBe("analyzed");
    expect(normalized.visionProvider).toBe("openai");
    expect(normalized.visionModel).toBe("gpt-4.1-mini");
    expect(normalized.detectedHazards).toEqual(["추락", "하부 통제 미흡"]);
    expect(normalized.observedImprovement).toBe(observedImprovement);
    expect(normalized.ocrText).toBe(longOcr);
    expect(normalized.ocrText?.length).toBeGreaterThan(120);
  });
});
