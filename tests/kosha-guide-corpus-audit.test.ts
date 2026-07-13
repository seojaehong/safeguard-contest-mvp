import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  KOSHA_AUDIT_REQUEST_RETRIES,
  KOSHA_AUDIT_REQUEST_TIMEOUT_MS,
  KOSHA_GUIDE_REFRESH_PLAN,
  auditKoshaGuideRows,
  auditKoshaRetrievalScenario,
  buildKoshaArchiveInventory,
  buildKoshaProductionLocalBridgeCandidate,
  buildKoshaOfficialDownloadUrl,
  compareKoshaInventoryToOfficial,
  decodeKoshaArchiveEntryName,
  fetchHeadersWithRetry,
  fetchKoshaJsonWithRetry,
  listKoshaManifestGateFailures,
  normalizeKoshaVersionCode,
  reconcileKoshaVisibleSnapshots,
  summarizeKoshaAuditChecks,
  summarizeKoshaVisibleStatus,
  toKoshaOfficialGuideRecord,
  toKoshaStableDocumentKey,
  type KoshaArchiveEntry,
  type KoshaGuideAuditManifest,
  type KoshaOfficialGuideRecord,
  type KoshaProductionLocalBridgeInput
} from "@/lib/kosha-guide-corpus-audit";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";

afterEach(() => {
  vi.useRealTimers();
});

function reference(overrides: Partial<SafetyReferenceItem> = {}): SafetyReferenceItem {
  return {
    id: "technical-support-09-0009-b-e-17",
    source_id: "kosha-technical-support-regulations-2025",
    item_type: "technical-support-regulation",
    category: "전기안전분야",
    subcategory: "기술지원규정",
    title: "B-E-17-2026 도장 공정에서의 화재·폭발위험방지에 관한 기술지원규정",
    summary: "도료와 유기용제 증기가 체류하는 도장 공정의 화재·폭발 방지 기준",
    body: "도장 공정의 환기, 방폭 전기기기, 점화원 통제 기준",
    keywords: ["도장", "도료", "유기용제"],
    risk_tags: ["화재", "폭발"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["가동부 방호덮개 설치", "정비 전 전원 차단 및 잠금표지"],
    source_url: "https://portal.kosha.or.kr/openapi/v1/file/down/paint/1",
    evidence_role: "direct",
    retrieval_source: "rest",
    ...overrides
  };
}

function runKoshaAuditScript(arguments_: string[]) {
  return spawnSync(process.execPath, ["scripts/audit_kosha_guides.mjs", ...arguments_], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function archiveEntry(overrides: Partial<KoshaArchiveEntry> = {}): KoshaArchiveEntry {
  return {
    zipFile: "[2025] 기술지원규정(전기안전분야).zip",
    internalPath: "B-E-17-2026 도장 공정에서의 화재·폭발위험방지에 관한 기술지원규정.pdf",
    crc32: "3556073921",
    compressedSize: 400_000,
    fileSize: 438_739,
    itemType: "technical-support-regulation",
    ...overrides
  };
}

function official(overrides: Partial<KoshaOfficialGuideRecord> = {}): KoshaOfficialGuideRecord {
  return {
    code: "B-E-17-2026",
    stableKey: "B-E-17",
    title: "도장 공정에서의 화재·폭발위험방지에 관한 기술지원규정",
    category: "B",
    field: "BE",
    status: "개정",
    publishedAt: "2026-01-30",
    fileId: "CTC2026012913400018064273",
    fileSeq: 1,
    ...overrides
  };
}

describe("KOSHA GUIDE identity", () => {
  it("recovers CP949 archive names even when the ZIP UTF-8 flag is wrong", () => {
    const rawName = Buffer.from(
      "442d432d31332d3230323620bfdcbaaeb5b5c0e5bab8bcf6b0f8bbe7bfa120bec8c0fcc0dbbef7bfa120b0fcc7d120b1e2bcfac1f6bff8b1d4c1a42e706466",
      "hex"
    );

    expect(decodeKoshaArchiveEntryName(rawName)).toBe(
      "D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정.pdf"
    );
  });

  it("normalizes version codes without confusing formatting with stale content", () => {
    expect(normalizeKoshaVersionCode("C-05-2016 건설공사 돌관작업 지침.pdf")).toBe("C-5-2016");
    expect(normalizeKoshaVersionCode("D-27- 2021 수소 저장설비 지침.pdf")).toBe("D-27-2021");
    expect(normalizeKoshaVersionCode("B-M-07-2025 지게차 지침.pdf")).toBe("B-M-7-2025");
    expect(normalizeKoshaVersionCode("규정번호 없음.pdf")).toBeNull();
  });

  it("derives a version-independent stable document key", () => {
    expect(toKoshaStableDocumentKey("B-M-07-2025")).toBe("B-M-7");
    expect(toKoshaStableDocumentKey("W-14-2022_경고표지 작성 지침.pdf")).toBe("W-14");
    expect(toKoshaStableDocumentKey("D-27- 2021 수소 저장설비 지침.pdf")).toBe("D-27");
    expect(toKoshaStableDocumentKey("규정번호 없음")).toBeNull();
  });
});

describe("KOSHA GUIDE production/local bridge", () => {
  const snapshotId = "a".repeat(64);
  const rawSha256 = "e".repeat(64);
  const itemBody = "검토 전 로컬 본문";
  const itemSha256 = sha256(itemBody);
  const firstChunkText = "첫 번째 청크";
  const secondChunkText = "두 번째 청크";
  const tuple = {
    zipFile: "[2025] technical.zip",
    internalPath: "B-E-3-2025 exact.pdf"
  };

  function reviewedCandidate(reviewState: "draft" | "verified" = "verified"): Record<string, unknown> {
    const immutableContent = {
      source: { item_id: "local-1", raw_sha256: rawSha256 }
    };
    const contentSha256 = sha256(JSON.stringify(immutableContent));
    return {
      ...immutableContent,
      review: reviewState === "verified"
        ? {
            state: "verified",
            human_confirmed: true,
            content_sha256: contentSha256
          }
        : {
            state: "draft",
            human_confirmed: false,
            reviewed_by: null,
            reviewed_at: null
          }
    };
  }

  function bridgeInput(): KoshaProductionLocalBridgeInput {
    return {
      productionRows: [{
        id: "production-1",
        source_id: "kosha-production",
        title: "A title that is never used for matching",
        payload: tuple
      }],
      localItems: [{
        item_id: "local-1",
        source_zip: tuple.zipFile,
        source_member: tuple.internalPath,
        raw_sha256: rawSha256,
        normalized_text_sha256: itemSha256,
        body: itemBody
      }],
      localChunks: [
        {
          chunk_id: "chunk-2",
          chunk_sha256: sha256(secondChunkText),
          item_id: "local-1",
          source_zip: tuple.zipFile,
          source_member: tuple.internalPath,
          page_start: 3,
          page_end: 4,
          text: secondChunkText
        },
        {
          chunk_id: "chunk-1",
          chunk_sha256: sha256(firstChunkText),
          item_id: "local-1",
          source_zip: tuple.zipFile,
          source_member: tuple.internalPath,
          page_start: 1,
          page_end: 2,
          text: firstChunkText
        }
      ],
      reviewedCandidates: [reviewedCandidate()],
      snapshot: {
        currentSnapshotId: snapshotId,
        currentReproducibilityHash: snapshotId,
        manifestSnapshotId: snapshotId,
        manifestReproducibilityHash: snapshotId,
        currentManifestSha256: "b".repeat(64),
        manifestFileSha256: "b".repeat(64),
        manifestItemsSha256: "c".repeat(64),
        itemsFileSha256: "c".repeat(64),
        manifestChunksSha256: "d".repeat(64),
        chunksFileSha256: "d".repeat(64)
      }
    };
  }

  it("builds a pending read-only candidate from an exact provenance tuple", () => {
    const candidate = buildKoshaProductionLocalBridgeCandidate(bridgeInput());
    const expectedContentSha256 = sha256(JSON.stringify({
      source: { item_id: "local-1", raw_sha256: rawSha256 }
    }));

    expect(candidate).toEqual({
      schemaVersion: "safeclaw-kosha-production-local-bridge-candidate/v1",
      production: {
        id: "production-1",
        sourceId: "kosha-production",
        tuple
      },
      local: {
        snapshotId,
        itemId: "local-1",
        rawSha256,
        itemSha256
      },
      reviewedCandidateContentSha256: expectedContentSha256,
      chunks: [
        { chunkId: "chunk-1", sha256: sha256(firstChunkText), pageStart: 1, pageEnd: 2 },
        { chunkId: "chunk-2", sha256: sha256(secondChunkText), pageStart: 3, pageEnd: 4 }
      ],
      humanConfirmation: "pending",
      readOnly: true,
      dbMutationPerformed: false,
      launchReadiness: false
    });
  });

  it("records a deterministic content hash for the current draft without accepting it", () => {
    const input = bridgeInput();
    input.reviewedCandidates = [reviewedCandidate("draft")];

    const candidate = buildKoshaProductionLocalBridgeCandidate(input);

    expect(candidate.reviewedCandidateContentSha256).toBe(sha256(JSON.stringify({
      source: { item_id: "local-1", raw_sha256: rawSha256 }
    })));
    expect(candidate.humanConfirmation).toBe("pending");
    expect(candidate.launchReadiness).toBe(false);
    expect(candidate.dbMutationPerformed).toBe(false);
  });

  it.each([
    ["currentReproducibilityHash", "kosha-bridge-snapshot-id-mismatch"],
    ["manifestSnapshotId", "kosha-bridge-snapshot-id-mismatch"],
    ["manifestReproducibilityHash", "kosha-bridge-snapshot-id-mismatch"],
    ["manifestFileSha256", "kosha-bridge-manifest-hash-mismatch"],
    ["itemsFileSha256", "kosha-bridge-items-hash-mismatch"],
    ["chunksFileSha256", "kosha-bridge-chunks-hash-mismatch"]
  ] as Array<[keyof KoshaProductionLocalBridgeInput["snapshot"], string]>) (
    "fails closed when snapshot integrity field %s drifts",
    (field, expectedError) => {
      const input = bridgeInput();
      input.snapshot[field] = "9".repeat(64);

      expect(() => buildKoshaProductionLocalBridgeCandidate(input)).toThrow(expectedError);
    }
  );

  it.each([0, 2])("rejects %i production tuple matches", (count) => {
    const input = bridgeInput();
    input.productionRows = Array.from({ length: count }, () => input.productionRows[0]);

    expect(() => buildKoshaProductionLocalBridgeCandidate(input)).toThrow(
      `kosha-bridge-production-match-count:${count}`
    );
  });

  it("rejects a missing production tuple", () => {
    const input = bridgeInput();
    input.productionRows = [{ id: "production-1", source_id: "kosha-production", payload: {
      zipFile: tuple.zipFile
    } }];

    expect(() => buildKoshaProductionLocalBridgeCandidate(input)).toThrow(
      "kosha-bridge-production-tuple-missing"
    );
  });

  it("never falls back to a matching title when the provenance tuple differs", () => {
    const input = bridgeInput();
    input.localItems = [{
      ...(input.localItems[0] as Record<string, unknown>),
      title: "A title that is never used for matching",
      source_member: "different.pdf"
    }];

    expect(() => buildKoshaProductionLocalBridgeCandidate(input)).toThrow(
      "kosha-bridge-local-match-count:0"
    );
  });

  it("does not trim or normalize either side of the provenance tuple", () => {
    const input = bridgeInput();
    input.productionRows = [{
      ...(input.productionRows[0] as Record<string, unknown>),
      payload: { ...tuple, internalPath: `${tuple.internalPath} ` }
    }];

    expect(() => buildKoshaProductionLocalBridgeCandidate(input)).toThrow(
      "kosha-bridge-local-match-count:0"
    );
  });

  it("rejects multiple exact local tuple matches", () => {
    const input = bridgeInput();
    input.localItems.push({ ...(input.localItems[0] as Record<string, unknown>), item_id: "local-2" });

    expect(() => buildKoshaProductionLocalBridgeCandidate(input)).toThrow(
      "kosha-bridge-local-match-count:2"
    );
  });

  it.each([
    ["raw_sha256", "kosha-bridge-local-raw-hash-invalid"],
    ["normalized_text_sha256", "kosha-bridge-local-item-hash-invalid"]
  ])("rejects an invalid local %s", (field, expectedError) => {
    const input = bridgeInput();
    (input.localItems[0] as Record<string, unknown>)[field] = "not-a-sha256";

    expect(() => buildKoshaProductionLocalBridgeCandidate(input)).toThrow(expectedError);
  });

  it("rejects a local item content hash mismatch", () => {
    const input = bridgeInput();
    (input.localItems[0] as Record<string, unknown>).body = "변조된 본문";

    expect(() => buildKoshaProductionLocalBridgeCandidate(input)).toThrow(
      "kosha-bridge-local-item-hash-mismatch"
    );
  });

  it("rejects a reviewed candidate bound to a different raw source hash", () => {
    const input = bridgeInput();
    const reviewedCandidate = input.reviewedCandidates?.[0] as Record<string, unknown>;
    (reviewedCandidate.source as Record<string, unknown>).raw_sha256 = "9".repeat(64);

    expect(() => buildKoshaProductionLocalBridgeCandidate(input)).toThrow(
      "kosha-bridge-reviewed-candidate-raw-hash-mismatch"
    );
  });

  it("rejects multiple reviewed candidates for one exact local item", () => {
    const input = bridgeInput();
    input.reviewedCandidates?.push(input.reviewedCandidates[0]);

    expect(() => buildKoshaProductionLocalBridgeCandidate(input)).toThrow(
      "kosha-bridge-reviewed-candidate-match-count:2"
    );
  });

  it("rejects a verified candidate without a valid content hash", () => {
    const input = bridgeInput();
    const reviewedCandidate = input.reviewedCandidates?.[0] as Record<string, unknown>;
    (reviewedCandidate.review as Record<string, unknown>).content_sha256 = "invalid";

    expect(() => buildKoshaProductionLocalBridgeCandidate(input)).toThrow(
      "kosha-bridge-reviewed-candidate-content-hash-invalid"
    );
  });

  it("rejects a verified candidate whose declared content hash does not match its bytes", () => {
    const input = bridgeInput();
    const reviewed = input.reviewedCandidates?.[0] as Record<string, unknown>;
    (reviewed.review as Record<string, unknown>).content_sha256 = "1".repeat(64);

    expect(() => buildKoshaProductionLocalBridgeCandidate(input)).toThrow(
      "kosha-bridge-reviewed-candidate-content-hash-mismatch"
    );
  });

  it("rejects missing production identity fields", () => {
    const input = bridgeInput();
    input.productionRows = [{ source_id: "", payload: tuple }];

    expect(() => buildKoshaProductionLocalBridgeCandidate(input)).toThrow(
      "kosha-bridge-production-identity-missing"
    );
  });

  it.each([
    ["hash", { chunk_sha256: "invalid" }, "kosha-bridge-chunk-hash-invalid:chunk-2"],
    ["tuple", { source_member: "different.pdf" }, "kosha-bridge-chunk-tuple-mismatch:chunk-2"],
    ["page range", { page_start: 0 }, "kosha-bridge-chunk-page-range-invalid:chunk-2"],
    ["id", { chunk_id: "" }, "kosha-bridge-chunk-id-missing"]
  ])("rejects a local chunk with invalid %s", (_label, override, expectedError) => {
    const input = bridgeInput();
    input.localChunks[0] = {
      ...(input.localChunks[0] as Record<string, unknown>),
      ...override
    };

    expect(() => buildKoshaProductionLocalBridgeCandidate(input)).toThrow(expectedError);
  });

  it("rejects duplicate chunk IDs for the matched local item", () => {
    const input = bridgeInput();
    (input.localChunks[0] as Record<string, unknown>).chunk_id = "chunk-1";

    expect(() => buildKoshaProductionLocalBridgeCandidate(input)).toThrow(
      "kosha-bridge-duplicate-chunk-id:chunk-1"
    );
  });

  it("rejects a local chunk content hash mismatch", () => {
    const input = bridgeInput();
    (input.localChunks[0] as Record<string, unknown>).text = "변조된 청크";

    expect(() => buildKoshaProductionLocalBridgeCandidate(input)).toThrow(
      "kosha-bridge-chunk-content-hash-mismatch:chunk-2"
    );
  });

  it("rejects an exact-tuple chunk bound to a different local item", () => {
    const input = bridgeInput();
    input.localChunks.push({
      ...(input.localChunks[0] as Record<string, unknown>),
      chunk_id: "misbound-chunk",
      item_id: "different-item"
    });

    expect(() => buildKoshaProductionLocalBridgeCandidate(input)).toThrow(
      "kosha-bridge-chunk-item-mismatch:misbound-chunk"
    );
  });

  it("rejects a duplicate chunk ID carried by a different item and tuple", () => {
    const input = bridgeInput();
    input.localChunks.push({
      ...(input.localChunks[0] as Record<string, unknown>),
      item_id: "different-item",
      source_zip: "unrelated.zip",
      source_member: "unrelated.pdf"
    });

    expect(() => buildKoshaProductionLocalBridgeCandidate(input)).toThrow(
      "kosha-bridge-duplicate-chunk-id:chunk-2"
    );
  });
});

describe("KOSHA GUIDE read-only runner contract", () => {
  it("documents the dedicated reviewed-candidate root and rejected path forms", () => {
    const result = runKoshaAuditScript(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--reviewed-candidate <relative-path>");
    expect(result.stdout).toContain("<local-corpus-root>/reviewed-ocr-candidates");
    expect(result.stdout).toContain("absolute paths, parent traversal, and symlink escapes are rejected");
  });

  it("rejects an absolute reviewed-candidate path before corpus or network reads", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "kosha-bridge-candidate-absolute-"));
    const corpusRoot = join(fixtureRoot, "corpus");
    const outsideCandidate = join(fixtureRoot, "outside-candidate.json");
    mkdirSync(corpusRoot, { recursive: true });
    writeFileSync(outsideCandidate, "{}", "utf8");

    try {
      const result = runKoshaAuditScript([
        "--bridge-only",
        "--local-corpus-root",
        corpusRoot,
        "--bridge-zip-file",
        "fixture.zip",
        "--bridge-internal-path",
        "fixture.pdf",
        "--reviewed-candidate",
        outsideCandidate,
        "--output-dir",
        join(fixtureRoot, "output")
      ]);

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain(
        "kosha-bridge-reviewed-candidate-absolute-path"
      );
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }, 40_000);

  it("rejects parent traversal in a reviewed-candidate path", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "kosha-bridge-candidate-traversal-"));
    const corpusRoot = join(fixtureRoot, "corpus");
    mkdirSync(corpusRoot, { recursive: true });

    try {
      const result = runKoshaAuditScript([
        "--bridge-only",
        "--local-corpus-root",
        corpusRoot,
        "--bridge-zip-file",
        "fixture.zip",
        "--bridge-internal-path",
        "fixture.pdf",
        "--reviewed-candidate",
        "../outside-candidate.json",
        "--output-dir",
        join(fixtureRoot, "output")
      ]);

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain(
        "kosha-bridge-reviewed-candidate-parent-traversal"
      );
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }, 40_000);

  it("rejects a reviewed-candidate symlink escape from its approved root", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "kosha-bridge-candidate-symlink-"));
    const corpusRoot = join(fixtureRoot, "corpus");
    const approvedRoot = join(corpusRoot, "reviewed-ocr-candidates");
    const outsideRoot = join(fixtureRoot, "outside");
    mkdirSync(approvedRoot, { recursive: true });
    mkdirSync(outsideRoot, { recursive: true });
    writeFileSync(join(outsideRoot, "candidate.json"), "{}", "utf8");
    symlinkSync(outsideRoot, join(approvedRoot, "escape"), "junction");

    try {
      const result = runKoshaAuditScript([
        "--bridge-only",
        "--local-corpus-root",
        corpusRoot,
        "--bridge-zip-file",
        "fixture.zip",
        "--bridge-internal-path",
        "fixture.pdf",
        "--reviewed-candidate",
        "escape/candidate.json",
        "--output-dir",
        join(fixtureRoot, "output")
      ]);

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain(
        "kosha-bridge-path-outside-root:reviewed-candidate"
      );
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }, 40_000);

  it("rejects a reviewed-candidate path that is not a regular file", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "kosha-bridge-candidate-file-"));
    const corpusRoot = join(fixtureRoot, "corpus");
    mkdirSync(join(corpusRoot, "reviewed-ocr-candidates", "candidate-dir"), { recursive: true });

    try {
      const result = runKoshaAuditScript([
        "--bridge-only",
        "--local-corpus-root",
        corpusRoot,
        "--bridge-zip-file",
        "fixture.zip",
        "--bridge-internal-path",
        "fixture.pdf",
        "--reviewed-candidate",
        "candidate-dir",
        "--output-dir",
        join(fixtureRoot, "output")
      ]);

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain(
        "kosha-bridge-reviewed-candidate-not-regular-file"
      );
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }, 40_000);

  it("rejects a traversal snapshot pointer before reading outside the corpus root", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "kosha-bridge-traversal-"));
    const corpusRoot = join(fixtureRoot, "corpus");
    const outsideRoot = join(fixtureRoot, "outside");
    mkdirSync(corpusRoot, { recursive: true });
    mkdirSync(outsideRoot, { recursive: true });
    writeFileSync(join(outsideRoot, "manifest.json"), "EXTERNAL_FILE_MUST_NOT_BE_READ", "utf8");
    writeFileSync(join(corpusRoot, "current.json"), JSON.stringify({
      snapshot_id: "../../outside",
      snapshot_path: "snapshots/../../outside",
      reproducibility_hash: "../../outside",
      manifest: {
        path: "snapshots/../../outside/manifest.json",
        sha256: "0".repeat(64),
        size_bytes: 30
      }
    }), "utf8");

    try {
      const result = spawnSync(process.execPath, [
        "scripts/audit_kosha_guides.mjs",
        "--bridge-only",
        "--local-corpus-root",
        corpusRoot,
        "--bridge-zip-file",
        "fixture.zip",
        "--bridge-internal-path",
        "fixture.pdf",
        "--output-dir",
        join(fixtureRoot, "output")
      ], {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 30_000,
        windowsHide: true
      });
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status).not.toBe(0);
      expect(output).toContain("kosha-bridge-current-snapshot-id-invalid");
      expect(output).not.toContain("EXTERNAL_FILE_MUST_NOT_BE_READ");
      expect(output).not.toContain("Unexpected token");
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }, 40_000);

  it("keeps production/local bridge artifacts free of machine paths and secret values", () => {
    const artifactRoot = resolve(
      process.cwd(),
      "evaluation/kosha-production-local-bridge-2026-07-13"
    );
    const artifacts = ["report.json", "report.md", "audit.log"]
      .map((fileName) => readFileSync(join(artifactRoot, fileName), "utf8"))
      .join("\n");
    const secretEnvironmentKeys = [
      "SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "OPENAI_API_KEY"
    ];

    expect(artifacts).not.toMatch(/[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/]/u);
    expect(artifacts).not.toMatch(/\b(?:sb_secret_|sk-(?:proj-)?)[A-Za-z0-9_-]{16,}\b/u);
    expect(artifacts).not.toMatch(/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/u);
    for (const key of secretEnvironmentKeys) {
      const value = process.env[key];
      if (value && value.length >= 8) expect(artifacts).not.toContain(value);
    }
  });

  it("selects provenance payload without requesting a non-schema item URL column or mutation method", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/audit_kosha_guides.mjs"), "utf8");
    const fieldSelection = script.match(/const fields = \[([\s\S]+?)\]\.join\(","\);/u)?.[1] || "";

    expect(fieldSelection).toContain('"payload"');
    expect(fieldSelection).not.toContain('"source_url"');
    expect(script).not.toMatch(/method:\s*"(?:PATCH|PUT|DELETE)"/u);
    expect(script).toContain("fetchKoshaJsonWithRetry");
    expect(script).not.toMatch(/\.json\(\)/u);
    expect(script).toContain('id: "local-pdf-empty-output"');
    expect(script).toContain('localParse: {');
    expect(script).toContain('parseEmptyOutputCount');
  });

  it("keeps the production/local bridge bounded to exact-tuple GET reads", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/audit_kosha_guides.mjs"), "utf8");
    const bridgeStart = script.indexOf("async function fetchProductionBridgeRows");
    const bridgeEnd = script.indexOf("function formatBridgeMarkdown", bridgeStart);
    const bridgeFetch = bridgeStart >= 0 && bridgeEnd > bridgeStart
      ? script.slice(bridgeStart, bridgeEnd)
      : "";

    expect(script).toContain('"--bridge-only"');
    expect(script).toContain('"--local-corpus-root"');
    expect(script).toContain('"--bridge-zip-file"');
    expect(script).toContain('"--bridge-internal-path"');
    expect(script).toContain('"--reviewed-candidate"');
    expect(bridgeFetch).toContain('"payload->>zipFile"');
    expect(bridgeFetch).toContain('"payload->>internalPath"');
    expect(bridgeFetch).not.toContain("title.ilike");
    expect(bridgeFetch).not.toMatch(/method:\s*"(?:POST|PATCH|PUT|DELETE)"/u);
    expect(script).toContain("buildKoshaProductionLocalBridgeCandidate");
    expect(script).toContain('humanConfirmation: "pending"');
    expect(script).toContain("dbMutationPerformed: false");
  });

  it("derives Markdown readiness from the JSON conclusion and avoids machine-specific defaults", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/audit_kosha_guides.mjs"), "utf8");

    expect(script).toContain("${report.launchReadiness.conclusion}");
    expect(script).not.toContain("**NOT launch-ready for authoritative KOSHA-guide grounding.**");
    expect(script).not.toMatch(/C:\\\\Users\\\\[^\\]+\\\\Downloads/u);
    expect(script).not.toContain("logPath,\n      manifestCandidatePath");
    expect(script).not.toContain("count/hash parity proves snapshot identity only");
    expect(script).toContain("deployment/project identity remains unproven");
  });

  it("keeps secondary heuristic candidates as boundaries instead of contamination pass or fail claims", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/audit_kosha_guides.mjs"), "utf8");

    expect(script).toContain('id: "raw-control-secondary-heuristic"');
    expect(script).toContain('id: "operational-control-secondary-heuristic"');
    expect(script).not.toContain('id: "raw-control-contamination"');
    expect(script).not.toContain('id: "operational-control-contamination"');
  });

  it("keeps retained snapshots historical without claiming live deployment identity or row successes", () => {
    const retainedJson = JSON.parse(readFileSync(
      resolve(process.cwd(), "evaluation/2026-07-10-kosha-guide-supabase-audit-report.json"),
      "utf8"
    )) as Record<string, unknown>;
    const retainedMarkdown = readFileSync(
      resolve(process.cwd(), "evaluation/2026-07-10-kosha-guide-supabase-embedding-audit.md"),
      "utf8"
    );

    expect(retainedJson).toMatchObject({
      item_count: 1040,
      rows_returned: 1040,
      success_count: null,
      failure_count: null,
      snapshot_scope: "env-configured-supabase-snapshot",
      deployment_identity_proven: false
    });
    expect(retainedMarkdown).toContain("env-configured Supabase snapshot");
    expect(retainedMarkdown).toContain("deployment identity는 증명하지 않는다");
    expect(`${JSON.stringify(retainedJson)}\n${retainedMarkdown}`).not.toMatch(/\blive Supabase\b/iu);
    expect(retainedMarkdown).not.toContain("success_count=1040");
  });
});

describe("KOSHA GUIDE bounded JSON fetch", () => {
  it("keeps the audit network defaults at 20 seconds and one retry", () => {
    expect(KOSHA_AUDIT_REQUEST_TIMEOUT_MS).toBe(20_000);
    expect(KOSHA_AUDIT_REQUEST_RETRIES).toBe(1);
  });

  it("aborts a fetch stalled before headers, retries once, and leaves no timer behind", async () => {
    vi.useFakeTimers();
    let attempts = 0;
    let aborts = 0;
    const promise = fetchKoshaJsonWithRetry("https://example.invalid/no-headers", {}, "stalled headers", {
      timeoutMs: 20,
      retries: 1,
      fetchImpl: async (_input, init) => {
        attempts += 1;
        const signal = init?.signal;
        if (!signal) throw new Error("missing abort signal");
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            aborts += 1;
            reject(new DOMException("Aborted", "AbortError"));
          }, { once: true });
        });
      }
    });
    const rejection = expect(promise).rejects.toThrow(/stalled headers.*2 attempts/iu);

    await vi.runAllTimersAsync();
    await rejection;

    expect(attempts).toBe(2);
    expect(aborts).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts stalled body consumption on every attempt and leaves no timer behind", async () => {
    vi.useFakeTimers();
    let attempts = 0;
    let aborts = 0;
    const promise = fetchKoshaJsonWithRetry("https://example.invalid/stalled", {}, "stalled body", {
      timeoutMs: 20,
      retries: 1,
      fetchImpl: async (_input, init) => {
        attempts += 1;
        const signal = init?.signal;
        if (!signal) throw new Error("missing abort signal");
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => {
              aborts += 1;
              reject(new DOMException("Aborted", "AbortError"));
            }, { once: true });
          })
        };
      }
    });
    const rejection = expect(promise).rejects.toThrow(/stalled body.*2 attempts/iu);

    await vi.runAllTimersAsync();
    await rejection;

    expect(attempts).toBe(2);
    expect(aborts).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retries a rejected JSON body once and clears the successful attempt timer", async () => {
    vi.useFakeTimers();
    let attempts = 0;

    const result = await fetchKoshaJsonWithRetry("https://example.invalid/retry", {}, "failed body", {
      timeoutMs: 20_000,
      retries: 1,
      fetchImpl: async () => {
        attempts += 1;
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => {
            if (attempts === 1) throw new Error("body failed");
            return { ok: true };
          }
        };
      }
    });

    expect(result.payload).toEqual({ ok: true });
    expect(result.attemptCount).toBe(2);
    expect(attempts).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("KOSHA GUIDE bounded HEAD fetch", () => {
  it("retries one HEAD 5xx response and returns the successful probe without a timer", async () => {
    vi.useFakeTimers();
    let attempts = 0;

    const response = await fetchHeadersWithRetry("https://example.invalid/head", { method: "HEAD" }, "HEAD probe", {
      timeoutMs: 20_000,
      retries: 1,
      fetchImpl: async () => {
        attempts += 1;
        return {
          ok: attempts === 2,
          status: attempts === 1 ? 503 : 200,
          headers: new Headers()
        };
      }
    });

    expect(response.status).toBe(200);
    expect(attempts).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns the final failed HEAD probe after one retry and clears its timer", async () => {
    vi.useFakeTimers();
    let attempts = 0;

    const response = await fetchHeadersWithRetry("https://example.invalid/head", { method: "HEAD" }, "HEAD probe", {
      timeoutMs: 20_000,
      retries: 1,
      fetchImpl: async () => {
        attempts += 1;
        return { ok: false, status: 503, headers: new Headers() };
      }
    });

    expect(response.status).toBe(503);
    expect(attempts).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fails closed when HEAD stalls before headers on both attempts", async () => {
    vi.useFakeTimers();
    let attempts = 0;
    let aborts = 0;
    const promise = fetchHeadersWithRetry("https://example.invalid/head", { method: "HEAD" }, "HEAD stalled", {
      timeoutMs: 20,
      retries: 1,
      fetchImpl: async (_input, init) => {
        attempts += 1;
        const signal = init?.signal;
        if (!signal) throw new Error("missing abort signal");
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            aborts += 1;
            reject(new DOMException("Aborted", "AbortError"));
          }, { once: true });
        });
      }
    });
    const rejection = expect(promise).rejects.toThrow(/HEAD stalled.*2 attempts/iu);

    await vi.runAllTimersAsync();
    await rejection;

    expect(attempts).toBe(2);
    expect(aborts).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("KOSHA GUIDE measured manifest gate", () => {
  it("keeps archive row/type/hash expectations explicit and deterministic", () => {
    const entries = [
      archiveEntry(),
      archiveEntry({
        zipFile: "[2025] 기술지원규정(산업보건일반분야).zip",
        internalPath: "E-G-18-2026 밀폐공간 작업 프로그램 수립 및 시행에 관한 기술지원규정.pdf",
        crc32: "1451289034",
        compressedSize: 700_000,
        fileSize: 751_075
      }),
      archiveEntry({
        zipFile: "[2025] 기술지원규정(산업독성분야).zip",
        internalPath: "W-14-2022_경고표지 작성 지침.pdf",
        crc32: "4212962564",
        compressedSize: 710_000,
        fileSize: 734_876,
        itemType: "technical-guideline"
      })
    ];
    const inventory = buildKoshaArchiveInventory(entries);
    const manifest: KoshaGuideAuditManifest = {
      version: 1,
      measuredAt: "2026-07-11T00:00:00.000Z",
      localArchive: {
        archiveCount: 3,
        pdfEntryCount: 3,
        entryManifestSha256: inventory.entryManifestSha256,
        itemTypes: {
          "technical-guideline": 1,
          "technical-support-regulation": 2
        }
      },
      supabaseVisible: {
        sourceId: "kosha-technical-support-regulations-2025",
        rowCount: 3,
        itemTypes: {
          "technical-guideline": 1,
          "technical-support-regulation": 2
        }
      }
    };

    expect(listKoshaManifestGateFailures({ localArchive: inventory, supabaseVisible: manifest.supabaseVisible }, manifest)).toEqual([]);
    expect(listKoshaManifestGateFailures({
      localArchive: { ...inventory, pdfEntryCount: 2, entryManifestSha256: "drift" },
      supabaseVisible: { ...manifest.supabaseVisible, rowCount: 4 }
    }, manifest)).toEqual([
      "local-pdf-rows:2",
      "local-entry-manifest-sha256:drift",
      "supabase-visible-rows:4"
    ]);
  });

  it("detects official current and retired snapshot drift independently", () => {
    const inventory = buildKoshaArchiveInventory([archiveEntry()]);
    const manifest: KoshaGuideAuditManifest = {
      version: 1,
      measuredAt: "2026-07-11T00:00:00.000Z",
      localArchive: inventory,
      supabaseVisible: {
        sourceId: "kosha-technical-support-regulations-2025",
        rowCount: 1,
        itemTypes: {
          "technical-guideline": 0,
          "technical-support-regulation": 1
        }
      },
      officialSnapshot: {
        currentCount: 1,
        currentCanonicalSha256: "current-hash",
        retiredCount: 2,
        retiredCanonicalSha256: "retired-hash"
      }
    };

    expect(listKoshaManifestGateFailures({
      localArchive: inventory,
      supabaseVisible: manifest.supabaseVisible,
      officialSnapshot: {
        currentCount: 2,
        currentCanonicalSha256: "current-drift",
        retiredCount: 3,
        retiredCanonicalSha256: "retired-drift"
      }
    }, manifest)).toEqual([
      "official-current-rows:2",
      "official-current-sha256:current-drift",
      "official-retired-rows:3",
      "official-retired-sha256:retired-drift"
    ]);
  });
});

describe("KOSHA GUIDE evaluation counts", () => {
  it("keeps failed checks and access boundaries separate", () => {
    expect(summarizeKoshaAuditChecks([
      { id: "manifest", status: "pass", count: 0, detail: "measured manifest matched" },
      { id: "empty-body", status: "fail", count: 818, detail: "body missing" },
      { id: "live-row-hash", status: "boundary", count: 1, detail: "credential rejected" }
    ])).toEqual({
      checkCount: 3,
      passedCheckCount: 1,
      failedCheckCount: 1,
      boundaryCheckCount: 1,
      failures: ["empty-body:818"],
      boundaries: ["live-row-hash:1"]
    });
  });
});

describe("KOSHA GUIDE corpus quality", () => {
  it("reports empty bodies, duplicate text, missing provenance, raw aliases, and cross-task controls", () => {
    const rows = [
      reference({
        id: "paint-1",
        body: "",
        summary: "중복 요약",
        risk_tags: ["화재"],
        controls: ["화재", "가동부 방호덮개 설치"],
        source_url: null
      }),
      reference({
        id: "paint-2",
        title: "B-E-18-2026 도료 저장 안전에 관한 기술지원규정",
        body: "",
        summary: "중복 요약",
        risk_tags: ["화재"],
        controls: ["화재", "가동부 방호덮개 설치"],
        source_url: null
      }),
      reference({
        id: "confined-1",
        title: "E-G-18-2026 밀폐공간 작업 프로그램 수립 및 시행에 관한 기술지원규정",
        category: "산업보건일반분야",
        summary: "밀폐공간 진입 전 산소농도 측정과 감시인 배치",
        body: "산소 및 유해가스 농도 측정, 환기, 감시인과 구조장비 기준",
        keywords: ["밀폐공간", "산소농도", "환기", "감시인"],
        risk_tags: ["질식"],
        controls: ["작업 전 산소·유해가스 농도 측정", "감시인 배치 및 구조장비 확보"],
        source_url: "https://portal.kosha.or.kr/openapi/v1/file/down/confined/1"
      })
    ];
    const report = auditKoshaGuideRows(rows);

    expect(report.rowCount).toBe(3);
    expect(report.emptyBodyCount).toBe(2);
    expect(report.duplicateSummaryGroups).toBe(1);
    expect(report.duplicateSummaryRows).toBe(2);
    expect(report.missingSourceUrlCount).toBe(2);
    expect(report.missingOfficialFileIdCount).toBe(3);
    expect(report.missingOfficialPublishedAtCount).toBe(3);
    expect(report.rawTagStandaloneControlLeakCount).toBe(2);
    expect(report.rawControlContaminationCount).toBe(2);
    expect(report.sourceMutationCount).toBe(0);
    expect(report.operationalControlContaminationCount).toBe(1);
    expect(report.rawControlContaminationRows[0]).toEqual(expect.objectContaining({
      id: "paint-1",
      title: "B-E-17-2026 도장 공정에서의 화재·폭발위험방지에 관한 기술지원규정",
      controls: ["화재", "가동부 방호덮개 설치"]
    }));
    expect(report.operationalControlContaminationRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "paint-2",
        controls: expect.arrayContaining(["가동부 방호덮개 설치"])
      })
    ]));
  });

  it("accepts item-level official URL and metadata provenance from payload aliases", () => {
    const report = auditKoshaGuideRows([{
      ...reference({ source_url: null }),
      payload: {
        officialDownloadUrl: "https://portal.kosha.or.kr/openapi/v1/file/down/file/1",
        officialFileId: "file",
        officialPublishedAt: "2026-01-30",
        officialStatus: "개정"
      }
    }]);

    expect(report.missingSourceUrlCount).toBe(0);
    expect(report.missingOfficialFileIdCount).toBe(0);
    expect(report.missingOfficialPublishedAtCount).toBe(0);
    expect(report.missingOfficialStatusCount).toBe(0);
  });

  it("separates fallback summary reuse from non-empty body duplicate candidates", () => {
    const fallbackSummary = "건설안전분야 분야의 KOSHA 기술지원규정 또는 안전보건 기술지침 자료입니다.";
    const rows = [
      reference({ id: "fallback-1", summary: fallbackSummary, body: "" }),
      reference({ id: "fallback-2", summary: fallbackSummary, body: "" }),
      reference({ id: "bullet-1", summary: "ㆍ", body: "동일하게 추출된 짧은 본문" }),
      reference({ id: "bullet-2", summary: "ㆍ", body: "동일하게 추출된 짧은 본문" }),
      reference({ id: "unique", summary: "고유 요약", body: "고유 본문" })
    ];

    const report = auditKoshaGuideRows(rows);

    expect(report.duplicateSummaryGroups).toBe(2);
    expect(report.duplicateSummaryRows).toBe(4);
    expect(report.templatedFallbackSummaryGroups).toBe(1);
    expect(report.templatedFallbackSummaryRows).toBe(2);
    expect(report.nonTemplateDuplicateSummaryGroups).toBe(1);
    expect(report.nonTemplateDuplicateSummaryRows).toBe(2);
    expect(report.exactBodyDuplicateCandidateGroups).toBe(1);
    expect(report.exactBodyDuplicateCandidateRows).toBe(2);
    expect(report.duplicateSummaryDetails).toEqual(expect.arrayContaining([
      expect.objectContaining({
        summary: fallbackSummary,
        rowCount: 2,
        templateFallback: true,
        nonEmptyBodyRows: 0
      }),
      expect.objectContaining({
        summary: "ㆍ",
        rowCount: 2,
        templateFallback: false,
        nonEmptyBodyRows: 2
      })
    ]));
  });

  it("keeps unlabelled heuristic deltas review-required instead of calling them false positives", () => {
    const rows = [
      reference({
        id: "roof",
        title: "C-59-2022 지붕공사 안전보건작업 기술지침",
        summary: "지붕공사 작업",
        body: "",
        keywords: [],
        risk_tags: [],
        controls: ["작업발판과 안전난간 확인", "안전대 체결"]
      }),
      reference({
        id: "material-health",
        title: "H-147-2021 특별관리물질 취급 근로자의 작업환경관리 지침",
        summary: "물질 노출과 독성 관리",
        body: "",
        keywords: [],
        risk_tags: [],
        controls: ["MSDS 확인 및 적정 보호구 착용"]
      }),
      reference({
        id: "transport",
        title: "G-40-2012 해상운송을 위한 포장·운반 및 하역 기술지침",
        summary: "운반차량과 운반구 하역 작업",
        body: "",
        keywords: [],
        risk_tags: [],
        controls: ["보행자 동선과 장비 동선 분리", "후진 경보 확인"]
      }),
      reference({
        id: "vehicle-lift",
        title: "X-36-2016 자동차·차량 이송용 리프트 작업 지침",
        summary: "차량 이송과 리프트 작업",
        body: "",
        keywords: [],
        risk_tags: [],
        controls: ["지게차 후진 경보 확인"]
      }),
      reference({
        id: "toxic-gas-response",
        title: "H-115-2013 시안화수소 가스 노출 급성중독 응급대응 지침",
        summary: "급성중독 응급대응",
        body: "",
        keywords: [],
        risk_tags: [],
        controls: ["작업 전 산소·유해가스 농도 측정", "감시인 배치 및 구조장비 확보"]
      }),
      reference({
        id: "cleaning-chemical",
        title: "H-175-2015 환경미화원 세척시설 기술지침",
        summary: "세척시설과 세척제 관리",
        body: "",
        keywords: [],
        risk_tags: [],
        controls: ["MSDS 확인 및 적정 보호구 착용"]
      }),
      reference({
        id: "office-cross-domain",
        title: "G-999-2026 사무실 문서 정리 지침",
        summary: "사무실 문서 분류와 보관",
        body: "",
        keywords: [],
        risk_tags: [],
        controls: ["지게차 후진 경보 확인", "MSDS 확인"]
      })
    ];

    const report = auditKoshaGuideRows(rows);

    expect(report.rawInitialControlContaminationCount).toBe(7);
    expect(report.rawControlContaminationCount).toBe(1);
    expect(report.rawControlGroundTruthClearedCount).toBe(0);
    expect(report.rawControlReviewRequiredCount).toBe(6);
    expect(report.rawControlHeuristicDeltaFlagCount).toBe(6);
    expect(report.rawControlContaminationRows).toEqual([
      expect.objectContaining({
        id: "office-cross-domain",
        flags: ["forklift-control-cross-task", "fire-chemical-control-cross-task"]
      })
    ]);
    expect(report.operationalInitialControlContaminationCount).toBeGreaterThanOrEqual(
      report.operationalControlContaminationCount
    );
    expect(report.operationalControlGroundTruthClearedCount).toBe(0);
    expect(report.operationalControlReviewRequiredCount).toBeGreaterThanOrEqual(6);
  });

  it("clears a heuristic delta only when every removed flag has an explicit false-positive label", () => {
    const row = reference({
      id: "roof",
      title: "C-59-2022 지붕공사 안전보건작업 기술지침",
      summary: "지붕공사 작업",
      body: "",
      keywords: [],
      risk_tags: [],
      controls: ["작업발판과 안전난간 확인", "안전대 체결"]
    });

    const unlabelled = auditKoshaGuideRows([row]);
    const labelled = auditKoshaGuideRows([row], {
      roof: { "fall-control-cross-task": "false-positive" }
    });

    expect(unlabelled.rawControlGroundTruthClearedCount).toBe(0);
    expect(unlabelled.rawControlReviewRequiredCount).toBe(1);
    expect(labelled.rawControlGroundTruthClearedCount).toBe(1);
    expect(labelled.rawControlReviewRequiredCount).toBe(0);
  });
});

describe("KOSHA GUIDE official comparison", () => {
  it("normalizes official API rows without dropping version, status, date, or file provenance", () => {
    expect(toKoshaOfficialGuideRecord({
      techGdlnNo: "E-G-18-2026",
      techGdlnNm: "밀폐공간 작업 프로그램 수립 및 시행에 관한 기술지원규정",
      techGdlnCtgryCd: "E",
      techGdlnFldSeCd: "EG",
      techGdlnSttsSeCdSt: "개정",
      techGdlnOfancYmd: "20260130",
      techGdlnOrgnlAtcflNo: "CTC2026012914540778798257",
      techGdlnOrgnlAtcflNoSeq: 1
    })).toEqual({
      code: "E-G-18-2026",
      stableKey: "E-G-18",
      title: "밀폐공간 작업 프로그램 수립 및 시행에 관한 기술지원규정",
      category: "E",
      field: "EG",
      status: "개정",
      publishedAt: "2026-01-30",
      fileId: "CTC2026012914540778798257",
      fileSeq: 1
    });
    expect(toKoshaOfficialGuideRecord({ techGdlnNo: "bad" })).toBeNull();
  });

  it("separates formatting normalization, stale versions, and retired local rows", () => {
    const local = [
      archiveEntry({ internalPath: "C-05-2016 건설공사 돌관작업 안전보건작업 지침.pdf", itemType: "technical-guideline" }),
      archiveEntry({ internalPath: "B-M-7-2026 양중기 일반 안전에 관한 기술지원규정.pdf" }),
      archiveEntry({ internalPath: "W-14-2022_경고표지 작성 지침.pdf", itemType: "technical-guideline" })
    ];
    const current = [
      official({ code: "C-5-2016", stableKey: "C-5", title: "건설공사 돌관작업 안전보건작업 지침" }),
      official({ code: "B-M-7-2025", stableKey: "B-M-7", title: "양중기 일반 안전에 관한 기술지원규정" })
    ];
    const retired = [official({ code: "W-14-2022", stableKey: "W-14", status: "폐지" })];

    const comparison = compareKoshaInventoryToOfficial(local, current, retired);

    expect(comparison.stableKeyMatches).toBe(2);
    expect(comparison.exactVersionMatches).toBe(1);
    expect(comparison.versionMismatches).toEqual([{
      stableKey: "B-M-7",
      officialCode: "B-M-7-2025",
      localCode: "B-M-7-2026",
      internalPath: "B-M-7-2026 양중기 일반 안전에 관한 기술지원규정.pdf"
    }]);
    expect(comparison.staleLocalRows).toEqual([{
      stableKey: "W-14",
      localCode: "W-14-2022",
      internalPath: "W-14-2022_경고표지 작성 지침.pdf",
      officialRetired: true
    }]);
    expect(comparison.refreshDryRun).toEqual(expect.objectContaining({
      readOnly: true,
      mutationPerformed: false,
      approvalRequiredBeforeMutation: true,
      counts: {
        insert: 0,
        update: 1,
        retire: 1,
        unchanged: 1
      }
    }));
    expect(comparison.refreshDryRun.update).toEqual(comparison.versionMismatches);
    expect(comparison.refreshDryRun.retire).toEqual(comparison.staleLocalRows);
  });

  it("builds official download URLs only when provenance is complete", () => {
    expect(buildKoshaOfficialDownloadUrl(official())).toBe(
      "https://portal.kosha.or.kr/openapi/v1/file/down/CTC2026012913400018064273/1"
    );
    expect(buildKoshaOfficialDownloadUrl(official({ fileId: null }))).toBeNull();
  });
});

describe("KOSHA GUIDE production visibility", () => {
  it("reads the public status contract without treating samples as a full row snapshot", () => {
    const visible = summarizeKoshaVisibleStatus({
      ok: true,
      configured: true,
      status: "ready",
      sources: 1063,
      items: 9920,
      technicalTotal: 1040,
      technicalSupportRegulations: 237,
      technicalGuidelines: 803,
      samples: [reference()]
    });

    expect(visible).toMatchObject({
      ok: true,
      configured: true,
      sourceId: "kosha-technical-support-regulations-2025",
      rowCount: 1040,
      itemTypes: {
        "technical-guideline": 803,
        "technical-support-regulation": 237
      },
      sampleCount: 1,
      fullRowSnapshotAvailable: false
    });
  });

  it("rejects malformed public status payloads", () => {
    expect(summarizeKoshaVisibleStatus({ ok: true, technicalTotal: "1040" })).toBeNull();
  });

  it("keeps a matching env snapshot distinct from unproven production identity", () => {
    const production = {
      sourceId: "kosha-technical-support-regulations-2025",
      rowCount: 1040,
      itemTypes: {
        "technical-guideline": 803,
        "technical-support-regulation": 237
      },
      canonicalRowSha256: null
    };
    const fullRows = { ...production, canonicalRowSha256: "live-row-hash" };

    expect(reconcileKoshaVisibleSnapshots(production, fullRows)).toEqual({
      snapshot: fullRows,
      parityFailures: [],
      deploymentIdentityProven: false,
      identityBoundary: "deployment-project-identity-unverified"
    });
  });

  it("does not attach a full-row hash when production and direct counts disagree", () => {
    const production = {
      sourceId: "kosha-technical-support-regulations-2025",
      rowCount: 1040,
      itemTypes: {
        "technical-guideline": 803,
        "technical-support-regulation": 237
      }
    };
    const fullRows = {
      ...production,
      rowCount: 1039,
      canonicalRowSha256: "wrong-snapshot"
    };

    expect(reconcileKoshaVisibleSnapshots(production, fullRows)).toEqual({
      snapshot: { ...production, canonicalRowSha256: null },
      parityFailures: ["supabase-visible-row-parity:1039/1040"],
      deploymentIdentityProven: false,
      identityBoundary: "deployment-project-identity-unverified"
    });
  });
});

describe("KOSHA GUIDE retrieval-to-document evidence", () => {
  it("surfaces task-specific KOSHA evidence only through the branch actually executed", () => {
    const branch = "rest" as const;
    const items = [
        reference({ retrieval_source: branch }),
        reference({
          id: "technical-support-01-0065-d-c-13",
          category: "건설안전분야",
          title: "D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정",
          summary: "외벽 도장 보수공사의 비계, 추락방지, 작업발판 안전 기준",
          keywords: ["외벽도장", "비계", "추락"],
          risk_tags: ["추락", "비계"],
          controls: ["작업발판·난간·개구부 상태 확인", "안전대 체결 및 작업반경 출입통제"],
          retrieval_source: branch
        }),
        reference({
          id: "unrelated-electrostatic",
          title: "B-E-20-2026 정전도장기 제작 및 설치에 관한 기술지원규정",
          summary: "정전도장기의 정전기 방전 방지",
          keywords: ["정전도장", "정전기"],
          risk_tags: ["화재", "폭발"],
          retrieval_source: branch
        })
      ];

    const result = auditKoshaRetrievalScenario({
        id: "exterior-paint",
        query: "외벽 도장 이동식 비계 강풍 도료 유기용제 화재 폭발",
        expectedCodes: ["B-E-17-2026", "D-C-13-2026"],
        requiredControlTerms: ["도료", "유기용제", "작업발판", "안전대"],
        forbiddenTerms: ["정전도장기", "피도장물 접지"]
      }, items, branch);

    expect(result.failures).toEqual([]);
    expect(result.executionStatus).toBe("tested");
    expect(result.retrievalSources).toEqual([branch]);
    expect(result.promptContext).toContain("공식자료: B-E-17-2026");
    expect(result.promptContext).toContain("공식자료: D-C-13-2026");
    expect(result.answer).toMatch(/도료|유기용제/);
    expect(result.answer).toMatch(/작업발판|안전대/);
    expect(result.answer).not.toContain("정전도장기");
    expect(result.documentReflections.every((item) => item.documents.includes("위험성평가표"))).toBe(true);
    expect(result.documentReflections.every((item) => item.label.includes("위험성평가표"))).toBe(true);
  });

  it.each(["ranked", "hybrid"] as const)(
    "marks %s untested when only REST candidates were executed",
    (branch) => {
      const result = auditKoshaRetrievalScenario({
        id: "exterior-paint",
        query: "외벽 도장 도료 유기용제 작업발판 안전대",
        expectedCodes: ["B-E-17-2026"],
        requiredControlTerms: ["도료"],
        forbiddenTerms: []
      }, [reference({ retrieval_source: "rest" })], branch);

      expect(result.executionStatus).toBe("untested");
      expect(result.selectedIds).toEqual([]);
      expect(result.promptContext).toBe("");
      expect(result.failures).toEqual([`branch-not-executed:${branch}`]);
    }
  );

  it("does not let required terms self-pass from the user query", () => {
    const result = auditKoshaRetrievalScenario({
      id: "prompt-only-term",
      query: "외벽 도장 사용자질의전용어",
      expectedCodes: ["B-E-17-2026"],
      requiredControlTerms: ["사용자질의전용어"],
      forbiddenTerms: []
    }, [reference({ retrieval_source: "rest" })], "rest");

    expect(result.executionStatus).toBe("tested");
    expect(result.failures).toContain("missing-control-term:사용자질의전용어");
  });
});

describe("KOSHA GUIDE refresh plan", () => {
  it("stays incremental, shardable, empty-response filtered, and non-mutating", () => {
    expect(KOSHA_GUIDE_REFRESH_PLAN).toMatchObject({
      mode: "read-only-plan",
      mutationPerformed: false,
      checkpointField: "publishedAt",
      shardKeys: ["category", "status", "page"],
      emptyResponsePolicy: "reject-empty-page-and-empty-file-provenance",
      reconciliation: "full-stable-key-current-vs-retired"
    });
  });
});
