import "server-only";

import { createHash } from "node:crypto";
import { open, lstat, realpath, stat, type FileHandle } from "node:fs/promises";
import type { Stats } from "node:fs";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";

export type KoshaGuideCorpusItemType = "technical-guideline" | "technical-support-regulation";
export type KoshaGuideCorpusBodyKind = "native" | "unknown";
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
  snapshotId: string;
  inventoryCount: number;
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
  testHooks?: {
    afterPathChecked?: (path: string) => Promise<void> | void;
    afterStreamChunk?: (path: string, bytesRead: number) => Promise<void> | void;
  };
};

type CurrentSnapshotV1 = {
  schemaVersion: "safeclaw-kosha-body-current/v1";
  manifest: { path: string; sha256: string; sizeBytes: number };
  reproducibilityHash: string;
  snapshotId: string;
  snapshotPath: string;
  sourceIdentitySha256: string;
  generationPolicySha256: string;
};

type ManifestSnapshotV2 = {
  schemaVersion: "safeclaw-kosha-body-corpus/v2";
  snapshotId: string;
  reproducibilityHash: string;
  sourceIdentitySha256: string;
  generationPolicySha256: string;
  outputHashes: { items: string; chunks: string; failures: string };
  counts: { inventory: number; completed: number; success: number; failure: number; chunks: number; failureLedger: number };
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

const MAX_CURRENT_BYTES = 128 * 1024;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_ITEMS_FILE_BYTES = 48 * 1024 * 1024;
const MAX_CHUNKS_FILE_BYTES = 48 * 1024 * 1024;
const MAX_FAILURES_FILE_BYTES = 1024 * 1024;
const MAX_ITEMS_LINES = 2_000;
const MAX_CHUNKS_LINES = 30_000;
const MAX_FAILURES_LINES = 2_000;
const MAX_ITEM_LINE_BYTES = 8 * 1024 * 1024;
const MAX_CHUNK_LINE_BYTES = 512 * 1024;
const MAX_FAILURE_LINE_BYTES = 128 * 1024;

class KoshaCorpusError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const corpusCache = new Map<string, Promise<KoshaGuideCorpusLoadResult>>();
let uncachedLoadCount = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readRawString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeNativeBody(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function tokenize(value: string): string[] {
  return [...new Set(value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2))];
}

function countMatches(queryTokens: string[], text: string): number {
  return queryTokens.filter((token) => text.includes(token)).length;
}

function parseCurrentSnapshot(value: unknown): CurrentSnapshotV1 | null {
  if (!isRecord(value) || value.schema_version !== "safeclaw-kosha-body-current/v1") return null;
  const manifest = isRecord(value.manifest) ? value.manifest : null;
  if (!manifest) return null;
  const path = readString(manifest.path);
  const sha256 = readString(manifest.sha256).toLowerCase();
  const sizeBytes = readNonNegativeInteger(manifest.size_bytes);
  const reproducibilityHash = readString(value.reproducibility_hash).toLowerCase();
  const snapshotId = readString(value.snapshot_id);
  const snapshotPath = readString(value.snapshot_path);
  const sourceIdentitySha256 = readString(value.source_identity_sha256).toLowerCase();
  const generationPolicySha256 = readString(value.generation_policy_sha256).toLowerCase();
  if (!path || sizeBytes === null || !snapshotId || !snapshotPath
    || !isSha256(sha256) || !isSha256(reproducibilityHash)
    || !isSha256(sourceIdentitySha256) || !isSha256(generationPolicySha256)) return null;
  return {
    schemaVersion: "safeclaw-kosha-body-current/v1",
    manifest: { path, sha256, sizeBytes },
    reproducibilityHash,
    snapshotId,
    snapshotPath,
    sourceIdentitySha256,
    generationPolicySha256
  };
}

function parseManifestSnapshot(value: unknown): ManifestSnapshotV2 | null {
  if (!isRecord(value) || value.schema_version !== "safeclaw-kosha-body-corpus/v2") return null;
  const counts = isRecord(value.counts) ? value.counts : null;
  const outputHashes = isRecord(value.output_hashes) ? value.output_hashes : null;
  if (!counts || !outputHashes) return null;
  const parsedCounts = {
    inventory: readNonNegativeInteger(counts.inventory),
    completed: readNonNegativeInteger(counts.completed),
    success: readNonNegativeInteger(counts.success),
    failure: readNonNegativeInteger(counts.failure),
    chunks: readNonNegativeInteger(counts.chunks),
    failureLedger: readNonNegativeInteger(counts.failure_ledger)
  };
  const hashes = {
    items: readString(outputHashes["items.jsonl"]).toLowerCase(),
    chunks: readString(outputHashes["chunks.jsonl"]).toLowerCase(),
    failures: readString(outputHashes["failures.jsonl"]).toLowerCase()
  };
  const snapshotId = readString(value.snapshot_id);
  const reproducibilityHash = readString(value.reproducibility_hash).toLowerCase();
  const sourceIdentity = isRecord(value.source_identity) ? value.source_identity : null;
  const sourceIdentitySha256 = readString(sourceIdentity?.identity_sha256).toLowerCase();
  const generationPolicySha256 = readString(value.generation_policy_sha256).toLowerCase();
  if (Object.values(parsedCounts).some((count) => count === null)
    || !snapshotId || !isSha256(reproducibilityHash) || !isSha256(sourceIdentitySha256)
    || !isSha256(generationPolicySha256) || Object.values(hashes).some((hash) => !isSha256(hash))) return null;
  return {
    schemaVersion: "safeclaw-kosha-body-corpus/v2",
    snapshotId,
    reproducibilityHash,
    sourceIdentitySha256,
    generationPolicySha256,
    outputHashes: hashes,
    counts: parsedCounts as ManifestSnapshotV2["counts"]
  };
}

function parseItem(value: unknown): RawItem | null {
  if (!isRecord(value) || value.schema_version !== "safeclaw-kosha-body-corpus/v2") return null;
  const itemType = value.item_type;
  if (itemType !== "technical-guideline" && itemType !== "technical-support-regulation") return null;
  const body = readRawString(value.body) ?? "";
  const itemId = readString(value.item_id);
  const title = readString(value.title);
  const category = readString(value.category);
  const bodyHash = readString(value.normalized_text_sha256).toLowerCase();
  const state = readString(value.state);
  const stableKey = readString(value.stable_key);
  const versionKey = readString(value.version_key);
  const sourceKey = readString(value.source_key);
  const extractionStatus = readString(value.extraction_status);
  if (!itemId || !title || !category || !state || !stableKey || !versionKey || !sourceKey || !extractionStatus || !isSha256(bodyHash)) return null;
  return { itemId, itemType, title, category, body, bodyHash, state, stableKey, versionKey, sourceKey, extractionStatus };
}

function parseChunk(value: unknown): RawChunk | null {
  if (!isRecord(value) || value.schema_version !== "safeclaw-kosha-body-corpus/v2") return null;
  const chunkId = readString(value.chunk_id);
  const chunkHash = readString(value.chunk_sha256).toLowerCase();
  const itemId = readString(value.item_id);
  const pageStart = readNonNegativeInteger(value.page_start);
  const pageEnd = readNonNegativeInteger(value.page_end);
  const text = readRawString(value.text);
  if (!chunkId || !isSha256(chunkHash) || !itemId || pageStart === null || pageStart < 1 || pageEnd === null || pageEnd < pageStart || text === null || !text) return null;
  return { chunkId, chunkHash, itemId, pageStart, pageEnd, text };
}

function parseFailure(value: unknown): RawFailure | null {
  if (!isRecord(value) || value.schema_version !== "safeclaw-kosha-body-corpus/v2") return null;
  const itemId = readString(value.item_id);
  return itemId ? { itemId } : null;
}

function isWithinRoot(rootDir: string, target: string): boolean {
  const pathToTarget = relative(rootDir, target);
  return pathToTarget !== "" && !pathToTarget.startsWith(`..${sep}`) && pathToTarget !== ".." && !isAbsolute(pathToTarget);
}

async function resolveSafeRelativeFile(rootDir: string, requestedPath: string): Promise<string> {
  if (!requestedPath || isAbsolute(requestedPath)) throw new KoshaCorpusError("path:absolute");
  const parts = requestedPath.split(/[\\/]+/u);
  if (parts.some((part) => !part || part === "." || part === "..")) throw new KoshaCorpusError("path:escape");
  const candidate = resolve(rootDir, ...parts);
  if (!isWithinRoot(rootDir, candidate)) throw new KoshaCorpusError("path:escape");
  let cursor = rootDir;
  for (const part of parts) {
    cursor = join(cursor, part);
    const entry = await lstat(cursor);
    if (entry.isSymbolicLink()) throw new KoshaCorpusError("path:symlink");
  }
  const realTarget = await realpath(candidate);
  if (!isWithinRoot(rootDir, realTarget)) throw new KoshaCorpusError("path:escape");
  return realTarget;
}

function sameOpenedFile(beforeOpen: Stats, opened: Stats): boolean {
  if (!beforeOpen.isFile() || !opened.isFile()) return false;
  return beforeOpen.dev === opened.dev && beforeOpen.ino === opened.ino;
}

async function openSafeFile(rootDir: string, requestedPath: string, maxBytes: number, hook?: KoshaGuideCorpusLookup["testHooks"]): Promise<{ handle: FileHandle; path: string; size: number }> {
  const path = await resolveSafeRelativeFile(rootDir, requestedPath);
  const beforeOpen = await lstat(path);
  if (beforeOpen.isSymbolicLink() || !beforeOpen.isFile() || beforeOpen.size > maxBytes) throw new KoshaCorpusError("path:file");
  await hook?.afterPathChecked?.(path);
  const handle = await open(path, "r");
  const opened = await handle.stat();
  if (!sameOpenedFile(beforeOpen, opened) || opened.size > maxBytes) {
    await handle.close();
    throw new KoshaCorpusError("path:toctou");
  }
  return { handle, path, size: opened.size };
}

async function readBoundedJson<T>(rootDir: string, requestedPath: string, maxBytes: number, parse: (value: unknown) => T | null, hook?: KoshaGuideCorpusLookup["testHooks"]): Promise<{ raw: Buffer; value: T }> {
  const file = await openSafeFile(rootDir, requestedPath, maxBytes, hook);
  try {
    const raw = Buffer.alloc(file.size);
    const { bytesRead } = await file.handle.read(raw, 0, file.size, 0);
    if (bytesRead !== file.size) throw new KoshaCorpusError("read:short");
    const value = parse(JSON.parse(raw.toString("utf8")) as unknown);
    if (!value) throw new KoshaCorpusError(`schema:${basename(requestedPath)}`);
    return { raw, value };
  } catch (error) {
    if (error instanceof KoshaCorpusError) throw error;
    throw new KoshaCorpusError(`schema:${basename(requestedPath)}`);
  } finally {
    await file.handle.close();
  }
}

async function readBoundedJsonLines<T>(rootDir: string, requestedPath: string, maxBytes: number, maxLines: number, maxLineBytes: number, parse: (value: unknown) => T | null, hook?: KoshaGuideCorpusLookup["testHooks"]): Promise<{ rows: T[]; sha256: string }> {
  const file = await openSafeFile(rootDir, requestedPath, maxBytes, hook);
  try {
    const hash = createHash("sha256");
    const stream = file.handle.createReadStream({ autoClose: false, highWaterMark: 64 * 1024 });
    const rows: T[] = [];
    const parseLine = (rawLine: Buffer): void => {
      const end = rawLine.length > 0 && rawLine[rawLine.length - 1] === 13 ? rawLine.length - 1 : rawLine.length;
      const line = rawLine.subarray(0, end);
      if (!line.length) return;
      if (line.length > maxLineBytes) throw new KoshaCorpusError(`limit:record:${basename(requestedPath)}`);
      if (rows.length >= maxLines) throw new KoshaCorpusError(`limit:lines:${basename(requestedPath)}`);
      let value: T | null;
      try {
        value = parse(JSON.parse(line.toString("utf8")) as unknown);
      } catch (error) {
        throw new KoshaCorpusError(`schema:${basename(requestedPath)}`);
      }
      if (!value) throw new KoshaCorpusError(`schema:${basename(requestedPath)}:${rows.length + 1}`);
      rows.push(value);
    };
    let pending = Buffer.alloc(0);
    let bytesRead = 0;
    for await (const chunk of stream) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytesRead += bytes.length;
      const currentStats = await file.handle.stat();
      if (bytesRead > maxBytes || currentStats.size > maxBytes) {
        throw new KoshaCorpusError(`limit:file:${basename(requestedPath)}`);
      }
      hash.update(bytes);
      pending = pending.length ? Buffer.concat([pending, bytes]) : bytes;
      let newline = pending.indexOf(10);
      while (newline >= 0) {
        parseLine(pending.subarray(0, newline));
        pending = pending.subarray(newline + 1);
        newline = pending.indexOf(10);
      }
      if (pending.length > maxLineBytes) throw new KoshaCorpusError(`limit:record:${basename(requestedPath)}`);
      await hook?.afterStreamChunk?.(file.path, bytesRead);
      const postHookStats = await file.handle.stat();
      if (postHookStats.size > maxBytes) throw new KoshaCorpusError(`limit:file:${basename(requestedPath)}`);
    }
    parseLine(pending);
    return { rows, sha256: hash.digest("hex") };
  } finally {
    await file.handle.close();
  }
}

function classifyLifecycle(state: string): KoshaGuideCorpusLifecycle {
  if (state.startsWith("current")) return "current";
  if (state.startsWith("retired")) return "retired";
  return "stale";
}

function makeRecord(item: RawItem, snapshotId: string, anchors: KoshaGuideCorpusAnchor[]): KoshaGuideCorpusRecord {
  const lifecycle = classifyLifecycle(item.state);
  const native = item.extractionStatus === "success" && item.body.length > 0;
  return {
    referenceId: item.itemId,
    stableDocumentKey: item.stableKey,
    version: item.versionKey,
    itemType: item.itemType,
    title: item.title,
    category: item.category,
    nativeBody: item.body,
    bodyKind: native ? "native" : "unknown",
    quality: lifecycle === "current" && item.state === "current" && native ? "accepted" : "review_required",
    provenance: {
      sourceId: item.sourceKey,
      generationId: snapshotId,
      generatedAt: snapshotId,
      lifecycle,
      chunkId: anchors[0] ? `${item.itemId}:p${anchors[0].page}` : "",
      bodyHash: item.bodyHash
    },
    tags: {
      keywords: [item.versionKey, item.title, item.category],
      riskTags: [],
      controls: [],
      primaryDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"]
    },
    anchors
  };
}

async function readCurrentIdentity(rootDir: string, hook?: KoshaGuideCorpusLookup["testHooks"]): Promise<{ current: CurrentSnapshotV1; cacheKey: string }> {
  const currentFile = await readBoundedJson(rootDir, "current.json", MAX_CURRENT_BYTES, parseCurrentSnapshot, hook);
  const current = currentFile.value;
  const cacheKey = [rootDir, sha256Bytes(currentFile.raw), current.snapshotId, current.sourceIdentitySha256, current.manifest.path, current.manifest.sha256].join(":");
  return { current, cacheKey };
}

async function loadUncached(rootDir: string, current: CurrentSnapshotV1, options: KoshaGuideCorpusLookup): Promise<KoshaGuideCorpusLoadResult> {
  uncachedLoadCount += 1;
  const manifestFile = await readBoundedJson(rootDir, current.manifest.path, MAX_MANIFEST_BYTES, parseManifestSnapshot, options.testHooks);
  const manifest = manifestFile.value;
  if (manifestFile.raw.length !== current.manifest.sizeBytes || sha256Bytes(manifestFile.raw) !== current.manifest.sha256) throw new KoshaCorpusError("hash:manifest");
  if (manifest.snapshotId !== current.snapshotId || manifest.reproducibilityHash !== current.reproducibilityHash
    || manifest.sourceIdentitySha256 !== current.sourceIdentitySha256 || manifest.generationPolicySha256 !== current.generationPolicySha256) throw new KoshaCorpusError("identity:manifest");

  const snapshotBase = `${current.snapshotPath}/`;
  if (!current.manifest.path.startsWith(snapshotBase)) throw new KoshaCorpusError("path:manifest");
  const snapshotDir = current.manifest.path.slice(0, -"manifest.json".length);
  const items = await readBoundedJsonLines(rootDir, `${snapshotDir}items.jsonl`, MAX_ITEMS_FILE_BYTES, MAX_ITEMS_LINES, MAX_ITEM_LINE_BYTES, parseItem, options.testHooks);
  const chunks = await readBoundedJsonLines(rootDir, `${snapshotDir}chunks.jsonl`, MAX_CHUNKS_FILE_BYTES, MAX_CHUNKS_LINES, MAX_CHUNK_LINE_BYTES, parseChunk, options.testHooks);
  const failures = await readBoundedJsonLines(rootDir, `${snapshotDir}failures.jsonl`, MAX_FAILURES_FILE_BYTES, MAX_FAILURES_LINES, MAX_FAILURE_LINE_BYTES, parseFailure, options.testHooks);
  const integrityFailures: string[] = [];
  if (items.sha256 !== manifest.outputHashes.items) integrityFailures.push("hash:items");
  if (chunks.sha256 !== manifest.outputHashes.chunks) integrityFailures.push("hash:chunks");
  if (failures.sha256 !== manifest.outputHashes.failures) integrityFailures.push("hash:failures");
  if (items.rows.length !== manifest.counts.inventory || items.rows.length !== manifest.counts.completed) integrityFailures.push("accounting:items");
  if (chunks.rows.length !== manifest.counts.chunks) integrityFailures.push("accounting:chunks");
  if (failures.rows.length !== manifest.counts.failureLedger) integrityFailures.push("accounting:failure-ledger");

  const itemsById = new Map<string, RawItem>();
  for (const item of items.rows) {
    if (itemsById.has(item.itemId)) integrityFailures.push(`duplicate:item:${item.itemId}`);
    itemsById.set(item.itemId, item);
  }
  const failureItemIds = new Set<string>();
  for (const failure of failures.rows) {
    if (!itemsById.has(failure.itemId)) integrityFailures.push(`orphan:failure:${failure.itemId}`);
    if (failureItemIds.has(failure.itemId)) integrityFailures.push(`duplicate:failure:${failure.itemId}`);
    failureItemIds.add(failure.itemId);
  }
  const chunksByItem = new Map<string, RawChunk[]>();
  const chunkIds = new Set<string>();
  for (const chunk of chunks.rows) {
    if (chunkIds.has(chunk.chunkId)) integrityFailures.push(`duplicate:chunk:${chunk.chunkId}`);
    chunkIds.add(chunk.chunkId);
    if (!itemsById.has(chunk.itemId)) integrityFailures.push(`orphan:chunk:${chunk.itemId}`);
    if (sha256Text(chunk.text) !== chunk.chunkHash) integrityFailures.push(`hash:chunk:${chunk.chunkId}`);
    const itemChunks = chunksByItem.get(chunk.itemId) || [];
    itemChunks.push(chunk);
    chunksByItem.set(chunk.itemId, itemChunks);
  }
  for (const item of items.rows) {
    const itemChunks = chunksByItem.get(item.itemId) || [];
    if (failureItemIds.has(item.itemId)) {
      if (itemChunks.length > 0) integrityFailures.push(`membership:failed-item:${item.itemId}`);
      continue;
    }
    if (itemChunks.length === 0) integrityFailures.push(`missing:chunks:${item.itemId}`);
    if (item.extractionStatus === "success" && sha256Text(normalizeNativeBody(item.body)) !== item.bodyHash) integrityFailures.push(`hash:item:${item.itemId}`);
  }
  const successfulItems = items.rows.filter((item) => !failureItemIds.has(item.itemId));
  if (successfulItems.length !== manifest.counts.success || failureItemIds.size !== manifest.counts.failureLedger || manifest.counts.failure !== 0) integrityFailures.push("accounting:outcomes");
  if (integrityFailures.length > 0) return { status: "blocked", rootDir, failures: [...new Set(integrityFailures)] };

  const records = successfulItems.map((item) => {
    const anchors = (chunksByItem.get(item.itemId) || [])
      .sort((left, right) => left.pageStart - right.pageStart || left.chunkId.localeCompare(right.chunkId))
      .map((chunk) => ({ page: chunk.pageStart, excerpt: chunk.text.replace(/\s+/gu, " ").trim().slice(0, 280) }))
      .filter((anchor) => anchor.excerpt.length > 0);
    return makeRecord(item, manifest.snapshotId, anchors);
  });
  return {
    status: "ready",
    rootDir,
    manifestSha256: current.manifest.sha256,
    snapshotId: manifest.snapshotId,
    inventoryCount: items.rows.length,
    itemCount: records.length,
    chunkCount: chunks.rows.length,
    failureCount: failures.rows.length,
    records,
    indexedRecords: records.map((record) => ({
      record,
      tagText: tokenize([record.version, record.title, record.category, ...record.tags.keywords].join(" ")).join(" "),
      bodyText: tokenize([record.version, record.title, record.nativeBody, ...record.anchors.map((anchor) => anchor.excerpt)].join(" ")).join(" ")
    }))
  };
}

export function resolveKoshaGuideSnapshotRoot(env: Record<string, string | undefined> = process.env): string | null {
  const root = env.KOSHA_GUIDE_SNAPSHOT_ROOT || env.KOSHA_GUIDE_CORPUS_ROOT;
  return root ? root.trim() : null;
}

export function buildKoshaGuideEvidenceRef(record: KoshaGuideCorpusRecord, anchor = record.anchors[0]): string | null {
  return anchor ? `KOSHA 근거 ${record.referenceId} p.${anchor.page}: ${anchor.excerpt}` : null;
}

export async function loadKoshaGuideCorpus(options: KoshaGuideCorpusLookup = {}): Promise<KoshaGuideCorpusLoadResult> {
  const configuredRoot = options.rootDir === undefined ? resolveKoshaGuideSnapshotRoot(options.env) : options.rootDir;
  if (!configuredRoot) return { status: "unconfigured", rootDir: null, failures: [] };
  try {
    const rootDir = await realpath(configuredRoot);
    const rootStats = await stat(rootDir);
    if (!rootStats.isDirectory()) return { status: "blocked", rootDir: configuredRoot, failures: ["path:root"] };
    const { current, cacheKey } = await readCurrentIdentity(rootDir, options.testHooks);
    let pending = corpusCache.get(cacheKey);
    if (!pending) {
      pending = loadUncached(rootDir, current, options).catch((error: unknown): KoshaGuideCorpusLoadResult => ({
        status: "blocked",
        rootDir,
        failures: [error instanceof KoshaCorpusError ? error.code : "load:failed"]
      }));
      corpusCache.set(cacheKey, pending);
    }
    return await pending;
  } catch (error) {
    return { status: "blocked", rootDir: configuredRoot, failures: [error instanceof KoshaCorpusError ? error.code : "missing:current.json"] };
  }
}

export function resetKoshaGuideCorpusCacheForTests(): void {
  corpusCache.clear();
  uncachedLoadCount = 0;
}

export function getKoshaGuideCorpusCacheStatsForTests(): { entries: number; uncachedLoads: number } {
  return { entries: corpusCache.size, uncachedLoads: uncachedLoadCount };
}

function directEligibility(record: KoshaGuideCorpusRecord): boolean {
  return record.provenance.lifecycle === "current"
    && record.quality === "accepted"
    && record.bodyKind === "native"
    && record.anchors.length > 0
    && sha256Text(normalizeNativeBody(record.nativeBody)) === record.provenance.bodyHash;
}

export function searchKoshaGuideCorpus(corpus: KoshaGuideCorpusReady, query: string, limit: number): KoshaGuideCorpusSearchResult {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return { retrievalMode: null, items: [] };
  const tagCandidates = corpus.indexedRecords
    .map((candidate) => ({ candidate, score: countMatches(queryTokens, candidate.tagText) }))
    .filter((candidate) => candidate.score > 0);
  const bodyCandidates = corpus.indexedRecords
    .map((candidate) => ({ candidate, score: countMatches(queryTokens, candidate.bodyText) }))
    .filter((candidate) => candidate.score > 0);
  const merged = new Map<string, KoshaGuideCorpusHit>();
  for (const candidate of tagCandidates) {
    merged.set(candidate.candidate.record.referenceId, {
      referenceId: candidate.candidate.record.referenceId,
      stableDocumentKey: candidate.candidate.record.stableDocumentKey,
      retrievalMode: "local-tag",
      score: candidate.score,
      directEligible: directEligibility(candidate.candidate.record),
      evidenceRef: buildKoshaGuideEvidenceRef(candidate.candidate.record),
      record: candidate.candidate.record
    });
  }
  for (const candidate of bodyCandidates) {
    const existing = merged.get(candidate.candidate.record.referenceId);
    const record = candidate.candidate.record;
    merged.set(record.referenceId, {
      referenceId: record.referenceId,
      stableDocumentKey: record.stableDocumentKey,
      retrievalMode: existing ? "local-hybrid" : "local-ranked",
      score: Math.max(existing?.score || 0, candidate.score),
      directEligible: directEligibility(record),
      evidenceRef: buildKoshaGuideEvidenceRef(record),
      record
    });
  }
  const items = Array.from(merged.values())
    .sort((left, right) => right.score - left.score || left.referenceId.localeCompare(right.referenceId))
    .slice(0, limit);
  const retrievalMode = items.some((item) => item.retrievalMode === "local-hybrid")
    ? "local-hybrid"
    : items.some((item) => item.retrievalMode === "local-ranked")
      ? "local-ranked"
      : items.length ? "local-tag" : null;
  return { retrievalMode, items };
}

export function isKoshaGuideDirectEvidenceAccepted(record: KoshaGuideCorpusRecord): boolean {
  return directEligibility(record);
}
