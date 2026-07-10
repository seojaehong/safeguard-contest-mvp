import { describe, expect, it } from "vitest";
import * as safetyCatalog from "@/lib/safety-reference-catalog";
import {
  deriveSafetyReferenceOperationalView,
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

describe("deriveSafetyReferenceOperationalView", () => {
  it("derives a deterministic operational view without mutating raw provenance controls", () => {
    const paint = reference("b-e-17-operational");
    paint.title = "B-E-17-2026 도장 공정에서의 화재·폭발위험방지";
    paint.summary = "도료와 유기용제 증기가 체류하는 도장 공정";
    paint.risk_tags = ["화재", "폭발"];
    paint.controls = ["가동부 방호덮개 설치", "정비 전 전원 차단 및 잠금표지"];
    const rawControls = [...paint.controls];

    const view = deriveSafetyReferenceOperationalView(paint);

    expect(view.hazard).toMatch(/화재·폭발/);
    expect(view.controls.join(" ")).toMatch(/유기용제|도료|환기/);
    expect(view.controls.join(" ")).not.toContain("가동부 방호덮개");
    expect(view.reviewRequired).toBe(false);
    expect(paint.controls).toEqual(rawControls);
  });

  it("classifies B-E-17 from source identity instead of electrostatic contamination in raw controls", () => {
    const paint = reference("b-e-17-electrostatic-contamination");
    paint.title = "B-E-17-2026 도장 공정에서의 화재·폭발위험방지";
    paint.summary = "도료와 유기용제 증기가 체류하는 도장 공정";
    paint.keywords = ["도장", "도료", "유기용제"];
    paint.risk_tags = ["화재", "폭발"];
    paint.controls = [
      "정전도장기·피도장물 접지 및 정전기 제거",
      "정비 전 전원 차단 및 잠금표지(LOTO)"
    ];
    const rawControls = [...paint.controls];

    const view = deriveSafetyReferenceOperationalView(paint);

    expect(view.hazard).toMatch(/도장 공정.*화재·폭발/);
    expect(view.hazard).not.toMatch(/정전도장 중/);
    expect(view.controls.join(" ")).toMatch(/도료|유기용제|환기/);
    expect(view.controls.join(" ")).toMatch(/점화원|MSDS|소화기/);
    expect(view.controls.join(" ")).not.toMatch(/정전도장기|피도장물 접지|LOTO/);
    expect(paint.controls).toEqual(rawControls);
  });

  it("keeps both fall protection and LOTO for a mixed-hazard machinery SIF case", () => {
    const machinerySif = reference("sif-conveyor-fall-entanglement", "supporting");
    machinerySif.title = "컨베이어 정비 작업 중 작업대 추락 및 가동부 끼임 사례";
    machinerySif.summary = "컨베이어 상부 정비 중 작업대에서 추락하고 불시기동된 가동부에 끼일 위험";
    machinerySif.keywords = ["컨베이어", "정비", "추락", "끼임"];
    machinerySif.risk_tags = ["추락", "끼임"];
    machinerySif.controls = [
      "작업발판·안전난간 상태 확인",
      "가동부 방호덮개 설치",
      "정비 전 전원 차단 및 잠금표지(LOTO)"
    ];
    const rawControls = [...machinerySif.controls];

    const view = deriveSafetyReferenceOperationalView(machinerySif);

    expect(view.hazard).toMatch(/추락/);
    expect(view.hazard).toMatch(/끼임|불시기동/);
    expect(view.controls.join(" ")).toMatch(/작업발판|안전난간|안전대/);
    expect(view.controls.join(" ")).toMatch(/전원 차단|잠금표지|LOTO/);
    expect(machinerySif.controls).toEqual(rawControls);
  });

  it("keeps LOTO when legacy machinery SIF prose carries hazardous-energy identity without a pinch tag", () => {
    const machinerySif = reference("sif-conveyor-fall-unexpected-start", "supporting");
    machinerySif.title = "컨베이어 정비 중 작업대 추락 및 불시기동 사례";
    machinerySif.summary = "컨베이어 상부 점검 중 작업대에서 추락하고 설비가 불시에 기동할 위험";
    machinerySif.keywords = ["컨베이어", "정비", "점검", "불시기동", "추락"];
    machinerySif.risk_tags = ["추락"];
    machinerySif.controls = [
      "작업발판·안전난간 상태 확인",
      "정비 전 전원 차단 및 잠금표지(LOTO)"
    ];
    const rawControls = [...machinerySif.controls];

    const view = deriveSafetyReferenceOperationalView(machinerySif);

    expect(view.hazard).toMatch(/추락/);
    expect(view.hazard).toMatch(/불시기동/);
    expect(view.controls.join(" ")).toMatch(/작업발판|안전난간|안전대/);
    expect(view.controls.join(" ")).toMatch(/전원 차단|잠금표지|LOTO/);
    expect(machinerySif.controls).toEqual(rawControls);
  });

  it("keeps non-machinery pinch cases free of machine-guard and LOTO controls", () => {
    const scaffoldSif = reference("sif-scaffold-fall-pinch", "supporting");
    scaffoldSif.title = "비계 해체 중 부재 사이 손가락 끼임 후 작업발판 추락 사례";
    scaffoldSif.summary = "비계 부재를 손으로 해체하던 중 손가락이 부재 사이에 끼이고 작업발판에서 추락";
    scaffoldSif.keywords = ["비계", "해체", "부재", "손가락 끼임", "추락"];
    scaffoldSif.risk_tags = ["추락", "끼임"];
    scaffoldSif.controls = [
      "가동부 방호덮개 설치 및 비상정지장치 작동 확인",
      "정비 전 전원 차단 및 잠금표지(LOTO)"
    ];
    const rawControls = [...scaffoldSif.controls];

    const view = deriveSafetyReferenceOperationalView(scaffoldSif);

    expect(view.hazard).toMatch(/추락/);
    expect(view.hazard).toMatch(/끼임|협착/);
    expect(view.controls.join(" ")).toMatch(/작업발판|안전난간|안전대/);
    expect(view.controls.join(" ")).toMatch(/손 끼임|부재|접근 통제/);
    expect(view.controls.join(" ")).not.toMatch(/방호덮개|비상정지장치|잠금표지|LOTO/);
    expect(scaffoldSif.controls).toEqual(rawControls);
  });

  it("maps mobile-dock forklift loading equipment to traffic controls instead of machinery LOTO", () => {
    const mobileDock = reference("machinery-mobile-dock");
    mobileDock.item_type = "machinery";
    mobileDock.title = "469 · 운수·창고및통신업 · 창고업";
    mobileDock.summary = "기계설비명: 이동식도크. 컨테이너와 결합하여 지게차로 상하차 작업을 하는 장비";
    mobileDock.keywords = ["창고업", "이동식도크", "Mobile dock"];
    mobileDock.risk_tags = ["지게차"];
    mobileDock.controls = [
      "가동부 방호덮개 설치 및 비상정지장치 작동 확인",
      "정비 전 전원 차단 및 잠금표지(LOTO)"
    ];
    const rawControls = [...mobileDock.controls];

    const view = deriveSafetyReferenceOperationalView(mobileDock);

    expect(view.hazard).toMatch(/지게차.*동선|동선.*지게차/);
    expect(view.controls.join(" ")).toMatch(/지게차.*보행|보행.*지게차/);
    expect(view.controls.join(" ")).toMatch(/신호수|후진 경보|접근통제/);
    expect(view.controls.join(" ")).not.toMatch(/방호덮개|비상정지장치|잠금표지|LOTO/);
    expect(mobileDock.controls).toEqual(rawControls);
  });

  it("preserves machinery LOTO for explicit mobile-dock maintenance evidence", () => {
    const mobileDock = reference("machinery-mobile-dock-maintenance");
    mobileDock.item_type = "machinery";
    mobileDock.title = "이동식도크 정비 및 불시기동 방지 사례";
    mobileDock.summary = "지게차 상하차용 이동식도크를 점검·정비하는 동안 설비가 불시에 기동할 위험";
    mobileDock.keywords = ["지게차", "상하차", "이동식도크", "점검", "정비", "불시기동"];
    mobileDock.risk_tags = ["끼임"];
    mobileDock.controls = [
      "가동부 방호덮개 설치 및 비상정지장치 작동 확인",
      "정비 전 전원 차단 및 잠금표지(LOTO)"
    ];

    const view = deriveSafetyReferenceOperationalView(mobileDock);

    expect(view.hazard).toMatch(/기계 가동부|불시기동/);
    expect(view.controls.join(" ")).toMatch(/방호덮개|비상정지장치/);
    expect(view.controls.join(" ")).toMatch(/전원 차단|잠금표지|LOTO/);
    expect(view.controls.join(" ")).not.toMatch(/지게차.*보행|보행.*지게차/);
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
