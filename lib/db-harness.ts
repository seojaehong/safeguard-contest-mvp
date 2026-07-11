import type {
  SafetyReferenceItem,
  SafetyReferenceErrorCode,
  SafetyReferenceRetrievalMode,
  SafetyReferenceVectorStatus
} from "@/lib/safety-reference-catalog";
import {
  buildSafetyReferenceOperationalMetadata,
  deriveSafetyReferenceOperationalView,
  getSafetyReferenceDisplayTitle,
  isSafetyReferenceCompatibleWithQuery
} from "@/lib/safety-reference-catalog";

export type HarnessImprovement = {
  id: string;
  taskLabel: string;
  hazardLabel: string;
  improvementText: string;
  reflectedDocuments: string[];
  sourceType: "manual" | "photo_analysis" | "operator_note";
  visionStatus?: "analyzed" | "unconfigured" | "failed";
  analysisMode?: "vision_ocr" | "photo_pair_unanalyzed" | "manual_text";
  photoPairAttached?: boolean;
  visionUserLabel?: string;
  visionProvider?: string;
  visionModel?: string;
  visionSummary?: string;
  detectedHazards?: string[];
  observedImprovement?: string;
  ocrText?: string;
  sourcePhotoNames?: string[];
  photoCount?: number;
  siteSignals?: string[];
  visionEvidence?: string;
  visionErrorMessage?: string;
  photoHazardProvenance?: HarnessPhotoHazardProvenance;
};

export type HarnessPhotoHazardProviderResponse = {
  photoId: string;
  responseId: string;
  model: string;
  createdAt: number | null;
};

export type HarnessPhotoHazardEvidence = {
  sourceId: string;
  sourceType: "safeclaw-db" | "mcp";
  title: string;
  excerpt: string;
  catalogSourceId?: string;
  sourceUrl?: string | null;
  itemType?: string;
  evidenceRole?: "direct" | "supporting";
  retrievals?: Array<{
    channel: "direct" | "sif" | "supporting";
    query: string;
    mode: "unconfigured" | "rest-ilike" | "ranked-rpc" | "hybrid-vector-rpc" | "local-tag" | "local-ranked" | "local-hybrid";
    source: "rest" | "ranked" | "vector" | "hybrid" | "local-tag" | "local-ranked" | "local-hybrid" | null;
    vectorAttempted: boolean;
    vectorOk: boolean;
    vectorModel: string;
  }>;
};

export type HarnessPhotoHazardControl = {
  text: string;
  evidenceSourceIds: string[];
};

export type HarnessPhotoHazardProvenance = {
  candidateKey: string;
  candidateId?: string;
  source: "vision" | "local";
  provider?: string;
  providerMode?: "live" | "mock" | "unconfigured";
  model?: string;
  providerResponses?: HarnessPhotoHazardProviderResponse[];
  evidence?: HarnessPhotoHazardEvidence[];
  confirmedControls?: HarnessPhotoHazardControl[];
  confirmedAt?: string | null;
};

export type HarnessWorkpackMemory = {
  id: string;
  question: string;
  generatedAt: string;
  reflectedDocuments: string[];
  statusLabel: string;
};

export type DbHarnessDocumentCoverage = {
  document: string;
  covered: boolean;
  evidenceTypes: Array<"directEvidence" | "sifCase" | "supportingEvidence" | "improvementMemory">;
};

export type DbHarnessRetrievalContract = {
  source: "safety_reference_items";
  errorCode?: SafetyReferenceErrorCode;
  mode: SafetyReferenceRetrievalMode;
  vector: {
    enabled: boolean;
    attempted: boolean;
    ready: boolean;
    errorCode?: SafetyReferenceVectorStatus["errorCode"];
    reason: SafetyReferenceVectorStatus["reason"];
    message: string;
  };
  sourceCounts: {
    directEvidence: number;
    sifCases: number;
    supportingEvidence: number;
    rest: number;
    ranked: number;
    vector: number;
    hybrid: number;
    localTag: number;
    localRanked: number;
    localHybrid: number;
  };
  message: string;
};

export type DbHarnessPacket = {
  mode: "db_harness_first";
  question: string;
  directEvidence: SafetyReferenceItem[];
  sifCases: SafetyReferenceItem[];
  supportingEvidence: SafetyReferenceItem[];
  improvementMemory: HarnessImprovement[];
  workpackMemory: HarnessWorkpackMemory[];
  retrievalContract: DbHarnessRetrievalContract;
  ontologyChecklist: {
    status: "ready" | "review_required";
    missing: string[];
  };
  generationContract: {
    llmRole: "naturalize_only";
    llmOutputScope: "rewrite_fixed_evidence_only";
    evidenceAuthority: "db_harness";
    providerRetryScope: "naturalization_retry_only";
    fallbackChainAllowed: false;
    genericProseSubstitutionAllowed: false;
    missingEvidencePolicy: "surface_review_required";
    requiredDocuments: string[];
    missingEvidence: string[];
    documentCoverage: DbHarnessDocumentCoverage[];
  };
};

export type DbHarnessSurfaceContract = {
  label: "DB 하네스 계약";
  status: "locked" | "review_required";
  headline: string;
  detail: string;
  meta: string;
  missing: string[];
};

export type HarnessMemoryInput = {
  improvements?: HarnessImprovement[];
  workpackMemory?: HarnessWorkpackMemory[];
};

export type DbHarnessRetrievalInput = {
  errorCode?: SafetyReferenceErrorCode;
  mode?: SafetyReferenceRetrievalMode;
  vectorSearch?: SafetyReferenceVectorStatus;
  message?: string;
};

const REQUIRED_DOCUMENTS = ["위험성평가표", "TBM 브리핑", "TBM 기록"];

function includesDocument(item: SafetyReferenceItem, document: string) {
  return item.primary_documents.includes(document) || item.reflected_documents?.includes(document);
}

function uniqueDocuments(items: SafetyReferenceItem[], improvements: HarnessImprovement[]) {
  const documents = new Set<string>();
  for (const item of items) {
    item.primary_documents.forEach((document) => documents.add(document));
    item.reflected_documents?.forEach((document) => documents.add(document));
  }
  for (const improvement of improvements) {
    improvement.reflectedDocuments.forEach((document) => documents.add(document));
  }
  return documents;
}

function buildDocumentCoverage(input: {
  directEvidence: SafetyReferenceItem[];
  sifCases: SafetyReferenceItem[];
  supportingEvidence: SafetyReferenceItem[];
  improvements: HarnessImprovement[];
}): DbHarnessDocumentCoverage[] {
  return REQUIRED_DOCUMENTS.map((document) => {
    const evidenceTypes: DbHarnessDocumentCoverage["evidenceTypes"] = [];
    if (input.directEvidence.some((item) => includesDocument(item, document))) evidenceTypes.push("directEvidence");
    if (input.sifCases.some((item) => includesDocument(item, document))) evidenceTypes.push("sifCase");
    if (input.supportingEvidence.some((item) => includesDocument(item, document))) evidenceTypes.push("supportingEvidence");
    if (input.improvements.some((item) => item.reflectedDocuments.includes(document))) evidenceTypes.push("improvementMemory");
    return {
      document,
      covered: evidenceTypes.length > 0,
      evidenceTypes
    };
  });
}

function defaultVectorStatus(): SafetyReferenceVectorStatus {
  return {
    enabled: false,
    attempted: false,
    ok: false,
    reason: "disabled",
    count: 0,
    model: "text-embedding-3-small",
    message: "SIF 임베딩 검색은 승인 전 기본 비활성입니다."
  };
}

function countRetrievalSources(items: SafetyReferenceItem[]) {
  return {
    rest: items.filter((item) => item.retrieval_source === "rest").length,
    ranked: items.filter((item) => item.retrieval_source === "ranked").length,
    vector: items.filter((item) => item.retrieval_source === "vector").length,
    hybrid: items.filter((item) => item.retrieval_source === "hybrid").length,
    localTag: items.filter((item) => item.retrieval_source === "local-tag").length,
    localRanked: items.filter((item) => item.retrieval_source === "local-ranked").length,
    localHybrid: items.filter((item) => item.retrieval_source === "local-hybrid").length
  };
}

function inferRetrievalMode(input: {
  references: SafetyReferenceItem[];
  retrieval?: DbHarnessRetrievalInput;
}): SafetyReferenceRetrievalMode {
  if (input.retrieval?.mode) return input.retrieval.mode;
  if (input.references.some((item) => item.retrieval_source === "vector" || item.retrieval_source === "hybrid")) {
    return "hybrid-vector-rpc";
  }
  if (input.references.some((item) => item.retrieval_source === "ranked")) return "ranked-rpc";
  if (input.references.length) return "rest-ilike";
  return "unconfigured";
}

function buildRetrievalContract(input: {
  references: SafetyReferenceItem[];
  directEvidence: SafetyReferenceItem[];
  sifCases: SafetyReferenceItem[];
  supportingEvidence: SafetyReferenceItem[];
  retrieval?: DbHarnessRetrievalInput;
}): DbHarnessRetrievalContract {
  const vectorSearch = input.retrieval?.vectorSearch || defaultVectorStatus();
  const sourceCounts = countRetrievalSources(input.references);
  return {
    source: "safety_reference_items",
    ...(input.retrieval?.errorCode ? { errorCode: input.retrieval.errorCode } : {}),
    mode: inferRetrievalMode({ references: input.references, retrieval: input.retrieval }),
    vector: {
      enabled: vectorSearch.enabled,
      attempted: vectorSearch.attempted,
      ready: vectorSearch.ok,
      ...(vectorSearch.errorCode ? { errorCode: vectorSearch.errorCode } : {}),
      reason: vectorSearch.reason,
      message: vectorSearch.message
    },
    sourceCounts: {
      directEvidence: input.directEvidence.length,
      sifCases: input.sifCases.length,
      supportingEvidence: input.supportingEvidence.length,
      ...sourceCounts
    },
    message: input.retrieval?.message || vectorSearch.message
  };
}

export function buildDbHarnessPacket(input: {
  question: string;
  references: SafetyReferenceItem[];
  improvements?: HarnessImprovement[];
  workpackMemory?: HarnessWorkpackMemory[];
  ontologyMissing?: string[];
  retrieval?: DbHarnessRetrievalInput;
}): DbHarnessPacket {
  const improvements = input.improvements || [];
  const workpackMemory = input.workpackMemory || [];
  const references = input.references
    .filter((item) => isSafetyReferenceCompatibleWithQuery(input.question, item))
    .map((item) => ({
      ...item,
      ...buildSafetyReferenceOperationalMetadata(item)
    }));
  const directEvidence = references.filter((item) => item.evidence_role === "direct");
  const sifCases = references.filter((item) => item.item_type === "sif-case");
  const supportingEvidence = references.filter((item) => item.evidence_role !== "direct");
  const retrievalContract = buildRetrievalContract({
    references,
    directEvidence,
    sifCases,
    supportingEvidence,
    retrieval: input.retrieval
  });
  const availableDocuments = uniqueDocuments(references, improvements);
  const documentCoverage = buildDocumentCoverage({ directEvidence, sifCases, supportingEvidence, improvements });
  const missingEvidence = REQUIRED_DOCUMENTS.filter((document) =>
    !availableDocuments.has(document) || !documentCoverage.find((item) => item.document === document)?.covered
  );
  const missing = [
    ...(input.ontologyMissing || []),
    ...(sifCases.length ? [] : ["SIF 유사사례"]),
    ...missingEvidence.map((document) => `${document} 근거`)
  ];

  return {
    mode: "db_harness_first",
    question: input.question.trim(),
    directEvidence,
    sifCases,
    supportingEvidence,
    improvementMemory: improvements,
    workpackMemory,
    retrievalContract,
    ontologyChecklist: {
      status: missing.length ? "review_required" : "ready",
      missing
    },
    generationContract: {
      llmRole: "naturalize_only",
      llmOutputScope: "rewrite_fixed_evidence_only",
      evidenceAuthority: "db_harness",
      providerRetryScope: "naturalization_retry_only",
      fallbackChainAllowed: false,
      genericProseSubstitutionAllowed: false,
      missingEvidencePolicy: "surface_review_required",
      requiredDocuments: REQUIRED_DOCUMENTS,
      missingEvidence,
      documentCoverage
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function readPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function normalizeSourceType(value: unknown): HarnessImprovement["sourceType"] {
  if (value === "photo_analysis" || value === "operator_note" || value === "manual") return value;
  return "manual";
}

function normalizeVisionStatus(value: unknown): HarnessImprovement["visionStatus"] | undefined {
  if (value === "analyzed" || value === "unconfigured" || value === "failed") return value;
  return undefined;
}

function normalizeAnalysisMode(value: unknown): HarnessImprovement["analysisMode"] | undefined {
  if (value === "vision_ocr" || value === "photo_pair_unanalyzed" || value === "manual_text") return value;
  return undefined;
}

function normalizeProviderMode(value: unknown): HarnessPhotoHazardProvenance["providerMode"] | undefined {
  if (value === "live" || value === "mock" || value === "unconfigured") return value;
  return undefined;
}

function parsePhotoHazardProviderResponse(value: unknown): HarnessPhotoHazardProviderResponse | null {
  if (!isRecord(value)) return null;
  const photoId = readString(value.photoId);
  const responseId = readString(value.responseId);
  const model = readString(value.model);
  if (!photoId || !responseId || !model) return null;
  return {
    photoId,
    responseId,
    model,
    createdAt: typeof value.createdAt === "number" && Number.isFinite(value.createdAt) ? value.createdAt : null
  };
}

function parsePhotoHazardEvidenceRetrieval(value: unknown): NonNullable<HarnessPhotoHazardEvidence["retrievals"]>[number] | null {
  if (!isRecord(value)) return null;
  const channel = value.channel === "direct" || value.channel === "sif" || value.channel === "supporting"
    ? value.channel
    : null;
  const mode = value.mode === "unconfigured"
    || value.mode === "rest-ilike"
    || value.mode === "ranked-rpc"
    || value.mode === "hybrid-vector-rpc"
    || value.mode === "local-tag"
    || value.mode === "local-ranked"
    || value.mode === "local-hybrid"
    ? value.mode
    : null;
  const source = value.source === "rest"
    || value.source === "ranked"
    || value.source === "vector"
    || value.source === "hybrid"
    || value.source === "local-tag"
    || value.source === "local-ranked"
    || value.source === "local-hybrid"
    ? value.source
    : null;
  const query = readString(value.query);
  const vectorModel = readString(value.vectorModel);
  if (!channel || !mode || !query || !vectorModel) return null;
  return {
    channel,
    query,
    mode,
    source,
    vectorAttempted: value.vectorAttempted === true,
    vectorOk: value.vectorOk === true,
    vectorModel
  };
}

function parsePhotoHazardEvidence(value: unknown): HarnessPhotoHazardEvidence | null {
  if (!isRecord(value)) return null;
  const sourceId = readString(value.sourceId);
  const sourceType = value.sourceType === "safeclaw-db" || value.sourceType === "mcp"
    ? value.sourceType
    : null;
  const title = readString(value.title);
  const excerpt = readString(value.excerpt);
  if (!sourceId || !sourceType || !title || !excerpt) return null;
  const evidenceRole = value.evidenceRole === "direct" || value.evidenceRole === "supporting"
    ? value.evidenceRole
    : undefined;
  const retrievals = Array.isArray(value.retrievals)
    ? value.retrievals
      .map(parsePhotoHazardEvidenceRetrieval)
      .filter((item): item is NonNullable<HarnessPhotoHazardEvidence["retrievals"]>[number] => item !== null)
    : undefined;
  return {
    sourceId,
    sourceType,
    title,
    excerpt,
    catalogSourceId: readString(value.catalogSourceId) || undefined,
    sourceUrl: typeof value.sourceUrl === "string" ? value.sourceUrl : null,
    itemType: readString(value.itemType) || undefined,
    evidenceRole,
    retrievals: retrievals?.length ? retrievals : undefined
  };
}

function parsePhotoHazardControl(value: unknown): HarnessPhotoHazardControl | null {
  if (!isRecord(value)) return null;
  const text = readString(value.text);
  if (!text) return null;
  return {
    text,
    evidenceSourceIds: readStringArray(value.evidenceSourceIds).slice(0, 12)
  };
}

function parsePhotoHazardProvenance(value: unknown): HarnessPhotoHazardProvenance | undefined {
  if (!isRecord(value)) return undefined;
  const candidateKey = readString(value.candidateKey);
  const source = value.source === "vision" || value.source === "local"
    ? value.source
    : null;
  if (!candidateKey || !source) return undefined;
  const providerResponses = Array.isArray(value.providerResponses)
    ? value.providerResponses
      .map(parsePhotoHazardProviderResponse)
      .filter((item): item is HarnessPhotoHazardProviderResponse => item !== null)
      .slice(0, 10)
    : undefined;
  const evidence = Array.isArray(value.evidence)
    ? value.evidence
      .map(parsePhotoHazardEvidence)
      .filter((item): item is HarnessPhotoHazardEvidence => item !== null)
      .slice(0, 8)
    : undefined;
  const confirmedControls = Array.isArray(value.confirmedControls)
    ? value.confirmedControls
      .map(parsePhotoHazardControl)
      .filter((item): item is HarnessPhotoHazardControl => item !== null)
      .slice(0, 8)
    : undefined;
  return {
    candidateKey,
    candidateId: readString(value.candidateId) || undefined,
    source,
    provider: readString(value.provider) || undefined,
    providerMode: normalizeProviderMode(value.providerMode),
    model: readString(value.model) || undefined,
    providerResponses: providerResponses?.length ? providerResponses : undefined,
    evidence: evidence?.length ? evidence : undefined,
    confirmedControls: confirmedControls?.length ? confirmedControls : undefined,
    confirmedAt: typeof value.confirmedAt === "string" ? value.confirmedAt : null
  };
}

function parseHarnessImprovement(value: unknown): HarnessImprovement | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const taskLabel = readString(value.taskLabel);
  const hazardLabel = readString(value.hazardLabel);
  const improvementText = readString(value.improvementText);
  if (!id || !taskLabel || !hazardLabel || !improvementText) return null;
  return {
    id,
    taskLabel,
    hazardLabel,
    improvementText,
    reflectedDocuments: readStringArray(value.reflectedDocuments).slice(0, 8),
    sourceType: normalizeSourceType(value.sourceType),
    visionStatus: normalizeVisionStatus(value.visionStatus),
    analysisMode: normalizeAnalysisMode(value.analysisMode),
    photoPairAttached: typeof value.photoPairAttached === "boolean" ? value.photoPairAttached : undefined,
    visionUserLabel: readString(value.visionUserLabel) || undefined,
    visionProvider: readString(value.visionProvider) || undefined,
    visionModel: readString(value.visionModel) || undefined,
    visionSummary: readString(value.visionSummary) || undefined,
    detectedHazards: readStringArray(value.detectedHazards).slice(0, 10),
    observedImprovement: readString(value.observedImprovement) || undefined,
    ocrText: readString(value.ocrText) || undefined,
    sourcePhotoNames: readStringArray(value.sourcePhotoNames).slice(0, 10),
    photoCount: readPositiveNumber(value.photoCount),
    siteSignals: readStringArray(value.siteSignals).slice(0, 12),
    visionEvidence: readString(value.visionEvidence) || undefined,
    visionErrorMessage: readString(value.visionErrorMessage) || undefined,
    photoHazardProvenance: parsePhotoHazardProvenance(value.photoHazardProvenance)
  };
}

function parseHarnessWorkpackMemory(value: unknown): HarnessWorkpackMemory | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const question = readString(value.question);
  const generatedAt = readString(value.generatedAt);
  const statusLabel = readString(value.statusLabel);
  if (!id || !question || !generatedAt || !statusLabel) return null;
  return {
    id,
    question,
    generatedAt,
    reflectedDocuments: readStringArray(value.reflectedDocuments).slice(0, 12),
    statusLabel
  };
}

export function parseHarnessMemoryInput(value: unknown): Required<HarnessMemoryInput> {
  if (!isRecord(value)) return { improvements: [], workpackMemory: [] };
  const improvements = Array.isArray(value.improvements)
    ? value.improvements.map(parseHarnessImprovement).filter((item): item is HarnessImprovement => item !== null).slice(0, 12)
    : [];
  const workpackMemory = Array.isArray(value.workpackMemory)
    ? value.workpackMemory.map(parseHarnessWorkpackMemory).filter((item): item is HarnessWorkpackMemory => item !== null).slice(0, 8)
    : [];
  return { improvements, workpackMemory };
}

export function buildHarnessPromptContext(packet: DbHarnessPacket) {
  const evidenceLines = [
    ...packet.sifCases.map((item) => `SIF: ${getSafetyReferenceDisplayTitle(item)} -> ${deriveSafetyReferenceOperationalView(item).controls.slice(0, 2).join(" / ")}`),
    ...packet.directEvidence.map((item) => `공식자료: ${getSafetyReferenceDisplayTitle(item)} -> ${item.primary_documents.join(", ")}`),
    ...packet.improvementMemory.map((item) => [
      `개선이력: ${item.hazardLabel} -> ${item.improvementText}`,
      item.visionStatus ? `visionStatus: ${item.visionStatus}` : "",
      item.analysisMode ? `analysisMode: ${item.analysisMode}` : "",
      item.photoPairAttached ? "photoPair: before/after attached" : "",
      item.visionUserLabel ? `visionLabel: ${item.visionUserLabel}` : "",
      item.visionSummary ? `vision: ${item.visionSummary}` : "",
      item.detectedHazards?.length ? `detected: ${item.detectedHazards.join(", ")}` : "",
      item.observedImprovement ? `observed: ${item.observedImprovement}` : "",
      item.ocrText ? `ocr: ${item.ocrText}` : "",
      item.sourcePhotoNames?.length ? `photos: ${item.sourcePhotoNames.join(", ")}` : "",
      item.photoCount ? `photoCount: ${item.photoCount}` : "",
      item.siteSignals?.length ? `siteSignals: ${item.siteSignals.join(", ")}` : "",
      item.visionEvidence ? `photoEvidence: ${item.visionEvidence}` : ""
    ].filter(Boolean).join(" | ")),
    ...packet.workpackMemory.map((item) => `작업이력: ${item.generatedAt} · ${item.question} · ${item.statusLabel}`)
  ];

  return [
    "역할: LLM은 DB harness가 고정한 근거를 문장화만 한다.",
    "근거 권위: safety_reference_items, SIF 사례, 작업 개선 이력 DB 하네스가 원천이다.",
    `검색 경로: ${packet.retrievalContract.mode} / vector=${packet.retrievalContract.vector.ready ? "ready" : packet.retrievalContract.vector.reason}`,
    `검색 출처: direct ${packet.retrievalContract.sourceCounts.directEvidence}, SIF ${packet.retrievalContract.sourceCounts.sifCases}, supporting ${packet.retrievalContract.sourceCounts.supportingEvidence}, localHybrid ${packet.retrievalContract.sourceCounts.localHybrid}, localRanked ${packet.retrievalContract.sourceCounts.localRanked}, localTag ${packet.retrievalContract.sourceCounts.localTag}, hybrid ${packet.retrievalContract.sourceCounts.hybrid}, vector ${packet.retrievalContract.sourceCounts.vector}, ranked ${packet.retrievalContract.sourceCounts.ranked}, rest ${packet.retrievalContract.sourceCounts.rest}`,
    "제공자 재시도: 모델/제공자 재시도는 문장화 실패 복구에만 허용하며 새 근거·새 위험요인을 추가할 수 없다.",
    "누락 정책: 근거가 없으면 보강 필요로 표시하고 산문으로 메우지 않는다.",
    "금지: 근거 없는 위험요인, 문서 반영 위치, 확인 이력을 새로 만들지 않는다.",
    `작업: ${packet.question}`,
    `필수문서: ${packet.generationContract.requiredDocuments.join(", ")}`,
    `보강필요: ${packet.ontologyChecklist.missing.join(", ") || "없음"}`,
    "근거:",
    ...evidenceLines
  ].join("\n");
}

export function buildDbHarnessSurfaceContract(packet: DbHarnessPacket): DbHarnessSurfaceContract {
  const coveredDocuments = packet.generationContract.documentCoverage.filter((item) => item.covered).length;
  const requiredDocuments = packet.generationContract.requiredDocuments.length;
  const fixedSourceCount =
    packet.directEvidence.length +
    packet.sifCases.length +
    packet.supportingEvidence.length +
    packet.improvementMemory.length +
    packet.workpackMemory.length;
  const vectorLabel = packet.retrievalContract.vector.ready
    ? "vector ready"
    : packet.retrievalContract.vector.attempted
      ? `vector ${packet.retrievalContract.vector.reason}`
      : "vector 승인 전";
  const locked =
    packet.generationContract.fallbackChainAllowed === false &&
    packet.generationContract.genericProseSubstitutionAllowed === false &&
    packet.generationContract.evidenceAuthority === "db_harness";

  return {
    label: "DB 하네스 계약",
    status: locked && packet.ontologyChecklist.status === "ready" ? "locked" : "review_required",
    headline: locked ? "DB 근거 고정 · LLM 문장화 전용" : "하네스 계약 검토 필요",
    detail: fixedSourceCount
      ? `고정 근거 ${fixedSourceCount}건 · 필수 문서 ${coveredDocuments}/${requiredDocuments}종 커버`
      : `고정 근거 없음 · 필수 문서 ${coveredDocuments}/${requiredDocuments}종 커버`,
    meta: `${packet.retrievalContract.mode} · ${vectorLabel}`,
    missing: packet.ontologyChecklist.missing
  };
}

export function hasDocumentCoverage(packet: DbHarnessPacket, document: string) {
  return packet.directEvidence.some((item) => includesDocument(item, document)) ||
    packet.sifCases.some((item) => includesDocument(item, document)) ||
    packet.improvementMemory.some((item) => item.reflectedDocuments.includes(document));
}

function uniqueNonEmpty(values: string[], limit: number) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, limit);
}

function evidenceTitles(items: SafetyReferenceItem[], limit: number) {
  return uniqueNonEmpty(items.map(getSafetyReferenceDisplayTitle), limit);
}

function controlCandidates(packet: DbHarnessPacket) {
  return uniqueNonEmpty([
    ...packet.sifCases.flatMap((item) => deriveSafetyReferenceOperationalView(item).controls.slice(0, 2)),
    ...packet.directEvidence.flatMap((item) => deriveSafetyReferenceOperationalView(item).controls.slice(0, 2)),
    ...packet.improvementMemory.map((item) => item.improvementText),
    ...packet.improvementMemory.flatMap((item) => item.detectedHazards || [])
  ], 6);
}

export function buildDbHarnessAnswer(packet: DbHarnessPacket) {
  const directTitles = evidenceTitles(packet.directEvidence, 3);
  const sifTitles = evidenceTitles(packet.sifCases, 3);
  const controls = controlCandidates(packet);
  const missing = uniqueNonEmpty(packet.ontologyChecklist.missing, 5);
  const memoryLines = uniqueNonEmpty([
    ...packet.improvementMemory.map((item) => `${item.hazardLabel}: ${item.improvementText}`),
    ...packet.workpackMemory.map((item) => `${item.generatedAt}: ${item.statusLabel}`)
  ], 4);

  if (!directTitles.length && !sifTitles.length && !controls.length) {
    return [
      "1) 하네스 판단",
      "- DB 하네스가 사용할 직접 근거, SIF 사례, 개선 이력을 아직 찾지 못했습니다.",
      "",
      "2) 오늘 문서에 먼저 반영할 조치",
      "- 위험성평가표, TBM 브리핑, TBM 기록에 같은 위험요인과 확인조치를 연결하세요.",
      "",
      "3) 보강 필요",
      "- 공식자료, SIF 유사사례, 현장 개선 이력을 확인한 뒤 문서팩에 반영하세요."
    ].join("\n");
  }

  return [
    "1) 하네스 판단",
    [
      directTitles.length ? `- 직접 근거: ${directTitles.join(" / ")}` : "",
      sifTitles.length ? `- SIF 유사사례: ${sifTitles.join(" / ")}` : "",
      memoryLines.length ? `- 작업·개선 이력: ${memoryLines.join(" / ")}` : ""
    ].filter(Boolean).join("\n"),
    "",
    "2) 오늘 문서에 먼저 반영할 조치",
    controls.length
      ? controls.map((control) => `- ${control}`).join("\n")
      : "- 위험성평가표, TBM 브리핑, TBM 기록에 같은 위험요인과 확인조치를 연결하세요.",
    "",
    "3) 보강 필요",
    missing.length
      ? missing.map((item) => `- ${item}`).join("\n")
      : "- 필수 3종 문서에 반영할 근거가 준비됐습니다."
  ].join("\n");
}

export function buildDbHarnessPracticalPoints(packet: DbHarnessPacket) {
  const points = [
    ...controlCandidates(packet).map((control) => `문서 반영 전 확인: ${control}`),
    ...packet.generationContract.requiredDocuments.map((document) => `${document}에 같은 위험요인·조치·확인자를 연결`),
    ...packet.generationContract.missingEvidence.map((document) => `${document} 근거 보강 후 전파`)
  ];

  return uniqueNonEmpty(points, 8);
}
