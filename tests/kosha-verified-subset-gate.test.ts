import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  isKoshaGuideDirectEvidenceAccepted,
  loadKoshaGuideCorpus,
  resetKoshaGuideCorpusCacheForTests
} from "@/lib/kosha-guide-corpus";
import { getKoshaGroundingDecision, type SafetyReferenceItem } from "@/lib/safety-reference-catalog";

type GateOverrides = {
  launchReady?: boolean;
  failureCount?: number;
  partialCoverage?: boolean;
  provenanceComplete?: boolean;
  omitOfficialProvenance?: boolean;
};

const roots: string[] = [];

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function writeVerifiedSubset(overrides: GateOverrides = {}): string {
  const rootDir = mkdtempSync(join(tmpdir(), "kosha-verified-subset-"));
  roots.push(rootDir);
  const snapshotId = "a".repeat(64);
  const snapshotPath = `snapshots/${snapshotId}`;
  const snapshotDir = join(rootDir, snapshotPath);
  mkdirSync(snapshotDir, { recursive: true });

  const body = "기술지원규정의 검증된 현행 본문";
  const item = {
    schema_version: "safeclaw-kosha-body-corpus/v2",
    item_id: "kosha-B-E-10-2026",
    item_type: "technical-support-regulation",
    title: "B-E-10-2026 정전전로 기술지원규정",
    category: "전기안전분야",
    body,
    normalized_text_sha256: sha256(body),
    raw_sha256: "b".repeat(64),
    state: "current",
    stable_key: "B-E-10",
    version_key: "B-E-10-2026",
    source_key: "fixed-v1",
    extraction_status: "success",
    ...(!overrides.omitOfficialProvenance
      ? {
          official_provenance: {
            official_url: "https://portal.kosha.or.kr/archive/resources/tech-support/search/all",
            official_file_id: "CTC2026012914540778798257",
            publication_date: "2026-01-30",
            official_version: "B-E-10-2026",
            official_status: "current",
            pdf_sha256: "b".repeat(64),
            body_sha256: sha256(body)
          }
        }
      : {})
  };
  const chunkText = body;
  const chunk = {
    schema_version: "safeclaw-kosha-body-corpus/v2",
    chunk_id: "kosha-B-E-10-2026:p1",
    chunk_sha256: sha256(chunkText),
    item_id: item.item_id,
    page_start: 1,
    page_end: 1,
    text: chunkText
  };
  const failureCount = overrides.failureCount ?? 0;
  const failures = Array.from({ length: failureCount }, (_, index) => ({
    schema_version: "safeclaw-kosha-body-corpus/v2",
    item_id: `rejected-${index}`,
    source_key: "fixed-v1",
    source_zip: null,
    source_member: `rejected-${index}.pdf`,
    error_code: "official-provenance-missing",
    error_type: "subset-rejection",
    message: "Official provenance is incomplete"
  }));
  const itemsText = `${JSON.stringify(item)}\n`;
  const chunksText = `${JSON.stringify(chunk)}\n`;
  const failuresText = failures.length ? `${failures.map((row) => JSON.stringify(row)).join("\n")}\n` : "";
  writeFileSync(join(snapshotDir, "items.jsonl"), itemsText, "utf8");
  writeFileSync(join(snapshotDir, "chunks.jsonl"), chunksText, "utf8");
  writeFileSync(join(snapshotDir, "failures.jsonl"), failuresText, "utf8");

  const launchReady = overrides.launchReady ?? true;
  const partialCoverage = overrides.partialCoverage ?? false;
  const provenanceComplete = overrides.provenanceComplete ?? !overrides.omitOfficialProvenance;
  const manifest = {
    schema_version: "safeclaw-kosha-verified-subset/v1",
    snapshot_id: snapshotId,
    reproducibility_hash: sha256(snapshotId),
    generation_policy_sha256: "c".repeat(64),
    source_identity: { identity_sha256: "d".repeat(64) },
    launch_gate: {
      launch_ready: launchReady,
      failure_count: failureCount,
      partial_coverage: partialCoverage,
      provenance_complete: provenanceComplete,
      blockers: launchReady ? [] : ["launch-not-ready"]
    },
    coverage_scope: {
      scope_id: "technical-support-regulation-current-native",
      source_inventory_count: 1040,
      candidate_count: 1 + failureCount,
      accepted_count: 1,
      rejected_count: failureCount,
      out_of_scope_count: 1039 - failureCount,
      item_types: ["technical-support-regulation"],
      official_statuses: ["current"],
      body_kinds: ["native"],
      complete: !partialCoverage
    },
    counts: {
      inventory: 1 + failureCount,
      completed: 1 + failureCount,
      success: 1,
      failure: failureCount,
      chunks: 1,
      failure_ledger: failureCount
    },
    output_hashes: {
      "items.jsonl": sha256(itemsText),
      "chunks.jsonl": sha256(chunksText),
      "failures.jsonl": sha256(failuresText)
    }
  };
  const manifestText = JSON.stringify(manifest);
  writeFileSync(join(snapshotDir, "manifest.json"), manifestText, "utf8");
  writeFileSync(join(rootDir, "current.json"), JSON.stringify({
    schema_version: "safeclaw-kosha-body-current/v1",
    generation_policy_sha256: manifest.generation_policy_sha256,
    manifest: {
      path: `${snapshotPath}/manifest.json`,
      sha256: sha256(manifestText),
      size_bytes: Buffer.byteLength(manifestText)
    },
    reproducibility_hash: manifest.reproducibility_hash,
    snapshot_id: snapshotId,
    snapshot_path: snapshotPath,
    source_identity_sha256: manifest.source_identity.identity_sha256
  }), "utf8");
  return rootDir;
}

afterEach(() => {
  resetKoshaGuideCorpusCacheForTests();
  while (roots.length) {
    const root = roots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

describe("KOSHA verified deployable subset gate", () => {
  const generatedSubsetRoot = join(
    process.cwd(),
    "evaluation",
    "kosha-verified-subset-2026-07-14",
    "subset"
  );

  it.skipIf(!existsSync(generatedSubsetRoot))("blocks the generated zero-proof fixed-v1 subset", async () => {
    const result = await loadKoshaGuideCorpus({ rootDir: generatedSubsetRoot });
    expect(result.status).toBe("blocked");
    expect(result.status === "blocked" && result.failures).toContain("gate:launch-not-ready");
  });

  it.each([
    ["launchReady=false", { launchReady: false }, "gate:launch-not-ready"],
    ["failureCount>0", { failureCount: 1 }, "gate:failures"],
    ["partial coverage", { partialCoverage: true }, "gate:partial-coverage"],
    ["provenance missing", { omitOfficialProvenance: true }, "gate:provenance-incomplete"]
  ])("blocks loader ready when %s", async (_label, overrides, expectedFailure) => {
    const result = await loadKoshaGuideCorpus({ rootDir: writeVerifiedSubset(overrides) });
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") expect(result.failures).toContain(expectedFailure);
  });

  it("loads a complete immutable subset and requires official provenance for eligibility", async () => {
    const result = await loadKoshaGuideCorpus({ rootDir: writeVerifiedSubset() });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.coverageScope.scopeId).toBe("technical-support-regulation-current-native");
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.provenance.officialFileId).toBe("CTC2026012914540778798257");
    expect(isKoshaGuideDirectEvidenceAccepted(result.records[0]!)).toBe(true);
  });

  it("does not make a local row eligible from current state alone", () => {
    const item: SafetyReferenceItem = {
      id: "current-only",
      source_id: "kosha-technical-support-regulations-2025",
      item_type: "technical-support-regulation",
      category: "전기안전분야",
      subcategory: null,
      title: "B-E-10-2026 정전전로 기술지원규정",
      summary: "현행이라고만 표시된 행",
      body: "본문",
      keywords: [],
      risk_tags: [],
      primary_documents: [],
      controls: [],
      kosha_guide: {
        referenceId: "current-only",
        stableDocumentKey: "B-E-10",
        version: "B-E-10-2026",
        quality: "accepted",
        lifecycle: "current",
        bodyKind: "native",
        anchors: [{ page: 1, excerpt: "본문" }],
        evidenceRef: "KOSHA 근거 B-E-10-2026 p.1: 본문",
        directEligible: true
      }
    };

    expect(getKoshaGroundingDecision(item)?.reason).toBe("provenance-unresolved");
  });
});
