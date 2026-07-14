import { appendFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { buildDbHarnessPacket } from "@/lib/db-harness";
import { loadKoshaGuideCorpus, resetKoshaGuideCorpusCacheForTests } from "@/lib/kosha-guide-corpus";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { buildSafetyReferenceRiskRows } from "@/lib/search";
import {
  deriveSafetyReferenceOperationalView,
  getSafetyReferenceDisplayTitle,
  isSafetyReferenceRiskEligible,
  mergeLocalAndRemoteSafetyReferenceResults,
  type SafetyReferenceItem,
  type SafetyReferenceRetrievalMode
} from "@/lib/safety-reference-catalog";
import { searchSafetyReferences } from "@/lib/safety-reference-catalog-server";
import {
  cleanupKoshaFixtures,
  createKoshaFixture,
  koshaTestLookup,
  withNoSupabase
} from "@/tests/helpers/kosha-offline-fixture";

function reference(id: string, role: "direct" | "supporting" = "direct"): SafetyReferenceItem {
  return {
    id,
    source_id: "supabase-test",
    item_type: "machinery",
    category: "운반하역",
    subcategory: "지게차",
    title: `${id} 지게차 보행자 충돌 안전 근거`,
    summary: "지게차와 보행자 통행 동선을 분리한다.",
    keywords: ["지게차", "보행자", "동선", "충돌"],
    risk_tags: ["충돌"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["지게차 동선과 보행 동선을 분리"],
    evidence_role: role,
    retrieval_source: "ranked"
  };
}

function localReference(
  id: string,
  retrievalSource: "local-tag" | "local-ranked" | "local-hybrid" = "local-tag"
): SafetyReferenceItem {
  return {
    ...reference(id, "supporting"),
    source_id: `kosha-guide-offline:${id}`,
    retrieval_source: retrievalSource,
    kosha_guide: {
      referenceId: id,
      stableDocumentKey: `${id}-stable`,
      version: "2026",
      quality: "accepted",
      lifecycle: "current",
      bodyKind: "native",
      anchors: [{ page: 1, excerpt: `${id} 지게차 근거` }],
      evidenceRef: `KOSHA 근거 ${id} p.1: 지게차 근거`,
      directEligible: true
    }
  };
}

afterEach(() => {
  resetKoshaGuideCorpusCacheForTests();
  cleanupKoshaFixtures();
});

describe("KOSHA offline harness expanded regressions", () => {
  it("interleaves remote and local results while deduplicating overlap", () => {
    const result = mergeLocalAndRemoteSafetyReferenceResults({
      localItems: [localReference("shared"), localReference("local-only")],
      remoteItems: [reference("remote-first"), reference("shared")],
      remoteRetrievalMode: "ranked-rpc",
      limit: 3
    });
    expect(result.items.map((item) => item.id)).toEqual(["remote-first", "local-only", "shared"]);
    expect(result.items.find((item) => item.id === "shared")?.evidence_role).toBe("direct");
    expect(result.retrievalMode).toBe("hybrid-local-supabase");
  });

  it.each([
    ["remote-only", [], ["remote-1"], 1, ["remote-1"], "ranked-rpc"],
    ["local-tag-only", ["local-1"], [], 1, ["local-1"], "local-tag"],
    ["local-ranked-only", ["local-1"], [], 1, ["local-1"], "local-ranked"],
    ["local-hybrid-only", ["local-1"], [], 1, ["local-1"], "local-hybrid"],
    ["single-slot-remote", ["local-1"], ["remote-1"], 1, ["remote-1"], "ranked-rpc"],
    ["two-slot-hybrid", ["local-1"], ["remote-1"], 2, ["remote-1", "local-1"], "hybrid-local-supabase"],
    ["three-slot-hybrid", ["local-1"], ["remote-1", "remote-2"], 3, ["remote-1", "local-1", "remote-2"], "hybrid-local-supabase"],
    ["four-slot-hybrid", ["local-1", "local-2"], ["remote-1", "remote-2"], 4, ["remote-1", "local-1", "remote-2", "local-2"], "hybrid-local-supabase"],
    ["overlap-remote-wins", ["shared"], ["shared"], 2, ["shared"], "ranked-rpc"],
    ["overlap-keeps-local", ["shared", "local-2"], ["shared"], 2, ["shared", "local-2"], "hybrid-local-supabase"],
    ["remote-dedup", [], ["remote-1", "remote-1"], 2, ["remote-1"], "ranked-rpc"],
    ["limit-stable", ["local-1", "local-2"], ["remote-1", "remote-2"], 2, ["remote-1", "local-1"], "hybrid-local-supabase"],
    ["local-provenance", ["local-1"], ["remote-1", "remote-2"], 2, ["remote-1", "local-1"], "hybrid-local-supabase"]
  ] as const)("%s", (_label, localIds, remoteIds, limit, ids, expectedMode) => {
    const localSource = expectedMode === "local-ranked"
      ? "local-ranked"
      : expectedMode === "local-hybrid"
        ? "local-hybrid"
        : "local-tag";
    const result = mergeLocalAndRemoteSafetyReferenceResults({
      localItems: localIds.map((id) => localReference(id, localSource)),
      remoteItems: remoteIds.map((id) => reference(id)),
      remoteRetrievalMode: "ranked-rpc",
      limit
    });
    expect(result.items.map((item) => item.id)).toEqual([...ids]);
    expect(result.retrievalMode).toBe(expectedMode as SafetyReferenceRetrievalMode);
    expect(new Set(result.items.map((item) => item.id).values()).size).toBe(result.items.length);
  });

  it("keeps local KOSHA supporting-only and off the direct row channel", async () => {
    const rootDir = createKoshaFixture({ state: "current" });
    const result = await withNoSupabase(() => searchSafetyReferences({
      query: "지게차 보행자 동선 충돌",
      limit: 2,
      offlineCorpus: koshaTestLookup(rootDir)
    }));
    const local = result.items.find((item) => item.kosha_guide);
    expect(local?.evidence_role).toBe("supporting");
    expect(local?.kosha_guide?.directEligible).toBe(true);
    const directOnly = await withNoSupabase(() => searchSafetyReferences({
      query: "지게차 보행자 동선 충돌",
      evidenceRole: "direct",
      limit: 2,
      offlineCorpus: koshaTestLookup(rootDir)
    }));
    expect(directOnly.items.some((item) => item.kosha_guide)).toBe(false);

    const response = buildMockAskResponse("지게차 보행자 동선 충돌", mockSearchResults, "mock", "test");
    expect(buildSafetyReferenceRiskRows(response, result.items, "맑음", "지게차 보행자 동선 충돌")).toEqual([]);
  });

  it("filters local itemType before scoring and limiting", async () => {
    const rootDir = createKoshaFixture();
    const sif = await withNoSupabase(() => searchSafetyReferences({
      query: "지게차",
      itemType: "sif-case",
      limit: 1,
      offlineCorpus: koshaTestLookup(rootDir)
    }));
    const regulation = await withNoSupabase(() => searchSafetyReferences({
      query: "지게차",
      itemType: "technical-support-regulation",
      limit: 1,
      offlineCorpus: koshaTestLookup(rootDir)
    }));
    expect(sif.items).toEqual([]);
    expect(regulation.items).toHaveLength(1);
    expect(regulation.items[0]?.item_type).toBe("technical-support-regulation");
  });

  it("keeps direct eligibility separate from KOSHA metadata and preserves policy views", () => {
    const local = localReference("local-policy");
    expect(local.kosha_guide?.directEligible).toBe(true);
    expect(isSafetyReferenceRiskEligible(local)).toBe(false);
    expect(getSafetyReferenceDisplayTitle(local)).toContain("local-policy");
    expect(deriveSafetyReferenceOperationalView(local).controls.length).toBeGreaterThan(0);
  });

  it("counts local and ranked retrieval provenance in the DB harness", () => {
    const merged = mergeLocalAndRemoteSafetyReferenceResults({
      localItems: [localReference("local", "local-ranked")],
      remoteItems: [reference("remote")],
      remoteRetrievalMode: "ranked-rpc",
      limit: 2
    });
    const packet = buildDbHarnessPacket({
      question: "지게차 보행자 동선 충돌",
      references: merged.items,
      retrieval: { mode: merged.retrievalMode }
    });
    expect(packet.retrievalContract.mode).toBe("hybrid-local-supabase");
    expect(packet.retrievalContract.sourceCounts.localRanked).toBe(1);
    expect(packet.retrievalContract.sourceCounts.ranked).toBe(1);
  });

  it("rejects a JSONL stream that grows beyond 48 MiB after opening", async () => {
    const rootDir = createKoshaFixture();
    let appended = false;
    const loaded = await loadKoshaGuideCorpus(koshaTestLookup(rootDir, {
        afterStreamChunk(path) {
          if (!path.endsWith("items.jsonl") || appended) return;
          appended = true;
          appendFileSync(path, Buffer.alloc(48 * 1024 * 1024));
        }
    }));
    expect(appended).toBe(true);
    expect(loaded.status).toBe("blocked");
    expect(loaded.status === "blocked" && loaded.failures).toContain("limit:file:items.jsonl");
  }, 20_000);
});
