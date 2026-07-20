import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type RollupReport = {
  overall: string;
  head: string;
  liveBuildInfo: {
    commitSha: string;
  };
  mobileP0: {
    verdict: string;
    documentDeepReviewOpen: boolean;
    visibleDocumentPreviews: number;
    documentsHeightRatio: number;
  };
  liveCritical: {
    findings: number;
  };
  evidence: Array<{
    id: string;
    sourceStatus: string;
    productionStatus: string;
  }>;
  contradictions: unknown[];
};

function writeJson(root: string, relativePath: string, value: unknown): void {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function commitAll(root: string, message: string): string {
  execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", message], { cwd: root, stdio: "ignore" });
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
}

function createFixtureRoot(): { root: string; head: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-northstar-live-rollup-"));
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "SafeClaw Test"], { cwd: root, stdio: "ignore" });

  writeJson(root, "evaluation/northstar-open-gates-current/report.json", {
    sourceSha: "OPEN_GATE_SOURCE_SHA",
    overall: "open",
    gates: [
      { id: "final_99_gate", state: "notice", evidencePath: "evaluation/final-99-gate-current-2026-07-21/report.json", detail: "notice carried" },
      { id: "live_harness_quality", state: "proven", evidencePath: "evaluation/live-harness-quality-probe-current-2026-07-20/report.json", detail: "passed" },
      { id: "supabase_rls_launch_isolation", state: "approval_gated", evidencePath: "evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json", detail: "approval required" },
      { id: "llm_wiki_publication", state: "approval_gated", evidencePath: "evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json", detail: "approval required" },
      { id: "sif_embedding_runtime", state: "approval_gated", evidencePath: "evaluation/sif-embedding-gate/approval-preflight-report.json", detail: "approval required" },
      { id: "kosha_exact_trust_registry", state: "proven", evidencePath: "evaluation/kosha-current-live-gate-2026-07-20/report.json", detail: "passed" },
    ],
    safeDemoClaims: ["demo claim"],
    forbiddenClaims: ["forbidden claim"],
  });
  writeJson(root, "evaluation/final-99-gate-current-2026-07-21/report.json", {
    sourceCommit: "TO_FILL",
    productionBuild: { commitSha: "TO_FILL" },
    overall: "pass_with_notice",
  });
  writeJson(root, "evaluation/final-99-gate-current-2026-07-21/notice-carry.json", {
    notices: [
      { gate: "auth-history-reuse", launchImpact: "operator-auth-gated", allowedClaim: "allowed", forbiddenClaim: "forbidden" },
    ],
  });
  writeJson(root, "evaluation/live-harness-quality-probe-current-2026-07-20/report.json", {
    sourceSha: "TO_FILL",
    evaluation: { verdict: "pass", contracts: [] },
  });
  writeJson(root, "evaluation/kosha-current-live-gate-2026-07-20/report.json", {
    sourceSha: "TO_FILL",
    liveBuildInfo: { commitSha: "TO_FILL" },
    verdict: "pass_current_kosha_exact_trust_and_corpus_gate",
    liveStatus: {
      exactTrustRegistry: { stableDocumentKeys: ["D-C-13", "D-C-7", "B-E-10"] },
      localCorpus: { itemCount: 234 },
    },
  });
  writeJson(root, "evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json", {
    sourceSha: "TO_FILL",
    overall: "approval_ready_open",
    launchReadiness: false,
  });
  writeJson(root, "evaluation/sif-embedding-gate/approval-preflight-report.json", {
    sourceSha: "TO_FILL",
    ok: true,
    corpusCount: 6032,
    executionReadyAfterApproval: true,
  });
  writeJson(root, "evaluation/live-critical-surface-current-2026-07-20-rerun/report.json", {
    buildInfo: { commitSha: "TO_FILL" },
    findings: [],
    rows: [{ route: "/workspace" }],
  });
  writeJson(root, "evaluation/mobile-p0-workspace-gate-2026-07-20/report.json", {
    verdict: "MOBILE_FIXED",
    hardBlockersClosed: true,
    production: { commitSha: "TO_FILL" },
    mobileFlow: {
      documentsSafetyBrief: {
        heightRatio: 1.5,
        firstUsefulReviewY: 262,
        documentDeepReviewOpen: false,
        visibleDocumentPreviews: 0,
      },
      share: { heightRatio: 1.72, messagePreviewY: 380 },
    },
  });
  writeJson(root, "evaluation/workspace-docs-share-production-gate-2026-07-20/current-geometry.json", {
    build: { commitSha: "TO_FILL" },
    results: [
      {
        name: "mobile-day",
        documents: {
          documentDeepReviewOpen: false,
          visibleDocumentPreviews: 0,
        },
      },
    ],
  });

  const firstCommit = commitAll(root, "seed fixtures");
  const replaceToken = (relativePath: string, commit = firstCommit): void => {
    const absolutePath = path.join(root, relativePath);
    const next = fs.readFileSync(absolutePath, "utf8").replaceAll("TO_FILL", commit);
    fs.writeFileSync(absolutePath, next, "utf8");
  };
  [
    "evaluation/final-99-gate-current-2026-07-21/report.json",
    "evaluation/live-harness-quality-probe-current-2026-07-20/report.json",
    "evaluation/kosha-current-live-gate-2026-07-20/report.json",
    "evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json",
    "evaluation/sif-embedding-gate/approval-preflight-report.json",
    "evaluation/live-critical-surface-current-2026-07-20-rerun/report.json",
    "evaluation/mobile-p0-workspace-gate-2026-07-20/report.json",
    "evaluation/workspace-docs-share-production-gate-2026-07-20/current-geometry.json",
  ].forEach((relativePath) => replaceToken(relativePath));
  const head = commitAll(root, "bind evidence");
  {
    const openGatePath = path.join(root, "evaluation/northstar-open-gates-current/report.json");
    const next = fs.readFileSync(openGatePath, "utf8").replaceAll("OPEN_GATE_SOURCE_SHA", head);
    fs.writeFileSync(openGatePath, next, "utf8");
  }
  return { root, head };
}

function runRollup(root: string, buildCommit: string): RollupReport {
  writeJson(root, "build-info.json", { ok: true, commitSha: buildCommit, branch: "master", environment: "production" });
  execFileSync("node", [
    path.resolve("scripts/northstar_live_rollup.mjs"),
    "--root",
    root,
    "--output",
    "evaluation/northstar-live-rollup-test",
    "--build-info-file",
    "build-info.json",
  ], { cwd: path.resolve("."), stdio: "pipe" });
  return JSON.parse(fs.readFileSync(path.join(root, "evaluation/northstar-live-rollup-test/report.json"), "utf8")) as RollupReport;
}

describe("northstar live rollup", () => {
  it("binds mobile fixed and open-gate evidence to the current production build", () => {
    const { root, head } = createFixtureRoot();
    const report = runRollup(root, head);

    expect(report.overall).toBe("northstar_open_approval_gated");
    expect(report.liveBuildInfo.commitSha).toBe(head);
    expect(report.mobileP0.verdict).toBe("MOBILE_FIXED");
    expect(report.mobileP0.documentDeepReviewOpen).toBe(false);
    expect(report.mobileP0.visibleDocumentPreviews).toBe(0);
    expect(report.mobileP0.documentsHeightRatio).toBe(1.5);
    expect(report.liveCritical.findings).toBe(0);
    expect(report.evidence.find((item) => item.id === "open_gate")?.productionStatus).toBe("matches_live");
    expect(report.contradictions).toHaveLength(0);
  });

  it("fails closed when an evidence packet points outside the current history", () => {
    const { root, head } = createFixtureRoot();
    writeJson(root, "evaluation/mobile-p0-workspace-gate-2026-07-20/report.json", {
      verdict: "MOBILE_FIXED",
      production: { commitSha: "ffffffffffffffffffffffffffffffffffffffff" },
      mobileFlow: {
        documentsSafetyBrief: { heightRatio: 1.5, firstUsefulReviewY: 262, documentDeepReviewOpen: false, visibleDocumentPreviews: 0 },
        share: { heightRatio: 1.72, messagePreviewY: 380 },
      },
    });

    expect(() => runRollup(root, head)).toThrow();
    const report = JSON.parse(fs.readFileSync(path.join(root, "evaluation/northstar-live-rollup-test/report.json"), "utf8")) as RollupReport;
    expect(report.overall).toBe("northstar_evidence_contradicted");
    expect(report.evidence.find((item) => item.id === "mobile_p0_workspace")?.productionStatus).toBe("not_ancestor");
  });
});
