import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  loadKoshaGuideCorpus,
  searchKoshaGuideCorpus,
  type KoshaGuideCorpusRecord
} from "@/lib/kosha-guide-corpus";
import { searchSafetyReferences } from "@/lib/safety-reference-catalog";

type SnapshotLifecycle = "current" | "stale" | "retired";
type SnapshotStage = "complete" | "partial";

type FixtureChunk = {
  chunkId: string;
  itemIds: string[];
};

type FixtureFailure = {
  chunkId: string;
  stage: string;
  message: string;
};

type FixtureOptions = {
  records: KoshaGuideCorpusRecord[];
  lifecycle?: SnapshotLifecycle;
  stage?: SnapshotStage;
  failures?: FixtureFailure[];
  manifestItemCount?: number;
  currentItemCount?: number;
  currentManifestSha256?: string;
  removeManifest?: boolean;
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

function defaultRecord(overrides: Partial<KoshaGuideCorpusRecord> = {}): KoshaGuideCorpusRecord {
  const nativeBody = overrides.nativeBody || "작업발판과 난간 상태를 확인하고 강풍 시 상부 작업을 중지한다.";
  const base: KoshaGuideCorpusRecord = {
    referenceId: "B-E-17-2026",
    stableDocumentKey: "B-E-17",
    version: "B-E-17-2026",
    itemType: "technical-support-regulation",
    title: "도장 공정에서의 화재·폭발위험방지에 관한 기술지원규정",
    category: "전기안전분야",
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
      keywords: ["도장", "도료", "유기용제", "외벽"],
      riskTags: ["화재", "폭발", "추락"],
      controls: ["작업발판과 난간 상태 확인", "강풍 시 상부 작업 중지"],
      primaryDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"]
    },
    anchors: [{ page: 12, excerpt: "작업발판과 난간 상태를 확인한다." }]
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

function writeSnapshotFixture(options: FixtureOptions): string {
  const rootDir = mkdtempSync(join(tmpdir(), "kosha-offline-harness-"));
  tempDirs.push(rootDir);
  mkdirSync(rootDir, { recursive: true });

  const records = options.records;
  const failures = options.failures || [];
  const chunks: FixtureChunk[] = [
    {
      chunkId: "chunk-1",
      itemIds: records.map((record) => record.referenceId)
    }
  ];
  const itemsBody = records.map((record) => JSON.stringify(record)).join("\n");
  const chunksBody = chunks
    .map((chunk) => JSON.stringify({ ...chunk, itemCount: chunk.itemIds.length }))
    .join("\n");
  const failuresBody = failures.map((failure) => JSON.stringify(failure)).join("\n");
  const itemsSha256 = sha256Text(itemsBody);
  const chunksSha256 = sha256Text(chunksBody);
  const failuresSha256 = sha256Text(failuresBody);

  const manifestSource = {
    sourceId: "kosha-guide-offline",
    snapshotVersion: "v2",
    corpusVersion: "2026-07-12"
  };
  const manifestGeneration = {
    generationId: "gen-2026-07-12",
    generatedAt: "2026-07-12T00:00:00.000Z",
    lifecycle: options.lifecycle || "current",
    stage: options.stage || "complete"
  };
  const manifestAccounting = {
    itemCount: options.manifestItemCount ?? records.length,
    chunkCount: chunks.length,
    failureCount: failures.length,
    acceptedCount: records.filter((record) => record.quality === "accepted").length,
    reviewRequiredCount: records.filter((record) => record.quality === "review_required").length
  };
  const manifest = {
    schemaVersion: 2,
    source: {
      ...manifestSource,
      sourceHash: sha256Text(stableStringify(manifestSource))
    },
    generation: {
      ...manifestGeneration,
      generationHash: sha256Text(stableStringify(manifestGeneration))
    },
    accounting: {
      ...manifestAccounting,
      accountingHash: sha256Text(stableStringify(manifestAccounting))
    },
    files: {
      items: { path: "items.jsonl", sha256: itemsSha256, count: records.length },
      chunks: { path: "chunks.jsonl", sha256: chunksSha256, count: chunks.length },
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
      items: options.currentItemCount ?? records.length,
      chunks: chunks.length,
      failures: failures.length
    },
    hashes: {
      sourceSha256: manifest.source.sourceHash,
      generationSha256: manifest.generation.generationHash,
      accountingSha256: manifest.accounting.accountingHash,
      manifestSha256: options.currentManifestSha256 ?? manifestSha256
    }
  };

  writeFileSync(join(rootDir, "current.json"), JSON.stringify(current, null, 2));
  if (!options.removeManifest) {
    writeFileSync(join(rootDir, "manifest.json"), manifestText);
  }
  writeFileSync(join(rootDir, "items.jsonl"), itemsBody ? `${itemsBody}\n` : "");
  writeFileSync(join(rootDir, "chunks.jsonl"), chunksBody ? `${chunksBody}\n` : "");
  writeFileSync(join(rootDir, "failures.jsonl"), failuresBody ? `${failuresBody}\n` : "");
  return rootDir;
}

describe("KOSHA offline harness", () => {
  it("loads a current snapshot, indexes tag/body text, and exposes local-hybrid retrieval without UI scores", async () => {
    const accepted = defaultRecord();
    const reviewRequired = defaultRecord({
      referenceId: "E-G-18-2026-review",
      stableDocumentKey: "E-G-18",
      version: "E-G-18-2026",
      itemType: "technical-support-regulation",
      title: "밀폐공간 작업 프로그램 수립 및 시행에 관한 기술지원규정",
      category: "산업보건일반분야",
      nativeBody: "밀폐공간 진입 전 산소농도 측정과 감시인 배치가 필요하다.",
      bodyKind: "summary",
      quality: "review_required",
      tags: {
        keywords: ["밀폐공간", "산소농도", "감시인"],
        riskTags: ["질식"],
        controls: ["산소농도 측정", "감시인 배치"],
        primaryDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"]
      },
      anchors: []
    });
    const rootDir = writeSnapshotFixture({ records: [accepted, reviewRequired] });

    const corpus = await loadKoshaGuideCorpus({ rootDir });
    expect(corpus.status).toBe("ready");
    if (corpus.status !== "ready") return;

    const local = searchKoshaGuideCorpus(corpus, "외벽 도장 작업발판 강풍", 5);
    expect(local.retrievalMode).toBe("local-hybrid");
    expect(local.items.map((item) => item.referenceId)).toEqual(["B-E-17-2026"]);

    const result = await searchSafetyReferences({
      query: "외벽 도장 작업발판 강풍",
      limit: 5,
      offlineCorpus: { rootDir }
    });

    expect(result.ok).toBe(true);
    expect(result.retrievalMode).toBe("local-hybrid");
    expect(result.items.map((item) => item.id)).toEqual(["B-E-17-2026"]);
    expect(result.items[0]?.retrieval_source).toBe("local-hybrid");
    expect("score" in (result.items[0] || {})).toBe(false);
  });

  it("rejects irrelevant local documents even when the snapshot passed integrity", async () => {
    const rootDir = writeSnapshotFixture({
      records: [
        defaultRecord(),
        defaultRecord({
          referenceId: "H-1-2026",
          stableDocumentKey: "H-1",
          version: "H-1-2026",
          title: "특수화학물질 취급 지침",
          category: "산업보건일반분야",
          nativeBody: "MSDS와 특수화학물질 보호구를 확인한다.",
          tags: {
            keywords: ["화학물질", "MSDS"],
            riskTags: ["중독"],
            controls: ["MSDS 확인", "적정 보호구 착용"],
            primaryDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"]
          }
        })
      ]
    });

    const result = await searchSafetyReferences({
      query: "지게차 보행 동선 충돌",
      limit: 5,
      offlineCorpus: { rootDir }
    });

    expect(result.items).toEqual([]);
    expect(result.count).toBe(0);
  });

  it("preserves the unconfigured fallback contract when no snapshot path is supplied", async () => {
    const result = await searchSafetyReferences({
      query: "외벽 도장 작업",
      limit: 3,
      offlineCorpus: { rootDir: null }
    });

    expect(["local-tag", "local-ranked", "local-hybrid"]).not.toContain(result.retrievalMode);
    expect(result.items.every((item) => item.id !== "B-E-17-2026")).toBe(true);
  });
});
