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
  resetKoshaGuideCorpusCacheForTests,
  searchKoshaGuideCorpus
} from "@/lib/kosha-guide-corpus";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { buildSafetyReferenceRiskRows } from "@/lib/search";
import { searchSafetyReferences } from "@/lib/safety-reference-catalog-server";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";
import {
  ACTUAL_KOSHA_ROOT,
  asRecord,
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

const REVIEWED_OCR_CANDIDATE_SHA256 = sha256("reviewed OCR candidate");
const REVIEWED_OCR_BODY = "고소작업대 전도 방지를 위해 아웃트리거 설치 상태를 확인한다.";

function reviewedOcrProvenance(): JsonRecord {
  return {
    candidate_sha256: REVIEWED_OCR_CANDIDATE_SHA256,
    content_sha256: sha256("reviewed OCR content"),
    attestation_sha256: sha256("reviewed OCR attestation"),
    attestation_schema: "safeclaw-kosha-ocr-review-attestation/v1",
    reviewed_by: "corpus-reviewer",
    reviewed_at: "2026-07-13T00:00:00Z",
    generator_script_sha256: sha256("reviewed OCR generator"),
    pages: [{
      page_number: 1,
      image_sha256: sha256("reviewed OCR page image"),
      text_sha256: sha256("reviewed OCR page text"),
      response_id: "response-1",
      model: "test-vision-model"
    }]
  };
}

function reviewedOcrBinding(
  itemId: string,
  candidateSha256 = REVIEWED_OCR_CANDIDATE_SHA256
): JsonRecord {
  const provenance = reviewedOcrProvenance();
  return {
    item_id: itemId,
    candidate_sha256: candidateSha256,
    content_sha256: provenance.content_sha256,
    attestation_sha256: provenance.attestation_sha256
  };
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record).sort().map((key) => [key, canonicalizeJson(record[key])])
  );
}

function writeReviewedOcrManifestBindings(rootDir: string, bindings?: JsonRecord[]): void {
  const currentPath = join(rootDir, "current.json");
  const current = asRecord(JSON.parse(readFileSync(currentPath, "utf8")) as unknown);
  const manifestDescriptor = asRecord(current.manifest);
  const manifestRelativePath = manifestDescriptor.path;
  if (typeof manifestRelativePath !== "string") throw new Error("Fixture manifest path is missing");
  const manifestPath = join(rootDir, manifestRelativePath);
  const manifest = asRecord(JSON.parse(readFileSync(manifestPath, "utf8")) as unknown);
  const generationPolicy: JsonRecord = {
    schema_version: "safeclaw-kosha-body-corpus/v2",
    extractor_version: "safeclaw-kosha-native-pdf/v2",
    pypdf_version: "fixture",
    chunk_chars: 200,
    filters: { category: null, state: null },
    ocr_thresholds: {
      page_requires_image: true,
      page_normalized_chars: 80,
      document_normalized_chars: 200
    },
    resource_limits: {
      max_member_count: 10_000,
      max_member_bytes: 64 * 1024 * 1024,
      max_compression_ratio: 100,
      max_total_uncompressed_bytes: 1024 * 1024 * 1024,
      max_pages_per_pdf: 2000,
      max_normalized_chars_per_pdf: 2_000_000
    },
    provenance_identity_sha256: null,
    normalization: "NFKC+line-ending+horizontal-whitespace/v1",
    chunking: "per-page-fixed-character-span/v1"
  };
  if (bindings !== undefined) generationPolicy.reviewed_ocr_candidates = bindings;
  const canonicalPolicy = JSON.stringify(canonicalizeJson(generationPolicy));
  if (!canonicalPolicy) throw new Error("Fixture generation policy is not serializable");
  const generationPolicySha256 = sha256(canonicalPolicy);
  manifest.generation_policy = generationPolicy;
  manifest.generation_policy_sha256 = generationPolicySha256;
  const manifestText = JSON.stringify(manifest, null, 2);
  writeFileSync(manifestPath, manifestText, "utf8");
  manifestDescriptor.sha256 = sha256(manifestText);
  manifestDescriptor.size_bytes = Buffer.byteLength(manifestText);
  current.manifest = manifestDescriptor;
  current.generation_policy_sha256 = generationPolicySha256;
  writeFileSync(currentPath, JSON.stringify(current, null, 2), "utf8");
}

function reviewedOcrChunk(body: string, itemId = "kosha-guideline"): JsonRecord {
  return {
    schema_version: "safeclaw-kosha-body-corpus/v2",
    chunk_id: `${itemId}:p1`,
    chunk_sha256: sha256(body),
    item_id: itemId,
    page_start: 1,
    page_end: 1,
    text: body
  };
}

type ReviewedOcrSnapshotOptions = {
  body?: string;
  bodyHash?: string;
  chunks?: JsonRecord[];
  extractionStatus?: string;
  includeBodyOrigin?: boolean;
  includeProvenance?: boolean;
  provenance?: unknown;
};

function createReviewedOcrSnapshot(options: ReviewedOcrSnapshotOptions = {}): {
  rootDir: string;
  itemId: string;
  body: string;
} {
  const sourceRoot = createKoshaFixture();
  const [firstItem] = readFixtureItems(sourceRoot);
  if (!firstItem) throw new Error("Fixture item is missing");
  const body = options.body ?? REVIEWED_OCR_BODY;
  const itemId = String(firstItem.item_id);
  const item: JsonRecord = {
    ...firstItem,
    body,
    normalized_text_sha256: options.bodyHash ?? sha256(body),
    extraction_status: options.extractionStatus ?? firstItem.extraction_status,
    state: "current"
  };
  if (options.includeBodyOrigin !== false) item.body_origin = "human-reviewed-ocr";
  if (options.includeProvenance !== false) {
    item.reviewed_ocr_provenance = options.provenance ?? reviewedOcrProvenance();
  }
  return {
    rootDir: createKoshaFixture({
      items: [item],
      chunks: options.chunks ?? [reviewedOcrChunk(body, itemId)]
    }),
    itemId,
    body
  };
}

afterEach(() => {
  resetKoshaGuideCorpusCacheForTests();
  vi.unstubAllGlobals();
  cleanupKoshaFixtures();
});

describe("KOSHA v3 offline harness on current architecture", () => {
  it.skipIf(!existsSync(ACTUAL_KOSHA_ROOT))("blocks the legacy v3 artifact without a verified launch gate", async () => {
    const loaded = await loadKoshaGuideCorpus({ rootDir: ACTUAL_KOSHA_ROOT });
    expect(loaded.status).toBe("blocked");
    expect(loaded.status === "blocked" && loaded.failures).toContain("schema:manifest.json");
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

  it("preserves native-only manifests whose generation policy has no OCR bindings", async () => {
    const rootDir = createKoshaFixture({ state: "current" });
    writeReviewedOcrManifestBindings(rootDir);
    const loaded = await loadKoshaGuideCorpus({ rootDir });
    expect(loaded.status).toBe("ready");
    if (loaded.status !== "ready") return;
    expect(loaded.records.every((record) => record.bodyKind === "native")).toBe(true);
    expect(loaded.records.every(isKoshaGuideDirectEvidenceAccepted)).toBe(true);
  });

  it("blocks reviewed OCR from the current-native verified subset", async () => {
    const { rootDir, itemId, body } = createReviewedOcrSnapshot();
    writeReviewedOcrManifestBindings(rootDir, [reviewedOcrBinding(itemId)]);

    const loaded = await loadKoshaGuideCorpus({ rootDir });
    expect(body).toContain("고소작업대");
    expect(loaded.status).toBe("blocked");
    expect(loaded.status === "blocked" && loaded.failures).toContain("gate:provenance-incomplete");
  });

  it("requires one matching manifest candidate binding for every reviewed OCR item", async () => {
    const missing = createReviewedOcrSnapshot();
    const missingResult = await loadKoshaGuideCorpus({ rootDir: missing.rootDir });
    expect(missingResult.status).toBe("blocked");
    expect(missingResult.status === "blocked" && missingResult.failures).toContain(
      `ocr:binding:missing:${missing.itemId}`
    );

    const mismatch = createReviewedOcrSnapshot();
    writeReviewedOcrManifestBindings(mismatch.rootDir, [reviewedOcrBinding(
      mismatch.itemId,
      sha256("different reviewed OCR candidate")
    )]);
    const mismatchResult = await loadKoshaGuideCorpus({ rootDir: mismatch.rootDir });
    expect(mismatchResult.status).toBe("blocked");
    expect(mismatchResult.status === "blocked" && mismatchResult.failures).toContain(
      `ocr:binding:mismatch:${mismatch.itemId}`
    );

    const provenanceMismatch = createReviewedOcrSnapshot();
    writeReviewedOcrManifestBindings(provenanceMismatch.rootDir, [{
      ...reviewedOcrBinding(provenanceMismatch.itemId),
      content_sha256: sha256("different reviewed OCR content")
    }]);
    const provenanceMismatchResult = await loadKoshaGuideCorpus({
      rootDir: provenanceMismatch.rootDir
    });
    expect(provenanceMismatchResult.status).toBe("blocked");
    expect(
      provenanceMismatchResult.status === "blocked" && provenanceMismatchResult.failures
    ).toContain(`ocr:binding:provenance-mismatch:${provenanceMismatch.itemId}`);
  });

  it("rejects duplicate and extra orphan manifest candidate bindings", async () => {
    const duplicate = createReviewedOcrSnapshot();
    const duplicateBinding = reviewedOcrBinding(duplicate.itemId);
    writeReviewedOcrManifestBindings(duplicate.rootDir, [duplicateBinding, duplicateBinding]);
    const duplicateResult = await loadKoshaGuideCorpus({ rootDir: duplicate.rootDir });
    expect(duplicateResult.status).toBe("blocked");
    expect(duplicateResult.status === "blocked" && duplicateResult.failures).toContain(
      `ocr:binding:duplicate:${duplicate.itemId}`
    );

    const orphan = createReviewedOcrSnapshot();
    writeReviewedOcrManifestBindings(orphan.rootDir, [
      reviewedOcrBinding(orphan.itemId),
      reviewedOcrBinding(
        "kosha-orphan-reviewed-ocr",
        sha256("orphan reviewed OCR candidate")
      )
    ]);
    const orphanResult = await loadKoshaGuideCorpus({ rootDir: orphan.rootDir });
    expect(orphanResult.status).toBe("blocked");
    expect(orphanResult.status === "blocked" && orphanResult.failures).toContain(
      "ocr:binding:orphan:kosha-orphan-reviewed-ocr"
    );
  });

  it("parses manifest candidate bindings with exact shape and canonical SHA values", async () => {
    const malformedBindings: Array<{ label: string; bindings: JsonRecord[] }> = [
      {
        label: "invalid candidate SHA",
        bindings: [{ item_id: "kosha-guideline", candidate_sha256: "invalid" }]
      },
      {
        label: "extra binding field",
        bindings: [{
          item_id: "kosha-guideline",
          candidate_sha256: REVIEWED_OCR_CANDIDATE_SHA256,
          unexpected: true
        }]
      },
      {
        label: "empty declared candidate list",
        bindings: []
      }
    ];
    for (const { label, bindings } of malformedBindings) {
      const fixture = createReviewedOcrSnapshot();
      writeReviewedOcrManifestBindings(fixture.rootDir, bindings);
      const loaded = await loadKoshaGuideCorpus({ rootDir: fixture.rootDir });
      expect(loaded.status, label).toBe("blocked");
      expect(loaded.status === "blocked" && loaded.failures, label).toContain("schema:manifest.json");
    }
  });

  it("rejects reviewed OCR body hash drift, non-success status, and missing anchors", async () => {
    const bodyHashDrift = createReviewedOcrSnapshot({ bodyHash: sha256("different OCR body") });
    writeReviewedOcrManifestBindings(bodyHashDrift.rootDir, [
      reviewedOcrBinding(bodyHashDrift.itemId)
    ]);
    const bodyHashResult = await loadKoshaGuideCorpus({ rootDir: bodyHashDrift.rootDir });
    expect(bodyHashResult.status).toBe("blocked");
    expect(bodyHashResult.status === "blocked" && bodyHashResult.failures).toContain("schema:items.jsonl");

    const boundary = createReviewedOcrSnapshot({ extractionStatus: "boundary" });
    writeReviewedOcrManifestBindings(boundary.rootDir, [reviewedOcrBinding(boundary.itemId)]);
    const boundaryResult = await loadKoshaGuideCorpus({ rootDir: boundary.rootDir });
    expect(boundaryResult.status).toBe("blocked");
    expect(boundaryResult.status === "blocked" && boundaryResult.failures).toContain("schema:items.jsonl");

    const anchorless = createReviewedOcrSnapshot({ chunks: [] });
    writeReviewedOcrManifestBindings(anchorless.rootDir, [reviewedOcrBinding(anchorless.itemId)]);
    const anchorlessResult = await loadKoshaGuideCorpus({ rootDir: anchorless.rootDir });
    expect(anchorlessResult.status).toBe("blocked");
    expect(anchorlessResult.status === "blocked" && anchorlessResult.failures).toContain(
      `ocr:anchor:missing:${anchorless.itemId}`
    );

    const blankAnchor = createReviewedOcrSnapshot({ chunks: [reviewedOcrChunk("   ")] });
    writeReviewedOcrManifestBindings(blankAnchor.rootDir, [reviewedOcrBinding(blankAnchor.itemId)]);
    const blankAnchorResult = await loadKoshaGuideCorpus({ rootDir: blankAnchor.rootDir });
    expect(blankAnchorResult.status).toBe("blocked");
    expect(blankAnchorResult.status === "blocked" && blankAnchorResult.failures).toContain(
      `ocr:anchor:missing:${blankAnchor.itemId}`
    );
  });

  it("rejects malformed reviewed OCR page provenance and native provenance contamination", async () => {
    const provenance = reviewedOcrProvenance();
    const pages = provenance.pages;
    if (!Array.isArray(pages) || !pages[0]) throw new Error("Fixture OCR page provenance is missing");
    const validPage = asRecord(pages[0]);
    const malformedPages: Array<{ label: string; override: JsonRecord }> = [
      { label: "page sequence", override: { page_number: 2 } },
      { label: "page text hash", override: { text_sha256: "invalid" } },
      { label: "response id", override: { response_id: "" } },
      { label: "model", override: { model: "" } }
    ];
    for (const { label, override } of malformedPages) {
      const malformedPage = createReviewedOcrSnapshot({
        provenance: { ...provenance, pages: [{ ...validPage, ...override }] }
      });
      writeReviewedOcrManifestBindings(malformedPage.rootDir, [
        reviewedOcrBinding(malformedPage.itemId)
      ]);
      const malformedPageResult = await loadKoshaGuideCorpus({ rootDir: malformedPage.rootDir });
      expect(malformedPageResult.status, label).toBe("blocked");
      expect(
        malformedPageResult.status === "blocked" && malformedPageResult.failures,
        label
      ).toContain("schema:items.jsonl");
    }

    const missingProvenance = createReviewedOcrSnapshot({ includeProvenance: false });
    writeReviewedOcrManifestBindings(missingProvenance.rootDir, [
      reviewedOcrBinding(missingProvenance.itemId)
    ]);
    const missingProvenanceResult = await loadKoshaGuideCorpus({ rootDir: missingProvenance.rootDir });
    expect(missingProvenanceResult.status).toBe("blocked");
    expect(missingProvenanceResult.status === "blocked" && missingProvenanceResult.failures).toContain("schema:items.jsonl");

    const contaminatedNative = createReviewedOcrSnapshot({ includeBodyOrigin: false });
    const contaminatedResult = await loadKoshaGuideCorpus({ rootDir: contaminatedNative.rootDir });
    expect(contaminatedResult.status).toBe("blocked");
    expect(contaminatedResult.status === "blocked" && contaminatedResult.failures).toContain("schema:items.jsonl");

    const extraProvenanceField = createReviewedOcrSnapshot({
      provenance: { ...reviewedOcrProvenance(), unexpected: true }
    });
    writeReviewedOcrManifestBindings(extraProvenanceField.rootDir, [
      reviewedOcrBinding(extraProvenanceField.itemId)
    ]);
    const extraFieldResult = await loadKoshaGuideCorpus({ rootDir: extraProvenanceField.rootDir });
    expect(extraFieldResult.status).toBe("blocked");
    expect(extraFieldResult.status === "blocked" && extraFieldResult.failures).toContain("schema:items.jsonl");
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
