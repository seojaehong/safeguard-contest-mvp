import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

type CandidateAuditReport = {
  verdict: string;
  mutationPerformed: boolean;
  dbMutationPerformed: boolean;
  embeddingGenerationPerformed: boolean;
  exactTrustRegistryCurrent: {
    count: number;
    versions: string[];
  };
  verifiedSubsetCurrent: {
    acceptedCount: number;
    chunksCount: number;
    failures: number;
    networkCallsPerformed: boolean;
    provenanceComplete: boolean;
  };
  officialMetadataRegistry: {
    metadataRows: number;
    completeCurrentRows: number;
    metadataVerifiedNotExact: number;
    completeCurrentByCategory: Record<string, number>;
  };
  sampleNextCandidates: Array<{
    stableKey: string;
    version: string;
  }>;
  forbiddenClaims: string[];
};

type CandidateAuditModule = {
  buildKoshaNextExactCandidateAudit: (options: {
    rootDir: string;
    officialMetadata: string;
    bodyCorpusCurrent: string;
    bodyCorpusRoot: string;
    exactKoshaDir: string;
    buildInfo: unknown;
    generatedAt?: string;
  }) => CandidateAuditReport;
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

async function loadCandidateAuditModule(): Promise<CandidateAuditModule> {
  const sourcePath = path.resolve("scripts", "kosha_next_exact_candidate_audit.mjs");
  return await import(pathToFileURL(sourcePath).href) as CandidateAuditModule;
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

function metadata(
  stableKey: string,
  officialVersion: string,
  category: string,
  index: number,
): MetadataRow {
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

function writeFixtureRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kosha-next-candidate-audit-"));
  const metadataRows = [
    metadata("D-C-13", "D-C-13-2026", "D", 1),
    metadata("D-C-7", "D-C-7-2026", "D", 2),
    metadata("B-E-10", "B-E-10-2026", "B", 3),
    metadata("A-G-1", "A-G-1-2025", "A", 4),
    metadata("A-G-10", "A-G-10-2025", "A", 5),
  ];
  writeJsonl(root, "data/safety-knowledge/kosha-official-metadata/official-metadata-2026-07-15.jsonl", metadataRows);

  for (const row of metadataRows.slice(0, 3)) {
    writeJson(root, `data/safety-knowledge/exact-kosha/${row.official_version.toLowerCase()}.json`, {
      version: row.official_version,
      stableDocumentKey: row.stable_key,
      title: `${row.official_version} 기술지원규정`,
      bodySha256: row.body_sha256,
      pdfSha256: row.pdf_sha256,
      officialFileId: row.official_file_id,
      normalizedCharCount: 1234,
    });
  }

  const snapshotPath = "snapshots/test-snapshot";
  writeJson(root, "data/safety-knowledge/kosha-guide-corpus/current.json", {
    schema_version: "safeclaw-kosha-body-current/v1",
    snapshot_id: "test-snapshot",
    snapshot_path: snapshotPath,
  });
  writeJson(root, `${snapshotPath}/manifest.json`.replace(/^/u, "data/safety-knowledge/kosha-guide-corpus/"), {
    schema_version: "safeclaw-kosha-verified-subset/v1",
    snapshot_id: "test-snapshot",
    coverage_scope: {
      scope_id: "technical-support-regulation-current-native",
      source_inventory_count: 1040,
      accepted_count: 5,
      out_of_scope_count: 1035,
      body_kinds: ["native"],
      official_statuses: ["current"],
    },
    counts: { chunks: 7 },
    launch_gate: { provenance_complete: true },
    network_calls_performed: false,
    ocr_performed: false,
    db_mutation_performed: false,
  });
  writeGzipJsonl(root, "data/safety-knowledge/kosha-guide-corpus/snapshots/test-snapshot/items.jsonl.gz", metadataRows);
  writeGzipJsonl(root, "data/safety-knowledge/kosha-guide-corpus/snapshots/test-snapshot/chunks.jsonl.gz", Array.from({ length: 7 }, (_, index) => ({ id: index })));
  writeGzipJsonl(root, "data/safety-knowledge/kosha-guide-corpus/snapshots/test-snapshot/failures.jsonl.gz", []);
  writeJson(root, "build-info.json", {
    commitSha: "abc123",
    branch: "master",
    environment: "production",
  });
  return root;
}

describe("KOSHA next exact candidate audit", () => {
  it("separates exact pins from metadata-verified non-exact candidates", async () => {
    const root = writeFixtureRoot();
    const module = await loadCandidateAuditModule();
    const report = module.buildKoshaNextExactCandidateAudit({
      rootDir: root,
      officialMetadata: "data/safety-knowledge/kosha-official-metadata/official-metadata-2026-07-15.jsonl",
      bodyCorpusCurrent: "data/safety-knowledge/kosha-guide-corpus/current.json",
      bodyCorpusRoot: "data/safety-knowledge/kosha-guide-corpus",
      exactKoshaDir: "data/safety-knowledge/exact-kosha",
      buildInfo: JSON.parse(fs.readFileSync(path.join(root, "build-info.json"), "utf8")) as unknown,
      generatedAt: "2026-07-22T00:00:00.000Z",
    });

    expect(report.verdict).toBe("NEXT_EXACT_TRUST_CANDIDATES_IDENTIFIED_APPROVAL_FREE");
    expect(report.exactTrustRegistryCurrent.versions).toEqual(["B-E-10-2026", "D-C-13-2026", "D-C-7-2026"]);
    expect(report.officialMetadataRegistry.metadataRows).toBe(5);
    expect(report.officialMetadataRegistry.metadataVerifiedNotExact).toBe(2);
    expect(report.officialMetadataRegistry.completeCurrentByCategory).toEqual({ A: 2, B: 1, D: 2 });
    expect(report.verifiedSubsetCurrent.acceptedCount).toBe(5);
    expect(report.verifiedSubsetCurrent.chunksCount).toBe(7);
    expect(report.verifiedSubsetCurrent.failures).toBe(0);
    expect(report.verifiedSubsetCurrent.networkCallsPerformed).toBe(false);
    expect(report.verifiedSubsetCurrent.provenanceComplete).toBe(true);
    expect(report.sampleNextCandidates.map((candidate) => candidate.version)).toEqual(["A-G-1-2025", "A-G-10-2025"]);
    expect(report.forbiddenClaims).toContain("All 1,040 KOSHA Guide rows are exact direct evidence.");
    expect(report.forbiddenClaims).toContain("The metadata-verified non-exact candidates are already exact production evidence.");
    expect(report.mutationPerformed).toBe(false);
    expect(report.dbMutationPerformed).toBe(false);
    expect(report.embeddingGenerationPerformed).toBe(false);
  });

  it("writes the audit report through the CLI without mutating source data", () => {
    const root = writeFixtureRoot();
    const output = "evaluation/kosha-next-exact-candidate-audit-2026-07-22";
    execFileSync("node", [
      path.resolve("scripts", "kosha_next_exact_candidate_audit.mjs"),
      "--root",
      root,
      "--output",
      output,
      "--build-info-file",
      "build-info.json",
      "--generated-at",
      "2026-07-22T00:00:00.000Z",
    ], { encoding: "utf8" });

    const reportPath = path.join(root, output, "report.json");
    const markdownPath = path.join(root, output, "report.md");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as CandidateAuditReport;
    const markdown = fs.readFileSync(markdownPath, "utf8");
    expect(report.exactTrustRegistryCurrent.count).toBe(3);
    expect(report.officialMetadataRegistry.metadataVerifiedNotExact).toBe(2);
    expect(report.mutationPerformed).toBe(false);
    expect(markdown).toContain("These rows are not exact production evidence yet.");
    expect(markdown).toContain("All 1,040 KOSHA Guide rows are exact direct evidence.");
  });
});
