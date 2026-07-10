export type SafetyReferenceItem = {
  id: string;
  source_id: string;
  item_type: string;
  category: string | null;
  subcategory: string | null;
  title: string;
  summary: string;
  body?: string;
  keywords: string[];
  risk_tags: string[];
  primary_documents: string[];
  controls: string[];
  source_url?: string | null;
  evidence_role?: "direct" | "supporting";
  reflected_documents?: string[];
  short_summary?: string;
  evidence_role_label?: string;
  document_reflection_label?: string;
  source_kind_label?: string;
  operation_signal_label?: string;
  display_title?: string;
  display_summary?: string;
  retrieval_source?: "rest" | "ranked" | "vector" | "hybrid";
  vector_similarity?: number;
};

export type SafetyReferenceOperationalView = {
  hazard: string;
  controls: string[];
  reviewRequired: boolean;
};

export type SafetyReferenceRetrievalMode = "unconfigured" | "rest-ilike" | "ranked-rpc" | "hybrid-vector-rpc";

export type SafetyReferenceVectorStatus = {
  enabled: boolean;
  attempted: boolean;
  ok: boolean;
  reason:
    | "disabled"
    | "missing-openai-key"
    | "embedding-failed"
    | "rpc-missing"
    | "rpc-failed"
    | "no-results"
    | "ready";
  count: number;
  model: string;
  message: string;
};

export type SafetyReferenceSearchResult = {
  ok: boolean;
  configured: boolean;
  query: string;
  count: number;
  items: SafetyReferenceItem[];
  retrievalMode: SafetyReferenceRetrievalMode;
  vectorSearch: SafetyReferenceVectorStatus;
  message: string;
};

export type SafetyReferenceStats = {
  ok: boolean;
  configured: boolean;
  status: "ready" | "degraded" | "unconfigured";
  sources: number;
  items: number;
  expectedTechnicalTotal: number;
  technicalTotal: number;
  technicalSupportRegulations: number;
  technicalGuidelines: number;
  technicalSplitOk: boolean;
  catalogSearchOk: boolean;
  ingestionRuns: number;
  itemTypes: Array<{ itemType: string; count: number }>;
  samples: SafetyReferenceItem[];
  message: string;
};

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type SafetyReferenceVectorRuntime = {
  enabled: boolean;
  apiKey: string | null;
  model: string;
  dimensions: number;
  status: SafetyReferenceVectorStatus;
};

type VectorFetchResult = {
  status: SafetyReferenceVectorStatus;
  items: SafetyReferenceItem[];
};

type CountSpec = {
  label: keyof Pick<
    SafetyReferenceStats,
    "sources" | "items" | "technicalTotal" | "technicalSupportRegulations" | "technicalGuidelines" | "ingestionRuns"
  >;
  table: string;
  filters?: Record<string, string>;
};

const TECHNICAL_SOURCE_ID = "kosha-technical-support-regulations-2025";
const EXPECTED_TECHNICAL_TOTAL = 1040;
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_EMBEDDING_DIMENSIONS = 1536;
const VECTOR_SEARCH_TIMEOUT_MS = 20_000;
const SELECT_FIELDS = [
  "id",
  "source_id",
  "item_type",
  "category",
  "subcategory",
  "title",
  "summary",
  "keywords",
  "risk_tags",
  "primary_documents",
  "controls"
].join(",");

function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return {
    url: url.replace(/\/$/, ""),
    serviceRoleKey
  };
}

export function resolveSafetyReferenceVectorSearchState(
  env: Record<string, string | undefined> = process.env
): SafetyReferenceVectorRuntime {
  const model = env.SAFETY_REFERENCE_EMBEDDING_MODEL || env.OPENAI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const dimensions = readEmbeddingDimensions(env.SAFETY_REFERENCE_EMBEDDING_DIMENSIONS);
  if (env.SAFETY_REFERENCE_VECTOR_SEARCH !== "1") {
    return {
      enabled: false,
      apiKey: null,
      model,
      dimensions,
      status: {
        enabled: false,
        attempted: false,
        ok: false,
        reason: "disabled",
        count: 0,
        model,
        message: "SIF 임베딩 검색은 승인 전 기본 비활성입니다."
      }
    };
  }

  const apiKey = env.OPENAI_API_KEY || null;
  if (!apiKey) {
    return {
      enabled: false,
      apiKey: null,
      model,
      dimensions,
      status: {
        enabled: true,
        attempted: false,
        ok: false,
        reason: "missing-openai-key",
        count: 0,
        model,
        message: "SIF 임베딩 검색이 켜져 있지만 OPENAI_API_KEY가 없어 text/ranked 검색으로 대체합니다."
      }
    };
  }

  return {
    enabled: true,
    apiKey,
    model,
    dimensions,
    status: {
      enabled: true,
      attempted: false,
      ok: false,
      reason: "no-results",
      count: 0,
      model,
      message: "SIF 임베딩 검색이 준비되었습니다."
    }
  };
}

function readEmbeddingDimensions(value: string | undefined): number {
  const parsed = Number(value || DEFAULT_EMBEDDING_DIMENSIONS);
  if (!Number.isFinite(parsed)) return DEFAULT_EMBEDDING_DIMENSIONS;
  return Math.min(Math.max(Math.trunc(parsed), 256), 3072);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

function isReferenceItem(value: unknown): value is SafetyReferenceItem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.source_id === "string" &&
    typeof record.item_type === "string" &&
    (typeof record.category === "string" || record.category === null) &&
    (typeof record.subcategory === "string" || record.subcategory === null) &&
    typeof record.title === "string" &&
    typeof record.summary === "string" &&
    (typeof record.body === "string" || typeof record.body === "undefined") &&
    isStringArray(record.keywords) &&
    isStringArray(record.risk_tags) &&
    isStringArray(record.primary_documents) &&
    isStringArray(record.controls) &&
    (typeof record.source_url === "string" || typeof record.source_url === "undefined" || record.source_url === null)
  );
}

function normalizeReferenceItem(item: SafetyReferenceItem): SafetyReferenceItem {
  const evidenceRole = deriveEvidenceRole(item);
  const reflectedDocuments = item.reflected_documents?.length ? item.reflected_documents : item.primary_documents;
  const displayTitle = deriveSifDisplayTitle(item);
  const displaySummary = deriveSifDisplaySummary(item);
  return {
    ...item,
    source_url: item.source_url || null,
    evidence_role: evidenceRole,
    reflected_documents: reflectedDocuments,
    short_summary: buildShortSummary(item),
    evidence_role_label: evidenceRole === "direct" ? "문서 문구 직접 근거" : "현장 판단 보조 근거",
    document_reflection_label: buildDocumentReflectionLabel(reflectedDocuments, item.controls),
    source_kind_label: buildSourceKindLabel(item.item_type),
    operation_signal_label: buildOperationSignalLabel(item.item_type, item.controls),
    ...(displayTitle ? { display_title: displayTitle } : {}),
    ...(displaySummary ? { display_summary: displaySummary } : {})
  };
}

function hasArchiveStyleSifTitle(item: Pick<SafetyReferenceItem, "item_type" | "title">): boolean {
  return item.item_type === "sif-case" && /^\s*\d+\s*\/\s*/u.test(item.title);
}

function stripLabeledPrefix(value: string): string {
  return value.replace(/^\s*(연번|재해개요|기인물|재해유발요인|위험성\s*감소대책(?:\([^)]*\))?)\s*:\s*/u, "").trim();
}

function extractSifAccidentOverview(item: Pick<SafetyReferenceItem, "summary" | "body">): string | null {
  const text = [item.summary, item.body || ""].filter(Boolean).join("\n");
  const match = text.match(/재해개요\s*:\s*([\s\S]*?)(?=\n?\s*(?:연번|업종|사업장명|발생형태|재해발생형태|기인물|재해유발요인|위험성\s*감소대책(?:\([^)]*\))?|공종|작업내용|원인|대책)\s*:|$)/u);
  if (!match) return null;
  const overview = stripLabeledPrefix(match[1] || "").replace(/\s+/g, " ").trim();
  return overview || null;
}

function cleanSifAccidentOverview(value: string): string {
  return value
    .replace(/^\s*(?:\d{4}\s*년\s*\d{1,2}\s*월(?:\s*\d{1,2}\s*일)?\s*경?|\d{4}\s*\.\s*\d{1,2}\s*\.\s*\d{1,2}\s*\.?|\d{4}-\d{1,2}-\d{1,2})\s*[.,]?\s*/u, "")
    .replace(/^\s*(?:피해자|피재자|재해자|근로자|작업자)(?:가|는|이)\s+/u, "")
    .replace(/\s+(?:피해자|피재자|재해자|근로자|작업자)(?:가|는|이)\s+/gu, " ")
    .replace(/[.。]\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function appendCaseSuffix(value: string): string {
  if (/사례$/u.test(value)) return value;
  return `${value} 사례`;
}

function deriveSifDisplayTitle(item: SafetyReferenceItem): string | null {
  if (!hasArchiveStyleSifTitle(item)) return null;
  const overview = extractSifAccidentOverview(item);
  if (!overview) return null;
  const cleaned = cleanSifAccidentOverview(overview);
  if (!cleaned) return null;
  return appendCaseSuffix(compactText(cleaned, 86));
}

function deriveSifDisplaySummary(item: SafetyReferenceItem): string | null {
  if (!hasArchiveStyleSifTitle(item)) return null;
  const overview = extractSifAccidentOverview(item);
  if (!overview) return null;
  const cleaned = cleanSifAccidentOverview(overview);
  return cleaned ? compactText(cleaned, 140) : null;
}

export function getSafetyReferenceDisplayTitle(item: SafetyReferenceItem): string {
  return item.display_title || deriveSifDisplayTitle(item) || item.title;
}

function stripRawSifSummaryLabels(value: string): string {
  return value
    .replace(/\b(?:연번|재해개요|기인물|재해유발요인|위험성\s*감소대책(?:\([^)]*\))?)\s*:\s*/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getSafetyReferenceDisplaySummary(item: SafetyReferenceItem): string {
  const displaySummary = item.display_summary || deriveSifDisplaySummary(item);
  if (displaySummary) return displaySummary;
  return compactText(stripRawSifSummaryLabels(item.short_summary || item.summary || item.title), 140);
}

const OPERATIONAL_RISK_PATTERN = /추락|전도|질식|폭발|화재|감전|붕괴|끼임|협착|충돌|낙하|비래|중독|매몰|익사|화상|절단|전기|소음|분진|밀폐|강풍|유해/;
const OPERATIONAL_ACTION_PATTERN = /중지|차단|통제|부착|배치|체결|착용|잠금|설치|공유|교육|보고|복창|격리|환기|측정/;
const GENERIC_OPERATIONAL_CONTROL_PATTERN = /유해[·\s]?위험요인.*확인|관리감독자.*확인|필수 확인 항목|현장 확인 항목|일반 안전사항/;

function operationalIdentityText(item: SafetyReferenceItem): string {
  return [
    getSafetyReferenceDisplayTitle(item),
    item.title,
    item.category || "",
    item.subcategory || "",
    item.summary,
    item.body || "",
    ...item.risk_tags,
    ...item.keywords
  ].join(" ");
}

function normalizeOperationalRiskTag(value: string | null | undefined): string {
  return compactText(value || "", 24)
    .replace(/\s*위험(?:요인)?$/g, "")
    .replace(/\s*관련$/g, "")
    .trim();
}

function stripOperationalTitle(value: string): string {
  return value
    .replace(/^[A-Z]-[A-Z]-\d{1,4}-\d{4}\s*/i, "")
    .replace(/^\d{4,}\s*/, "")
    .replace(/\s*에\s*관한\s*(기술지원규정|기술지침|안전작업지침|가이드|지침)$/g, "")
    .replace(/\s*(기술지원규정|기술지침|안전작업지침|가이드|지침)$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function operationalHazardSubjectFromControl(value: string | undefined): string {
  const control = compactText(value || "", 92);
  if (!control) return "";
  const subject = control
    .replace(/^작업\s*(전|중|후)\s*/g, "")
    .replace(/\s*사전\s*/g, " ")
    .replace(/\s*상태를?\s*확인(?:합니다)?\.?$/g, "")
    .replace(/\s*여부를?\s*확인(?:합니다)?\.?$/g, "")
    .replace(/\s*확인(?:합니다)?\.?$/g, "")
    .replace(/\s*점검(?:합니다)?\.?$/g, "")
    .replace(/\s*측정(?:합니다)?\.?$/g, "")
    .replace(/[.。]$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!subject) return "";
  const suffix = OPERATIONAL_ACTION_PATTERN.test(control) ? "미이행" : /점검/.test(control) ? "미점검" : "미확인";
  return compactText(`${subject} ${suffix}`, 84);
}

function deriveDefaultOperationalHazard(item: SafetyReferenceItem, controls: string[]): string {
  const explicitTag = normalizeOperationalRiskTag(item.risk_tags.find((tag) => OPERATIONAL_RISK_PATTERN.test(tag)));
  const categoryTag = normalizeOperationalRiskTag(item.category);
  const subcategoryTag = normalizeOperationalRiskTag(item.subcategory);
  const title = stripOperationalTitle(getSafetyReferenceDisplayTitle(item));
  const titleTag = normalizeOperationalRiskTag(title.match(OPERATIONAL_RISK_PATTERN)?.[0]);
  const riskTag = explicitTag || (OPERATIONAL_RISK_PATTERN.test(categoryTag) ? categoryTag : "") ||
    (OPERATIONAL_RISK_PATTERN.test(subcategoryTag) ? subcategoryTag : "") || titleTag;
  const controlSubject = operationalHazardSubjectFromControl(controls[0]) ||
    operationalHazardSubjectFromControl(getSafetyReferenceDisplaySummary(item));
  const titleSubject = title
    ? /사례|재해|사고/.test(title)
      ? compactText(`${title} 재발 위험`, 84)
      : compactText(`${title} 조치 미확인`, 84)
    : "";
  const subject = controlSubject || titleSubject;
  if (riskTag && subject) return `${riskTag} 위험: ${subject}`;
  if (riskTag) return `${riskTag} 위험: 현장 조치 미확인`;
  if (subject) return /위험/.test(subject) ? subject : `${subject} 관련 위험`;
  return "DB 하네스 근거 기반 위험요인";
}

function genericOperationalView(item: SafetyReferenceItem): SafetyReferenceOperationalView {
  const displaySummary = getSafetyReferenceDisplaySummary(item);
  const rawControls = item.controls.map((control) => control.trim()).filter(Boolean);
  const onlyGenericControls = rawControls.length > 0 && rawControls.every((control) => GENERIC_OPERATIONAL_CONTROL_PATTERN.test(control));
  if (onlyGenericControls) {
    const subject = stripOperationalTitle(getSafetyReferenceDisplayTitle(item)) || "일반 안전 참고자료";
    return {
      hazard: `검토 필요: ${compactText(subject, 64)}의 현장 위험요인 미확정`,
      controls: [
        "근거 원문과 현장 조건을 대조해 위험요인·통제대책 검토",
        "관리감독자 검토 완료 전 특정 통제대책으로 확정하지 않음"
      ],
      reviewRequired: true
    };
  }

  const controls = rawControls.length
    ? rawControls
    : [displaySummary || "근거 원문의 위험요인과 통제대책 검토", "관리감독자 확인 후 현장 통제대책 확정"];
  return {
    hazard: deriveDefaultOperationalHazard(item, controls),
    controls,
    reviewRequired: rawControls.length === 0
  };
}

export function deriveSafetyReferenceOperationalView(item: SafetyReferenceItem): SafetyReferenceOperationalView {
  const text = operationalIdentityText(item);
  const sifFallRisk = item.item_type === "sif-case" && item.risk_tags.some((tag) => /추락|비계|고소/u.test(tag));
  const sifPinchRisk = item.item_type === "sif-case" && item.risk_tags.some((tag) => /끼임|협착|말림|절단/u.test(tag));
  const machineryIdentity = item.item_type === "machinery" || /프레스|선반|컨베이어|산업용 로봇|기계설비|가동부|회전체|불시기동/u.test(text);
  const hazardousEnergyIdentity = /정비|보수|점검|불시기동|전원\s*차단|잠금표지|LOTO/u.test(text);
  const sifMachineryRisk = item.item_type === "sif-case" && machineryIdentity && (sifPinchRisk || hazardousEnergyIdentity);

  if (/D-C-13-2026|외벽도장보수공사/u.test(text)) {
    return {
      hazard: "외벽 도장 중 이동식 비계 작업발판·난간 미확인으로 인한 추락·전도 위험",
      controls: [
        "이동식 비계 작업발판·안전난간·바퀴 잠금·아웃트리거 상태 확인",
        "안전대 체결, 하부 출입통제 및 강풍 시 작업중지 기준 적용"
      ],
      reviewRequired: false
    };
  }

  if (/B-E-20-2026|정전도장기|정전도장/u.test(text)) {
    return {
      hazard: "정전도장 중 정전기 방전과 도료 증기 점화로 인한 화재·폭발 위험",
      controls: [
        "정전도장기·피도장물 접지 및 정전기 제거 상태 확인",
        "방폭형 환기설비 가동 및 화기·스파크 등 점화원 통제"
      ],
      reviewRequired: false
    };
  }

  if (/B-E-17-2026|도장 공정.*(?:화재|폭발|도료|유기용제)/u.test(text)) {
    return {
      hazard: "도장 공정의 도료·유기용제 증기 점화로 인한 화재·폭발 위험",
      controls: [
        "도료·유기용제 취급 구역 국소배기·전체환기 실시",
        "화기·스파크 등 점화원 통제, MSDS·보호구 확인 및 소화기 비치"
      ],
      reviewRequired: false
    };
  }

  if (/G-67(?:-2011)?|건물 외벽 청소/u.test(text)) {
    return {
      hazard: "건물 외벽 청소 중 작업로프·작업발판에서의 추락 위험",
      controls: [
        "작업로프·안전대·구명줄 체결 및 고정점 사전 점검",
        "작업발판·난간 설치, 하부 출입 통제 및 강풍·우천 시 작업 중지"
      ],
      reviewRequired: false
    };
  }

  if (/B-M-11-2025/u.test(text) || (/지게차/u.test(text) && /동선|보행|통행|충돌/u.test(text))) {
    return {
      hazard: "자재 반입 지게차 동선과 작업자 통행 동선 중첩으로 인한 충돌 위험",
      controls: [
        "지게차 동선과 보행 동선을 바닥표시·차단시설로 분리",
        "교차·후진 구간 신호수 배치 및 후진 경보·접근통제 확인"
      ],
      reviewRequired: false
    };
  }

  if (/밀폐공간|산소결핍|유해가스|맨홀|탱크 내부|지하 기계실.*배수펌프/u.test(text)) {
    return {
      hazard: "밀폐공간 진입 중 산소결핍·유해가스 노출 및 펌프 불시기동 위험",
      controls: [
        "진입 전 산소·유해가스 농도 측정 및 강제환기 실시",
        "감시인 외부 배치 및 펌프 전원 차단·잠금표지(LOTO)"
      ],
      reviewRequired: false
    };
  }

  if (sifFallRisk && sifMachineryRisk) {
    return {
      hazard: "기계설비 정비 중 작업대 추락·가동부 끼임 및 불시기동 위험",
      controls: [
        "작업발판·안전난간 상태 확인 및 안전대 체결",
        "가동부 방호덮개·비상정지장치 확인 후 정비 전 전원 차단·잠금표지(LOTO)"
      ],
      reviewRequired: false
    };
  }

  if (sifFallRisk && sifPinchRisk) {
    return {
      hazard: "비계·부재 해체 중 작업발판 추락 및 손·신체 끼임 위험",
      controls: [
        "작업발판·안전난간 상태 확인 및 안전대 체결",
        "부재 사이 손 끼임점 확인, 작업구역 접근 통제 및 작업자 간 신호 확인"
      ],
      reviewRequired: false
    };
  }

  if (sifFallRisk) {
    return {
      hazard: "고소·비계 작업 중 작업발판·단부 방호 미확인으로 인한 추락 위험",
      controls: [
        "작업발판·안전난간·개구부 상태 확인",
        "안전대 체결 및 작업반경 출입통제"
      ],
      reviewRequired: false
    };
  }

  if (sifPinchRisk && !machineryIdentity) {
    return {
      hazard: "수작업·부재 취급 중 손·신체 끼임 위험",
      controls: [
        "부재 사이 손 끼임점 확인 및 작업구역 접근 통제",
        "취급 보조도구 사용과 작업자 간 신호 확인"
      ],
      reviewRequired: false
    };
  }

  if (machineryIdentity) {
    return {
      hazard: "기계 가동부 끼임 및 정비 중 불시기동 위험",
      controls: [
        "가동부 방호덮개 설치 및 비상정지장치 작동 확인",
        "정비 전 전원 차단 및 잠금표지(LOTO)"
      ],
      reviewRequired: false
    };
  }

  return genericOperationalView(item);
}

function deriveEvidenceRole(item: Pick<SafetyReferenceItem, "item_type" | "source_id">): "direct" | "supporting" {
  const directTypes = new Set([
    "construction-process",
    "machinery",
    "risk-manual",
    "technical-guideline",
    "technical-support-regulation"
  ]);
  if (directTypes.has(item.item_type)) return "direct";
  if (item.source_id.includes("law") || item.source_id.includes("regulation")) return "direct";
  return "supporting";
}

function compactText(value: string, maxLength = 96): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildShortSummary(item: SafetyReferenceItem): string {
  const controlHint = item.controls.slice(0, 2).join(" · ");
  const base = controlHint || item.summary || item.title;
  return compactText(base);
}

function buildDocumentReflectionLabel(documents: string[], controls: string[]): string {
  const documentLabel = documents.slice(0, 3).join(" · ") || "문서 보완 후보";
  const actionLabel = controls[0] ? compactText(controls[0], 48) : "확인 항목으로 반영";
  return `${documentLabel}에 ${actionLabel}`;
}

function buildSourceKindLabel(itemType: string): string {
  if (itemType === "sif-case") return "고위험요인 사례";
  if (itemType === "technical-guideline" || itemType === "technical-support-regulation") return "KOSHA 공식자료";
  if (itemType === "tbm") return "TBM 반영 기준";
  if (itemType === "risk_assessment") return "위험성평가 기준";
  if (itemType === "work_plan") return "작업계획 기준";
  if (itemType === "construction-process") return "공정 분류 기준";
  if (itemType === "machinery") return "장비 위험 기준";
  return "안전 참고자료";
}

function buildOperationSignalLabel(itemType: string, controls: string[]): string {
  const control = controls[0] ? compactText(controls[0], 42) : "현장 확인 항목";
  if (itemType === "sif-case") return `유사사례에서 ${control} 후보`;
  if (itemType === "tbm") return `TBM에서 ${control} 확인`;
  if (itemType === "risk_assessment") return `위험성평가에 ${control} 반영`;
  return `문서와 TBM에 ${control} 반영`;
}

function safeIlikeTerm(value: string): string {
  return value.replaceAll("*", "").replaceAll(",", " ").replace(/[()]/g, " ").trim();
}

const PRIORITY_QUERY_TERMS = [
  "밀폐공간",
  "배수펌프",
  "산소농도",
  "유해가스",
  "지게차",
  "비계",
  "외벽",
  "도장",
  "도료",
  "유기용제",
  "강풍",
  "추락",
  "동선",
  "충돌",
  "감전",
  "누수",
  "화재",
  "폭발"
];

function extractFallbackTerms(value: string): string[] {
  const stopwords = new Set([
    "부산",
    "해운대",
    "서울",
    "성수동",
    "작업",
    "작업자",
    "반영",
    "예보",
    "사용",
    "관리",
    "확인",
    "위험",
    "위험성평가",
    "안전",
    "문서",
    "보완",
    "방향"
  ]);
  const normalized = value.replace(/[^\p{L}\p{N}\s]/gu, " ");
  const priorityTerms = PRIORITY_QUERY_TERMS.filter((term) => normalized.includes(term));
  const ordinaryTerms = normalized
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !stopwords.has(term));
  return Array.from(new Set([...priorityTerms, ...ordinaryTerms])).slice(0, 12);
}

const QUERY_TERM_ALIASES: Record<string, string[]> = {
  "밀폐공간": ["밀폐", "산소", "환기", "질식", "유해가스", "감시인"],
  "산소농도": ["산소", "농도", "환기", "질식", "가스"],
  "유해가스": ["가스", "환기", "질식", "농도"],
  "환기": ["환기", "배기", "송풍"],
  "감시인": ["감시", "연락", "구조", "대피"],
  "배수펌프": ["펌프", "배수", "기계실", "전원", "잠금", "LOTO"],
  "기계실": ["기계실", "펌프", "전기", "배수"],
  "누수": ["누수", "누전", "감전", "젖은", "미끄러짐", "전도"],
  "감전": ["감전", "절연", "전기", "누전"],
  "전원": ["전원", "잠금", "LOTO", "정비"],
  "잠금표지": ["잠금", "표지", "LOTO", "전원차단"],
  "추락": ["추락", "비계", "사다리", "작업발판", "고소"],
  "지게차": ["지게차", "동선", "충돌", "하역", "보행자", "신호수"],
  "비계": ["비계", "작업발판", "난간", "고소", "추락"],
  "강풍": ["강풍", "돌풍", "풍속", "악천후", "작업중지"],
  "동선": ["동선", "통행", "보행", "보행자", "충돌", "교차"],
  "충돌": ["충돌", "지게차", "차량", "동선", "보행자"],
  "외벽": ["외벽", "외부마감", "고소", "비계"],
  "도장": ["도장", "도료", "페인트", "유기용제"]
};

const STRONG_RELEVANCE_ALIASES = new Set([
  "밀폐",
  "산소",
  "환기",
  "질식",
  "유해가스",
  "펌프",
  "배수",
  "기계실",
  "누수",
  "누전",
  "감전",
  "젖은",
  "미끄러짐",
  "전도",
  "추락",
  "비계",
  "작업발판",
  "지게차",
  "강풍",
  "동선",
  "충돌",
  "보행",
  "보행자"
]);

const CONFINED_OR_PUMP_QUERY_TERMS = ["밀폐공간", "산소농도", "환기", "배수펌프", "기계실", "누수"];
const CONFINED_OR_PUMP_INCOMPATIBLE_TERMS = ["프레스", "크레인", "영상표시단말기", "VDT", "운송용 차량"];

function normalizeMatchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ");
}

function referenceMatchText(item: SafetyReferenceItem): string {
  return normalizeMatchText([
    item.title,
    item.summary,
    item.category || "",
    item.subcategory || "",
    ...item.keywords,
    ...item.risk_tags,
    ...item.controls,
    ...item.primary_documents
  ].join(" "));
}

function expandedQueryTerms(query: string): string[] {
  const baseTerms = extractFallbackTerms(query);
  const terms = new Set<string>(baseTerms);
  for (const term of baseTerms) {
    const aliases = QUERY_TERM_ALIASES[term] || [];
    aliases.forEach((alias) => terms.add(alias));
  }
  return Array.from(terms).filter((term) => term.length >= 2);
}

function includesAnyTerm(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(normalizeMatchText(term)));
}

function hasStrongQueryMatch(query: string, item: SafetyReferenceItem): boolean {
  const baseTerms = extractFallbackTerms(query);
  if (!baseTerms.length) return true;
  const text = referenceMatchText(item);
  if (includesAnyTerm(text, baseTerms)) return true;
  return baseTerms.some((term) =>
    (QUERY_TERM_ALIASES[term] || []).some((alias) =>
      STRONG_RELEVANCE_ALIASES.has(alias) && text.includes(normalizeMatchText(alias))
    )
  );
}

function isIncompatibleReferenceForQuery(query: string, item: SafetyReferenceItem): boolean {
  const queryText = normalizeMatchText(query);
  const text = referenceMatchText(item);
  const identityText = normalizeMatchText([
    item.title,
    item.category || "",
    item.subcategory || "",
    ...item.keywords
  ].join(" "));
  const specializedGuards: Array<{ reference: RegExp; query: RegExp }> = [
    {
      reference: /B-E-20-2026|정전도장기|정전도장/u,
      query: /정전\s*도장|정전도장기|정전기.*(?:도장|도료)|(?:도장|도료).*정전기|고전압\s*도장/u
    },
    {
      reference: /G-117-2014|선박\s*내부|선박내부/u,
      query: /선박|선체|조선/u
    },
    {
      reference: /M-77-2011|자동차\s*부분\s*분무도장/u,
      query: /자동차|차량\s*도장|분무도장|스프레이\s*도장/u
    }
  ];
  if (specializedGuards.some((guard) => guard.reference.test(identityText) && !guard.query.test(queryText))) {
    return true;
  }
  const confinedOrPumpQuery = CONFINED_OR_PUMP_QUERY_TERMS.some((term) => queryText.includes(normalizeMatchText(term)));
  if (!confinedOrPumpQuery) return false;
  return CONFINED_OR_PUMP_INCOMPATIBLE_TERMS.some((term) =>
    !queryText.includes(normalizeMatchText(term)) && text.includes(normalizeMatchText(term))
  );
}

export function isSafetyReferenceCompatibleWithQuery(query: string, item: SafetyReferenceItem): boolean {
  return !isIncompatibleReferenceForQuery(query, item);
}

export function scoreSafetyReferenceQueryMatch(query: string, item: SafetyReferenceItem): number {
  const baseTerms = extractFallbackTerms(query);
  if (!baseTerms.length) return 1;
  if (isIncompatibleReferenceForQuery(query, item)) return 0;
  const text = referenceMatchText(item);
  const title = normalizeMatchText(item.title);
  let score = 0;

  for (const term of baseTerms) {
    const normalizedTerm = normalizeMatchText(term);
    if (title.includes(normalizedTerm)) score += 5;
    if (text.includes(normalizedTerm)) score += 3;
    for (const alias of QUERY_TERM_ALIASES[term] || []) {
      const normalizedAlias = normalizeMatchText(alias);
      if (title.includes(normalizedAlias)) score += 3;
      if (text.includes(normalizedAlias)) score += 2;
    }
  }

  return hasStrongQueryMatch(query, item) ? score : Math.min(score, 1);
}

function referenceRiskDomain(item: SafetyReferenceItem): string {
  const text = referenceMatchText(item);
  return /정전도장|정전도장기/.test(text)
    ? "electrostatic_paint"
    : /지게차/.test(text) && /동선|보행|통행|충돌|하역/.test(text)
      ? "forklift_traffic"
      : /도장|도료|유기용제/.test(text) && /화재|폭발|점화/.test(text)
        ? "paint_fire"
        : /외벽|비계|추락|작업발판|고소/.test(text)
          ? "fall_scaffold"
          : /밀폐공간|산소결핍|유해가스|배수펌프/.test(text)
            ? "confined_space"
            : /감전|누전|전기작업/.test(text)
              ? "electrical"
              : `reference:${item.id}`;
}

function referenceDomainSpecificity(domain: string, item: SafetyReferenceItem): number {
  const title = normalizeMatchText(item.title);
  switch (domain) {
    case "forklift_traffic":
      return (/지게차/.test(title) ? 6 : 0) + (/안전작업|충돌|보행/.test(title) ? 2 : 0);
    case "fall_scaffold":
      return (/d-c-13-2026|외벽도장|비계\s*구조/.test(title) ? 6 : 0) + (/추락|작업발판/.test(title) ? 2 : 0);
    case "paint_fire":
      return (/b-e-17-2026/.test(title) ? 6 : 0) + (/도장/.test(title) && /화재|폭발/.test(title) ? 2 : 0);
    case "confined_space":
      return (/밀폐공간|산소결핍|유해가스/.test(title) ? 6 : 0) + (/배수펌프/.test(title) ? 2 : 0);
    default:
      return 0;
  }
}

export function filterAndRankSafetyReferencesByQuery(
  query: string,
  items: SafetyReferenceItem[],
  limit: number
): SafetyReferenceItem[] {
  const terms = expandedQueryTerms(query);
  if (!terms.length) return items.slice(0, limit);
  const ranked = items
    .filter((item) => isSafetyReferenceCompatibleWithQuery(query, item))
    .map((item, index) => ({ item, index, score: scoreSafetyReferenceQueryMatch(query, item) }))
    .filter(({ score }) => score >= 2)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected: typeof ranked = [];
  const deferred: typeof ranked = [];
  const selectedDomainIndexes = new Map<string, number>();

  for (const candidate of ranked) {
    const domain = referenceRiskDomain(candidate.item);
    const selectedIndex = selectedDomainIndexes.get(domain);
    if (selectedIndex !== undefined) {
      const selectedCandidate = selected[selectedIndex];
      const shouldPreferDirect = candidate.item.evidence_role === "direct" &&
        selectedCandidate.item.evidence_role !== "direct";
      const sameEvidenceAuthority = candidate.item.evidence_role === selectedCandidate.item.evidence_role;
      const shouldPreferSpecificReference = sameEvidenceAuthority &&
        referenceDomainSpecificity(domain, candidate.item) > referenceDomainSpecificity(domain, selectedCandidate.item);
      if (shouldPreferDirect || shouldPreferSpecificReference) {
        selected[selectedIndex] = candidate;
        deferred.push(selectedCandidate);
      } else {
        deferred.push(candidate);
      }
      continue;
    }
    if (selected.length >= limit) {
      deferred.push(candidate);
      continue;
    }
    selectedDomainIndexes.set(domain, selected.length);
    selected.push(candidate);
  }

  for (const candidate of deferred) {
    if (selected.length >= limit) break;
    selected.push(candidate);
  }

  return selected.map(({ item }) => item);
}

export function readSafetyReferenceLimit(value: string | null): number {
  const parsed = Number(value || "12");
  if (!Number.isFinite(parsed)) return 12;
  return Math.min(Math.max(Math.trunc(parsed), 1), 50);
}

function parseContentRange(value: string | null): number {
  if (!value) return 0;
  const total = value.split("/").at(-1);
  const parsed = Number(total);
  return Number.isFinite(parsed) ? parsed : 0;
}

function withRetrievalSource(
  item: SafetyReferenceItem,
  retrievalSource: NonNullable<SafetyReferenceItem["retrieval_source"]>,
  vectorSimilarity?: number
): SafetyReferenceItem {
  const normalized = normalizeReferenceItem(item);
  return {
    ...normalized,
    retrieval_source: retrievalSource,
    vector_similarity: vectorSimilarity
  };
}

export function mergeSafetyReferenceHybridResults(input: {
  vectorItems: SafetyReferenceItem[];
  rankedItems: SafetyReferenceItem[];
  limit: number;
  evidenceRole?: "direct" | "supporting";
}): SafetyReferenceItem[] {
  const byId = new Map<string, SafetyReferenceItem>();
  const add = (item: SafetyReferenceItem, source: NonNullable<SafetyReferenceItem["retrieval_source"]>) => {
    const normalized = withRetrievalSource(item, source, item.vector_similarity);
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, normalized);
      return;
    }
    byId.set(item.id, {
      ...existing,
      ...normalized,
      retrieval_source: "hybrid",
      vector_similarity: existing.vector_similarity ?? normalized.vector_similarity
    });
  };

  filterByEvidenceRole(input.vectorItems, input.evidenceRole).forEach((item) => add(item, "vector"));
  filterByEvidenceRole(input.rankedItems, input.evidenceRole).forEach((item) => add(item, "ranked"));
  return Array.from(byId.values()).slice(0, input.limit);
}

function buildRestUrl(config: SupabaseConfig, table: string, params: URLSearchParams): string {
  return `${config.url}/rest/v1/${table}?${params.toString()}`;
}

async function fetchRest(config: SupabaseConfig, table: string, params: URLSearchParams): Promise<Response> {
  return await fetch(buildRestUrl(config, table, params), {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`
    },
    cache: "no-store"
  });
}

async function fetchReferenceItems(config: SupabaseConfig, params: URLSearchParams): Promise<{
  ok: boolean;
  status: number;
  message: string;
  items: SafetyReferenceItem[];
}> {
  const response = await fetchRest(config, "safety_reference_items", params);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      status: response.status,
      message: `safety_reference_items 조회 실패: ${response.status} ${body}`,
      items: []
    };
  }
  const data = (await response.json()) as unknown;
  const items = Array.isArray(data) ? data.filter(isReferenceItem).map(normalizeReferenceItem) : [];
  return {
    ok: true,
    status: response.status,
    message: "Supabase 안전 지식 DB에서 참고자료를 조회했습니다.",
    items
  };
}

/**
 * Track E-3: ranked search via Postgres RPC. Uses tsvector + pg_trgm
 * with weighted scoring (KOSHA 기술지원규정 100 / 기술지침 80 / others
 * 10–30) + ts_rank_cd × 50 + title-similarity × 20.
 *
 * Returns null when the RPC isn't reachable (caller falls back to ilike).
 */
async function fetchRankedReferences(
  config: SupabaseConfig,
  query: string,
  limit: number,
  itemType?: string
): Promise<{ ok: boolean; status: number; message: string; items: SafetyReferenceItem[] } | null> {
  const url = `${config.url}/rest/v1/rpc/search_safety_references_ranked`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        q: query,
        result_limit: limit,
        item_type_filter: itemType ?? null
      }),
      cache: "no-store"
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: `RPC 호출 실패: ${error instanceof Error ? error.message : String(error)}`,
      items: []
    };
  }
  if (response.status === 404) {
    return null; // RPC missing — caller should fall back.
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      status: response.status,
      message: `RPC 조회 실패: ${response.status} ${body}`,
      items: []
    };
  }
  const data = (await response.json()) as unknown;
  const items = Array.isArray(data) ? data.filter(isReferenceItem).map(normalizeReferenceItem) : [];
  return {
    ok: true,
    status: response.status,
    message: "Supabase 안전 지식 DB ranked RPC 호출 성공.",
    items
  };
}

function readVectorSimilarity(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeVectorReferenceRow(value: unknown): SafetyReferenceItem | null {
  if (!isReferenceItem(value)) return null;
  const record = value as Record<string, unknown>;
  return withRetrievalSource(
    normalizeReferenceItem(value),
    "vector",
    readVectorSimilarity(record.vector_similarity)
  );
}

async function fetchQueryEmbedding(
  query: string,
  runtime: SafetyReferenceVectorRuntime
): Promise<{ ok: true; embedding: number[] } | { ok: false; message: string }> {
  if (!runtime.apiKey) {
    return { ok: false, message: "OPENAI_API_KEY가 없어 query embedding을 생성하지 않았습니다." };
  }

  const input = compactText(query, 1000);
  const payload: Record<string, unknown> = {
    model: runtime.model,
    input,
    dimensions: runtime.dimensions
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VECTOR_SEARCH_TIMEOUT_MS);
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${runtime.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        cache: "no-store"
      });
      const text = await response.text();
      if (!response.ok) {
        if (attempt === 0) continue;
        return { ok: false, message: `OpenAI embedding 생성 실패: ${response.status} ${text}` };
      }
      const parsed = JSON.parse(text) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return { ok: false, message: "OpenAI embedding 응답 형식이 올바르지 않습니다." };
      }
      const record = parsed as Record<string, unknown>;
      const data = record.data;
      if (!Array.isArray(data) || data.length === 0) {
        return { ok: false, message: "OpenAI embedding 응답에 data가 없습니다." };
      }
      const first = data[0];
      if (typeof first !== "object" || first === null || Array.isArray(first)) {
        return { ok: false, message: "OpenAI embedding data 형식이 올바르지 않습니다." };
      }
      const embedding = (first as Record<string, unknown>).embedding;
      if (!isNumberArray(embedding) || embedding.length !== runtime.dimensions) {
        return { ok: false, message: `OpenAI embedding 차원이 ${runtime.dimensions}이 아닙니다.` };
      }
      return { ok: true, embedding };
    } catch (error) {
      if (attempt === 0) continue;
      return {
        ok: false,
        message: `OpenAI embedding 호출 실패: ${error instanceof Error ? error.message : String(error)}`
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { ok: false, message: "OpenAI embedding 생성에 실패했습니다." };
}

async function fetchVectorReferences(
  config: SupabaseConfig,
  query: string,
  limit: number,
  itemType: string | undefined,
  runtime: SafetyReferenceVectorRuntime
): Promise<VectorFetchResult> {
  if (!runtime.enabled) {
    return { status: runtime.status, items: [] };
  }

  const embedding = await fetchQueryEmbedding(query, runtime);
  if (!embedding.ok) {
    console.error("Safety reference vector embedding failed", embedding.message);
    return {
      status: {
        ...runtime.status,
        attempted: true,
        ok: false,
        reason: "embedding-failed",
        count: 0,
        message: embedding.message
      },
      items: []
    };
  }

  const url = `${config.url}/rest/v1/rpc/match_safety_reference_embeddings`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        query_embedding: embedding.embedding,
        match_count: limit,
        item_type_filter: itemType ?? null
      }),
      cache: "no-store"
    });
  } catch (error) {
    const message = `SIF 임베딩 RPC 호출 실패: ${error instanceof Error ? error.message : String(error)}`;
    console.error(message);
    return {
      status: {
        ...runtime.status,
        attempted: true,
        ok: false,
        reason: "rpc-failed",
        count: 0,
        message
      },
      items: []
    };
  }

  if (response.status === 404) {
    return {
      status: {
        ...runtime.status,
        attempted: true,
        ok: false,
        reason: "rpc-missing",
        count: 0,
        message: "match_safety_reference_embeddings RPC가 없어 ranked/text 검색으로 대체합니다."
      },
      items: []
    };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      status: {
        ...runtime.status,
        attempted: true,
        ok: false,
        reason: "rpc-failed",
        count: 0,
        message: `SIF 임베딩 RPC 조회 실패: ${response.status} ${body}`
      },
      items: []
    };
  }

  const data = (await response.json()) as unknown;
  const items = Array.isArray(data)
    ? data.map(normalizeVectorReferenceRow).filter((item): item is SafetyReferenceItem => item !== null)
    : [];
  return {
    status: {
      ...runtime.status,
      attempted: true,
      ok: items.length > 0,
      reason: items.length > 0 ? "ready" : "no-results",
      count: items.length,
      message: items.length > 0
        ? "SIF 임베딩 RPC 결과를 ranked/text 근거와 함께 사용했습니다."
        : "SIF 임베딩 RPC 결과가 없어 ranked/text 검색으로 대체합니다."
    },
    items
  };
}

async function countRows(config: SupabaseConfig, spec: CountSpec): Promise<number> {
  const params = new URLSearchParams();
  params.set("select", "id");
  params.set("limit", "1");
  Object.entries(spec.filters || {}).forEach(([key, value]) => params.set(key, value));
  const response = await fetch(buildRestUrl(config, spec.table, params), {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      Prefer: "count=exact"
    },
    cache: "no-store"
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${spec.table} count failed: ${response.status} ${text}`);
  }
  return parseContentRange(response.headers.get("content-range"));
}

export async function searchSafetyReferences(options: {
  query: string;
  limit?: number;
  itemType?: string;
  sourceId?: string;
  riskTag?: string;
  evidenceRole?: "direct" | "supporting";
}): Promise<SafetyReferenceSearchResult> {
  const config = getSupabaseConfig();
  const query = options.query.trim();
  const limit = Math.min(Math.max(options.limit || 12, 1), 50);
  const fetchLimit = options.evidenceRole ? Math.min(limit * 3, 50) : limit;
  const vectorRuntime = resolveSafetyReferenceVectorSearchState();
  let vectorSearch = vectorRuntime.status;
  if (!config) {
    return {
      ok: false,
      configured: false,
      query,
      count: 0,
      items: [],
      retrievalMode: "unconfigured",
      vectorSearch,
      message: "Supabase service role key가 없어 안전 지식 DB 검색을 실행하지 않았습니다."
    };
  }

  // Track E-3: try the ranked RPC first when no specialised filters block it.
  // RPC handles only `query` + `itemType`. For sourceId/riskTag we still use the
  // legacy ilike path. evidenceRole is post-filtered on returned items.
  if (query && !options.sourceId && !options.riskTag) {
    const vector = await fetchVectorReferences(config, query, fetchLimit, options.itemType, vectorRuntime);
    vectorSearch = vector.status;
    const ranked = await fetchRankedReferences(config, query, fetchLimit, options.itemType);
    if ((ranked && ranked.ok && ranked.items.length) || vector.items.length) {
      const merged = mergeSafetyReferenceHybridResults({
        vectorItems: vector.items,
        rankedItems: ranked?.ok ? ranked.items : [],
        limit,
        evidenceRole: options.evidenceRole
      });
      const filtered = filterAndRankSafetyReferencesByQuery(query, merged, limit);
      return {
        ok: true,
        configured: true,
        query,
        count: filtered.length,
        items: filtered,
        retrievalMode: vector.items.length > 0 ? "hybrid-vector-rpc" : "ranked-rpc",
        vectorSearch,
        message: vector.items.length > 0
          ? "Supabase 안전 지식 DB vector+ranked 하이브리드 결과를 사용했습니다."
          : "Supabase 안전 지식 DB ranked RPC 결과를 사용했습니다."
      };
    }
    // Otherwise fall through to legacy ilike path (RPC missing or empty).
  }

  const params = new URLSearchParams();
  params.set("select", SELECT_FIELDS);
  params.set("limit", String(fetchLimit));
  params.set("order", "item_type.asc,title.asc");
  if (options.itemType) params.set("item_type", `eq.${options.itemType}`);
  if (options.sourceId) params.set("source_id", `eq.${options.sourceId}`);
  if (options.riskTag) params.set("risk_tags", `cs.{"${options.riskTag}"}`);

  const searchTerm = safeIlikeTerm(query);
  if (searchTerm) {
    params.set("or", `(title.ilike.*${searchTerm}*,summary.ilike.*${searchTerm}*,body.ilike.*${searchTerm}*)`);
  }

  const firstPass = await fetchReferenceItems(config, params);
  if (!firstPass.ok) {
    return {
      ok: false,
      configured: true,
      query,
      count: 0,
      items: [],
      retrievalMode: "rest-ilike",
      vectorSearch,
      message: firstPass.message
    };
  }

  let items = filterByEvidenceRole(
    firstPass.items.map((item) => withRetrievalSource(item, "rest")),
    options.evidenceRole
  );
  if (items.length === 0 && searchTerm.includes(" ")) {
    const byId = new Map<string, SafetyReferenceItem>();
    const fallbackTerms = extractFallbackTerms(searchTerm);
    const minimumSignalPasses = Math.min(4, fallbackTerms.length);
    for (const [index, term] of fallbackTerms.entries()) {
      const fallbackParams = new URLSearchParams(params);
      fallbackParams.set("limit", String(fetchLimit));
      fallbackParams.set("or", `(title.ilike.*${term}*,summary.ilike.*${term}*,body.ilike.*${term}*)`);
      const fallback = await fetchReferenceItems(config, fallbackParams);
      if (fallback.ok) {
        filterByEvidenceRole(
          fallback.items.map((item) => withRetrievalSource(item, "rest")),
          options.evidenceRole
        ).forEach((item) => byId.set(item.id, item));
      } else {
        console.error("Safety reference fallback search failed", fallback.message);
      }
      if (index + 1 >= minimumSignalPasses && byId.size >= limit) break;
    }
    items = Array.from(byId.values());
  }
  items = filterAndRankSafetyReferencesByQuery(query, items, limit);

  return {
    ok: true,
    configured: true,
    query,
    count: items.slice(0, limit).length,
    items: items.slice(0, limit),
    retrievalMode: "rest-ilike",
    vectorSearch,
    message: "Supabase 안전 지식 DB에서 참고자료를 조회했습니다."
  };
}

function filterByEvidenceRole(
  items: SafetyReferenceItem[],
  evidenceRole: "direct" | "supporting" | undefined
): SafetyReferenceItem[] {
  if (!evidenceRole) return items;
  return items.filter((item) => item.evidence_role === evidenceRole);
}

async function readItemTypeCounts(config: SupabaseConfig): Promise<Array<{ itemType: string; count: number }>> {
  const itemTypes = [
    "sif-case",
    "construction-process",
    "machinery",
    "risk-manual",
    "jsa-training",
    "technical-guideline",
    "technical-support-regulation"
  ];
  const counts = await Promise.all(
    itemTypes.map(async (itemType) => ({
      itemType,
      count: await countRows(config, {
        label: "items",
        table: "safety_reference_items",
        filters: { item_type: `eq.${itemType}` }
      })
    }))
  );
  return counts.filter((item) => item.count > 0);
}

export async function getSafetyReferenceStats(): Promise<SafetyReferenceStats> {
  const config = getSupabaseConfig();
  if (!config) {
    return {
      ok: false,
      configured: false,
      status: "unconfigured",
      sources: 0,
      items: 0,
      expectedTechnicalTotal: EXPECTED_TECHNICAL_TOTAL,
      technicalTotal: 0,
      technicalSupportRegulations: 0,
      technicalGuidelines: 0,
      technicalSplitOk: false,
      catalogSearchOk: false,
      ingestionRuns: 0,
      itemTypes: [],
      samples: [],
      message: "Supabase service role key가 없어 안전 지식 DB 상태를 확인하지 않았습니다."
    };
  }

  try {
    const countSpecs: CountSpec[] = [
      { label: "sources", table: "safety_reference_sources" },
      { label: "items", table: "safety_reference_items" },
      {
        label: "technicalTotal",
        table: "safety_reference_items",
        filters: { source_id: `eq.${TECHNICAL_SOURCE_ID}` }
      },
      {
        label: "technicalSupportRegulations",
        table: "safety_reference_items",
        filters: { source_id: `eq.${TECHNICAL_SOURCE_ID}`, item_type: "eq.technical-support-regulation" }
      },
      {
        label: "technicalGuidelines",
        table: "safety_reference_items",
        filters: { source_id: `eq.${TECHNICAL_SOURCE_ID}`, item_type: "eq.technical-guideline" }
      },
      { label: "ingestionRuns", table: "safety_reference_ingestion_runs" }
    ];
    const counts = await Promise.all(countSpecs.map(async (spec) => [spec.label, await countRows(config, spec)] as const));
    const countMap = Object.fromEntries(counts) as Record<CountSpec["label"], number>;
    const samples = await searchSafetyReferences({
      query: "위험성평가 작업계획 TBM",
      sourceId: TECHNICAL_SOURCE_ID,
      limit: 6
    });
    const itemTypes = await readItemTypeCounts(config);
    const technicalSplitOk =
      countMap.technicalTotal === EXPECTED_TECHNICAL_TOTAL &&
      countMap.technicalSupportRegulations + countMap.technicalGuidelines === countMap.technicalTotal;
    const catalogSearchOk = samples.ok;
    const status: SafetyReferenceStats["status"] = technicalSplitOk && catalogSearchOk ? "ready" : "degraded";

    return {
      ok: status === "ready",
      configured: true,
      status,
      sources: countMap.sources,
      items: countMap.items,
      expectedTechnicalTotal: EXPECTED_TECHNICAL_TOTAL,
      technicalTotal: countMap.technicalTotal,
      technicalSupportRegulations: countMap.technicalSupportRegulations,
      technicalGuidelines: countMap.technicalGuidelines,
      technicalSplitOk,
      catalogSearchOk,
      ingestionRuns: countMap.ingestionRuns,
      itemTypes,
      samples: samples.items,
      message: technicalSplitOk
        ? `기술지원규정 폴더 ${EXPECTED_TECHNICAL_TOTAL.toLocaleString("ko-KR")}건 기준과 Supabase 기술지원규정 소스 ${countMap.technicalTotal.toLocaleString("ko-KR")}건을 연결했습니다.`
        : `기술지원규정 기준 ${EXPECTED_TECHNICAL_TOTAL.toLocaleString("ko-KR")}건과 현재 연결 ${countMap.technicalTotal.toLocaleString("ko-KR")}건이 달라 점검이 필요합니다.`
    };
  } catch (error) {
    console.error("Safety reference stats failed", error);
    return {
      ok: false,
      configured: true,
      status: "degraded",
      sources: 0,
      items: 0,
      expectedTechnicalTotal: EXPECTED_TECHNICAL_TOTAL,
      technicalTotal: 0,
      technicalSupportRegulations: 0,
      technicalGuidelines: 0,
      technicalSplitOk: false,
      catalogSearchOk: false,
      ingestionRuns: 0,
      itemTypes: [],
      samples: [],
      message: error instanceof Error ? error.message : "안전 지식 DB 상태 확인 중 오류가 발생했습니다."
    };
  }
}
