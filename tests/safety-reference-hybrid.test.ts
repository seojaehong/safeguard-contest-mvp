import { describe, expect, it } from "vitest";
import * as safetyCatalog from "@/lib/safety-reference-catalog";
import {
  filterAndRankSafetyReferencesByQuery,
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

describe("SIF display labels", () => {
  const helper = safetyCatalog as typeof safetyCatalog & {
    getSafetyReferenceDisplayTitle?: (item: SafetyReferenceItem) => string;
  };

  it("derives a readable display title from archive-style SIF rows without changing source fields", () => {
    const rawTitle = "1919 / 기타의사업 / 시설관리및사업지원서비스업";
    const archiveRow = reference("sif-archive-row", "supporting");
    archiveRow.title = rawTitle;
    archiveRow.summary = [
      "연번: 1919",
      "업종: 기타의사업 / 시설관리및사업지원서비스업",
      "재해개요: 2024. 3. 11. 피해자가 지하 기계실 배수펌프 점검 중 산소결핍으로 쓰러지고, 구조 과정에서 불시기동된 펌프에 끼임.",
      "기인물: 배수펌프",
      "위험성 감소대책: 산소농도 측정, 강제환기, 전원 차단 및 잠금표지"
    ].join("\n");

    const merged = mergeSafetyReferenceHybridResults({
      vectorItems: [archiveRow],
      rankedItems: [],
      limit: 1
    })[0] as SafetyReferenceItem & { display_title?: string; display_summary?: string };

    expect(helper.getSafetyReferenceDisplayTitle).toBeTypeOf("function");
    expect(helper.getSafetyReferenceDisplayTitle?.(archiveRow)).toBe("지하 기계실 배수펌프 점검 중 산소결핍으로 쓰러지고, 구조 과정에서 불시기동된 펌프에 끼임 사례");
    expect(merged.title).toBe(rawTitle);
    expect(merged.display_title).toBe("지하 기계실 배수펌프 점검 중 산소결핍으로 쓰러지고, 구조 과정에서 불시기동된 펌프에 끼임 사례");
    expect(merged.display_summary).toContain("산소결핍");
    expect(merged.display_title).not.toMatch(/^(연번|재해개요|기인물):/u);
    expect(merged.display_summary).not.toMatch(/^(연번|재해개요|기인물):/u);
  });

  it("keeps already-readable SIF titles as their display title", () => {
    const readable = reference("sif-readable", "supporting");
    readable.title = "지하 기계실 배수펌프 정비 중 산소결핍 및 불시기동 끼임 사례";

    expect(helper.getSafetyReferenceDisplayTitle).toBeTypeOf("function");
    expect(helper.getSafetyReferenceDisplayTitle?.(readable)).toBe(readable.title);
  });

  it("stops SIF overview parsing at corpus labels and strips year-month plus victim wording", () => {
    const archiveRow = reference("sif-corpus-boundaries", "supporting");
    archiveRow.title = "2020 / 제조업 / 금속제품제조업";
    archiveRow.summary = [
      "재해개요: 2019년 03월경 피재자가 탱크 내부 청소 중 질식함.",
      "재해유발요인: 환기 미흡",
      "위험성 감소대책(예시): 산소농도 측정 및 강제환기"
    ].join("\n");

    expect(helper.getSafetyReferenceDisplayTitle?.(archiveRow)).toBe("탱크 내부 청소 중 질식함 사례");
    expect(helper.getSafetyReferenceDisplayTitle?.({
      ...archiveRow,
      summary: "재해개요: 2018년 8월경 피재자는 맨홀 내부 점검 중 산소결핍으로 쓰러짐. 위험성 감소대책(예시): 환기"
    })).toBe("맨홀 내부 점검 중 산소결핍으로 쓰러짐 사례");
  });

  it("never generates display fields for header-like SIF titles", () => {
    const headerRow = reference("sif-header", "supporting");
    headerRow.title = "공종 / 작업명";
    headerRow.summary = "재해개요: 헤더 row 설명. 위험성 감소대책(예시): 헤더";

    const merged = mergeSafetyReferenceHybridResults({
      vectorItems: [headerRow],
      rankedItems: [],
      limit: 1
    })[0] as SafetyReferenceItem & { display_title?: string; display_summary?: string };

    expect(helper.getSafetyReferenceDisplayTitle?.(headerRow)).toBe("공종 / 작업명");
    expect(merged.display_title).toBeUndefined();
    expect(merged.display_summary).toBeUndefined();
  });
});

describe("filterAndRankSafetyReferencesByQuery", () => {
  it("promotes task-specific SIF/confined-space evidence ahead of broad KOSHA support material", () => {
    const broadSupport: SafetyReferenceItem = {
      ...reference("broad-kosha"),
      id: "broad-kosha",
      source_id: "kosha-support",
      item_type: "technical-support-regulation",
      category: "산업안전일반분야",
      subcategory: "기술지원규정",
      title: "A-G-15-2026 중소규모 사업장 비상조치계획 작성에 관한 기술지원규정",
      summary: "사업장 비상조치계획 작성, 대피, 연락체계, 응급조치 기준을 설명합니다.",
      keywords: ["비상조치", "연락체계"],
      risk_tags: ["비상대응"],
      controls: ["비상조치계획 수립", "연락체계 확인"],
      primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
      evidence_role: "direct",
      retrieval_source: "ranked"
    };
    const confinedSif: SafetyReferenceItem = {
      ...reference("confined-sif", "supporting"),
      id: "confined-sif",
      source_id: "kosha-sif",
      item_type: "sif-case",
      category: "기타의사업",
      subcategory: "시설관리및사업지원서비스업",
      title: "지하 기계실 배수펌프 정비 중 산소결핍 및 불시기동 끼임 사례",
      summary: "밀폐공간 진입 전 산소농도 측정, 강제환기, 감시인 배치, 배수펌프 전원 차단 및 잠금표지 미흡.",
      keywords: ["지하 기계실", "배수펌프", "밀폐공간", "산소농도", "LOTO"],
      risk_tags: ["질식", "끼임", "감전"],
      controls: ["진입 전 산소·유해가스 농도 측정", "배수펌프 전원 차단 및 잠금표지", "감시인 외부 배치"],
      primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
      evidence_role: "supporting",
      retrieval_source: "ranked"
    };

    const ranked = filterAndRankSafetyReferencesByQuery(
      "부산 해운대 지하 기계실 배수펌프 점검, 밀폐공간 진입 전 환기와 산소농도 측정, LOTO, 누수 바닥 미끄럼 위험",
      [broadSupport, confinedSif],
      2
    );

    expect(ranked[0]?.id).toBe("confined-sif");
    expect(ranked.some((item) => item.id === "broad-kosha")).toBe(false);
  });
});
