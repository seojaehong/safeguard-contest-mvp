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
  oneRowScope?: boolean;
};

const TRUSTED_METADATA_SHA256 = "e".repeat(64);

const roots: string[] = [];

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

function writeVerifiedSubset(overrides: GateOverrides = {}): string {
  const rootDir = mkdtempSync(join(tmpdir(), "kosha-verified-subset-"));
  roots.push(rootDir);

  const body = "기술지원규정의 검증된 현행 본문";
  const failureCount = overrides.failureCount ?? 0;
  const candidateCount = overrides.oneRowScope ? 1 : 234;
  const acceptedCount = candidateCount - failureCount;
  const items = Array.from({ length: acceptedCount }, (_, index) => {
    const version = index === 0 ? "B-E-10-2026" : `B-E-${1000 + index}-2026`;
    return {
      schema_version: "safeclaw-kosha-body-corpus/v2",
      item_id: `kosha-${version}`,
      item_type: "technical-support-regulation",
      title: `${version} 기술지원규정`,
      category: "전기안전분야",
      body,
      normalized_text_sha256: sha256(body),
      raw_sha256: "b".repeat(64),
      state: "current",
      stable_key: version.replace(/-2026$/u, ""),
      version_key: version,
      source_key: "fixed-v1",
      extraction_status: "success",
      ...(!overrides.omitOfficialProvenance
        ? {
            official_provenance: {
              official_url: "https://portal.kosha.or.kr/archive/resources/tech-support/search/all",
              official_file_id: index === 0 ? "CTC2026012914540778798257" : `TEST-${index}`,
              publication_date: "2026-01-30",
              official_version: version,
              official_status: "current",
              pdf_sha256: "b".repeat(64),
              body_sha256: sha256(body)
            }
          }
        : {})
    };
  });
  const chunks = items.map((item) => ({
    schema_version: "safeclaw-kosha-body-corpus/v2",
    chunk_id: `${item.item_id}:p1`,
    chunk_sha256: sha256(body),
    item_id: item.item_id,
    page_start: 1,
    page_end: 1,
    text: body
  }));
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
  const itemsText = items.length ? `${items.map((row) => JSON.stringify(row)).join("\n")}\n` : "";
  const chunksText = chunks.length ? `${chunks.map((row) => JSON.stringify(row)).join("\n")}\n` : "";
  const failuresText = failures.length ? `${failures.map((row) => JSON.stringify(row)).join("\n")}\n` : "";
  const outputHashes = {
    "items.jsonl": sha256(itemsText),
    "chunks.jsonl": sha256(chunksText),
    "failures.jsonl": sha256(failuresText)
  };
  const generationPolicy = {
    source_snapshot_id: "935340ef3f74078c36168666650164c43511daced84efa3eda849833ad8d6844",
    official_metadata_sha256: TRUSTED_METADATA_SHA256,
    trusted_metadata_registry_sha256: sha256(JSON.stringify([TRUSTED_METADATA_SHA256])),
    generator_source_sha256: "f".repeat(64),
    selection: "technical-support-regulation+current-unverified+success+native"
  };
  const generationPolicySha256 = sha256(canonicalJson(generationPolicy));
  const sourceIdentitySha256 = "d".repeat(64);
  const snapshotId = sha256(canonicalJson({
    generator_source_sha256: generationPolicy.generator_source_sha256,
    generation_policy_sha256: generationPolicySha256,
    official_metadata_sha256: generationPolicy.official_metadata_sha256,
    output_hashes: outputHashes,
    source_identity_sha256: sourceIdentitySha256,
    source_snapshot_id: generationPolicy.source_snapshot_id,
    trusted_metadata_registry_sha256: generationPolicy.trusted_metadata_registry_sha256
  }));
  const snapshotPath = `snapshots/${snapshotId}`;
  const snapshotDir = join(rootDir, snapshotPath);
  mkdirSync(snapshotDir, { recursive: true });
  writeFileSync(join(snapshotDir, "items.jsonl"), itemsText, "utf8");
  writeFileSync(join(snapshotDir, "chunks.jsonl"), chunksText, "utf8");
  writeFileSync(join(snapshotDir, "failures.jsonl"), failuresText, "utf8");

  const launchReady = overrides.launchReady ?? true;
  const partialCoverage = overrides.partialCoverage ?? false;
  const provenanceComplete = overrides.provenanceComplete ?? !overrides.omitOfficialProvenance;
  const manifest = {
    schema_version: "safeclaw-kosha-verified-subset/v1",
    snapshot_id: snapshotId,
    reproducibility_hash: snapshotId,
    generation_policy_sha256: generationPolicySha256,
    generation_policy: generationPolicy,
    source_identity: { identity_sha256: sourceIdentitySha256 },
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
      candidate_count: candidateCount,
      accepted_count: acceptedCount,
      rejected_count: failureCount,
      out_of_scope_count: 1040 - candidateCount,
      item_types: ["technical-support-regulation"],
      official_statuses: ["current"],
      body_kinds: ["native"],
      complete: !partialCoverage
    },
    counts: {
      inventory: candidateCount,
      completed: candidateCount,
      success: acceptedCount,
      failure: failureCount,
      chunks: chunks.length,
      failure_ledger: failureCount
    },
    output_hashes: outputHashes
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
    const result = await loadKoshaGuideCorpus({
      rootDir: writeVerifiedSubset(),
      testHooks: { trustedOfficialMetadataSha256: [TRUSTED_METADATA_SHA256] }
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.coverageScope.scopeId).toBe("technical-support-regulation-current-native");
    expect(result.records).toHaveLength(234);
    expect(result.records[0]?.provenance.officialFileId).toBe("CTC2026012914540778798257");
    expect(isKoshaGuideDirectEvidenceAccepted(result.records[0]!)).toBe(true);
  });

  it("blocks a self-consistent one-row subset outside the pinned fixed-v1 scope", async () => {
    const result = await loadKoshaGuideCorpus({
      rootDir: writeVerifiedSubset({ oneRowScope: true }),
      testHooks: { trustedOfficialMetadataSha256: [TRUSTED_METADATA_SHA256] }
    });
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") expect(result.failures).toContain("gate:scope-contract");
  });

  it("blocks self-attested official metadata that is not in the code-owned trust registry", async () => {
    const result = await loadKoshaGuideCorpus({ rootDir: writeVerifiedSubset() });
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      expect(result.failures).toContain("gate:untrusted-official-metadata");
    }
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
