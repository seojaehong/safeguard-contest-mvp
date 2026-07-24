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
    shareHeightRatio: number;
  };
  liveCritical: {
    findings: number;
  };
  liveDocumentQualityMatrix: {
    verdict: string;
    scenarioCount: number;
    livePassed: number;
    liveFailed: number;
    structuredRiskControlsDistinct: boolean;
    foreignWorkerScenarioRelevance: boolean;
  };
  liveDocumentQualityStressMatrix: {
    verdict: string;
    productCommitIncludedInProduction: boolean;
    livePassed: number;
    liveFailed: number;
    dbMutationPerformed: boolean;
    providerDispatchPerformed: boolean;
  };
  liveDocumentFieldIsolation: {
    verdict: string;
    livePassed: number;
    liveFailed: number;
    liveAfterDeploymentPending: boolean;
    dbMutationPerformed: boolean;
    providerDispatchCalled: boolean;
  };
  liveDocumentWordingReview: {
    verdict: string;
    livePassed: number;
    liveFailed: number;
    liveAfterDeploymentPending: boolean;
    dbMutationPerformed: boolean;
    providerDispatchCalled: boolean;
  };
  liveDocumentBroadReview: {
    verdict: string;
    uiDocumentCount: number;
    integrityRequiredCount: number;
    reviewedDocumentCount: number;
    beforePassed: number;
    beforeFailed: number;
    beforeMissingUnexpected: number;
    livePassed: number;
    liveFailed: number;
    liveMissingUnexpected: number;
    workPermitPresentNonEmpty: number;
    dbMutationPerformed: boolean;
    shareSessionCreated: boolean;
    providerDispatchCalled: boolean;
    exactSavedShareReproduced: boolean;
    exactSavedShareVerdict: string;
  };
  liveDocumentSecondaryGrounding: {
    verdict: string;
    livePassed: number;
    liveFailed: number;
    secondaryReviewed: number;
    secondaryPassed: number;
    crossScenarioLeakageCount: number;
    missingUnexpectedCount: number;
    dbMutationPerformed: boolean;
    shareSessionCreated: boolean;
    providerDispatchCalled: boolean;
    exactSavedShareReproduced: boolean;
    exactSavedShareVerdict: string;
  };
  liveDocumentEditorialReview: {
    verdict: string;
    scenarioCount: number;
    reviewedDocumentSurfaceCount: number;
    livePassed: number;
    liveFailed: number;
    placeholderFindingCount: number;
    legalOverclaimFindingCount: number;
    awkwardCompositionFindingCount: number;
    evidenceDomainMismatchCount: number;
    exactLineOveruseCount: number;
    nearDuplicateLineOveruseCount: number;
    humanReviewCompleted: boolean;
    dbMutationPerformed: boolean;
    shareSessionCreated: boolean;
    providerDispatchCalled: boolean;
    exactSavedShareReproduced: boolean;
    exactSavedShareVerdict: string;
  };
  liveDocumentSeedProfileIsolation: {
    verdict: string;
    beforePassed: number;
    beforeFailed: number;
    beforeSeedProfileLeakageCount: number;
    livePassed: number;
    liveFailed: number;
    liveSeedProfileLeakageCount: number;
    reviewedDocumentSurfaceCount: number;
    secondaryGroundingPassed: number;
    secondaryGroundingReviewed: number;
    dbMutationPerformed: boolean;
    shareSessionCreated: boolean;
    providerDispatchCalled: boolean;
    exactSavedShareReproduced: boolean;
    exactSavedShareVerdict: string;
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
      { id: "final_99_gate", state: "notice", evidencePath: "evaluation/final-99-gate-current-2026-07-22/report.json", detail: "notice carried" },
      { id: "live_harness_quality", state: "proven", evidencePath: "evaluation/live-harness-quality-probe-current-2026-07-20/report.json", detail: "passed" },
      { id: "live_document_quality_matrix", state: "proven", evidencePath: "evaluation/live-document-quality-matrix-2026-07-24/report.json", detail: "five live scenarios passed" },
      { id: "live_document_quality_stress_matrix", state: "proven", evidencePath: "evaluation/live-document-quality-stress-matrix-2026-07-24/report.json", detail: "five high-risk stress scenarios passed" },
      { id: "live_document_field_isolation", state: "proven", evidencePath: "evaluation/live-document-field-isolation-2026-07-25/report.json", detail: "ten field-isolation scenarios passed" },
      { id: "live_kosha_exact_materialization", state: "proven", evidencePath: "evaluation/live-kosha-exact-materialization-2026-07-25/report.json", detail: "three exact KOSHA pins materialized" },
      { id: "live_document_wording_review", state: "proven", evidencePath: "evaluation/live-document-wording-review-2026-07-24/report.json", detail: "five synthetic wording scenarios passed" },
      { id: "live_document_broad_review", state: "proven", evidencePath: "evaluation/live-document-broad-review-2026-07-25/report.json", detail: "all 12 deliverables passed" },
      { id: "live_document_editorial_review", state: "proven", evidencePath: "evaluation/live-document-editorial-review-2026-07-25/report.json", detail: "all 60 editorial surfaces passed automated contract" },
      { id: "live_document_secondary_grounding", state: "proven", evidencePath: "evaluation/live-document-secondary-grounding-2026-07-25/report.json", detail: "all 30 supporting documents passed scenario grounding" },
      { id: "live_document_seed_profile_isolation", state: "proven", evidencePath: "evaluation/live-document-seed-profile-isolation-2026-07-25/report.json", detail: "all 60 documents passed seed-profile isolation" },
      { id: "provider_dispatch_persistence", state: "approval_gated", evidencePath: "evaluation/provider-dispatch-idempotency-gate-2026-07-19/report.json", detail: "preview only" },
      { id: "supabase_rls_launch_isolation", state: "approval_gated", evidencePath: "evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json", detail: "approval required" },
      { id: "llm_wiki_publication", state: "approval_gated", evidencePath: "evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json", detail: "approval required" },
      { id: "sif_embedding_runtime", state: "approval_gated", evidencePath: "evaluation/sif-embedding-gate/approval-preflight-report.json", detail: "approval required" },
      { id: "kosha_exact_trust_registry", state: "proven", evidencePath: "evaluation/kosha-current-live-gate-2026-07-20/report.json", detail: "passed" },
    ],
    safeDemoClaims: ["demo claim"],
    forbiddenClaims: ["forbidden claim"],
  });
  writeJson(root, "evaluation/final-99-gate-current-2026-07-22/report.json", {
    sourceCommit: "TO_FILL",
    productionBuild: { commitSha: "TO_FILL" },
    overall: "pass_with_notice",
  });
  writeJson(root, "evaluation/final-99-gate-current-2026-07-22/notice-carry.json", {
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
  writeJson(root, "evaluation/live-document-quality-matrix-2026-07-24/report.json", {
    sourceHead: "TO_FILL",
    productionCommitAtGeneration: "TO_FILL",
    verdict: "PASS_LIVE_PRODUCTION_MULTI_SCENARIO_DOCUMENT_QUALITY",
    scenarios: ["one", "two", "three", "four", "five"],
    afterLive: {
      pass: 5,
      fail: 0,
      structuredRiskControlsDistinct: true,
      foreignWorkerScenarioRelevance: true,
    },
    boundaries: {
      dbMutationPerformed: false,
      providerDispatchLiveClaimed: false,
    },
  });
  writeJson(root, "evaluation/live-document-quality-stress-matrix-2026-07-24/report.json", {
    sourceHead: "TO_FILL",
    productionCommitAtGeneration: "TO_FILL",
    verdict: "PASS_LIVE_PRODUCTION_STRESS_MATRIX",
    productCommitIncludedInProduction: true,
    afterLive: {
      total: 5,
      pass: 5,
      fail: 0,
    },
    boundaries: {
      dbMutationPerformed: false,
      providerDispatchPerformed: false,
    },
  });
  writeJson(root, "evaluation/live-document-field-isolation-2026-07-25/report.json", {
    sourceHead: "TO_FILL",
    productionBuild: { commitSha: "TO_FILL" },
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_FIELD_ISOLATION",
    liveAfterDeploymentPending: false,
    afterLive: {
      normal: { total: 5, pass: 5, fail: 0 },
      stress: { total: 5, pass: 5, fail: 0 },
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactSavedShareSessionReproduced: false,
    },
  });
  writeJson(root, "evaluation/live-kosha-exact-materialization-2026-07-25/report.json", {
    sourceHead: "TO_FILL",
    productCommit: "TO_FILL",
    productionCommit: "TO_FILL",
    verdict: "PASS_LIVE_PRODUCTION_KOSHA_EXACT_MATERIALIZATION",
    productCommitMatchesProduction: true,
    liveAfterDeploymentPending: false,
    afterLive: { total: 3, pass: 3, fail: 0 },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactTrustRegistryExpanded: false,
    },
  });
  writeJson(root, "evaluation/live-document-wording-review-2026-07-24/report.json", {
    sourceHead: "TO_FILL",
    productCommit: "TO_FILL",
    productionCommitAfterDeployment: "TO_FILL",
    verdict: "PASS_LIVE_PRODUCTION_SYNTHETIC_WORDING_REVIEW",
    liveAfterDeploymentPending: false,
    afterLive: {
      total: 5,
      pass: 5,
      fail: 0,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactSavedShareReproduced: false,
    },
  });
  writeJson(root, "evaluation/live-document-broad-review-2026-07-25/report.json", {
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
    productCommit: "TO_FILL",
    verdict: "PASS_LIVE_PRODUCTION_12_DELIVERABLE_BROAD_REVIEW",
    uiDocumentCount: 12,
    integrityRequiredCount: 12,
    reviewedDocumentCount: 12,
    stages: {
      beforeRemediation: { pass: 0, fail: 5, missingUnexpectedCount: 5 },
      afterLive: { pass: 5, fail: 0, missingUnexpectedCount: 0 },
    },
    workPermitMatrix: Array.from({ length: 5 }, (_, index) => ({
      caseId: `case-${index + 1}`,
      status: "presentNonEmpty",
      verdict: "PASS",
    })),
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactSavedShareReproduced: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/live-document-secondary-grounding-2026-07-25/report.json", {
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
    verdict: "PASS_LIVE_PRODUCTION_SECONDARY_DOCUMENT_GROUNDING_CONTRACT",
    stages: {
      afterLive: {
        cases: 5,
        pass: 5,
        fail: 0,
        secondaryReviewed: 30,
        secondaryPassed: 30,
        crossScenarioLeakageCount: 0,
        missingUnexpectedCount: 0,
      },
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactSavedShareReproduced: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/live-document-editorial-review-2026-07-25/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_12_DELIVERABLE_EDITORIAL_CONTRACT_REVIEWER_READY",
    productCommit: "TO_FILL",
    productionCommit: "TO_FILL",
    canonicalDocumentCount: 12,
    scenarioCount: 5,
    reviewedDocumentSurfaceCount: 60,
    humanReviewCompleted: false,
    beforeLive: {
      pass: 0,
      fail: 5,
      awkwardCompositionFindingCount: 20,
      evidenceDomainMismatchCount: 1,
    },
    afterLive: {
      pass: 5,
      fail: 0,
      placeholderFindingCount: 0,
      legalOverclaimFindingCount: 0,
      awkwardCompositionFindingCount: 0,
      evidenceDomainMismatchCount: 0,
      exactLineOveruseCount: 38,
      nearDuplicateLineOveruseCount: 100,
    },
    evidenceBoundary: {
      automatedEditorialContract: true,
      reviewerReady: true,
      humanReviewCompleted: false,
      sixCoreWordingGateCombinedAsHumanPass: false,
      twelveDeliverablePresenceGateCombinedAsHumanPass: false,
      duplicateFindingsRemainForHumanReview: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactSavedShareReproduced: false,
    },
  });
  writeJson(root, "evaluation/live-document-seed-profile-isolation-2026-07-25/report.json", {
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
    productCommit: "TO_FILL",
    verdict: "PASS_LIVE_PRODUCTION_SEED_PROFILE_ISOLATION",
    liveAfterDeploymentPending: false,
    contract: {
      reviewedDocumentSurfaceCount: 60,
    },
    beforeLive: {
      pass: 0,
      fail: 5,
      seedProfileLeakageCount: 90,
    },
    afterLive: {
      pass: 5,
      fail: 0,
      seedProfileLeakageCount: 0,
      secondaryGroundingPassed: 30,
      secondaryGroundingReviewed: 30,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactSavedShareReproduced: false,
      exactSavedShareEvidence: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/provider-dispatch-idempotency-gate-2026-07-19/report.json", {
    sourceSha: "TO_FILL",
    status: "approval_required",
    liveDispatchState: {
      capability: false,
      mode: "preview_only",
      reason: "persistent_idempotency_unavailable",
      productionCommitSha: "TO_FILL",
    },
    draftMigration: { scope: "attempt_level_reservation_only" },
    channelResultPersistence: { channelLevelExactlyOnceProven: false },
    safetyLocks: {
      providerMessageSent: false,
      liveDispatchUnlocked: false,
    },
  });
  writeJson(root, "evaluation/northstar-approval-runway-2026-07-21/report.json", {
    sourceHeadAtDraft: "TO_FILL",
    liveCommitAtDraft: "TO_FILL",
    overall: "approval_runway_ready_open",
    launchReadiness: false,
    dbMutationPerformed: false,
    providerMessageSent: false,
    embeddingGenerated: false,
    uploaded: false,
    approvalGates: [
      { id: "provider_dispatch_persistence", state: "approval_gated" },
      { id: "supabase_rls_launch_isolation", state: "approval_gated" },
      { id: "llm_wiki_publication", state: "approval_gated" },
      { id: "sif_embedding_runtime", state: "approval_gated" },
    ],
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
        viewport: { width: 390, height: 844 },
        documents: {
          body: { height: 844 },
          documentWorkbench: { y: 294, bottom: 786 },
          documentDeepReviewOpen: false,
          visibleDocumentPreviews: 0,
        },
        share: {
          body: { height: 844 },
          shareRoot: { bottom: 810 },
          sharePreview: { y: 486, bottom: 683 },
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
    "evaluation/final-99-gate-current-2026-07-22/report.json",
    "evaluation/live-harness-quality-probe-current-2026-07-20/report.json",
    "evaluation/live-document-quality-matrix-2026-07-24/report.json",
    "evaluation/live-document-quality-stress-matrix-2026-07-24/report.json",
    "evaluation/live-document-field-isolation-2026-07-25/report.json",
    "evaluation/live-kosha-exact-materialization-2026-07-25/report.json",
    "evaluation/live-document-wording-review-2026-07-24/report.json",
    "evaluation/live-document-broad-review-2026-07-25/report.json",
    "evaluation/live-document-editorial-review-2026-07-25/report.json",
    "evaluation/live-document-secondary-grounding-2026-07-25/report.json",
    "evaluation/live-document-seed-profile-isolation-2026-07-25/report.json",
    "evaluation/kosha-current-live-gate-2026-07-20/report.json",
    "evaluation/provider-dispatch-idempotency-gate-2026-07-19/report.json",
    "evaluation/northstar-approval-runway-2026-07-21/report.json",
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
    expect(report.mobileP0.documentsHeightRatio).toBe(1);
    expect(report.mobileP0.shareHeightRatio).toBe(1);
    expect(report.liveCritical.findings).toBe(0);
    expect(report.liveDocumentQualityMatrix).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_MULTI_SCENARIO_DOCUMENT_QUALITY",
      scenarioCount: 5,
      livePassed: 5,
      liveFailed: 0,
      structuredRiskControlsDistinct: true,
      foreignWorkerScenarioRelevance: true,
    });
    expect(report.evidence.find((item) => item.id === "live_document_quality_matrix")?.productionStatus).toBe("ancestor_of_head");
    expect(report.liveDocumentQualityStressMatrix).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_STRESS_MATRIX",
      productCommitIncludedInProduction: true,
      livePassed: 5,
      liveFailed: 0,
      dbMutationPerformed: false,
      providerDispatchPerformed: false,
    });
    expect(report.evidence.find((item) => item.id === "live_document_quality_stress_matrix")?.productionStatus).toBe("ancestor_of_head");
    expect(report.liveDocumentFieldIsolation).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_FIELD_ISOLATION",
      livePassed: 10,
      liveFailed: 0,
      liveAfterDeploymentPending: false,
      dbMutationPerformed: false,
      providerDispatchCalled: false,
    });
    expect(report.evidence.find((item) => item.id === "live_document_field_isolation")?.productionStatus).toBe("ancestor_of_head");
    expect(report.evidence.find((item) => item.id === "live_kosha_exact_materialization")?.productionStatus).toBe("ancestor_of_head");
    expect(report.liveDocumentWordingReview).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_SYNTHETIC_WORDING_REVIEW",
      livePassed: 5,
      liveFailed: 0,
      liveAfterDeploymentPending: false,
      dbMutationPerformed: false,
      providerDispatchCalled: false,
    });
    expect(report.evidence.find((item) => item.id === "live_document_wording_review")?.productionStatus).toBe("ancestor_of_head");
    expect(report.liveDocumentBroadReview).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_12_DELIVERABLE_BROAD_REVIEW",
      uiDocumentCount: 12,
      integrityRequiredCount: 12,
      reviewedDocumentCount: 12,
      beforePassed: 0,
      beforeFailed: 5,
      beforeMissingUnexpected: 5,
      livePassed: 5,
      liveFailed: 0,
      liveMissingUnexpected: 0,
      workPermitPresentNonEmpty: 5,
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactSavedShareReproduced: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.evidence.find((item) => item.id === "live_document_broad_review")?.productionStatus).toBe("ancestor_of_head");
    expect(report.liveDocumentEditorialReview).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_12_DELIVERABLE_EDITORIAL_CONTRACT_REVIEWER_READY",
      scenarioCount: 5,
      reviewedDocumentSurfaceCount: 60,
      livePassed: 5,
      liveFailed: 0,
      placeholderFindingCount: 0,
      legalOverclaimFindingCount: 0,
      awkwardCompositionFindingCount: 0,
      evidenceDomainMismatchCount: 0,
      exactLineOveruseCount: 38,
      nearDuplicateLineOveruseCount: 100,
      humanReviewCompleted: false,
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactSavedShareReproduced: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.evidence.find((item) => item.id === "live_document_editorial_review")?.productionStatus).toBe("ancestor_of_head");
    expect(report.liveDocumentSecondaryGrounding).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_SECONDARY_DOCUMENT_GROUNDING_CONTRACT",
      livePassed: 5,
      liveFailed: 0,
      secondaryReviewed: 30,
      secondaryPassed: 30,
      crossScenarioLeakageCount: 0,
      missingUnexpectedCount: 0,
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactSavedShareReproduced: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.evidence.find((item) => item.id === "live_document_secondary_grounding")?.productionStatus).toBe("ancestor_of_head");
    expect(report.liveDocumentSeedProfileIsolation).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_SEED_PROFILE_ISOLATION",
      beforePassed: 0,
      beforeFailed: 5,
      beforeSeedProfileLeakageCount: 90,
      livePassed: 5,
      liveFailed: 0,
      liveSeedProfileLeakageCount: 0,
      reviewedDocumentSurfaceCount: 60,
      secondaryGroundingPassed: 30,
      secondaryGroundingReviewed: 30,
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactSavedShareReproduced: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.evidence.find((item) => item.id === "live_document_seed_profile_isolation")?.productionStatus).toBe("ancestor_of_head");
    expect(report.evidence.find((item) => item.id === "open_gate")?.productionStatus).toBe("matches_live");
    expect(report.evidence.find((item) => item.id === "provider_dispatch_persistence")?.sourceStatus).toBe("ancestor");
    expect(report.evidence.find((item) => item.id === "provider_dispatch_persistence")?.productionStatus).toBe("ancestor_of_head");
    expect(report.evidence.find((item) => item.id === "northstar_approval_runway")?.sourceStatus).toBe("ancestor");
    expect(report.evidence.find((item) => item.id === "northstar_approval_runway")?.productionStatus).toBe("ancestor_of_head");
    expect(report.contradictions).toHaveLength(0);
  }, 15_000);

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

  it("does not mark source-ahead final-99 evidence as live-exact", () => {
    const { root, head } = createFixtureRoot();
    const liveCommit = execFileSync("git", ["rev-parse", "HEAD~1"], { cwd: root, encoding: "utf8" }).trim();
    writeJson(root, "evaluation/final-99-gate-current-2026-07-22/report.json", {
      sourceCommit: head,
      productionBuild: { commitSha: liveCommit },
      overall: "pass_with_notice",
    });

    const report = runRollup(root, liveCommit);
    const final99 = report.evidence.find((item) => item.id === "final_99_gate");

    expect(final99?.sourceStatus).toBe("exact");
    expect(final99?.productionStatus).toBe("matches_live_source_mismatch");
    expect(report.contradictions).toHaveLength(0);
  });
});
