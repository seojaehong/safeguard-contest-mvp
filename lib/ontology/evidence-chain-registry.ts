import type { ReviewState } from "@/lib/ontology/schema";

export const EVIDENCE_CHAIN_CONTRACT_VERSION = "phase-a-evidence-chains/1.0.0" as const;
export const CURRENT_LAW_EFFECTIVE_DATE = "2026-03-02" as const;

export const SIF_CORPUS_STATE = Object.freeze({
  prepared: true,
  embedded: false,
  uploaded: false,
  ontologyPromoted: false,
});

export const KOSHA_CORPUS_STATE = Object.freeze({
  launchReady: false,
  bodyMissingCount: 1,
  downloadProvenance: "incomplete" as const,
});

export const EXCLUDED_KOSHA_ITEM_IDS = Object.freeze([
  "kosha-60492776122f8b433994fc10",
] as const);

export type EvidenceResolutionState = "resolved" | "unresolved";

export type EvidenceReviewStatus = {
  reviewState: ReviewState;
  resolution: EvidenceResolutionState;
};

export type LawEvidenceRecord = EvidenceReviewStatus & {
  sourceType: "law";
  relation: "mandatedBy";
  articleNo: string;
  title: string;
  citedUid: string;
  officialUrl: string;
  effectiveDate: typeof CURRENT_LAW_EFFECTIVE_DATE;
  graphArticleNodeId: string | null;
  layer: "published_graph" | "official_current_overlay";
};

export type SifEvidenceRecord = EvidenceReviewStatus & {
  sourceType: "sif_case";
  itemId: string;
  title: string;
  citedUid: string;
  rank: number;
  role: "hazard_priority_only";
  autoConfirm: boolean;
};

export type KoshaGuidanceRecord = EvidenceReviewStatus & {
  sourceType: "kosha_guidance";
  itemId: string;
  guideCode: string;
  citedUid: string;
  chunk: {
    chunkId: string | null;
    chunkIdFragment: string;
    chunkCitedUid: string | null;
    page: number;
  };
  role: "technical_guidance_only";
};

export type EvidenceControlDefinition = {
  controlId: string;
  label: string;
  applicabilityCondition: string;
  lawArticles: readonly string[];
  guidanceItemIds: readonly string[];
  riskAssessmentSection: string;
  tbmSection: string;
  confirmationQuestion: string;
};

export type EvidenceChainDefinition = {
  chainId:
    | "work-at-height-fall"
    | "vehicle-machinery-entrapment"
    | "electrical-work-electrocution";
  label: string;
  canonicalTaskNodeId: string;
  canonicalTaskLabel: string;
  aliases: readonly string[];
  hazard: {
    nodeId: string;
    label: string;
  };
  sif: readonly SifEvidenceRecord[];
  reviewOnlyEvidence: readonly SifEvidenceRecord[];
  guidance: readonly KoshaGuidanceRecord[];
  lawArticles: readonly string[];
  controls: readonly EvidenceControlDefinition[];
};

const LAW_EVIDENCE_BY_ARTICLE: Readonly<Record<string, LawEvidenceRecord>> = Object.freeze({
  "42": {
    sourceType: "law",
    relation: "mandatedBy",
    articleNo: "42",
    title: "안전보건규칙 제42조(추락의 방지)",
    citedUid: "law:산업안전보건기준에 관한 규칙:제42조",
    officialUrl: "https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024005275",
    effectiveDate: CURRENT_LAW_EFFECTIVE_DATE,
    graphArticleNodeId: "Article_기준규칙_42",
    layer: "published_graph",
    reviewState: "published",
    resolution: "resolved",
  },
  "43": {
    sourceType: "law",
    relation: "mandatedBy",
    articleNo: "43",
    title: "안전보건규칙 제43조(개구부 등의 방호 조치)",
    citedUid: "law:산업안전보건기준에 관한 규칙:제43조",
    officialUrl: "https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1028063341",
    effectiveDate: CURRENT_LAW_EFFECTIVE_DATE,
    graphArticleNodeId: "Article_기준규칙_43",
    layer: "published_graph",
    reviewState: "published",
    resolution: "resolved",
  },
  "44": {
    sourceType: "law",
    relation: "mandatedBy",
    articleNo: "44",
    title: "안전보건규칙 제44조(안전대의 부착설비 등)",
    citedUid: "law:산업안전보건기준에 관한 규칙:제44조",
    officialUrl: "https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1016700539",
    effectiveDate: CURRENT_LAW_EFFECTIVE_DATE,
    graphArticleNodeId: "Article_기준규칙_44",
    layer: "published_graph",
    reviewState: "published",
    resolution: "resolved",
  },
  "92": {
    sourceType: "law",
    relation: "mandatedBy",
    articleNo: "92",
    title: "안전보건규칙 제92조(정비 등의 작업 시의 운전정지 등)",
    citedUid: "law:산업안전보건기준에 관한 규칙:제92조",
    officialUrl:
      "https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0092&lsiSeq=273603&urlMode=lsScJoRltInfoR",
    effectiveDate: CURRENT_LAW_EFFECTIVE_DATE,
    graphArticleNodeId: null,
    layer: "official_current_overlay",
    reviewState: "published",
    resolution: "resolved",
  },
  "200": {
    sourceType: "law",
    relation: "mandatedBy",
    articleNo: "200",
    title: "안전보건규칙 제200조(접촉 방지)",
    citedUid: "law:산업안전보건기준에 관한 규칙:제200조",
    officialUrl:
      "https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=1000727229",
    effectiveDate: CURRENT_LAW_EFFECTIVE_DATE,
    graphArticleNodeId: null,
    layer: "official_current_overlay",
    reviewState: "published",
    resolution: "resolved",
  },
  "301": {
    sourceType: "law",
    relation: "mandatedBy",
    articleNo: "301",
    title: "안전보건규칙 제301조(전기 기계·기구 등의 충전부 방호)",
    citedUid: "law:산업안전보건기준에 관한 규칙:제301조",
    officialUrl:
      "https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024005221",
    effectiveDate: CURRENT_LAW_EFFECTIVE_DATE,
    graphArticleNodeId: "Article_기준규칙_301",
    layer: "published_graph",
    reviewState: "published",
    resolution: "resolved",
  },
  "302": {
    sourceType: "law",
    relation: "mandatedBy",
    articleNo: "302",
    title: "안전보건규칙 제302조(전기 기계·기구의 접지)",
    citedUid: "law:산업안전보건기준에 관한 규칙:제302조",
    officialUrl:
      "https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1030668033",
    effectiveDate: CURRENT_LAW_EFFECTIVE_DATE,
    graphArticleNodeId: "Article_기준규칙_302",
    layer: "published_graph",
    reviewState: "published",
    resolution: "resolved",
  },
  "319": {
    sourceType: "law",
    relation: "mandatedBy",
    articleNo: "319",
    title: "안전보건규칙 제319조(정전전로에서의 전기작업)",
    citedUid: "law:산업안전보건기준에 관한 규칙:제319조",
    officialUrl:
      "https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029038625",
    effectiveDate: CURRENT_LAW_EFFECTIVE_DATE,
    graphArticleNodeId: "Article_기준규칙_319",
    layer: "published_graph",
    reviewState: "published",
    resolution: "resolved",
  },
  "321": {
    sourceType: "law",
    relation: "mandatedBy",
    articleNo: "321",
    title: "안전보건규칙 제321조(충전전로에서의 전기작업)",
    citedUid: "law:산업안전보건기준에 관한 규칙:제321조",
    officialUrl:
      "https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029038625",
    effectiveDate: CURRENT_LAW_EFFECTIVE_DATE,
    graphArticleNodeId: "Article_기준규칙_321",
    layer: "published_graph",
    reviewState: "published",
    resolution: "resolved",
  },
  "323": {
    sourceType: "law",
    relation: "mandatedBy",
    articleNo: "323",
    title: "안전보건규칙 제323조(절연용 보호구 등의 사용)",
    citedUid: "law:산업안전보건기준에 관한 규칙:제323조",
    officialUrl:
      "https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029038625",
    effectiveDate: CURRENT_LAW_EFFECTIVE_DATE,
    graphArticleNodeId: "Article_기준규칙_323",
    layer: "published_graph",
    reviewState: "published",
    resolution: "resolved",
  },
});

function sif(itemId: string, title: string, rank: number, autoConfirm = true): SifEvidenceRecord {
  return {
    sourceType: "sif_case",
    itemId,
    title,
    citedUid: `ref:safety_reference_items:${itemId}`,
    rank,
    role: "hazard_priority_only",
    autoConfirm,
    reviewState: "draft",
    resolution: "unresolved",
  };
}

function guidance(input: {
  itemId: string;
  guideCode: string;
  chunkId?: string;
  chunkIdFragment: string;
  page: number;
}): KoshaGuidanceRecord {
  const chunkId = input.chunkId ?? null;
  return {
    sourceType: "kosha_guidance",
    itemId: input.itemId,
    guideCode: input.guideCode,
    citedUid: `ref:safety_reference_items:${input.itemId}`,
    chunk: {
      chunkId,
      chunkIdFragment: input.chunkIdFragment,
      chunkCitedUid: chunkId ? `kb:kb_chunks:${chunkId}` : null,
      page: input.page,
    },
    role: "technical_guidance_only",
    reviewState: "draft",
    resolution: "unresolved",
  };
}

const FALL_GUIDANCE = [
  guidance({
    itemId: "kosha-a3c8a491f835c6eaf5109705",
    guideCode: "C-74",
    chunkId: "kosha-chunk-470a9a64364fcf013b0127ff",
    chunkIdFragment: "470a9a64364fcf013b0127ff",
    page: 11,
  }),
  guidance({
    itemId: "kosha-07e82640daba8e37ebb73cdb",
    guideCode: "D-C-7",
    chunkId: "kosha-chunk-784b7f55fa7a16fe52255cec",
    chunkIdFragment: "784b7f55fa7a16fe52255cec",
    page: 19,
  }),
] as const;

const ENTRAPMENT_GUIDANCE = [
  guidance({
    itemId: "kosha-2817664393f505499a71d63d",
    guideCode: "C-48",
    chunkIdFragment: "1602e569",
    page: 4,
  }),
  guidance({
    itemId: "kosha-32d7faa3ac4ef74e48d959d4",
    guideCode: "D-C-4",
    chunkIdFragment: "318945",
    page: 20,
  }),
  guidance({
    itemId: "kosha-c6bba4fd3e9a9305c1edce41",
    guideCode: "B-M-37",
    chunkIdFragment: "9a5c5d",
    page: 15,
  }),
] as const;

const ELECTRICAL_GUIDANCE = [
  guidance({
    itemId: "kosha-7161ec0c8b05f2cccbe519b3",
    guideCode: "B-E-10",
    chunkIdFragment: "c300b03",
    page: 9,
  }),
  guidance({
    itemId: "kosha-a8a1ea385da644ac8f48149f",
    guideCode: "B-E-11",
    chunkIdFragment: "1828d007",
    page: 16,
  }),
] as const;

export const EVIDENCE_CHAIN_REGISTRY: readonly EvidenceChainDefinition[] = Object.freeze([
  {
    chainId: "work-at-height-fall",
    label: "고소작업 → 추락",
    canonicalTaskNodeId: "Task_work_at_height",
    canonicalTaskLabel: "고소작업",
    aliases: ["고소 작업", "고소 작업대 작업", "고소작업대 작업", "높은 곳 작업"],
    hazard: { nodeId: "Hazard_추락", label: "추락" },
    sif: [
      sif("sif-아카이브-건설업-00323", "322 / 철근콘크리트 공사 / 거푸집 작업", 1),
      sif("sif-아카이브-건설업-00668", "667 / 철골공사 / 철골 작업", 2),
    ],
    reviewOnlyEvidence: [],
    guidance: FALL_GUIDANCE,
    lawArticles: ["42", "43", "44"],
    controls: [
      {
        controlId: "fall-work-platform",
        label: "작업발판을 설치하고 곤란한 경우 추락방호망 등 대체조치를 검토한다",
        applicabilityCondition: "추락하거나 넘어질 위험이 있는 장소에서 작업하는 경우",
        lawArticles: ["42"],
        guidanceItemIds: [FALL_GUIDANCE[0].itemId],
        riskAssessmentSection: "추락 위험 감소대책",
        tbmSection: "작업발판·추락방호 확인",
        confirmationQuestion: "작업발판 또는 현장조건에 맞는 추락방지 조치를 확인했습니까?",
      },
      {
        controlId: "fall-opening-guard",
        label: "개구부와 작업발판 끝에 안전난간·울타리·덮개 등 방호조치를 검토한다",
        applicabilityCondition: "작업발판 끝 또는 개구부로 추락할 위험이 있는 경우",
        lawArticles: ["43"],
        guidanceItemIds: [FALL_GUIDANCE[0].itemId],
        riskAssessmentSection: "개구부 방호조치",
        tbmSection: "개구부·단부 상태 확인",
        confirmationQuestion: "개구부와 단부의 난간·덮개 상태를 확인했습니까?",
      },
      {
        controlId: "fall-anchor",
        label: "안전대 사용 시 안전대 부착설비와 지지로프 설치 상태를 검토한다",
        applicabilityCondition: "안전대를 착용시켜 추락 위험을 방지하는 경우",
        lawArticles: ["44"],
        guidanceItemIds: [FALL_GUIDANCE[1].itemId],
        riskAssessmentSection: "개인 추락방지설비",
        tbmSection: "안전대 체결점 확인",
        confirmationQuestion: "안전대 부착설비와 체결 위치를 작업 전에 확인했습니까?",
      },
    ],
  },
  {
    chainId: "vehicle-machinery-entrapment",
    label: "차량계·기계 인접작업 → 끼임",
    canonicalTaskNodeId: "Task_forklift_loading",
    canonicalTaskLabel: "지게차 상하차",
    aliases: ["차량계·기계 인접작업", "차량계 기계 인접작업", "건설기계 인접 작업", "지게차 작업"],
    hazard: { nodeId: "Hazard_충돌_협착_끼임", label: "끼임" },
    sif: [
      sif("sif-아카이브-건설업-00024", "23 / 토공사 / 굴착 작업", 1),
      sif("sif-아카이브-건설업-00074", "73 / 토공사 / 흙막이 지보공 작업", 2),
    ],
    reviewOnlyEvidence: [
      sif("sif-아카이브-건설업-01985", "1984 / 전기·기계 설비공사 / 기계설비 작업", 99, false),
    ],
    guidance: ENTRAPMENT_GUIDANCE,
    lawArticles: ["92", "200"],
    controls: [
      {
        controlId: "vehicle-contact-prevention",
        label: "운행경로와 작업자 동선을 분리하고 출입통제 또는 유도자 배치를 검토한다",
        applicabilityCondition: "차량계 하역운반기계 운행 중 근로자 접촉 위험이 있는 경우",
        lawArticles: ["200"],
        guidanceItemIds: [ENTRAPMENT_GUIDANCE[0].itemId, ENTRAPMENT_GUIDANCE[1].itemId],
        riskAssessmentSection: "차량계 기계 접촉방지",
        tbmSection: "동선분리·유도자 확인",
        confirmationQuestion: "장비 운행반경의 출입통제와 유도자 배치를 확인했습니까?",
      },
      {
        controlId: "machine-maintenance-isolation",
        label: "정비 전 운전을 정지하고 기동장치 잠금·표지 등 불시기동 방지조치를 검토한다",
        applicabilityCondition: "기계의 청소·급유·검사·수리·조정 작업을 수행하는 경우",
        lawArticles: ["92"],
        guidanceItemIds: [ENTRAPMENT_GUIDANCE[2].itemId],
        riskAssessmentSection: "정비작업 에너지 격리",
        tbmSection: "운전정지·잠금표지 확인",
        confirmationQuestion: "정비 대상의 운전정지와 불시기동 방지조치를 확인했습니까?",
      },
    ],
  },
  {
    chainId: "electrical-work-electrocution",
    label: "전기작업 → 감전",
    canonicalTaskNodeId: "Task_electrical_work",
    canonicalTaskLabel: "전기 작업",
    aliases: ["전기작업", "전기 설비 작업", "전기설비 작업", "전기 정비 작업"],
    hazard: { nodeId: "Hazard_감전_직접_간접_접촉", label: "감전" },
    sif: [
      sif("sif-아카이브-건설업-01798", "1797 / 전기·기계 설비공사 / 전기 설비 작업", 1),
      sif("sif-아카이브-건설업-01879", "1878 / 전기·기계 설비공사 / 전기 설비 작업", 2),
      sif("sif-아카이브-건설업-01819", "1818 / 전기·기계 설비공사 / 전기 설비 작업", 3),
    ],
    reviewOnlyEvidence: [],
    guidance: ELECTRICAL_GUIDANCE,
    lawArticles: ["301", "302", "319", "321", "323"],
    controls: [
      {
        controlId: "electrical-live-part-guarding",
        label: "노출 충전부를 외함·방호망·절연덮개 등으로 방호하는 조치를 검토한다",
        applicabilityCondition: "작업 또는 통행 중 충전부 접촉·접근으로 감전 위험이 있는 경우",
        lawArticles: ["301"],
        guidanceItemIds: [ELECTRICAL_GUIDANCE[0].itemId],
        riskAssessmentSection: "충전부 방호",
        tbmSection: "충전부 노출 상태 확인",
        confirmationQuestion: "노출 충전부의 외함·덮개·방호 상태를 확인했습니까?",
      },
      {
        controlId: "electrical-grounding",
        label: "누전 위험이 있는 금속제 외함 등의 접지 상태를 검토한다",
        applicabilityCondition: "전기 기계·기구의 누전에 의한 감전 위험이 있는 경우",
        lawArticles: ["302"],
        guidanceItemIds: [ELECTRICAL_GUIDANCE[0].itemId],
        riskAssessmentSection: "접지·누전 방지",
        tbmSection: "접지 상태 확인",
        confirmationQuestion: "외함과 설비의 접지 상태를 확인했습니까?",
      },
      {
        controlId: "electrical-deenergized-isolation",
        label: "정전작업 전 전로 차단·잠금·표지·방전·검전 절차를 검토한다",
        applicabilityCondition: "노출 충전부 또는 그 부근에서 정전작업을 수행하는 경우",
        lawArticles: ["319"],
        guidanceItemIds: [ELECTRICAL_GUIDANCE[1].itemId],
        riskAssessmentSection: "정전작업 절차",
        tbmSection: "차단·잠금·검전 확인",
        confirmationQuestion: "전로 차단, 잠금표지, 방전과 검전을 순서대로 확인했습니까?",
      },
      {
        controlId: "electrical-energized-protection",
        label: "충전전로 작업 시 접근한계거리·절연방호·절연용 보호구 사용을 검토한다",
        applicabilityCondition: "충전전로를 취급하거나 그 인근에서 작업하는 경우",
        lawArticles: ["321", "323"],
        guidanceItemIds: [ELECTRICAL_GUIDANCE[0].itemId, ELECTRICAL_GUIDANCE[1].itemId],
        riskAssessmentSection: "충전전로 작업 보호",
        tbmSection: "이격거리·절연보호구 확인",
        confirmationQuestion: "접근한계거리와 절연용 보호구·방호구를 확인했습니까?",
      },
    ],
  },
]);

export function getLawEvidence(articleNo: string): LawEvidenceRecord | null {
  return LAW_EVIDENCE_BY_ARTICLE[articleNo] ?? null;
}
