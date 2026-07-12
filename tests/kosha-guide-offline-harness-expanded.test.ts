import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildDbHarnessPacket } from "@/lib/db-harness";
import { loadKoshaGuideCorpus, resetKoshaGuideCorpusCacheForTests } from "@/lib/kosha-guide-corpus";
import { buildSafetyReferenceRiskRows } from "@/lib/search";
import { deriveSafetyReferenceOperationalView as deriveClientView, getSafetyReferenceDisplayTitle as getClientTitle } from "@/lib/safety-reference-catalog-client";
import { deriveSafetyReferenceOperationalView as deriveServerView, getSafetyReferenceDisplayTitle as getServerTitle } from "@/lib/safety-reference-catalog";
import { searchSafetyReferences } from "@/lib/safety-reference-catalog-server";
import { mergeLocalAndRemoteSafetyReferenceResults, type SafetyReferenceItem } from "@/lib/safety-reference-policy";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";

type JsonRecord = Record<string, unknown>;

const tempDirs: string[] = [];
const SHA = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");

async function withNoSupabase<T>(run: () => Promise<T>): Promise<T> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    return await run();
  } finally {
    if (url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = url;
    if (key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = key;
  }
}

function item(id: string, itemType: "technical-guideline" | "technical-support-regulation"): JsonRecord {
  const body = itemType === "technical-guideline"
    ? "작업 전 환기와 작업발판 상태를 확인한다."
    : "규정에 따라 작업 전 안전조치를 확인한다.";
  return {
    schema_version: "safeclaw-kosha-body-corpus/v2",
    item_id: id,
    item_type: itemType,
    title: `${id} 안전 기준`,
    category: "건설안전",
    body,
    normalized_text_sha256: SHA(body),
    state: "stale",
    stable_key: `${id}-stable`,
    version_key: id,
    source_key: "kosha-synthetic",
    extraction_status: "success"
  };
}

function chunk(itemId: string, text: string): JsonRecord {
  return {
    schema_version: "safeclaw-kosha-body-corpus/v2",
    chunk_id: `${itemId}:p1`,
    chunk_sha256: SHA(text),
    item_id: itemId,
    page_start: 1,
    page_end: 1,
    text
  };
}

function writeFixture(): string {
  const rootDir = mkdtempSync(join(tmpdir(), "kosha-expanded-"));
  tempDirs.push(rootDir);
  const snapshotId = "synthetic-v3";
  const snapshotPath = `snapshots/${snapshotId}`;
  const snapshotDir = join(rootDir, snapshotPath);
  mkdirSync(snapshotDir, { recursive: true });
  const items = [
    item("kosha-guideline", "technical-guideline"),
    item("kosha-regulation", "technical-support-regulation")
  ];
  const chunks = [
    chunk("kosha-guideline", "작업 전 환기와 작업발판 상태를 확인한다."),
    chunk("kosha-regulation", "규정에 따라 작업 전 안전조치를 확인한다.")
  ];
  const itemsText = `${items.map((value) => JSON.stringify(value)).join("\n")}\n`;
  const chunksText = `${chunks.map((value) => JSON.stringify(value)).join("\n")}\n`;
  const failuresText = "";
  writeFileSync(join(snapshotDir, "items.jsonl"), itemsText, "utf8");
  writeFileSync(join(snapshotDir, "chunks.jsonl"), chunksText, "utf8");
  writeFileSync(join(snapshotDir, "failures.jsonl"), failuresText, "utf8");
  const identity = "1".repeat(64);
  const policy = "2".repeat(64);
  const manifest = {
    schema_version: "safeclaw-kosha-body-corpus/v2",
    snapshot_id: snapshotId,
    reproducibility_hash: SHA(snapshotId),
    generation_policy_sha256: policy,
    source_identity: { identity_sha256: identity },
    counts: { inventory: 2, completed: 2, success: 2, failure: 0, chunks: 2, failure_ledger: 0 },
    output_hashes: {
      "items.jsonl": SHA(itemsText),
      "chunks.jsonl": SHA(chunksText),
      "failures.jsonl": SHA(failuresText)
    }
  };
  const manifestText = JSON.stringify(manifest, null, 2);
  writeFileSync(join(snapshotDir, "manifest.json"), manifestText, "utf8");
  writeFileSync(join(rootDir, "current.json"), JSON.stringify({
    schema_version: "safeclaw-kosha-body-current/v1",
    generation_policy_sha256: policy,
    manifest: { path: `${snapshotPath}/manifest.json`, sha256: SHA(manifestText), size_bytes: Buffer.byteLength(manifestText) },
    reproducibility_hash: SHA(snapshotId),
    snapshot_id: snapshotId,
    snapshot_path: snapshotPath,
    source_identity_sha256: identity
  }, null, 2), "utf8");
  return rootDir;
}

function reference(id: string, role: "direct" | "supporting" = "direct"): SafetyReferenceItem {
  return {
    id,
    source_id: "supabase-test",
    item_type: "technical-guideline",
    category: "건설안전",
    subcategory: null,
    title: `${id} 작업 안전`,
    summary: "작업 전 안전조치를 확인한다.",
    keywords: ["작업"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["작업 전 안전조치 확인"],
    evidence_role: role,
    retrieval_source: "ranked" as const
  };
}

afterEach(() => {
  resetKoshaGuideCorpusCacheForTests();
  while (tempDirs.length) rmSync(tempDirs.pop() as string, { recursive: true, force: true });
});

describe("KOSHA offline harness expanded regressions", () => {
  it("reserves and interleaves ranked Supabase results under the limit while deduplicating local overlap", () => {
    const result = mergeLocalAndRemoteSafetyReferenceResults({
      localItems: [reference("shared", "supporting"), reference("local-only", "supporting")],
      remoteItems: [reference("remote-first"), reference("shared")],
      limit: 3
    });

    expect(result.items.map((value) => value.id)).toEqual(["remote-first", "local-only", "shared"]);
    expect(result.items.find((value) => value.id === "shared")?.evidence_role).toBe("direct");
    expect(result.retrievalMode).toBe("hybrid-local-supabase");
  });

  it.each([
    ["remote-only", [], ["remote-1"], 1, ["remote-1"], "ranked-rpc"],
    ["local-tag-only", ["local-1"], [], 1, ["local-1"], "local-tag"],
    ["local-ranked-only", ["local-1"], [], 1, ["local-1"], "local-ranked"],
    ["local-hybrid-only", ["local-1"], [], 1, ["local-1"], "local-hybrid"],
    ["single-slot-reserves-remote", ["local-1"], ["remote-1"], 1, ["remote-1"], "hybrid-local-supabase"],
    ["two-slots-interleave", ["local-1"], ["remote-1"], 2, ["remote-1", "local-1"], "hybrid-local-supabase"],
    ["three-slots-preserve-two-ranked", ["local-1"], ["remote-1", "remote-2"], 3, ["remote-1", "local-1", "remote-2"], "hybrid-local-supabase"],
    ["four-slots-interleave-both-sources", ["local-1", "local-2"], ["remote-1", "remote-2"], 4, ["remote-1", "local-1", "remote-2", "local-2"], "hybrid-local-supabase"],
    ["remote-overlap-replaces-local", ["shared"], ["shared"], 2, ["shared"], "ranked-rpc"],
    ["remote-overlap-keeps-remaining-local", ["shared", "local-2"], ["shared"], 2, ["shared", "local-2"], "hybrid-local-supabase"],
    ["duplicate-ranked-id-is-unique", [], ["remote-1", "remote-1"], 2, ["remote-1"], "ranked-rpc"],
    ["limit-never-expands-after-deduplication", ["local-1", "local-2"], ["remote-1", "remote-2"], 2, ["remote-1", "local-1"], "hybrid-local-supabase"],
    ["local-provenance-survives-remote-reservation", ["local-1"], ["remote-1", "remote-2"], 2, ["remote-1", "local-1"], "hybrid-local-supabase"]
  ])("%s", (_label, localIds, remoteIds, limit, ids, retrievalMode) => {
    const localSource = retrievalMode === "local-ranked"
      ? "local-ranked"
      : retrievalMode === "local-hybrid"
        ? "local-hybrid"
        : "local-tag";
    const localItems = localIds.map((id, index) => ({
      ...reference(id, "supporting"),
      retrieval_source: (index === 0 ? localSource : "local-ranked") as SafetyReferenceItem["retrieval_source"]
    }));
    const remoteItems = remoteIds.map((id) => reference(id));
    const result = mergeLocalAndRemoteSafetyReferenceResults({ localItems, remoteItems, limit });

    expect(result.items.map((item) => item.id)).toEqual(ids);
    expect(result.retrievalMode).toBe(retrievalMode);
    expect(new Set(result.items.map((item) => item.id)).size).toBe(result.items.length);
  });

  it("keeps local supporting KOSHA out of direct evidence and mandatory risk rows", async () => {
    const rootDir = writeFixture();
    const loaded = await loadKoshaGuideCorpus({ rootDir });
    expect(loaded.status === "blocked" ? loaded.failures : []).toEqual([]);
    expect(loaded.status).toBe("ready");
    const result = await withNoSupabase(() => searchSafetyReferences({ query: "작업", limit: 2, offlineCorpus: { rootDir } }));
    const local = result.items.find((value) => value.kosha_guide);
    expect(local?.evidence_role).toBe("supporting");
    expect(local?.kosha_guide?.directEligible).toBe(false);

    const packet = buildDbHarnessPacket({
      question: "작업",
      references: result.items,
      retrieval: { mode: result.retrievalMode, vectorSearch: result.vectorSearch, message: result.message }
    });
    expect(packet.directEvidence.some((value) => value.kosha_guide !== undefined)).toBe(false);
    expect(packet.retrievalContract.mode).toBe("local-ranked");
    const rows = buildSafetyReferenceRiskRows(buildMockAskResponse("작업", mockSearchResults, "mock", "test"), result.items, "맑음", "작업");
    expect(rows.every((row) => !row.evidenceRefs.includes("DB 하네스 직접근거"))).toBe(true);
  });

  it("honors local itemType exactly: SIF yields none and regulations never yield guidelines", async () => {
    const rootDir = writeFixture();
    const loaded = await loadKoshaGuideCorpus({ rootDir });
    expect(loaded.status === "blocked" ? loaded.failures : []).toEqual([]);
    expect(loaded.status).toBe("ready");
    const sif = await withNoSupabase(() => searchSafetyReferences({ query: "작업", itemType: "sif-case", offlineCorpus: { rootDir } }));
    const regulation = await withNoSupabase(() => searchSafetyReferences({ query: "작업", itemType: "technical-support-regulation", offlineCorpus: { rootDir } }));

    expect(sif.items).toEqual([]);
    expect(regulation.items).toHaveLength(1);
    expect(regulation.items[0]?.item_type).toBe("technical-support-regulation");
  });

  it("uses identical SIF title and domain-control policy on client and server boundaries", () => {
    const sif = {
      ...reference("sif-policy", "supporting"),
      item_type: "sif-case",
      title: "1919 / 기타의사업 / 시설관리",
      summary: "재해개요: 작업자가 배수펌프 점검 중 산소결핍으로 쓰러짐. 기인물: 배수펌프"
    };

    expect(getClientTitle(sif)).toBe(getServerTitle(sif));
    expect(deriveClientView(sif)).toEqual(deriveServerView(sif));
  });

  it("preserves local and ranked provenance in the DB harness hybrid contract", () => {
    const merged = mergeLocalAndRemoteSafetyReferenceResults({
      localItems: [{ ...reference("local", "supporting"), retrieval_source: "local-ranked" }],
      remoteItems: [reference("remote")],
      limit: 2
    });
    const packet = buildDbHarnessPacket({
      question: "작업",
      references: merged.items,
      retrieval: { mode: merged.retrievalMode }
    });

    expect(packet.retrievalContract.mode).toBe("hybrid-local-supabase");
    expect(packet.retrievalContract.sourceCounts.localRanked).toBe(1);
    expect(packet.retrievalContract.sourceCounts.ranked).toBe(1);
  });

  it("rejects a JSONL file that grows beyond 48 MiB after opening during streaming", async () => {
    const rootDir = writeFixture();
    let appended = false;
    const loaded = await loadKoshaGuideCorpus({
      rootDir,
      testHooks: {
        afterStreamChunk(path) {
          if (!path.endsWith("items.jsonl") || appended) return;
          appended = true;
          appendFileSync(path, Buffer.alloc(48 * 1024 * 1024));
        }
      }
    });

    expect(appended).toBe(true);
    expect(loaded.status).toBe("blocked");
    expect(loaded.status === "blocked" && loaded.failures).toContain("limit:file:items.jsonl");
  }, 20_000);
});
