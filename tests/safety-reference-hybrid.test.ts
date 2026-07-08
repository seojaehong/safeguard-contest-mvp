import { describe, expect, it } from "vitest";
import {
  mergeSafetyReferenceHybridResults,
  resolveSafetyReferenceVectorSearchState,
  type SafetyReferenceItem
} from "@/lib/safety-reference-catalog";

function reference(id: string, role: "direct" | "supporting" = "direct"): SafetyReferenceItem {
  return {
    id,
    source_id: "kosha-sif",
    item_type: role === "supporting" ? "sif-case" : "technical-guideline",
    category: "건설",
    subcategory: null,
    title: `${id} 외벽 도장 위험`,
    summary: "재해개요: 외벽 도장 중 추락 위험. 위험성 감소대책: 난간 확인.",
    keywords: ["외벽", "도장"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표", "TBM 브리핑"],
    controls: ["난간 확인"],
    evidence_role: role
  };
}

describe("resolveSafetyReferenceVectorSearchState", () => {
  it("keeps vector retrieval disabled by default before DB approval", () => {
    const state = resolveSafetyReferenceVectorSearchState({});

    expect(state.enabled).toBe(false);
    expect(state.status.reason).toBe("disabled");
    expect(state.status.attempted).toBe(false);
    expect(state.model).toBe("text-embedding-3-small");
  });

  it("falls back when vector retrieval is enabled without an OpenAI key", () => {
    const state = resolveSafetyReferenceVectorSearchState({
      SAFETY_REFERENCE_VECTOR_SEARCH: "1"
    });

    expect(state.enabled).toBe(false);
    expect(state.status.enabled).toBe(true);
    expect(state.status.reason).toBe("missing-openai-key");
    expect(state.status.message).toContain("text/ranked");
  });
});

describe("mergeSafetyReferenceHybridResults", () => {
  it("deduplicates vector and ranked matches while preserving a hybrid marker", () => {
    const result = mergeSafetyReferenceHybridResults({
      vectorItems: [{ ...reference("ref-1"), vector_similarity: 0.82 }],
      rankedItems: [reference("ref-1"), reference("ref-2")],
      limit: 5
    });

    expect(result.map((item) => item.id)).toEqual(["ref-1", "ref-2"]);
    expect(result[0].retrieval_source).toBe("hybrid");
    expect(result[0].vector_similarity).toBe(0.82);
    expect(result[1].retrieval_source).toBe("ranked");
  });

  it("filters by evidence role before returning bounded candidates", () => {
    const result = mergeSafetyReferenceHybridResults({
      vectorItems: [reference("supporting-1", "supporting"), reference("direct-1", "direct")],
      rankedItems: [reference("direct-2", "direct")],
      evidenceRole: "direct",
      limit: 1
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("direct-1");
    expect(result[0].evidence_role).toBe("direct");
  });
});
