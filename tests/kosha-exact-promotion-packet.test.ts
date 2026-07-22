import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

type PromotionPacket = {
  verdict: string;
  mutationPerformed: boolean;
  dbMutationPerformed: boolean;
  embeddingGenerationPerformed: boolean;
  exactPromotionPerformed: boolean;
  candidateCount: number;
  selectionPolicy: {
    selectedStableKeys: string[];
  };
  verifiedSubsetCurrent: {
    acceptedCount: number;
    failures: number;
    provenanceComplete: boolean;
  };
  candidates: Array<{
    stableKey: string;
    version: string;
    title: string;
    bodySha256: string;
    pdfSha256: string;
    reviewRequiredBeforeExactTrust: boolean;
  }>;
  forbiddenClaims: string[];
};

type PromotionPacketModule = {
  buildKoshaExactPromotionPacket: (options: {
    rootDir: string;
    candidateKeys: readonly string[];
    officialMetadata?: string;
    bodyCorpusCurrent?: string;
    bodyCorpusRoot?: string;
    exactKoshaDir?: string;
    buildInfo: unknown;
    generatedAt?: string;
  }) => PromotionPacket;
};

type MetadataRow = {
  stable_key: string;
  official_version: string;
  official_category: string;
  official_status: string;
  official_url: string;
  official_file_id: string;
  official_file_sequence: number;
  publication_date: string;
  body_sha256: string;
  pdf_sha256: string;
};

async function loadPromotionPacketModule(): Promise<PromotionPacketModule> {
  const sourcePath = path.resolve("scripts", "kosha_exact_promotion_packet.mjs");
  return await import(pathToFileURL(sourcePath).href) as PromotionPacketModule;
}

function writeJson(root: string, relativePath: string, value: unknown): void {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonl(root: string, relativePath: string, rows: readonly unknown[]): void {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
}

function writeGzipJsonl(root: string, relativePath: string, rows: readonly unknown[]): void {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const text = rows.length > 0 ? `${rows.map((row) => JSON.stringify(row)).join("\n")}\n` : "";
  fs.writeFileSync(absolutePath, zlib.gzipSync(text));
}

function metadata(stableKey: string, officialVersion: string, category: string, index: number): MetadataRow {
  return {
    stable_key: stableKey,
    official_version: officialVersion,
    official_category: category,
    official_status: "current",
    official_url: `https://portal.kosha.or.kr/openapi/v1/file/down/FILE-${index}/1`,
    official_file_id: `FILE-${index}`,
    official_file_sequence: 1,
    publication_date: "2026-01-30",
    body_sha256: `${index}`.repeat(64).slice(0, 64),
    pdf_sha256: `${index + 1}`.repeat(64).slice(0, 64),
  };
}

function itemFromMetadata(row: MetadataRow): Record<string, unknown> {
  return {
    schema_version: "safeclaw-kosha-body-item/v1",
    stable_key: row.stable_key,
    version_key: row.official_version,
    title: `${row.official_version} ${row.stable_key} sample title`,
    category: row.official_category === "D" ? "건설안전분야" : "sample category",
    item_type: "technical-support-regulation",
    normalized_char_count: 1234,
    page_count: 12,
    official_provenance: {
      body_sha256: row.body_sha256,
      official_file_id: row.official_file_id,
      official_status: row.official_status,
      official_url: row.official_url,
      official_version: row.official_version,
      pdf_sha256: row.pdf_sha256,
      publication_date: row.publication_date,
    },
  };
}

function writeFixtureRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kosha-promotion-packet-"));
  const exactRows = [
    metadata("D-C-13", "D-C-13-2026", "D", 1),
    metadata("D-C-7", "D-C-7-2026", "D", 2),
    metadata("B-E-10", "B-E-10-2026", "B", 3),
  ];
  const candidateRows = [
    metadata("D-C-10", "D-C-10-2026", "D", 4),
    metadata("A-G-15", "A-G-15-2026", "A", 5),
  ];
  const metadataRows = [...exactRows, ...candidateRows];
  writeJsonl(root, "data/safety-knowledge/kosha-official-metadata/official-metadata-2026-07-15.jsonl", metadataRows);

  for (const row of exactRows) {
    writeJson(root, `data/safety-knowledge/exact-kosha/${row.official_version.toLowerCase()}.json`, {
      version: row.official_version,
      stableDocumentKey: row.stable_key,
      title: `${row.official_version} exact pin`,
      bodySha256: row.body_sha256,
      pdfSha256: row.pdf_sha256,
      officialFileId: row.official_file_id,
    });
  }

  const snapshotPath = "snapshots/test-snapshot";
  writeJson(root, "data/safety-knowledge/kosha-guide-corpus/current.json", {
    schema_version: "safeclaw-kosha-body-current/v1",
    snapshot_id: "test-snapshot",
    snapshot_path: snapshotPath,
  });
  writeJson(root, "data/safety-knowledge/kosha-guide-corpus/snapshots/test-snapshot/manifest.json", {
    schema_version: "safeclaw-kosha-verified-subset/v1",
    snapshot_id: "test-snapshot",
    coverage_scope: {
      scope_id: "technical-support-regulation-current-native",
      accepted_count: metadataRows.length,
      body_kinds: ["native"],
      official_statuses: ["current"],
    },
    launch_gate: { provenance_complete: true },
    network_calls_performed: false,
    ocr_performed: false,
    db_mutation_performed: false,
  });
  writeGzipJsonl(root, "data/safety-knowledge/kosha-guide-corpus/snapshots/test-snapshot/items.jsonl.gz", metadataRows.map(itemFromMetadata));
  writeGzipJsonl(root, "data/safety-knowledge/kosha-guide-corpus/snapshots/test-snapshot/chunks.jsonl.gz", Array.from({ length: 9 }, (_, index) => ({ id: index })));
  writeGzipJsonl(root, "data/safety-knowledge/kosha-guide-corpus/snapshots/test-snapshot/failures.jsonl.gz", []);
  writeJson(root, "build-info.json", {
    commitSha: "abc123",
    branch: "master",
    environment: "production",
  });
  return root;
}

describe("KOSHA exact promotion packet", () => {
  it("selects a bounded non-mutating operator review packet from verified candidates", async () => {
    const root = writeFixtureRoot();
    const module = await loadPromotionPacketModule();
    const report = module.buildKoshaExactPromotionPacket({
      rootDir: root,
      candidateKeys: ["D-C-10", "A-G-15"],
      buildInfo: JSON.parse(fs.readFileSync(path.join(root, "build-info.json"), "utf8")) as unknown,
      generatedAt: "2026-07-22T00:00:00.000Z",
    });

    expect(report.verdict).toBe("EXACT_PROMOTION_PACKET_READY_FOR_OPERATOR_REVIEW");
    expect(report.candidateCount).toBe(2);
    expect(report.selectionPolicy.selectedStableKeys).toEqual(["D-C-10", "A-G-15"]);
    expect(report.verifiedSubsetCurrent.acceptedCount).toBe(5);
    expect(report.verifiedSubsetCurrent.failures).toBe(0);
    expect(report.verifiedSubsetCurrent.provenanceComplete).toBe(true);
    expect(report.candidates.map((candidate) => candidate.stableKey)).toEqual(["D-C-10", "A-G-15"]);
    expect(report.candidates.every((candidate) => candidate.reviewRequiredBeforeExactTrust)).toBe(true);
    expect(report.candidates[0].title).toContain("D-C-10-2026");
    expect(report.candidates[0].bodySha256).toHaveLength(64);
    expect(report.candidates[0].pdfSha256).toHaveLength(64);
    expect(report.exactPromotionPerformed).toBe(false);
    expect(report.mutationPerformed).toBe(false);
    expect(report.dbMutationPerformed).toBe(false);
    expect(report.embeddingGenerationPerformed).toBe(false);
    expect(report.forbiddenClaims).toContain("These candidates are already exact production evidence.");
    expect(report.forbiddenClaims).toContain("The exact-kosha registry was expanded by this packet.");
  });

  it("fails closed if a selected candidate is already exact trusted", async () => {
    const root = writeFixtureRoot();
    const module = await loadPromotionPacketModule();

    expect(() => module.buildKoshaExactPromotionPacket({
      rootDir: root,
      candidateKeys: ["D-C-13"],
      buildInfo: {},
      generatedAt: "2026-07-22T00:00:00.000Z",
    })).toThrow(/kosha-promotion-packet-already-exact:D-C-13/u);
  });

  it("writes markdown and JSON without claiming exact promotion", () => {
    const root = writeFixtureRoot();
    const output = "evaluation/kosha-exact-promotion-packet-2026-07-22";
    execFileSync("node", [
      path.resolve("scripts", "kosha_exact_promotion_packet.mjs"),
      "--root",
      root,
      "--output",
      output,
      "--build-info-file",
      "build-info.json",
      "--generated-at",
      "2026-07-22T00:00:00.000Z",
      "--candidate-keys",
      "D-C-10,A-G-15",
    ], { encoding: "utf8" });

    const reportPath = path.join(root, output, "report.json");
    const markdownPath = path.join(root, output, "report.md");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as PromotionPacket;
    const markdown = fs.readFileSync(markdownPath, "utf8");
    expect(report.candidateCount).toBe(2);
    expect(report.exactPromotionPerformed).toBe(false);
    expect(markdown).toContain("Exact promotion performed: `false`");
    expect(markdown).toContain("D-C-10-2026");
    expect(markdown).toContain("These candidates are already exact production evidence.");
  });
});
