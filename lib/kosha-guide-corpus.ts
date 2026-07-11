import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";

export type KoshaGuideCorpusItemType = "technical-guideline" | "technical-support-regulation";
export type KoshaGuideCorpusBodyKind = "native" | "summary" | "ocr" | "unknown";
export type KoshaGuideCorpusQuality = "accepted" | "review_required";
export type KoshaGuideCorpusLifecycle = "current" | "stale" | "retired";
export type KoshaGuideOfflineRetrievalMode = "local-tag" | "local-ranked" | "local-hybrid";

export type KoshaGuideCorpusAnchor = {
  page: number;
  excerpt: string;
};

export type KoshaGuideCorpusTags = {
  keywords: string[];
  riskTags: string[];
  controls: string[];
  primaryDocuments: string[];
};

export type KoshaGuideCorpusProvenance = {
  sourceId: string;
  generationId: string;
  generatedAt: string;
  lifecycle: KoshaGuideCorpusLifecycle;
  chunkId: string;
  bodyHash: string;
};

export type KoshaGuideCorpusRecord = {
  referenceId: string;
  stableDocumentKey: string;
  version: string;
  itemType: KoshaGuideCorpusItemType;
  title: string;
  category: string;
  nativeBody: string;
  bodyKind: KoshaGuideCorpusBodyKind;
  quality: KoshaGuideCorpusQuality;
  provenance: KoshaGuideCorpusProvenance;
  tags: KoshaGuideCorpusTags;
  anchors: KoshaGuideCorpusAnchor[];
};

export type KoshaGuideCorpusHit = {
  referenceId: string;
  stableDocumentKey: string;
  retrievalMode: KoshaGuideOfflineRetrievalMode;
  score: number;
  directEligible: boolean;
  evidenceRef: string | null;
  record: KoshaGuideCorpusRecord;
};

type ReadyIndexedRecord = {
  record: KoshaGuideCorpusRecord;
  tagText: string;
  bodyText: string;
};

type KoshaGuideCorpusReady = {
  status: "ready";
  rootDir: string;
  manifestSha256: string;
  itemCount: number;
  chunkCount: number;
  failureCount: number;
  records: KoshaGuideCorpusRecord[];
  indexedRecords: ReadyIndexedRecord[];
};

type KoshaGuideCorpusBlocked = {
  status: "blocked";
  rootDir: string | null;
  failures: string[];
};

type KoshaGuideCorpusUnconfigured = {
  status: "unconfigured";
  rootDir: null;
  failures: [];
};

export type KoshaGuideCorpusLoadResult =
  | KoshaGuideCorpusReady
  | KoshaGuideCorpusBlocked
  | KoshaGuideCorpusUnconfigured;

export type KoshaGuideCorpusSearchResult = {
  retrievalMode: KoshaGuideOfflineRetrievalMode | null;
  items: KoshaGuideCorpusHit[];
};

export type KoshaGuideCorpusLookup = {
  rootDir?: string | null;
  env?: Record<string, string | undefined>;
};

type SnapshotCurrentV2 = {
  schemaVersion: 2;
  paths: {
    manifest: string;
    items: string;
    chunks: string;
    failures: string;
  };
  counts: {
    items: number;
    chunks: number;
    failures: number;
  };
  hashes: {
    sourceSha256: string;
    generationSha256: string;
    accountingSha256: string;
    manifestSha256: string;
  };
};

type SnapshotManifestV2 = {
  schemaVersion: 2;
  source: {
    sourceId: string;
    snapshotVersion: string;
    corpusVersion: string;
    sourceHash: string;
  };
  generation: {
    generationId: string;
    generatedAt: string;
    lifecycle: KoshaGuideCorpusLifecycle;
    stage: "complete" | "partial";
    generationHash: string;
  };
  accounting: {
    itemCount: number;
    chunkCount: number;
    failureCount: number;
    acceptedCount: number;
    reviewRequiredCount: number;
    accountingHash: string;
  };
  files: {
    items: {
      path: string;
      sha256: string;
      count: number;
    };
    chunks: {
      path: string;
      sha256: string;
      count: number;
    };
    failures: {
      path: string;
      sha256: string;
      count: number;
    };
  };
};

type SnapshotChunkV2 = {
  chunkId: string;
  itemIds: string[];
  itemCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeJsonText(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function normalizeStreamText(value: string): string {
  return normalizeJsonText(value).replace(/\n$/, "");
}

function tokenize(value: string): string[] {
  return [...new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
  )];
}

function countMatches(queryTokens: string[], text: string): number {
  return queryTokens.filter((token) => text.includes(token)).length;
}

function parseCurrentSnapshot(value: unknown): SnapshotCurrentV2 | null {
  if (!isRecord(value)) return null;
  const paths = isRecord(value.paths) ? value.paths : null;
  const counts = isRecord(value.counts) ? value.counts : null;
  const hashes = isRecord(value.hashes) ? value.hashes : null;
  if (value.schemaVersion !== 2 || !paths || !counts || !hashes) return null;
  const current: SnapshotCurrentV2 = {
    schemaVersion: 2,
    paths: {
      manifest: readString(paths.manifest),
      items: readString(paths.items),
      chunks: readString(paths.chunks),
      failures: readString(paths.failures)
    },
    counts: {
      items: readPositiveInteger(counts.items) ?? -1,
      chunks: readPositiveInteger(counts.chunks) ?? -1,
      failures: readPositiveInteger(counts.failures) ?? -1
    },
    hashes: {
      sourceSha256: readString(hashes.sourceSha256),
      generationSha256: readString(hashes.generationSha256),
      accountingSha256: readString(hashes.accountingSha256),
      manifestSha256: readString(hashes.manifestSha256)
    }
  };
  return current.paths.manifest && current.paths.items && current.paths.chunks && current.paths.failures
    && current.counts.items >= 0 && current.counts.chunks >= 0 && current.counts.failures >= 0
    && current.hashes.sourceSha256 && current.hashes.generationSha256 && current.hashes.accountingSha256 && current.hashes.manifestSha256
    ? current
    : null;
}

function parseManifestSnapshot(value: unknown): SnapshotManifestV2 | null {
  if (!isRecord(value)) return null;
  const source = isRecord(value.source) ? value.source : null;
  const generation = isRecord(value.generation) ? value.generation : null;
  const accounting = isRecord(value.accounting) ? value.accounting : null;
  const files = isRecord(value.files) ? value.files : null;
  const items = files && isRecord(files.items) ? files.items : null;
  const chunks = files && isRecord(files.chunks) ? files.chunks : null;
  const failures = files && isRecord(files.failures) ? files.failures : null;
  if (value.schemaVersion !== 2 || !source || !generation || !accounting || !items || !chunks || !failures) return null;
  const lifecycle = generation.lifecycle;
  const stage = generation.stage;
  if (lifecycle !== "current" && lifecycle !== "stale" && lifecycle !== "retired") return null;
  if (stage !== "complete" && stage !== "partial") return null;
  const manifest: SnapshotManifestV2 = {
    schemaVersion: 2,
    source: {
      sourceId: readString(source.sourceId),
      snapshotVersion: readString(source.snapshotVersion),
      corpusVersion: readString(source.corpusVersion),
      sourceHash: readString(source.sourceHash)
    },
    generation: {
      generationId: readString(generation.generationId),
      generatedAt: readString(generation.generatedAt),
      lifecycle,
      stage,
      generationHash: readString(generation.generationHash)
    },
    accounting: {
      itemCount: readPositiveInteger(accounting.itemCount) ?? -1,
      chunkCount: readPositiveInteger(accounting.chunkCount) ?? -1,
      failureCount: readPositiveInteger(accounting.failureCount) ?? -1,
      acceptedCount: readPositiveInteger(accounting.acceptedCount) ?? -1,
      reviewRequiredCount: readPositiveInteger(accounting.reviewRequiredCount) ?? -1,
      accountingHash: readString(accounting.accountingHash)
    },
    files: {
      items: {
        path: readString(items.path),
        sha256: readString(items.sha256),
        count: readPositiveInteger(items.count) ?? -1
      },
      chunks: {
        path: readString(chunks.path),
        sha256: readString(chunks.sha256),
        count: readPositiveInteger(chunks.count) ?? -1
      },
      failures: {
        path: readString(failures.path),
        sha256: readString(failures.sha256),
        count: readPositiveInteger(failures.count) ?? -1
      }
    }
  };
  return manifest.source.sourceId && manifest.source.snapshotVersion && manifest.source.corpusVersion && manifest.source.sourceHash
    && manifest.generation.generationId && manifest.generation.generatedAt && manifest.generation.generationHash
    && manifest.accounting.accountingHash
    && manifest.accounting.itemCount >= 0 && manifest.accounting.chunkCount >= 0 && manifest.accounting.failureCount >= 0
    && manifest.files.items.path && manifest.files.items.sha256 && manifest.files.items.count >= 0
    && manifest.files.chunks.path && manifest.files.chunks.sha256 && manifest.files.chunks.count >= 0
    && manifest.files.failures.path && manifest.files.failures.sha256 && manifest.files.failures.count >= 0
    ? manifest
    : null;
}

function parseAnchor(value: unknown): KoshaGuideCorpusAnchor | null {
  if (!isRecord(value)) return null;
  const page = readPositiveInteger(value.page);
  const excerpt = readString(value.excerpt);
  if (page === null || page <= 0 || !excerpt) return null;
  return { page, excerpt };
}

function parseTags(value: unknown): KoshaGuideCorpusTags | null {
  if (!isRecord(value)) return null;
  return {
    keywords: readStringArray(value.keywords),
    riskTags: readStringArray(value.riskTags),
    controls: readStringArray(value.controls),
    primaryDocuments: readStringArray(value.primaryDocuments)
  };
}

function parseProvenance(value: unknown): KoshaGuideCorpusProvenance | null {
  if (!isRecord(value)) return null;
  const lifecycle = value.lifecycle;
  if (lifecycle !== "current" && lifecycle !== "stale" && lifecycle !== "retired") return null;
  const sourceId = readString(value.sourceId);
  const generationId = readString(value.generationId);
  const generatedAt = readString(value.generatedAt);
  const chunkId = readString(value.chunkId);
  const bodyHash = readString(value.bodyHash);
  if (!sourceId || !generationId || !generatedAt || !chunkId || !bodyHash) return null;
  return { sourceId, generationId, generatedAt, lifecycle, chunkId, bodyHash };
}

function parseRecord(value: unknown): KoshaGuideCorpusRecord | null {
  if (!isRecord(value)) return null;
  const itemType = value.itemType;
  const bodyKind = value.bodyKind;
  const quality = value.quality;
  if (itemType !== "technical-guideline" && itemType !== "technical-support-regulation") return null;
  if (bodyKind !== "native" && bodyKind !== "summary" && bodyKind !== "ocr" && bodyKind !== "unknown") return null;
  if (quality !== "accepted" && quality !== "review_required") return null;
  const provenance = parseProvenance(value.provenance);
  const tags = parseTags(value.tags);
  if (!provenance || !tags) return null;
  const anchors = Array.isArray(value.anchors)
    ? value.anchors.map(parseAnchor).filter((item): item is KoshaGuideCorpusAnchor => item !== null)
    : [];
  const record: KoshaGuideCorpusRecord = {
    referenceId: readString(value.referenceId),
    stableDocumentKey: readString(value.stableDocumentKey),
    version: readString(value.version),
    itemType,
    title: readString(value.title),
    category: readString(value.category),
    nativeBody: readString(value.nativeBody),
    bodyKind,
    quality,
    provenance,
    tags,
    anchors
  };
  return record.referenceId && record.stableDocumentKey && record.version && record.title && record.category
    && record.nativeBody
    ? record
    : null;
}

function parseChunk(value: unknown): SnapshotChunkV2 | null {
  if (!isRecord(value)) return null;
  const chunkId = readString(value.chunkId);
  const itemIds = readStringArray(value.itemIds);
  const itemCount = readPositiveInteger(value.itemCount);
  if (!chunkId || itemCount === null) return null;
  return { chunkId, itemIds, itemCount };
}

async function readJsonFile<T>(path: string, parse: (value: unknown) => T | null): Promise<{ raw: string; value: T | null }> {
  const raw = normalizeJsonText(await readFile(path, "utf8"));
  return { raw, value: parse(JSON.parse(raw) as unknown) };
}

async function readJsonLines<T>(path: string, parse: (value: unknown) => T | null): Promise<T[] | null> {
  const raw = normalizeStreamText(await readFile(path, "utf8"));
  if (!raw) return [];
  const rows = raw
    .split("\n")
    .filter(Boolean)
    .map((line) => parse(JSON.parse(line) as unknown));
  return rows.every((row) => row !== null) ? rows as T[] : null;
}

function scoreTagText(queryTokens: string[], candidate: ReadyIndexedRecord): number {
  return countMatches(queryTokens, candidate.tagText);
}

function scoreBodyText(queryTokens: string[], candidate: ReadyIndexedRecord): number {
  return countMatches(queryTokens, candidate.bodyText);
}

function directEligibility(record: KoshaGuideCorpusRecord): boolean {
  return record.provenance.lifecycle === "current"
    && record.bodyKind === "native"
    && record.quality === "accepted"
    && record.nativeBody.length > 0
    && record.provenance.bodyHash.length > 0
    && record.anchors.length > 0
    && record.anchors.every((anchor) => anchor.page > 0 && anchor.excerpt.length > 0)
    && sha256Text(record.nativeBody) === record.provenance.bodyHash;
}

export function resolveKoshaGuideSnapshotRoot(env: Record<string, string | undefined> = process.env): string | null {
  const root = env.KOSHA_GUIDE_SNAPSHOT_ROOT || env.KOSHA_GUIDE_CORPUS_ROOT;
  return root ? root.trim() : null;
}

export function buildKoshaGuideEvidenceRef(record: KoshaGuideCorpusRecord): string | null {
  const anchor = record.anchors[0];
  if (!anchor) return null;
  return `KOSHA 근거 ${record.referenceId} p.${anchor.page}: ${anchor.excerpt}`;
}

export async function loadKoshaGuideCorpus(options: KoshaGuideCorpusLookup = {}): Promise<KoshaGuideCorpusLoadResult> {
  const rootDir = options.rootDir === undefined ? resolveKoshaGuideSnapshotRoot(options.env) : options.rootDir;
  if (!rootDir) {
    return { status: "unconfigured", rootDir: null, failures: [] };
  }

  const currentPath = join(rootDir, "current.json");
  try {
    const currentFile = await readJsonFile(currentPath, parseCurrentSnapshot);
    if (!currentFile.value) {
      return { status: "blocked", rootDir, failures: ["schema:current.json"] };
    }

    const manifestPath = join(rootDir, currentFile.value.paths.manifest);
    let manifestFile: { raw: string; value: SnapshotManifestV2 | null };
    try {
      manifestFile = await readJsonFile(manifestPath, parseManifestSnapshot);
    } catch {
      return { status: "blocked", rootDir, failures: [`missing:${currentFile.value.paths.manifest}`] };
    }
    if (!manifestFile.value) {
      return { status: "blocked", rootDir, failures: ["schema:manifest.json"] };
    }

    const failures: string[] = [];
    const manifestSha256 = sha256Text(manifestFile.raw);
    if (manifestSha256 !== currentFile.value.hashes.manifestSha256) {
      failures.push("hash:manifest");
    }

    const sourcePayload = {
      sourceId: manifestFile.value.source.sourceId,
      snapshotVersion: manifestFile.value.source.snapshotVersion,
      corpusVersion: manifestFile.value.source.corpusVersion
    };
    if (sha256Text(stableStringify(sourcePayload)) !== manifestFile.value.source.sourceHash
      || manifestFile.value.source.sourceHash !== currentFile.value.hashes.sourceSha256) {
      failures.push("hash:source");
    }

    const generationPayload = {
      generationId: manifestFile.value.generation.generationId,
      generatedAt: manifestFile.value.generation.generatedAt,
      lifecycle: manifestFile.value.generation.lifecycle,
      stage: manifestFile.value.generation.stage
    };
    if (sha256Text(stableStringify(generationPayload)) !== manifestFile.value.generation.generationHash
      || manifestFile.value.generation.generationHash !== currentFile.value.hashes.generationSha256) {
      failures.push("hash:generation");
    }

    const accountingPayload = {
      itemCount: manifestFile.value.accounting.itemCount,
      chunkCount: manifestFile.value.accounting.chunkCount,
      failureCount: manifestFile.value.accounting.failureCount,
      acceptedCount: manifestFile.value.accounting.acceptedCount,
      reviewRequiredCount: manifestFile.value.accounting.reviewRequiredCount
    };
    if (sha256Text(stableStringify(accountingPayload)) !== manifestFile.value.accounting.accountingHash
      || manifestFile.value.accounting.accountingHash !== currentFile.value.hashes.accountingSha256) {
      failures.push("hash:accounting");
    }

    if (manifestFile.value.generation.lifecycle !== "current") {
      failures.push(`lifecycle:${manifestFile.value.generation.lifecycle}`);
    }
    if (manifestFile.value.generation.stage !== "complete") {
      failures.push(`stage:${manifestFile.value.generation.stage}`);
    }

    const itemsPath = join(rootDir, currentFile.value.paths.items);
    const chunksPath = join(rootDir, currentFile.value.paths.chunks);
    const failuresPath = join(rootDir, currentFile.value.paths.failures);
    const itemText = normalizeStreamText(await readFile(itemsPath, "utf8"));
    const chunkText = normalizeStreamText(await readFile(chunksPath, "utf8"));
    const failureText = normalizeStreamText(await readFile(failuresPath, "utf8"));
    if (sha256Text(itemText) !== manifestFile.value.files.items.sha256) failures.push("hash:items");
    if (sha256Text(chunkText) !== manifestFile.value.files.chunks.sha256) failures.push("hash:chunks");
    if (sha256Text(failureText) !== manifestFile.value.files.failures.sha256) failures.push("hash:failures");

    const records = await readJsonLines(itemsPath, parseRecord);
    const chunks = await readJsonLines(chunksPath, parseChunk);
    const failureRows = await readJsonLines(failuresPath, (value) => (isRecord(value) ? value : null));
    if (!records) failures.push("schema:items");
    if (!chunks) failures.push("schema:chunks");
    if (!failureRows) failures.push("schema:failures");
    if (!records || !chunks || !failureRows) {
      return { status: "blocked", rootDir, failures: [...new Set(failures)] };
    }

    if (currentFile.value.counts.items !== records.length || manifestFile.value.accounting.itemCount !== records.length) {
      failures.push("accounting:itemCount");
    }
    if (currentFile.value.counts.chunks !== chunks.length || manifestFile.value.accounting.chunkCount !== chunks.length) {
      failures.push("accounting:chunkCount");
    }
    if (currentFile.value.counts.failures !== failureRows.length || manifestFile.value.accounting.failureCount !== failureRows.length) {
      failures.push("accounting:failureCount");
    }
    if (manifestFile.value.files.items.count !== records.length) failures.push("accounting:item-file-count");
    if (manifestFile.value.files.chunks.count !== chunks.length) failures.push("accounting:chunk-file-count");
    if (manifestFile.value.files.failures.count !== failureRows.length) failures.push("accounting:failure-file-count");

    const acceptedCount = records.filter((record) => record.quality === "accepted").length;
    const reviewRequiredCount = records.filter((record) => record.quality === "review_required").length;
    if (acceptedCount !== manifestFile.value.accounting.acceptedCount) failures.push("accounting:acceptedCount");
    if (reviewRequiredCount !== manifestFile.value.accounting.reviewRequiredCount) failures.push("accounting:reviewRequiredCount");

    const recordCountByChunk = new Map<string, number>();
    records.forEach((record) => {
      recordCountByChunk.set(record.provenance.chunkId, (recordCountByChunk.get(record.provenance.chunkId) || 0) + 1);
    });
    for (const chunk of chunks) {
      const actualCount = recordCountByChunk.get(chunk.chunkId) || 0;
      if (actualCount !== chunk.itemCount) {
        failures.push(`accounting:chunk:${chunk.chunkId}`);
      }
      const expectedIds = [...chunk.itemIds].sort();
      const actualIds = records
        .filter((record) => record.provenance.chunkId === chunk.chunkId)
        .map((record) => record.referenceId)
        .sort();
      if (expectedIds.length !== actualIds.length || expectedIds.some((item, index) => item !== actualIds[index])) {
        failures.push(`accounting:chunk-ids:${chunk.chunkId}`);
      }
    }

    if (failureRows.length > 0) {
      failures.push(`failures:${failureRows.length}`);
    }

    if (failures.length > 0) {
      return { status: "blocked", rootDir, failures: [...new Set(failures)] };
    }

    return {
      status: "ready",
      rootDir,
      manifestSha256,
      itemCount: records.length,
      chunkCount: chunks.length,
      failureCount: failureRows.length,
      records,
      indexedRecords: records.map((record) => ({
        record,
        tagText: tokenize([
          record.version,
          record.title,
          record.category,
          ...record.tags.keywords,
          ...record.tags.riskTags,
          ...record.tags.controls
        ].join(" ")).join(" "),
        bodyText: tokenize([
          record.version,
          record.title,
          record.nativeBody,
          ...record.anchors.map((anchor) => anchor.excerpt)
        ].join(" ")).join(" ")
      }))
    };
  } catch {
    return { status: "blocked", rootDir, failures: ["missing:current.json"] };
  }
}

export function searchKoshaGuideCorpus(
  corpus: KoshaGuideCorpusReady,
  query: string,
  limit: number
): KoshaGuideCorpusSearchResult {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) {
    return { retrievalMode: null, items: [] };
  }

  const tagCandidates = corpus.indexedRecords
    .map((candidate) => ({
      candidate,
      score: scoreTagText(queryTokens, candidate)
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.candidate.record.referenceId.localeCompare(right.candidate.record.referenceId));
  const bodyCandidates = corpus.indexedRecords
    .map((candidate) => ({
      candidate,
      score: scoreBodyText(queryTokens, candidate)
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.candidate.record.referenceId.localeCompare(right.candidate.record.referenceId));

  const merged = new Map<string, KoshaGuideCorpusHit>();
  for (const tagCandidate of tagCandidates) {
    const directEligible = directEligibility(tagCandidate.candidate.record);
    merged.set(tagCandidate.candidate.record.referenceId, {
      referenceId: tagCandidate.candidate.record.referenceId,
      stableDocumentKey: tagCandidate.candidate.record.stableDocumentKey,
      retrievalMode: "local-tag",
      score: tagCandidate.score,
      directEligible,
      evidenceRef: directEligible ? buildKoshaGuideEvidenceRef(tagCandidate.candidate.record) : null,
      record: tagCandidate.candidate.record
    });
  }
  for (const bodyCandidate of bodyCandidates) {
    const existing = merged.get(bodyCandidate.candidate.record.referenceId);
    const directEligible = directEligibility(bodyCandidate.candidate.record);
    const nextMode: KoshaGuideOfflineRetrievalMode = existing ? "local-hybrid" : "local-ranked";
    merged.set(bodyCandidate.candidate.record.referenceId, {
      referenceId: bodyCandidate.candidate.record.referenceId,
      stableDocumentKey: bodyCandidate.candidate.record.stableDocumentKey,
      retrievalMode: nextMode,
      score: Math.max(existing?.score || 0, bodyCandidate.score),
      directEligible,
      evidenceRef: directEligible ? buildKoshaGuideEvidenceRef(bodyCandidate.candidate.record) : null,
      record: bodyCandidate.candidate.record
    });
  }

  const items = Array.from(merged.values())
    .sort((left, right) => right.score - left.score || left.referenceId.localeCompare(right.referenceId))
    .slice(0, limit);
  const retrievalMode = items.some((item) => item.retrievalMode === "local-hybrid")
    ? "local-hybrid"
    : items.some((item) => item.retrievalMode === "local-ranked")
      ? "local-ranked"
      : items.length
        ? "local-tag"
        : null;

  return { retrievalMode, items };
}

export function isKoshaGuideDirectEvidenceAccepted(record: KoshaGuideCorpusRecord): boolean {
  return directEligibility(record);
}
