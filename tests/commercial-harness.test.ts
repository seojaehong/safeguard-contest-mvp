import { describe, expect, it } from "vitest";

import { buildDbHarnessPacket, buildHarnessPromptContext, hasDocumentCoverage } from "@/lib/db-harness";
import { buildSifEmbeddingCorpus, isEmbeddableSifReferenceItem, toSifEmbeddingJsonl } from "@/lib/sif-embedding-corpus";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";
import { buildWorkpackLearningJsonl, buildWorkpackLearningMarkdown } from "@/lib/workpack-learning-export";

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
        sourceType: "photo_analysis"
      }]
    });

    expect(packet.mode).toBe("db_harness_first");
    expect(packet.sifCases).toHaveLength(1);
    expect(packet.generationContract.llmRole).toBe("naturalize_only");
    expect(packet.generationContract.fallbackChainAllowed).toBe(false);
    expect(hasDocumentCoverage(packet, "TBM 기록")).toBe(true);
    expect(buildHarnessPromptContext(packet)).toContain("DB harness가 고정한 근거");
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
        sourceType: "manual" as const
      }],
      confirmations: [{ displayName: "Nguyen", languageCode: "vi", readAt: "2026-07-08T09:20:00.000Z" }]
    };

    const markdown = buildWorkpackLearningMarkdown(input);
    const jsonl = buildWorkpackLearningJsonl(input);

    expect(markdown).toContain("# 성수동 외벽 도장");
    expect(markdown).toContain("난간 보강");
    expect(jsonl.split("\n")).toHaveLength(4);
    expect(jsonl).toContain("\"eventType\":\"improvement\"");
  });
});
