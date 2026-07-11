import { readFileSync } from "node:fs";
import { join } from "node:path";

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

function archiveSif(
  id: string,
  summary: string,
  riskTags: string[],
  controls: string[] = []
): SafetyReferenceItem {
  const item = reference(id, "supporting");
  item.title = id;
  item.summary = summary;
  item.body = summary;
  item.keywords = [];
  item.risk_tags = riskTags;
  item.controls = controls;
  return item;
}

interface SifEmbeddingCorpusRow {
  referenceItemId: string;
  itemType: "sif-case";
  title: string;
  category: string;
  riskTags: string[];
  controls: string[];
  primaryDocuments: string[];
  embeddingText: string;
}

function readSifEmbeddingCorpusRows(): Map<string, SifEmbeddingCorpusRow> {
  const corpusPath = join(process.cwd(), "evaluation", "sif-embedding-gate", "sif-embedding-corpus.jsonl");
  const rows = readFileSync(corpusPath, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SifEmbeddingCorpusRow);
  return new Map(rows.map((row) => [row.referenceItemId, row]));
}

function corpusReference(row: SifEmbeddingCorpusRow): SafetyReferenceItem {
  return {
    id: row.referenceItemId,
    source_id: "sif-embedding-corpus",
    item_type: row.itemType,
    category: row.category,
    subcategory: null,
    title: row.title,
    summary: row.embeddingText,
    body: row.embeddingText,
    keywords: [],
    risk_tags: row.riskTags,
    primary_documents: row.primaryDocuments,
    controls: row.controls,
    evidence_role: "supporting"
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
    getSafetyReferenceOperationalIncidentOverview?: (item: SafetyReferenceItem) => string;
  };

  it("exposes the exact incident overview surface used by the operational classifier", () => {
    const archiveRow = reference("sif-operational-overview", "supporting");
    archiveRow.summary = [
      "자료유형: 산업재해 고위험요인(SIF) 사례",
      "재해개요: 작업자가 배수펌프 주변에서 넘어짐.",
      "기인물: 배수펌프",
      "위험성 감소대책(예시): 전원 차단 및 잠금표지"
    ].join(" ");
    archiveRow.body = archiveRow.summary;

    expect(helper.getSafetyReferenceOperationalIncidentOverview).toBeTypeOf("function");
    expect(helper.getSafetyReferenceOperationalIncidentOverview?.(archiveRow)).toBe("작업자가 배수펌프 주변에서 넘어짐.");
  });

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

  it("fails closed when a SIF row only names machinery without a causal incident", () => {
    const ambiguousMachinery = reference("sif-ambiguous-pump", "supporting");
    ambiguousMachinery.item_type = "sif-case";
    ambiguousMachinery.title = "배수펌프 관련 기타 사고";
    ambiguousMachinery.summary = "재해개요: 작업자가 배수펌프 주변에서 원인이 확인되지 않은 기타 사고를 당함. 기인물: 배수펌프";
    ambiguousMachinery.risk_tags = [];
    ambiguousMachinery.controls = ["배수펌프 점검"];

    const view = deriveSafetyReferenceOperationalView(ambiguousMachinery);

    expect(view.reviewRequired).toBe(true);
    expect(view.hazard).toMatch(/검토 필요|원인.*미확정/);
    expect(view.controls.join(" ")).toMatch(/원문|원인|관리감독자|확정하지 않음/);
    expect(view.controls.join(" ")).not.toMatch(/방호덮개|비상정지|전원 차단|잠금표지|LOTO/);
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

  it("maps forklift load-overturn SIF evidence to load stability controls", () => {
    const forkliftSif = reference("sif-forklift-load-overturn", "supporting");
    forkliftSif.title = "1048 / 제조업 / 일반산업용기계장치제조업";
    forkliftSif.summary = "지게차 포크로 프레임 구조부재 사이를 벌리다가 프레임이 넘어져 작업자를 타격한 사례";
    forkliftSif.keywords = ["지게차", "전도", "낙하", "구조부재"];
    forkliftSif.risk_tags = ["전도", "지게차", "낙하"];
    forkliftSif.controls = [
      "가동부 방호덮개 설치 및 비상정지장치 작동 확인",
      "정비 전 전원 차단 및 잠금표지(LOTO)"
    ];
    const rawControls = [...forkliftSif.controls];

    const view = deriveSafetyReferenceOperationalView(forkliftSif);

    expect(view.hazard).toMatch(/지게차/);
    expect(view.hazard).toMatch(/전도|낙하|타격/);
    expect(view.controls.join(" ")).toMatch(/무게중심|결속|포크/);
    expect(view.controls.join(" ")).toMatch(/작업반경|출입통제|신호수/);
    expect(view.controls.join(" ")).not.toMatch(/방호덮개|비상정지장치|잠금표지|LOTO/);
    expect(forkliftSif.controls).toEqual(rawControls);
  });

  it("maps forklift pallet-riding fall SIF evidence to fall-prevention controls", () => {
    const forkliftSif = reference("sif-forklift-pallet-fall", "supporting");
    forkliftSif.title = "1014 / 제조업 / 자동차및모터사이클수리업";
    forkliftSif.summary = "이동식 사다리로 지게차 파렛트 위에 올라가 이동하던 중 바닥으로 추락한 사례";
    forkliftSif.keywords = ["지게차", "파렛트", "고소", "추락"];
    forkliftSif.risk_tags = ["추락", "지게차", "고소"];
    forkliftSif.controls = [
      "가동부 방호덮개 설치 및 비상정지장치 작동 확인",
      "정비 전 전원 차단 및 잠금표지(LOTO)"
    ];
    const rawControls = [...forkliftSif.controls];

    const view = deriveSafetyReferenceOperationalView(forkliftSif);

    expect(view.hazard).toMatch(/지게차.*추락|추락.*지게차/);
    expect(view.controls.join(" ")).toMatch(/포크|파렛트.*탑승 금지|탑승 금지.*포크|고소작업대/);
    expect(view.controls.join(" ")).toMatch(/안전대|작업발판|추락 방호/);
    expect(view.controls.join(" ")).not.toMatch(/방호덮개|비상정지장치|잠금표지|LOTO/);
    expect(forkliftSif.controls).toEqual(rawControls);
  });

  it("does not treat pre-use forklift inspection as hazardous-energy maintenance", () => {
    const forkliftSif = reference("sif-forklift-preuse-inspection-fall", "supporting");
    forkliftSif.title = "지게차 사용 전 점검 후 파렛트 탑승 중 추락 사례";
    forkliftSif.summary = "작업자가 지게차 사용 전 외관을 점검한 뒤 파렛트에 올라 이동하다 바닥으로 추락";
    forkliftSif.keywords = ["지게차", "사용 전 점검", "파렛트", "추락"];
    forkliftSif.risk_tags = ["추락", "지게차"];
    forkliftSif.controls = [
      "가동부 방호덮개 설치 및 비상정지장치 작동 확인",
      "정비 전 전원 차단 및 잠금표지(LOTO)"
    ];

    const view = deriveSafetyReferenceOperationalView(forkliftSif);

    expect(view.hazard).toMatch(/지게차.*추락|추락.*지게차/);
    expect(view.controls.join(" ")).toMatch(/포크|파렛트.*탑승 금지|고소작업대/);
    expect(view.controls.join(" ")).not.toMatch(/방호덮개|비상정지장치|잠금표지|LOTO/);
  });

  it("keeps forklift fire and explosion SIF evidence out of the traffic branch", () => {
    const forkliftSif = reference("sif-forklift-fuel-fire", "supporting");
    forkliftSif.title = "LPG 지게차 연료 누출 중 화재·폭발 사례";
    forkliftSif.summary = "LPG 지게차 연료계통에서 가스가 누출되고 주변 점화원으로 화재가 발생할 위험";
    forkliftSif.keywords = ["지게차", "LPG", "연료 누출", "화재", "폭발"];
    forkliftSif.risk_tags = ["지게차", "화재", "폭발"];
    forkliftSif.controls = ["보행자 동선 분리", "신호수 배치 및 후진 경보 확인"];

    const view = deriveSafetyReferenceOperationalView(forkliftSif);

    expect(view.hazard).toMatch(/지게차/);
    expect(view.hazard).toMatch(/화재|폭발/);
    expect(view.controls.join(" ")).toMatch(/연료|가스|배터리|누출/);
    expect(view.controls.join(" ")).toMatch(/환기|점화원|소화기/);
    expect(view.controls.join(" ")).not.toMatch(/보행 동선|신호수|후진 경보/);
  });

  it("keeps a dropped forklift load out of the worker-riding fall branch", () => {
    const forkliftSif = reference("sif-아카이브-건설업-00465", "supporting");
    forkliftSif.title = "465 / 건설업 / 지게차 인양 철근 다발 낙하";
    forkliftSif.summary = "지게차 포크로 인양하던 철근 다발이 떨어져 아래 작업자를 타격한 사례";
    forkliftSif.keywords = ["지게차", "철근 다발", "인양", "낙하"];
    forkliftSif.risk_tags = ["추락", "지게차", "낙하"];
    forkliftSif.controls = [
      "지게차 포크·파렛트 탑승 금지 및 승인된 고소작업대 사용",
      "작업발판·안전난간·안전대 등 추락 방호조치 확인"
    ];

    const view = deriveSafetyReferenceOperationalView(forkliftSif);

    expect(view.hazard).toMatch(/적재물|철근|낙하|타격/);
    expect(view.controls.join(" ")).toMatch(/무게중심|결속|포크 삽입/);
    expect(view.controls.join(" ")).toMatch(/작업반경|출입통제|신호수/);
    expect(view.controls.join(" ")).not.toMatch(/파렛트 탑승 금지|고소작업대|안전대/);
  });

  it("preserves hazardous-energy isolation for forklift maintenance fire SIF evidence", () => {
    const forkliftSif = reference("sif-forklift-maintenance-fire", "supporting");
    forkliftSif.title = "LPG 지게차 연료계통 정비 중 화재·폭발 사례";
    forkliftSif.summary = "지게차 연료계통을 수리하던 중 잔류 가스가 누출되고 점화원과 접촉해 화재가 발생";
    forkliftSif.keywords = ["지게차", "정비", "연료 누출", "화재", "폭발", "LOTO"];
    forkliftSif.risk_tags = ["지게차", "화재", "폭발"];
    forkliftSif.controls = ["충전 구역 환기", "정비 전 전원 차단 및 잠금표지(LOTO)"];

    const view = deriveSafetyReferenceOperationalView(forkliftSif);

    expect(view.hazard).toMatch(/화재|폭발/);
    expect(view.controls.join(" ")).toMatch(/연료|가스|누출/);
    expect(view.controls.join(" ")).toMatch(/환기|점화원|소화기/);
    expect(view.controls.join(" ")).toMatch(/전원|연료원|에너지.*차단|잠금표지|LOTO/);
  });

  it("does not turn a molten-metal explosion into a forklift fuel incident", () => {
    const moltenMetalSif = reference("sif-아카이브-제조업등-00851", "supporting");
    moltenMetalSif.title = "851 / 제조업 / 도가니 원료 투입 중 용탕 폭발";
    moltenMetalSif.summary = "지게차로 운반한 원료의 수분이 도가니 용탕과 접촉하면서 증기폭발이 발생한 사례";
    moltenMetalSif.keywords = ["지게차", "도가니", "용탕", "수분", "증기폭발"];
    moltenMetalSif.risk_tags = ["지게차", "화재", "폭발", "화상"];
    moltenMetalSif.controls = [
      "지게차 연료·가스·배터리 누출 및 충전·주유 설비 상태 확인",
      "충전·주유 구역 환기, 점화원 통제 및 적합 소화기 비치"
    ];

    const view = deriveSafetyReferenceOperationalView(moltenMetalSif);

    expect(view.hazard).toMatch(/용탕|수분|냉각수|증기폭발/);
    expect(view.controls.join(" ")).toMatch(/건조|수분 제거|수분 유입/);
    expect(view.controls.join(" ")).toMatch(/냉각수|출입통제|방열|보호구/);
    expect(view.controls.join(" ")).not.toMatch(/지게차 연료|배터리|충전|주유/);
  });

  it("does not infer moisture controls from a furnace fuel-gas explosion", () => {
    const furnaceSif = reference("sif-furnace-fuel-gas-explosion", "supporting");
    furnaceSif.title = "반사로 연료가스 배관 누출 화재·폭발 사례";
    furnaceSif.summary = "반사로 LNG 연료배관에서 가스가 누출되고 점화원과 접촉해 폭발한 사례";
    furnaceSif.keywords = ["반사로", "LNG", "연료가스", "배관 누출", "점화원"];
    furnaceSif.risk_tags = ["화재", "폭발"];
    furnaceSif.controls = ["가스 누출 확인", "환기 및 점화원 통제"];

    const view = deriveSafetyReferenceOperationalView(furnaceSif);

    expect(view.hazard).toMatch(/화재|폭발/);
    expect(view.controls.join(" ")).toMatch(/누출|환기|점화원|소화기/);
    expect(view.controls.join(" ")).not.toMatch(/용탕|수분 제거|사전 건조|냉각수/);
  });

  it.each([
    [
      "sif-아카이브-건설업-00420",
      "재해종류: 추락. 화재피난용 수직구조대 개구부로 알루미늄 동바리를 운반하던 작업자가 개구부로 추락"
    ],
    [
      "sif-아카이브-건설업-00836",
      "재해종류: 추락. 용접 화재감시자가 데크플레이트 미설치 개구부로 6.1m 아래 추락"
    ],
    [
      "sif-아카이브-제조업등-02051",
      "재해종류: 추락. 화재감지기 오작동 점검 중 이동식 사다리에서 균형을 잃고 추락"
    ]
  ])("keeps non-causal fire wording in %s out of the fire branch", (id, summary) => {
    const view = deriveSafetyReferenceOperationalView(archiveSif(id, summary, ["추락", "화재"]));

    expect(view.hazard).toMatch(/추락/);
    expect(view.controls.join(" ")).toMatch(/작업발판|안전난간|개구부|안전대|사다리/);
    expect(view.controls.join(" ")).not.toMatch(/연료 누출|점화원|소화기/);
  });

  it("keeps high-voltage electrocution out of the fire branch", () => {
    const view = deriveSafetyReferenceOperationalView(archiveSif(
      "sif-아카이브-건설업-01634",
      "재해종류: 감전. 화재로 손실된 외부 판넬 교체 중 고소작업대가 22.9kV 고압선로에 접근해 감전",
      ["화재", "감전", "고소"]
    ));

    expect(view.hazard).toMatch(/감전|고압선|충전부/);
    expect(view.controls.join(" ")).toMatch(/전원 차단|검전|접근한계|절연|방호/);
    expect(view.controls.join(" ")).not.toMatch(/연료 누출|소화기/);
  });

  it("keeps arc-flash electrical controls instead of generic fuel-fire controls", () => {
    const view = deriveSafetyReferenceOperationalView(archiveSif(
      "sif-아카이브-건설업-01886",
      "재해종류: 화상. 수배전설비 HI-POT 테스트 후 접지선 결선 중 아크 폭발(Arc Flash) 발생",
      ["폭발"]
    ));

    expect(view.hazard).toMatch(/아크|감전|전기/);
    expect(view.controls.join(" ")).toMatch(/전원 차단|검전|접지|절연|아크 방호/);
    expect(view.controls.join(" ")).not.toMatch(/가연물|연료 누출|소화기/);
  });

  it.each([
    [
      "sif-아카이브-제조업등-00370",
      "재해자가 출입문 보수를 위해 지게차 포크에 끼운 파렛트에 올라가 작업 중 1.85m 아래로 떨어짐"
    ],
    [
      "sif-아카이브-제조업등-02535",
      "재해자가 지게차 포크 위에서 하역장 가림천막을 보수하던 중 콘크리트 바닥으로 떨어짐"
    ]
  ])("keeps unrelated repair work in %s as forklift riding fall", (id, summary) => {
    const view = deriveSafetyReferenceOperationalView(archiveSif(id, summary, ["지게차"]));

    expect(view.hazard).toMatch(/지게차.*추락|추락.*지게차/);
    expect(view.controls.join(" ")).toMatch(/포크|파렛트.*탑승 금지|고소작업대/);
    expect(view.controls.join(" ")).not.toMatch(/방호덮개|비상정지장치|잠금표지|LOTO/);
  });

  it("keeps forklift-worker collision ahead of load stability", () => {
    const view = deriveSafetyReferenceOperationalView(archiveSif(
      "sif-아카이브-제조업등-02354",
      "지게차에 벼 톤백을 싣고 이송 중 비닐포대 수거 작업자와 충돌. 운전자 시야와 사각지대 미확인",
      ["끼임", "충돌", "지게차"]
    ));

    expect(view.hazard).toMatch(/충돌|깔림|동선/);
    expect(view.controls.join(" ")).toMatch(/시야|사각지대|동선|신호수|접근통제/);
    expect(view.controls.join(" ")).not.toMatch(/적재물 무게중심|결속|포크 삽입/);
  });

  it("maps forklift slope rollover to route and seat-belt controls", () => {
    const view = deriveSafetyReferenceOperationalView(archiveSif(
      "sif-아카이브-건설업-01063",
      "타일 운반 후 지게차로 후진해 경사로를 내려오다 파라펫과 충돌해 지게차가 전도되고 안전띠 미착용 운전자가 이탈",
      ["충돌", "전도", "지게차"]
    ));

    expect(view.hazard).toMatch(/경사로|전도|운전석 이탈/);
    expect(view.controls.join(" ")).toMatch(/안전띠/);
    expect(view.controls.join(" ")).toMatch(/운행경로|경사|후진|작업계획/);
    expect(view.controls.join(" ")).not.toMatch(/적재물 무게중심|결속/);
  });

  it("maps parked forklift rollback to parking brake and wheel chocks", () => {
    const view = deriveSafetyReferenceOperationalView(archiveSif(
      "sif-아카이브-건설업-00864",
      "레미탈을 인양한 지게차를 경사로에 정차하고 하차한 뒤 차량이 뒤로 밀려 작업자가 앞바퀴에 깔림",
      ["지게차"]
    ));

    expect(view.hazard).toMatch(/주차|정차|밀림|불시 이동/);
    expect(view.controls.join(" ")).toMatch(/주차 브레이크|제동장치/);
    expect(view.controls.join(" ")).toMatch(/스토퍼|구름방지|포크.*바닥/);
    expect(view.controls.join(" ")).not.toMatch(/적재물 무게중심|결속/);
  });

  it("keeps an actual truck collision out of forklift load controls", () => {
    const view = deriveSafetyReferenceOperationalView(archiveSif(
      "sif-아카이브-제조업등-02045",
      "폐기물 매립장에서 감시인이 후진하는 암롤트럭에 깔림. 기인물: 화물운반트럭. 차량과 작업자 동선 미분리",
      ["끼임", "지게차"]
    ));

    expect(view.hazard).toMatch(/차량|트럭|충돌|깔림/);
    expect(view.controls.join(" ")).toMatch(/차량.*동선|후진|신호수|접근통제/);
    expect(view.controls.join(" ")).not.toMatch(/지게차.*적재물|적재물 무게중심|포크 삽입/);
  });

  it("maps improvised pressure-vessel explosion to pressure controls", () => {
    const view = deriveSafetyReferenceOperationalView(archiveSif(
      "sif-아카이브-건설업-01156",
      "재해종류: 폭발. 임의 개조한 20L 압력밥솥을 공기압축기로 가압해 도장 중 용기 뚜껑이 폭발",
      ["폭발"]
    ));

    expect(view.hazard).toMatch(/압력|용기|가압/);
    expect(view.controls.join(" ")).toMatch(/용도.*적합|승인.*용기|임의 개조/);
    expect(view.controls.join(" ")).toMatch(/안전밸브|방호장치|사전 점검/);
    expect(view.controls.join(" ")).not.toMatch(/연료 누출|점화원|소화기/);
  });

  it("maps steam connection rupture to isolation and depressurization controls", () => {
    const view = deriveSafetyReferenceOperationalView(archiveSif(
      "sif-아카이브-제조업등-01983",
      "스팀인입 메인밸브 개방 중 연결부가 파괴되어 고온 스팀에 노출되어 사망",
      ["화재", "폭발", "질식", "화학"]
    ));

    expect(view.hazard).toMatch(/스팀|증기|압력|고온/);
    expect(view.controls.join(" ")).toMatch(/격리|차단|감압|잔압/);
    expect(view.controls.join(" ")).toMatch(/연결부|밸브|배관|방열 보호구/);
    expect(view.controls.join(" ")).not.toMatch(/가연물|점화원|소화기/);
  });

  it("keeps EPDM mixer leakage as chemical fire when forklift appears only in countermeasures", () => {
    const view = deriveSafetyReferenceOperationalView(archiveSif(
      "sif-아카이브-제조업등-00160",
      "재해종류: 화상. EPDM 교반기 맨홀에서 인화성액체가 누출되어 화재 발생. 위험성 감소대책: 비방폭형 지게차 출입금지",
      ["화재", "폭발", "질식", "화학", "지게차"]
    ));

    expect(view.hazard).toMatch(/인화성|화학|가연물|화재/);
    expect(view.controls.join(" ")).toMatch(/누출|환기|감지|경보|점화원/);
    expect(view.controls.join(" ")).not.toMatch(/지게차 연료|배터리|충전|주유/);
  });

  it("fails closed when an SIF incident cause is not recognized", () => {
    const unknownSif = archiveSif(
      "sif-unknown-cause",
      "재해개요: 원인과 기인물이 확인되지 않은 기타 사고",
      ["추락"],
      ["가동부 방호덮개 설치", "정비 전 전원 차단 및 잠금표지(LOTO)"]
    );

    const view = deriveSafetyReferenceOperationalView(unknownSif);

    expect(view.reviewRequired).toBe(true);
    expect(view.hazard).toMatch(/검토 필요|미확정/);
    expect(view.controls.join(" ")).toMatch(/원문|사고 원인|관리감독자/);
    expect(view.controls.join(" ")).not.toMatch(/방호덮개|잠금표지|LOTO/);
  });

  it("classifies audited real SIF corpus rows by incident cause instead of contaminated tags", () => {
    const rows = readSifEmbeddingCorpusRows();
    const viewFor = (id: string) => {
      const row = rows.get(id);
      expect(row, `missing audited corpus row ${id}`).toBeDefined();
      if (!row) throw new Error(`Missing audited corpus row: ${id}`);
      const item = corpusReference(row);
      const before = JSON.stringify(item);
      const view = deriveSafetyReferenceOperationalView(item);
      expect(JSON.stringify(item), `${id} source item mutated`).toBe(before);
      return view;
    };

    expect(viewFor("sif-아카이브-건설업-00420").hazard).toMatch(/추락/);
    expect(viewFor("sif-아카이브-건설업-00836").hazard).toMatch(/추락/);
    expect(viewFor("sif-아카이브-제조업등-02051").hazard).toMatch(/추락/);
    expect(viewFor("sif-아카이브-건설업-01634").hazard).toMatch(/감전|고압선|충전부/);
    expect(viewFor("sif-아카이브-건설업-01886").hazard).toMatch(/아크|감전|전기/);
    expect(viewFor("sif-아카이브-제조업등-00370").hazard).toMatch(/지게차.*추락|추락.*지게차/);
    expect(viewFor("sif-아카이브-제조업등-02535").hazard).toMatch(/지게차.*추락|추락.*지게차/);
    expect(viewFor("sif-아카이브-제조업등-02354").hazard).toMatch(/충돌|깔림|동선/);
    expect(viewFor("sif-아카이브-건설업-01063").hazard).toMatch(/경사로|전도|운전석 이탈/);
    expect(viewFor("sif-아카이브-건설업-00864").hazard).toMatch(/주차|정차|밀림|불시 이동/);
    expect(viewFor("sif-아카이브-제조업등-02045").hazard).toMatch(/차량|트럭|충돌|깔림/);
    expect(viewFor("sif-아카이브-건설업-01156").hazard).toMatch(/압력|용기|가압/);
    expect(viewFor("sif-아카이브-제조업등-01983").hazard).toMatch(/스팀|증기|압력|고온/);

    const epdmFire = viewFor("sif-아카이브-제조업등-00160");
    expect(epdmFire.hazard).toMatch(/인화성|화학|가연물|화재/);
    expect(epdmFire.controls.join(" ")).not.toMatch(/지게차 연료|배터리|충전|주유/);

    expect(viewFor("sif-아카이브-건설업-01934").hazard).toMatch(/추락/);
    expect(viewFor("sif-아카이브-건설업-01951").hazard).toMatch(/차량|고소작업차|충돌|부딪힘/);
    expect(viewFor("sif-아카이브-건설업-01911").hazard).toMatch(/인양|부재|낙하|타격/);
    expect(viewFor("sif-아카이브-건설업-00659").hazard).toMatch(/적재물|철골|낙하|깔림/);
    expect(viewFor("sif-아카이브-제조업등-00404").hazard).toMatch(/적재물|톤백|붕괴|전도/);
    expect(viewFor("sif-아카이브-제조업등-00697").hazard).toMatch(/적재물|낙하|깔림/);
    expect(viewFor("sif-아카이브-제조업등-00271").hazard).toMatch(/사다리|추락/);
    expect(viewFor("sif-아카이브-제조업등-00811").hazard).toMatch(/크레인|충돌|끼임/);
    expect(viewFor("sif-아카이브-건설업-02088").hazard).toMatch(/인양|압력용기|전도|깔림/);
    expect(viewFor("sif-아카이브-건설업-02877").hazard).toMatch(/추락/);
    const craneLoad = viewFor("sif-아카이브-제조업등-01368");
    expect(craneLoad.hazard).toMatch(/인양|화물|낙하/);
    expect(craneLoad.controls.join(" ")).toMatch(/줄걸이|결속|무게중심/);
    expect(craneLoad.controls.join(" ")).not.toMatch(/크레인 주행|운전자 시야/);
    expect(viewFor("sif-아카이브-건설업-02101").hazard).toMatch(/추락/);

    const palletizer = viewFor("sif-아카이브-제조업등-02536");
    expect(palletizer.hazard).toMatch(/턴테이블|적재기|불시.*하강|끼임/);
    expect(palletizer.controls.join(" ")).toMatch(/안전블록|지지대|전원 차단|LOTO/);
    expect(palletizer.hazard).not.toMatch(/지게차/);

    for (const id of [
      "sif-아카이브-건설업-01977",
      "sif-아카이브-건설업-01990",
      "sif-아카이브-건설업-01999"
    ]) {
      const fall = viewFor(id);
      expect(fall.hazard).toMatch(/추락/);
      expect(fall.controls.join(" ")).not.toMatch(/잠금표지|LOTO/);
    }

    const rebarDrop = viewFor("sif-아카이브-건설업-00465");
    expect(rebarDrop.hazard).toMatch(/적재물|철근|낙하|타격/);
    expect(rebarDrop.controls.join(" ")).toMatch(/결속|무게중심|출입통제/);
    expect(rebarDrop.controls.join(" ")).not.toMatch(/작업발판|안전대 체결/);

    for (const id of [
      "sif-아카이브-제조업등-00009",
      "sif-아카이브-제조업등-00107",
      "sif-아카이브-제조업등-00267",
      "sif-아카이브-제조업등-01561"
    ]) {
      const chemicalExposure = viewFor(id);
      expect(chemicalExposure.hazard).toMatch(/화학|부식|독성|질식|유해물질/);
      expect(chemicalExposure.controls.join(" ")).toMatch(/누출원 차단|비상세척|보호구|환기|산소/);
      expect(chemicalExposure.controls.join(" ")).not.toMatch(/점화원|소화기/);
    }

    for (const id of [
      "sif-아카이브-건설업-00081",
      "sif-아카이브-건설업-02544",
      "sif-아카이브-건설업-02557",
      "sif-아카이브-건설업-02582",
      "sif-아카이브-건설업-02624",
      "sif-아카이브-제조업등-01982"
    ]) {
      const nonConfined = viewFor(id);
      expect(nonConfined.hazard).not.toMatch(/밀폐공간|산소결핍/);
      expect(nonConfined.controls.join(" ")).not.toMatch(/산소.*농도 측정|강제환기|감시인 외부 배치/);
    }

    for (const id of [
      "sif-아카이브-건설업-00071",
      "sif-아카이브-건설업-00126",
      "sif-아카이브-건설업-00156",
      "sif-아카이브-건설업-00169",
      "sif-아카이브-건설업-00212",
      "sif-아카이브-건설업-00347"
    ]) {
      const fallingObject = viewFor(id);
      expect(fallingObject.hazard).toMatch(/낙하|비래|타격|깔림/);
      expect(fallingObject.controls.join(" ")).toMatch(/고정|결속|낙하|출입통제|작업반경/);
      expect(fallingObject.controls.join(" ")).not.toMatch(/안전대 체결|작업발판.*안전난간/);
    }

    for (const id of [
      "sif-아카이브-건설업-00461",
      "sif-아카이브-건설업-02291",
      "sif-아카이브-건설업-02404",
      "sif-아카이브-제조업등-00144",
      "sif-아카이브-제조업등-00650"
    ]) {
      const liftingLoad = viewFor(id);
      expect(liftingLoad.hazard, id).toMatch(/인양|양중|화물|부재|낙하/);
      expect(liftingLoad.controls.join(" "), id).toMatch(/줄걸이|결속|무게중심|인양.*출입통제/);
      expect(liftingLoad.controls.join(" "), id).not.toMatch(/크레인 주행|운전자 시야/);
    }

    for (const id of [
      "sif-아카이브-제조업등-00146",
      "sif-아카이브-제조업등-00410",
      "sif-아카이브-제조업등-01117",
      "sif-아카이브-제조업등-01191",
      "sif-아카이브-제조업등-01267",
      "sif-아카이브-제조업등-01374"
    ]) {
      const forkliftLoad = viewFor(id);
      expect(forkliftLoad.controls.join(" "), id).not.toMatch(/포크·파렛트 탑승 금지|고소작업대 사용/);
      expect(forkliftLoad.hazard, id).toMatch(/적재물|화물|낙하|전도|타격|깔림/);
    }

    for (const id of [
      "sif-아카이브-건설업-03199",
      "sif-아카이브-제조업등-00355",
      "sif-아카이브-제조업등-01777",
      "sif-아카이브-제조업등-02261",
      "sif-아카이브-제조업등-00156",
      "sif-아카이브-제조업등-00359",
      "sif-아카이브-제조업등-00559",
      "sif-아카이브-제조업등-01835"
    ]) {
      const storedPressure = viewFor(id);
      expect(storedPressure.hazard).toMatch(/압력|스팀|증기|파열|분출/);
      expect(storedPressure.controls.join(" ")).toMatch(/감압|잔압|안전밸브|개방 전|방열|비래/);
      expect(storedPressure.controls.join(" ")).not.toMatch(/가동부 방호덮개.*비상정지장치/);
    }

    for (const id of [
      "sif-아카이브-제조업등-00005",
      "sif-아카이브-제조업등-00006",
      "sif-아카이브-제조업등-00132",
      "sif-아카이브-제조업등-00528",
      "sif-아카이브-제조업등-01651",
      "sif-아카이브-제조업등-01708"
    ]) {
      const stackedLoad = viewFor(id);
      expect(stackedLoad.hazard).toMatch(/적재|적층|붕괴|전도/);
      expect(stackedLoad.controls.join(" ")).toMatch(/적재 높이|적층|받침|붕괴방지/);
      expect(stackedLoad.controls.join(" ")).not.toMatch(/줄걸이|체인/);
    }

    expect(viewFor("sif-아카이브-건설업-02556").hazard).toMatch(/담장|구조물|전도|붕괴|협착/);
    expect(viewFor("sif-아카이브-건설업-02626").hazard).toMatch(/굴삭기|운반물|부재|충돌|타격/);
    expect(viewFor("sif-아카이브-건설업-02654").hazard).toMatch(/폭염|온열|탈진|이상온도/);
    expect(viewFor("sif-아카이브-건설업-02006").hazard).toMatch(/포스겐|독성|화학|잔압|누출/);

    expect(viewFor("sif-아카이브-제조업등-00401").hazard).toMatch(/사일로|매몰|붕괴/);
    expect(viewFor("sif-아카이브-제조업등-00519").hazard).toMatch(/전기로|폭발|화상/);
    expect(viewFor("sif-아카이브-제조업등-01812").hazard).toMatch(/황화수소|유해가스|중독|질식/);
    expect(viewFor("sif-아카이브-제조업등-00010").hazard).toMatch(/차량|페이로더|후진|깔림/);
    expect(viewFor("sif-아카이브-제조업등-01756").hazard).toMatch(/황산|화학|누출|노출/);

    for (const id of [
      "sif-아카이브-건설업-00004",
      "sif-아카이브-건설업-00024",
      "sif-아카이브-건설업-00037",
      "sif-아카이브-건설업-00041",
      "sif-아카이브-건설업-00055"
    ]) {
      const mobileEquipment = viewFor(id);
      expect(mobileEquipment.hazard, id).toMatch(/작업차량|굴삭기|건설기계|충돌|깔림|동선/);
      expect(mobileEquipment.controls.join(" "), id).toMatch(/시야|동선|신호수|접근통제/);
      expect(mobileEquipment.controls.join(" "), id).not.toMatch(/손 끼임점|취급 보조도구/);
    }

    const slabCollapse = viewFor("sif-아카이브-건설업-00345");
    expect(slabCollapse.hazard).toMatch(/슬래브|데크|동바리|거푸집|붕괴/);
    expect(slabCollapse.controls.join(" ")).toMatch(/설계하중|동바리|타설.*순서|하부.*출입통제/);
    expect(slabCollapse.controls.join(" ")).not.toMatch(/담장|굴착 순서|흙막이/);

    const demolitionCollapse = viewFor("sif-아카이브-건설업-02832");
    expect(demolitionCollapse.hazard).toMatch(/해체|철거|건물|주택|붕괴/);
    expect(demolitionCollapse.controls.join(" ")).toMatch(/구조검토|해체.*순서|지지|보강/);
    expect(demolitionCollapse.controls.join(" ")).not.toMatch(/담장|굴착 순서|흙막이/);

    const towerCraneCollapse = viewFor("sif-아카이브-건설업-03106");
    expect(towerCraneCollapse.hazard).toMatch(/타워크레인.*붕괴|붕괴.*타워크레인/);
    expect(towerCraneCollapse.controls.join(" ")).toMatch(/해체.*순서|균형|메인 슈|체결|붕괴.*출입통제/);
    expect(towerCraneCollapse.controls.join(" ")).not.toMatch(/담장|굴착 순서|흙막이/);

    for (const id of [
      "sif-아카이브-건설업-00547",
      "sif-아카이브-제조업등-01357",
      "sif-아카이브-제조업등-01728"
    ]) {
      const vehicleTraffic = viewFor(id);
      expect(vehicleTraffic.hazard, id).toMatch(/작업차량|화물차|트럭|후진|충돌|깔림/);
      expect(vehicleTraffic.controls.join(" "), id).toMatch(/시야|동선|신호수|후진 경보|접근통제/);
      expect(vehicleTraffic.controls.join(" "), id).not.toMatch(/손 끼임점|취급 보조도구/);
    }

    for (const id of [
      "sif-아카이브-건설업-00040",
      "sif-아카이브-제조업등-00927"
    ]) {
      const raisedVehiclePart = viewFor(id);
      expect(raisedVehiclePart.hazard, id).toMatch(/적재함|운전석|캡|하강|끼임/);
      expect(raisedVehiclePart.controls.join(" "), id).toMatch(/지지대|기계적 고정|유압|잔류에너지|LOTO/);
      expect(raisedVehiclePart.controls.join(" "), id).not.toMatch(/손 끼임점|취급 보조도구/);
    }

    for (const id of [
      "sif-아카이브-건설업-03150",
      "sif-아카이브-건설업-03180",
      "sif-아카이브-제조업등-02344"
    ]) {
      const movingCraneLoad = viewFor(id);
      expect(movingCraneLoad.hazard, id).toMatch(/인양|양중|매달린|하중|화물|타격|협착/);
      expect(movingCraneLoad.controls.join(" "), id).toMatch(/결속|무게중심|유도로프|인양.*출입통제|진자/);
      expect(movingCraneLoad.controls.join(" "), id).not.toMatch(/크레인 주행|운전자 시야/);
    }

    const slopeTruck = viewFor("sif-아카이브-건설업-03327");
    expect(slopeTruck.hazard).toMatch(/차량|트럭|경사|밀림|깔림/);
    expect(slopeTruck.controls.join(" ")).toMatch(/제동|바퀴|고임|신호수|출입통제/);
    expect(slopeTruck.hazard).not.toMatch(/폭염|온열|탈진/);

    for (const id of [
      "sif-아카이브-건설업-00133",
      "sif-아카이브-건설업-02893",
      "sif-아카이브-제조업등-00138",
      "sif-아카이브-제조업등-01876",
      "sif-아카이브-건설업-02218",
      "sif-아카이브-제조업등-00029",
      "sif-아카이브-제조업등-00357",
      "sif-아카이브-제조업등-00558",
      "sif-아카이브-제조업등-00607",
      "sif-아카이브-제조업등-00608",
      "sif-아카이브-제조업등-02086",
      "sif-아카이브-제조업등-02452"
    ]) {
      const poweredPinch = viewFor(id);
      expect(poweredPinch.hazard, id).toMatch(/동력|설비|회전|승강|하강|끼임|불시.*작동/);
      expect(poweredPinch.controls.join(" "), id).toMatch(/방호|접근통제|에너지|LOTO|기계적 고정/);
      expect(poweredPinch.controls.join(" "), id).not.toMatch(/취급 보조도구/);
    }

    for (const id of [
      "sif-아카이브-건설업-00306",
      "sif-아카이브-건설업-03309"
    ]) {
      const unexplainedCollapse = viewFor(id);
      expect(unexplainedCollapse.reviewRequired, id).toBe(true);
      expect(unexplainedCollapse.controls.join(" "), id).not.toMatch(/산소.*농도 측정|펌프.*LOTO/);
    }

    const robotPinch = viewFor("sif-아카이브-제조업등-00419");
    expect(robotPinch.hazard).toMatch(/로봇|동력|설비|회전|끼임|불시.*작동/);
    expect(robotPinch.controls.join(" ")).not.toMatch(/산소.*농도 측정|강제환기|감시인 외부 배치/);

    const fallingTree = viewFor("sif-아카이브-제조업등-01581");
    expect(fallingTree.hazard).toMatch(/나무|벌도목|낙하|타격|깔림/);
    expect(fallingTree.controls.join(" ")).not.toMatch(/산소.*농도 측정|강제환기|펌프.*LOTO/);

    const ladderFall = viewFor("sif-아카이브-제조업등-02448");
    expect(ladderFall.hazard).toMatch(/사다리|추락/);
    expect(ladderFall.controls.join(" ")).not.toMatch(/산소.*농도 측정|강제환기|펌프.*LOTO/);

    const actualConfined = viewFor("sif-아카이브-제조업등-02159");
    expect(actualConfined.hazard).toMatch(/밀폐공간|산소결핍|유해가스|질식/);
    expect(actualConfined.controls.join(" ")).toMatch(/산소.*유해가스|환기|감시인|구조장비/);

    for (const id of [
      "sif-아카이브-건설업-00025",
      "sif-아카이브-건설업-00038"
    ]) {
      const rollingVehicle = viewFor(id);
      expect(rollingVehicle.hazard, id).toMatch(/경사|내리막|제동|밀림|불시.*이동|전복/);
      expect(rollingVehicle.controls.join(" "), id).toMatch(/제동|주차 브레이크|바퀴 고임|이동경로/);
    }

    for (const id of [
      "sif-아카이브-건설업-00181",
      "sif-아카이브-건설업-02373"
    ]) {
      const rollover = viewFor(id);
      expect(rollover.hazard, id).toMatch(/차량|지게차|전도|전복/);
      expect(rollover.controls.join(" "), id).toMatch(/안전띠|전도방호|무게중심|운행경로|작업계획/);
      expect(rollover.controls.join(" "), id).not.toMatch(/후진 경보/);
    }

    for (const id of [
      "sif-아카이브-건설업-01909",
      "sif-아카이브-건설업-02399",
      "sif-아카이브-건설업-00182",
      "sif-아카이브-건설업-02532",
      "sif-아카이브-건설업-02874",
      "sif-아카이브-제조업등-00518",
      "sif-아카이브-제조업등-00520",
      "sif-아카이브-제조업등-02565"
    ]) {
      const constructionVehicleRollover = viewFor(id);
      expect(constructionVehicleRollover.hazard, id).toMatch(/덤프트럭|건설기계|굴삭기|차량|전도|전복/);
      expect(constructionVehicleRollover.controls.join(" "), id).toMatch(/안전띠|전도방호|지반|단부|운행경로|작업계획/);
      expect(constructionVehicleRollover.controls.join(" "), id).not.toMatch(/후진 경보/);
    }

    const blastingRock = viewFor("sif-아카이브-건설업-00198");
    expect(blastingRock.hazard).toMatch(/암석|비래|낙하|타격/);
    expect(blastingRock.controls.join(" ")).toMatch(/발파|비래|위험반경|대피|피난/);
    expect(blastingRock.controls.join(" ")).not.toMatch(/후진 경보|차량.*동선/);

    for (const id of [
      "sif-아카이브-건설업-00130",
      "sif-아카이브-건설업-00867",
      "sif-아카이브-건설업-02257",
      "sif-아카이브-제조업등-00092",
      "sif-아카이브-제조업등-00983",
      "sif-아카이브-제조업등-01127"
    ]) {
      const unstableLoad = viewFor(id);
      expect(unstableLoad.hazard, id).toMatch(/적재물|화물|파일|믹서기|전도|낙하|깔림/);
      expect(unstableLoad.controls.join(" "), id).toMatch(/무게중심|결속|고정|출입통제|작업반경/);
      expect(unstableLoad.controls.join(" "), id).not.toMatch(/후진 경보/);
    }

    for (const id of [
      "sif-아카이브-제조업등-00539",
      "sif-아카이브-제조업등-01099"
    ]) {
      const vehicleAccessFall = viewFor(id);
      expect(vehicleAccessFall.hazard, id).toMatch(/정차|차량|적재함|승하차|추락/);
      expect(vehicleAccessFall.controls.join(" "), id).toMatch(/발판|손잡이|3점 지지|접근설비|적재물.*위.*작업 금지/);
      expect(vehicleAccessFall.controls.join(" "), id).not.toMatch(/후진 경보|차량.*동선/);
    }

    const handCartSlope = viewFor("sif-아카이브-건설업-01364");
    expect(handCartSlope.hazard).toMatch(/손수레|경사|밀림|끼임/);
    expect(handCartSlope.controls.join(" ")).toMatch(/손수레|하중|제동|인원|협착구역|접근통제/);
    expect(handCartSlope.controls.join(" ")).not.toMatch(/LOTO|안전블록|승강.*하강/);

    const rollingAerialLift = viewFor("sif-아카이브-건설업-01808");
    expect(rollingAerialLift.hazard).toMatch(/차량|경사|밀림|끼임|깔림/);
    expect(rollingAerialLift.controls.join(" ")).toMatch(/제동|주차 브레이크|바퀴 고임|이동경로|출입통제/);
    expect(rollingAerialLift.controls.join(" ")).not.toMatch(/승강.*하강|LOTO/);

    const sandHopperEngulfment = viewFor("sif-아카이브-제조업등-00798");
    expect(sandHopperEngulfment.hazard).toMatch(/호퍼|모래|매몰|질식/);
    expect(sandHopperEngulfment.controls.join(" ")).toMatch(/투입|배출|격리|진입 금지|매몰|구조/);
    expect(sandHopperEngulfment.controls.join(" ")).not.toMatch(/유해가스.*농도|강제환기/);

    for (const id of [
      "sif-아카이브-제조업등-00995",
      "sif-아카이브-제조업등-01459"
    ]) {
      const automaticEquipmentPinch = viewFor(id);
      expect(automaticEquipmentPinch.hazard, id).toMatch(/동력|설비|기계|자동화|끼임|불시.*작동/);
      expect(automaticEquipmentPinch.controls.join(" "), id).toMatch(/방호|접근통제|에너지|LOTO|잠금표지/);
      expect(automaticEquipmentPinch.controls.join(" "), id).not.toMatch(/취급 보조도구/);
    }

    for (const id of [
      "sif-아카이브-건설업-00119",
      "sif-아카이브-건설업-02202",
      "sif-아카이브-건설업-02428",
      "sif-아카이브-제조업등-00452",
      "sif-아카이브-제조업등-00660",
      "sif-아카이브-제조업등-00741",
      "sif-아카이브-제조업등-01482",
      "sif-아카이브-제조업등-01848"
    ]) {
      const nonManualEquipmentPinch = viewFor(id);
      expect(nonManualEquipmentPinch.controls.join(" "), id).not.toMatch(/손 끼임점|취급 보조도구/);
      expect(
        nonManualEquipmentPinch.reviewRequired || /인양|하중|설비|기계|지게차|차량|크레인|끼임|협착/.test(nonManualEquipmentPinch.hazard),
        id
      ).toBe(true);
    }

    for (const id of [
      "sif-아카이브-건설업-00003",
      "sif-아카이브-건설업-00005",
      "sif-아카이브-건설업-00524",
      "sif-아카이브-제조업등-00152",
      "sif-아카이브-제조업등-01719",
      "sif-아카이브-제조업등-02408",
      "sif-아카이브-제조업등-02566"
    ]) {
      const vehicleSelfRollover = viewFor(id);
      expect(vehicleSelfRollover.hazard, id).toMatch(/차량|덤프트럭|굴삭기|지게차|건설기계|전도|전복/);
      expect(vehicleSelfRollover.controls.join(" "), id).toMatch(/안전띠|전도방호|지반|단부|운행경로|작업계획/);
      expect(vehicleSelfRollover.controls.join(" "), id).not.toMatch(/후진 경보/);
    }

    for (const id of [
      "sif-아카이브-건설업-00460",
      "sif-아카이브-건설업-02372",
      "sif-아카이브-제조업등-00490",
      "sif-아카이브-제조업등-00731"
    ]) {
      const staticLoadFailure = viewFor(id);
      expect(staticLoadFailure.hazard, id).toMatch(/하중|화물|철근|철 구조물|지보재|낙하|전도|붕괴|깔림|타격/);
      expect(staticLoadFailure.controls.join(" "), id).toMatch(/고정|결속|받침|무게중심|출입통제|작업반경/);
      expect(staticLoadFailure.controls.join(" "), id).not.toMatch(/후진 경보|차량.*동선/);
    }

    for (const id of [
      "sif-아카이브-건설업-03394",
      "sif-아카이브-제조업등-00823"
    ]) {
      const aerialPlatformRollover = viewFor(id);
      expect(aerialPlatformRollover.hazard, id).toMatch(/고소작업대|작업대|전도|전복|추락/);
      expect(aerialPlatformRollover.controls.join(" "), id).toMatch(/정격|탑승|수평|아웃트리거|주행경로|안전대|출입통제/);
      expect(aerialPlatformRollover.controls.join(" "), id).not.toMatch(/적재함 상승 한계/);
    }

    const liftedForklift = viewFor("sif-아카이브-건설업-00397");
    expect(liftedForklift.hazard).toMatch(/인양|지게차|하중|깔림|낙하/);
    expect(liftedForklift.controls.join(" ")).toMatch(/결속|무게중심|인양.*출입통제|작업반경/);
    expect(liftedForklift.controls.join(" ")).not.toMatch(/후진 경보/);

    for (const id of [
      "sif-아카이브-제조업등-00387",
      "sif-아카이브-제조업등-01764",
      "sif-아카이브-제조업등-02382"
    ]) {
      const ridingPinch = viewFor(id);
      expect(ridingPinch.hazard, id).toMatch(/지게차|마스트|프레임|상부 구조물|끼임/);
      expect(ridingPinch.hazard, id).not.toMatch(/추락 위험/);
      expect(ridingPinch.controls.join(" "), id).toMatch(/탑승.*금지|고소작업대|승강설비|완전 하차|접근통제/);
    }

    for (const id of [
      "sif-아카이브-건설업-02575",
      "sif-아카이브-건설업-02615"
    ]) {
      const excavationFace = viewFor(id);
      expect(excavationFace.hazard, id).toMatch(/굴착면|관로|측벽|매몰/);
      expect(excavationFace.controls.join(" "), id).toMatch(/흙막이|버팀|안전기울기|대피통로|붕괴 감시/);
    }

    const sludgeEngulfment = viewFor("sif-아카이브-건설업-02043");
    expect(sludgeEngulfment.hazard).toMatch(/슬러지|매몰|질식/);
    expect(sludgeEngulfment.controls.join(" ")).toMatch(/슬러지|경사|단계|진입 금지/);

    const tunnelRockfall = viewFor("sif-아카이브-건설업-02402");
    expect(tunnelRockfall.hazard).toMatch(/터널|막장|천단부|낙반|암반/);
    expect(tunnelRockfall.controls.join(" ")).toMatch(/부석|지보재|보강|운전석 방호/);

    for (const id of [
      "sif-아카이브-건설업-00015",
      "sif-아카이브-건설업-02419",
      "sif-아카이브-건설업-02361",
      "sif-아카이브-건설업-02637"
    ]) {
      const drowning = viewFor(id);
      expect(drowning.hazard, id).toMatch(/익사|침수|수몰|수상|급수/);
      expect(drowning.controls.join(" "), id).toMatch(/진입 금지|유입 차단|대피|구명|배수|감압|구조/);
      expect(drowning.controls.join(" "), id).not.toMatch(/가동부 방호덮개|비상정지장치/);
    }

    for (const id of [
      "sif-아카이브-제조업등-00410",
      "sif-아카이브-제조업등-00733",
      "sif-아카이브-제조업등-01191"
    ]) {
      const forkliftLoad = viewFor(id);
      expect(forkliftLoad.hazard, id).toMatch(/지게차|적재물|화물|낙하|전도|타격/);
      expect(forkliftLoad.controls.join(" "), id).toMatch(/무게중심|결속|포크|낙하.*출입통제|작업반경/);
      expect(forkliftLoad.controls.join(" "), id).not.toMatch(/후진 경보|주차 브레이크|가동부 방호덮개/);
    }

    const swingingCraneLoad = viewFor("sif-아카이브-건설업-03171");
    expect(swingingCraneLoad.hazard).toMatch(/인양|화물|부재|충돌|타격/);
    expect(swingingCraneLoad.controls.join(" ")).toMatch(/줄걸이|결속|무게중심|인양.*출입통제/);
    expect(swingingCraneLoad.controls.join(" ")).not.toMatch(/크레인 주행|운전자 시야/);

    for (const id of [
      "sif-아카이브-건설업-01814",
      "sif-아카이브-제조업등-01379"
    ]) {
      const electricalArc = viewFor(id);
      expect(electricalArc.hazard, id).toMatch(/아크|감전|전기|화상/);
      expect(electricalArc.controls.join(" "), id).toMatch(/전원 차단|검전|접지|절연|아크 방호/);
      expect(electricalArc.controls.join(" "), id).not.toMatch(/가연물|연료 누출|소화기/);
    }

    for (const id of [
      "sif-아카이브-제조업등-00204",
      "sif-아카이브-제조업등-01555",
      "sif-아카이브-건설업-02115"
    ]) {
      const pressureRelease = viewFor(id);
      expect(pressureRelease.hazard, id).toMatch(/스팀|증기|압력|잔압|파열|분출|비래/);
      expect(pressureRelease.controls.join(" "), id).toMatch(/격리|차단|감압|잔압|건전성|비래|방열/);
      expect(pressureRelease.controls.join(" "), id).not.toMatch(/가동부 방호덮개.*비상정지장치/);
    }

    for (const id of [
      "sif-아카이브-건설업-02100",
      "sif-아카이브-제조업등-00360",
      "sif-아카이브-제조업등-01076",
      "sif-아카이브-제조업등-01359",
      "sif-아카이브-제조업등-02179"
    ]) {
      const poweredPinch = viewFor(id);
      expect(poweredPinch.hazard, id).toMatch(/동력|설비|기계|승강|하강|회전|끼임|말림/);
      expect(poweredPinch.controls.join(" "), id).toMatch(/운전 정지|방호|접근통제|인터록|에너지|LOTO|잠금표지|기계적 고정/);
      expect(poweredPinch.controls.join(" "), id).not.toMatch(/작업발판.*안전난간|후진 경보/);
    }

    const rollingAerialWorkVehicle = viewFor("sif-아카이브-건설업-01813");
    expect(rollingAerialWorkVehicle.hazard).toMatch(/차량|고소작업차|경사|밀림|돌진|충돌/);
    expect(rollingAerialWorkVehicle.controls.join(" ")).toMatch(/주차 브레이크|바퀴 고임|제동|이동경로|출입통제/);
    expect(rollingAerialWorkVehicle.controls.join(" ")).not.toMatch(/취급 보조도구|손 끼임점/);

    for (const id of [
      "sif-아카이브-건설업-02362",
      "sif-아카이브-제조업등-00308",
      "sif-아카이브-제조업등-00662",
      "sif-아카이브-제조업등-00755"
    ]) {
      const unstableHeavyObject = viewFor(id);
      expect(unstableHeavyObject.hazard, id).toMatch(/철근|금형|블록|대차|중량|물체|부재|전도|낙하|깔림|타격/);
      expect(unstableHeavyObject.controls.join(" "), id).toMatch(/고정|결속|받침|지지|건전성|무게중심|출입통제|작업반경/);
      expect(unstableHeavyObject.controls.join(" "), id).not.toMatch(/취급 보조도구|손 끼임점/);
    }

    for (const id of [
      "sif-아카이브-건설업-00030",
      "sif-아카이브-건설업-02310",
      "sif-아카이브-건설업-02513",
      "sif-아카이브-건설업-02514",
      "sif-아카이브-건설업-02521",
      "sif-아카이브-건설업-02634",
      "sif-아카이브-건설업-02976",
      "sif-아카이브-제조업등-00190",
      "sif-아카이브-제조업등-01594",
      "sif-아카이브-제조업등-01722",
      "sif-아카이브-제조업등-02561",
      "sif-아카이브-제조업등-02570"
    ]) {
      const vehicleRollover = viewFor(id);
      expect(vehicleRollover.hazard, id).toMatch(/차량|덤프트럭|굴삭기|굴착기|지게차|천공기|건설기계|전도|전복/);
      expect(vehicleRollover.controls.join(" "), id).toMatch(/안전띠|전도방호|지반|단부|운행경로|작업계획|유도자/);
      expect(vehicleRollover.controls.join(" "), id).not.toMatch(/승하차.*3점 지지|후진 경보|인양물 무게중심/);
    }

    for (const id of [
      "sif-아카이브-건설업-01247",
      "sif-아카이브-건설업-01294",
      "sif-아카이브-건설업-01320",
      "sif-아카이브-건설업-02075",
      "sif-아카이브-건설업-02086",
      "sif-아카이브-건설업-02155",
      "sif-아카이브-건설업-02181",
      "sif-아카이브-제조업등-01288",
      "sif-아카이브-제조업등-01824",
      "sif-아카이브-제조업등-02205"
    ]) {
      const aerialRollover = viewFor(id);
      expect(aerialRollover.hazard, id).toMatch(/고소작업대|고소작업차|작업대|전도|전복|추락/);
      expect(aerialRollover.controls.join(" "), id).toMatch(/정격 탑승인원.*수평 지반.*아웃트리거/);
      expect(aerialRollover.controls.join(" "), id).toMatch(/주행경로.*안전대.*출입통제/);
      expect(aerialRollover.controls.join(" "), id).not.toMatch(/적재함 상승 한계|취급 보조도구/);
    }

    for (const id of [
      "sif-아카이브-건설업-00121",
      "sif-아카이브-건설업-02622",
      "sif-아카이브-제조업등-00884"
    ]) {
      const fallingLoad = viewFor(id);
      expect(fallingLoad.hazard, id).toMatch(/물체|부재|하중|인양|낙하|전도|타격|깔림/);
      expect(fallingLoad.controls.join(" "), id).toMatch(/고정|결속|지지|무게중심|작업반경|출입통제/);
      expect(fallingLoad.controls.join(" "), id).not.toMatch(/회전체 방호|후진 경보/);
    }

    for (const id of [
      "sif-아카이브-건설업-00142",
      "sif-아카이브-건설업-02330",
      "sif-아카이브-건설업-02345",
      "sif-아카이브-제조업등-02522"
    ]) {
      const mobileTraffic = viewFor(id);
      expect(mobileTraffic.hazard, id).toMatch(/차량|운반차|롤러|이동|선회|충돌|협착|끼임/);
      expect(mobileTraffic.controls.join(" "), id).toMatch(/운행경로|이동경로|동선|작업반경|신호수|접근통제/);
      expect(mobileTraffic.controls.join(" "), id).not.toMatch(/회전체 방호|LOTO|잠금표지/);
    }

    const carLiftOpeningFall = viewFor("sif-아카이브-건설업-00522");
    expect(carLiftOpeningFall.hazard).toMatch(/카리프트|개구부|출입금지|추락/);
    expect(carLiftOpeningFall.controls.join(" ")).toMatch(/출입금지|개구부|덮개|난간|추락/);
    expect(carLiftOpeningFall.controls.join(" ")).not.toMatch(/후진 경보|보행자 동선/);

    const conveyorMixedFall = viewFor("sif-아카이브-제조업등-00719");
    expect(conveyorMixedFall.hazard).toMatch(/컨베이어|작업발판|추락|끼임|불시기동/);
    expect(conveyorMixedFall.controls.join(" ")).toMatch(/작업발판|안전난간|전원 차단|잠금표지|LOTO/);
    expect(conveyorMixedFall.controls.join(" ")).not.toMatch(/후진 경보|차량.*동선/);

    for (const id of [
      "sif-아카이브-제조업등-00531",
      "sif-아카이브-제조업등-01452",
      "sif-아카이브-제조업등-00534"
    ]) {
      const liftGravity = viewFor(id);
      expect(liftGravity.hazard, id).toMatch(/승강|하강|리프트|운반구|지지력|끼임|추락/);
      expect(liftGravity.controls.join(" "), id).toMatch(/안전블록|지지대|기계적 고정|동력|잔류에너지|LOTO|잠금표지/);
      expect(liftGravity.controls.join(" "), id).not.toMatch(/회전체 방호|후진 경보/);
    }

    for (const id of [
      "sif-아카이브-제조업등-00222",
      "sif-아카이브-제조업등-00499",
      "sif-아카이브-제조업등-00757",
      "sif-아카이브-제조업등-01048",
      "sif-아카이브-제조업등-01217"
    ]) {
      const forkliftLoadNotRollover = viewFor(id);
      expect(forkliftLoadNotRollover.hazard, id).toMatch(/적재물|화물|부재|구조물|톤백|낙하|전도|깔림|타격/);
      expect(forkliftLoadNotRollover.controls.join(" "), id).toMatch(/무게중심|결속|포크|고정|받침|작업반경|출입통제/);
      expect(forkliftLoadNotRollover.controls.join(" "), id).not.toMatch(/운전자 좌석 안전띠|전도방호/);
    }

    for (const id of [
      "sif-아카이브-제조업등-00978",
      "sif-아카이브-제조업등-01434",
      "sif-아카이브-제조업등-00283"
    ]) {
      const workerVehicleImpact = viewFor(id);
      expect(workerVehicleImpact.hazard, id).toMatch(/차량|지게차|후진|충돌|깔림|동선/);
      expect(workerVehicleImpact.controls.join(" "), id).toMatch(/동선|신호수|후진 경보|접근통제|사각지대/);
      expect(workerVehicleImpact.controls.join(" "), id).not.toMatch(/전도방호|적재물 무게중심/);
    }

    const workPlatformFall = viewFor("sif-아카이브-제조업등-01821");
    expect(workPlatformFall.hazard).toMatch(/작업발판|단부|추락/);
    expect(workPlatformFall.controls.join(" ")).toMatch(/작업발판|안전난간|안전대/);
    expect(workPlatformFall.controls.join(" ")).not.toMatch(/전도방호|운전자 좌석 안전띠/);

    const parkedTruckRollback = viewFor("sif-아카이브-건설업-03344");
    expect(parkedTruckRollback.hazard).toMatch(/주차|정차|경사|불시 이동|밀림|깔림/);
    expect(parkedTruckRollback.controls.join(" ")).toMatch(/주차 브레이크|바퀴 고임|제동|이동경로|출입통제/);
    expect(parkedTruckRollback.controls.join(" ")).not.toMatch(/전도방호|운전자 안전띠/);

    const actualForkliftRollover = viewFor("sif-아카이브-제조업등-01669");
    expect(actualForkliftRollover.hazard).toMatch(/지게차.*전도|전도.*지게차/);
    expect(actualForkliftRollover.controls.join(" ")).toMatch(/좌석 안전띠|전도방호|운행경로|작업계획/);

    const parkedForkliftMovement = viewFor("sif-아카이브-제조업등-01718");
    expect(parkedForkliftMovement.hazard).toMatch(/주차|정차|지게차|불시 이동|깔림/);
    expect(parkedForkliftMovement.controls.join(" ")).toMatch(/주차 브레이크|제동장치|바퀴.*스토퍼/);

    for (const id of [
      "sif-아카이브-건설업-01301",
      "sif-아카이브-건설업-01509",
      "sif-아카이브-건설업-01760",
      "sif-아카이브-건설업-02274",
      "sif-아카이브-제조업등-01520"
    ]) {
      const nonAerialRollover = viewFor(id);
      expect(nonAerialRollover.controls.join(" "), id).not.toMatch(/정격 탑승인원.*수평 지반.*아웃트리거/);
    }

    for (const id of [
      "sif-아카이브-건설업-00113",
      "sif-아카이브-건설업-00633",
      "sif-아카이브-건설업-02394"
    ]) {
      const unstableStructure = viewFor(id);
      expect(unstableStructure.hazard, id).toMatch(/버팀대|기둥|몰드커버|물체|부재|전도|깔림|타격/);
      expect(unstableStructure.controls.join(" "), id).toMatch(/고정|받침|지지|결속|작업반경|출입통제/);
      expect(unstableStructure.controls.join(" "), id).not.toMatch(/취급 보조도구|손 끼임점/);
    }

    const deckCollapse = viewFor("sif-아카이브-건설업-00643");
    expect(deckCollapse.hazard).toMatch(/데크|구조|붕괴|추락|깔림/);
    expect(deckCollapse.controls.join(" ")).toMatch(/지지력|버팀|하중|보강|출입통제/);
    expect(deckCollapse.controls.join(" ")).not.toMatch(/적재물 무게중심|포크 삽입/);

    const injectionMachineMixedFall = viewFor("sif-아카이브-제조업등-00098");
    expect(injectionMachineMixedFall.hazard).toMatch(/사출성형기|기계설비|추락|끼임|불시기동/);
    expect(injectionMachineMixedFall.controls.join(" ")).toMatch(/작업발판|안전난간|전원 차단|잠금표지|LOTO/);

    for (const id of [
      "sif-아카이브-제조업등-00873",
      "sif-아카이브-제조업등-02075",
      "sif-아카이브-제조업등-02280",
      "sif-아카이브-제조업등-02288",
      "sif-아카이브-제조업등-02403"
    ]) {
      const elevatedWorkerFall = viewFor(id);
      expect(elevatedWorkerFall.hazard, id).toMatch(/적재함|화물|톤백|작업발판|단부|추락/);
      expect(elevatedWorkerFall.controls.join(" "), id).toMatch(/작업발판|안전난간|안전대|탑승금지|추락방지/);
      expect(elevatedWorkerFall.controls.join(" "), id).not.toMatch(/물체.*고정.*결속|낙하 예상 작업반경/);
    }

    for (const id of [
      "sif-아카이브-제조업등-01563",
      "sif-아카이브-제조업등-01668",
      "sif-아카이브-제조업등-02234",
      "sif-아카이브-제조업등-02409",
      "sif-아카이브-제조업등-02539",
      "sif-아카이브-제조업등-02544",
      "sif-아카이브-제조업등-02554"
    ]) {
      const vehicleEdgeFall = viewFor(id);
      expect(vehicleEdgeFall.hazard, id).toMatch(/차량|덤프트럭|셔틀|굴삭기|굴착기|천공기|건설기계|전도|전복|단부/);
      expect(vehicleEdgeFall.controls.join(" "), id).toMatch(/안전띠|전도방호|지반|단부|운행경로|작업계획|유도자/);
      expect(vehicleEdgeFall.controls.join(" "), id).not.toMatch(/작업발판.*안전난간.*개구부|후진 경보/);
    }

    const rollingPipeLoad = viewFor("sif-아카이브-제조업등-01383");
    expect(rollingPipeLoad.hazard).toMatch(/강관|물체|부재|화물|낙하|전도|타격|깔림/);
    expect(rollingPipeLoad.controls.join(" ")).toMatch(/고임목|고정|결속|작업반경|출입통제/);
    expect(rollingPipeLoad.controls.join(" ")).not.toMatch(/작업발판.*안전난간/);

    for (const id of [
      "sif-아카이브-제조업등-01701",
      "sif-아카이브-제조업등-02410",
      "sif-아카이브-제조업등-02414"
    ]) {
      const liftUnexpectedMotion = viewFor(id);
      expect(liftUnexpectedMotion.hazard, id).toMatch(/리프트|엘리베이터|승강|불시.*상승|불시.*하강|끼임|추락/);
      expect(liftUnexpectedMotion.controls.join(" "), id).toMatch(/비상정지|권과방지|전원 차단|잠금표지|LOTO|출입통제/);
      expect(liftUnexpectedMotion.controls.join(" "), id).not.toMatch(/낙하 예상 작업반경|후진 경보/);
    }

    const subsidingAerialPlatform = viewFor("sif-아카이브-건설업-01031");
    expect(subsidingAerialPlatform.hazard).toMatch(/고소작업대|지반|침하|기울|전도|추락/);
    expect(subsidingAerialPlatform.controls.join(" ")).toMatch(/지반.*지지력|아웃트리거|수평|안전대|출입통제/);

    for (const id of [
      "sif-아카이브-건설업-00672",
      "sif-아카이브-건설업-01663",
      "sif-아카이브-건설업-02374"
    ]) {
      const aerialStructureFailure = viewFor(id);
      expect(aerialStructureFailure.hazard, id).toMatch(/고소작업대|붐|턴테이블|볼트|용접부|파단|구조.*실패|추락/);
      expect(aerialStructureFailure.controls.join(" "), id).toMatch(/볼트|핀|용접부|붐|구조부|점검|교체|안전대/);
      expect(aerialStructureFailure.controls.join(" "), id).not.toMatch(/작업발판.*개구부 상태/);
    }

    for (const id of [
      "sif-아카이브-건설업-01799",
      "sif-아카이브-제조업등-02280"
    ]) {
      const vehicleInducedFall = viewFor(id);
      expect(vehicleInducedFall.hazard, id).toMatch(/(?:차량|작업차량).*(?:출발|이동|추돌)|(?:출발|이동|추돌).*(?:차량|작업차량)/);
      expect(vehicleInducedFall.controls.join(" "), id).toMatch(/완전.*하차|차량.*이동.*금지|동선.*분리/);
      expect(vehicleInducedFall.controls.join(" "), id).not.toMatch(/낙하 예상 작업반경|후진 경보/);
    }

    for (const id of [
      "sif-아카이브-건설업-02743",
      "sif-아카이브-제조업등-00680",
      "sif-아카이브-제조업등-00890",
      "sif-아카이브-제조업등-01036",
      "sif-아카이브-제조업등-01847"
    ]) {
      const machineryMixedFall = viewFor(id);
      expect(machineryMixedFall.hazard, id).toMatch(/기계|설비|그라인더|쇄석기|팔파기|스크류|무빙워크|끼임|불시기동/);
      expect(machineryMixedFall.controls.join(" "), id).toMatch(/방호|비상정지|전원 차단|잠금표지|LOTO/);
      expect(machineryMixedFall.controls.join(" "), id).not.toMatch(/취급 보조도구/);
    }

    const crusherRotorPinch = viewFor("sif-아카이브-건설업-03089");
    expect(crusherRotorPinch.hazard).toMatch(/쇄석기|로터|끼임|협착|불시기동/);
    expect(crusherRotorPinch.controls.join(" ")).toMatch(/운전.*정지|전원 차단|잠금표지|LOTO|기계.*고정/);
    expect(crusherRotorPinch.hazard).not.toMatch(/작업대.*추락/);
    expect(crusherRotorPinch.controls.join(" ")).not.toMatch(/작업발판.*안전난간/);

    const craneBucketCrusherFall = viewFor("sif-아카이브-제조업등-00504");
    expect(craneBucketCrusherFall.hazard).toMatch(/크레인|버킷|충돌|파쇄기|투입구|추락/);
    expect(craneBucketCrusherFall.controls.join(" ")).toMatch(/크레인.*작업반경|버킷.*정지|투입구.*방호|인터록|출입통제/);

    const loneCrusherOpeningFall = viewFor("sif-아카이브-제조업등-00716");
    expect(loneCrusherOpeningFall.hazard).toMatch(/파쇄기|투입구|개구부|추락|말림|파쇄/);
    expect(loneCrusherOpeningFall.controls.join(" ")).toMatch(/투입구.*방호|안전난간|인터록|단독.*금지|감시/);

    const aerialObstructionReleaseFall = viewFor("sif-아카이브-건설업-03207");
    expect(aerialObstructionReleaseFall.hazard).toMatch(/고소작업대|가드|비계파이프|걸림|반동|출렁|추락/);
    expect(aerialObstructionReleaseFall.controls.join(" ")).toMatch(/하강|고정|걸림.*해소|절단.*금지|안전대|구조/);

    const automatedLinePinch = viewFor("sif-아카이브-제조업등-00276");
    expect(automatedLinePinch.hazard).toMatch(/자동화|이재기|컨베이어.*프레임|끼임|협착|가동부/);
    expect(automatedLinePinch.controls.join(" ")).toMatch(/방호|감응|인터록|비상정지|전원 차단|LOTO/);
    expect(automatedLinePinch.hazard).not.toMatch(/상부.*통행.*추락/);

    for (const id of [
      "sif-아카이브-제조업등-01282",
      "sif-아카이브-제조업등-01556"
    ]) {
      const incidentalConveyorMention = viewFor(id);
      expect(incidentalConveyorMention.hazard, id).toMatch(/추락|떨어짐|사다리|작업발판|개구부/);
      expect(incidentalConveyorMention.hazard, id).not.toMatch(/가동 중 컨베이어 상부를 통행/);
      expect(incidentalConveyorMention.controls.join(" "), id).not.toMatch(/컨베이어 전원을 차단.*LOTO/);
    }

    const palletFootholdFall = viewFor("sif-아카이브-제조업등-02315");
    expect(palletFootholdFall.hazard).toMatch(/파렛트|임시.*발판|발을 딛|균형|추락/);
    expect(palletFootholdFall.controls.join(" ")).toMatch(/승인된.*작업발판|파렛트.*발판.*금지|안전난간/);
    expect(palletFootholdFall.controls.join(" ")).not.toMatch(/낙하 예상 작업반경|컨베이어 전원/);

    const laundryLoadPushFall = viewFor("sif-아카이브-제조업등-02462");
    expect(laundryLoadPushFall.hazard).toMatch(/세탁물|운반물|쏟아|밀려|작업대|추락/);
    expect(laundryLoadPushFall.controls.join(" ")).toMatch(/작업대.*안전난간|운반물.*고정|낙하.*통제|작업자.*분리/);

    const craneLiftedConveyorRiding = viewFor("sif-아카이브-제조업등-00898");
    expect(craneLiftedConveyorRiding.hazard).toMatch(/크레인|매달|컨베이어|탑승|기울|추락/);
    expect(craneLiftedConveyorRiding.controls.join(" ")).toMatch(/매달린.*하중.*탑승.*금지|줄걸이|무게중심|고소작업대|작업발판/);
    expect(craneLiftedConveyorRiding.controls.join(" ")).not.toMatch(/컨베이어 전원을 차단.*LOTO/);

    for (const id of [
      "sif-아카이브-제조업등-01420",
      "sif-아카이브-제조업등-01931"
    ]) {
      const excavatorBucketRiding = viewFor(id);
      expect(excavatorBucketRiding.hazard, id).toMatch(/굴삭기|버킷|승차석 외|용도 외|탑승|추락/);
      expect(excavatorBucketRiding.controls.join(" "), id).toMatch(/버킷.*탑승.*금지|승인된.*고소작업대|비계|작업발판|안전대/);
      expect(excavatorBucketRiding.controls.join(" "), id).not.toMatch(/컨베이어 횡단용|건널다리/);
    }

    const pureOpeningFall = viewFor("sif-아카이브-건설업-00491");
    expect(pureOpeningFall.hazard).toMatch(/개구부|단부|추락/);
    expect(pureOpeningFall.controls.join(" ")).toMatch(/안전난간|개구부|안전대/);
    expect(pureOpeningFall.controls.join(" ")).not.toMatch(/물체.*고정.*결속|낙하 예상 작업반경/);

    const exitingCrusherVehicle = viewFor("sif-아카이브-제조업등-01184");
    expect(exitingCrusherVehicle.hazard).toMatch(/차량|출차|충돌|깔림|동선/);
    expect(exitingCrusherVehicle.controls.join(" ")).toMatch(/동선|신호수|사각지대|접근통제/);
    expect(exitingCrusherVehicle.controls.join(" ")).not.toMatch(/승하차.*3점 지지/);

    const pumpCarBrakeRelease = viewFor("sif-아카이브-건설업-00525");
    expect(pumpCarBrakeRelease.hazard).toMatch(/펌프카|제동|불시.*이동|밀림|협착/);
    expect(pumpCarBrakeRelease.controls.join(" ")).toMatch(/주차브레이크|고임목|공압|제동.*에너지|차량.*고정|접근통제/);
    expect(pumpCarBrakeRelease.controls.join(" ")).not.toMatch(/회전체 방호|가동부.*방호덮개/);

    const excavatorSwingPinch = viewFor("sif-아카이브-건설업-02479");
    expect(excavatorSwingPinch.hazard).toMatch(/굴삭기|선회|뒷부분|굴착사면|협착|끼임/);
    expect(excavatorSwingPinch.controls.join(" ")).toMatch(/선회반경|출입통제|신호수|접근.*정지|사각지대/);
    expect(excavatorSwingPinch.controls.join(" ")).not.toMatch(/회전체 방호|LOTO/);

    for (const id of [
      "sif-아카이브-제조업등-00114",
      "sif-아카이브-제조업등-00337",
      "sif-아카이브-제조업등-02306"
    ]) {
      const directFire = viewFor(id);
      expect(directFire.hazard, id).toMatch(/화재|폭발|화염|검토 필요/);
      expect(directFire.controls.join(" "), id).toMatch(/점화원|가연물|원인|작업 중지|출입통제|검토/);
      expect(directFire.controls.join(" "), id).not.toMatch(/가동부 방호덮개.*비상정지/);
    }

    const directElectricalContact = viewFor("sif-아카이브-제조업등-00409");
    expect(directElectricalContact.hazard).toMatch(/충전부|감전/);
    expect(directElectricalContact.controls.join(" ")).toMatch(/전원 차단|검전|접지|절연/);

    for (const id of [
      "sif-아카이브-제조업등-01202",
      "sif-아카이브-제조업등-01227"
    ]) {
      const unstableHeavyPart = viewFor(id);
      expect(unstableHeavyPart.hazard, id).toMatch(/물체|부재|하중|동력전달판|케이싱|낙하|전도|타격|깔림/);
      expect(unstableHeavyPart.controls.join(" "), id).toMatch(/고정|결속|받침|지지|작업반경|출입통제/);
      expect(unstableHeavyPart.controls.join(" "), id).not.toMatch(/작업발판.*안전난간|가동부 방호덮개/);
    }

    const abrasiveWheelFragment = viewFor("sif-아카이브-제조업등-00602");
    expect(abrasiveWheelFragment.hazard).toMatch(/그라인더|연삭숫돌|파편|비래|타격/);
    expect(abrasiveWheelFragment.controls.join(" ")).toMatch(/방호덮개|정격.*회전|균열|보안면|보안경/);

    const springStoredEnergy = viewFor("sif-아카이브-제조업등-02549");
    expect(springStoredEnergy.hazard).toMatch(/스프링|텐션|저장에너지|파단|비래|타격/);
    expect(springStoredEnergy.controls.join(" ")).toMatch(/장력|감압|지그|고정|방출|출입통제/);
    expect(springStoredEnergy.controls.join(" ")).not.toMatch(/후진 경보|작업발판.*안전난간/);
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
