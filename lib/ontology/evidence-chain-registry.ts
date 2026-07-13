import type { ReviewState } from "@/lib/ontology/schema";

export const EVIDENCE_CHAIN_CONTRACT_VERSION = "phase-a-evidence-chains/1.1.0" as const;
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
  productionChunkBridge: "absent" as const,
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
  evidenceId: string;
  itemId: string;
  productionItemId: string;
  guideCode: string;
  citedUid: string;
  chunk: {
    chunkId: string;
    chunkIdFragment: string;
    chunkCitedUid: string;
    page: number;
    location: string;
    supportStatement: string;
  };
  registryMapping:
    | "mapped"
    | "direct_support_missing"
    | "task_scope_mismatch"
    | "registry_control_missing";
  provenanceBridge: "unresolved";
  productionRowStatus: "ready";
  localSnapshotState: "current-unverified";
  role: "technical_guidance_only";
};

export type EvidenceControlDefinition = {
  controlId: string;
  graphControlNodeId: string;
  label: string;
  applicabilityCondition: string;
  lawArticles: readonly string[];
  guidanceEvidenceIds: readonly string[];
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
  "172": {
    sourceType: "law",
    relation: "mandatedBy",
    articleNo: "172",
    title: "안전보건규칙 제172조(접촉의 방지)",
    citedUid: "law:산업안전보건기준에 관한 규칙:제172조",
    officialUrl:
      "https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=1000727233",
    effectiveDate: CURRENT_LAW_EFFECTIVE_DATE,
    graphArticleNodeId: "Article_기준규칙_172",
    layer: "published_graph",
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
  productionItemId: string;
  guideCode: string;
  chunkId: string;
  chunkIdFragment: string;
  page: number;
  supportStatement: string;
  registryMapping?: KoshaGuidanceRecord["registryMapping"];
}): KoshaGuidanceRecord {
  return {
    sourceType: "kosha_guidance",
    evidenceId: `${input.itemId}#${input.chunkId}`,
    itemId: input.itemId,
    productionItemId: input.productionItemId,
    guideCode: input.guideCode,
    citedUid: `ref:safety_reference_items:${input.productionItemId}`,
    chunk: {
      chunkId: input.chunkId,
      chunkIdFragment: input.chunkIdFragment,
      chunkCitedUid: `manual:kosha-body-recovery-2026-07-12-v3/${input.chunkId}`,
      page: input.page,
      location: `physical_page_${input.page}`,
      supportStatement: input.supportStatement,
    },
    registryMapping: input.registryMapping ?? "mapped",
    provenanceBridge: "unresolved",
    productionRowStatus: "ready",
    localSnapshotState: "current-unverified",
    role: "technical_guidance_only",
    reviewState: "draft",
    resolution: "unresolved",
  };
}

const FALL_GUIDANCE = [
  guidance({
    itemId: "kosha-a3c8a491f835c6eaf5109705",
    productionItemId:
      "technical-support-01-0043-c-74-2015-건설공사의-고소작업대-안전보건작업지침",
    guideCode: "C-74",
    chunkId: "kosha-chunk-470a9a64364fcf013b0127ff",
    chunkIdFragment: "470a9a64364fcf013b0127ff",
    page: 11,
    supportStatement:
      "고소작업대 상부 안전난간에 올라서지 않고, 작업 중 난간을 제거하지 않으며, 탑승 후 출입문을 고정한다.",
    registryMapping: "direct_support_missing",
  }),
  guidance({
    itemId: "kosha-07e82640daba8e37ebb73cdb",
    productionItemId:
      "technical-support-01-0073-d-c-7-2026-비계-구조-및-안전작업에-관한-기술지원규정",
    guideCode: "D-C-7",
    chunkId: "kosha-chunk-784b7f55fa7a16fe52255cec",
    chunkIdFragment: "784b7f55fa7a16fe52255cec",
    page: 19,
    supportStatement:
      "높이 2미터 이상 비계에 작업발판을 설치하고, 발판을 띠장과 둘 이상의 지지물에 고정하여 탈락과 추락을 방지한다.",
  }),
  guidance({
    itemId: "kosha-07e82640daba8e37ebb73cdb",
    productionItemId:
      "technical-support-01-0073-d-c-7-2026-비계-구조-및-안전작업에-관한-기술지원규정",
    guideCode: "D-C-7",
    chunkId: "kosha-chunk-dd07e81d5176bd73484f685e",
    chunkIdFragment: "dd07e81d5176bd73484f685e",
    page: 58,
    supportStatement:
      "전신형 안전대의 고리를 안전대 부착설비에 직접 체결하고, 부착설비를 비계와 별도의 구조물에 고정한다.",
  }),
  guidance({
    itemId: "kosha-1cad3b4b264aa96277dcfae8",
    productionItemId:
      "technical-support-06-0001-a-g-1-2025-추락방호망-설치-기술지원규정-수직형-추락방망-설치",
    guideCode: "A-G-1",
    chunkId: "kosha-chunk-57c50cf2248cf860969982a4",
    chunkIdFragment: "57c50cf2248cf860969982a4",
    page: 7,
    supportStatement:
      "작업발판 설치가 곤란한 경우 추락방호망 또는 안전대 대체조치를 두고, 작업발판·통로 끝과 개구부의 난간·울타리·망·덮개 방호를 다룬다.",
  }),
] as const;

const ENTRAPMENT_GUIDANCE = [
  guidance({
    itemId: "kosha-2817664393f505499a71d63d",
    productionItemId: "technical-support-01-0024-c-48-2022-건설기계-안전보건작업지침",
    guideCode: "C-48",
    chunkId: "kosha-chunk-1602e569f8fbe9c789d06cbc",
    chunkIdFragment: "1602e569f8fbe9c789d06cbc",
    page: 4,
    supportStatement:
      "건설기계 작업계획, 유자격 운전자와 신호수 배치, 건설기계 작업범위의 비작업자 출입금지를 다룬다.",
    registryMapping: "task_scope_mismatch",
  }),
  guidance({
    itemId: "kosha-32d7faa3ac4ef74e48d959d4",
    productionItemId:
      "technical-support-01-0070-d-c-4-2025-굴착기-안전보건작업-기술지원규정",
    guideCode: "D-C-4",
    chunkId: "kosha-chunk-318945791a391ef2ab83fc8b",
    chunkIdFragment: "318945791a391ef2ab83fc8b",
    page: 20,
    supportStatement:
      "굴착기 작업반경 내 근로자를 확인하고 붐·암·버킷 선회로 위험한 구역의 출입을 제한한다.",
    registryMapping: "task_scope_mismatch",
  }),
  guidance({
    itemId: "kosha-c6bba4fd3e9a9305c1edce41",
    productionItemId:
      "technical-support-02-0033-b-m-37-2026-회전기계-등의-끼임-절단재해-예방을-위한-기술지원규정",
    guideCode: "B-M-37",
    chunkId: "kosha-chunk-9a5c5df7fc303f229134ead0",
    chunkIdFragment: "9a5c5df7fc303f229134ead0",
    page: 15,
    supportStatement:
      "회전기계 위험부 접근을 막는 견고한 방호장치와 인터록 등 접근 반응형 방호를 다룬다.",
    registryMapping: "registry_control_missing",
  }),
  guidance({
    itemId: "kosha-c6bba4fd3e9a9305c1edce41",
    productionItemId:
      "technical-support-02-0033-b-m-37-2026-회전기계-등의-끼임-절단재해-예방을-위한-기술지원규정",
    guideCode: "B-M-37",
    chunkId: "kosha-chunk-6f5898c423e8425d84201656",
    chunkIdFragment: "6f5898c423e8425d84201656",
    page: 40,
    supportStatement:
      "컨베이어 유지보수에 록아웃·태그아웃을 적용하고, 유지보수 전 정지와 재기동 방지조치를 둔다.",
    registryMapping: "task_scope_mismatch",
  }),
] as const;

const ELECTRICAL_GUIDANCE = [
  guidance({
    itemId: "kosha-7161ec0c8b05f2cccbe519b3",
    productionItemId:
      "technical-support-09-0002-b-e-10-2026-정전전로-및-그-인근에서의-전기작업에-관한-기술지원규정",
    guideCode: "B-E-10",
    chunkId: "kosha-chunk-c300b03bbb724268225a73f7",
    chunkIdFragment: "c300b03bbb724268225a73f7",
    page: 9,
    supportStatement:
      "정전 범위와 차단 위치를 계획하고 개폐기 잠금·통전금지 표지·검전·잔류전하 방전·단락접지를 확인한다.",
  }),
  guidance({
    itemId: "kosha-a8a1ea385da644ac8f48149f",
    productionItemId:
      "technical-support-09-0003-b-e-11-2026-충전전로-및-그-인근에서의-전기작업에-관한-기술지원규정",
    guideCode: "B-E-11",
    chunkId: "kosha-chunk-7f40eb9fd888ee9a78bde37e",
    chunkIdFragment: "7f40eb9fd888ee9a78bde37e",
    page: 7,
    supportStatement:
      "절연되지 않은 충전부 접근을 막는 울타리와 접근한계거리, 감시인 배치를 다룬다.",
  }),
  guidance({
    itemId: "kosha-a8a1ea385da644ac8f48149f",
    productionItemId:
      "technical-support-09-0003-b-e-11-2026-충전전로-및-그-인근에서의-전기작업에-관한-기술지원규정",
    guideCode: "B-E-11",
    chunkId: "kosha-chunk-ddd57dc246a2ae6e93f5aa14",
    chunkIdFragment: "ddd57dc246a2ae6e93f5aa14",
    page: 15,
    supportStatement:
      "활선작업 시 임시 절연·방호책을 두고 충전부로부터 충분한 이격거리를 확보하며 절연 공구를 사용한다.",
  }),
  guidance({
    itemId: "kosha-a8a1ea385da644ac8f48149f",
    productionItemId:
      "technical-support-09-0003-b-e-11-2026-충전전로-및-그-인근에서의-전기작업에-관한-기술지원규정",
    guideCode: "B-E-11",
    chunkId: "kosha-chunk-1828d0072421b7434a65cdba",
    chunkIdFragment: "1828d0072421b7434a65cdba",
    page: 16,
    supportStatement:
      "충전부 접촉 위험에 절연용 보호구·방호구를 사용하고, 충전전로 인근 차량·기계 작업은 보호구 또는 안전거리를 유지한다.",
  }),
  guidance({
    itemId: "kosha-7e511f17893129148a46714c",
    productionItemId:
      "technical-support-09-0022-b-e-9-2026-접지설비에-관한-기술지원규정",
    guideCode: "B-E-9",
    chunkId: "kosha-chunk-77d92b287dac21705c7eff74",
    chunkIdFragment: "77d92b287dac21705c7eff74",
    page: 10,
    supportStatement:
      "누전 감전 위험이 있는 전기기계·기구의 금속제 외함·외피·철대와 노출 비충전 금속체의 접지를 다룬다.",
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
        graphControlNodeId: "Control_작업발판_설치_추락방호망_설치",
        label: "작업발판을 설치하고 곤란한 경우 추락방호망 등 대체조치를 검토한다",
        applicabilityCondition: "추락하거나 넘어질 위험이 있는 장소에서 작업하는 경우",
        lawArticles: ["42"],
        guidanceEvidenceIds: [FALL_GUIDANCE[1].evidenceId, FALL_GUIDANCE[3].evidenceId],
        riskAssessmentSection: "추락 위험 감소대책",
        tbmSection: "작업발판·추락방호 확인",
        confirmationQuestion: "작업발판 또는 현장조건에 맞는 추락방지 조치를 확인했습니까?",
      },
      {
        controlId: "fall-opening-guard",
        graphControlNodeId: "Control_개구부_단부_안전난간_덮개_설치",
        label: "개구부와 작업발판 끝에 안전난간·울타리·덮개 등 방호조치를 검토한다",
        applicabilityCondition: "작업발판 끝 또는 개구부로 추락할 위험이 있는 경우",
        lawArticles: ["43"],
        guidanceEvidenceIds: [FALL_GUIDANCE[3].evidenceId],
        riskAssessmentSection: "개구부 방호조치",
        tbmSection: "개구부·단부 상태 확인",
        confirmationQuestion: "개구부와 단부의 난간·덮개 상태를 확인했습니까?",
      },
      {
        controlId: "fall-anchor",
        graphControlNodeId: "Control_안전대_부착설비_지지로프_설치",
        label: "안전대 사용 시 안전대 부착설비와 지지로프 설치 상태를 검토한다",
        applicabilityCondition: "높이 2미터 이상의 장소에서 근로자에게 안전대를 착용시켜 작업하는 경우",
        lawArticles: ["44"],
        guidanceEvidenceIds: [FALL_GUIDANCE[2].evidenceId],
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
    aliases: [
      "차량계·기계 인접작업",
      "차량계 기계 인접작업",
      "차량계 하역운반기계 인접 작업",
      "지게차 작업",
    ],
    hazard: { nodeId: "Hazard_충돌_협착_끼임", label: "끼임" },
    sif: [
      sif("sif-아카이브-건설업-00024", "23 / 토공사 / 굴착 작업", 1),
      sif("sif-아카이브-건설업-00074", "73 / 토공사 / 흙막이 지보공 작업", 2),
    ],
    reviewOnlyEvidence: [
      sif("sif-아카이브-건설업-01985", "1984 / 전기·기계 설비공사 / 기계설비 작업", 99, false),
    ],
    guidance: ENTRAPMENT_GUIDANCE,
    lawArticles: ["172"],
    controls: [
      {
        controlId: "vehicle-contact-prevention",
        graphControlNodeId: "Control_유도자_배치_및_접촉위험구역_출입통제",
        label: "운행경로와 작업자 동선을 분리하고 출입통제 또는 유도자 배치를 검토한다",
        applicabilityCondition: "차량계 하역운반기계등 운행 중 근로자 접촉 위험이 있는 경우",
        lawArticles: ["172"],
        guidanceEvidenceIds: [],
        riskAssessmentSection: "차량계 기계 접촉방지",
        tbmSection: "동선분리·유도자 확인",
        confirmationQuestion: "장비 운행반경의 출입통제와 유도자 배치를 확인했습니까?",
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
        graphControlNodeId: "Control_충전부_방호_폐쇄형_외함_절연덮개",
        label: "노출 충전부를 외함·방호망·절연덮개 등으로 방호하는 조치를 검토한다",
        applicabilityCondition: "작업 또는 통행 중 충전부 접촉·접근으로 감전 위험이 있는 경우",
        lawArticles: ["301"],
        guidanceEvidenceIds: [ELECTRICAL_GUIDANCE[1].evidenceId, ELECTRICAL_GUIDANCE[2].evidenceId],
        riskAssessmentSection: "충전부 방호",
        tbmSection: "충전부 노출 상태 확인",
        confirmationQuestion: "노출 충전부의 외함·덮개·방호 상태를 확인했습니까?",
      },
      {
        controlId: "electrical-grounding",
        graphControlNodeId: "Control_전기_기계_기구_접지",
        label: "누전 위험이 있는 금속제 외함 등의 접지 상태를 검토한다",
        applicabilityCondition: "전기 기계·기구의 누전에 의한 감전 위험이 있는 경우",
        lawArticles: ["302"],
        guidanceEvidenceIds: [ELECTRICAL_GUIDANCE[4].evidenceId],
        riskAssessmentSection: "접지·누전 방지",
        tbmSection: "접지 상태 확인",
        confirmationQuestion: "외함과 설비의 접지 상태를 확인했습니까?",
      },
      {
        controlId: "electrical-deenergized-isolation",
        graphControlNodeId: "Control_정전작업_전로차단_잠금_꼬리표_검전_방전",
        label: "정전작업 전 전로 차단·잠금·표지·방전·검전 절차를 검토한다",
        applicabilityCondition: "노출 충전부 또는 그 부근에서 정전작업을 수행하는 경우",
        lawArticles: ["319"],
        guidanceEvidenceIds: [ELECTRICAL_GUIDANCE[0].evidenceId],
        riskAssessmentSection: "정전작업 절차",
        tbmSection: "차단·잠금·검전 확인",
        confirmationQuestion: "전로 차단, 잠금표지, 방전과 검전을 순서대로 확인했습니까?",
      },
      {
        controlId: "electrical-live-work-distance",
        graphControlNodeId: "Control_충전전로_접근한계거리_유지_절연방호",
        label: "충전전로 작업 시 접근한계거리와 절연방호 조치를 검토한다",
        applicabilityCondition: "충전전로를 취급하거나 그 인근에서 작업하는 경우",
        lawArticles: ["321"],
        guidanceEvidenceIds: [ELECTRICAL_GUIDANCE[2].evidenceId, ELECTRICAL_GUIDANCE[3].evidenceId],
        riskAssessmentSection: "충전전로 접근·방호",
        tbmSection: "접근한계거리·절연방호 확인",
        confirmationQuestion: "접근한계거리와 절연방호 상태를 확인했습니까?",
      },
      {
        controlId: "electrical-insulating-ppe",
        graphControlNodeId: "Control_절연용_보호구_방호구_사용",
        label: "충전부 접촉 위험에 적합한 절연용 보호구·방호구 사용을 검토한다",
        applicabilityCondition: "충전전로 또는 충전부 접촉 위험이 있는 작업을 수행하는 경우",
        lawArticles: ["323"],
        guidanceEvidenceIds: [ELECTRICAL_GUIDANCE[3].evidenceId],
        riskAssessmentSection: "절연용 보호구·방호구",
        tbmSection: "절연보호구·방호구 확인",
        confirmationQuestion: "작업에 적합한 절연용 보호구와 방호구를 확인했습니까?",
      },
    ],
  },
]);

export function getLawEvidence(articleNo: string): LawEvidenceRecord | null {
  return LAW_EVIDENCE_BY_ARTICLE[articleNo] ?? null;
}
