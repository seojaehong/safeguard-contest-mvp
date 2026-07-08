import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";

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
  visionErrorMessage?: string;
};

export type HarnessWorkpackMemory = {
  id: string;
  question: string;
  generatedAt: string;
  reflectedDocuments: string[];
  statusLabel: string;
};

export type DbHarnessPacket = {
  mode: "db_harness_first";
  question: string;
  directEvidence: SafetyReferenceItem[];
  sifCases: SafetyReferenceItem[];
  supportingEvidence: SafetyReferenceItem[];
  improvementMemory: HarnessImprovement[];
  workpackMemory: HarnessWorkpackMemory[];
  ontologyChecklist: {
    status: "ready" | "review_required";
    missing: string[];
  };
  generationContract: {
    llmRole: "naturalize_only";
    fallbackChainAllowed: false;
    requiredDocuments: string[];
    missingEvidence: string[];
  };
};

export type HarnessMemoryInput = {
  improvements?: HarnessImprovement[];
  workpackMemory?: HarnessWorkpackMemory[];
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

export function buildDbHarnessPacket(input: {
  question: string;
  references: SafetyReferenceItem[];
  improvements?: HarnessImprovement[];
  workpackMemory?: HarnessWorkpackMemory[];
  ontologyMissing?: string[];
}): DbHarnessPacket {
  const improvements = input.improvements || [];
  const workpackMemory = input.workpackMemory || [];
  const directEvidence = input.references.filter((item) => item.evidence_role === "direct");
  const sifCases = input.references.filter((item) => item.item_type === "sif-case");
  const supportingEvidence = input.references.filter((item) => item.evidence_role !== "direct");
  const availableDocuments = uniqueDocuments(input.references, improvements);
  const missingEvidence = REQUIRED_DOCUMENTS.filter((document) => !availableDocuments.has(document));
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
    ontologyChecklist: {
      status: missing.length ? "review_required" : "ready",
      missing
    },
    generationContract: {
      llmRole: "naturalize_only",
      fallbackChainAllowed: false,
      requiredDocuments: REQUIRED_DOCUMENTS,
      missingEvidence
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
    visionErrorMessage: readString(value.visionErrorMessage) || undefined
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
    ...packet.sifCases.map((item) => `SIF: ${item.title} -> ${item.controls.slice(0, 2).join(" / ")}`),
    ...packet.directEvidence.map((item) => `공식자료: ${item.title} -> ${item.primary_documents.join(", ")}`),
    ...packet.improvementMemory.map((item) => [
      `개선이력: ${item.hazardLabel} -> ${item.improvementText}`,
      item.visionStatus ? `visionStatus: ${item.visionStatus}` : "",
      item.analysisMode ? `analysisMode: ${item.analysisMode}` : "",
      item.photoPairAttached ? "photoPair: before/after attached" : "",
      item.visionUserLabel ? `visionLabel: ${item.visionUserLabel}` : "",
      item.visionSummary ? `vision: ${item.visionSummary}` : "",
      item.detectedHazards?.length ? `detected: ${item.detectedHazards.join(", ")}` : "",
      item.observedImprovement ? `observed: ${item.observedImprovement}` : "",
      item.ocrText ? `ocr: ${item.ocrText}` : ""
    ].filter(Boolean).join(" | ")),
    ...packet.workpackMemory.map((item) => `작업이력: ${item.generatedAt} · ${item.question} · ${item.statusLabel}`)
  ];

  return [
    "역할: LLM은 DB harness가 고정한 근거를 문장화만 한다.",
    "금지: 근거 없는 위험요인, 문서 반영 위치, 확인 이력을 새로 만들지 않는다.",
    `작업: ${packet.question}`,
    `필수문서: ${packet.generationContract.requiredDocuments.join(", ")}`,
    `보강필요: ${packet.ontologyChecklist.missing.join(", ") || "없음"}`,
    "근거:",
    ...evidenceLines
  ].join("\n");
}

export function hasDocumentCoverage(packet: DbHarnessPacket, document: string) {
  return packet.directEvidence.some((item) => includesDocument(item, document)) ||
    packet.sifCases.some((item) => includesDocument(item, document)) ||
    packet.improvementMemory.some((item) => item.reflectedDocuments.includes(document));
}
