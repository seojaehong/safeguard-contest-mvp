import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config.mjs";

import { buildDbHarnessPacket, buildHarnessPromptContext } from "@/lib/db-harness";
import { exactKoshaReferenceAppliesToQuery } from "@/lib/exact-kosha-applicability-policy";
import { buildGroundedGenerationPacket } from "@/lib/grounded-generation-contract";
import {
  getProductionExactKoshaTrustPins,
  isProductionTrustedKoshaReference,
} from "@/lib/production-kosha-trust";
import {
  loadBundledExactKoshaReference,
  loadBundledExactKoshaReferences,
  mergeBundledExactKoshaFallbacks,
} from "@/lib/safety-reference-catalog-server";

const EXACT_DIR = join(process.cwd(), "data", "safety-knowledge", "exact-kosha");
const B_E_10_PATH = join(EXACT_DIR, "b-e-10-2026.json");
const EXACT_PATHS = [
  join(EXACT_DIR, "d-c-13-2026.json"),
  join(EXACT_DIR, "d-c-7-2026.json"),
  B_E_10_PATH,
] as const;
const GUIDE_CORPUS_TRACE_ASSETS = [
  "data/safety-knowledge/kosha-guide-corpus/current.json",
  "data/safety-knowledge/kosha-guide-corpus/snapshots/e99b7faf268c513c9eed329c016670339d686ba580141e54fe3ffdfafb478a12/manifest.json",
  "data/safety-knowledge/kosha-guide-corpus/snapshots/e99b7faf268c513c9eed329c016670339d686ba580141e54fe3ffdfafb478a12/items.jsonl.gz",
  "data/safety-knowledge/kosha-guide-corpus/snapshots/e99b7faf268c513c9eed329c016670339d686ba580141e54fe3ffdfafb478a12/chunks.jsonl.gz",
  "data/safety-knowledge/kosha-guide-corpus/snapshots/e99b7faf268c513c9eed329c016670339d686ba580141e54fe3ffdfafb478a12/failures.jsonl",
].map((path) => `./${path}`);

const B_E_10_ID = "technical-support-09-0002-b-e-10-2026-정전전로-및-그-인근에서의-전기작업에-관한-기술지원규정";

describe("exact-trusted KOSHA registry wave 3", () => {
  it("loads an atomic three-item registry with the immutable B-E-10 pins", async () => {
    const loaded = await loadBundledExactKoshaReferences();
    expect(loaded.status).toBe("ready");
    if (loaded.status !== "ready") throw new Error("expected three-item exact registry");

    expect(getProductionExactKoshaTrustPins()).toHaveLength(3);
    expect(loaded.items).toHaveLength(3);
    const outage = loaded.items.find((item) => item.id === B_E_10_ID);
    expect(outage).toMatchObject({
      title: "B-E-10-2026 정전전로 및 그 인근에서의 전기작업에 관한 기술지원규정",
      source_id: "kosha-technical-support-regulations-2025",
      item_type: "technical-support-regulation",
      kosha_guide: {
        stableDocumentKey: "B-E-10",
        version: "B-E-10-2026",
        officialFileId: "CTC2026012913263450093332",
        publicationDate: "2026-01-30",
        pdfSha256: "0a44548411eb5402761934de46fd70393064dca22c56b7b8a27967c3cab4eb23",
        bodySha256: "6fe137a8f788914b0f9804fbd81e8f9fa987dd108ce6edb2fd47eda9bee9b121",
      },
    });
    expect(outage && isProductionTrustedKoshaReference(outage)).toBe(true);
  });

  it.each([
    "bodySha256",
    "pdfSha256",
    "officialUrl",
    "officialFileId",
    "publishedAt",
    "extractionSnapshot",
  ] as const)("fails closed when the B-E-10 %s pin mismatches", async (field) => {
    const directory = mkdtempSync(join(tmpdir(), "safeclaw-b-e-10-pin-"));
    try {
      const asset = JSON.parse(readFileSync(B_E_10_PATH, "utf8")) as Record<string, unknown>;
      asset[field] = field.endsWith("Sha256") || field === "extractionSnapshot"
        ? "0".repeat(64)
        : `${String(asset[field])}-mismatch`;
      const mutatedPath = join(directory, "b-e-10-mutated.json");
      writeFileSync(mutatedPath, JSON.stringify(asset), "utf8");

      await expect(loadBundledExactKoshaReferences([
        EXACT_PATHS[0],
        EXACT_PATHS[1],
        mutatedPath,
      ])).resolves.toMatchObject({ status: "blocked", reason: "asset-integrity-failed" });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each([
    ["배전반 정전 후 잠금표지 LOTO 작업", true],
    ["정전전로에서 전기설비 정비 작업", true],
    ["검전기로 무전압 확인 후 전기작업", true],
    ["전압 부재 확인 후 차단기 점검", true],
    ["전기공사 견적과 자재 납품 일정", false],
    ["배전반 구매 가격 비교", false],
    ["정전 할인 상품 판매", false],
    ["사무실 정전 공지 작성", false],
    ["배전반 임대 비용 문의", false],
    ["차단기 제품 구입 일정", false],
    ["LOTO 제품 쇼핑", false],
    ["전기공사 비용 견적", false],
    ["배전반 LOTO 임대 점검", false],
    ["배전반 LOTO 비용 점검", false],
    ["배전반 LOTO 구입 점검", false],
    ["배전반 LOTO 제품 점검", false],
    ["배전반 LOTO 쇼핑 점검", false],
    ["배전반 구입 후 정전 전기작업에서 LOTO와 검전기로 무전압 확인", true],
    ["차단기 임대 후 정전전로 전기설비 정비 작업, 잠금표지와 검전 실시", true],
  ])("bounds B-E-10 applicability for %s", (query, expected) => {
    expect(exactKoshaReferenceAppliesToQuery("B-E-10", query)).toBe(expected);
  });

  it("keeps B-E-10 controls and grounding excerpts inside query-relevant exact body anchors", async () => {
    const loaded = await loadBundledExactKoshaReference(B_E_10_PATH);
    expect(loaded.status).toBe("ready");
    if (loaded.status !== "ready") throw new Error("expected B-E-10 exact asset");

    const item = loaded.item;
    expect(item.controls.length).toBeGreaterThanOrEqual(3);
    for (const control of item.controls) expect(item.body).toContain(control);
    expect(item.kosha_guide?.anchors.length).toBeGreaterThan(0);
    for (const anchor of item.kosha_guide?.anchors ?? []) {
      expect(anchor.page).toBe(6);
      expect(item.body).toContain(anchor.excerpt);
    }

    const question = "배전반 정전 후 전원 차단, 잠금표지 LOTO, 검전기로 무전압 확인하는 전기작업";
    const packet = buildDbHarnessPacket({
      question,
      references: [item, {
        id: "sif-electrical-outage-parent",
        source_id: "kosha-sif-archive-20260401",
        item_type: "sif-case",
        category: "전기안전",
        subcategory: "정전작업",
        title: "정전 전기작업 중 감전 사례",
        summary: "전원 차단과 검전 없이 전기설비를 점검하던 중 감전된 사례",
        body: "전원 차단과 잠금표지 후 검전기로 무전압을 확인한다.",
        keywords: ["정전", "전기작업", "검전"],
        risk_tags: ["감전", "전기"],
        primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
        controls: ["전원 차단과 잠금표지 후 검전기로 무전압을 확인한다."],
        evidence_role: "supporting",
        retrieval_source: "ranked",
      }],
    });
    const grounded = buildGroundedGenerationPacket({
      dbHarnessPacket: packet,
      legalCandidates: [],
      eligibleKoshaIds: new Set([item.id]),
    });
    const source = grounded.sources.find((candidate) => candidate.referenceKey === "KOSHA:B-E-10@B-E-10-2026");
    expect(source?.controls.length).toBeGreaterThan(0);
    for (const control of source?.controls ?? []) {
      expect(item.controls).toContain(control);
      expect(item.body).toContain(control);
    }

    const prompt = buildHarnessPromptContext(packet);
    const firstBodyWindow = Array.from(item.body ?? "").slice(0, 720).join("");
    expect(prompt).not.toContain(JSON.stringify(firstBodyWindow).slice(1, -1));
    expect(item.kosha_guide?.anchors.some((anchor) => prompt.includes(anchor.excerpt))).toBe(true);
  });

  it.each(EXACT_PATHS)("fails closed when publishedAt is missing from %s", async (assetPath) => {
    const directory = mkdtempSync(join(tmpdir(), "safeclaw-published-at-missing-"));
    try {
      const asset = JSON.parse(readFileSync(assetPath, "utf8")) as Record<string, unknown>;
      delete asset.publishedAt;
      const mutatedPath = join(directory, "missing-published-at.json");
      writeFileSync(mutatedPath, JSON.stringify(asset), "utf8");

      await expect(loadBundledExactKoshaReference(mutatedPath)).resolves.toMatchObject({
        status: "blocked",
        reason: "asset-invalid",
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each(EXACT_PATHS)("fails closed when publishedAt is null in %s", async (assetPath) => {
    const directory = mkdtempSync(join(tmpdir(), "safeclaw-published-at-null-"));
    try {
      const asset = JSON.parse(readFileSync(assetPath, "utf8")) as Record<string, unknown>;
      asset.publishedAt = null;
      const mutatedPath = join(directory, "null-published-at.json");
      writeFileSync(mutatedPath, JSON.stringify(asset), "utf8");

      await expect(loadBundledExactKoshaReference(mutatedPath)).resolves.toMatchObject({
        status: "blocked",
        reason: "asset-invalid",
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("selects B-E-10 only for operational electrical queries and traces all three assets", async () => {
    const loaded = await loadBundledExactKoshaReferences();
    if (loaded.status !== "ready") throw new Error("expected three-item exact registry");

    const operational = mergeBundledExactKoshaFallbacks({
      query: "수전반 정전 후 LOTO와 검전기로 무전압 확인하는 전기작업",
      remoteItems: [],
      bundledItems: loaded.items,
      localGateActive: true,
      limit: 5,
    });
    expect(operational.map((item) => item.kosha_guide?.stableDocumentKey)).toEqual(["B-E-10"]);

    const commercial = mergeBundledExactKoshaFallbacks({
      query: "배전반 구매 가격과 전기공사 견적",
      remoteItems: [loaded.items[2]!],
      bundledItems: loaded.items,
      localGateActive: true,
      limit: 5,
    });
    expect(commercial).toEqual([]);

    const expectedAssets = [
      ...EXACT_PATHS.map((path) => `./${path.slice(process.cwd().length + 1).replaceAll("\\", "/")}`),
      ...GUIDE_CORPUS_TRACE_ASSETS,
    ];
    for (const assets of Object.values(nextConfig.outputFileTracingIncludes ?? {})) {
      expect(assets).toEqual(expectedAssets);
    }
  });
});
