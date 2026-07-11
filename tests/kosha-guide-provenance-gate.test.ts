import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { loadKoshaGuideCorpus, type KoshaGuideCorpusRecord } from "@/lib/kosha-guide-corpus";
import { searchSafetyReferences } from "@/lib/safety-reference-catalog";
import { buildSafetyReferenceRiskRows, buildTbmRiskLinks } from "@/lib/search";

type FixtureFailure = {
  chunkId: string;
  stage: string;
  message: string;
};

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const target = tempDirs.pop();
    if (target) rmSync(target, { recursive: true, force: true });
  }
});

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function record(overrides: Partial<KoshaGuideCorpusRecord> = {}): KoshaGuideCorpusRecord {
  const nativeBody = overrides.nativeBody || "작업발판과 난간 상태를 확인하고, 지게차 보행 동선을 분리한다.";
  const base: KoshaGuideCorpusRecord = {
    referenceId: "D-C-13-2026",
    stableDocumentKey: "D-C-13",
    version: "D-C-13-2026",
    itemType: "technical-support-regulation",
    title: "외벽도장보수공사에 안전작업에 관한 기술지원규정",
    category: "건설안전분야",
    nativeBody,
    bodyKind: "native",
    quality: "accepted",
    provenance: {
      sourceId: "kosha-guide-offline",
      generationId: "gen-2026-07-12",
      generatedAt: "2026-07-12T00:00:00.000Z",
      lifecycle: "current",
      chunkId: "chunk-1",
      bodyHash: sha256Text(nativeBody)
    },
    tags: {
      keywords: ["외벽", "도장", "비계", "지게차"],
      riskTags: ["추락", "충돌"],
      controls: ["작업발판과 난간 상태 확인", "지게차 보행 동선 분리"],
      primaryDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"]
    },
    anchors: [{ page: 4, excerpt: "작업발판과 난간 상태를 확인한다." }]
  };
  return {
    ...base,
    ...overrides,
    provenance: {
      ...base.provenance,
      ...overrides.provenance
    },
    tags: {
      ...base.tags,
      ...overrides.tags
    },
    anchors: overrides.anchors ?? base.anchors
  };
}

function writeSnapshotFixture(options: {
  records: KoshaGuideCorpusRecord[];
  failures?: FixtureFailure[];
  lifecycle?: "current" | "stale" | "retired";
  stage?: "complete" | "partial";
  corruptManifestHash?: boolean;
  corruptAccounting?: boolean;
  removeManifest?: boolean;
}): string {
  const rootDir = mkdtempSync(join(tmpdir(), "kosha-provenance-gate-"));
  tempDirs.push(rootDir);
  mkdirSync(rootDir, { recursive: true });

  const failures = options.failures || [];
  const itemsBody = options.records.map((item) => JSON.stringify(item)).join("\n");
  const chunksBody = JSON.stringify({
    chunkId: "chunk-1",
    itemIds: options.records.map((item) => item.referenceId),
    itemCount: options.records.length
  });
  const failuresBody = failures.map((item) => JSON.stringify(item)).join("\n");
  const itemsSha256 = sha256Text(itemsBody);
  const chunksSha256 = sha256Text(chunksBody);
  const failuresSha256 = sha256Text(failuresBody);

  const source = {
    sourceId: "kosha-guide-offline",
    snapshotVersion: "v2",
    corpusVersion: "2026-07-12"
  };
  const generation = {
    generationId: "gen-2026-07-12",
    generatedAt: "2026-07-12T00:00:00.000Z",
    lifecycle: options.lifecycle || "current",
    stage: options.stage || "complete"
  };
  const accounting = {
    itemCount: options.corruptAccounting ? options.records.length + 1 : options.records.length,
    chunkCount: 1,
    failureCount: failures.length,
    acceptedCount: options.records.filter((item) => item.quality === "accepted").length,
    reviewRequiredCount: options.records.filter((item) => item.quality === "review_required").length
  };
  const manifest = {
    schemaVersion: 2,
    source: { ...source, sourceHash: sha256Text(stableStringify(source)) },
    generation: { ...generation, generationHash: sha256Text(stableStringify(generation)) },
    accounting: { ...accounting, accountingHash: sha256Text(stableStringify(accounting)) },
    files: {
      items: { path: "items.jsonl", sha256: itemsSha256, count: options.records.length },
      chunks: { path: "chunks.jsonl", sha256: chunksSha256, count: 1 },
      failures: { path: "failures.jsonl", sha256: failuresSha256, count: failures.length }
    }
  };
  const manifestText = JSON.stringify(manifest, null, 2);
  const manifestSha256 = sha256Text(manifestText);
  const current = {
    schemaVersion: 2,
    paths: {
      manifest: "manifest.json",
      items: "items.jsonl",
      chunks: "chunks.jsonl",
      failures: "failures.jsonl"
    },
    counts: {
      items: options.records.length,
      chunks: 1,
      failures: failures.length
    },
    hashes: {
      sourceSha256: manifest.source.sourceHash,
      generationSha256: manifest.generation.generationHash,
      accountingSha256: manifest.accounting.accountingHash,
      manifestSha256: options.corruptManifestHash ? "bad-hash" : manifestSha256
    }
  };

  writeFileSync(join(rootDir, "current.json"), JSON.stringify(current, null, 2));
  if (!options.removeManifest) {
    writeFileSync(join(rootDir, "manifest.json"), manifestText);
  }
  writeFileSync(join(rootDir, "items.jsonl"), itemsBody ? `${itemsBody}\n` : "");
  writeFileSync(join(rootDir, "chunks.jsonl"), `${chunksBody}\n`);
  writeFileSync(join(rootDir, "failures.jsonl"), failuresBody ? `${failuresBody}\n` : "");
  return rootDir;
}

describe("KOSHA provenance gate", () => {
  it("fails closed on missing manifest, manifest-hash drift, accounting drift, stale lifecycle, partial stage, and failure ledgers", async () => {
    const cases = [
      {
        id: "missing-manifest",
        rootDir: writeSnapshotFixture({ records: [record()], removeManifest: true }),
        expected: "missing:manifest.json"
      },
      {
        id: "manifest-hash-drift",
        rootDir: writeSnapshotFixture({ records: [record()], corruptManifestHash: true }),
        expected: "hash:manifest"
      },
      {
        id: "accounting-drift",
        rootDir: writeSnapshotFixture({ records: [record()], corruptAccounting: true }),
        expected: "accounting:itemCount"
      },
      {
        id: "stale-lifecycle",
        rootDir: writeSnapshotFixture({ records: [record()], lifecycle: "stale" }),
        expected: "lifecycle:stale"
      },
      {
        id: "partial-stage",
        rootDir: writeSnapshotFixture({ records: [record()], stage: "partial" }),
        expected: "stage:partial"
      },
      {
        id: "failure-ledger",
        rootDir: writeSnapshotFixture({
          records: [record()],
          failures: [{ chunkId: "chunk-1", stage: "body", message: "ocr missing" }]
        }),
        expected: "failures:1"
      }
    ];

    for (const fixture of cases) {
      const loaded = await loadKoshaGuideCorpus({ rootDir: fixture.rootDir });
      expect(loaded.status, fixture.id).toBe("blocked");
      if (loaded.status === "blocked") {
        expect(loaded.failures, fixture.id).toContain(fixture.expected);
      }
    }
  });

  it("keeps OCR/summary/anchorless/retired boundaries review-required and propagates the same page-anchor evidenceRef into TBM links", async () => {
    const accepted = record();
    const anchorless = record({
      referenceId: "anchorless-review",
      stableDocumentKey: "anchorless-review",
      version: "anchorless-review-2026",
      title: "앵커 없는 요약 경계",
      bodyKind: "summary",
      quality: "review_required",
      anchors: [],
      nativeBody: "요약 텍스트만 존재함.",
      tags: {
        keywords: ["요약"],
        riskTags: ["추락"],
        controls: ["요약 통제"],
        primaryDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"]
      }
    });
    const retired = record({
      referenceId: "retired-review",
      stableDocumentKey: "retired-review",
      version: "retired-review-2025",
      title: "퇴역 경계",
      quality: "review_required",
      provenance: {
        sourceId: "kosha-guide-offline",
        generationId: "gen-2026-07-12",
        generatedAt: "2026-07-12T00:00:00.000Z",
        lifecycle: "retired",
        chunkId: "chunk-1",
        bodyHash: sha256Text("작업발판과 난간 상태를 확인하고, 지게차 보행 동선을 분리한다.")
      }
    });
    const ocrBoundary = record({
      referenceId: "ocr-review",
      stableDocumentKey: "ocr-review",
      version: "ocr-review-2026",
      title: "OCR 경계",
      bodyKind: "ocr",
      quality: "review_required"
    });
    const rootDir = writeSnapshotFixture({ records: [accepted, anchorless, retired, ocrBoundary] });

    const search = await searchSafetyReferences({
      query: "외벽 도장 작업발판 지게차 동선",
      limit: 6,
      offlineCorpus: { rootDir }
    });
    const response = buildMockAskResponse("외벽 도장 작업", mockSearchResults, "mock", "테스트");
    const rows = buildSafetyReferenceRiskRows(response, search.items, "오후 강풍 예보", "외벽 도장 작업발판 지게차 동선");
    const links = buildTbmRiskLinks(rows, "오후 강풍 예보");

    expect(search.items.map((item) => item.id)).toEqual(expect.arrayContaining([
      "D-C-13-2026",
      "ocr-review",
      "retired-review"
    ]));
    const anchoredRows = rows.filter((row) => row.evidenceRefs.some((ref) => ref.includes("D-C-13-2026")));
    expect(anchoredRows).toHaveLength(1);
    expect(anchoredRows[0]?.evidenceRefs).toHaveLength(1);
    expect(anchoredRows[0]?.evidenceRefs[0]).toContain("D-C-13-2026");
    expect(anchoredRows[0]?.evidenceRefs[0]).toContain("p.4");
    expect(anchoredRows[0]?.evidenceRefs[0]).toContain("작업발판과 난간 상태를 확인한다.");
    expect(anchoredRows[0]?.evidenceRefs).not.toEqual(expect.arrayContaining([
      expect.stringContaining("anchorless-review"),
      expect.stringContaining("ocr-review"),
      expect.stringContaining("retired-review")
    ]));
    const anchoredLink = links.find((link) => link.evidenceRefs.some((ref) => ref.includes("D-C-13-2026")));
    expect(anchoredLink?.evidenceRefs).toEqual(anchoredRows[0]?.evidenceRefs);
  });
});
