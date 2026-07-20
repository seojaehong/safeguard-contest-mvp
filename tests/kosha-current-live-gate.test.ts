import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type KoshaGateReport = {
  verdict: string;
  failedCheckIds: string[];
  sourceSha: string;
  liveBuildInfo: {
    commitSha: string;
  };
  liveStatus: {
    exactTrustRegistry: {
      stableDocumentKeys: string[];
      count: number;
    };
    localCorpus: {
      itemCount: number;
      chunkCount: number;
    };
  };
};

function writeJson(root: string, relativePath: string, value: unknown): void {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createFixtureRoot(): { root: string; head: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-kosha-live-gate-"));
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "SafeClaw Test"], { cwd: root, stdio: "ignore" });
  fs.writeFileSync(path.join(root, "README.md"), "fixture\n", "utf8");
  execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: root, stdio: "ignore" });
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  return { root, head };
}

function validStatus(): Record<string, unknown> {
  return {
    status: "ready",
    ok: true,
    searchReady: true,
    items: 9920,
    technicalTotal: 1040,
    technicalGuidelines: 803,
    technicalSupportRegulations: 237,
    localCorpus: {
      status: "ready",
      failures: [],
      snapshotId: "snapshot",
      manifestSha256: "manifest",
      inventoryCount: 234,
      itemCount: 234,
      chunkCount: 7127,
      failureCount: 0,
    },
    exactTrustRegistry: {
      status: "ready",
      count: 3,
      integrityStatus: "ready",
      loadedItemCount: 3,
      failureReason: null,
      stableDocumentKeys: ["D-C-13", "D-C-7", "B-E-10"],
      versions: ["D-C-13-2026", "D-C-7-2026", "B-E-10-2026"],
      items: [
        { itemId: "d-c-13", stableDocumentKey: "D-C-13", version: "D-C-13-2026", title: "D-C-13", itemType: "technical-support-regulation", publishedAt: "2026-01-30", officialFileId: "file-1", bodySha256: "body", pdfSha256: "pdf", provenanceSha256: "prov" },
        { itemId: "d-c-7", stableDocumentKey: "D-C-7", version: "D-C-7-2026", title: "D-C-7", itemType: "technical-support-regulation", publishedAt: "2026-01-30", officialFileId: "file-2", bodySha256: "body", pdfSha256: "pdf", provenanceSha256: "prov" },
        { itemId: "b-e-10", stableDocumentKey: "B-E-10", version: "B-E-10-2026", title: "B-E-10", itemType: "technical-support-regulation", publishedAt: "2026-01-30", officialFileId: "file-3", bodySha256: "body", pdfSha256: "pdf", provenanceSha256: "prov" },
      ],
    },
  };
}

function runGate(root: string, buildInfo: unknown, status: unknown): KoshaGateReport {
  writeJson(root, "build-info.json", buildInfo);
  writeJson(root, "status.json", status);
  const scriptPath = path.resolve("scripts", "kosha_current_live_gate.mjs");
  const outputDir = path.join("evaluation", "kosha-current-live-gate-test");
  execFileSync("node", [
    scriptPath,
    "--root",
    root,
    "--output",
    outputDir,
    "--build-info-file",
    "build-info.json",
    "--status-file",
    "status.json",
  ], { cwd: path.resolve("."), stdio: "pipe" });
  return JSON.parse(fs.readFileSync(path.join(root, outputDir, "report.json"), "utf8")) as KoshaGateReport;
}

describe("kosha current live gate", () => {
  it("passes only when live KOSHA corpus and exact pins are ready together", () => {
    const { root, head } = createFixtureRoot();
    const report = runGate(root, { ok: true, configured: true, commitSha: head }, validStatus());

    expect(report.verdict).toBe("pass_current_kosha_exact_trust_and_corpus_gate");
    expect(report.failedCheckIds).toEqual([]);
    expect(report.sourceSha).toBe(head);
    expect(report.liveBuildInfo.commitSha).toBe(head);
    expect(report.liveStatus.exactTrustRegistry.stableDocumentKeys).toEqual(["D-C-13", "D-C-7", "B-E-10"]);
    expect(report.liveStatus.localCorpus.itemCount).toBe(234);
    expect(report.liveStatus.localCorpus.chunkCount).toBe(7127);
  });

  it("fails closed when an exact KOSHA pin is missing", () => {
    const { root, head } = createFixtureRoot();
    const status = validStatus();
    status.exactTrustRegistry = {
      ...(status.exactTrustRegistry as Record<string, unknown>),
      count: 2,
      loadedItemCount: 2,
      stableDocumentKeys: ["D-C-13", "D-C-7"],
      items: (status.exactTrustRegistry as { items: unknown[] }).items.slice(0, 2),
    };

    expect(() => runGate(root, { ok: true, configured: true, commitSha: head }, status)).toThrow();
    const report = JSON.parse(fs.readFileSync(path.join(root, "evaluation", "kosha-current-live-gate-test", "report.json"), "utf8")) as KoshaGateReport;
    expect(report.verdict).toBe("fail_current_kosha_exact_trust_and_corpus_gate");
    expect(report.failedCheckIds).toContain("exact_registry_count");
    expect(report.failedCheckIds).toContain("exact_registry_required_keys");
  });

  it("fails closed when local KOSHA corpus is blocked", () => {
    const { root, head } = createFixtureRoot();
    const status = validStatus();
    status.localCorpus = {
      ...(status.localCorpus as Record<string, unknown>),
      status: "blocked",
      failureCount: 1,
    };

    expect(() => runGate(root, { ok: true, configured: true, commitSha: head }, status)).toThrow();
    const report = JSON.parse(fs.readFileSync(path.join(root, "evaluation", "kosha-current-live-gate-test", "report.json"), "utf8")) as KoshaGateReport;
    expect(report.verdict).toBe("fail_current_kosha_exact_trust_and_corpus_gate");
    expect(report.failedCheckIds).toContain("local_corpus_ready");
  });
});
