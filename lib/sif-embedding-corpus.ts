import { createHash } from "node:crypto";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";

export type SifEmbeddingCorpusRecord = {
  referenceItemId: string;
  itemType: "sif-case";
  title: string;
  category: string | null;
  riskTags: string[];
  controls: string[];
  primaryDocuments: string[];
  embeddingText: string;
  contentHash: string;
};

export type SifEmbeddingBatchManifest = {
  generatedAt: string;
  source: "safety_reference_items:item_type=sif-case";
  embeddingModel: string;
  embeddingDimensions: 1536;
  recordCount: number;
  batchSize: number;
  batchCount: number;
  corpusHash: string;
  batches: Array<{
    batchId: string;
    startIndex: number;
    endIndexExclusive: number;
    recordCount: number;
    referenceItemIds: string[];
    contentHash: string;
  }>;
  approvalGate: {
    dbMutationPerformed: false;
    requiresMigrationApproval: true;
    requiresEmbeddingCostApproval: true;
    requiresApprovedUploadFlag: true;
  };
};

const MAX_EMBEDDING_TEXT_LENGTH = 6_000;
const DEFAULT_BATCH_SIZE = 100;
const EMBEDDING_DIMENSIONS = 1536;

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => compactText(value)).filter(Boolean)));
}

function hashText(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function resolveBatchSize(batchSize: number | undefined) {
  if (!batchSize || !Number.isFinite(batchSize) || batchSize <= 0) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.trunc(batchSize));
}

export function isSifReferenceItem(item: Pick<SafetyReferenceItem, "item_type">): item is SafetyReferenceItem {
  return item.item_type === "sif-case";
}

export function isEmbeddableSifReferenceItem(item: SafetyReferenceItem) {
  const title = compactText(item.title);
  const body = compactText(item.body || item.summary || "");
  if (!isSifReferenceItem(item)) return false;
  if (title === "공종 / 작업명") return false;
  if (!body.includes("재해개요") && !body.includes("위험성 감소대책")) return false;
  return true;
}

export function buildSifEmbeddingText(item: SafetyReferenceItem) {
  const fields = [
    `자료유형: 산업재해 고위험요인(SIF) 사례`,
    `제목: ${compactText(item.title)}`,
    item.category ? `분류: ${compactText(item.category)}` : "",
    item.subcategory ? `세부분류: ${compactText(item.subcategory)}` : "",
    item.summary ? `요약: ${compactText(item.summary)}` : "",
    item.body ? `본문: ${compactText(item.body)}` : "",
    item.risk_tags.length ? `위험태그: ${uniqueStrings(item.risk_tags).join(", ")}` : "",
    item.controls.length ? `관리대책: ${uniqueStrings(item.controls).join(" / ")}` : "",
    item.primary_documents.length ? `문서반영: ${uniqueStrings(item.primary_documents).join(", ")}` : "",
    item.keywords.length ? `검색키워드: ${uniqueStrings(item.keywords).join(", ")}` : ""
  ].filter(Boolean);

  return fields.join("\n").slice(0, MAX_EMBEDDING_TEXT_LENGTH).trim();
}

export function buildSifEmbeddingCorpus(
  items: SafetyReferenceItem[],
  options: { limit?: number } = {}
): SifEmbeddingCorpusRecord[] {
  const limit = options.limit && options.limit > 0 ? Math.trunc(options.limit) : Number.POSITIVE_INFINITY;
  return items
    .filter(isEmbeddableSifReferenceItem)
    .slice(0, limit)
    .map((item) => {
      const embeddingText = buildSifEmbeddingText(item);
      return {
        referenceItemId: item.id,
        itemType: "sif-case",
        title: compactText(item.title),
        category: item.category,
        riskTags: uniqueStrings(item.risk_tags),
        controls: uniqueStrings(item.controls),
        primaryDocuments: uniqueStrings(item.primary_documents),
        embeddingText,
        contentHash: hashText(embeddingText)
      };
    });
}

export function toSifEmbeddingJsonl(records: SifEmbeddingCorpusRecord[]) {
  return records.map((record) => JSON.stringify(record)).join("\n");
}

export function toSifEmbeddingMarkdown(records: SifEmbeddingCorpusRecord[]) {
  const lines = [
    "# SIF Embedding Corpus",
    "",
    "이 파일은 산업재해 고위험요인(SIF) 사례를 임베딩하기 전 사람이 검토할 수 있도록 만든 코퍼스 미리보기입니다.",
    ""
  ];

  for (const record of records) {
    lines.push(`## ${record.title}`);
    lines.push("");
    lines.push(`- referenceItemId: \`${record.referenceItemId}\``);
    lines.push(`- category: ${record.category || "미분류"}`);
    lines.push(`- riskTags: ${record.riskTags.join(", ") || "없음"}`);
    lines.push(`- controls: ${record.controls.join(" / ") || "없음"}`);
    lines.push(`- primaryDocuments: ${record.primaryDocuments.join(", ") || "없음"}`);
    lines.push(`- contentHash: \`${record.contentHash}\``);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

export function buildSifEmbeddingBatchManifest(
  records: SifEmbeddingCorpusRecord[],
  options: { embeddingModel: string; batchSize?: number; generatedAt?: string }
): SifEmbeddingBatchManifest {
  const batchSize = resolveBatchSize(options.batchSize);
  const generatedAt = options.generatedAt || new Date().toISOString();
  const batches: SifEmbeddingBatchManifest["batches"] = [];

  for (let startIndex = 0; startIndex < records.length; startIndex += batchSize) {
    const batch = records.slice(startIndex, startIndex + batchSize);
    batches.push({
      batchId: `sif-embed-${String(batches.length + 1).padStart(4, "0")}`,
      startIndex,
      endIndexExclusive: startIndex + batch.length,
      recordCount: batch.length,
      referenceItemIds: batch.map((record) => record.referenceItemId),
      contentHash: hashText(batch.map((record) => record.contentHash).join("\n"))
    });
  }

  return {
    generatedAt,
    source: "safety_reference_items:item_type=sif-case",
    embeddingModel: options.embeddingModel,
    embeddingDimensions: EMBEDDING_DIMENSIONS,
    recordCount: records.length,
    batchSize,
    batchCount: batches.length,
    corpusHash: hashText(records.map((record) => `${record.referenceItemId}:${record.contentHash}`).join("\n")),
    batches,
    approvalGate: {
      dbMutationPerformed: false,
      requiresMigrationApproval: true,
      requiresEmbeddingCostApproval: true,
      requiresApprovedUploadFlag: true
    }
  };
}
