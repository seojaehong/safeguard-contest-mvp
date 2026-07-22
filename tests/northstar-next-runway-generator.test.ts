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
  sourceHeadLivePending: boolean;
  currentHeadIsEvidenceOnlyPending: boolean;
  liveExactEvidenceCommit: string;
  liveRollupMatchesProduction: boolean;
  boundedWorkbenchSourceIncludedInLive: boolean;
  boundedWorkbenchCurrentLivePending: boolean;
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
  koshaExactPromotionPacket: {
    verdict: string;
    candidateCount: number;
    selectedStableKeys: string[];
    packetReadyForReview: boolean;
    reviewChecklistComplete: boolean;
    exactTrustPromotionBlockedUntilChecklistComplete: boolean;
    perCandidateRequiredCheckCount: number;
    mutationPerformed: boolean;
    dbMutationPerformed: boolean;
    embeddingGenerationPerformed: boolean;
    exactPromotionPerformed: boolean;
    forbiddenClaims: string[];
  };
  uiInterpretation: {
    routeSplitAloneAcceptedAsFix: boolean;
    acceptedStructure: string;
    structuralAnswer: string;
    documentsDefaultCockpit: string;
    documentsRemainingDebt: string;
    selectedEditorDetail: string;
    documentsContainment: string;
    shareDesktop: string;
    shareGeneratedResult: string;
    shareMobile: string;
    stepShell: {
      input: string;
      documents: string;
      share: string;
    };
  };
  shareGeneratedSessionPerception: {
    verdict: string;
    sourceHead: string;
    providerDispatchLiveClaimed: boolean;
    externalProviderCalled: boolean;
    exactSavedUserSessionReproduced: boolean;
    fixtureBoundary: string;
    resultLanding: Array<{
      label: string;
      verdict: string;
      viewport: string;
      resultSummaryTop: number | null;
      resultSummaryBottom: number | null;
    }>;
  };
  documentsLongFormIA: {
    verdict: string;
    sourceHead: string;
    routeSplitAloneAcceptedAsFix: boolean;
    routeSplitVerdict: string;
    providerDispatchLiveClaimed: boolean;
    dbMutationPerformed: boolean;
    allLauncherExposure: Array<{
      viewport: string;
      launcherExposureVerdict: string;
      allDocumentLongFormVerdict: string;
      selectedEditorDepthVerdict: string;
      coreDocButtonCount: number | null;
      allDocTabButtonCount: number | null;
      supportingLauncherMovesEditorOutOfView: boolean;
      actionsBottom: number | null;
      hazardBottom: number | null;
      horizontalOverflow: boolean;
      stickyOverlapCount: number | null;
    }>;
  };
  boundedWorkbenchDod: {
    verdict: string;
    routeSplitAloneAcceptedAsFix: boolean;
    acceptedStructure: string;
    designSystemTokenContract: string;
    documentsDesktopMaxScreens: number | null;
    documentsDesktopHardRedScreens: number | null;
    documentsMobileViewport: string;
    shareDesktopMinColumns: number | null;
    shareMobileStackAllowed: boolean;
    requiredViewports: string[];
    requiredThemes: string[];
    generatedFixtureAndSavedSessionSeparated: boolean;
    legacyBroadRegressionBoundary: {
      testFile: string;
      role: string;
      notAcceptedAsUxPassGate: boolean;
      desktopCollapsedSmokeScreens: number | null;
      desktopExpandedSmokeScreens: number | null;
      mobileCollapsedSmokeScreens: number | null;
      companionDodRequired: boolean;
    };
  };
  boundedWorkbenchCurrent: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    routeSplitAloneAcceptedAsFix: boolean;
    providerDispatchLiveClaimed: boolean;
    externalProviderCalled: boolean;
    dbMutationPerformed: boolean;
    detailDepthDebt: boolean;
    documentRedRows: Array<{
      route: string;
      theme: string;
      state: string;
      viewport: string;
      firstTaskVerdict: string;
      bodyHeightVerdict: string;
      longContentContainmentVerdict: string;
      bodyHeightRatio: number | null;
      firstActionBottom: number | null;
      firstHazardBottom: number | null;
      firstHazardVisibleHeight: number | null;
    }>;
    documentDetailDepthDebts: Array<{
      route: string;
      theme: string;
      state: string;
      viewport: string;
      workpackShellScrollRatio: number | null;
      detailDepthVerdict: string;
    }>;
    shareScopedRows: Array<{
      route: string;
      theme: string;
      sessionKind: string;
      viewport: string;
      overallVerdict: string;
      exactSavedSessionVerdict: string;
      rootWidthRatio: number | null;
      desktopXRegionCount: number | null;
      primaryBottom: number | null;
    }>;
    exactSavedSession: {
      verdict: string;
      sessionKind: string;
      exactSavedUserSessionReproduced: boolean;
      reason: string;
    };
  };
  nextSafeWorkWithoutApproval: string[];
};

type NextRunwayModule = {
  buildNorthstarNextRunway: (options: {
    rootDir: string;
    buildInfo: unknown;
    generatedAt?: string;
  }) => NextRunwayReport;
  renderNorthstarNextRunwayMarkdown: (report: NextRunwayReport) => string;
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
  writeJson(root, "evaluation/kosha-exact-promotion-packet-2026-07-22/report.json", {
    verdict: "EXACT_PROMOTION_PACKET_READY_FOR_OPERATOR_REVIEW",
    mutationPerformed: false,
    dbMutationPerformed: false,
    embeddingGenerationPerformed: false,
    exactPromotionPerformed: false,
    candidateCount: 8,
    operatorReviewReadiness: {
      packetReadyForReview: true,
      reviewChecklistComplete: false,
      exactTrustPromotionBlockedUntilChecklistComplete: true,
      perCandidateRequiredCheckCount: 5,
    },
    selectionPolicy: {
      selectedStableKeys: ["D-C-10", "D-C-11", "A-G-1", "A-G-15", "B-E-11", "B-E-9", "D-C-4", "E-G-4"],
    },
    forbiddenClaims: [
      "These candidates are already exact production evidence.",
      "The exact-kosha registry was expanded by this packet.",
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
  writeJson(root, "evaluation/share-generated-session-perception-2026-07-22/report.json", {
    verdict: "PASS_CURRENT_SOURCE_GENERATED_RESULT_FIXTURE",
    sourceHead: "TO_FILL",
    providerDispatchLiveClaimed: false,
    externalProviderCalled: false,
    exactSavedUserSessionReproduced: false,
    fixtureBoundary: "Browser route mocks block workpack/session/dispatch/log APIs.",
    results: [
      {
        label: "generated-result-desktop-short",
        verdict: "PASS",
        viewport: { width: 1440, height: 723 },
        resultSummary: { top: 303, bottom: 347 },
      },
      {
        label: "generated-result-desktop",
        verdict: "PASS",
        viewport: { width: 1440, height: 900 },
        resultSummary: { top: 775, bottom: 819 },
      },
      {
        label: "generated-result-mobile",
        verdict: "PASS",
        viewport: { width: 390, height: 844 },
        resultSummary: { top: 784, bottom: 828 },
      },
    ],
  });
  writeJson(root, "evaluation/documents-long-form-ia-2026-07-22/report.json", {
    verdict: "PASS_CURRENT_SOURCE_LOCAL_PRODUCTION",
    sourceHead: "TO_FILL",
    providerDispatchLiveClaimed: false,
    dbMutationPerformed: false,
    routeSplitAloneAcceptedAsFix: false,
    routeSplitVerdict: "PASS_ORIENTATION_ONLY",
    results: [
      {
        state: "all 12 document launcher exposure",
        viewport: { label: "desktop-short-1440x723", width: 1440, height: 723 },
        verdicts: {
          launcherExposureVerdict: "PASS",
          allDocumentLongFormVerdict: "PASS",
          selectedEditorDepthVerdict: "PASS",
        },
        metrics: {
          coreDocButtonCount: 3,
          allDocTabButtonCount: 12,
          supportingLauncherMovesEditorOutOfView: false,
          sectionActionsBottom: 405,
          firstHazardFieldBottom: 662,
          horizontalOverflow: false,
          stickyOverlapCount: 0,
        },
      },
      {
        state: "all 12 document launcher exposure",
        viewport: { label: "desktop-1440x900", width: 1440, height: 900 },
        verdicts: {
          launcherExposureVerdict: "PASS",
          allDocumentLongFormVerdict: "PASS",
          selectedEditorDepthVerdict: "PASS",
        },
        metrics: {
          coreDocButtonCount: 3,
          allDocTabButtonCount: 12,
          supportingLauncherMovesEditorOutOfView: false,
          sectionActionsBottom: 452,
          firstHazardFieldBottom: 709,
          horizontalOverflow: false,
          stickyOverlapCount: 0,
        },
      },
      {
        state: "all 12 document launcher exposure",
        viewport: { label: "mobile-390x844", width: 390, height: 844 },
        verdicts: {
          launcherExposureVerdict: "PASS",
          allDocumentLongFormVerdict: "PASS",
          selectedEditorDepthVerdict: "PASS",
        },
        metrics: {
          coreDocButtonCount: 3,
          allDocTabButtonCount: 12,
          supportingLauncherMovesEditorOutOfView: false,
          sectionActionsBottom: 667,
          firstHazardFieldBottom: 793,
          horizontalOverflow: false,
          stickyOverlapCount: 0,
        },
      },
    ],
  });
  writeJson(root, "evaluation/workspace-bounded-workbench-dod-2026-07-22/report.json", {
    verdict: "DOD_RECORDED_NOT_A_PASS_CLAIM",
    routeSplitAloneAcceptedAsFix: false,
    acceptedStructure: "three-step shell plus first-viewport cockpit plus selected-only bounded workbench plus progressive drilldown",
    designSystemTokenContract: "Use existing primitive-to-semantic-to-component tokens for shell, rail, card, editor, detail-pane, and action-rail surfaces; no wholesale globals rewrite.",
    acceptance: {
      documents: {
        desktopViewport: "1440x723",
        desktopMaxScreens: 1.5,
        desktopHardRedScreens: 2,
        mobileViewport: "390x723",
      },
      shareResult: {
        desktopViewport: "1440x723",
        desktopMinColumns: 2,
        mobileStackAllowed: true,
      },
    },
    evidenceRequirements: {
      requiredViewports: ["1440x723", "390x723"],
      requiredThemes: ["day", "night"],
      generatedFixtureAndSavedSessionSeparated: true,
    },
    legacyBroadRegressionBoundary: {
      testFile: "tests\\workspace-layout-regression.test.ts",
      role: "broad no-overflow/editor-flow smoke, not a Documents long-form UX pass gate",
      notAcceptedAsUxPassGate: true,
      desktopCollapsedSmokeScreens: 6.5,
      desktopExpandedSmokeScreens: 10,
      mobileCollapsedSmokeScreens: 3.4,
      companionDodRequired: true,
    },
  });
  writeJson(root, "evaluation/workspace-bounded-workbench-current-2026-07-22/report.json", {
    verdict: "PARTIAL_OR_RED_LIVE_PRODUCTION_MEASURED",
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
    productionBuild: { commitSha: "TO_FILL" },
    routeSplitAloneAcceptedAsFix: false,
    providerDispatchLiveClaimed: false,
    externalProviderCalled: false,
    dbMutationPerformed: false,
    documents: [
      {
        metrics: {
          route: "/documents?theme=day",
          theme: "day",
          state: "default",
          viewport: "390x723",
          bodyHeightRatio: 1,
          firstActionBottom: 662,
          firstHazardBottom: 788,
          firstHazardVisibleHeight: 0,
        },
        verdicts: {
          overallVerdict: "RED",
          firstTaskVerdict: "RED",
          bodyHeightVerdict: "PASS",
          longContentContainmentVerdict: "PASS",
        },
      },
    ],
    share: [
      {
        metrics: {
          route: "/workspace?share&theme=day",
          theme: "day",
          sessionKind: "generated",
          viewport: "1440x723",
          rootWidthRatio: 0.82,
          desktopXRegionCount: 3,
          primaryBottom: 389,
        },
        verdicts: {
          overallVerdict: "PASS_SCOPED",
          desktopWorkbenchVerdict: "PASS",
          exactSavedSessionVerdict: "MISSING_EVIDENCE",
        },
      },
    ],
    exactSavedSession: {
      sessionKind: "saved-exact",
      exactSavedUserSessionReproduced: false,
      verdict: "MISSING_EVIDENCE",
      reason: "No concrete production share session URL was available.",
    },
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

function pointLiveRollupAtHeadWithLive(root: string, head: string, liveCommit: string): void {
  writeJson(root, "evaluation/northstar-live-rollup-2026-07-20/report.json", {
    head,
    liveBuildInfo: { commitSha: liveCommit },
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
    expect(report.koshaExactPromotionPacket).toMatchObject({
      verdict: "EXACT_PROMOTION_PACKET_READY_FOR_OPERATOR_REVIEW",
      candidateCount: 8,
      selectedStableKeys: ["D-C-10", "D-C-11", "A-G-1", "A-G-15", "B-E-11", "B-E-9", "D-C-4", "E-G-4"],
      packetReadyForReview: true,
      reviewChecklistComplete: false,
      exactTrustPromotionBlockedUntilChecklistComplete: true,
      perCandidateRequiredCheckCount: 5,
      mutationPerformed: false,
      dbMutationPerformed: false,
      embeddingGenerationPerformed: false,
      exactPromotionPerformed: false,
    });
    expect(report.koshaExactPromotionPacket.forbiddenClaims).toContain(
      "The exact-kosha registry was expanded by this packet.",
    );
    expect(report.nextSafeWorkWithoutApproval).toContain(
      "use the KOSHA exact promotion packet as the bounded operator-review set and run scripts/kosha_exact_promotion_review_gate.mjs on the human review input before any exact-trust promotion",
    );
    expect(report.uiInterpretation).toMatchObject({
      routeSplitAloneAcceptedAsFix: false,
      acceptedStructure: "three-step app shell plus first-viewport cockpit plus bounded drilldown/detail panes",
      documentsDefaultCockpit: "first actionable cockpit is live-proven; do not phrase this as documents page height fixed or the whole Documents page shortened",
      documentsRemainingDebt: "full 12-document authoring polish remains; the all-12 launcher exposure is now bounded navigation in current evidence, while raw/full document text must stay secondary drilldown rather than serial page content and the local workbench shell ratio target remains <= 3",
      shareDesktop: "current measured Workspace Share and invited recipient routes pass desktop workbench width/region geometry; exact saved/generated user sessions that still feel mobile-like require their own width-ratio/grid repro before product changes, and desktop must not regress into a mobile card stack",
      shareGeneratedResult: "current-source generated provider-result fixture keeps the result summary inside 1440x723, 1440x900, and 390x844 after the short desktop landing fix; exact saved user sessions still require their own repro if reported",
    });
    expect(report.shareGeneratedSessionPerception).toMatchObject({
      verdict: "PASS_CURRENT_SOURCE_GENERATED_RESULT_FIXTURE",
      providerDispatchLiveClaimed: false,
      externalProviderCalled: false,
      exactSavedUserSessionReproduced: false,
    });
    expect(report.shareGeneratedSessionPerception.resultLanding).toContainEqual({
      label: "generated-result-desktop-short",
      verdict: "PASS",
      viewport: "1440x723",
      resultSummaryTop: 303,
      resultSummaryBottom: 347,
    });
    expect(report.uiInterpretation.documentsContainment).toContain("selected-only bounded workbench");
    expect(report.uiInterpretation.selectedEditorDetail).toContain("desktop 1440x900");
    expect(report.uiInterpretation.structuralAnswer).toContain("bounded IA/density wave");
    expect(report.uiInterpretation.structuralAnswer).toContain("default exposure budget");
    expect(report.uiInterpretation.stepShell.documents).toContain("full 12-document bodies remain selected-only drilldown");
    expect(report.documentsLongFormIA).toMatchObject({
      verdict: "PASS_CURRENT_SOURCE_LOCAL_PRODUCTION",
      routeSplitAloneAcceptedAsFix: false,
      routeSplitVerdict: "PASS_ORIENTATION_ONLY",
      providerDispatchLiveClaimed: false,
      dbMutationPerformed: false,
    });
    expect(report.documentsLongFormIA.allLauncherExposure).toHaveLength(3);
    expect(report.documentsLongFormIA.allLauncherExposure).toContainEqual(expect.objectContaining({
      viewport: "mobile-390x844",
      launcherExposureVerdict: "PASS",
      allDocumentLongFormVerdict: "PASS",
      selectedEditorDepthVerdict: "PASS",
      coreDocButtonCount: 3,
      allDocTabButtonCount: 12,
      supportingLauncherMovesEditorOutOfView: false,
      actionsBottom: 667,
      hazardBottom: 793,
      horizontalOverflow: false,
      stickyOverlapCount: 0,
    }));
    expect(report.boundedWorkbenchDod).toMatchObject({
      verdict: "DOD_RECORDED_NOT_A_PASS_CLAIM",
      routeSplitAloneAcceptedAsFix: false,
      documentsDesktopMaxScreens: 1.5,
      documentsDesktopHardRedScreens: 2,
      documentsMobileViewport: "390x723",
      shareDesktopMinColumns: 2,
      shareMobileStackAllowed: true,
      generatedFixtureAndSavedSessionSeparated: true,
    });
    expect(report.boundedWorkbenchDod.requiredThemes).toEqual(["day", "night"]);
    expect(report.boundedWorkbenchDod.legacyBroadRegressionBoundary).toMatchObject({
      testFile: "tests\\workspace-layout-regression.test.ts",
      notAcceptedAsUxPassGate: true,
      desktopCollapsedSmokeScreens: 6.5,
      desktopExpandedSmokeScreens: 10,
      mobileCollapsedSmokeScreens: 3.4,
      companionDodRequired: true,
    });
    expect(report.boundedWorkbenchDod.legacyBroadRegressionBoundary.role).toContain("not a Documents long-form UX pass gate");
    expect(report.boundedWorkbenchCurrent).toMatchObject({
      verdict: "PARTIAL_OR_RED_LIVE_PRODUCTION_MEASURED",
      productionCommit: "TO_FILL",
      routeSplitAloneAcceptedAsFix: false,
      providerDispatchLiveClaimed: false,
      externalProviderCalled: false,
      dbMutationPerformed: false,
    });
    expect(report.boundedWorkbenchCurrent.documentRedRows).toContainEqual(expect.objectContaining({
      route: "/documents?theme=day",
      viewport: "390x723",
      firstTaskVerdict: "RED",
      bodyHeightVerdict: "PASS",
      longContentContainmentVerdict: "PASS",
      firstHazardVisibleHeight: 0,
    }));
    expect(report.boundedWorkbenchCurrent.shareScopedRows).toContainEqual(expect.objectContaining({
      route: "/workspace?share&theme=day",
      sessionKind: "generated",
      overallVerdict: "PASS_SCOPED",
      exactSavedSessionVerdict: "MISSING_EVIDENCE",
      rootWidthRatio: 0.82,
      desktopXRegionCount: 3,
    }));
    expect(report.boundedWorkbenchCurrent.exactSavedSession).toMatchObject({
      verdict: "MISSING_EVIDENCE",
      sessionKind: "saved-exact",
      exactSavedUserSessionReproduced: false,
    });
    expect(report.nextSafeWorkWithoutApproval).toContain(
      "keep the next UI product wave framed as bounded IA/density: default exposure budget, selected-only Documents workbench, Documents shell ratio <= 3, and exact-session desktop Share workbench proof",
    );
    expect(report.nextSafeWorkWithoutApproval).toContain(
      "keep UI follow-up scoped to mobile Documents detail-depth debt or reproduced exact-session desktop Share full-workbench perception issues",
    );
    expect(report.nextSafeWorkWithoutApproval).toContain(
      "promote the bounded-workbench current-source proof to live only after production /api/build-info reaches the product/evidence head and the live probe is rerun",
    );
    expect(report.sourceHeadLivePending).toBe(false);
    expect(report.boundedWorkbenchSourceIncludedInLive).toBe(false);
    expect(report.boundedWorkbenchCurrentLivePending).toBe(true);
  });

  it("treats a bounded-workbench source ancestor as included in live", async () => {
    const { buildNorthstarNextRunway } = await loadNextRunwayModule();
    const { root, firstHead, secondHead } = createFixtureRoot();
    pointLiveRollupAt(root, secondHead);
    writeJson(root, "evaluation/workspace-bounded-workbench-current-2026-07-22/report.json", {
      verdict: "PASS_LIVE_PRODUCTION_SCOPED_WITH_EXACT_SESSION_GAP",
      sourceHead: firstHead,
      productionCommit: firstHead,
      productionBuild: { commitSha: firstHead },
      routeSplitAloneAcceptedAsFix: false,
      providerDispatchLiveClaimed: false,
      externalProviderCalled: false,
      dbMutationPerformed: false,
      documents: [],
      share: [],
      exactSavedSession: {
        sessionKind: "saved-exact",
        exactSavedUserSessionReproduced: false,
        verdict: "MISSING_EVIDENCE",
        reason: "No concrete production share session URL was available.",
      },
    });
    const report = buildNorthstarNextRunway({
      rootDir: root,
      buildInfo: { commitSha: secondHead },
      generatedAt: "2026-07-22T00:00:00.000Z",
    });

    expect(report.productionCommit).toBe(secondHead);
    expect(report.boundedWorkbenchCurrent.sourceHead).toBe(firstHead);
    expect(report.boundedWorkbenchSourceIncludedInLive).toBe(true);
    expect(report.boundedWorkbenchCurrentLivePending).toBe(false);
    expect(report.boundedWorkbenchCurrent.exactSavedSession).toMatchObject({
      verdict: "MISSING_EVIDENCE",
      exactSavedUserSessionReproduced: false,
    });
  });

  it("keeps bounded workbench detail-depth debt separate from first-task pass and exact saved Share evidence", async () => {
    const { buildNorthstarNextRunway, renderNorthstarNextRunwayMarkdown } = await loadNextRunwayModule();
    const { root, secondHead } = createFixtureRoot();
    pointLiveRollupAt(root, secondHead);
    writeJson(root, "evaluation/workspace-bounded-workbench-current-2026-07-22/report.json", {
      verdict: "PARTIAL_LIVE_PRODUCTION_SCOPED_DETAIL_DEPTH_DEBT_WITH_EXACT_SESSION_GAP",
      sourceHead: secondHead,
      productionCommit: secondHead,
      productionBuild: { commitSha: secondHead },
      routeSplitAloneAcceptedAsFix: false,
      providerDispatchLiveClaimed: false,
      externalProviderCalled: false,
      dbMutationPerformed: false,
      documents: [
        {
          metrics: {
            route: "/documents?theme=day",
            theme: "day",
            state: "default",
            viewport: "1440x723",
            bodyHeightRatio: 1.07,
            workpackShellScrollRatio: 4.28,
            firstActionBottom: 452,
            firstHazardBottom: 709,
            firstHazardVisibleHeight: 50,
          },
          verdicts: {
            overallVerdict: "PASS",
            firstTaskVerdict: "PASS",
            bodyHeightVerdict: "PASS",
            longContentContainmentVerdict: "PASS",
            detailDepthVerdict: "PARTIAL",
          },
        },
      ],
      documentDetailDepthDebts: [
        {
          route: "/documents?theme=day",
          theme: "day",
          state: "default",
          viewport: "1440x723",
          workpackShellScrollRatio: 4.28,
          detailDepthVerdict: "PARTIAL",
        },
      ],
      share: [
        {
          metrics: {
            route: "/workspace?share&theme=day",
            theme: "day",
            sessionKind: "generated",
            viewport: "1440x723",
            rootWidthRatio: 0.82,
            desktopXRegionCount: 3,
            primaryBottom: 389,
          },
          verdicts: {
            overallVerdict: "PASS_SCOPED",
            desktopWorkbenchVerdict: "PASS",
            exactSavedSessionVerdict: "MISSING_EVIDENCE",
          },
        },
      ],
      exactSavedSession: {
        sessionKind: "saved-exact",
        exactSavedUserSessionReproduced: false,
        verdict: "MISSING_EVIDENCE",
        reason: "No concrete production share session URL was available.",
      },
    });

    const report = buildNorthstarNextRunway({
      rootDir: root,
      buildInfo: { commitSha: secondHead },
      generatedAt: "2026-07-22T00:00:00.000Z",
    });
    const markdown = renderNorthstarNextRunwayMarkdown(report);

    expect(report.boundedWorkbenchCurrent).toMatchObject({
      verdict: "PARTIAL_LIVE_PRODUCTION_SCOPED_DETAIL_DEPTH_DEBT_WITH_EXACT_SESSION_GAP",
      detailDepthDebt: true,
      documentRedRows: [],
    });
    expect(report.boundedWorkbenchCurrent.documentDetailDepthDebts).toContainEqual({
      route: "/documents?theme=day",
      theme: "day",
      state: "default",
      viewport: "1440x723",
      workpackShellScrollRatio: 4.28,
      detailDepthVerdict: "PARTIAL",
    });
    expect(report.boundedWorkbenchCurrent.exactSavedSession).toMatchObject({
      verdict: "MISSING_EVIDENCE",
      exactSavedUserSessionReproduced: false,
    });
    expect(markdown).toContain("first-task/body containment rows pass");
    expect(markdown).toContain("local workbench detail-depth debt");
    expect(markdown).toContain("exact saved session evidence is missing");
  });

  it("keeps broad workspace height smoke separate from the bounded workbench DoD", () => {
    const workspaceRegression = fs.readFileSync(
      path.resolve("tests", "workspace-layout-regression.test.ts"),
      "utf8",
    );
    const dod = JSON.parse(fs.readFileSync(
      path.resolve("evaluation", "workspace-bounded-workbench-dod-2026-07-22", "report.json"),
      "utf8",
    )) as {
      routeSplitAloneAcceptedAsFix: boolean;
      acceptance: {
        documents: {
          desktopHardRedScreens: number;
        };
      };
      legacyBroadRegressionBoundary: {
        notAcceptedAsUxPassGate: boolean;
        desktopExpandedSmokeScreens: number;
        companionDodRequired: boolean;
      };
    };

    expect(workspaceRegression).toContain("viewportHeight * 10");
    expect(workspaceRegression).toContain("Broad editor-flow smoke only");
    expect(dod.routeSplitAloneAcceptedAsFix).toBe(false);
    expect(dod.acceptance.documents.desktopHardRedScreens).toBe(2);
    expect(dod.legacyBroadRegressionBoundary).toMatchObject({
      notAcceptedAsUxPassGate: true,
      desktopExpandedSmokeScreens: 10,
      companionDodRequired: true,
    });
    expect(dod.legacyBroadRegressionBoundary.desktopExpandedSmokeScreens).toBeGreaterThan(
      dod.acceptance.documents.desktopHardRedScreens,
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

  it("keeps an evidence-only source head pending after refreshing the rollup from that source head", async () => {
    const { buildNorthstarNextRunway } = await loadNextRunwayModule();
    const { root, secondHead } = createFixtureRoot();
    writeJson(root, "evaluation/evidence-pointer/report.json", { sourceHead: secondHead });
    const thirdHead = commitAll(root, "evidence only");
    pointLiveRollupAtHeadWithLive(root, thirdHead, secondHead);
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
