import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildDbHarnessPacket } from "@/lib/db-harness";
import { loadKoshaGuideCorpus, resetKoshaGuideCorpusCacheForTests } from "@/lib/kosha-guide-corpus";
import { buildSafetyReferenceRiskRows } from "@/lib/search";
import { deriveSafetyReferenceOperationalView as deriveClientView, getSafetyReferenceDisplayTitle as getClientTitle } from "@/lib/safety-reference-catalog-client";
import {
  deriveSafetyReferenceOperationalView as deriveServerView,
  getSafetyReferenceDisplayTitle as getServerTitle,
  isSafetyReferenceRiskEligible
} from "@/lib/safety-reference-catalog";
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

function item(
  id: string,
  itemType: "technical-guideline" | "technical-support-regulation",
  state: "current" | "stale" = "stale"
): JsonRecord {
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
    state,
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

function writeFixture(state: "current" | "stale" = "stale"): string {
  const rootDir = mkdtempSync(join(tmpdir(), "kosha-expanded-"));
  tempDirs.push(rootDir);
  const snapshotId = "synthetic-v3";
  const snapshotPath = `snapshots/${snapshotId}`;
  const snapshotDir = join(rootDir, snapshotPath);
  mkdirSync(snapshotDir, { recursive: true });
  const items = [
    item("kosha-guideline", "technical-guideline", state),
    item("kosha-regulation", "technical-support-regulation", state)
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

function supportingKoshaReference(
  id: string,
  evidenceRef: string,
  overrides: Partial<SafetyReferenceItem>
): SafetyReferenceItem {
  return {
    ...reference(id, "supporting"),
    ...overrides,
    id,
    evidence_role: "supporting",
    kosha_guide: {
      referenceId: id,
      stableDocumentKey: `${id}-stable`,
      version: "2026",
      quality: "accepted",
      bodyKind: "native",
      anchors: [{ page: 1, excerpt: overrides.summary || id }],
      evidenceRef,
      directEligible: true
    }
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

    for (const remoteRetrievalMode of ["rest-ilike", "ranked-rpc", "hybrid-vector-rpc"] as const) {
      const remoteOnly = mergeLocalAndRemoteSafetyReferenceResults({
        localItems: [reference("shared", "supporting")],
        remoteItems: [reference("shared")],
        remoteRetrievalMode,
        limit: 1
      });
      expect(remoteOnly.items.map((value) => value.id)).toEqual(["shared"]);
      expect(remoteOnly.retrievalMode).toBe(remoteRetrievalMode);
    }
  });

  it.each([
    ["remote-only", [], ["remote-1"], 1, ["remote-1"], "ranked-rpc"],
    ["local-tag-only", ["local-1"], [], 1, ["local-1"], "local-tag"],
    ["local-ranked-only", ["local-1"], [], 1, ["local-1"], "local-ranked"],
    ["local-hybrid-only", ["local-1"], [], 1, ["local-1"], "local-hybrid"],
    ["single-slot-returns-actual-remote-mode", ["local-1"], ["remote-1"], 1, ["remote-1"], "ranked-rpc"],
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

  it("keeps local KOSHA supporting-only and attaches it only to an independently grounded direct risk row", async () => {
    const rootDir = writeFixture("current");
    const loaded = await loadKoshaGuideCorpus({ rootDir });
    expect(loaded.status === "blocked" ? loaded.failures : []).toEqual([]);
    expect(loaded.status).toBe("ready");
    const result = await withNoSupabase(() => searchSafetyReferences({ query: "작업", limit: 2, offlineCorpus: { rootDir } }));
    const local = result.items.find((value) => value.kosha_guide);
    expect(local?.evidence_role).toBe("supporting");
    expect(local?.kosha_guide?.directEligible).toBe(true);
    expect(local && isSafetyReferenceRiskEligible(local)).toBe(false);
    const directOnly = await withNoSupabase(() => searchSafetyReferences({
      query: "작업",
      evidenceRole: "direct",
      limit: 2,
      offlineCorpus: { rootDir }
    }));
    expect(directOnly.items.some((value) => value.kosha_guide !== undefined)).toBe(false);

    const packet = buildDbHarnessPacket({
      question: "작업",
      references: result.items,
      retrieval: { mode: result.retrievalMode, vectorSearch: result.vectorSearch, message: result.message }
    });
    expect(packet.directEvidence.some((value) => value.kosha_guide !== undefined)).toBe(false);
    expect(packet.retrievalContract.mode).toBe("local-ranked");
    const response = buildMockAskResponse("작업", mockSearchResults, "mock", "test");
    expect(buildSafetyReferenceRiskRows(response, result.items, "맑음", "작업")).toEqual([]);

    const direct = reference("direct-ground", "direct");
    const groundedRows = buildSafetyReferenceRiskRows(response, [direct, ...result.items], "맑음", "작업");
    const directGroundedRows = groundedRows.filter((row) => row.evidenceRefs.includes("DB 하네스 직접근거"));
    expect(directGroundedRows).toHaveLength(1);
    expect(directGroundedRows[0]?.evidenceRefs).toContain(local?.kosha_guide?.evidenceRef);
  });

  it("caps row-specific supporting KOSHA and rejects broad or duplicate evidence refs", () => {
    const response = buildMockAskResponse("지게차 하역 작업", mockSearchResults, "mock", "test");
    const direct = {
      ...reference("forklift-direct", "direct"),
      item_type: "machinery",
      category: "운반하역",
      subcategory: "지게차",
      title: "지게차 하역 중 보행자 동선 충돌 직접 근거",
      summary: "지게차 운행경로와 보행자 통행 동선이 겹쳐 충돌할 수 있다.",
      keywords: ["지게차", "보행자", "동선", "충돌"],
      risk_tags: ["충돌"],
      controls: ["지게차 동선과 보행 동선 분리 및 신호수 배치", "후진 경보 확인"]
    } satisfies SafetyReferenceItem;
    const primaryRef = "KOSHA 근거 forklift-primary p.1: 지게차와 보행자 동선을 분리한다.";
    const relevant = [
      supportingKoshaReference("forklift-primary", primaryRef, {
        category: "기계안전",
        subcategory: "지게차",
        title: "지게차 보행자 동선 충돌 예방 지침",
        summary: "지게차와 보행자 통행 동선을 분리하고 충돌 위험을 통제한다.",
        keywords: ["지게차", "보행자", "동선", "충돌"],
        risk_tags: ["충돌"],
        controls: ["지게차 동선과 보행 동선 분리"]
      }),
      supportingKoshaReference("forklift-inspection", "KOSHA 근거 forklift-inspection p.1: 지게차 후진 경보를 확인한다.", {
        category: "기계안전",
        subcategory: "지게차",
        title: "지게차 후진 충돌 예방 점검 지침",
        summary: "지게차 후진 경보와 보행자 접근 통제를 확인한다.",
        keywords: ["지게차", "후진", "보행자", "충돌"],
        risk_tags: ["충돌"],
        controls: ["후진 경보 확인", "보행자 접근 통제"]
      }),
      supportingKoshaReference("forklift-loading", "KOSHA 근거 forklift-loading p.1: 지게차 하역구역을 통제한다.", {
        category: "운반하역",
        subcategory: "지게차",
        title: "지게차 하역구역 동선 관리 지침",
        summary: "지게차 하역구역의 보행자 동선과 충돌 위험을 통제한다.",
        keywords: ["지게차", "하역", "보행자", "동선"],
        risk_tags: ["충돌"],
        controls: ["하역구역 출입 통제"]
      })
    ];
    const duplicate = supportingKoshaReference("forklift-primary-copy", primaryRef, {
      category: "기계안전",
      subcategory: "지게차",
      title: "지게차 보행자 충돌 예방 지침 사본",
      summary: "지게차와 보행자 통행 동선을 분리한다.",
      keywords: ["지게차", "보행자", "충돌"],
      risk_tags: ["충돌"],
      controls: ["지게차 동선 분리"]
    });
    const unrelated = [
      supportingKoshaReference("broad-loading", "KOSHA 근거 broad-loading p.1: 화물 적재 상태를 확인한다.", {
        category: "물류일반",
        subcategory: "적재",
        title: "하역 작업 안전 관리 일반 지침",
        summary: "화물 적재 높이와 결속 상태를 확인한다.",
        keywords: ["하역", "적재"],
        risk_tags: ["낙하"],
        controls: ["화물 결속 상태 확인"]
      }),
      supportingKoshaReference("broad-crane", "KOSHA 근거 broad-crane p.1: 인양 신호수를 배치한다.", {
        category: "건설기계",
        subcategory: "크레인",
        title: "크레인 인양 작업 안전 관리 지침",
        summary: "크레인 인양 반경을 통제하고 신호수를 배치한다.",
        keywords: ["크레인", "인양", "신호수"],
        risk_tags: ["낙하"],
        controls: ["인양 신호수 배치"]
      })
    ];

    const rows = buildSafetyReferenceRiskRows(
      response,
      [direct, ...relevant, duplicate, ...unrelated],
      "맑음",
      "작업 안전 관리 하역 신호수"
    );
    const directRow = rows.find((row) => row.evidenceRefs.includes("DB 하네스 직접근거"));
    const supportingRefs = directRow?.evidenceRefs.filter((ref) => ref.startsWith("KOSHA 근거 ")) || [];

    expect(directRow).toBeDefined();
    expect(supportingRefs).not.toEqual(expect.arrayContaining([
      "KOSHA 근거 broad-loading p.1: 화물 적재 상태를 확인한다.",
      "KOSHA 근거 broad-crane p.1: 인양 신호수를 배치한다."
    ]));
    expect(supportingRefs).toHaveLength(2);
    expect(supportingRefs).toContain(primaryRef);
    expect(new Set(supportingRefs).size).toBe(supportingRefs.length);
    expect(supportingRefs.every((ref) => ref.includes("forklift-"))).toBe(true);
  });

  it("honors local itemType exactly: SIF yields none and regulations never yield guidelines", async () => {
    const rootDir = writeFixture();
    const loaded = await loadKoshaGuideCorpus({ rootDir });
    expect(loaded.status === "blocked" ? loaded.failures : []).toEqual([]);
    expect(loaded.status).toBe("ready");
    const sif = await withNoSupabase(() => searchSafetyReferences({ query: "작업", itemType: "sif-case", offlineCorpus: { rootDir } }));
    const regulation = await withNoSupabase(() => searchSafetyReferences({ query: "작업", itemType: "technical-support-regulation", limit: 1, offlineCorpus: { rootDir } }));

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
