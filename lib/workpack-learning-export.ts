import type { HarnessImprovement } from "@/lib/db-harness";
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
  eventType: "workpack" | "reference" | "improvement" | "ack";
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
  const events: LearningJsonlEvent[] = [
    event(input, "workpack", {
      question: input.question,
      taskLabel: input.taskLabel
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
      visionSummary: improvement.visionSummary,
      ocrText: improvement.ocrText
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
  const lines = [
    `# ${input.taskLabel}`,
    "",
    `- workpackId: \`${input.workpackId}\``,
    `- generatedAt: ${input.generatedAt}`,
    `- question: ${input.question}`,
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
    if (improvement.visionSummary) lines.push(`  - vision: ${improvement.visionSummary}`);
    if (improvement.ocrText) lines.push(`  - ocr: ${improvement.ocrText}`);
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
