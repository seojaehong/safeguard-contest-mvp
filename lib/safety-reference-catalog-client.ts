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
  retrieval_source?: "rest" | "ranked" | "vector" | "hybrid" | "local-tag" | "local-ranked" | "local-hybrid";
  vector_similarity?: number;
  kosha_guide?: {
    referenceId: string;
    stableDocumentKey: string;
    version: string;
    quality: "accepted" | "review_required";
    bodyKind: "native" | "unknown";
    anchors: Array<{ page: number; excerpt: string }>;
    evidenceRef: string | null;
    directEligible: boolean;
  };
};

export type SafetyReferenceErrorCode = "safety_reference_search_failed";
export type SafetyReferenceRetrievalMode = "unconfigured" | "rest-ilike" | "ranked-rpc" | "hybrid-vector-rpc" | "local-tag" | "local-ranked" | "local-hybrid";
export type SafetyReferenceVectorStatus = {
  enabled: boolean;
  attempted: boolean;
  ok: boolean;
  errorCode?: "safety_reference_vector_failed";
  reason: "disabled" | "missing-openai-key" | "embedding-failed" | "rpc-missing" | "rpc-failed" | "no-results" | "ready";
  count: number;
  model: string;
  message: string;
};

export type SafetyReferenceOperationalView = {
  hazard: string;
  controls: string[];
  reviewRequired: boolean;
};

function compact(value: string, limit: number): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, Math.max(limit - 1, 1)).trim()}...`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function getSafetyReferenceDisplayTitle(item: SafetyReferenceItem): string {
  return item.display_title || item.title;
}

export function deriveSafetyReferenceOperationalView(item: SafetyReferenceItem): SafetyReferenceOperationalView {
  const controls = unique(item.controls);
  return {
    hazard: compact(item.risk_tags[0] || item.category || item.title, 120),
    controls: controls.length ? controls : ["해당 근거의 필수 확인 항목을 작업 전 점검합니다."],
    reviewRequired: item.kosha_guide ? !item.kosha_guide.directEligible : item.evidence_role !== "direct"
  };
}

export function buildSafetyReferenceOperationalMetadata(item: SafetyReferenceItem): Pick<SafetyReferenceItem, "controls" | "short_summary" | "document_reflection_label" | "operation_signal_label"> {
  const controls = unique(item.controls);
  const primaryDocument = item.primary_documents[0] || "위험성평가표";
  const primaryControl = controls[0] || "작업 전 필수 확인 항목 점검";
  return {
    controls,
    short_summary: item.short_summary || compact(item.summary || item.body || item.title, 160),
    document_reflection_label: item.document_reflection_label || `${primaryDocument}에 ${primaryControl} 반영`,
    operation_signal_label: item.operation_signal_label || `${primaryControl} 확인`
  };
}

export function isSafetyReferenceCompatibleWithQuery(query: string, item: SafetyReferenceItem): boolean {
  const tokens = query.toLowerCase().split(/\s+/u).filter((token) => token.length >= 2);
  if (!tokens.length) return true;
  const text = [item.title, item.summary, item.body || "", item.category || "", ...item.keywords, ...item.risk_tags, ...item.controls].join(" ").toLowerCase();
  return tokens.some((token) => text.includes(token));
}
