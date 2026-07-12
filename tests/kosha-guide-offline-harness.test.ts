import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getKoshaGuideCorpusCacheStatsForTests,
  isKoshaGuideDirectEvidenceAccepted,
  loadKoshaGuideCorpus,
  resetKoshaGuideCorpusCacheForTests
} from "@/lib/kosha-guide-corpus";
import { buildSafetyReferenceRiskRows, buildTbmRiskLinks } from "@/lib/search";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { searchSafetyReferences } from "@/lib/safety-reference-catalog-server";

type JsonRecord = Record<string, unknown>;

const ACTUAL_ROOT = "C:/Users/iceam/dev/safeclaw-local-artifacts/kosha-corpus-body-recovery-2026-07-12-v3";
const tempDirs: string[] = [];
let actualSourceCache: ReturnType<typeof readActualSource> | null = null;

function readSyntheticSource(): { current: JsonRecord; manifest: JsonRecord; items: JsonRecord[]; chunks: JsonRecord[]; failures: JsonRecord[] } {
  const body = "작업 전 작업발판과 환기 상태를 확인한다.";
  const item: JsonRecord = {
    schema_version: "safeclaw-kosha-body-corpus/v2",
    item_id: "kosha-synthetic-guideline",
    item_type: "technical-guideline",
    title: "합성 작업 안전 기준",
    category: "건설안전",
    body,
    normalized_text_sha256: sha256(body),
    state: "stale",
    stable_key: "kosha-synthetic-guideline-stable",
    version_key: "K-SYN-1",
    source_key: "kosha-synthetic",
    extraction_status: "success"
  };
  const chunkText = "작업 전 작업발판과 환기 상태를 확인한다.";
  const chunk: JsonRecord = {
    schema_version: "safeclaw-kosha-body-corpus/v2",
    chunk_id: "kosha-synthetic-guideline:p1",
    chunk_sha256: sha256(chunkText),
    item_id: "kosha-synthetic-guideline",
    page_start: 1,
    page_end: 1,
    text: chunkText
  };
  const identity = "1".repeat(64);
  const policy = "2".repeat(64);
  return {
    current: {
      schema_version: "safeclaw-kosha-body-current/v1",
      generation_policy_sha256: policy,
      reproducibility_hash: sha256("synthetic-v3"),
      snapshot_id: "synthetic-v3",
      snapshot_path: "snapshots/synthetic-v3",
      source_identity_sha256: identity
    },
    manifest: {
      schema_version: "safeclaw-kosha-body-corpus/v2",
      source_identity: { identity_sha256: identity }
    },
    items: [item],
    chunks: [chunk],
    failures: []
  };
}

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected JSON object");
  return value as JsonRecord;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function readJson(path: string): JsonRecord {
  return asRecord(JSON.parse(readFileSync(path, "utf8")) as unknown);
}

function readActualSource(): { current: JsonRecord; manifest: JsonRecord; items: JsonRecord[]; chunks: JsonRecord[]; failures: JsonRecord[] } {
  if (actualSourceCache) return actualSourceCache;
  const current = readJson(join(ACTUAL_ROOT, "current.json"));
  const manifestRef = asRecord(current.manifest);
  const manifestPath = join(ACTUAL_ROOT, String(manifestRef.path));
  const manifest = readJson(manifestPath);
  const snapshotDir = join(ACTUAL_ROOT, String(current.snapshot_path));
  const failures = readFileSync(join(snapshotDir, "failures.jsonl"), "utf8")
    .trim().split("\n").filter(Boolean).map((line) => asRecord(JSON.parse(line) as unknown));
  const failedIds = new Set(failures.map((failure) => String(failure.item_id)));
  const items = readFileSync(join(snapshotDir, "items.jsonl"), "utf8")
    .trim().split("\n").filter(Boolean).map((line) => asRecord(JSON.parse(line) as unknown))
    .filter((item) => !failedIds.has(String(item.item_id))).slice(0, 2);
  const selectedIds = new Set(items.map((item) => String(item.item_id)));
  const chunks = readFileSync(join(snapshotDir, "chunks.jsonl"), "utf8")
    .trim().split("\n").filter(Boolean).map((line) => asRecord(JSON.parse(line) as unknown))
    .filter((chunk) => selectedIds.has(String(chunk.item_id)));
  actualSourceCache = { current, manifest, items, chunks, failures };
  return actualSourceCache;
}

function writeSnapshot(rootDir: string, snapshotId: string, source = readSyntheticSource(), overrides: {
  items?: JsonRecord[];
  chunks?: JsonRecord[];
  failures?: JsonRecord[];
  manifestPath?: string;
} = {}): void {
  const items = overrides.items || source.items;
  const chunks = overrides.chunks || source.chunks;
  const failures = overrides.failures || [];
  const snapshotPath = `snapshots/${snapshotId}`;
  const snapshotDir = join(rootDir, snapshotPath);
  mkdirSync(snapshotDir, { recursive: true });
  const itemsText = items.map((item) => JSON.stringify(item)).join("\n") + "\n";
  const chunksText = chunks.map((chunk) => JSON.stringify(chunk)).join("\n") + "\n";
  const failuresText = failures.map((failure) => JSON.stringify(failure)).join("\n") + (failures.length ? "\n" : "");
  writeFileSync(join(snapshotDir, "items.jsonl"), itemsText, { encoding: "utf8", flag: "w" });
  writeFileSync(join(snapshotDir, "chunks.jsonl"), chunksText, { encoding: "utf8", flag: "w" });
  writeFileSync(join(snapshotDir, "failures.jsonl"), failuresText, { encoding: "utf8", flag: "w" });
  const sourceIdentity = asRecord(source.manifest.source_identity);
  const manifest: JsonRecord = {
    schema_version: source.manifest.schema_version,
    snapshot_id: snapshotId,
    reproducibility_hash: sha256(snapshotId),
    generation_policy_sha256: source.current.generation_policy_sha256,
    source_identity: { identity_sha256: sourceIdentity.identity_sha256 },
    counts: {
      inventory: items.length,
      completed: items.length,
      success: items.length - failures.length,
      failure: 0,
      chunks: chunks.length,
      failure_ledger: failures.length
    },
    output_hashes: {
      "items.jsonl": sha256(itemsText),
      "chunks.jsonl": sha256(chunksText),
      "failures.jsonl": sha256(failuresText)
    }
  };
  const manifestText = JSON.stringify(manifest, null, 2);
  writeFileSync(join(snapshotDir, "manifest.json"), manifestText, "utf8");
  const current: JsonRecord = {
    schema_version: source.current.schema_version,
    generation_policy_sha256: source.current.generation_policy_sha256,
    manifest: {
      path: overrides.manifestPath || `${snapshotPath}/manifest.json`,
      sha256: sha256(manifestText),
      size_bytes: Buffer.byteLength(manifestText)
    },
    reproducibility_hash: manifest.reproducibility_hash,
    snapshot_id: snapshotId,
    snapshot_path: snapshotPath,
    source_identity_sha256: sourceIdentity.identity_sha256
  };
  writeFileSync(join(rootDir, "current.json"), JSON.stringify(current, null, 2), "utf8");
}

function writeFixture(overrides: Parameters<typeof writeSnapshot>[3] = {}): string {
  const rootDir = mkdtempSync(join(tmpdir(), "kosha-v3-fixture-"));
  tempDirs.push(rootDir);
  writeSnapshot(rootDir, "fixture-v3", readSyntheticSource(), overrides);
  return rootDir;
}

function withNoSupabase<T>(run: () => Promise<T>): Promise<T> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  return run().finally(() => {
    if (url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = url;
    if (key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = key;
  });
}

afterEach(() => {
  resetKoshaGuideCorpusCacheForTests();
  vi.unstubAllGlobals();
  while (tempDirs.length) {
    const target = tempDirs.pop();
    if (target) rmSync(target, { recursive: true, force: true });
  }
});

describe("KOSHA v3 offline harness", () => {
  it.skipIf(!existsSync(ACTUAL_ROOT))("loads the read-only actual v3 artifact with bounded snake_case JSONL", async () => {
    const loaded = await loadKoshaGuideCorpus({ rootDir: ACTUAL_ROOT });
    expect(loaded.status === "blocked" ? loaded.failures.join(", ") : loaded.status).toBe("ready");
    if (loaded.status !== "ready") return;
    expect(loaded.inventoryCount).toBe(1040);
    expect(loaded.itemCount).toBe(1039);
    expect(loaded.chunkCount).toBe(20520);
    expect(loaded.failureCount).toBe(1);
    expect(loaded.records[0]?.referenceId).toMatch(/^kosha-/u);
    expect(loaded.records[0] && isKoshaGuideDirectEvidenceAccepted(loaded.records[0])).toBe(false);
  }, 20_000);

  it("caches a v3 load by current and manifest identity, then invalidates on snapshot switch", async () => {
    const rootDir = writeFixture();
    expect((await loadKoshaGuideCorpus({ rootDir })).status).toBe("ready");
    expect((await loadKoshaGuideCorpus({ rootDir })).status).toBe("ready");
    expect(getKoshaGuideCorpusCacheStatsForTests().uncachedLoads).toBe(1);
    writeSnapshot(rootDir, "fixture-v3-switched");
    expect((await loadKoshaGuideCorpus({ rootDir })).status).toBe("ready");
    expect(getKoshaGuideCorpusCacheStatsForTests().uncachedLoads).toBe(2);
  });

  it("rejects absolute and parent path escapes plus a file symlink", async () => {
    const rootDir = writeFixture({ manifestPath: "../outside.json" });
    const escaped = await loadKoshaGuideCorpus({ rootDir });
    expect(escaped.status).toBe("blocked");
    expect(escaped.status === "blocked" && escaped.failures).toContain("path:escape");

    const symlinkRoot = writeFixture();
    const outside = join(symlinkRoot, "outside-current.json");
    writeFileSync(outside, readFileSync(join(symlinkRoot, "current.json")));
    unlinkSync(join(symlinkRoot, "current.json"));
    symlinkSync(outside, join(symlinkRoot, "current.json"), "file");
    const linked = await loadKoshaGuideCorpus({ rootDir: symlinkRoot });
    expect(linked.status).toBe("blocked");
    expect(linked.status === "blocked" && linked.failures).toContain("path:symlink");
  });

  it("rejects a replacement at the lstat-to-open TOCTOU seam", async () => {
    const rootDir = writeFixture();
    let replaced = false;
    const loaded = await loadKoshaGuideCorpus({
      rootDir,
      testHooks: {
        afterPathChecked(path) {
          if (basename(path) !== "items.jsonl" || replaced) return;
          replaced = true;
          const replacement = `${path}.replacement`;
          writeFileSync(replacement, "{\"schema_version\":\"replaced\"}\n", "utf8");
          renameSync(replacement, path);
        }
      }
    });
    expect(replaced).toBe(true);
    expect(loaded.status).toBe("blocked");
    expect(loaded.status === "blocked" && loaded.failures).toContain("path:toctou");
  });

  it("enforces record bounds and blocks duplicate or orphan memberships", async () => {
    const source = readSyntheticSource();
    const firstItem = source.items[0];
    const firstChunk = source.chunks[0];
    if (!firstItem || !firstChunk) throw new Error("Actual v3 fixture source is incomplete");
    const oversizedItem: JsonRecord = { ...firstItem, body: "x".repeat(8 * 1024 * 1024 + 1) };
    const bounded = await loadKoshaGuideCorpus({ rootDir: writeFixture({ items: [oversizedItem], chunks: source.chunks.filter((chunk) => String(chunk.item_id) === String(oversizedItem.item_id)) }) });
    expect(bounded.status).toBe("blocked");
    expect(bounded.status === "blocked" && bounded.failures).toContain("limit:record:items.jsonl");

    const duplicateItem = await loadKoshaGuideCorpus({ rootDir: writeFixture({ items: [firstItem, firstItem], chunks: source.chunks.filter((chunk) => String(chunk.item_id) === String(firstItem.item_id)) }) });
    expect(duplicateItem.status).toBe("blocked");
    expect(duplicateItem.status === "blocked" && duplicateItem.failures.some((failure) => failure.startsWith("duplicate:item:"))).toBe(true);

    const orphanChunk: JsonRecord = { ...firstChunk, item_id: "kosha-orphan-item" };
    const orphan = await loadKoshaGuideCorpus({ rootDir: writeFixture({ items: [firstItem], chunks: [orphanChunk] }) });
    expect(orphan.status).toBe("blocked");
    expect(orphan.status === "blocked" && orphan.failures).toContain("orphan:chunk:kosha-orphan-item");
  }, 20_000);

  it("keeps v3 KOSHA as supporting evidence, preserves its same-page evidenceRef into TBM, and never exposes a score", async () => {
    const rootDir = writeFixture();
    const result = await withNoSupabase(() => searchSafetyReferences({ query: "작업", limit: 3, offlineCorpus: { rootDir } }));
    expect(result.ok).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]?.evidence_role).toBe("supporting");
    expect(result.items[0]?.kosha_guide?.evidenceRef).toMatch(/p\.\d+/u);
    expect("score" in (result.items[0] || {})).toBe(false);
    const response = buildMockAskResponse("작업", mockSearchResults, "mock", "test");
    const rows = buildSafetyReferenceRiskRows(response, result.items, "강풍", "작업");
    const links = buildTbmRiskLinks(rows, "강풍");
    const evidenceRefs = new Set(result.items.map((item) => item.kosha_guide?.evidenceRef).filter((ref): ref is string => Boolean(ref)));
    const anchoredRow = rows.find((row) => row.evidenceRefs.some((ref) => evidenceRefs.has(ref)));
    expect(anchoredRow).toBeDefined();
    expect(links.some((link) => link.evidenceRefs.some((ref) => anchoredRow?.evidenceRefs.includes(ref)))).toBe(true);
  }, 20_000);

  it("does not serve KOSHA records for sif-case and merges local KOSHA with successful ranked remote results", async () => {
    const rootDir = writeFixture();
    const sifResult = await withNoSupabase(() => searchSafetyReferences({ query: "작업", itemType: "sif-case", limit: 4, offlineCorpus: { rootDir } }));
    expect(sifResult.items).toEqual([]);
    expect(sifResult.retrievalMode).toBe("unconfigured");

    const oldUrl = process.env.SUPABASE_URL;
    const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{
      id: "remote-ranked-item",
      source_id: "remote",
      item_type: "construction-process",
      category: "remote",
      subcategory: null,
      title: "작업 원격 순위 근거",
      summary: "작업 안전 원격 근거",
      keywords: ["작업"],
      risk_tags: [],
      primary_documents: [],
      controls: []
    }]), { status: 200, headers: { "content-type": "application/json" } })));
    try {
      const merged = await searchSafetyReferences({ query: "작업", limit: 4, offlineCorpus: { rootDir } });
      expect(merged.ok).toBe(true);
      expect(merged.items.map((item) => item.id)).toContain("remote-ranked-item");
      expect(merged.items.some((item) => item.kosha_guide !== undefined)).toBe(true);
      expect(merged.retrievalMode).toBe("hybrid-local-supabase");
    } finally {
      if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
      if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
    }
  }, 20_000);
});
