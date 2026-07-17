import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "@/next.config.mjs";

import {
  loadBundledExactKoshaReferences,
  mergeBundledExactKoshaFallbacks,
  searchSafetyReferences,
} from "@/lib/safety-reference-catalog-server";
import {
  getKoshaGroundingDecision,
  isSafetyReferenceDirectEligible,
} from "@/lib/safety-reference-catalog";

const EXACT_DIR = join(process.cwd(), "data", "safety-knowledge", "exact-kosha");
const D_C_13_PATH = join(EXACT_DIR, "d-c-13-2026.json");
const D_C_7_PATH = join(EXACT_DIR, "d-c-7-2026.json");
const EXPECTED_TRACE_ROUTES = [
  "/api/agent/chat",
  "/api/ask",
  "/api/ask/stream",
  "/api/briefing/run",
  "/api/input-photos/hazard-analysis",
  "/api/mcp/[transport]",
  "/api/safety-reference/search",
  "/api/search",
  "/api/workpack/remediate",
  "/api/workpacks/[id]/improvements",
  "/api/workpacks/[id]/operation-graph",
  "/ask",
  "/interpretation/[id]",
  "/law/[id]",
  "/precedent/[id]",
  "/search",
] as const;

describe("exact-trusted KOSHA registry wave 2", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it("loads both immutable references as production-registry direct evidence", async () => {
    const loaded = await loadBundledExactKoshaReferences();
    expect(loaded.status).toBe("ready");
    if (loaded.status !== "ready") throw new Error("expected exact KOSHA registry");

    expect(loaded.items.slice(0, 2).map((item) => item.id)).toEqual([
      "technical-support-01-0065-d-c-13-2026-외벽도장보수공사에-안전작업에-관한-기술지원규정",
      "technical-support-01-0073-d-c-7-2026-비계-구조-및-안전작업에-관한-기술지원규정",
    ]);
    for (const item of loaded.items) {
      expect(isSafetyReferenceDirectEligible(item), item.id).toBe(true);
      expect(getKoshaGroundingDecision(item), item.id).toMatchObject({
        source: "production-registry",
        reviewRequired: false,
        directEvidenceEligible: true,
      });
    }
  });

  it("selects exact references by bounded task intent without leaking into shopping queries", async () => {
    const loaded = await loadBundledExactKoshaReferences();
    if (loaded.status !== "ready") throw new Error("expected exact KOSHA registry");

    const exterior = mergeBundledExactKoshaFallbacks({
      query: "아파트 외벽 도장 보수 작업",
      remoteItems: [],
      bundledItems: loaded.items,
      localGateActive: true,
      limit: 5,
    });
    expect(exterior.map((item) => item.kosha_guide?.stableDocumentKey)).toEqual(["D-C-13"]);

    const scaffold = mergeBundledExactKoshaFallbacks({
      query: "이동식 비계 조립 후 작업발판에서 외벽 도장 작업",
      remoteItems: [],
      bundledItems: loaded.items,
      localGateActive: true,
      limit: 5,
    });
    expect(scaffold.map((item) => item.kosha_guide?.stableDocumentKey)).toEqual(["D-C-13", "D-C-7"]);

    const unrelated = mergeBundledExactKoshaFallbacks({
      query: "이동식 비계 구매 견적과 납품 일정",
      remoteItems: [loaded.items[1]!],
      bundledItems: loaded.items,
      localGateActive: true,
      limit: 5,
    });
    expect(unrelated).toEqual([]);
  });

  it("fails the configured registry closed when any exact asset is missing", async () => {
    const loaded = await loadBundledExactKoshaReferences([
      D_C_13_PATH,
      join(EXACT_DIR, "missing-d-c-7.json"),
    ]);
    expect(loaded).toMatchObject({
      status: "blocked",
      reason: "asset-unavailable",
    });
  });

  it("blocks every remote technical reference when the configured registry is incomplete", async () => {
    const loaded = await loadBundledExactKoshaReferences();
    if (loaded.status !== "ready") throw new Error("expected exact KOSHA registry");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
    vi.stubEnv("SAFETY_REFERENCE_VECTOR_SEARCH", "0");
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      if (String(input).includes("/rpc/search_safety_references_ranked")) {
        return new Response(JSON.stringify([loaded.items[0]]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch URL: ${String(input)}`);
    }));

    const result = await searchSafetyReferences({
      query: "아파트 외벽 도장 작업",
      limit: 5,
      exactKoshaAssetPaths: [D_C_13_PATH, join(EXACT_DIR, "missing-d-c-7.json")],
      offlineCorpus: { rootDir: null, env: { KOSHA_GUIDE_CORPUS_DIR: undefined } },
    });

    expect(result.items).toEqual([]);
    expect(result.koshaGrounding).toMatchObject({
      status: "blocked",
      reason: "exact-registry-integrity-failed",
      acceptedCount: 0,
    });
  });

  it("does not restore a trusted remote exact row that is inapplicable to the query", async () => {
    const loaded = await loadBundledExactKoshaReferences();
    if (loaded.status !== "ready") throw new Error("expected exact KOSHA registry");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
    vi.stubEnv("SAFETY_REFERENCE_VECTOR_SEARCH", "0");
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      if (String(input).includes("/rpc/search_safety_references_ranked")) {
        return new Response(JSON.stringify([loaded.items[1]]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch URL: ${String(input)}`);
    }));

    const result = await searchSafetyReferences({
      query: "이동식 비계 구매 견적과 납품 일정",
      limit: 5,
      offlineCorpus: { rootDir: null, env: { KOSHA_GUIDE_CORPUS_DIR: undefined } },
    });

    expect(result.items).toEqual([]);
    expect(result.message).toMatch(/exact trust gate 기준에 맞지 않는 KOSHA 원격 행을 제외/u);
  });

  it("rejects empty and duplicate configured registries", async () => {
    await expect(loadBundledExactKoshaReferences([])).resolves.toMatchObject({
      status: "blocked",
      reason: "asset-invalid",
    });
    await expect(loadBundledExactKoshaReferences([D_C_13_PATH, D_C_13_PATH])).resolves.toMatchObject({
      status: "blocked",
      reason: "asset-invalid",
    });
    await expect(loadBundledExactKoshaReferences([D_C_13_PATH])).resolves.toMatchObject({
      status: "blocked",
      reason: "asset-invalid",
    });
  });

  it("fails closed when the portable provenance digest is malformed", async () => {
    const directory = mkdtempSync(join(tmpdir(), "safeclaw-kosha-registry-"));
    try {
      const malformedPath = join(directory, "d-c-7-malformed.json");
      const malformed = JSON.parse(readFileSync(D_C_7_PATH, "utf8")) as Record<string, unknown>;
      malformed.portabilityLedgerSha256 = "not-a-sha256";
      writeFileSync(malformedPath, JSON.stringify(malformed), "utf8");

      const loaded = await loadBundledExactKoshaReferences([D_C_13_PATH, malformedPath]);
      expect(loaded).toMatchObject({ status: "blocked", reason: "asset-integrity-failed" });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("fails closed when provenance is valid SHA-256 but does not match the immutable pin", async () => {
    const directory = mkdtempSync(join(tmpdir(), "safeclaw-kosha-registry-"));
    try {
      const mismatchedPath = join(directory, "d-c-7-mismatched.json");
      const mismatched = JSON.parse(readFileSync(D_C_7_PATH, "utf8")) as Record<string, unknown>;
      mismatched.portabilityLedgerSha256 = "0".repeat(64);
      writeFileSync(mismatchedPath, JSON.stringify(mismatched), "utf8");

      const loaded = await loadBundledExactKoshaReferences([D_C_13_PATH, mismatchedPath]);
      expect(loaded).toMatchObject({ status: "blocked", reason: "asset-integrity-failed" });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("fails closed when one of two provenance aliases conflicts with the immutable pin", async () => {
    const directory = mkdtempSync(join(tmpdir(), "safeclaw-kosha-registry-"));
    try {
      const conflictingPath = join(directory, "d-c-7-conflicting.json");
      const conflicting = JSON.parse(readFileSync(D_C_7_PATH, "utf8")) as Record<string, unknown>;
      conflicting.extractionSnapshot = conflicting.portabilityLedgerSha256;
      conflicting.portabilityLedgerSha256 = "0".repeat(64);
      writeFileSync(conflictingPath, JSON.stringify(conflicting), "utf8");

      const loaded = await loadBundledExactKoshaReferences([D_C_13_PATH, conflictingPath]);
      expect(loaded).toMatchObject({ status: "blocked", reason: "asset-integrity-failed" });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("traces every configured normalized body without committing official PDFs", () => {
    const dC7 = JSON.parse(readFileSync(D_C_7_PATH, "utf8")) as {
      body: string;
      normalizedCharCount: number;
      bodySha256: string;
    };
    expect(dC7.body).toHaveLength(38_781);
    expect(dC7.normalizedCharCount).toBe(38_781);
    expect(dC7.bodySha256).toBe("97c58f2c39260e9e763bae54748466f0837064ddccfc8e29b77d857c9f390112");

    expect(nextConfig.outputFileTracingIncludes?.["/api/safety-reference/search"]).toEqual([
      "./data/safety-knowledge/exact-kosha/d-c-13-2026.json",
      "./data/safety-knowledge/exact-kosha/d-c-7-2026.json",
      "./data/safety-knowledge/exact-kosha/b-e-10-2026.json",
    ]);
    expect(nextConfig.outputFileTracingIncludes?.["/api/safety-reference/search"]).not.toContain(
      "./data/safety-knowledge/exact-kosha/d-c-7-2026.pdf",
    );
    expect(nextConfig.outputFileTracingIncludes?.["/*"]).toBeUndefined();
    expect(Object.keys(nextConfig.outputFileTracingIncludes ?? {}).sort()).toEqual(
      [...EXPECTED_TRACE_ROUTES].sort(),
    );
    for (const route of EXPECTED_TRACE_ROUTES) {
      expect(nextConfig.outputFileTracingIncludes?.[route], route).toEqual([
        "./data/safety-knowledge/exact-kosha/d-c-13-2026.json",
        "./data/safety-knowledge/exact-kosha/d-c-7-2026.json",
        "./data/safety-knowledge/exact-kosha/b-e-10-2026.json",
      ]);
    }
  });
});
