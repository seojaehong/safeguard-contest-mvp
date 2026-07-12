import type { HarnessImprovement } from "@/lib/db-harness";
import { buildOperationMemoryGraph } from "@/lib/ontology/operation-memory";
import {
  getSafetyReferenceDisplayTitle,
  type SafetyReferenceItem
} from "@/lib/safety-reference-catalog";

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

export type WorkpackLearningGovernance = {
  memoryScope: "operation_memory_export";
  authority: "operator_review_corpus";
  promotionStatus: "draft_candidate";
  runtimeAuthority: false;
  modelFineTuning: false;
  nextUse: string[];
  guardrails: string[];
};

export type LearningJsonlEvent = {
  eventType: "workpack" | "governance" | "operation_graph" | "reference" | "improvement" | "ack";
  workpackId: string;
  generatedAt: string;
  payload: Record<string, unknown>;
};

export type WorkpackLearningFormat = "markdown" | "jsonl" | "obsidian";

export type WorkpackLearningFile = {
  fileName: string;
  contentType: string;
  content: string;
};

export const WORKPACK_LEARNING_GOVERNANCE: WorkpackLearningGovernance = {
  memoryScope: "operation_memory_export",
  authority: "operator_review_corpus",
  promotionStatus: "draft_candidate",
  runtimeAuthority: false,
  modelFineTuning: false,
  nextUse: [
    "관리자 검토 후 DB 하네스 메모리 또는 published ontology 후보로 승격합니다.",
    "다음 위험성평가와 TBM 생성 시 승인된 개선사항만 근거로 고정합니다."
  ],
  guardrails: [
    "이 파일은 모델 파인튜닝 산출물이 아닙니다.",
    "검토 전 항목은 사용자 근거처럼 노출하지 않습니다.",
    "LLM은 승인된 근거와 개선사항을 문장화하는 역할로 제한합니다."
  ]
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
  "visionStatus" | "analysisMode" | "photoPairAttached" | "visionUserLabel" | "visionProvider" | "visionModel" | "visionSummary" | "detectedHazards" | "observedImprovement" | "ocrText" | "sourcePhotoNames" | "photoCount" | "siteSignals" | "visionEvidence" | "visionErrorMessage"
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
    sourcePhotoNames: readOptionalPayloadStringArray(value, "sourcePhotoNames"),
    photoCount: isRecord(value) && typeof value.photoCount === "number" && Number.isFinite(value.photoCount) && value.photoCount > 0
      ? value.photoCount
      : undefined,
    siteSignals: readOptionalPayloadStringArray(value, "siteSignals"),
    visionEvidence: readOptionalPayloadString(value, "visionEvidence"),
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

function referenceRetrievalLabel(reference: SafetyReferenceItem) {
  if (reference.retrieval_source === "local-hybrid") return "local-hybrid";
  if (reference.retrieval_source === "local-ranked") return "local-ranked";
  if (reference.retrieval_source === "local-tag") return "local-tag";
  if (reference.retrieval_source === "hybrid") return "hybrid-vector-rpc";
  if (reference.retrieval_source === "vector") return "vector-rpc";
  if (reference.retrieval_source === "ranked") return "ranked-rpc";
  if (reference.retrieval_source === "rest") return "rest-ilike";
  return "not-recorded";
}

function photoRetrievalLabels(improvement: HarnessImprovement): string[] {
  return [...new Set((improvement.photoHazardProvenance?.evidence || []).flatMap((evidence) =>
    (evidence.retrievals || []).map((retrieval) =>
      `${retrieval.mode}/${retrieval.source || "source-unspecified"}`
    )
  ))];
}

function slugSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣._-]+/g, "")
    .replace(/^-+|-+$/g, "") || "safeclaw";
}

function frontmatterString(value: string) {
  return JSON.stringify(value);
}

function obsidianSegment(value: string, fallback: string) {
  const normalized = value
    .replace(/[\[\]#^|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 96);
  return normalized || fallback;
}

function obsidianLink(kind: string, label: string) {
  return `[[${kind}/${obsidianSegment(label, kind)}]]`;
}

function metadataLines(meta: Record<string, string | number | boolean | null>, indent = "  ") {
  return Object.entries(meta).flatMap(([key, value]) => {
    if (value === null || typeof value === "undefined" || value === "") return [];
    return [`${indent}- ${key}: ${String(value)}`];
  });
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
    event(input, "governance", {
      ...WORKPACK_LEARNING_GOVERNANCE
    }),
    event(input, "operation_graph", {
      summary: graph.summary,
      nodes: graph.nodes,
      edges: graph.edges
    }),
    ...input.references.map((reference) => event(input, "reference", {
      referenceItemId: reference.id,
      sourceId: reference.source_id,
      itemType: reference.item_type,
      title: reference.title,
      displayTitle: getSafetyReferenceDisplayTitle(reference),
      summary: reference.short_summary || reference.summary,
      riskTags: reference.risk_tags,
      controls: reference.controls,
      primaryDocuments: reference.primary_documents,
      reflectedDocuments: reference.reflected_documents,
      evidenceRole: reference.evidence_role,
      sourceUrl: reference.source_url,
      retrievalSource: reference.retrieval_source || "not-recorded",
      retrievalMode: referenceRetrievalLabel(reference)
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
      sourcePhotoNames: improvement.sourcePhotoNames,
      photoCount: improvement.photoCount,
      siteSignals: improvement.siteSignals,
      visionEvidence: improvement.visionEvidence,
      visionErrorMessage: improvement.visionErrorMessage,
      photoHazardProvenance: improvement.photoHazardProvenance
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
    "## 운영 메모리 계약",
    "",
    `- scope: ${WORKPACK_LEARNING_GOVERNANCE.memoryScope}`,
    `- authority: ${WORKPACK_LEARNING_GOVERNANCE.authority}`,
    `- promotionStatus: ${WORKPACK_LEARNING_GOVERNANCE.promotionStatus}`,
    `- runtimeAuthority: ${WORKPACK_LEARNING_GOVERNANCE.runtimeAuthority ? "yes" : "no"}`,
    `- modelFineTuning: ${WORKPACK_LEARNING_GOVERNANCE.modelFineTuning ? "yes" : "no"}`,
    `- nextUse: ${WORKPACK_LEARNING_GOVERNANCE.nextUse.join(" / ")}`,
    `- guardrails: ${WORKPACK_LEARNING_GOVERNANCE.guardrails.join(" / ")}`,
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
    lines.push(`- ${getSafetyReferenceDisplayTitle(reference)}`);
    lines.push(`  - sourceId: ${reference.source_id}`);
    lines.push(`  - type: ${reference.item_type}`);
    lines.push(`  - retrieval: ${referenceRetrievalLabel(reference)}`);
    if (reference.evidence_role) lines.push(`  - role: ${reference.evidence_role}`);
    lines.push(`  - documents: ${reference.primary_documents.join(", ") || "없음"}`);
    if (reference.reflected_documents?.length) lines.push(`  - reflected: ${reference.reflected_documents.join(", ")}`);
    lines.push(`  - controls: ${reference.controls.join(" / ") || "없음"}`);
    if (reference.source_url) lines.push(`  - sourceUrl: ${reference.source_url}`);
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
    if (improvement.sourcePhotoNames?.length) lines.push(`  - sourcePhotos: ${improvement.sourcePhotoNames.join(", ")}`);
    if (improvement.photoCount) lines.push(`  - photoCount: ${improvement.photoCount}`);
    if (improvement.siteSignals?.length) lines.push(`  - siteSignals: ${improvement.siteSignals.join(", ")}`);
    if (improvement.visionEvidence) lines.push(`  - photoEvidence: ${improvement.visionEvidence}`);
    if (improvement.visionErrorMessage) lines.push(`  - visionError: ${improvement.visionErrorMessage}`);
    for (const retrieval of photoRetrievalLabels(improvement)) {
      lines.push(`  - photoRetrieval: ${retrieval}`);
    }
  }

  lines.push("", "## 확인 이력", "");
  for (const confirmation of input.confirmations) {
    lines.push(`- ${confirmation.displayName} (${confirmation.languageCode}) ${confirmation.readAt}`);
  }

  return `${lines.join("\n")}\n`;
}

export function buildWorkpackObsidianMarkdown(input: WorkpackLearningInput) {
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
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const workpackLink = obsidianLink("Workpack", input.taskLabel);
  const lines = [
    "---",
    `safeclaw_memory_scope: ${WORKPACK_LEARNING_GOVERNANCE.memoryScope}`,
    `authority: ${WORKPACK_LEARNING_GOVERNANCE.authority}`,
    `promotion_status: ${WORKPACK_LEARNING_GOVERNANCE.promotionStatus}`,
    `runtime_authority: ${WORKPACK_LEARNING_GOVERNANCE.runtimeAuthority}`,
    `model_fine_tuning: ${WORKPACK_LEARNING_GOVERNANCE.modelFineTuning}`,
    `workpack_id: ${frontmatterString(input.workpackId)}`,
    `generated_at: ${frontmatterString(input.generatedAt)}`,
    `task_label: ${frontmatterString(input.taskLabel)}`,
    "---",
    "",
    `# ${input.taskLabel}`,
    "",
    `작업 노트: ${workpackLink}`,
    "",
    "> 이 문서는 SafeClaw 운영자가 검토할 작업 이력 그래프 후보입니다. 승인 전 항목은 사용자 근거처럼 노출하지 않습니다.",
    "",
    "## 작업 컨텍스트",
    "",
    `- workpack: ${workpackLink}`,
    `- question: ${input.question}`,
    `- generatedAt: ${input.generatedAt}`,
    `- authority: ${WORKPACK_LEARNING_GOVERNANCE.authority}`,
    `- promotionStatus: ${WORKPACK_LEARNING_GOVERNANCE.promotionStatus}`,
    `- runtimeAuthority: ${WORKPACK_LEARNING_GOVERNANCE.runtimeAuthority ? "yes" : "no"}`,
    `- modelFineTuning: ${WORKPACK_LEARNING_GOVERNANCE.modelFineTuning ? "yes" : "no"}`,
    "",
    "## 관계 지도",
    ""
  ];

  for (const edge of graph.edges) {
    const source = nodeById.get(edge.sourceId);
    const target = nodeById.get(edge.targetId);
    if (!source || !target) continue;
    lines.push(`- ${obsidianLink(source.kind, source.label)} --${edge.relation}--> ${obsidianLink(target.kind, target.label)} (${edge.label})`);
  }

  lines.push("", "## 노드 인덱스", "");
  for (const node of graph.nodes) {
    lines.push(`### ${obsidianLink(node.kind, node.label)}`);
    lines.push(`- kind: ${node.kind}`);
    if (node.detail) lines.push(`- detail: ${node.detail}`);
    const meta = metadataLines(node.meta);
    if (meta.length) {
      lines.push("- meta:");
      lines.push(...meta);
    }
    lines.push("");
  }

  lines.push("## 근거 후보", "");
  for (const reference of input.references) {
    lines.push(`- ${obsidianLink("Evidence", getSafetyReferenceDisplayTitle(reference))}`);
    lines.push(`  - retrieval: ${referenceRetrievalLabel(reference)}`);
    lines.push(`  - sourceId: ${reference.source_id}`);
    lines.push(`  - type: ${reference.item_type}`);
    lines.push(`  - hazards: ${reference.risk_tags.map((tag) => obsidianLink("Hazard", tag)).join(", ") || "없음"}`);
    lines.push(`  - controls: ${reference.controls.map((control) => obsidianLink("Control", control)).join(", ") || "없음"}`);
    lines.push(`  - documents: ${reference.primary_documents.join(", ") || "없음"}`);
    if (reference.reflected_documents?.length) lines.push(`  - reflected: ${reference.reflected_documents.join(", ")}`);
    if (reference.source_url) lines.push(`  - sourceUrl: ${reference.source_url}`);
  }

  lines.push("", "## 개선 후보", "");
  for (const improvement of input.improvements) {
    lines.push(`- ${obsidianLink("Improvement", improvement.improvementText)}`);
    lines.push(`  - hazard: ${obsidianLink("Hazard", improvement.hazardLabel)}`);
    lines.push(`  - reflected: ${improvement.reflectedDocuments.join(", ") || "없음"}`);
    lines.push(`  - source: ${improvement.sourceType}`);
    if (improvement.visionStatus) lines.push(`  - visionStatus: ${improvement.visionStatus}`);
    if (improvement.analysisMode) lines.push(`  - analysisMode: ${improvement.analysisMode}`);
    if (typeof improvement.photoPairAttached === "boolean") lines.push(`  - photoPairAttached: ${improvement.photoPairAttached ? "yes" : "no"}`);
    if (improvement.visionSummary) lines.push(`  - vision: ${improvement.visionSummary}`);
    if (improvement.detectedHazards?.length) lines.push(`  - detectedHazards: ${improvement.detectedHazards.map((tag) => obsidianLink("Hazard", tag)).join(", ")}`);
    if (improvement.observedImprovement) lines.push(`  - observedImprovement: ${improvement.observedImprovement}`);
    if (improvement.ocrText) lines.push(`  - ocr: ${improvement.ocrText}`);
    if (improvement.sourcePhotoNames?.length) lines.push(`  - sourcePhotos: ${improvement.sourcePhotoNames.join(", ")}`);
    if (improvement.visionEvidence) lines.push(`  - photoEvidence: ${improvement.visionEvidence}`);
    for (const retrieval of photoRetrievalLabels(improvement)) {
      lines.push(`  - photoRetrieval: ${retrieval}`);
    }
  }

  lines.push("", "## 확인 후보", "");
  for (const confirmation of input.confirmations) {
    lines.push(`- ${obsidianLink("Ack", confirmation.displayName)}`);
    lines.push(`  - language: ${confirmation.languageCode}`);
    lines.push(`  - readAt: ${confirmation.readAt}`);
  }

  lines.push("", "## 승격 전 체크", "");
  for (const guardrail of WORKPACK_LEARNING_GOVERNANCE.guardrails) {
    lines.push(`- ${guardrail}`);
  }

  return `${lines.join("\n")}\n`;
}

export function normalizeWorkpackLearningFormat(value: string | null): WorkpackLearningFormat {
  if (value === "jsonl" || value === "obsidian") return value;
  return "markdown";
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
  if (format === "obsidian") {
    return {
      fileName: `${baseName}-obsidian.md`,
      contentType: "text/markdown; charset=utf-8",
      content: buildWorkpackObsidianMarkdown(input)
    };
  }

  return {
    fileName: `${baseName}.md`,
    contentType: "text/markdown; charset=utf-8",
    content: buildWorkpackLearningMarkdown(input)
  };
}
