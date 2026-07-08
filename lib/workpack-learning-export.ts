import type { HarnessImprovement } from "@/lib/db-harness";
import { buildOperationMemoryGraph } from "@/lib/ontology/operation-memory";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";

export type WorkpackLearningInput = {
  workpackId: string;
  generatedAt: string;
  question: string;
  taskLabel: string;
  references: SafetyReferenceItem[];
  improvements: HarnessImprovement[];
  confirmations: Array<{
    displayName: string;
    languageCode: string;
    readAt: string;
  }>;
};

export type LearningJsonlEvent = {
  eventType: "workpack" | "operation_graph" | "reference" | "improvement" | "ack";
  workpackId: string;
  generatedAt: string;
  payload: Record<string, unknown>;
};

export type WorkpackLearningFormat = "markdown" | "jsonl";

export type WorkpackLearningFile = {
  fileName: string;
  contentType: string;
  content: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function preservePayloadText(value: string, maxLength = 4000) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function readOptionalPayloadString(value: unknown, key: string, maxLength = 4000): string | undefined {
  if (!isRecord(value)) return undefined;
  const text = value[key];
  return typeof text === "string" && text.trim() ? preservePayloadText(text, maxLength) : undefined;
}

function readOptionalPayloadStringArray(value: unknown, key: string): string[] | undefined {
  if (!isRecord(value)) return undefined;
  const items = readStringArray(value[key]).map((item) => preservePayloadText(item, 200));
  return items.length ? items : undefined;
}

function readVisionStatus(value: unknown): HarnessImprovement["visionStatus"] | undefined {
  if (!isRecord(value)) return undefined;
  const status = value.status;
  if (status === "analyzed" || status === "unconfigured" || status === "failed") return status;
  return undefined;
}

function readAnalysisMode(value: unknown): HarnessImprovement["analysisMode"] | undefined {
  if (!isRecord(value)) return undefined;
  const mode = value.analysisMode;
  if (mode === "vision_ocr" || mode === "photo_pair_unanalyzed" || mode === "manual_text") return mode;
  return undefined;
}

function readOptionalPayloadBoolean(value: unknown, key: string): boolean | undefined {
  if (!isRecord(value)) return undefined;
  const item = value[key];
  return typeof item === "boolean" ? item : undefined;
}

export function normalizeLearningVisionPayload(value: unknown): Pick<
  HarnessImprovement,
  "visionStatus" | "analysisMode" | "photoPairAttached" | "visionUserLabel" | "visionProvider" | "visionModel" | "visionSummary" | "detectedHazards" | "observedImprovement" | "ocrText" | "visionErrorMessage"
> {
  return {
    visionStatus: readVisionStatus(value),
    analysisMode: readAnalysisMode(value),
    photoPairAttached: readOptionalPayloadBoolean(value, "photoPairAttached"),
    visionUserLabel: readOptionalPayloadString(value, "userLabel", 200),
    visionProvider: readOptionalPayloadString(value, "provider", 80),
    visionModel: readOptionalPayloadString(value, "model", 120),
    visionSummary: readOptionalPayloadString(value, "summary"),
    detectedHazards: readOptionalPayloadStringArray(value, "detectedHazards"),
    observedImprovement: readOptionalPayloadString(value, "observedImprovement"),
    ocrText: readOptionalPayloadString(value, "ocrText"),
    visionErrorMessage: readOptionalPayloadString(value, "errorMessage", 1000)
  };
}

function jsonLine(event: LearningJsonlEvent) {
  return JSON.stringify(event);
}

function event(input: WorkpackLearningInput, eventType: LearningJsonlEvent["eventType"], payload: Record<string, unknown>): LearningJsonlEvent {
  return {
    eventType,
    workpackId: input.workpackId,
    generatedAt: input.generatedAt,
    payload
  };
}

function slugSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣._-]+/g, "")
    .replace(/^-+|-+$/g, "") || "safeclaw";
}

export function buildWorkpackLearningJsonl(input: WorkpackLearningInput) {
  const graph = buildOperationMemoryGraph({
    workpack: {
      id: input.workpackId,
      question: input.question,
      generatedAt: input.generatedAt,
      taskLabel: input.taskLabel
    },
    references: input.references,
    improvements: input.improvements,
    confirmations: input.confirmations
  });
  const events: LearningJsonlEvent[] = [
    event(input, "workpack", {
      question: input.question,
      taskLabel: input.taskLabel
    }),
    event(input, "operation_graph", {
      summary: graph.summary,
      nodes: graph.nodes,
      edges: graph.edges
    }),
    ...input.references.map((reference) => event(input, "reference", {
      referenceItemId: reference.id,
      itemType: reference.item_type,
      title: reference.title,
      riskTags: reference.risk_tags,
      controls: reference.controls,
      primaryDocuments: reference.primary_documents
    })),
    ...input.improvements.map((improvement) => event(input, "improvement", {
      improvementId: improvement.id,
      taskLabel: improvement.taskLabel,
      hazardLabel: improvement.hazardLabel,
      improvementText: improvement.improvementText,
      reflectedDocuments: improvement.reflectedDocuments,
      sourceType: improvement.sourceType,
      visionStatus: improvement.visionStatus,
      analysisMode: improvement.analysisMode,
      photoPairAttached: improvement.photoPairAttached,
      visionUserLabel: improvement.visionUserLabel,
      visionProvider: improvement.visionProvider,
      visionModel: improvement.visionModel,
      visionSummary: improvement.visionSummary,
      detectedHazards: improvement.detectedHazards,
      observedImprovement: improvement.observedImprovement,
      ocrText: improvement.ocrText,
      visionErrorMessage: improvement.visionErrorMessage
    })),
    ...input.confirmations.map((confirmation) => event(input, "ack", {
      displayName: confirmation.displayName,
      languageCode: confirmation.languageCode,
      readAt: confirmation.readAt
    }))
  ];

  return events.map(jsonLine).join("\n");
}

export function buildWorkpackLearningMarkdown(input: WorkpackLearningInput) {
  const graph = buildOperationMemoryGraph({
    workpack: {
      id: input.workpackId,
      question: input.question,
      generatedAt: input.generatedAt,
      taskLabel: input.taskLabel
    },
    references: input.references,
    improvements: input.improvements,
    confirmations: input.confirmations
  });
  const lines = [
    `# ${input.taskLabel}`,
    "",
    `- workpackId: \`${input.workpackId}\``,
    `- generatedAt: ${input.generatedAt}`,
    `- question: ${input.question}`,
    "",
    "## 운영 그래프",
    "",
    `- nodes: ${graph.nodes.length}`,
    `- edges: ${graph.edges.length}`,
    `- hazards: ${graph.summary.hazardCount}`,
    `- controls: ${graph.summary.controlCount}`,
    `- improvements: ${graph.summary.improvementCount}`,
    `- acks: ${graph.summary.ackCount}`,
    `- reflectedDocuments: ${graph.summary.reflectedDocumentCount}`,
    "",
    "## 근거",
    ""
  ];

  for (const reference of input.references) {
    lines.push(`- ${reference.title}`);
    lines.push(`  - type: ${reference.item_type}`);
    lines.push(`  - documents: ${reference.primary_documents.join(", ") || "없음"}`);
    lines.push(`  - controls: ${reference.controls.join(" / ") || "없음"}`);
  }

  lines.push("", "## 개선사항", "");
  for (const improvement of input.improvements) {
    lines.push(`- ${improvement.hazardLabel}: ${improvement.improvementText}`);
    lines.push(`  - reflected: ${improvement.reflectedDocuments.join(", ") || "없음"}`);
    lines.push(`  - source: ${improvement.sourceType}`);
    if (improvement.visionStatus) lines.push(`  - visionStatus: ${improvement.visionStatus}`);
    if (improvement.analysisMode) lines.push(`  - analysisMode: ${improvement.analysisMode}`);
    if (typeof improvement.photoPairAttached === "boolean") lines.push(`  - photoPairAttached: ${improvement.photoPairAttached ? "yes" : "no"}`);
    if (improvement.visionUserLabel) lines.push(`  - visionLabel: ${improvement.visionUserLabel}`);
    if (improvement.visionModel) lines.push(`  - visionModel: ${improvement.visionModel}`);
    if (improvement.visionSummary) lines.push(`  - vision: ${improvement.visionSummary}`);
    if (improvement.detectedHazards?.length) lines.push(`  - detectedHazards: ${improvement.detectedHazards.join(", ")}`);
    if (improvement.observedImprovement) lines.push(`  - observedImprovement: ${improvement.observedImprovement}`);
    if (improvement.ocrText) lines.push(`  - ocr: ${improvement.ocrText}`);
    if (improvement.visionErrorMessage) lines.push(`  - visionError: ${improvement.visionErrorMessage}`);
  }

  lines.push("", "## 확인 이력", "");
  for (const confirmation of input.confirmations) {
    lines.push(`- ${confirmation.displayName} (${confirmation.languageCode}) ${confirmation.readAt}`);
  }

  return `${lines.join("\n")}\n`;
}

export function normalizeWorkpackLearningFormat(value: string | null): WorkpackLearningFormat {
  return value === "jsonl" ? "jsonl" : "markdown";
}

export function buildWorkpackLearningFile(input: WorkpackLearningInput, format: WorkpackLearningFormat): WorkpackLearningFile {
  const baseName = `${slugSegment(input.taskLabel)}-learning`;
  if (format === "jsonl") {
    return {
      fileName: `${baseName}.jsonl`,
      contentType: "application/x-ndjson; charset=utf-8",
      content: `${buildWorkpackLearningJsonl(input)}\n`
    };
  }

  return {
    fileName: `${baseName}.md`,
    contentType: "text/markdown; charset=utf-8",
    content: buildWorkpackLearningMarkdown(input)
  };
}
