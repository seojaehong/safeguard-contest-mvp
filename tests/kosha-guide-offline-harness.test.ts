import {
  existsSync,
  readFileSync,
  renameSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { basename, join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getKoshaGuideCorpusCacheStatsForTests,
  isKoshaGuideDirectEvidenceAccepted,
  loadKoshaGuideCorpus,
  resetKoshaGuideCorpusCacheForTests
} from "@/lib/kosha-guide-corpus";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { buildSafetyReferenceRiskRows } from "@/lib/search";
import { searchSafetyReferences } from "@/lib/safety-reference-catalog-server";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";
import {
  ACTUAL_KOSHA_ROOT,
  cleanupKoshaFixtures,
  createKoshaFixture,
  readFixtureItems,
  sha256,
  withNoSupabase,
  writeSnapshot,
  type JsonRecord
} from "@/tests/helpers/kosha-offline-fixture";

function directReference(): SafetyReferenceItem {
  return {
    id: "direct-forklift-ground",
    source_id: "supabase-test",
    item_type: "machinery",
    category: "운반하역",
    subcategory: "지게차",
    title: "지게차 보행자 동선 충돌 직접 근거",
    summary: "지게차 운행경로와 보행자 통행 동선을 분리한다.",
    keywords: ["지게차", "보행자", "동선", "충돌"],
    risk_tags: ["충돌"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["지게차 동선과 보행 동선을 분리하고 신호수를 배치"],
    evidence_role: "direct",
    retrieval_source: "ranked"
  };
}

afterEach(() => {
  resetKoshaGuideCorpusCacheForTests();
  vi.unstubAllGlobals();
  cleanupKoshaFixtures();
});

describe("KOSHA v3 offline harness on current architecture", () => {
  it.skipIf(!existsSync(ACTUAL_KOSHA_ROOT))("loads the read-only actual v3 artifact with bounded snake_case JSONL", async () => {
    const loaded = await loadKoshaGuideCorpus({ rootDir: ACTUAL_KOSHA_ROOT });
    expect(loaded.status === "blocked" ? loaded.failures.join(", ") : loaded.status).toBe("ready");
    if (loaded.status !== "ready") return;
    expect(loaded.inventoryCount).toBe(1040);
    expect(loaded.itemCount).toBe(1039);
    expect(loaded.chunkCount).toBe(20520);
    expect(loaded.failureCount).toBe(1);
    expect(loaded.records[0]?.referenceId).toMatch(/^kosha-/u);
    expect(loaded.records[0] && isKoshaGuideDirectEvidenceAccepted(loaded.records[0])).toBe(false);
  }, 20_000);

  it("caches by current and manifest identity, then invalidates on snapshot switch", async () => {
    const rootDir = createKoshaFixture();
    expect((await loadKoshaGuideCorpus({ rootDir })).status).toBe("ready");
    expect((await loadKoshaGuideCorpus({ rootDir })).status).toBe("ready");
    expect(getKoshaGuideCorpusCacheStatsForTests().uncachedLoads).toBe(1);
    writeSnapshot(rootDir, "fixture-v3-switched");
    expect((await loadKoshaGuideCorpus({ rootDir })).status).toBe("ready");
    expect(getKoshaGuideCorpusCacheStatsForTests().uncachedLoads).toBe(2);
  });

  it("rejects parent path escapes and file symlinks", async () => {
    const escapedRoot = createKoshaFixture({ manifestPath: "../outside.json" });
    const escaped = await loadKoshaGuideCorpus({ rootDir: escapedRoot });
    expect(escaped.status).toBe("blocked");
    expect(escaped.status === "blocked" && escaped.failures).toContain("path:escape");

    const linkedRoot = createKoshaFixture();
    const outside = join(linkedRoot, "outside-current.json");
    writeFileSync(outside, readFileSync(join(linkedRoot, "current.json")));
    unlinkSync(join(linkedRoot, "current.json"));
    symlinkSync(outside, join(linkedRoot, "current.json"), "file");
    const linked = await loadKoshaGuideCorpus({ rootDir: linkedRoot });
    expect(linked.status).toBe("blocked");
    expect(linked.status === "blocked" && linked.failures).toContain("path:symlink");
  });

  it("rejects replacement at the lstat-to-open boundary", async () => {
    const rootDir = createKoshaFixture();
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

  it("enforces record bounds and duplicate or orphan memberships", async () => {
    const sourceRoot = createKoshaFixture();
    const [firstItem] = readFixtureItems(sourceRoot);
    if (!firstItem) throw new Error("Fixture item is missing");
    const oversizedBody = "x".repeat(8 * 1024 * 1024 + 1);
    const oversizedItem: JsonRecord = {
      ...firstItem,
      body: oversizedBody,
      normalized_text_sha256: sha256(oversizedBody)
    };
    const bounded = await loadKoshaGuideCorpus({
      rootDir: createKoshaFixture({ items: [oversizedItem], chunks: [] })
    });
    expect(bounded.status).toBe("blocked");
    expect(bounded.status === "blocked" && bounded.failures).toContain("limit:record:items.jsonl");

    const duplicate = await loadKoshaGuideCorpus({
      rootDir: createKoshaFixture({ items: [firstItem, firstItem], chunks: [] })
    });
    expect(duplicate.status).toBe("blocked");
    expect(duplicate.status === "blocked" && duplicate.failures.some((failure) => failure.startsWith("duplicate:item:"))).toBe(true);

    const orphanText = "고립 청크";
    const orphan = await loadKoshaGuideCorpus({
      rootDir: createKoshaFixture({
        items: [firstItem],
        chunks: [{
          schema_version: "safeclaw-kosha-body-corpus/v2",
          chunk_id: "orphan:p1",
          chunk_sha256: sha256(orphanText),
          item_id: "kosha-orphan",
          page_start: 1,
          page_end: 1,
          text: orphanText
        }]
      })
    });
    expect(orphan.status).toBe("blocked");
    expect(orphan.status === "blocked" && orphan.failures).toContain("orphan:chunk:kosha-orphan");
  }, 20_000);

  it("keeps local KOSHA supporting-only and blocks KOSHA-only risk rows", async () => {
    const rootDir = createKoshaFixture({ state: "current" });
    const result = await withNoSupabase(() => searchSafetyReferences({
      query: "지게차 보행자 동선 충돌",
      limit: 3,
      offlineCorpus: { rootDir }
    }));
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.evidence_role === "supporting")).toBe(true);
    expect(result.items.some((item) => item.kosha_guide?.directEligible === true)).toBe(true);
    const response = buildMockAskResponse("지게차 보행자 동선 충돌", mockSearchResults, "mock", "test");
    expect(buildSafetyReferenceRiskRows(response, result.items, "맑음", "지게차 보행자 동선 충돌")).toEqual([]);
    const grounded = buildSafetyReferenceRiskRows(
      response,
      [directReference(), ...result.items],
      "맑음",
      "지게차 보행자 동선 충돌"
    );
    expect(grounded.some((row) => row.evidenceRefs.some((ref) => ref.startsWith("KOSHA 근거 ")))).toBe(true);
  });

  it("filters local itemType before score and preserves the final remote retrieval mode", async () => {
    const rootDir = createKoshaFixture();
    const sif = await withNoSupabase(() => searchSafetyReferences({
      query: "지게차",
      itemType: "sif-case",
      limit: 1,
      offlineCorpus: { rootDir }
    }));
    const regulation = await withNoSupabase(() => searchSafetyReferences({
      query: "지게차",
      itemType: "technical-support-regulation",
      limit: 1,
      offlineCorpus: { rootDir }
    }));
    expect(sif.items).toEqual([]);
    expect(regulation.items).toHaveLength(1);
    expect(regulation.items[0]?.item_type).toBe("technical-support-regulation");

    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([directReference()]), {
      status: 200,
      headers: { "content-type": "application/json" }
    })));
    const remote = await searchSafetyReferences({
      query: "지게차",
      itemType: "construction-process",
      limit: 1,
      offlineCorpus: { rootDir }
    });
    expect(remote.items).toHaveLength(1);
    expect(remote.retrievalMode).toBe("ranked-rpc");
  });
});
