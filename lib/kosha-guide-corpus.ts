import "server-only";

import { createHash } from "node:crypto";
import { lstat, open, realpath, type FileHandle } from "node:fs/promises";
import type { Stats } from "node:fs";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";

export type KoshaGuideCorpusItemType = "technical-guideline" | "technical-support-regulation";
export type KoshaGuideOfflineRetrievalMode = "local-tag" | "local-ranked" | "local-hybrid";

export type KoshaGuideCorpusAnchor = {
  page: number;
  excerpt: string;
};

export type KoshaGuideCorpusRecord = {
  referenceId: string;
  stableDocumentKey: string;
  version: string;
  itemType: KoshaGuideCorpusItemType;
  title: string;
  category: string;
  nativeBody: string;
  bodyKind: "native" | "unknown";
  quality: "accepted" | "review_required";
  provenance: {
    sourceId: string;
    generationId: string;
    generatedAt: string;
    lifecycle: "current" | "stale" | "retired";
    chunkId: string;
    bodyHash: string;
  };
  tags: {
    keywords: string[];
    riskTags: string[];
    controls: string[];
    primaryDocuments: string[];
  };
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

type IndexedRecord = {
  record: KoshaGuideCorpusRecord;
  tagText: string;
  bodyText: string;
};

export type KoshaGuideCorpusReady = {
  status: "ready";
  rootDir: string;
  manifestSha256: string;
  snapshotId: string;
  inventoryCount: number;
  itemCount: number;
  chunkCount: number;
  failureCount: number;
  records: KoshaGuideCorpusRecord[];
  indexedRecords: IndexedRecord[];
};

export type KoshaGuideCorpusLoadResult =
  | KoshaGuideCorpusReady
  | { status: "blocked"; rootDir: string | null; failures: string[] }
  | { status: "unconfigured"; rootDir: null; failures: [] };

export type KoshaGuideCorpusLookup = {
  rootDir?: string | null;
  env?: Record<string, string | undefined>;
  testHooks?: {
    afterPathChecked?: (path: string) => Promise<void> | void;
    afterStreamChunk?: (path: string, bytesRead: number) => Promise<void> | void;
  };
};

type CurrentSnapshot = {
  manifestPath: string;
  manifestSha256: string;
  manifestSize: number;
  snapshotId: string;
  snapshotPath: string;
  reproducibilityHash: string;
  sourceIdentitySha256: string;
  generationPolicySha256: string;
};

type ManifestSnapshot = {
  snapshotId: string;
  reproducibilityHash: string;
  sourceIdentitySha256: string;
  generationPolicySha256: string;
  hashes: { items: string; chunks: string; failures: string };
  counts: {
    inventory: number;
    success: number;
    chunks: number;
    failureLedger: number;
  };
};

type RawItem = {
  itemId: string;
  itemType: KoshaGuideCorpusItemType;
  title: string;
  category: string;
  body: string;
  bodyHash: string;
  state: string;
  stableKey: string;
  versionKey: string;
  sourceKey: string;
  extractionStatus: string;
};

type RawChunk = {
  chunkId: string;
  chunkHash: string;
  itemId: string;
  pageStart: number;
  pageEnd: number;
  text: string;
};

type RawFailure = { itemId: string };

const LIMITS = {
  current: 128 * 1024,
  manifest: 1024 * 1024,
  items: 48 * 1024 * 1024,
  chunks: 48 * 1024 * 1024,
  failures: 1024 * 1024,
  itemLine: 8 * 1024 * 1024,
  chunkLine: 512 * 1024,
  failureLine: 128 * 1024,
  itemLines: 2_000,
  chunkLines: 30_000,
  failureLines: 2_000
} as const;

class CorpusGateError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const loadCache = new Map<string, Promise<KoshaGuideCorpusLoadResult>>();
let uncachedLoads = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readRawString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/iu.test(value);
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function parseCurrent(value: unknown): CurrentSnapshot | null {
  if (!isRecord(value) || value.schema_version !== "safeclaw-kosha-body-current/v1") return null;
  const manifest = isRecord(value.manifest) ? value.manifest : null;
  if (!manifest) return null;
  const parsed: CurrentSnapshot = {
    manifestPath: readString(manifest.path),
    manifestSha256: readString(manifest.sha256).toLowerCase(),
    manifestSize: readInteger(manifest.size_bytes) ?? -1,
    snapshotId: readString(value.snapshot_id),
    snapshotPath: readString(value.snapshot_path),
    reproducibilityHash: readString(value.reproducibility_hash).toLowerCase(),
    sourceIdentitySha256: readString(value.source_identity_sha256).toLowerCase(),
    generationPolicySha256: readString(value.generation_policy_sha256).toLowerCase()
  };
  if (!parsed.manifestPath || parsed.manifestSize < 0 || !parsed.snapshotId || !parsed.snapshotPath) return null;
  if (![parsed.manifestSha256, parsed.reproducibilityHash, parsed.sourceIdentitySha256, parsed.generationPolicySha256].every(isSha256)) return null;
  return parsed;
}

function parseManifest(value: unknown): ManifestSnapshot | null {
  if (!isRecord(value) || value.schema_version !== "safeclaw-kosha-body-corpus/v2") return null;
  const counts = isRecord(value.counts) ? value.counts : null;
  const hashes = isRecord(value.output_hashes) ? value.output_hashes : null;
  const identity = isRecord(value.source_identity) ? value.source_identity : null;
  if (!counts || !hashes || !identity) return null;
  const parsed: ManifestSnapshot = {
    snapshotId: readString(value.snapshot_id),
    reproducibilityHash: readString(value.reproducibility_hash).toLowerCase(),
    sourceIdentitySha256: readString(identity.identity_sha256).toLowerCase(),
    generationPolicySha256: readString(value.generation_policy_sha256).toLowerCase(),
    hashes: {
      items: readString(hashes["items.jsonl"]).toLowerCase(),
      chunks: readString(hashes["chunks.jsonl"]).toLowerCase(),
      failures: readString(hashes["failures.jsonl"]).toLowerCase()
    },
    counts: {
      inventory: readInteger(counts.inventory) ?? -1,
      success: readInteger(counts.success) ?? -1,
      chunks: readInteger(counts.chunks) ?? -1,
      failureLedger: readInteger(counts.failure_ledger) ?? -1
    }
  };
  if (!parsed.snapshotId || Object.values(parsed.counts).some((count) => count < 0)) return null;
  if (![parsed.reproducibilityHash, parsed.sourceIdentitySha256, parsed.generationPolicySha256, ...Object.values(parsed.hashes)].every(isSha256)) return null;
  return parsed;
}

function parseItem(value: unknown): RawItem | null {
  if (!isRecord(value) || value.schema_version !== "safeclaw-kosha-body-corpus/v2") return null;
  const itemType = value.item_type;
  if (itemType !== "technical-guideline" && itemType !== "technical-support-regulation") return null;
  const body = readRawString(value.body) ?? "";
  const parsed: RawItem = {
    itemId: readString(value.item_id),
    itemType,
    title: readString(value.title),
    category: readString(value.category),
    body,
    bodyHash: readString(value.normalized_text_sha256).toLowerCase(),
    state: readString(value.state),
    stableKey: readString(value.stable_key),
    versionKey: readString(value.version_key),
    sourceKey: readString(value.source_key),
    extractionStatus: readString(value.extraction_status)
  };
  if (!parsed.itemId || !parsed.title || !parsed.category || !parsed.state || !parsed.stableKey || !parsed.versionKey || !parsed.sourceKey || !parsed.extractionStatus || !isSha256(parsed.bodyHash)) return null;
  return parsed;
}

function parseChunk(value: unknown): RawChunk | null {
  if (!isRecord(value) || value.schema_version !== "safeclaw-kosha-body-corpus/v2") return null;
  const text = readRawString(value.text);
  const parsed: RawChunk = {
    chunkId: readString(value.chunk_id),
    chunkHash: readString(value.chunk_sha256).toLowerCase(),
    itemId: readString(value.item_id),
    pageStart: readInteger(value.page_start) ?? 0,
    pageEnd: readInteger(value.page_end) ?? 0,
    text: text ?? ""
  };
  if (!parsed.chunkId || !parsed.itemId || !isSha256(parsed.chunkHash) || parsed.pageStart < 1 || parsed.pageEnd < parsed.pageStart || !parsed.text) return null;
  return parsed;
}

function parseFailure(value: unknown): RawFailure | null {
  if (!isRecord(value) || value.schema_version !== "safeclaw-kosha-body-corpus/v2") return null;
  const itemId = readString(value.item_id);
  return itemId ? { itemId } : null;
}

function isInside(rootDir: string, target: string): boolean {
  const rel = relative(rootDir, target);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

async function resolveSafePath(rootDir: string, requestedPath: string): Promise<string> {
  if (!requestedPath || isAbsolute(requestedPath)) throw new CorpusGateError("path:absolute");
  const parts = requestedPath.split(/[\\/]+/u);
  if (parts.some((part) => !part || part === "." || part === "..")) throw new CorpusGateError("path:escape");
  const candidate = resolve(rootDir, ...parts);
  if (!isInside(rootDir, candidate)) throw new CorpusGateError("path:escape");
  let cursor = rootDir;
  for (const part of parts) {
    cursor = resolve(cursor, part);
    const entry = await lstat(cursor);
    if (entry.isSymbolicLink()) throw new CorpusGateError("path:symlink");
  }
  const realTarget = await realpath(candidate);
  if (!isInside(rootDir, realTarget)) throw new CorpusGateError("path:escape");
  return realTarget;
}

function sameFile(before: Stats, opened: Stats): boolean {
  return before.isFile() && opened.isFile() && before.dev === opened.dev && before.ino === opened.ino;
}

async function openSafeFile(
  rootDir: string,
  requestedPath: string,
  maxBytes: number,
  hooks?: KoshaGuideCorpusLookup["testHooks"]
): Promise<{ handle: FileHandle; path: string; initialSize: number }> {
  const path = await resolveSafePath(rootDir, requestedPath);
  const before = await lstat(path);
  if (!before.isFile() || before.size > maxBytes) throw new CorpusGateError(`limit:file:${basename(path)}`);
  await hooks?.afterPathChecked?.(path);
  const handle = await open(path, "r");
  const opened = await handle.stat();
  if (!sameFile(before, opened)) {
    await handle.close();
    throw new CorpusGateError("path:toctou");
  }
  return { handle, path, initialSize: opened.size };
}

async function readJsonFile<T>(
  rootDir: string,
  path: string,
  maxBytes: number,
  parser: (value: unknown) => T | null,
  hooks?: KoshaGuideCorpusLookup["testHooks"]
): Promise<{ raw: Buffer; value: T }> {
  const file = await openSafeFile(rootDir, path, maxBytes, hooks);
  try {
    const raw = Buffer.alloc(file.initialSize);
    const result = await file.handle.read(raw, 0, raw.length, 0);
    if (result.bytesRead !== raw.length) throw new CorpusGateError(`read:short:${basename(path)}`);
    const value = parser(JSON.parse(raw.toString("utf8")) as unknown);
    if (!value) throw new CorpusGateError(`schema:${basename(path)}`);
    return { raw, value };
  } catch (error) {
    if (error instanceof CorpusGateError) throw error;
    throw new CorpusGateError(`schema:${basename(path)}`);
  } finally {
    await file.handle.close();
  }
}

async function readJsonLines<T>(
  rootDir: string,
  path: string,
  maxBytes: number,
  maxLines: number,
  maxLineBytes: number,
  parser: (value: unknown) => T | null,
  hooks?: KoshaGuideCorpusLookup["testHooks"]
): Promise<{ rows: T[]; hash: string }> {
  const file = await openSafeFile(rootDir, path, maxBytes, hooks);
  const hash = createHash("sha256");
  const rows: T[] = [];
  let pending = Buffer.alloc(0);
  let offset = 0;
  let total = 0;
  const parseLine = (lineWithCr: Buffer): void => {
    const line = lineWithCr.at(-1) === 13 ? lineWithCr.subarray(0, -1) : lineWithCr;
    if (!line.length) return;
    if (line.length > maxLineBytes) throw new CorpusGateError(`limit:record:${basename(path)}`);
    if (rows.length >= maxLines) throw new CorpusGateError(`limit:lines:${basename(path)}`);
    let value: T | null = null;
    try {
      value = parser(JSON.parse(line.toString("utf8")) as unknown);
    } catch {
      throw new CorpusGateError(`schema:${basename(path)}`);
    }
    if (!value) throw new CorpusGateError(`schema:${basename(path)}`);
    rows.push(value);
  };
  try {
    while (true) {
      const buffer = Buffer.alloc(64 * 1024);
      const result = await file.handle.read(buffer, 0, buffer.length, offset);
      if (!result.bytesRead) break;
      const chunk = buffer.subarray(0, result.bytesRead);
      offset += result.bytesRead;
      total += result.bytesRead;
      if (total > maxBytes) throw new CorpusGateError(`limit:file:${basename(path)}`);
      hash.update(chunk);
      await hooks?.afterStreamChunk?.(file.path, total);
      const current = await file.handle.stat();
      if (current.size > maxBytes) throw new CorpusGateError(`limit:file:${basename(path)}`);
      pending = Buffer.concat([pending, chunk]);
      let newline = pending.indexOf(10);
      while (newline >= 0) {
        parseLine(pending.subarray(0, newline));
        pending = pending.subarray(newline + 1);
        newline = pending.indexOf(10);
      }
      if (pending.length > maxLineBytes) throw new CorpusGateError(`limit:record:${basename(path)}`);
    }
    if (pending.length) parseLine(pending);
    return { rows, hash: hash.digest("hex") };
  } finally {
    await file.handle.close();
  }
}

const RISK_TERMS = ["추락", "충돌", "끼임", "감전", "질식", "화재", "폭발", "붕괴", "낙하", "전도"];

function tokens(value: string): string[] {
  return [...new Set(normalizeText(value).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/u)
    .filter((token) => token.length >= 2 && !["작업", "안전", "관리", "확인"].includes(token)))];
}

function buildRecord(item: RawItem, chunks: RawChunk[], snapshotId: string): KoshaGuideCorpusRecord {
  const normalizedBody = normalizeText(item.body);
  const validBody = Boolean(normalizedBody) && sha256(normalizedBody) === item.bodyHash;
  const anchors = chunks.slice(0, 8).map((chunk) => ({
    page: chunk.pageStart,
    excerpt: normalizeText(chunk.text).slice(0, 220)
  }));
  const searchText = normalizeText(`${item.title} ${item.category} ${normalizedBody}`);
  const controls = searchText.split(/(?<=[.!?다])\s+/u)
    .filter((sentence) => /설치|점검|차단|분리|배치|통제|착용|금지|확인/u.test(sentence))
    .slice(0, 2)
    .map((sentence) => sentence.slice(0, 180));
  const lifecycle = item.state === "current" ? "current" : item.state === "retired" ? "retired" : "stale";
  return {
    referenceId: item.itemId.startsWith("kosha-") ? item.itemId : `kosha-${item.itemId}`,
    stableDocumentKey: item.stableKey,
    version: item.versionKey,
    itemType: item.itemType,
    title: item.title,
    category: item.category,
    nativeBody: normalizedBody,
    bodyKind: validBody ? "native" : "unknown",
    quality: validBody && anchors.length ? "accepted" : "review_required",
    provenance: {
      sourceId: item.sourceKey,
      generationId: snapshotId,
      generatedAt: "",
      lifecycle,
      chunkId: anchors.length ? chunks[0]?.chunkId ?? "" : "",
      bodyHash: item.bodyHash
    },
    tags: {
      keywords: tokens(`${item.title} ${item.category}`).slice(0, 24),
      riskTags: RISK_TERMS.filter((term) => searchText.includes(term)),
      controls: controls.length ? controls : [anchors[0]?.excerpt ?? item.title],
      primaryDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"]
    },
    anchors
  };
}

function validateSnapshot(current: CurrentSnapshot, manifest: ManifestSnapshot): void {
  if (current.snapshotId !== manifest.snapshotId || current.reproducibilityHash !== manifest.reproducibilityHash) throw new CorpusGateError("identity:snapshot");
  if (current.sourceIdentitySha256 !== manifest.sourceIdentitySha256) throw new CorpusGateError("identity:source");
  if (current.generationPolicySha256 !== manifest.generationPolicySha256) throw new CorpusGateError("identity:policy");
}

async function loadUncached(rootDir: string, current: CurrentSnapshot, hooks?: KoshaGuideCorpusLookup["testHooks"]): Promise<KoshaGuideCorpusLoadResult> {
  uncachedLoads += 1;
  try {
    const manifestFile = await readJsonFile(rootDir, current.manifestPath, LIMITS.manifest, parseManifest, hooks);
    if (manifestFile.raw.length !== current.manifestSize || sha256(manifestFile.raw) !== current.manifestSha256) throw new CorpusGateError("hash:manifest");
    validateSnapshot(current, manifestFile.value);
    const prefix = current.snapshotPath;
    const [itemsFile, chunksFile, failuresFile] = await Promise.all([
      readJsonLines(rootDir, `${prefix}/items.jsonl`, LIMITS.items, LIMITS.itemLines, LIMITS.itemLine, parseItem, hooks),
      readJsonLines(rootDir, `${prefix}/chunks.jsonl`, LIMITS.chunks, LIMITS.chunkLines, LIMITS.chunkLine, parseChunk, hooks),
      readJsonLines(rootDir, `${prefix}/failures.jsonl`, LIMITS.failures, LIMITS.failureLines, LIMITS.failureLine, parseFailure, hooks)
    ]);
    const manifest = manifestFile.value;
    if (itemsFile.hash !== manifest.hashes.items || chunksFile.hash !== manifest.hashes.chunks || failuresFile.hash !== manifest.hashes.failures) throw new CorpusGateError("hash:outputs");

    const failedIds = new Set(failuresFile.rows.map((failure) => failure.itemId));
    const items = new Map<string, RawItem>();
    for (const item of itemsFile.rows) {
      if (items.has(item.itemId)) throw new CorpusGateError(`duplicate:item:${item.itemId}`);
      items.set(item.itemId, item);
    }
    const chunksByItem = new Map<string, RawChunk[]>();
    const chunkIds = new Set<string>();
    for (const chunk of chunksFile.rows) {
      if (chunkIds.has(chunk.chunkId)) throw new CorpusGateError(`duplicate:chunk:${chunk.chunkId}`);
      chunkIds.add(chunk.chunkId);
      if (!items.has(chunk.itemId)) throw new CorpusGateError(`orphan:chunk:${chunk.itemId}`);
      if (sha256(chunk.text) !== chunk.chunkHash) throw new CorpusGateError(`hash:chunk:${chunk.chunkId}`);
      const list = chunksByItem.get(chunk.itemId) ?? [];
      list.push(chunk);
      chunksByItem.set(chunk.itemId, list);
    }
    const records = [...items.values()]
      .filter((item) => !failedIds.has(item.itemId))
      .map((item) => buildRecord(item, chunksByItem.get(item.itemId) ?? [], current.snapshotId));
    if (manifest.counts.inventory !== items.size || manifest.counts.success !== records.length || manifest.counts.chunks !== chunksFile.rows.length || manifest.counts.failureLedger !== failuresFile.rows.length) {
      throw new CorpusGateError("count:manifest");
    }
    return {
      status: "ready",
      rootDir,
      manifestSha256: current.manifestSha256,
      snapshotId: current.snapshotId,
      inventoryCount: manifest.counts.inventory,
      itemCount: records.length,
      chunkCount: chunksFile.rows.length,
      failureCount: failuresFile.rows.length,
      records,
      indexedRecords: records.map((record) => ({
        record,
        tagText: normalizeText([record.title, record.category, ...record.tags.keywords, ...record.tags.riskTags, ...record.tags.controls].join(" ")).toLowerCase(),
        bodyText: record.nativeBody.toLowerCase()
      }))
    };
  } catch (error) {
    const code = error instanceof CorpusGateError ? error.code : "load:unexpected";
    return { status: "blocked", rootDir, failures: [code] };
  }
}

export async function loadKoshaGuideCorpus(options: KoshaGuideCorpusLookup = {}): Promise<KoshaGuideCorpusLoadResult> {
  const configuredRoot = options.rootDir ?? options.env?.KOSHA_GUIDE_CORPUS_DIR ?? process.env.KOSHA_GUIDE_CORPUS_DIR;
  if (!configuredRoot) return { status: "unconfigured", rootDir: null, failures: [] };
  let rootDir: string;
  try {
    rootDir = await realpath(resolve(configuredRoot));
    const currentFile = await readJsonFile(rootDir, "current.json", LIMITS.current, parseCurrent, options.testHooks);
    const current = currentFile.value;
    const key = `${rootDir}|${current.snapshotId}|${current.manifestSha256}`;
    const cached = loadCache.get(key);
    if (cached) return cached;
    const promise = loadUncached(rootDir, current, options.testHooks);
    loadCache.set(key, promise);
    return await promise;
  } catch (error) {
    const code = error instanceof CorpusGateError ? error.code : "load:root";
    return { status: "blocked", rootDir: configuredRoot, failures: [code] };
  }
}

function directEligible(record: KoshaGuideCorpusRecord): boolean {
  return record.quality === "accepted" && record.bodyKind === "native" && record.provenance.lifecycle === "current" && record.anchors.length > 0;
}

function evidenceRef(record: KoshaGuideCorpusRecord): string | null {
  const anchor = record.anchors[0];
  if (!anchor) return null;
  return `KOSHA 근거 ${record.version} p.${anchor.page}: ${anchor.excerpt}`;
}

export function searchKoshaGuideCorpus(
  corpus: KoshaGuideCorpusReady,
  query: string,
  limit: number,
  itemType?: string
): { retrievalMode: KoshaGuideOfflineRetrievalMode | null; items: KoshaGuideCorpusHit[] } {
  const queryTokens = tokens(query);
  const candidates = corpus.indexedRecords.filter(({ record }) => !itemType || record.itemType === itemType);
  const hits = candidates.map(({ record, tagText, bodyText }) => {
    const tagMatches = queryTokens.filter((token) => tagText.includes(token)).length;
    const bodyMatches = queryTokens.filter((token) => bodyText.includes(token)).length;
    const retrievalMode: KoshaGuideOfflineRetrievalMode = tagMatches && bodyMatches
      ? "local-hybrid"
      : bodyMatches
        ? "local-ranked"
        : "local-tag";
    return {
      referenceId: record.referenceId,
      stableDocumentKey: record.stableDocumentKey,
      retrievalMode,
      score: tagMatches * 5 + bodyMatches * 2 + (queryTokens.length ? 0 : 1),
      directEligible: directEligible(record),
      evidenceRef: evidenceRef(record),
      record
    };
  }).filter((hit) => !queryTokens.length || hit.score > 0)
    .sort((left, right) => right.score - left.score || left.referenceId.localeCompare(right.referenceId))
    .slice(0, Math.min(Math.max(limit, 1), 50));
  const retrievalMode = hits.some((hit) => hit.retrievalMode === "local-hybrid")
    ? "local-hybrid"
    : hits.some((hit) => hit.retrievalMode === "local-ranked")
      ? "local-ranked"
      : hits.length ? "local-tag" : null;
  return { retrievalMode, items: hits };
}

export function isKoshaGuideDirectEvidenceAccepted(record: KoshaGuideCorpusRecord): boolean {
  return directEligible(record);
}

export function resetKoshaGuideCorpusCacheForTests(): void {
  loadCache.clear();
  uncachedLoads = 0;
}

export function getKoshaGuideCorpusCacheStatsForTests(): { entries: number; uncachedLoads: number } {
  return { entries: loadCache.size, uncachedLoads };
}
