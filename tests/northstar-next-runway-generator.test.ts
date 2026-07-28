import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

type NextRunwayReport = {
  provenCurrentState: string[];
  noticeState: Array<{
    gate: string;
    state: string;
    reason: string;
  }>;
  sourceHead: string;
  productionCommit: string;
  latestEvidenceCommitLive: boolean;
  sourceHeadLivePending: boolean;
  currentHeadIsEvidenceOnlyPending: boolean;
  sourceHeadHasProductChanges: boolean;
  sourcePendingChangedPaths: string[];
  liveExactEvidenceCommit: string;
  liveRollupMatchesProduction: boolean;
  boundedWorkbenchSourceIncludedInLive: boolean;
  boundedWorkbenchCurrentLivePending: boolean;
  launchReadiness: {
    documentCoverage: {
      expectedCount: number;
      presentCount: number;
      missing: string[];
      present: string[];
    };
  };
  liveDocumentQualityMatrix: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    sourceHeadMatchesProduction: boolean;
    scenarioCount: number;
    livePassed: number;
    liveFailed: number;
    structuredRiskRowsPresent: boolean;
    structuredRiskControlsDistinct: boolean;
    foreignWorkerScenarioRelevance: boolean;
    dbMutationPerformed: boolean;
    shareSessionCreated: boolean;
    providerDispatchLiveClaimed: boolean;
    externalProviderCalled: boolean;
    exactSavedShareSessionReproduced: boolean;
  };
  liveDocumentQualityStressMatrix: {
    verdict: string;
    sourceHead: string;
    productCommit: string;
    productionCommit: string;
    productCommitIncludedInProduction: boolean;
    livePassed: number;
    liveFailed: number;
    dbMutationPerformed: boolean;
    shareSessionCreated: boolean;
    providerDispatchPerformed: boolean;
    exactSavedShareSessionReproduced: boolean;
  };
  liveDocumentFieldIsolation: {
    verdict: string;
    sourceHead: string;
    evidenceHeadAtLiveVerification: string;
    productionCommit: string;
    livePassed: number;
    liveFailed: number;
    liveAfterDeploymentPending: boolean;
    dbMutationPerformed: boolean;
    shareSessionCreated: boolean;
    providerDispatchCalled: boolean;
    exactSavedShareSessionReproduced: boolean;
  };
  liveKoshaExactMaterialization: {
    verdict: string;
    sourceHead: string;
    productCommit: string;
    productionCommit: string;
    productCommitMatchesProduction: boolean;
    livePassed: number;
    liveFailed: number;
    liveAfterDeploymentPending: boolean;
    dbMutationPerformed: boolean;
    shareSessionCreated: boolean;
    providerDispatchCalled: boolean;
    exactTrustRegistryExpanded: boolean;
  };
  liveDocumentWordingReview: {
    verdict: string;
    sourceHead: string;
    productCommit: string;
    productionCommit: string;
    livePassed: number;
    liveFailed: number;
    liveAfterDeploymentPending: boolean;
    dbMutationPerformed: boolean;
    shareSessionCreated: boolean;
    providerDispatchCalled: boolean;
    exactSavedShareReproduced: boolean;
    humanReviewStillRequired: boolean;
  };
  liveDocumentBroadReview: {
    verdict: string;
    sourceHead: string;
    productCommit: string;
    productionCommit: string;
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
    sourceHead: string;
    productionCommit: string;
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
    exactSavedShareVerdict: string;
  };
  liveDocumentEditorialDuplicateClassification: {
    verdict: string;
    reviewedDocumentSurfaceCount: number;
    beforeGenericTemplateOveruseCount: number;
    liveGenericTemplateOveruseCount: number;
    exactLineOveruseCount: number;
    nearDuplicateLineOveruseCount: number;
    humanReviewCompleted: boolean;
    exactSavedShareVerdict: string;
  };
  liveDocumentEditorialNearClassification: {
    verdict: string;
    beforeNearDuplicateLineOveruseCount: number;
    beforeHumanReviewRequiredCount: number;
    livePassed: number;
    liveFailed: number;
    liveNearDuplicateLineOveruseCount: number;
    liveHumanReviewRequiredCount: number;
    rolePrefixVariantCount: number;
    independentContextCount: number;
    hazardConsistencyCount: number;
    controlConsistencyCount: number;
    humanReviewCompleted: boolean;
    exactSavedShareVerdict: string;
  };
  productCapabilityTruth: {
    verdict: string;
    dispatchMode: string;
    dispatchReason: string;
    briefingEmailReady: boolean;
    photoVisionReady: boolean;
    photoAcceptedOnly: boolean;
    aiModes: string[];
    providerDispatchCalled: boolean;
    photoAnalysisPostCalled: boolean;
    exactSavedShareVerdict: string;
    documentsShareIaVerdict: string;
  };
  dependencySecurityRemediation: {
    verdict: string;
    beforeVulnerablePackages: number;
    liveVulnerablePackages: number;
    liveHigh: number;
    liveModerate: number;
    fullRepositorySecurityScanCompleted: boolean;
    exactSavedShareVerdict: string;
  };
  hermesOpenclaw: {
    verdict: string;
    trustedTransportWired: boolean;
    durableAttemptLedgerWired: boolean;
    readinessKeepsLedgerOpen: boolean;
    liveExecutionClaimed: boolean;
    remainingRequirements: string[];
  };
  hermesKnowledgeReviewAuthorityUi: {
    verdict: string;
    localPassed: number;
    localViewportCount: number;
    livePassed: number;
    liveViewportCount: number;
    sourceOrder: string[];
    humanReviewRequired: boolean;
    machineEvidenceReplacesHumanReview: boolean;
    tenantMemoryPublicPromotionAllowed: boolean;
    siteManagerAcceptanceRequiredBeforeWorkpackUse: boolean;
    dbMutationPerformed: boolean;
    providerDispatchCalled: boolean;
    shareSessionCreated: boolean;
    ontologyPublicationPerformed: boolean;
    exactSavedShareVerdict: string;
    llmWikiPublication: string;
    supabaseRlsLaunchIsolation: string;
  };
  liveDocumentSeedProfileIsolation: {
    verdict: string;
    sourceHead: string;
    productCommit: string;
    productionCommit: string;
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
    documentsGeneratedCurrentWorkpack: string;
    shareDesktop: string;
    shareGeneratedResult: string;
    shareRecipientLongContent: string;
    shareMobile: string;
    stepShell: {
      input: string;
      documents: string;
      share: string;
    };
  };
  documentsCockpitWorkbenchGeometry: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    routeSplitAloneAcceptedAsFix: boolean;
    rows: Array<{
      viewport: string;
      overallVerdict: string;
      coreButtons: number | null;
      uniqueDocumentKeyCount: number | null;
      visibleDocumentButtonCount: number | null;
      supportingButtonCount: number | null;
      visibleSupportingButtonCount: number | null;
      legacyIndexDisplay: string;
      detailsOpen: boolean | null;
    }>;
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
  shareRecipientLongContentFixture: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    route: string;
    sessionKind: string;
    routeSplitAloneAcceptedAsFix: boolean;
    acceptedStructure: string;
    acceptance: {
      desktopMinRegions: number | null;
      mobileMaxRootHeightRatio: number | null;
      confirmationMustRemainInFirstViewport: boolean;
      longTaskMustUseLocalScroll: boolean;
      documentGroupCollapsedByDefault: boolean;
      exactSavedSessionRequiredForUserSpecificPass: boolean;
    };
    exactSavedUserSessionReproduced: boolean;
    exactSavedSessionVerdict: string;
    dbMutationPerformed: boolean;
    shareSessionCreated: boolean;
    providerDispatchLiveClaimed: boolean;
    externalProviderCalled: boolean;
    rows: Array<{
      theme: string;
      viewport: string;
      overallVerdict: string;
      exactSavedSessionVerdict: string;
      pageHeightRatio: number | null;
      rootWidthRatio: number | null;
      rootHeightRatio: number | null;
      desktopXRegionCount: number | null;
      confirmationBottom: number | null;
      taskBodyContained: boolean;
      documentsPanelOpen: boolean;
      previewContainedCount: number | null;
      collapsedDocumentCount: number | null;
    }>;
  };
  shareExactSessionBoundary: {
    verdict: string;
    sourceHead: string;
    liveCommit: string;
    exactSavedUserSessionReproduced: boolean;
    exactSavedSessionRequiredForUserSpecificPass: boolean;
    dbMutationPerformed: boolean;
    providerDispatchLiveClaimed: boolean;
    externalProviderCalled: boolean;
    safeReadStatus: number | null;
    safeReadMessage: string;
  };
  sharePublicSessionStorageReadiness: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    dbMutationPerformed: boolean;
    providerDispatchLiveClaimed: boolean;
    externalProviderCalled: boolean;
    livePublicApiStatus: number | null;
    workpacksReadable: boolean;
    shareSessionsReadable: boolean;
    shareSessionsErrorCode: string;
    shareSessionsErrorMessage: string;
  };
  sharePublicSessionStorageApproval: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    exactSavedShareSessionVerdict: string;
    migrationPath: string;
    broadMigrationRequiresOperatorReview: boolean;
    operatorApprovalRequiredBeforeMigration: boolean;
    schemaMutationAuthorized: boolean;
    dbMutationPerformed: boolean;
    shareSessionCreated: boolean;
    shareSessionCreationWouldInsertWorkpackShareSessions: boolean;
    concreteProductionShareUrlProvided: boolean;
    providerDispatchLiveClaimed: boolean;
    externalProviderCalled: boolean;
    workpackShareSessionsReadable: boolean;
    workpackShareSessionsErrorCode: string;
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
    generatedCurrentWorkpackMeasured: boolean;
    generatedDocumentRows: Array<{
      route: string;
      theme: string;
      viewport: string;
      overallVerdict: string;
      bodyHeightRatio: number | null;
      workpackShellScrollRatio: number | null;
      firstActionBottom: number | null;
      firstHazardBottom: number | null;
      stickyOverlapCount: number | null;
      supportingDocsOpenDefault: boolean;
    }>;
    selectedSectionRows: Array<{
      route: string;
      theme: string;
      viewport: string;
      overallVerdict: string;
      workpackShellScrollRatio: number | null;
      sectionTabCount: number | null;
      selectedSectionTabCount: number | null;
      mountedSectionDetailCount: number | null;
      mountedSectionTextareaCount: number | null;
      mountedSourceTextareaCount: number | null;
      outsideElements: number | null;
    }>;
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
      {
        id: "kosha_exact_promotion_review_gate",
        state: "approval_gated",
        evidencePath: "evaluation/kosha-exact-promotion-review-gate-2026-07-22/report.json",
        readyForOperatorReview: true,
        currentSafetyLock: "human_review_incomplete_no_mutation",
        approvalNeeded: ["complete every required candidate review checklist"],
        forbiddenUntilApproved: ["KOSHA exact-trust registry expanded beyond current exact pins"],
      },
    ],
  });
  writeJson(root, "evaluation/hermes-openclaw-runtime-current-gate-2026-07-20/report.json", {
    verdict: "adapter_boundary_pass_live_execution_not_claimed",
    focusedTests: { status: "pass" },
    liveUnauthenticatedBrokerSmoke: { code: "AUTH_REQUIRED" },
    sourceContract: {
      trustedTransportWired: true,
      durableAttemptLedgerWired: false,
      readinessKeepsLedgerOpen: true,
    },
    liveExecutionReadiness: {
      claimed: false,
      requires: [
        "durable cross-instance attempt and terminal ledger implementation",
        "authenticated live execution canary after durable ledger approval",
      ],
    },
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
    documentCoverage: {
      expectedCount: 12,
      presentCount: 12,
      missing: [],
      present: [
        "workpackSummaryDraft",
        "riskAssessmentDraft",
        "workPlanDraft",
        "workPermitDraft",
        "tbmBriefing",
        "tbmLogDraft",
        "safetyEducationRecordDraft",
        "emergencyResponseDraft",
        "photoEvidenceDraft",
        "foreignWorkerBriefing",
        "foreignWorkerTransmission",
        "kakaoMessage",
      ],
    },
  });
  writeJson(root, "evaluation/document-quality-grounding-current-gate-2026-07-19/report.json", {
    verdict: "PASS_CURRENT_SOURCE_DOCUMENT_QUALITY_GROUNDING_CONTRACT",
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
    focusedTests: {
      status: "pass",
      testsPassed: 135,
    },
    verifiedContracts: {
      sifKoshaLawBeforeLlmProse: true,
      llmRoleNaturalizeOnly: true,
      providerAuthoredUnsupportedHazardsRejected: true,
      qualityContractBlocksIncompleteOutputs: true,
      koshaSupportingEvidenceIsNotLawMandate: true,
      exactKoshaMaterializationCovered: true,
    },
    boundaries: {
      liveModelSampleExcellenceClaimed: false,
      providerDispatchLiveClaimed: false,
      dbMutationPerformed: false,
      schemaMigrationPerformed: false,
      llmWikiPublicationPerformed: false,
      exactKoshaRegistryMutationPerformed: false,
    },
  });
  writeJson(root, "evaluation/live-document-quality-matrix-2026-07-24/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_MULTI_SCENARIO_DOCUMENT_QUALITY",
    sourceHead: "TO_FILL",
    productionCommitAtGeneration: "TO_FILL",
    sourceHeadMatchesProduction: true,
    scenarios: ["one", "two", "three", "four", "five"],
    afterLive: {
      pass: 5,
      fail: 0,
      structuredRiskRowsPresent: true,
      structuredRiskControlsDistinct: true,
      foreignWorkerScenarioRelevance: true,
    },
    boundaries: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchLiveClaimed: false,
      externalProviderCalled: false,
      exactSavedShareSessionReproduced: false,
    },
  });
  writeJson(root, "evaluation/live-document-quality-stress-matrix-2026-07-24/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_STRESS_MATRIX",
    sourceHead: "TO_FILL",
    productCommit: "TO_FILL",
    productionCommitAtGeneration: "TO_FILL",
    productCommitIncludedInProduction: true,
    afterLive: {
      total: 5,
      pass: 5,
      fail: 0,
    },
    boundaries: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchPerformed: false,
      exactSavedShareSessionReproduced: false,
    },
  });
  writeJson(root, "evaluation/live-document-field-isolation-2026-07-25/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_FIELD_ISOLATION",
    sourceHead: "TO_FILL",
    evidenceHeadAtLiveVerification: "TO_FILL",
    productionCommitAtLiveVerification: "TO_FILL",
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
    verdict: "PASS_LIVE_PRODUCTION_KOSHA_EXACT_MATERIALIZATION",
    sourceHead: "TO_FILL",
    productCommit: "TO_FILL",
    productionCommit: "TO_FILL",
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
    verdict: "PASS_LIVE_PRODUCTION_SYNTHETIC_WORDING_REVIEW",
    sourceHead: "TO_FILL",
    productCommit: "TO_FILL",
    productionCommitAfterDeployment: "TO_FILL",
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
    claimBoundary: {
      humanReviewStillRequired: true,
    },
  });
  writeJson(root, "evaluation/live-document-broad-review-2026-07-25/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_12_DELIVERABLE_BROAD_REVIEW",
    sourceHead: "TO_FILL",
    productCommit: "TO_FILL",
    productionCommit: "TO_FILL",
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
    verdict: "PASS_LIVE_PRODUCTION_SECONDARY_DOCUMENT_GROUNDING_CONTRACT",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
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
  writeJson(root, "evaluation/live-document-editorial-duplicate-classification-2026-07-25/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_EDITORIAL_DUPLICATE_CLASSIFICATION_REVIEWER_READY",
    productCommit: "TO_FILL",
    productionCommit: "TO_FILL",
    canonicalDocumentCount: 12,
    caseCount: 5,
    reviewedDocumentSurfaceCount: 60,
    humanReviewCompleted: false,
    beforeLive: { pass: 1, fail: 4, genericTemplateOveruseCount: 4 },
    afterLive: {
      sourceHead: "TO_FILL",
      pass: 5,
      fail: 0,
      genericTemplateOveruseCount: 0,
      exactLineOveruseCount: 31,
      nearDuplicateLineOveruseCount: 100,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactSavedShareReproduced: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      broadHumanWordingReviewRequired: true,
    },
  });
  writeJson(root, "evaluation/live-document-editorial-near-classification-2026-07-25/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_EDITORIAL_NEAR_DUPLICATE_CLASSIFICATION_REVIEWER_READY",
    sourceHead: "fixture-runner-sha",
    productionCommit: "fixture-sha",
    before: {
      nearDuplicateLineOveruseCount: 100,
      nearCategories: { "human-review-required": 54, "document-role-prefix-variant": 46 },
    },
    afterLive: {
      sourceHead: "fixture-runner-sha",
      productionCommit: "fixture-sha",
      total: 5,
      pass: 5,
      fail: 0,
      genericTemplateOveruseCount: 0,
      nearDuplicateLineOveruseCount: 100,
      nearCategories: {
        "document-role-prefix-variant": 81,
        "independent-document-context": 9,
        "cross-document-hazard-consistency": 8,
        "cross-document-control-consistency": 2,
        "human-review-required": 0,
      },
      humanReviewCompleted: false,
    },
    classificationContract: {
      findingsHiddenOrRemoved: false,
      genericTemplateOveruseFailsClosed: true,
      safetyConsistencyAutomaticallyFails: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactSavedShareReproduced: false,
    },
    remainingBoundaries: {
      humanReviewCompleted: false,
      broadHumanWordingReviewRequired: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/product-capability-truth-2026-07-25/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_PRODUCT_CAPABILITY_TRUTH",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    liveChecks: {
      providerDispatch: {
        mode: "preview_only",
        reason: "persistent_idempotency_unavailable",
      },
      briefingSettingsUnauthenticated: { emailReady: false },
      photoVisionReadiness: { ready: true, acceptedOnly: true },
    },
    uiChecks: {
      aiGenerationModes: { modes: ["template", "enhanced", "full"] },
    },
    mutationBoundary: {
      providerDispatchCalled: false,
      photoAnalysisPostCalled: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      documentsShareIaVerdict: "OPEN_SEPARATE_VIEWPORT_IA_WAVE",
    },
  });
  writeJson(root, "evaluation/dependency-security-remediation-2026-07-28/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_BOUNDED_DEPENDENCY_REMEDIATION_RESIDUALS_OPEN",
    sourceHead: "fixture-sha",
    productCommit: "fixture-product",
    productionBuild: {
      commitSha: "fixture-sha",
    },
    auditBefore: {
      totalVulnerablePackages: 19,
    },
    auditAfter: {
      totalVulnerablePackages: 9,
      high: 9,
      moderate: 0,
    },
    remainingBoundaries: {
      fullRepositorySecurityScanCompleted: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/hermes-knowledge-review-authority-ui-2026-07-25/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI",
    sourceHead: "fixture-sha",
    productCommit: "fixture-product",
    productionCommit: "fixture-sha",
    local: { viewportCount: 8, passedCount: 8, failedCount: 0 },
    afterLive: { viewportCount: 8, passedCount: 8, failedCount: 0 },
    authorityContract: {
      sourceOrder: ["SIF", "KOSHA", "law", "organization_history", "site_history", "external_context"],
      statutoryClaimsRequireLawProvenance: true,
      tenantMemoryPublicPromotionAllowed: false,
      siteManagerAcceptanceRequiredBeforeWorkpackUse: true,
      humanReviewRequired: true,
      machineEvidenceReplacesHumanReview: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      ontologyPublicationPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
    },
  });
  writeJson(root, "evaluation/live-document-seed-profile-isolation-2026-07-25/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_SEED_PROFILE_ISOLATION",
    sourceHead: "fixture-sha",
    productCommit: "fixture-product",
    productionCommit: "fixture-sha",
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
  writeJson(root, "evaluation/share-recipient-long-content-fixture-2026-07-25/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_LONG_CONTENT_FIXTURE_EXACT_SAVED_MISSING",
    sourceHead: "TO_FILL",
    productionBuild: { commitSha: "TO_FILL" },
    route: "/share/[sessionId]",
    sessionKind: "long-content-fixture",
    routeSplitAloneAcceptedAsFix: false,
    acceptedStructure: "first-viewport confirmation cockpit plus desktop multi-region workbench plus bounded internal task/message preview and collapsed document drilldown",
    acceptance: {
      desktopMinRegions: 2,
      mobileMaxRootHeightRatio: 1.5,
      confirmationMustRemainInFirstViewport: true,
      longTaskMustUseLocalScroll: true,
      documentGroupCollapsedByDefault: true,
      exactSavedSessionRequiredForUserSpecificPass: true,
    },
    exactSavedUserSessionReproduced: false,
    exactSavedSessionVerdict: "MISSING_EVIDENCE",
    dbMutationPerformed: false,
    shareSessionCreated: false,
    providerDispatchLiveClaimed: false,
    externalProviderCalled: false,
    rows: [
      {
        metrics: {
          theme: "day",
          viewport: "desktop-short-1440x723",
          pageHeightRatio: 1.33,
          rootWidthRatio: 0.84,
          rootHeightRatio: 0.99,
          desktopXRegionCount: 2,
          confirmationBottom: 529,
          taskBodyContained: true,
          documentsPanelOpen: false,
          previewContainedCount: 4,
          collapsedDocumentCount: 3,
        },
        verdicts: {
          overallVerdict: "PASS_SCOPED",
          exactSavedSessionVerdict: "MISSING_EVIDENCE",
        },
      },
    ],
  });
  writeJson(root, "evaluation/share-exact-session-boundary-2026-07-22/report.json", {
    verdict: "MISSING_EXACT_SAVED_SESSION_EVIDENCE_NO_MUTATION_BOUNDARY_CONFIRMED",
    sourceHead: "TO_FILL",
    liveCommit: "TO_FILL",
    exactSavedUserSessionReproduced: false,
    safeReadProbe: {
      status: 500,
      message: "공유 세션을 확인하지 못했습니다.",
    },
    safeMissingSessionReadVerdict: "RED_SERVER_ERROR_SHAPED_MISSING_SESSION",
    invalidReadProbe: {
      status: 400,
      message: "공유 세션 식별 형식이 올바르지 않습니다.",
    },
    safeInvalidSessionReadVerdict: "PASS_INVALID_ID_FAIL_CLOSED",
    boundary: {
      exactSavedSessionRequiredForUserSpecificPass: true,
      providerDispatchLiveClaimed: false,
      externalProviderCalled: false,
      dbMutationPerformed: false,
    },
  });
  writeJson(root, "evaluation/share-recipient-ack-approval-preflight-current-2026-07-19/report.json", {
    overall: "approval_ready_open",
    sourceSha: "TO_FILL",
    approvalRequired: true,
    liveDataMutationApproved: false,
    dbMutationPerformed: false,
    providerMessageSent: false,
    productionShareSessionCreated: false,
    productionReadConfirmationInserted: false,
    failedCheckIds: [],
  });
  writeJson(root, "evaluation/share-public-session-storage-readiness-2026-07-23/report.json", {
    verdict: "RED_PUBLIC_SHARE_SESSION_TABLE_MISSING_FROM_SCHEMA_CACHE_NO_MUTATION",
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
    dbMutationPerformed: false,
    providerDispatchLiveClaimed: false,
    externalProviderCalled: false,
    livePublicApiProbe: {
      status: 500,
      message: "공유 세션을 확인하지 못했습니다.",
    },
    serviceRoleReadOnlyProbe: {
      workpacks: {
        readable: true,
        dataLen: 1,
        error: null,
      },
      workpackShareSessionsFullSelect: {
        readable: false,
        dataLen: null,
        error: {
          code: "PGRST205",
          message: "Could not find the table 'public.workpack_share_sessions' in the schema cache",
        },
      },
    },
  });
  writeJson(root, "evaluation/share-public-session-storage-approval-2026-07-23/report.json", {
    verdict: "APPROVAL_REQUIRED_PUBLIC_SHARE_SESSION_STORAGE_MIGRATION_NO_MUTATION",
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
    exactSavedShareSessionVerdict: "MISSING_EVIDENCE",
    migration: {
      path: "supabase/migrations/010_commercial_operations.sql",
      sha256: "fixture-sha256",
      broadMigrationRequiresOperatorReview: true,
    },
    readinessBlocker: {
      workpackShareSessionsReadable: false,
      workpackShareSessionsErrorCode: "PGRST205",
    },
    approvalBoundary: {
      operatorApprovalRequiredBeforeMigration: true,
      schemaMutationAuthorized: false,
      dbMutationPerformed: false,
      shareSessionCreated: false,
      shareSessionCreationWouldInsertWorkpackShareSessions: true,
      concreteProductionShareUrlProvided: false,
      providerDispatchLiveClaimed: false,
      externalProviderCalled: false,
    },
  });
  writeJson(root, "evaluation/documents-long-form-ia-2026-07-22/report.json", {
    verdict: "PASS_CURRENT_SOURCE_LOCAL_PRODUCTION",
    sourceHead: "TO_FILL",
    providerDispatchLiveClaimed: false,
    dbMutationPerformed: false,
    routeSplitAloneAcceptedAsFix: false,
    wholeDocumentsPageShortClaimAllowed: false,
    fullTwelveDocumentAuthoringIaSolvedClaimAllowed: false,
    firstTaskCockpitProofAcceptedAsFullIaCompletion: false,
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
  writeJson(root, "evaluation/documents-cockpit-workbench-geometry-2026-07-22/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENTS_WORKBENCH",
    sourceHead: "TO_FILL",
    productionBuild: { commitSha: "TO_FILL", branch: "master", environment: "production" },
    routeSplitAloneAcceptedAsFix: false,
    rows: [
      {
        viewport: "1440x723",
        metrics: {
          bodyHeight: 723,
          horizontalOverflow: false,
          workbenchDisplay: "grid",
          workbenchColumnCount: 2,
          coreButtons: 3,
          uniqueDocumentKeyCount: 12,
          visibleDocumentButtonCount: 3,
          supportingButtonCount: 9,
          visibleSupportingButtonCount: 0,
          legacyIndexDisplay: "none",
          detailsOpen: false,
        },
        verdicts: { overallVerdict: "PASS" },
      },
      {
        viewport: "390x723",
        metrics: {
          bodyHeight: 728,
          horizontalOverflow: false,
          workbenchDisplay: "grid",
          workbenchColumnCount: 1,
          coreButtons: 3,
          uniqueDocumentKeyCount: 12,
          visibleDocumentButtonCount: 3,
          supportingButtonCount: 9,
          visibleSupportingButtonCount: 0,
          legacyIndexDisplay: "none",
          detailsOpen: false,
        },
        verdicts: { overallVerdict: "PASS" },
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
    generatedCurrentWorkpackMeasured: true,
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
      {
        metrics: {
          route: "/documents?theme=day",
          theme: "day",
          state: "generated-current-workpack",
          viewport: "1440x723",
          bodyHeightRatio: 1,
          workpackShellScrollRatio: 2.31,
          firstActionBottom: 321,
          firstHazardBottom: 578,
          stickyOverlapCount: 0,
          supportingDocsOpenDefault: false,
        },
        verdicts: {
          overallVerdict: "PASS",
          firstTaskVerdict: "PASS",
          bodyHeightVerdict: "PASS",
          longContentContainmentVerdict: "PASS",
          detailDepthVerdict: "PASS",
        },
      },
      {
        metrics: {
          route: "/documents?theme=day",
          theme: "day",
          state: "selected-workPlanDraft-section-detail",
          viewport: "390x723",
          workpackShellScrollRatio: 2.96,
          sectionTabCount: 6,
          selectedSectionTabCount: 1,
          mountedSectionDetailCount: 1,
          mountedSectionTextareaCount: 1,
          mountedSourceTextareaCount: 0,
          outsideElements: 0,
        },
        verdicts: {
          overallVerdict: "PASS",
          firstTaskVerdict: "PASS",
          bodyHeightVerdict: "PASS",
          longContentContainmentVerdict: "PASS",
          detailDepthVerdict: "PASS",
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
    expect(report.launchReadiness.documentCoverage).toMatchObject({
      expectedCount: 12,
      presentCount: 12,
      missing: [],
    });
    expect(report.launchReadiness.documentCoverage.present).toContain("workPermitDraft");
    expect(report.approvalGated.map((gate) => gate.gate)).toEqual([
      "share_recipient_ack_approval",
      "provider_dispatch_persistence",
      "supabase_rls_launch_isolation",
      "llm_wiki_publication",
      "sif_embedding_runtime",
      "kosha_exact_promotion_review_gate",
    ]);
    expect(report.approvalGated[0]).toMatchObject({
      state: "approval_gated",
      readyForOperatorReview: true,
      currentSafetyLock: "live_data_mutation_approval_required",
    });
    expect(report.koshaNextExactCandidateAudit).toMatchObject({
      verdict: "NEXT_EXACT_TRUST_CANDIDATES_IDENTIFIED_APPROVAL_FREE",
      exactPins: 3,
      acceptedSubsetItems: 234,
      metadataVerifiedNotExact: 231,
      mutationPerformed: false,
      dbMutationPerformed: false,
      embeddingGenerationPerformed: false,
    });
    expect(report.liveDocumentQualityMatrix).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_MULTI_SCENARIO_DOCUMENT_QUALITY",
      scenarioCount: 5,
      livePassed: 5,
      liveFailed: 0,
      sourceHeadMatchesProduction: true,
      structuredRiskRowsPresent: true,
      structuredRiskControlsDistinct: true,
      foreignWorkerScenarioRelevance: true,
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchLiveClaimed: false,
      externalProviderCalled: false,
      exactSavedShareSessionReproduced: false,
    });
    expect(report.liveDocumentQualityStressMatrix).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_STRESS_MATRIX",
      productCommitIncludedInProduction: true,
      livePassed: 5,
      liveFailed: 0,
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchPerformed: false,
      exactSavedShareSessionReproduced: false,
    });
    expect(report.liveDocumentFieldIsolation).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_FIELD_ISOLATION",
      livePassed: 10,
      liveFailed: 0,
      liveAfterDeploymentPending: false,
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactSavedShareSessionReproduced: false,
    });
    expect(report.liveKoshaExactMaterialization).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_KOSHA_EXACT_MATERIALIZATION",
      productCommitMatchesProduction: true,
      livePassed: 3,
      liveFailed: 0,
      liveAfterDeploymentPending: false,
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactTrustRegistryExpanded: false,
    });
    expect(report.liveDocumentWordingReview).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_SYNTHETIC_WORDING_REVIEW",
      livePassed: 5,
      liveFailed: 0,
      liveAfterDeploymentPending: false,
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactSavedShareReproduced: false,
      humanReviewStillRequired: true,
    });
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
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.liveDocumentEditorialDuplicateClassification).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_EDITORIAL_DUPLICATE_CLASSIFICATION_REVIEWER_READY",
      reviewedDocumentSurfaceCount: 60,
      beforeGenericTemplateOveruseCount: 4,
      liveGenericTemplateOveruseCount: 0,
      exactLineOveruseCount: 31,
      nearDuplicateLineOveruseCount: 100,
      humanReviewCompleted: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.liveDocumentEditorialNearClassification).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_EDITORIAL_NEAR_DUPLICATE_CLASSIFICATION_REVIEWER_READY",
      beforeNearDuplicateLineOveruseCount: 100,
      beforeHumanReviewRequiredCount: 54,
      livePassed: 5,
      liveFailed: 0,
      liveNearDuplicateLineOveruseCount: 100,
      liveHumanReviewRequiredCount: 0,
      rolePrefixVariantCount: 81,
      independentContextCount: 9,
      hazardConsistencyCount: 8,
      controlConsistencyCount: 2,
      humanReviewCompleted: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.provenCurrentState).toContain("live_document_editorial_review");
    expect(report.productCapabilityTruth).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_PRODUCT_CAPABILITY_TRUTH",
      dispatchMode: "preview_only",
      dispatchReason: "persistent_idempotency_unavailable",
      briefingEmailReady: false,
      photoVisionReady: true,
      photoAcceptedOnly: true,
      aiModes: ["template", "enhanced", "full"],
      providerDispatchCalled: false,
      photoAnalysisPostCalled: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      documentsShareIaVerdict: "OPEN_SEPARATE_VIEWPORT_IA_WAVE",
    });
    expect(report.provenCurrentState).toContain("product_capability_truth");
    expect(report.hermesOpenclaw).toMatchObject({
      verdict: "adapter_boundary_pass_live_execution_not_claimed",
      trustedTransportWired: true,
      durableAttemptLedgerWired: false,
      readinessKeepsLedgerOpen: true,
      liveExecutionClaimed: false,
      remainingRequirements: [
        "durable cross-instance attempt and terminal ledger implementation",
        "authenticated live execution canary after durable ledger approval",
      ],
    });
    expect(report.noticeState).toContainEqual(expect.objectContaining({
      gate: "dependency_security_remediation",
      state: "notice",
    }));
    expect(report.dependencySecurityRemediation).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_BOUNDED_DEPENDENCY_REMEDIATION_RESIDUALS_OPEN",
      beforeVulnerablePackages: 19,
      liveVulnerablePackages: 9,
      liveHigh: 9,
      liveModerate: 0,
      fullRepositorySecurityScanCompleted: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.provenCurrentState).toContain("hermes_knowledge_review_authority");
    expect(report.provenCurrentState).toContain("hermes_knowledge_review_ui");
    expect(report.hermesKnowledgeReviewAuthorityUi).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI",
      localPassed: 8,
      localViewportCount: 8,
      livePassed: 8,
      liveViewportCount: 8,
      sourceOrder: ["SIF", "KOSHA", "law", "organization_history", "site_history", "external_context"],
      humanReviewRequired: true,
      machineEvidenceReplacesHumanReview: false,
      tenantMemoryPublicPromotionAllowed: false,
      siteManagerAcceptanceRequiredBeforeWorkpackUse: true,
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      ontologyPublicationPerformed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
    });
    expect(report.provenCurrentState).toContain("live_document_secondary_grounding");
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
    expect(report.provenCurrentState).toContain("live_document_seed_profile_isolation");
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
      documentsDefaultCockpit: "first actionable cockpit is live-proven with 12 unique document keys, exactly 3 visible core launchers, 9 supporting launchers closed by default, 0 visible supporting launchers, and the legacy document index hidden; do not phrase this as the whole Documents page shortened",
      documentsRemainingDebt: "full 12-document authoring polish remains; the all-12 launcher exposure is now bounded navigation in current evidence, while raw/full document text must stay secondary drilldown rather than serial page content and the local workbench shell ratio target remains <= 3",
      shareDesktop: "current measured Workspace Share passes a scoped three-zone desktop cockpit and 390x723 mobile-stack contract, while the invited recipient fixture separately passes a two-zone desktop workbench; exact saved/generated user sessions that still feel mobile-like require their own width-ratio/grid repro before product changes, and desktop must not regress into a mobile card stack",
      shareGeneratedResult: "current-source generated provider-result fixture keeps the result summary inside 1440x723, 1440x900, and 390x844 after the short desktop landing fix; exact saved user sessions still require their own repro if reported",
      shareRecipientLongContent: "live route-controlled long-content fixture keeps desktop recipient Share in two regions, mobile recipient root <= 1.5 viewports, confirmation in the first viewport, long task text in local scroll, and the document group collapsed by default; route split alone is insufficient and this is not exact saved-session proof",
      shareRouteEvidenceBoundary: "separate Share evidence into invited recipient fixture pass, exact saved/generated /share/[sessionId] missing evidence, and manager/workspace share-result route repro; do not use one route's pass to close another route's mobile-like complaint",
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
    expect(report.shareRecipientLongContentFixture).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_LONG_CONTENT_FIXTURE_EXACT_SAVED_MISSING",
      route: "/share/[sessionId]",
      sessionKind: "long-content-fixture",
      routeSplitAloneAcceptedAsFix: false,
      acceptedStructure: "first-viewport confirmation cockpit plus desktop multi-region workbench plus bounded internal task/message preview and collapsed document drilldown",
      acceptance: {
        desktopMinRegions: 2,
        mobileMaxRootHeightRatio: 1.5,
        confirmationMustRemainInFirstViewport: true,
        longTaskMustUseLocalScroll: true,
        documentGroupCollapsedByDefault: true,
        exactSavedSessionRequiredForUserSpecificPass: true,
      },
      exactSavedUserSessionReproduced: false,
      exactSavedSessionVerdict: "MISSING_EVIDENCE",
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchLiveClaimed: false,
      externalProviderCalled: false,
    });
    expect(report.shareRecipientLongContentFixture.rows).toContainEqual({
      theme: "day",
      viewport: "desktop-short-1440x723",
      overallVerdict: "PASS_SCOPED",
      exactSavedSessionVerdict: "MISSING_EVIDENCE",
      pageHeightRatio: 1.33,
      rootWidthRatio: 0.84,
      rootHeightRatio: 0.99,
      desktopXRegionCount: 2,
      confirmationBottom: 529,
      taskBodyContained: true,
      documentsPanelOpen: false,
      previewContainedCount: 4,
      collapsedDocumentCount: 3,
    });
    expect(report.shareExactSessionBoundary).toMatchObject({
      verdict: "MISSING_EXACT_SAVED_SESSION_EVIDENCE_NO_MUTATION_BOUNDARY_CONFIRMED",
      exactSavedUserSessionReproduced: false,
      exactSavedSessionRequiredForUserSpecificPass: true,
      providerDispatchLiveClaimed: false,
      externalProviderCalled: false,
      dbMutationPerformed: false,
      safeReadStatus: 500,
      safeMissingSessionReadVerdict: "RED_SERVER_ERROR_SHAPED_MISSING_SESSION",
      invalidReadStatus: 400,
      safeInvalidSessionReadVerdict: "PASS_INVALID_ID_FAIL_CLOSED",
    });
    expect(report.sharePublicSessionStorageReadiness).toMatchObject({
      verdict: "RED_PUBLIC_SHARE_SESSION_TABLE_MISSING_FROM_SCHEMA_CACHE_NO_MUTATION",
      livePublicApiStatus: 500,
      workpacksReadable: true,
      shareSessionsReadable: false,
      shareSessionsErrorCode: "PGRST205",
      dbMutationPerformed: false,
    });
    expect(report.sharePublicSessionStorageApproval).toMatchObject({
      verdict: "APPROVAL_REQUIRED_PUBLIC_SHARE_SESSION_STORAGE_MIGRATION_NO_MUTATION",
      exactSavedShareSessionVerdict: "MISSING_EVIDENCE",
      migrationPath: "supabase/migrations/010_commercial_operations.sql",
      broadMigrationRequiresOperatorReview: true,
      operatorApprovalRequiredBeforeMigration: true,
      schemaMutationAuthorized: false,
      dbMutationPerformed: false,
      shareSessionCreated: false,
      shareSessionCreationWouldInsertWorkpackShareSessions: true,
      concreteProductionShareUrlProvided: false,
      providerDispatchLiveClaimed: false,
      externalProviderCalled: false,
      workpackShareSessionsReadable: false,
      workpackShareSessionsErrorCode: "PGRST205",
    });
    expect(report.nextSafeWorkWithoutApproval.join("\n")).toContain("do not create a production saved Share session");
    expect(report.documentsCockpitWorkbenchGeometry).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_DOCUMENTS_WORKBENCH",
      routeSplitAloneAcceptedAsFix: false,
      rows: [
        {
          viewport: "1440x723",
          overallVerdict: "PASS",
          coreButtons: 3,
          uniqueDocumentKeyCount: 12,
          visibleDocumentButtonCount: 3,
          supportingButtonCount: 9,
          visibleSupportingButtonCount: 0,
          legacyIndexDisplay: "none",
          detailsOpen: false,
        },
        {
          viewport: "390x723",
          overallVerdict: "PASS",
          coreButtons: 3,
          uniqueDocumentKeyCount: 12,
          visibleDocumentButtonCount: 3,
          supportingButtonCount: 9,
          visibleSupportingButtonCount: 0,
          legacyIndexDisplay: "none",
          detailsOpen: false,
        },
      ],
    });
    expect(report.uiInterpretation.documentsDefaultCockpit).toContain("exactly 3 visible core launchers");
    expect(report.uiInterpretation.documentsDefaultCockpit).toContain("0 visible supporting launchers");
    expect(report.uiInterpretation.documentsContainment).toContain("selected-only bounded workbench");
    expect(report.uiInterpretation.documentsGeneratedCurrentWorkpack).toContain("generated-current-workpack");
    expect(report.boundedWorkbenchCurrent).toMatchObject({
      generatedCurrentWorkpackMeasured: true,
      generatedDocumentRows: [
        {
          route: "/documents?theme=day",
          theme: "day",
          viewport: "1440x723",
          overallVerdict: "PASS",
          bodyHeightRatio: 1,
          workpackShellScrollRatio: 2.31,
          firstActionBottom: 321,
          firstHazardBottom: 578,
          stickyOverlapCount: 0,
          supportingDocsOpenDefault: false,
        },
      ],
      selectedSectionRows: [
        {
          route: "/documents?theme=day",
          theme: "day",
          viewport: "390x723",
          overallVerdict: "PASS",
          workpackShellScrollRatio: 2.96,
          sectionTabCount: 6,
          selectedSectionTabCount: 1,
          mountedSectionDetailCount: 1,
          mountedSectionTextareaCount: 1,
          mountedSourceTextareaCount: 0,
          outsideElements: 0,
        },
      ],
    });
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
      "keep Documents acceptance tied to simultaneous exposure, not page count: current status, core 3 launcher, selected document workbench, validation/recheck action, and local-scroll/drilldown for long source, section, evidence, and supporting-9 content",
    );
    expect(report.nextSafeWorkWithoutApproval).toContain(
      "keep Share acceptance split by viewport and session kind: desktop must be a 2-3 region cockpit with selected language/message preview and send/export lock, while mobile single-column summaries are allowed only on mobile",
    );
    expect(report.nextSafeWorkWithoutApproval).toContain(
      "keep UI follow-up scoped to reproduced exact-session desktop Share full-workbench perception issues while preserving the Documents bounded workbench shell-ratio <= 3 contract",
    );
    expect(report.nextSafeWorkWithoutApproval).toContain(
      "promote the bounded-workbench current-source proof to live only after production /api/build-info reaches the product/evidence head and the live probe is rerun",
    );
    expect(report.nextSafeWorkWithoutApproval).toContain(
      "treat the Share exact-session boundary as open until a concrete session URL/payload is provided; the current no-mutation boundary audit only proves route presence and missing exact evidence",
    );
    expect(report.nextSafeWorkWithoutApproval).toContain(
      "keep Share UI evidence split by route: invited recipient fixture, exact saved/generated /share/[sessionId], and manager/workspace share-result state each need their own geometry before closing user-specific mobile-like complaints",
    );
    expect(report.nextSafeWorkWithoutApproval).toContain(
      "keep Hermes/OpenClaw live execution held: tenant envelope, tool denial, Evidence Harness, DNS-pinned trusted transport, and terminal persistence behavior are source-proven, while the durable cross-instance attempt/terminal ledger and authenticated canary remain open",
    );
    expect(report.sourceHeadLivePending).toBe(false);
    expect(report.boundedWorkbenchSourceIncludedInLive).toBe(false);
    expect(report.boundedWorkbenchCurrentLivePending).toBe(true);
  });

  it("keeps recipient ACK approval visible when its preflight is missing", async () => {
    const { buildNorthstarNextRunway } = await loadNextRunwayModule();
    const { root, secondHead } = createFixtureRoot();
    pointLiveRollupAt(root, secondHead);
    fs.unlinkSync(path.join(
      root,
      "evaluation",
      "share-recipient-ack-approval-preflight-current-2026-07-19",
      "report.json",
    ));

    const report = buildNorthstarNextRunway({
      rootDir: root,
      buildInfo: { commitSha: secondHead },
      generatedAt: "2026-07-28T00:00:00.000Z",
    });

    expect(report.approvalGated[0]).toMatchObject({
      gate: "share_recipient_ack_approval",
      state: "approval_gated",
      readyForOperatorReview: false,
      currentSafetyLock: "preflight_missing_or_invalid",
    });
  });

  it("treats a bounded-workbench source ancestor as included in live", async () => {
    const { buildNorthstarNextRunway, renderNorthstarNextRunwayMarkdown } = await loadNextRunwayModule();
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
    const markdown = renderNorthstarNextRunwayMarkdown(report);

    expect(report.productionCommit).toBe(secondHead);
    expect(report.boundedWorkbenchCurrent.sourceHead).toBe(firstHead);
    expect(report.boundedWorkbenchSourceIncludedInLive).toBe(true);
    expect(report.boundedWorkbenchCurrentLivePending).toBe(false);
    expect(report.boundedWorkbenchCurrent.exactSavedSession).toMatchObject({
      verdict: "MISSING_EVIDENCE",
      exactSavedUserSessionReproduced: false,
    });
    expect(markdown).toContain("first-task/body containment rows pass, and no Documents rows carry local workbench detail-depth debt");
    expect(markdown).not.toContain("but 0 Documents row(s) carry local workbench detail-depth debt");
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

  it("does not label a pending product source head as evidence-only", async () => {
    const { buildNorthstarNextRunway, renderNorthstarNextRunwayMarkdown } = await loadNextRunwayModule();
    const { root, secondHead } = createFixtureRoot();
    fs.mkdirSync(path.join(root, "lib"), { recursive: true });
    fs.writeFileSync(path.join(root, "lib", "runtime-product-change.ts"), "export const value = true;\n", "utf8");
    const thirdHead = commitAll(root, "product fix");
    pointLiveRollupAtHeadWithLive(root, thirdHead, secondHead);
    const report = buildNorthstarNextRunway({
      rootDir: root,
      buildInfo: { commitSha: secondHead },
    });
    const markdown = renderNorthstarNextRunwayMarkdown(report);

    expect(report.sourceHead).toBe(thirdHead);
    expect(report.productionCommit).toBe(secondHead);
    expect(report.latestEvidenceCommitLive).toBe(false);
    expect(report.sourceHeadLivePending).toBe(true);
    expect(report.sourceHeadHasProductChanges).toBe(true);
    expect(report.sourcePendingChangedPaths).toContain("lib/runtime-product-change.ts");
    expect(report.currentHeadIsEvidenceOnlyPending).toBe(false);
    expect(report.liveRollupMatchesProduction).toBe(true);
    expect(markdown).toContain("includes product/runtime file changes that are not live yet");
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
