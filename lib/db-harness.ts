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
