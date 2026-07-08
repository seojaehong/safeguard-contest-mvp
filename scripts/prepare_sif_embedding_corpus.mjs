import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";

const DEFAULT_OUTPUT_DIR = "evaluation/sif-embedding-gate";
const DEFAULT_MODEL = "text-embedding-3-small";
const PAGE_SIZE = 500;

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
  }
}

function parseArgs(argv) {
  const options = {
    outputDir: DEFAULT_OUTPUT_DIR,
    limit: 0,
    model: DEFAULT_MODEL,
    embed: false,
    upload: false,
    approvedUpload: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output-dir") options.outputDir = argv[index += 1] || DEFAULT_OUTPUT_DIR;
    else if (arg === "--limit") options.limit = Number(argv[index += 1] || "0");
    else if (arg === "--model") options.model = argv[index += 1] || DEFAULT_MODEL;
    else if (arg === "--embed") options.embed = true;
    else if (arg === "--upload") options.upload = true;
    else if (arg === "--approved-upload") options.approvedUpload = true;
    else if (arg === "--help") {
      console.log("Usage: node scripts/prepare_sif_embedding_corpus.mjs [--output-dir DIR] [--limit N] [--embed] [--upload --approved-upload] [--model MODEL]");
      process.exit(0);
    }
  }

  return options;
}

function requireSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  return { url: url.replace(/\/$/, ""), key };
}

async function fetchPage(config, offset, limit) {
  const params = new URLSearchParams();
  params.set("select", "id,source_id,item_type,category,subcategory,title,summary,body,keywords,risk_tags,primary_documents,controls");
  params.set("item_type", "eq.sif-case");
  params.set("order", "id.asc");
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  const response = await fetch(`${config.url}/rest/v1/safety_reference_items?${params.toString()}`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`
    }
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`safety_reference_items fetch failed: ${response.status} ${body}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function fetchSifItems(config, maxItems) {
  const items = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const remaining = maxItems > 0 ? maxItems - items.length : PAGE_SIZE;
    if (maxItems > 0 && remaining <= 0) break;
    const page = await fetchPage(config, offset, Math.min(PAGE_SIZE, remaining));
    items.push(...page);
    if (page.length < PAGE_SIZE || (maxItems > 0 && items.length >= maxItems)) break;
  }
  return items;
}

function asArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildEmbeddingText(item) {
  return [
    "자료유형: 산업재해 고위험요인(SIF) 사례",
    `제목: ${compact(item.title)}`,
    item.category ? `분류: ${compact(item.category)}` : "",
    item.summary ? `요약: ${compact(item.summary)}` : "",
    item.body ? `본문: ${compact(item.body)}` : "",
    asArray(item.risk_tags).length ? `위험태그: ${asArray(item.risk_tags).join(", ")}` : "",
    asArray(item.controls).length ? `관리대책: ${asArray(item.controls).join(" / ")}` : "",
    asArray(item.primary_documents).length ? `문서반영: ${asArray(item.primary_documents).join(", ")}` : ""
  ].filter(Boolean).join("\n").slice(0, 6000).trim();
}

function contentHash(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function toCorpusRecord(item) {
  const embeddingText = buildEmbeddingText(item);
  return {
    referenceItemId: item.id,
    itemType: "sif-case",
    title: compact(item.title),
    category: item.category || null,
    riskTags: asArray(item.risk_tags),
    controls: asArray(item.controls),
    primaryDocuments: asArray(item.primary_documents),
    embeddingText,
    contentHash: contentHash(embeddingText)
  };
}

function isEmbeddableSifItem(item) {
  return skipReason(item) === null;
}

function skipReason(item) {
  const title = compact(item.title);
  const body = compact(item.body || item.summary || "");
  if (item.item_type !== "sif-case") return "wrong_item_type";
  if (title === "공종 / 작업명") return "spreadsheet_header";
  if (!body.includes("재해개요") && !body.includes("위험성 감소대책")) return "missing_sif_narrative";
  return null;
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return Object.fromEntries(Array.from(counts.entries()).sort(([a], [b]) => String(a).localeCompare(String(b))));
}

function duplicateContentHashes(records) {
  const byHash = new Map();
  for (const record of records) {
    const rows = byHash.get(record.contentHash) || [];
    rows.push(record.referenceItemId);
    byHash.set(record.contentHash, rows);
  }
  return Array.from(byHash.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([contentHash, referenceItemIds]) => ({ contentHash, referenceItemIds }));
}

function textLengthStats(records) {
  if (!records.length) return { min: 0, max: 0, average: 0 };
  const lengths = records.map((record) => record.embeddingText.length);
  return {
    min: Math.min(...lengths),
    max: Math.max(...lengths),
    average: Math.round(lengths.reduce((sum, length) => sum + length, 0) / lengths.length)
  };
}

function buildValidationReport(items, skippedItems, records) {
  const duplicates = duplicateContentHashes(records);
  const missingControls = records.filter((record) => record.controls.length === 0);
  const missingPrimaryDocuments = records.filter((record) => record.primaryDocuments.length === 0);
  const emptyEmbeddingText = records.filter((record) => !record.embeddingText.trim());
  return {
    skipReasons: countBy(skippedItems.map((item) => skipReason(item) || "none")),
    itemTypes: countBy(items.map((item) => item.item_type || "unknown")),
    textLength: textLengthStats(records),
    missingControlsCount: missingControls.length,
    missingPrimaryDocumentsCount: missingPrimaryDocuments.length,
    emptyEmbeddingTextCount: emptyEmbeddingText.length,
    duplicateContentHashCount: duplicates.length,
    duplicateContentHashSamples: duplicates.slice(0, 10)
  };
}

async function embedRecords(records, model) {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI();
  const output = [];
  for (const record of records) {
    const response = await client.embeddings.create({
      model,
      input: record.embeddingText
    });
    const embedding = response.data[0]?.embedding;
    if (!embedding) throw new Error(`embedding missing for ${record.referenceItemId}`);
    output.push({ ...record, embedding });
  }
  return output;
}

async function upsertEmbeddings(config, embedded, model) {
  if (!embedded.length) return 0;
  const rows = embedded.map((record) => ({
    reference_item_id: record.referenceItemId,
    embedding: record.embedding,
    embedding_model: model,
    metadata: {
      contentHash: record.contentHash,
      itemType: record.itemType,
      title: record.title
    }
  }));

  const response = await fetch(`${config.url}/rest/v1/safety_reference_embeddings?on_conflict=reference_item_id,embedding_model`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "content-type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(rows)
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`safety_reference_embeddings upsert failed: ${response.status} ${body}`);
  }
  return rows.length;
}

function writeArtifacts(outputDir, records, report) {
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonlPath = path.join(outputDir, "sif-embedding-corpus.jsonl");
  const mdPath = path.join(outputDir, "sif-embedding-corpus.md");
  const reportPath = path.join(outputDir, "report.json");
  fs.writeFileSync(jsonlPath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
  fs.writeFileSync(mdPath, [
    "# SIF Embedding Corpus",
    "",
    "산업재해 고위험요인(SIF) 사례를 임베딩하기 전 검토하기 위한 코퍼스입니다.",
    "",
    ...records.slice(0, 50).flatMap((record) => [
      `## ${record.title}`,
      "",
      `- referenceItemId: \`${record.referenceItemId}\``,
      `- contentHash: \`${record.contentHash}\``,
      `- riskTags: ${record.riskTags.join(", ") || "없음"}`,
      `- controls: ${record.controls.join(" / ") || "없음"}`,
      ""
    ])
  ].join("\n"), "utf8");
  fs.writeFileSync(reportPath, JSON.stringify({ ...report, jsonlPath, mdPath }, null, 2), "utf8");
  return { jsonlPath, mdPath, reportPath };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  readEnvFile(".env.local");
  const startedAt = new Date().toISOString();
  const config = requireSupabaseConfig();
  const items = await fetchSifItems(config, options.limit);
  const skippedItems = items.filter((item) => !isEmbeddableSifItem(item));
  const records = items.filter(isEmbeddableSifItem).map(toCorpusRecord);
  const validation = buildValidationReport(items, skippedItems, records);

  let embeddedCount = 0;
  let uploadedCount = 0;
  let uploadError = null;
  if (options.upload && !options.approvedUpload) {
    uploadError = "--upload requires explicit --approved-upload after DB migration approval";
  }
  if (options.embed || options.upload) {
    try {
      if (!uploadError) {
        const embedded = await embedRecords(records, options.model);
        embeddedCount = embedded.length;
        if (options.upload) uploadedCount = await upsertEmbeddings(config, embedded, options.model);
      }
    } catch (error) {
      uploadError = error instanceof Error ? error.message : String(error);
    }
  }

  const report = {
    startedAt,
    completedAt: new Date().toISOString(),
    source: "safety_reference_items:item_type=sif-case",
    itemCount: items.length,
    skippedCount: skippedItems.length,
    skippedIds: skippedItems.map((item) => item.id).slice(0, 50),
    corpusCount: records.length,
    validation,
    embeddingModel: options.model,
    embeddedCount,
    uploadedCount,
    uploadError,
    approvalGate: {
      uploadApprovedFlag: options.approvedUpload,
      uploadRequiresMigrationApproval: true,
      uploadRequiresApprovedUploadFlag: true,
      corpusReady: records.length > 0 && validation.emptyEmbeddingTextCount === 0
    },
    mode: options.upload ? "embed-and-upload" : options.embed ? "embed-only" : "corpus-only"
  };
  const artifacts = writeArtifacts(options.outputDir, records, report);
  console.log(JSON.stringify({ ok: !uploadError, ...report, ...artifacts }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
