import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

type NextRunwayReport = {
  sourceHead: string;
  productionCommit: string;
  latestEvidenceCommitLive: boolean;
  currentHeadIsEvidenceOnlyPending: boolean;
  liveExactEvidenceCommit: string;
  liveRollupMatchesProduction: boolean;
  approvalGated: Array<{
    gate: string;
    state: string;
    currentSafetyLock: string;
  }>;
  koshaNextExactCandidateAudit: {
    verdict: string;
    exactPins: number;
    acceptedSubsetItems: number;
    metadataVerifiedNotExact: number;
    mutationPerformed: boolean;
    dbMutationPerformed: boolean;
    embeddingGenerationPerformed: boolean;
    forbiddenClaims: string[];
  };
  nextSafeWorkWithoutApproval: string[];
};

type NextRunwayModule = {
  buildNorthstarNextRunway: (options: {
    rootDir: string;
    buildInfo: unknown;
    generatedAt?: string;
  }) => NextRunwayReport;
};

async function loadNextRunwayModule(): Promise<NextRunwayModule> {
  const sourcePath = path.resolve("scripts", "northstar_next_runway.mjs");
  const moduleDir = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-next-runway-module-"));
  const modulePath = path.join(moduleDir, "northstar_next_runway.mjs");
  const source = fs.readFileSync(sourcePath, "utf8").replace(/^#!.*\r?\n/u, "");
  fs.writeFileSync(modulePath, source, "utf8");
  return await import(pathToFileURL(modulePath).href) as NextRunwayModule;
}

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

function createFixtureRoot(): { root: string; firstHead: string; secondHead: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-next-runway-"));
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "SafeClaw Test"], { cwd: root, stdio: "ignore" });

  writeJson(root, "evaluation/northstar-live-rollup-2026-07-20/report.json", {
    head: "TO_FILL",
    liveBuildInfo: { commitSha: "TO_FILL" },
  });
  writeJson(root, "evaluation/northstar-approval-runway-2026-07-21/report.json", {
    approvalGates: [
      {
        id: "provider_dispatch_persistence",
        state: "approval_gated",
        evidencePath: "evaluation/provider-dispatch-idempotency-gate-2026-07-19/report.json",
        readyForOperatorReview: true,
        currentSafetyLock: "preview_only",
        approvalNeeded: ["approve persistent idempotency migration scope"],
        forbiddenUntilApproved: ["real provider dispatch"],
      },
      {
        id: "supabase_rls_launch_isolation",
        state: "approval_gated",
        evidencePath: "evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json",
        readyForOperatorReview: true,
        currentSafetyLock: "read_only_preflight",
        approvalNeeded: ["run disposable tenant A/B negative matrix"],
        forbiddenUntilApproved: ["RLS launch isolation proven"],
      },
      {
        id: "llm_wiki_publication",
        state: "approval_gated",
        evidencePath: "evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json",
        readyForOperatorReview: true,
        currentSafetyLock: "candidate_unpublished",
        approvalNeeded: ["run isolated publication canary"],
        forbiddenUntilApproved: ["LLM Wiki publication available"],
      },
      {
        id: "sif_embedding_runtime",
        state: "approval_gated",
        evidencePath: "evaluation/sif-embedding-gate/approval-preflight-report.json",
        readyForOperatorReview: true,
        currentSafetyLock: "approval_held_no_vectors",
        approvalNeeded: ["approve embedding cost and upload"],
        forbiddenUntilApproved: ["SIF vector retrieval production-active"],
      },
    ],
  });
  writeJson(root, "evaluation/hermes-openclaw-runtime-current-gate-2026-07-20/report.json", {
    verdict: "adapter_boundary_pass_live_execution_not_claimed",
    focusedTests: { status: "pass" },
    liveUnauthenticatedBrokerSmoke: { code: "AUTH_REQUIRED" },
    liveExecutionReadiness: { claimed: false },
  });
  writeJson(root, "evaluation/launch-readiness-current-2026-07-22/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_WITH_BOUNDARIES",
    safeLaunchDemoClaimAllowed: true,
    guidedPilotClaimAllowed: true,
    fullyAutomatedLaunchClaimAllowed: false,
    selfServeSaasLaunchClaimAllowed: false,
    providerDispatchLiveClaimed: false,
    dispatchCalled: false,
    apiAsk: { ok: true },
    documentCoverage: { expectedCount: 11, presentCount: 11, missing: [] },
  });
  writeJson(root, "evaluation/kosha-next-exact-candidate-audit-2026-07-22/report.json", {
    verdict: "NEXT_EXACT_TRUST_CANDIDATES_IDENTIFIED_APPROVAL_FREE",
    mutationPerformed: false,
    dbMutationPerformed: false,
    embeddingGenerationPerformed: false,
    exactTrustRegistryCurrent: { count: 3 },
    verifiedSubsetCurrent: { acceptedCount: 234, chunksCount: 7127 },
    officialMetadataRegistry: { metadataVerifiedNotExact: 231 },
    forbiddenClaims: [
      "All 1,040 KOSHA Guide rows are exact direct evidence.",
      "The metadata-verified non-exact candidates are already exact production evidence.",
    ],
  });
  writeJson(root, "evaluation/sif-embedding-gate/approval-preflight-report.json", {
    approvalHeld: true,
    dbMutationPerformed: false,
    embeddingGenerated: false,
    uploaded: false,
    corpus: { corpusCount: 6032 },
    failedCheckIds: [],
  });

  const firstHead = commitAll(root, "seed");
  const liveRollupPath = path.join(root, "evaluation/northstar-live-rollup-2026-07-20/report.json");
  const liveRollup = fs.readFileSync(liveRollupPath, "utf8").replaceAll("TO_FILL", firstHead);
  fs.writeFileSync(liveRollupPath, liveRollup, "utf8");
  const secondHead = commitAll(root, "bind live rollup");
  return { root, firstHead, secondHead };
}

function pointLiveRollupAt(root: string, commit: string): void {
  writeJson(root, "evaluation/northstar-live-rollup-2026-07-20/report.json", {
    head: commit,
    liveBuildInfo: { commitSha: commit },
  });
}

describe("northstar next runway generator", () => {
  it("marks the latest evidence commit as live when source, production, and live rollup align", async () => {
    const { buildNorthstarNextRunway } = await loadNextRunwayModule();
    const { root, secondHead } = createFixtureRoot();
    pointLiveRollupAt(root, secondHead);
    const report = buildNorthstarNextRunway({
      rootDir: root,
      buildInfo: { commitSha: secondHead },
      generatedAt: "2026-07-22T00:00:00.000Z",
    });

    expect(report.sourceHead).toBe(secondHead);
    expect(report.productionCommit).toBe(secondHead);
    expect(report.latestEvidenceCommitLive).toBe(true);
    expect(report.currentHeadIsEvidenceOnlyPending).toBe(false);
    expect(report.liveRollupMatchesProduction).toBe(true);
    expect(report.approvalGated.map((gate) => gate.gate)).toEqual([
      "provider_dispatch_persistence",
      "supabase_rls_launch_isolation",
      "llm_wiki_publication",
      "sif_embedding_runtime",
    ]);
    expect(report.koshaNextExactCandidateAudit).toMatchObject({
      verdict: "NEXT_EXACT_TRUST_CANDIDATES_IDENTIFIED_APPROVAL_FREE",
      exactPins: 3,
      acceptedSubsetItems: 234,
      metadataVerifiedNotExact: 231,
      mutationPerformed: false,
      dbMutationPerformed: false,
      embeddingGenerationPerformed: false,
    });
    expect(report.koshaNextExactCandidateAudit.forbiddenClaims).toContain(
      "The metadata-verified non-exact candidates are already exact production evidence.",
    );
    expect(report.nextSafeWorkWithoutApproval).toContain(
      "use the KOSHA next exact candidate audit to select a bounded metadata-verified candidate set before any exact-trust promotion",
    );
  });

  it("marks an evidence-only source head as pending when the live rollup still matches production", async () => {
    const { buildNorthstarNextRunway } = await loadNextRunwayModule();
    const { root, secondHead } = createFixtureRoot();
    pointLiveRollupAt(root, secondHead);
    const thirdHead = commitAll(root, "evidence only");
    const report = buildNorthstarNextRunway({
      rootDir: root,
      buildInfo: { commitSha: secondHead },
    });

    expect(report.sourceHead).toBe(thirdHead);
    expect(report.productionCommit).toBe(secondHead);
    expect(report.latestEvidenceCommitLive).toBe(false);
    expect(report.currentHeadIsEvidenceOnlyPending).toBe(true);
    expect(report.liveRollupMatchesProduction).toBe(true);
  });

  it("does not call the runway live-exact when production advances beyond the live rollup", async () => {
    const { buildNorthstarNextRunway } = await loadNextRunwayModule();
    const { root, secondHead } = createFixtureRoot();
    pointLiveRollupAt(root, secondHead);
    const productionHead = commitAll(root, "production ahead");
    writeJson(root, "evaluation/evidence-after-production/report.json", { productionHead });
    const evidenceHead = commitAll(root, "evidence after production");
    const report = buildNorthstarNextRunway({
      rootDir: root,
      buildInfo: { commitSha: productionHead },
    });

    expect(report.sourceHead).toBe(evidenceHead);
    expect(report.productionCommit).toBe(productionHead);
    expect(report.latestEvidenceCommitLive).toBe(false);
    expect(report.currentHeadIsEvidenceOnlyPending).toBe(false);
    expect(report.liveRollupMatchesProduction).toBe(false);
    expect(report.nextSafeWorkWithoutApproval).toContain("refresh live rollup before claiming live-exact if production advances beyond the current live rollup head");
  });
});
