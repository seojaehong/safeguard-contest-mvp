import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

type GateState = "proven" | "approval_gated" | "notice" | "missing" | "contradicted";

type GateResult = {
  id: string;
  state: GateState;
  label: string;
  evidencePath: string;
  detail: string;
  nextActions: string[];
};

type NorthstarAudit = {
  overall: "open" | "evidence_missing" | "contradicted";
  gates: GateResult[];
  safeDemoClaims: string[];
  forbiddenClaims: string[];
};

type AuditModule = {
  buildNorthstarOpenGateAudit: (options: {
    rootDir: string;
    generatedAt?: string;
    sourceSha?: string;
  }) => NorthstarAudit;
  renderNorthstarOpenGateMarkdown: (audit: NorthstarAudit) => string;
};

type KoshaReconciliationFixture = {
  mutations: {
    supabaseDataChanged: boolean;
  };
};

type KoshaCurrentGateFixture = {
  liveStatus: {
    exactTrustRegistry: {
      count: number;
      stableDocumentKeys: string[];
    };
  };
};

async function loadAuditModule(): Promise<AuditModule> {
  const sourcePath = path.resolve("scripts", "northstar_open_gate_audit.mjs");
  const moduleDir = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-northstar-module-"));
  const modulePath = path.join(moduleDir, "northstar_open_gate_audit.mjs");
  const source = fs.readFileSync(sourcePath, "utf8").replace(/^#!.*\r?\n/u, "");
  fs.writeFileSync(modulePath, source, "utf8");
  return await import(pathToFileURL(modulePath).href) as AuditModule;
}

function writeJson(rootDir: string, relativePath: string, value: unknown): void {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(rootDir: string, relativePath: string, value: string): void {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, value, "utf8");
}

function createProviderDispatchIdempotencyFixture(): Record<string, unknown> {
  return {
    status: "approval_required",
    liveDispatchState: {
      capability: false,
      mode: "preview_only",
      reason: "persistent_idempotency_unavailable",
      codeLock: "PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED=false",
    },
    draftMigration: {
      scope: "attempt_level_reservation_only",
      table: "provider_dispatch_attempts",
      uniqueIndex: "provider_dispatch_attempts_org_idempotency_key_unique",
      forceRls: true,
    },
    channelResultPersistence: {
      channelLevelExactlyOnceProven: false,
      currentShape: "channels text[] plus provider_result jsonb on one attempt row",
      requiredBeforeClaimingExactlyOnce: [
        "add provider_dispatch_attempt_channels with unique attempt/channel or organization/idempotency/channel",
        "or define provider_result jsonb as the canonical per-channel ledger and test reservation-before-provider-call, duplicate replay, and per-channel result retention",
      ],
    },
    timestampBoundary: {
      updatedAtColumnPresent: true,
      updatedAtTriggerIncluded: true,
      requiredBeforeAppliedMigration: "runtime approval must verify the provider_dispatch_attempts_set_updated_at trigger is present and that route status updates preserve updated_at ownership",
    },
    safetyLocks: {
      dbMigrationApplied: false,
      dbMutationPerformed: false,
      providerMessageSent: false,
      liveDispatchUnlocked: false,
    },
  };
}

function createFixtureRoot(): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-northstar-open-gate-"));
  execFileSync("git", ["init"], { cwd: rootDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: rootDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "SafeClaw Test"], { cwd: rootDir, stdio: "ignore" });

  writeJson(rootDir, path.join("evaluation", "final-99-gate", "report.json"), {
    overall: "pass_with_notice",
  });
  writeJson(rootDir, path.join("evaluation", "live-harness-quality-probe-current-2026-07-20", "report.json"), {
    evaluation: {
      verdict: "pass",
      contracts: [
        { id: "api_response", state: "pass" },
        { id: "db_harness_first", state: "pass" },
      ],
    },
  });
  writeJson(rootDir, path.join("evaluation", "document-quality-grounding-current-gate-2026-07-19", "report.json"), {
    verdict: "PASS_CURRENT_SOURCE_DOCUMENT_QUALITY_GROUNDING_CONTRACT",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
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
  writeJson(rootDir, path.join("evaluation", "live-document-quality-matrix-2026-07-24", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_MULTI_SCENARIO_DOCUMENT_QUALITY",
    sourceHeadMatchesProduction: true,
    scenarios: ["one", "two", "three", "four", "five"],
    afterLive: {
      total: 5,
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
    },
  });
  writeJson(rootDir, path.join("evaluation", "live-document-quality-stress-matrix-2026-07-24", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_STRESS_MATRIX",
    productCommitIncludedInProduction: true,
    afterLive: {
      total: 5,
      pass: 5,
      fail: 0,
    },
    boundaries: {
      liveProductionClaimed: true,
      liveAfterDeploymentPending: false,
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchPerformed: false,
      exactSavedShareSessionReproduced: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "live-document-field-isolation-2026-07-25", "report.json"), {
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
  writeJson(rootDir, path.join("evaluation", "live-kosha-exact-materialization-2026-07-25", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_KOSHA_EXACT_MATERIALIZATION",
    productCommitMatchesProduction: true,
    liveAfterDeploymentPending: false,
    afterLive: {
      total: 3,
      pass: 3,
      fail: 0,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactTrustRegistryExpanded: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "live-document-wording-review-2026-07-24", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_SYNTHETIC_WORDING_REVIEW",
    productCommit: "fixture-product",
    productionCommitAfterDeployment: "fixture-production",
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
  writeJson(rootDir, path.join("evaluation", "live-document-broad-review-2026-07-25", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_12_DELIVERABLE_BROAD_REVIEW",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    productCommit: "fixture-product",
    uiDocumentCount: 12,
    integrityRequiredCount: 12,
    reviewedDocumentCount: 12,
    stages: {
      beforeRemediation: {
        pass: 0,
        fail: 5,
        missingUnexpectedCount: 5,
      },
      afterLive: {
        pass: 5,
        fail: 0,
        missingUnexpectedCount: 0,
      },
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
  writeJson(rootDir, path.join("evaluation", "live-document-secondary-grounding-2026-07-25", "report.json"), {
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
  writeJson(rootDir, path.join("evaluation", "live-document-editorial-review-2026-07-25", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_12_DELIVERABLE_EDITORIAL_CONTRACT_REVIEWER_READY",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
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
  writeJson(rootDir, path.join("evaluation", "live-document-editorial-duplicate-classification-2026-07-25", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_EDITORIAL_DUPLICATE_CLASSIFICATION_REVIEWER_READY",
    productCommit: "fixture-product-sha",
    productionCommit: "fixture-sha",
    canonicalDocumentCount: 12,
    caseCount: 5,
    reviewedDocumentSurfaceCount: 60,
    humanReviewCompleted: false,
    beforeLive: { pass: 1, fail: 4, genericTemplateOveruseCount: 4 },
    afterLive: {
      sourceHead: "fixture-sha",
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
  writeJson(rootDir, path.join("evaluation", "live-document-editorial-near-classification-2026-07-25", "report.json"), {
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
  writeJson(rootDir, path.join("evaluation", "product-capability-truth-2026-07-25", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_PRODUCT_CAPABILITY_TRUTH",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    liveChecks: {
      providerDispatch: {
        status: 200,
        capability: false,
        mode: "preview_only",
        reason: "persistent_idempotency_unavailable",
        channels: { email: false, sms: false, kakao: false },
        providerCalled: false,
      },
      briefingSettingsUnauthenticated: {
        status: 401,
        authenticationFailClosed: true,
        emailReady: false,
        mode: "preview_only",
        reason: "persistent_idempotency_unavailable",
        settingsMutationPerformed: false,
      },
      photoVisionReadiness: {
        status: 200,
        ready: true,
        acceptedOnly: true,
        ocrSupported: true,
        photoPostAnalysisExecuted: false,
      },
    },
    uiChecks: {
      briefingSettings: [
        { containsDocumentGeneration: true, containsEmailDispatchLock: true, horizontalOverflow: false },
        { containsDocumentGeneration: true, containsEmailDispatchLock: true, horizontalOverflow: false },
      ],
      aiGenerationModes: {
        sourceAndApiContractVerified: true,
        modes: ["template", "enhanced", "full"],
        liveInteractiveModeSwitchExecuted: false,
      },
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      photoAnalysisPostCalled: false,
      exactSavedShareReproduced: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      documentsShareIaVerdict: "OPEN_SEPARATE_VIEWPORT_IA_WAVE",
      providerDispatchApprovalRequired: true,
      humanEditorialReviewCompleted: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "hermes-knowledge-review-contract-live-2026-07-25", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_KNOWLEDGE_REVIEW_AUTHORITY_CONTRACT",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionBuild: {
      commitSha: "fixture-sha",
      branch: "master",
      environment: "production",
    },
    probe: {
      httpStatus: 200,
      requestMode: "generate_false_stateless_candidate",
      rawEventCount: 5,
      aiGenerationExecuted: false,
      providerCallPerformed: false,
      storageMode: "stateless_candidate",
      savedRunId: null,
    },
    candidate: {
      contractVersion: "knowledge-candidate.v2",
      publicationState: "unpublished",
      publishAllowed: false,
      dbMutationPerformed: false,
    },
    reviewContract: {
      contractVersion: "knowledge-candidate-review.v1",
      status: "human_review_required",
      authorityOrder: ["sif", "kosha", "law", "organization_history", "site_history", "external_context"],
      presentAuthorityIds: ["sif", "kosha", "law", "organization_history", "site_history"],
      sourceRoleCounts: {
        sifIncidentControlEvidence: 1,
        koshaTechnicalGuidance: 1,
        lawStatutorySource: 1,
        organizationPrivateMemory: 1,
        sitePrivateMemory: 1,
        externalContext: 0,
      },
      tenantMemoryPublicPromotionAllowed: false,
      siteManagerAcceptanceRequiredBeforeWorkpackUse: true,
      humanReviewRequired: true,
      machineEvidenceReplacesHumanReview: false,
      dbMutationAllowed: false,
      publishAllowed: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      schemaMutationPerformed: false,
      candidatePersisted: false,
      ontologyPublished: false,
      providerCallPerformed: false,
      shareSessionCreated: false,
      exactSavedShareReproduced: false,
    },
    remainingBoundaries: {
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(rootDir, path.join("evaluation", "dispatch-entry-capability-truth-2026-07-28", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_DISPATCH_ENTRY_CAPABILITY_TRUTH",
    sourceHead: "fixture-sha",
    productionBuild: {
      commitSha: "fixture-sha",
      sourceHeadMatchesProduction: true,
    },
    currentSource: {
      forbiddenSendingClaimsRemainingInReviewedSurfaces: 0,
    },
    liveAfter: {
      dispatchDescriptionVisible: true,
      landingDispatchBoundaryVisible: true,
      sourceHeadMatchesProduction: true,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      embeddingGenerated: false,
      vectorUploadPerformed: false,
      exactTrustRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      liveAfterDeploymentRequired: false,
      providerDispatchPersistence: "approval_gated",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(rootDir, path.join("evaluation", "landing-human-review-boundary-2026-07-28", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_LANDING_HUMAN_REVIEW_BOUNDARY",
    sourceHead: "fixture-sha",
    productionBuild: {
      commitSha: "fixture-sha",
      sourceHeadMatchesProduction: true,
    },
    currentSource: {
      humanDecisionBoundaryVisible: true,
      forbiddenReplacementClaimsRemaining: 0,
    },
    liveAfter: {
      positioningVisible: true,
      humanDecisionBoundaryVisible: true,
      oldSafetyManagerClaimVisible: false,
      oldReplacementClaimVisible: false,
      horizontalOverflow: false,
      browserConsoleErrors: 0,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      embeddingGenerated: false,
      vectorUploadPerformed: false,
      exactTrustRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      liveAfterDeploymentRequired: false,
      broadHumanLegalReviewCompleted: false,
      providerDispatchPersistence: "approval_gated",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(rootDir, path.join("evaluation", "dependency-security-remediation-2026-07-28", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_DEPENDENCY_AUDIT_ZERO_FULL_SECURITY_SCAN_OPEN",
    sourceHead: "fixture-sha",
    productionBuild: {
      commitSha: "fixture-sha",
      sourceHeadMatchesProduction: true,
    },
    auditBefore: {
      high: 14,
      moderate: 5,
      totalVulnerablePackages: 19,
    },
    auditAfter: {
      critical: 0,
      high: 0,
      moderate: 0,
      totalVulnerablePackages: 0,
      productionOmitDevMatchesFullAudit: true,
      automaticNonBreakingFixChangeCount: 0,
    },
    updates: [
      { package: "next" },
      { package: "adm-zip" },
      { package: "postcss" },
      { package: "@hono/node-server", after: "2.0.12" },
      { package: "fast-uri", after: "3.1.4" },
      { package: "sharp", after: "0.35.3" },
      { package: "uuid", after: "11.1.1" },
      { package: "archiver", after: "8.0.0" },
      { package: "unzipper", after: "0.12.1" },
    ],
    residuals: [],
    compatibilityBoundary: {
      mcpSdkKeptAt: "1.26.0",
      dependencyGraphValid: true,
      honoOverride: "2.0.12",
      fastUriOverride: "3.1.4",
      sharpOverride: "0.35.3",
      uuidOverride: "11.1.1",
      archiverOverride: "8.0.0",
      unzipperOverride: "0.12.1",
    },
    verification: {
      strictTypecheck: "PASS",
      build: "PASS",
      nextVersion: "15.5.22",
      staticPagesGenerated: 28,
      mcpRuntimeContracts: {
        testFiles: 13,
        testsPassed: 170,
      },
      runtimeDependencyOverrides: {
        testFiles: 1,
        testsPassed: 3,
      },
      archiveRuntimeContracts: {
        testFiles: 4,
        testsPassed: 23,
      },
      localRuntimeSmoke: {
        mcpUnauthenticatedStatus: 401,
        nextImageOptimizerStatus: 200,
        nextImageOptimizerContentType: "image/png",
      },
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      embeddingGenerated: false,
      vectorUploadPerformed: false,
      exactTrustRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      liveAfterDeploymentRequired: false,
      fullRepositorySecurityScanCompleted: false,
      residualVulnerablePackages: 0,
      providerDispatchPersistence: "approval_gated",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(rootDir, path.join("evaluation", "follow-up-full-repository-security-scan-2026-08-02", "report.json"), {
    verdict: "COMPLETED_FOLLOWUP_REPOSITORY_SECURITY_SCAN_OPEN_FINDINGS_AND_DEFERRED_REVIEW",
    sourceHead: "fixture-sha",
    productionBuild: {
      commitSha: "fixture-sha",
      sourceHeadMatchesProduction: true,
      sourceHeadIsAncestorOfProduction: true,
    },
    scan: {
      mode: "repository",
      inventoryStrategy: "repository",
      status: "completed",
      completeness: "partial",
      targetKind: "git_revision",
      fileCount: 5241,
      reviewedTextCount: 2673,
      binaryOrGeneratedAccountedCount: 2568,
      candidateCount: 32,
      reportableFindingCount: 17,
      ignoredCandidateCount: 8,
      deferredCandidateCount: 1,
      validationSuppressedCount: 5,
      validationNotApplicableCount: 1,
      severity: { critical: 0, high: 0, medium: 5, low: 12 },
      finalizerCompleted: true,
      sealedArtifactCount: 8,
    },
    companionRemediation: {
      targetedFindingCount: 4,
      sourceBoundedFindingCount: 2,
      mitigatedWithDistributedRateResidualCount: 2,
      livePublicQueryBudgetChecks: 3,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      embeddingGenerated: false,
      vectorUploadPerformed: false,
      wikiPublished: false,
      exactTrustRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      fullRepositorySecurityScanCompleted: true,
      securityCompleteClaimAllowed: false,
      remediationRequired: true,
      reportableFindingCount: 17,
      deferredCandidateCount: 1,
      coverageCompleteness: "partial",
      distributedRateLimitResidual: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      providerDispatchPersistence: "approval_gated",
    },
  });
  writeJson(rootDir, path.join("evaluation", "learning-export-renderer-security-2026-08-02", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_RENDERER_INERT_LEARNING_EXPORT_SOURCE_CONTRACT",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", sourceHeadMatchesProduction: true, liveAfterDeploymentPending: false },
    candidate: {
      id: "candidate-5ae4fb7bd6d7ea24",
      originalDisposition: "needs_follow_up",
      currentSourceDisposition: "bounded_renderer_independent_inert_text_contract",
      fullRepositoryRescanRequiredForCanonicalClosure: true,
    },
    rendererContract: {
      applicationEmbeddedRenderer: false,
      deliveryDisposition: "attachment",
      obsidianRole: "optional_operator_review_tool",
      externalRendererTrustRequired: false,
      jsonlRawProvenancePreserved: true,
    },
    controls: {
      rawHtmlDelimitersEntityEncoded: true,
      markdownImageAndLinkOpenersEscaped: true,
      obsidianEmbedOpenersEscaped: true,
      obsidianSegmentsBlockPathAndEmbedMetacharacters: true,
      activeAndLocalUriSchemesNeutralized: ["javascript", "data", "file", "vbscript"],
      frontmatterDynamicValuesNeutralized: true,
      contentDispositionAttachment: true,
      contentSecurityPolicySandbox: true,
      contentTypeNosniff: true,
      cacheControlPrivateNoStore: true,
      referrerPolicyNoReferrer: true,
    },
    verification: {
      focusedTestFiles: 5,
      focusedTestsPassed: 87,
      strictTypecheck: "PASS",
      productionBuild: "PASS",
      staticPagesGenerated: 28,
      hostileFixtureRawHtmlAbsent: true,
      hostileFixtureActiveUriAbsent: true,
      hostileFixtureObsidianEmbedAbsent: true,
      jsonlRawProvenanceRetained: true,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      embeddingGenerated: false,
      vectorUploadPerformed: false,
      wikiPublished: false,
      exactTrustRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      canonicalFollowUpScanCompleteness: "partial",
      canonicalDeferredCandidateCount: 1,
      securityCompleteClaimAllowed: false,
      liveSuccessResponseProbeAvailableWithoutStoredWorkpack: false,
      liveAfterDeploymentRequired: false,
      distributedRateLimitResidual: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(rootDir, path.join("evaluation", "tenant-authorization-boundary-preflight-2026-07-29", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_TENANT_AUTHORIZATION_REMEDIATED_NO_MUTATION",
    sourceHead: "tenant-product-sha",
    productionBuild: {
      commitSha: "fixture-sha",
      sourceHeadMatchesProduction: false,
      sourceHeadIsAncestorOfProduction: true,
    },
    checks: [
      { id: "scheduled-briefing-owner-binding", status: "GREEN", remediatedWithoutMutation: true },
      { id: "workpack-archive-site-binding", status: "GREEN", remediatedWithoutMutation: true },
    ],
    summary: {
      targetFindingCount: 2,
      redCount: 0,
      greenCount: 2,
      productPatchCommit: "tenant-product-sha",
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      crossTenantExploitPerformed: false,
      migrationCreatedOrApplied: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      embeddingGenerated: false,
      vectorUploadPerformed: false,
      wikiPublished: false,
      exactTrustRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      reportableFindingCount: 16,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(rootDir, path.join("evaluation", "spreadsheet-formula-neutralization-2026-08-01", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_SPREADSHEET_FORMULA_NEUTRALIZATION",
    wave: {
      findingCount: 4,
      findingIds: ["formula-1", "formula-2", "formula-3", "formula-4"],
    },
    source: {
      productCommit: "formula-product-sha",
      evidenceHead: "fixture-sha",
      productionMarkerAtValidation: "fixture-sha",
      productionBranch: "master",
      productionEnvironment: "production",
      liveAfterProductDeploy: "PASS",
    },
    changes: {
      findingClosure: {
        spreadsheetFormulaInjectionFindingsRemediatedInCurrentSource: 4,
        tenantAuthorizationFindingsPreviouslyRemediatedInCurrentSource: 2,
        remainingReportableFindingsBeforeFullRescan: 12,
        fullRepositoryRescanCompleted: false,
        securityCompleteClaimAllowed: false,
      },
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      crossTenantExploitPerformed: false,
      migrationCreatedOrApplied: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      embeddingGenerated: false,
      vectorUploadPerformed: false,
      wikiPublished: false,
      exactTrustRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      immutableFullRepositoryScanStillRecordsOriginal18Findings: true,
      followUpFullRepositoryRescanRequired: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(rootDir, path.join("evaluation", "public-provider-work-budget-2026-08-01", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_PROVIDER_WORK_BUDGETS",
    wave: {
      findingCount: 4,
      findingIds: ["provider-1", "provider-2", "provider-3", "provider-4"],
    },
    source: {
      evidenceHead: "fixture-sha",
      productionMarkerAtValidation: "fixture-sha",
      productionBranch: "master",
      productionEnvironment: "production",
      liveAfterProductDeploy: "PASS",
    },
    changes: {
      findingClosure: {
        publicProviderAndUpstreamFindingsRemediatedInCurrentSource: 4,
        tenantAuthorizationFindingsPreviouslyRemediatedInCurrentSource: 2,
        spreadsheetFormulaFindingsPreviouslyRemediatedInCurrentSource: 4,
        remainingReportableFindingsBeforeFullRescan: 8,
        fullRepositoryRescanCompleted: false,
        securityCompleteClaimAllowed: false,
      },
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      crossTenantExploitPerformed: false,
      migrationCreatedOrApplied: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      productionProviderLoadTestPerformed: false,
      embeddingGenerated: false,
      vectorUploadPerformed: false,
      wikiPublished: false,
      exactTrustRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      immutableFullRepositoryScanStillRecordsOriginal18Findings: true,
      followUpFullRepositoryRescanRequired: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(rootDir, path.join("evaluation", "document-export-work-budget-2026-08-01", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_EXPORT_WORK_BUDGETS",
    sourceHead: "export-product-sha",
    productCommit: "export-product-sha",
    productionBuild: { commitSha: "fixture-sha", productCommitIsAncestorOfProduction: true },
    wave: { findingCount: 8, findingIds: Array.from({ length: 8 }, (_, index) => `export-${index + 1}`) },
    implementation: {
      dbMutation: false,
      shareMutation: false,
      providerMutation: false,
      vectorMutation: false,
      wikiMutation: false,
      koshaRegistryMutation: false,
    },
    findingClosure: {
      documentExportFindingsRemediatedInLiveProduction: 8,
      cumulativeBaselineFindingsWithBoundedRemediationEvidence: 18,
      remainingReportableFindingsBeforeFullRescan: 0,
      fullRepositoryRescanCompleted: false,
      securityCompleteClaimAllowed: false,
    },
    openBoundaries: {
      immutableFullRepositoryScanStillRecordsOriginal18Findings: true,
      followUpFullRepositoryRescanRequired: true,
      fullRepositorySecurityCompleteClaimAllowed: false,
      exactSavedShare: "MISSING_EVIDENCE",
    },
  });
  writeJson(rootDir, path.join("evaluation", "live-document-rain-context-isolation-2026-07-25", "report.json"), {
    schemaVersion: "safeclaw-live-document-rain-context-isolation/v1",
    verdict: "PASS_LIVE_PRODUCTION_RAIN_CONTEXT_ISOLATION",
    scenarioCount: 1,
    fullMatrixScenarioCount: 5,
    fullMatrixContractCommit: "fixture-contract-sha",
    fullMatrixProductionCommit: "fixture-production-sha",
    fullMatrixContractAffectsRuntime: false,
    canonicalDocumentCount: 12,
    beforeLive: {
      pass: 0,
      fail: 1,
      reviewedDocumentSurfaceCount: 12,
      scenarioIrrelevantContextFindingCount: 3,
      failedDocumentCount: 3,
    },
    afterLive: {
      sourceHead: "fixture-sha",
      productionCommit: "fixture-sha",
      pass: 1,
      fail: 0,
      reviewedDocumentSurfaceCount: 12,
      scenarioIrrelevantContextFindingCount: 0,
      failedDocumentCount: 0,
    },
    afterLiveFull: {
      verdict: "PASS_LIVE_PRODUCTION_12_DELIVERABLE_EDITORIAL_CONTRACT_REVIEWER_READY",
      sourceHead: "fixture-contract-sha",
      productionCommit: "fixture-production-sha",
      pass: 5,
      fail: 0,
      reviewedDocumentSurfaceCount: 60,
      scenarioIrrelevantContextFindingCount: 0,
      failedDocumentCount: 0,
      matchedForbiddenDocumentFragmentCount: 0,
      forbiddenRainContextFragments: ["우천 후 바닥 젖음", "우천·젖은 바닥"],
      placeholderFindingCount: 0,
      legalOverclaimFindingCount: 0,
      awkwardCompositionFindingCount: 0,
      evidenceDomainMismatchCount: 0,
      genericTemplateOveruseCount: 0,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      embeddingGenerated: false,
      vectorUploadPerformed: false,
    },
    remainingBoundary: {
      liveAfterDeploymentPending: false,
      humanReviewCompleted: false,
      broadHumanWordingReviewRequired: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(rootDir, path.join("evaluation", "hermes-knowledge-review-authority-ui-2026-07-25", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    local: {
      verdict: "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_AUTHORITY_UI",
      viewportCount: 8,
      passedCount: 8,
      failedCount: 0,
    },
    afterLive: {
      verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI",
      viewportCount: 8,
      passedCount: 8,
      failedCount: 0,
    },
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
  writeJson(rootDir, path.join("evaluation", "live-document-seed-profile-isolation-2026-07-25", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_SEED_PROFILE_ISOLATION",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    productCommit: "fixture-product",
    liveAfterDeploymentPending: false,
    contract: {
      scenarioCount: 5,
      documentCountPerScenario: 12,
      reviewedDocumentSurfaceCount: 60,
      failClosedOnAnyForbiddenFragment: true,
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
      missingUnexpectedCount: 0,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactSavedShareReproduced: false,
      exactSavedShareEvidence: "MISSING_EVIDENCE",
    },
  });
  writeText(rootDir, path.join("evaluation", "supabase-rls-approval-2026-07-17", "report.md"), [
    "# Supabase RLS Approval Audit",
    "Status: `approval_required`",
    "Launch isolation proven: no",
  ].join("\n"));
  writeText(rootDir, path.join("evaluation", "llm-wiki-rls-approval-2026-07-17", "report.md"), [
    "# LLM Wiki Publication and RLS Approval Packet",
    "Verdict: **RED / approval required / launch not proven**",
    "Until all blockers close, publication remains unavailable and launch readiness remains false.",
  ].join("\n"));
  writeJson(rootDir, path.join("evaluation", "rls-llm-wiki-approval-preflight-current-2026-07-20", "report.json"), {
    overall: "approval_ready_open",
    sourceSha: "fixture-sha",
    launchReadiness: false,
    dbMutationPerformed: false,
    networkOpened: false,
    failedCheckIds: [],
    checks: [
      { id: "rls_status_approval_required", passed: true },
      { id: "rls_launch_not_proven", passed: true },
      { id: "rls_non_mutating", passed: true },
      { id: "rls_catalog_missing_is_explicit", passed: true },
      { id: "checklist_sections_present", passed: true },
      { id: "checklist_sql_boundaries_present", passed: true },
      { id: "wiki_verdict_red", passed: true },
      { id: "wiki_launch_not_proven", passed: true },
      { id: "wiki_non_mutating", passed: true },
      { id: "wiki_publication_unavailable", passed: true },
      { id: "wiki_sql_design_non_executable", passed: true },
      { id: "wiki_sql_design_not_migration_path", passed: true },
      { id: "tenant_manifest_v3", passed: true },
      { id: "tenant_harness_no_live_adapter", passed: true },
      { id: "hermes_llm_candidate_stays_unpublished", passed: true },
      { id: "knowledge_candidate_review_authority_order", passed: true },
      { id: "knowledge_candidate_review_boundary", passed: true },
      { id: "knowledge_candidate_prompt_authority_separation", passed: true },
      { id: "knowledge_candidate_route_non_publishing", passed: true },
      { id: "knowledge_review_route_non_publishing", passed: true },
      { id: "wiki_no_executable_publication_surface", passed: true },
      { id: "northstar_rls_gate_approval_gated", passed: true },
      { id: "northstar_wiki_gate_approval_gated", passed: true },
    ],
    publicationSurfaceInventory: {
      scannedFileCount: 12,
      publicationRpcCallHits: [],
      publicationSqlFunctionHits: [],
      publicationLedgerMigrationHits: [],
      publicationRoutePaths: [],
    },
  });
  writeJson(rootDir, path.join("evaluation", "sif-embedding-gate", "approval-preflight-report.json"), {
    ok: true,
    approvalHeld: true,
    dbMutationPerformed: false,
    embeddingGenerated: false,
    uploaded: false,
    corpusCount: 6032,
    corpusHash: "a".repeat(64),
    corpusInspection: {
      lineCount: 6032,
      parsedRecordCount: 6032,
      parseErrorCount: 0,
      invalidRecordCount: 0,
      duplicateReferenceItemIdCount: 0,
      duplicateContentHashCount: 0,
      computedCorpusHash: "a".repeat(64),
      manifestBatchFailureCount: 0,
    },
    failedCheckIds: [],
  });
  writeJson(
    rootDir,
    path.join("evaluation", "provider-dispatch-idempotency-gate-2026-07-19", "report.json"),
    createProviderDispatchIdempotencyFixture(),
  );
  writeJson(rootDir, path.join("evaluation", "documents-mobile-internal-pane-2026-07-21", "report.json"), {
    verdict: "PASS_CURRENT_SOURCE",
    currentSourceGeometry: {
      viewport: { width: 390, height: 844 },
      bodyHeight: 844,
      overflowX: false,
      outside: 0,
    },
  });
  writeJson(rootDir, path.join("evaluation", "documents-mobile-pane-context-2026-07-21", "report.json"), {
    verdict: "PASS_CURRENT_SOURCE",
    sourceHeadBeforeCommit: "fixture-sha",
    assertions: {
      riskAssessmentToolbarVisibleInPaneAfterDeepScroll: true,
      tbmLogDrilldownSummaryContainsSectionsEvidenceAndReview: true,
      riskAssessmentDrilldownSummaryContainsSectionsEvidenceAndReview: true,
      tbmLogToolbarDoesNotCoverActiveTextareaAfterSelection: true,
      riskAssessmentToolbarDoesNotCoverActiveTextareaAfterSelection: true,
      riskAssessmentDrilldownSummaryVisibleAfterDeepScroll: true,
      toolbarNearPaneTopAfterDeepScroll: true,
      toolbarDoesNotCoverActiveTextarea: true,
      pageHeightBoundedAfterDeepScroll: true,
      horizontalOverflowClosedAfterDeepScroll: true,
    },
    checks: [
      { result: "PASS" },
      { result: "PASS" },
      { result: "PASS" },
    ],
  });
  writeJson(rootDir, path.join("evaluation", "documents-drilldown-depth-2026-07-21", "report.json"), {
    verdict: "PASS_CURRENT_SOURCE",
    sourceHeadBeforeCommit: "fixture-sha",
    assertions: {
      defaultOpenSectionCount: 1,
      defaultOpenIndexes: [0],
      afterOpeningSecondSectionOpenCount: 1,
      afterOpeningSecondSectionOpenIndexes: [1],
      pageHeightRemainsBoundedAfterSectionSwitch: true,
      horizontalOverflowClosedAfterSectionSwitch: true,
      workpackPaneRemainsInsideViewport: true,
      openSectionTextareaVisibleInPaneAfterSectionSwitch: true,
      openSectionActionsVisibleAfterSectionSwitch: true,
      evidenceActionDrawerOpen: true,
      evidenceActionPanelVisibleInPane: true,
      evidenceActionPanelBelowToolbar: true,
      toolbarDoesNotCoverOpenSectionTextareaAfterSectionSwitch: true,
      selectedDocumentToolbarStillDoesNotCoverTextarea: true,
    },
    checks: [
      { result: "PASS" },
      { result: "PASS" },
      { result: "PASS" },
    ],
  });
  writeJson(rootDir, path.join("evaluation", "documents-inner-pane-depth-2026-07-21", "report.json"), {
    verdict: "PASS_PRODUCTION",
    sourceHead: "fixture-sha",
    assertions: {
      defaultOpenSectionCountIsOne: true,
      firstTextareaBelowToolbar: true,
      firstTextareaInsideFirstViewport: true,
    },
    productionConfirmation: {
      buildInfo: {
        commitSha: "fixture-sha",
        branch: "master",
        environment: "production",
      },
      mobile390x844: {
        bodyHeight: 844,
        workpackShellClientHeight: 320,
        workpackShellScrollHeight: 1447,
        editorSecondaryToolsHeight: 213,
        selectedTitle: "위험성평가표",
        riskLauncherPressed: true,
        horizontalOverflow: false,
      },
    },
  });
  writeJson(rootDir, path.join("evaluation", "documents-field-first-affordance-2026-07-21", "report.json"), {
    verdict: "PASS_PRODUCTION",
    sourceHead: "fixture-sha",
    assertions: {
      fieldStripVisibleBelowToolbar: true,
      fieldStripNamesCurrentEditableFieldEvidenceAndReview: true,
      evidenceAndReviewActionsVisibleInsidePane: true,
      firstTextareaTopVisibleInsidePane: true,
      firstTextareaUsableVisibleAreaAtLeast96px: true,
      defaultOpenSectionCountIsOne: true,
      horizontalOverflowClosed: true,
    },
    production: {
      mobile390x844: {
        bodyHeight: 844,
        selectedTitle: "위험성평가표",
        riskLauncherPressed: true,
        workpackShellBottom: 796,
        workpackShellClientHeight: 320,
        workpackShellScrollHeight: 1481,
        toolbarBottom: 572,
        fieldStripTop: 581,
        fieldStripBottom: 629,
        actionsBottom: 673,
        firstTextareaTop: 673,
        visibleTextareaHeightInsidePane: 123,
        toolbarCoversFieldStrip: false,
        toolbarCoversActions: false,
        toolbarCoversTextarea: false,
        horizontalOverflow: false,
      },
      desktop1440x723: {
        selectedTitle: "위험성평가표",
        visibleTextareaHeightInsidePane: 137,
        horizontalOverflow: false,
      },
    },
  });
  writeJson(rootDir, path.join("evaluation", "documents-risk-row-cockpit-2026-07-21", "report.json"), {
    verdict: "PASS_CURRENT_SOURCE",
    sourceHead: "fixture-sha",
    scope: {
      route: "/documents",
      document: "riskAssessmentDraft",
      providerDispatchLiveClaimed: false,
      fullDocumentIaClaimed: false,
      routeSplitAloneAcceptedAsFix: false,
    },
    contracts: {
      firstRiskRowHeaderBelowToolbar: true,
      firstHazardFieldUsableInShell: true,
      rowHeaderShowsEvidenceAndVerification: true,
      rawSectionTextareaSecondary: true,
      rowDetailsBehindDrilldown: true,
      mobileWorkpackShellScrollHeightCap: 1500,
      horizontalOverflowClosed: true,
    },
    commands: [
      { status: "PASS" },
      { status: "PASS" },
      { status: "PASS" },
      { status: "PASS" },
    ],
  });
  writeJson(rootDir, path.join("evaluation", "documents-tbm-cockpit-2026-07-21", "report.json"), {
    verdict: "PASS_CURRENT_SOURCE",
    source: {
      productCommit: "fixture-sha",
    },
    scope: {
      route: "/documents",
      surface: "tbmBriefing and tbmLogDraft",
      productionLiveClaimed: false,
    },
    contracts: {
      tbmCockpitVisible: true,
      tbmCockpitBelowToolbar: true,
      tbmRawTextareaSecondary: true,
      riskRowHeaderAndHazardStillVisible: true,
      providerOrExportContractsChanged: false,
    },
    verification: [
      { status: "PASS" },
      { status: "PASS" },
      { status: "PASS" },
    ],
  });
  writeJson(rootDir, path.join("evaluation", "documents-first-view-split-2026-07-21", "report.json"), {
    verdict: "PASS_CURRENT_SOURCE",
    source: {
      productCommit: "fixture-sha",
    },
    scope: {
      route: "/documents",
      productionLiveClaimed: false,
    },
    contracts: {
      coreDocumentsPrioritized: true,
      supportingDocumentsGrouped: true,
      workPlanExecutionCockpitBeforeRawEditor: true,
      permitExecutionCockpitBeforeRawEditor: true,
      riskAssessmentFirstHazardVisible: true,
      providerOrExportContractsChanged: false,
    },
    verification: [
      { status: "PASS" },
      { status: "PASS" },
      { status: "PASS" },
      { status: "PASS" },
    ],
  });
  writeJson(rootDir, path.join("evaluation", "documents-education-cockpit-2026-07-21", "report.json"), {
    verdict: "PASS_CURRENT_SOURCE",
    source: {
      productCommit: "fixture-sha",
    },
    scope: {
      route: "/documents",
      surface: "safetyEducationRecordDraft",
      productionLiveClaimed: false,
    },
    contracts: {
      educationCockpitVisible: true,
      educationCockpitBelowToolbar: true,
      educationRawTextareaSecondary: true,
      workPlanAndPermitCockpitsStillCovered: true,
      providerOrExportContractsChanged: false,
    },
    verification: [
      { status: "PASS" },
      { status: "PASS" },
      { status: "PASS" },
      { status: "PASS" },
    ],
  });
  writeJson(rootDir, path.join("evaluation", "documents-emergency-cockpit-2026-07-21", "report.json"), {
    verdict: "PASS_CURRENT_SOURCE",
    source: {
      productCommit: "fixture-sha",
    },
    scope: {
      route: "/documents",
      surface: "emergencyResponseDraft",
      productionLiveClaimed: false,
    },
    contracts: {
      emergencyCockpitVisible: true,
      emergencyCockpitBelowToolbar: true,
      emergencyRawTextareaSecondary: true,
      phoneNumbersNotInvented: true,
      providerOrExportContractsChanged: false,
    },
    verification: [
      { status: "PASS" },
      { status: "PASS" },
      { status: "PASS" },
      { status: "PASS" },
    ],
  });
  writeJson(rootDir, path.join("evaluation", "documents-complete-cockpits-2026-07-21", "report.json"), {
    verdict: "PASS_CURRENT_SOURCE",
    source: {
      productCommit: "fixture-sha",
    },
    scope: {
      route: "/documents",
      surface: "12 document first-task cockpits",
      productionLiveClaimed: false,
    },
    contracts: {
      allTwelveDocumentFirstTaskSurfaces: true,
      summaryCockpitVisible: true,
      riskAssessmentFirstHazardVisible: true,
      tbmCockpitsVisible: true,
      executionCockpitsVisible: true,
      educationAndForeignBriefingCockpitsVisible: true,
      emergencyCockpitVisible: true,
      photoCockpitVisible: true,
      transmissionCockpitsVisible: true,
      cockpitsBelowToolbar: true,
      rawTextareasSecondary: true,
      mobileCockpitsContainedInPane: true,
      providerOrExportContractsChanged: false,
    },
    coveredDocumentKeys: [
      "workpackSummaryDraft",
      "riskAssessmentDraft",
      "workPlanDraft",
      "workPermitDraft",
      "tbmBriefing",
      "tbmLogDraft",
      "safetyEducationRecordDraft",
      "foreignWorkerBriefing",
      "emergencyResponseDraft",
      "photoEvidenceDraft",
      "foreignWorkerTransmission",
      "kakaoMessage",
    ],
    verification: [
      { status: "PASS" },
      { status: "PASS" },
      { status: "PASS" },
      { status: "PASS" },
    ],
  });
  const liveDocumentRows = [
    "workpackSummaryDraft",
    "riskAssessmentDraft",
    "workPlanDraft",
    "workPermitDraft",
    "tbmBriefing",
    "tbmLogDraft",
    "safetyEducationRecordDraft",
    "foreignWorkerBriefing",
    "emergencyResponseDraft",
    "photoEvidenceDraft",
    "foreignWorkerTransmission",
    "kakaoMessage",
  ].map((key) => ({
    key,
    missing: false,
    pageHeight: 844,
    viewportHeight: 844,
    horizontalOverflow: false,
    targetVisibleInPane: true,
    targetBelowToolbar: true,
    toolbarCoversTarget: false,
    requiredTextPresent: true,
  }));
  writeJson(rootDir, path.join("evaluation", "documents-complete-cockpits-live-2026-07-21", "report.json"), {
    verdict: "PASS_PRODUCTION",
    buildInfo: {
      commitSha: "c651301742183e4b7644147570d4ae33d42c5dbc",
      branch: "master",
      environment: "production",
    },
    scope: {
      route: "/documents",
      surface: "12 document first-task cockpits",
      providerDispatchLiveClaimed: false,
      exportContractsChanged: false,
    },
    mobile390x844: liveDocumentRows,
    desktop1440x723: liveDocumentRows,
    assertions: {
      productionMarkerMatchesCompleteCockpitEvidence: true,
      allTargetsPresent: true,
      allTargetsVisibleInPane: true,
      allTargetsBelowToolbar: true,
      noToolbarTargetOverlap: true,
      requiredTextPresent: true,
      mobilePageHeightBounded: true,
      horizontalOverflowClosed: true,
    },
  });
  writeJson(rootDir, path.join("evaluation", "share-desktop-composition-2026-07-21", "report.json"), {
    verdict: "PASS_PRODUCTION",
    scope: {
      route: "/workspace",
      surface: "share",
      liveProviderDispatchClaimed: false,
    },
    production: {
      build: {
        commitSha: "fixture-sha",
        branch: "master",
        environment: "production",
      },
      desktop1440x900: {
        pageHeight: 900,
        viewportHeight: 900,
        previewLeft: 771,
        primaryRight: 755,
        previewRightOfPrimary: true,
        channelCardWidths: [191, 191, 191],
        channelCardHeights: [44, 44, 44],
        horizontalOverflow: 0,
      },
    },
  });
  writeJson(rootDir, path.join("evaluation", "share-desktop-short-cockpit-2026-07-21", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION",
    providerDispatchLiveClaimed: false,
    routeSplitAloneAcceptedAsFix: false,
    currentSource: {
      liveProductionGeometry: {
        build: {
          commitSha: "fixture-sha",
          branch: "master",
          environment: "production",
          deploymentUrl: "fixture-deployment.example",
        },
        share: {
          bodyHeight: 750,
          viewportHeight: 723,
          heightRatio: 1.04,
          shareRootBottom: 750,
          shareFormBottom: 689,
          shareTargetCardBottom: 535,
          shareLanguageCardBottom: 535,
          shareChannelCardBottom: 689,
          sharePreviewBottom: 605,
          primaryCtaBottom: 389,
          horizontalOverflow: 0,
          outsideHorizontalElements: 0,
        },
      },
    },
  });
  writeJson(rootDir, path.join("evaluation", "share-desktop-perception-2026-07-22", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_SCOPED_WORKSPACE_AND_INVITED_FIXTURE",
    sourceHead: "fixture-sha",
    productionBuild: {
      commitSha: "fixture-sha",
      branch: "master",
      environment: "production",
    },
    providerDispatchLiveClaimed: false,
    dbMutationPerformed: false,
    routeSplitAloneAcceptedAsFix: false,
    exactSavedUserSessionReproduced: false,
    exactSavedSessionVerdict: "MISSING_EVIDENCE",
    results: [
      {
        route: "/workspace share step",
        viewport: { label: "desktop-short-1440x723", width: 1440, height: 723 },
        verdict: "PASS",
        metrics: {
          viewportHeight: 723,
          rootWidthRatio: 0.82,
          distinctFirstViewportRegions: 4,
          desktopStatusRailDisplay: "grid",
          desktopStatusRailBottom: 688,
          horizontalOverflow: false,
          outsideElements: 0,
        },
      },
      {
        route: "/workspace share step",
        viewport: { label: "desktop-1440x900", width: 1440, height: 900 },
        verdict: "PASS",
        metrics: {
          viewportHeight: 900,
          rootWidthRatio: 0.82,
          distinctFirstViewportRegions: 4,
          desktopStatusRailDisplay: "grid",
          desktopStatusRailBottom: 700,
          horizontalOverflow: false,
          outsideElements: 0,
        },
      },
      {
        route: "/workspace share step",
        viewport: { label: "mobile-short-390x723", width: 390, height: 723 },
        verdict: "PASS",
        metrics: {
          viewportHeight: 723,
          desktopStatusRailDisplay: "none",
          primaryBottom: 696,
          previewBottom: 637,
          horizontalOverflow: false,
          outsideElements: 0,
        },
      },
      ...["desktop-short-1440x723", "desktop-1440x900"].map((label) => ({
        route: "/share/[sessionId] invited recipient fixture",
        viewport: { label, width: 1440, height: label.includes("723") ? 723 : 900 },
        verdict: "PASS",
        metrics: {
          distinctFirstViewportRegions: 2,
          horizontalOverflow: false,
          outsideElements: 0,
        },
      })),
    ],
  });
  writeJson(rootDir, path.join("evaluation", "share-staged-flow-rail-2026-07-21", "report.json"), {
    verdict: "PASS_CURRENT_SOURCE",
    source: {
      productCommit: "fixture-sha",
    },
    scope: {
      route: "/workspace?share",
      productionLiveClaimed: false,
    },
    contracts: {
      stageRailVisibleOnWorkspaceShareDesktop: true,
      stageRailStepCount: 4,
      desktopStageColumns: 4,
      desktopHorizontalOverflow: 0,
      ctaInsideDesktopViewport: true,
      previewInsideDesktopViewport: true,
      standaloneDispatchHeightGuardPreserved: true,
      providerContractsChanged: false,
    },
    freshGeometry: {
      workspaceShareDesktopDay1440x900: {
        stageRailItemCount: 4,
        stageColumns: 4,
        horizontalOverflow: 0,
        primaryBottom: 461,
        previewBottom: 817,
      },
      standaloneDispatchDesktop1440x900: {
        rootHeight: 626,
        primaryBottom: 542,
        previewBottom: 798,
        horizontalOverflow: 0,
      },
    },
  });
  writeJson(rootDir, path.join("evaluation", "share-mobile-stage-rail-collapse-2026-07-21", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION",
    productCommit: "fixture-sha",
    evidenceCommit: "fixture-sha",
    productionLiveClaimed: true,
    providerDispatchLiveClaimed: false,
    routeSplitAloneAcceptedAsFix: false,
    liveBuildInfo: {
      commitSha: "fixture-sha",
      branch: "master",
      environment: "production",
      deploymentUrl: "fixture-deployment.example",
    },
    currentSourceMetrics: {
      mobile390Day: {
        viewportHeight: 844,
        pageHeight: 980,
        summaryBottom: 391.5,
        previewBottom: 616.5,
        primaryBottom: 675.5,
        configToggleBottom: 734.5,
        stageRailDisplay: "none",
        configCardDisplays: ["none", "none", "none"],
        horizontalOverflow: 0,
      },
      desktopDay: {
        viewportHeight: 900,
        pageHeight: 946,
        previewBottom: 757,
        primaryBottom: 401,
        stageRailDisplay: "grid",
        stageColumns: 4,
        horizontalOverflow: 0,
      },
      generatedResultMobileFixture: {
        viewportHeight: 844,
        pageHeight: 980,
        resultSummaryBottom: 839,
        resultClosedByDefault: true,
        horizontalOverflow: 0,
      },
    },
  });
  writeJson(rootDir, path.join("evaluation", "share-mobile-exact-viewport-2026-07-21", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION",
    sourceCommit: "fixture-sha",
    evidenceCommitAtVerification: "fixture-sha",
    productionLiveClaimed: true,
    providerDispatchLiveClaimed: false,
    routeSplitAloneAcceptedAsFix: false,
    liveBuildInfo: {
      commitSha: "fixture-sha",
      branch: "master",
      environment: "production",
      deploymentUrl: "fixture-deployment.example",
    },
    mobile390Day: {
      liveProduction: {
        pageHeight: 844,
        viewportHeight: 844,
        heightRatio: 1,
        shareRootBottom: 810,
        summaryBottom: 485,
        previewBottom: 683,
        primaryBottom: 742,
        configToggleBottom: 801,
        stageRailDisplay: "none",
        configCardDisplays: ["none", "none", "none"],
        horizontalOverflow: 0,
      },
    },
  });
  writeJson(rootDir, path.join("evaluation", "share-recipient-cockpit-2026-07-22", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION",
    sourceHead: "fixture-sha",
    productionLiveClaimed: true,
    providerDispatchLiveClaimed: false,
    routeSplitAloneAcceptedAsFix: false,
    scope: [
      "app/share/[sessionId]/page.tsx",
      "app/globals.css",
      "tests/share-recipient-portal-browser.test.ts",
    ],
    metrics: {
      desktop1440x723: {
        bodyHeight: 945,
        viewportHeight: 723,
        ratio: 1.31,
        distinctColumns: 2,
        horizontalOverflow: false,
        outsideCards: 0,
        confirmButton: {
          bottom: 529,
        },
      },
      mobile390x844: {
        bodyHeight: 1572,
        viewportHeight: 844,
        ratio: 1.86,
        horizontalOverflow: false,
        outsideCards: 0,
        documentsCollapsedByDefault: true,
        confirmButton: {
          bottom: 707,
        },
      },
    },
  });
  writeJson(rootDir, path.join("evaluation", "workspace-ia-live-f67-2026-07-21", "report.json"), {
    verdict: "IA_BLOCKER_REFINED",
    liveCommitChecked: "fixture-sha",
    routeSplitAloneAcceptedAsFix: false,
    providerDispatchLiveClaimed: false,
    closedOrMostlyClosed: {
      workspaceDocumentsDefaultCockpit: {
        desktopShort1440x723: {
          bodyHeight: 723,
          viewportHeight: 723,
          documentPageBottom: 710,
          documentWorkbenchBottom: 710,
          overflowX: false,
          outside: 0,
        },
        mobile390x844: {
          bodyHeight: 844,
          viewportHeight: 844,
          documentPageBottom: 786,
          documentWorkbenchBottom: 786,
          overflowX: false,
          outside: 0,
        },
      },
      workspaceShareDefaultCockpit: {
        desktopShort1440x723: {
          bodyHeight: 723,
          viewportHeight: 723,
          shareRootBottom: 716,
          shareFormWidth: 636,
          sharePreviewWidth: 520,
          previewBottom: 571,
          primaryCtaBottom: 389,
          overflowX: false,
          outside: 0,
        },
        mobile390x844: {
          bodyHeight: 844,
          viewportHeight: 844,
          shareRootBottom: 810,
          shareFormWidth: 318,
          sharePreviewWidth: 318,
          previewBottom: 683,
          primaryCtaBottom: 742,
          overflowX: false,
          outside: 0,
        },
      },
    },
    openBlockers: {
      selectedDocumentEditorDetailLanding: {
        workspaceEditor: {
          desktopShort1440x723: {
            bodyHeight: 882,
            viewportHeight: 723,
            documentEditorBottom: 695,
            documentTextareaBottom: 1267,
          },
          mobile390x844: {
            bodyHeight: 1067,
            viewportHeight: 844,
            documentEditorBottom: 818,
            documentTextareaBottom: 1160,
          },
        },
      },
      shareDesktopPerceivedNarrowCard: {
        rawGeometryClosed: true,
      },
    },
  });
  writeJson(rootDir, path.join("evaluation", "workspace-editor-detail-landing-2026-07-21", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_FIELD_LEVEL",
    liveCommitChecked: "fixture-sha",
    routeSplitAloneAcceptedAsFix: false,
    providerDispatchLiveClaimed: false,
    fullRawTextareaVisibilityClaimed: false,
    selectedEditorFieldLevelLandingProven: true,
    longRawTextareaRemainsSecondary: true,
    liveMetrics: {
      desktopShort1440x723: {
        viewportHeight: 723,
        editorBodyHeight: 882,
        documentEditorBottom: 695,
        toolbarBottom: 195,
        firstRiskRowHeaderBottom: 579,
        firstRiskHazardFieldBottom: 675,
        documentTextareaTop: 1094,
        rowHeaderTextContainsEvidence: true,
        rowHeaderTextContainsVerification: true,
      },
      mobile390x844: {
        viewportHeight: 844,
        editorBodyHeight: 1067,
        documentEditorBottom: 818,
        toolbarBottom: 208,
        firstRiskRowHeaderBottom: 583,
        firstRiskHazardFieldBottom: 657,
        documentTextareaTop: 987,
        rowHeaderTextContainsEvidence: true,
        rowHeaderTextContainsVerification: true,
      },
    },
    acceptance: {
      riskRowHeaderInsideViewport: true,
      firstHazardFieldInsideViewport: true,
      rowHeaderShowsEvidenceAndVerification: true,
      textareaSecondaryBelowFirstWorkSurface: true,
      backendProviderExportContractsTouched: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "documents-selected-editor-cockpit-2026-07-22", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION",
    sourceHead: "fixture-sha",
    scope: {
      productionLiveClaimed: true,
      providerDispatchLiveClaimed: false,
      fullDocumentIaClaimed: false,
      routeSplitAloneAcceptedAsFix: false,
    },
    liveProduction: {
      buildInfo: {
        commitSha: "fixture-sha",
        branch: "master",
        environment: "production",
      },
      desktopShort1440x723: {
        viewportHeight: 723,
        sectionActions: { bottom: 463 },
        rawTextarea: { top: 1126 },
        horizontalOverflow: false,
        outsideHorizontalElements: 0,
      },
      mobile390x844: {
        viewportHeight: 844,
        sectionActions: { bottom: 440 },
        firstRiskHazardField: { bottom: 753 },
        rawTextarea: { top: 991 },
        horizontalOverflow: false,
        outsideHorizontalElements: 0,
      },
    },
    contracts: {
      fieldSummaryBeforeRawTextarea: true,
      evidenceRecheckActionsBeforeRawTextarea: true,
      mobileActionsBottomWithinFirstViewport: true,
      rawTextareaSecondary: true,
      canonicalRiskRowContractsPreserved: true,
    },
  });
  writeJson(rootDir, path.join("evaluation", "documents-cockpit-workbench-geometry-2026-07-22", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENTS_WORKBENCH",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", branch: "master", environment: "production" },
    routeSplitAloneAcceptedAsFix: false,
    rows: [
      {
        viewport: "1440x723",
        metrics: {
          viewportWidth: 1440,
          workbenchDisplay: "grid",
          workbenchColumnCount: 2,
          horizontalOverflow: false,
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
          viewportWidth: 390,
          workbenchDisplay: "grid",
          workbenchColumnCount: 1,
          horizontalOverflow: false,
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
  writeJson(rootDir, path.join("evaluation", "workspace-ia-live-7b36-2026-07-22", "report.json"), {
    verdict: "IA_BLOCKER_REFINED_CURRENT_LIVE",
    liveCommitChecked: "fixture-sha",
    routeSplitAloneAcceptedAsFix: false,
    providerDispatchLiveClaimed: false,
    closed: {
      defaultDocumentsCockpit: {
        desktopShort1440x723: {
          bodyHeight: 723,
          viewportHeight: 723,
          documentWorkbenchBottom: 710,
          visibleDocumentPreviews: 0,
          overflowX: false,
          outside: 0,
        },
        mobile390x844: {
          bodyHeight: 844,
          viewportHeight: 844,
          documentWorkbenchBottom: 786,
          visibleDocumentPreviews: 0,
          overflowX: false,
          outside: 0,
        },
      },
      defaultShareCockpit: {
        desktopShort1440x723: {
          bodyHeight: 723,
          viewportHeight: 723,
          shareRootBottom: 716,
          shareFormWidth: 636,
          sharePreviewWidth: 520,
          previewBottom: 571,
          primaryCtaBottom: 389,
          overflowX: false,
          outside: 0,
        },
        mobile390x844: {
          bodyHeight: 844,
          viewportHeight: 844,
          shareRootBottom: 810,
          previewBottom: 683,
          primaryCtaBottom: 742,
          overflowX: false,
          outside: 0,
        },
      },
      selectedEditorFieldLevelLanding: {
        desktopShort1440x723: {
          viewportHeight: 723,
          firstRiskRowHeaderBottom: 579,
          firstRiskHazardFieldBottom: 675,
          rowHeaderTextContainsEvidence: true,
          rowHeaderTextContainsVerification: true,
          rawTextareaTop: 1094,
        },
        mobile390x844: {
          viewportHeight: 844,
          firstRiskRowHeaderBottom: 583,
          firstRiskHazardFieldBottom: 657,
          rowHeaderTextContainsEvidence: true,
          rowHeaderTextContainsVerification: true,
          rawTextareaTop: 987,
        },
      },
    },
    open: {
      selectedEditorRawTextareaDepth: {
        status: "open_secondary_drilldown",
      },
      shareDesktopPerceivedNarrowWorkbench: {
        status: "optional_follow_up_if_reproduced",
      },
    },
  });
  writeJson(rootDir, path.join("evaluation", "documents-mobile-exact-cockpit-2026-07-21", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION",
    productCommit: "fixture-sha",
    evidenceCommitAtVerification: "fixture-sha",
    productionLiveClaimed: true,
    providerDispatchLiveClaimed: false,
    routeSplitAloneAcceptedAsFix: false,
    liveBuildInfo: {
      commitSha: "fixture-sha",
      branch: "master",
      environment: "production",
      deploymentUrl: "fixture-deployment.example",
    },
    mobile390Day: {
      liveProduction: {
        documentsPageHeight: 844,
        documentsViewportHeight: 844,
        documentsHeightRatio: 1,
        documentsHorizontalOverflow: false,
        documentsOutsideViewport: 0,
        documentWorkbenchBottom: 786,
        documentDeepReviewOpen: false,
        visibleDocumentPreviews: 0,
        sharePageHeight: 844,
        shareViewportHeight: 844,
        shareHeightRatio: 1,
      },
    },
  });
  writeJson(rootDir, path.join("evaluation", "share-mobile-full-flow-2026-07-21", "report.json"), {
    verdict: "PASS",
    mobile390x844Day: {
      shareMobileSummaryBottom: 256,
      sharePreviewBottom: 510,
      primaryShareCtaBottom: 571,
      configToggleBottom: 632,
      horizontalOverflow: 0,
      configCardDisplays: ["none", "none", "none"],
      expandedOnDemand: {
        expanded: true,
        configCardDisplays: ["grid", "grid", "grid"],
      },
    },
    interpretation: {
      providerDispatchLiveClaimed: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "share-result-drilldown-2026-07-21", "report.json"), {
    verdict: "PASS",
    generatedProviderResultFixture: {
      fixtureGeneratedProviderResultProof: true,
      providerDispatchLiveClaimed: false,
      externalProviderCalled: false,
      desktop1440x900: {
        verdict: "PASS",
        dispatchPostCount: 1,
        pageHeight: 900,
        viewportHeight: 900,
        horizontalOverflow: 0,
        primaryBottom: 382,
        previewBottom: 738,
        resultSummaryBottom: 772,
        resultOpenByDefault: false,
        openedChannelResultCount: 2,
        distinctFirstViewportXRanges: [160, 800],
        resultPanelWidth: 606,
        resultPanelMonopolizesViewportWidth: false,
      },
      mobile390x844: {
        verdict: "PASS",
        dispatchPostCount: 1,
        pageHeight: 1052,
        viewportHeight: 844,
        horizontalOverflow: 0,
        previewBottom: 577,
        primaryBottom: 638,
        resultSummaryBottom: 813,
        resultOpenByDefault: false,
        openedChannelResultCount: 2,
        configCardsCollapsedByDefault: true,
      },
      assertions: {
        dispatchPostCalledExactlyOnce: true,
        responseIdempotencyKeyCaptured: true,
        resultClosedByDefault: true,
        closedResultSummaryShowsChannelStatus: true,
        openedResultShowsValidationCopy: true,
        openedResultShowsChannelStatus: true,
        openedResultChannelCount: 2,
        desktopPreviewRightPane: true,
        desktopDistinctRegions: true,
        desktopResultPanelNotMonopolizingWidth: true,
        mobileConfigCardsCollapsed: true,
      },
    },
  });
  writeJson(rootDir, path.join("evaluation", "share-recipient-long-content-fixture-2026-07-25", "report.json"), {
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
    rows: [
      ["day", "desktop-short-1440x723", 1440, 723, 529, 2],
      ["day", "desktop-1440x900", 1440, 900, 529, 2],
      ["day", "mobile-390x723", 390, 723, 707, 1],
      ["night", "desktop-short-1440x723", 1440, 723, 529, 2],
      ["night", "desktop-1440x900", 1440, 900, 529, 2],
      ["night", "mobile-390x723", 390, 723, 707, 1],
    ].map(([theme, viewport, viewportWidth, viewportHeight, confirmationBottom, desktopXRegionCount]) => ({
      metrics: {
        theme,
        viewport,
        viewportWidth,
        viewportHeight,
        confirmationBottom,
        desktopXRegionCount,
        rootHeightRatio: viewportWidth === 390 ? 1.4 : 0.99,
        taskBodyContained: true,
        documentsPanelOpen: false,
        previewContainedCount: 4,
        collapsedDocumentCount: 3,
        outsideCards: 0,
        horizontalOverflow: false,
      },
      verdicts: {
        overallVerdict: "PASS_SCOPED",
        exactSavedSessionVerdict: "MISSING_EVIDENCE",
      },
    })),
  });
  writeJson(rootDir, path.join("evaluation", "share-exact-session-boundary-2026-07-22", "report.json"), {
    schemaVersion: "safeclaw-share-exact-session-boundary/v1",
    verdict: "MISSING_EXACT_SAVED_SESSION_EVIDENCE_NO_MUTATION_BOUNDARY_CONFIRMED",
    exactSavedUserSessionReproduced: false,
    exactSavedSessionUrlProvided: false,
    exactSavedSessionPayloadProvided: false,
    sessionKind: "missing-exact",
    exactSessionAcceptance: {
      desktopColumnCountMin: 2,
      firstActionMustBeInViewport: true,
      horizontalOverflowAllowed: false,
    },
    boundary: {
      fixtureProofAcceptedAsExactSavedSession: false,
      generatedWorkspaceProofAcceptedAsExactSavedSession: false,
      exactSavedSessionRequiredForUserSpecificPass: true,
      providerDispatchLiveClaimed: false,
      externalProviderCalled: false,
      dbMutationPerformed: false,
      dispatchMutationPerformed: false,
      exactSessionMutationRequestCount: 0,
    },
  });
  writeJson(rootDir, path.join("evaluation", "share-recipient-ack-approval-preflight-current-2026-07-19", "report.json"), {
    schemaVersion: "safeclaw-share-recipient-ack-approval-preflight/v1",
    overall: "approval_ready_open",
    approvalRequired: true,
    liveDataMutationApproved: false,
    dbMutationPerformed: false,
    providerMessageSent: false,
    productionShareSessionCreated: false,
    productionReadConfirmationInserted: false,
    failedCheckIds: [],
  });
  writeJson(rootDir, path.join("evaluation", "share-public-session-storage-readiness-2026-07-23", "report.json"), {
    verdict: "RED_PUBLIC_SHARE_SESSION_TABLE_MISSING_FROM_SCHEMA_CACHE_NO_MUTATION",
    dbMutationPerformed: false,
    providerDispatchLiveClaimed: false,
    externalProviderCalled: false,
    serviceRoleReadOnlyProbe: {
      workpackShareSessionsFullSelect: {
        readable: false,
        error: {
          code: "PGRST205",
          message: "Could not find the table 'public.workpack_share_sessions' in the schema cache",
        },
      },
    },
  });
  writeJson(rootDir, path.join("evaluation", "share-public-session-storage-approval-2026-07-23", "report.json"), {
    verdict: "APPROVAL_REQUIRED_PUBLIC_SHARE_SESSION_STORAGE_MIGRATION_NO_MUTATION",
    approvalBoundary: {
      operatorApprovalRequiredBeforeMigration: true,
      shareSessionCreationWouldInsertWorkpackShareSessions: true,
      dbMutationPerformed: false,
      schemaMutationAuthorized: false,
      providerDispatchLiveClaimed: false,
      externalProviderCalled: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "dispatch-standalone-cockpit-2026-07-21", "report.json"), {
    verdict: "PASS_PRODUCTION",
    acceptance: {
      pageHeightWithin135Viewport: true,
      rootWidthAtLeast1040: true,
      primaryCtaInsideViewport: true,
      previewInsideViewport: true,
      previewRightOfPrimaryAction: true,
      channelCardsReadableAndCompact: true,
      horizontalOverflowClosed: true,
    },
    production: {
      liveVerified: true,
      commitSha: "fixture-sha",
      metrics: {
        pageHeight: 1116,
        heightRatio: 1.24,
        horizontalOverflow: false,
        outside: 0,
      },
    },
    sampleShellFollowUp: {
      productionVerification: {
        liveVerified: true,
        commitSha: "fixture-sha",
        desktop1440x900: {
          horizontalOverflow: 0,
          wideStackClosed: true,
          firstPanel: { width: 635 },
          secondPanel: { width: 413 },
        },
        mobile390x844: {
          horizontalOverflow: 0,
          singleColumn: true,
        },
      },
    },
  });
  writeJson(rootDir, path.join("evaluation", "kosha-current-northstar-regression-2026-07-22", "report.json"), {
    title: "KOSHA Current North Star Regression Gate",
    verdict: "PASS",
    dbSchemaChanged: false,
    supabaseWrites: false,
    embeddingGenerated: false,
    embeddingUploaded: false,
    coveredExactPins: ["D-C-13-2026", "D-C-7-2026", "B-E-10-2026"],
    verification: {
      structuredMaterializationAndHarness: { status: "PASS", testsPassed: 50 },
      exactTrustAndCorpus: { status: "PASS", testsPassed: 173 },
      combinedFocusedRegression: { status: "PASS", testsPassed: 226 },
      typecheck: { status: "PASS" },
    },
  });
  writeJson(rootDir, path.join("evaluation", "kosha-current-master-reconciliation-2026-07-19", "report.json"), {
    verdict: "pass_current_master_kosha_exact_registry_and_local_corpus_readiness",
    productionExactPins: ["D-C-13", "D-C-7", "B-E-10"],
    verification: {
      focusedKoshaVitest: {
        testsPassed: 80,
        testsTotal: 80,
        status: "pass",
      },
      productionBuild: {
        staticPagesGenerated: 28,
        staticPagesTotal: 28,
        status: "pass",
      },
      nextFileTrace: {
        manifestCount: 82,
        allExactAssetsManifestCount: 18,
        partialExactAssetsManifestCount: 0,
        status: "pass",
      },
      liveStatusProbe: {
        status: "ready",
        searchReady: true,
        localCorpusStatus: "ready",
        localCorpusItemCount: 234,
        localCorpusChunkCount: 7127,
        exactTrustRegistryStatus: "ready",
        exactTrustRegistryCount: 3,
        exactTrustRegistryKeys: ["D-C-13", "D-C-7", "B-E-10"],
        exactTrustRegistryPartialFailure: false,
      },
    },
    mutations: {
      dbSchemaChanged: false,
      supabaseDataChanged: false,
      corpusUploaded: false,
      historicalWave2RangeMerged: false,
    },
  });
  writeText(rootDir, path.join("evaluation", "kosha-exact-trust-current-live-2026-07-19", "report.md"), [
    "# KOSHA Exact Trust Current Live Gate",
    "- `D-C-13-2026`",
    "- `D-C-7-2026`",
    "- `B-E-10-2026`",
    "General KOSHA guide rows are not promoted to direct evidence unless they pass the exact trust gate.",
  ].join("\n"));
  writeJson(rootDir, path.join("evaluation", "kosha-current-live-gate-2026-07-20", "report.json"), {
    schemaVersion: "safeclaw-kosha-current-live-gate/v1",
    verdict: "pass_current_kosha_exact_trust_and_corpus_gate",
    liveStatus: {
      status: "ready",
      catalogSearchOk: true,
      localCorpus: {
        status: "ready",
        itemCount: 234,
        chunkCount: 7127,
      },
      exactTrustRegistry: {
        status: "ready",
        count: 3,
        stableDocumentKeys: ["D-C-13", "D-C-7", "B-E-10"],
      },
    },
    verification: [
      { command: "npm.cmd test -- KOSHA focused", result: "pass", filesPassed: 5, testsPassed: 80 },
      { command: "python -m unittest scripts.tests.test_acquire_exact_kosha_body", result: "pass", testsPassed: 19 },
      { command: "npm.cmd run typecheck", result: "pass" },
    ],
  });
  writeJson(rootDir, path.join("evaluation", "kosha-exact-promotion-review-gate-2026-07-22", "report.json"), {
    schemaVersion: "safeclaw-kosha-exact-promotion-review-gate/v1",
    verdict: "REVIEW_CHECKLIST_INCOMPLETE_BLOCKED",
    mutationPerformed: false,
    dbMutationPerformed: false,
    embeddingGenerationPerformed: false,
    exactPromotionPerformed: false,
    providerDispatchLiveClaimed: false,
    candidateCount: 8,
    reviewedCandidateCount: 8,
    passedCandidateCount: 0,
    reviewChecklistComplete: false,
    exactTrustPromotionBlockedUntilChecklistComplete: true,
    exactTrustPromotionStillRequiresSeparateApproval: true,
    officialPdfAuditMachineVerified: true,
    officialLifecycleAuditMachineSupported: true,
    officialLifecycleTitleVariantFindingCount: 0,
    reviewerSupportMachineVerified: true,
    reviewerSupportHumanReviewCompleted: false,
    failures: Array.from({ length: 64 }, (_, index) => `unconfirmed-required-check:${index}`),
  });
  writeJson(rootDir, path.join("evaluation", "kosha-exact-official-pdf-audit-2026-07-25", "report.json"), {
    schemaVersion: "safeclaw-kosha-exact-official-pdf-audit/v1",
    verdict: "PASS_OFFICIAL_PDF_AUTHENTICITY_BODY_PAIR_REVIEW_STILL_REQUIRED",
    candidateCount: 8,
    machineVerifiedCount: 8,
    failedCount: 0,
    temporaryPdfFilesRetained: 0,
    exactPromotionPerformed: false,
    separatePromotionApprovalRequired: true,
    reviewChecklistImpact: {
      officialUrlExpectedFileMachineSupported: true,
      officialMetadataAndBodyProvenanceMachineSupported: true,
      bodyAndPdfHashMachineRechecked: true,
      operatorLifecycleCurrentStatusConfirmed: false,
      humanConfirmationRecorded: false,
      reviewChecklistComplete: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      embeddingGenerated: false,
      vectorUploadPerformed: false,
      exactTrustRegistryMutationPerformed: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "kosha-exact-official-lifecycle-audit-2026-07-25", "report.json"), {
    schemaVersion: "safeclaw-kosha-exact-official-lifecycle-audit/v1",
    verdict: "PASS_OFFICIAL_CURRENT_LIFECYCLE_MACHINE_SUPPORTED_HUMAN_REVIEW_REQUIRED",
    candidateCount: 8,
    machineLifecycleSupportedCount: 8,
    exactTitleIdentityMatchCount: 8,
    failedCount: 0,
    titleVariantFindingCount: 0,
    exactPromotionPerformed: false,
    separatePromotionApprovalRequired: true,
    reviewChecklistImpact: {
      operatorLifecycleCurrentStatusConfirmed: false,
      humanConfirmationRecorded: false,
      reviewChecklistComplete: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      embeddingGenerated: false,
      vectorUploadPerformed: false,
      exactTrustRegistryMutationPerformed: false,
    },
    results: Array.from({ length: 8 }, (_, index) => ({
      stableKey: index === 0 ? "A-G-1" : index === 1 ? "E-G-4" : `KEY-${index}`,
      officialTitleExactMatch: true,
      findings: [],
      machineLifecycleSupported: true,
      operatorLifecycleCurrentStatusConfirmed: false,
      humanConfirmed: false,
    })),
  });
  writeJson(rootDir, path.join("evaluation", "kosha-exact-promotion-reviewer-support-2026-07-25", "report.json"), {
    schemaVersion: "safeclaw-kosha-exact-promotion-reviewer-support/v1",
    verdict: "PASS_MACHINE_REVIEWER_SUPPORT_HUMAN_CONFIRMATION_REQUIRED",
    candidateCount: 8,
    machineSupportedCount: 8,
    failedCount: 0,
    semanticGroupCount: 24,
    failedSemanticGroupCount: 0,
    reviewBoundary: {
      humanReviewCompleted: false,
      reviewChecklistComplete: false,
      machineEvidenceReplacesHumanReview: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      embeddingGenerated: false,
      vectorUploadPerformed: false,
      exactTrustRegistryMutationPerformed: false,
    },
    exactPromotionPerformed: false,
    exactRegistryWriteArtifactCreated: false,
    separatePromotionApprovalRequired: true,
  });
  writeJson(rootDir, path.join("evaluation", "kosha-exact-promotion-reviewer-cockpit-2026-07-25", "report.json"), {
    schemaVersion: "safeclaw-kosha-exact-promotion-reviewer-cockpit/v1",
    verdict: "PASS_NO_MUTATION_KOSHA_REVIEWER_COCKPIT_READY",
    candidateCount: 8,
    semanticGroupCount: 24,
    checklistInputCount: 64,
    initialCompletedInputCount: 0,
    exportInitiallyDisabled: true,
    boundary: {
      localReviewOnly: true,
      dbMutationPerformed: false,
      exactRegistryWriteArtifactCreated: false,
      exactPromotionPerformed: false,
      machineEvidenceReplacesHumanReview: false,
      separatePromotionApprovalRequired: true,
    },
  });
  writeJson(rootDir, path.join("evaluation", "dispatch-standalone-viewport-2026-07-28", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_STANDALONE_DISPATCH_VIEWPORT_COCKPIT",
    sourceHead: "fixture-sha",
    productionBuild: {
      commitSha: "fixture-sha",
      branch: "master",
      environment: "production",
    },
    afterLive: {
      desktopShort: {
        viewport: { width: 1440, height: 723 },
        primaryBottom: 538,
        previewBottom: 717,
        rootClientHeight: 382,
        rootScrollHeight: 614,
        rootOverflowY: "auto",
        horizontalOverflow: 0,
      },
      mobileShortDay: {
        viewport: { width: 390, height: 723 },
        primaryBottom: 581,
        visibleConfigCardCount: 0,
        rootOverflowY: "auto",
        horizontalOverflow: 0,
      },
      mobileShortNight: {
        viewport: { width: 390, height: 723 },
        primaryBottom: 581,
        horizontalOverflow: 0,
      },
    },
    acceptanceContract: {
      routeSplitAloneAcceptedAsFix: false,
      desktopRequiresTwoPaneWorkbench: true,
      desktopPreviewContainedInFirstViewport: true,
      mobilePrimaryActionContainedInFirstViewport: true,
      longPreviewUsesInternalScroll: true,
      mobileConfigurationCollapsedByDefault: true,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      embeddingOrVectorMutationPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      exactSavedShareUserSessionReproduced: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "kosha-exact-promotion-reviewer-cockpit-2026-07-25", "browser-report.json"), {
    schemaVersion: "safeclaw-kosha-exact-promotion-reviewer-cockpit-browser/v1",
    verdict: "PASS_LOCAL_KOSHA_REVIEWER_COCKPIT_GEOMETRY",
    cases: 3,
    passedCases: 3,
    desktopPass: true,
    mobilePass: true,
    results: [
      { name: "desktop-1440x723", viewport: { width: 1440, height: 723 } },
      { name: "mobile-evidence-390x723", viewport: { width: 390, height: 723 } },
      { name: "mobile-review-390x723", viewport: { width: 390, height: 723 } },
    ].map((row) => ({
      ...row,
      body: {
        scrollWidth: row.viewport.width,
        clientWidth: row.viewport.width,
        scrollHeight: row.viewport.height,
        clientHeight: row.viewport.height,
      },
      visibleCandidatePanelCount: 1,
      candidateButtonCount: 8,
      requiredCheckCount: 40,
      semanticGroupCount: 24,
      exportInitiallyDisabled: true,
      horizontalOverflow: false,
    })),
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      embeddingGenerated: false,
      vectorUploadPerformed: false,
      exactTrustRegistryMutationPerformed: false,
      exactPromotionPerformed: false,
    },
    remainingBoundary: {
      humanReviewCompleted: false,
      separatePromotionApprovalRequired: true,
    },
  });
  writeJson(rootDir, path.join("evaluation", "kosha-exact-promotion-review-contract-audit-2026-07-23", "report.json"), {
    schemaVersion: "safeclaw-kosha-exact-promotion-review-contract-audit/v1",
    verdict: "PASS_CURRENT_SOURCE_REVIEW_GATE_CONTRACT_NO_MUTATION",
    contractEvidence: {
      shallowHumanConfirmationBlocked: true,
      completedReviewStillRequiresSeparateApproval: true,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      exactPromotionPerformed: false,
      exactRegistryWriteArtifactCreated: false,
    },
  });
  execFileSync("git", ["add", "."], { cwd: rootDir, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: rootDir, stdio: "ignore" });
  return rootDir;
}

describe("northstar open gate audit", () => {
  it("keeps approval-gated north-star work open instead of complete", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("open");
    expect(audit.gates.find((gate) => gate.id === "final_99_gate")?.state).toBe("notice");
    expect(audit.gates.find((gate) => gate.id === "live_harness_quality")?.state).toBe("proven");
    expect(audit.gates.find((gate) => gate.id === "live_document_quality_matrix")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "live-document-quality-matrix-2026-07-24", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_quality_matrix")?.detail).toContain("Five live production scenarios");
    expect(audit.gates.find((gate) => gate.id === "live_document_quality_matrix")?.detail).toContain("does not replace broad human wording review");
    expect(audit.gates.find((gate) => gate.id === "live_document_quality_stress_matrix")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "live-document-quality-stress-matrix-2026-07-24", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_quality_stress_matrix")?.detail).toContain("SDS/GHS identity");
    expect(audit.gates.find((gate) => gate.id === "live_document_quality_stress_matrix")?.detail).toContain("broad human wording review remains separate");
    expect(audit.gates.find((gate) => gate.id === "live_document_field_isolation")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "live-document-field-isolation-2026-07-25", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_field_isolation")?.detail).toContain("process/task/equipment");
    expect(audit.gates.find((gate) => gate.id === "live_document_field_isolation")?.detail).toContain("exact saved Share geometry remain separate");
    expect(audit.gates.find((gate) => gate.id === "live_kosha_exact_materialization")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "live-kosha-exact-materialization-2026-07-25", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "live_kosha_exact_materialization")?.detail).toContain("D-C-13, D-C-7, and B-E-10");
    expect(audit.gates.find((gate) => gate.id === "live_kosha_exact_materialization")?.detail).toContain("exact-registry expansion");
    expect(audit.gates.find((gate) => gate.id === "live_document_wording_review")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "live-document-wording-review-2026-07-24", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_wording_review")?.detail).toContain("fixed-profile location leakage");
    expect(audit.gates.find((gate) => gate.id === "live_document_wording_review")?.detail).toContain("broad human review");
    expect(audit.gates.find((gate) => gate.id === "live_document_broad_review")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "live-document-broad-review-2026-07-25", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_broad_review")?.detail).toContain("uiDocumentCount=12");
    expect(audit.gates.find((gate) => gate.id === "live_document_broad_review")?.detail).toContain("workPermitDraft presentNonEmpty=5/5");
    expect(audit.gates.find((gate) => gate.id === "live_document_broad_review")?.detail).toContain("exact saved Share remains MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "live_document_broad_review")?.detail).toContain("six-document synthetic wording gate is not used");
    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "live-document-editorial-review-2026-07-25", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")?.detail).toContain("all 60 canonical document surfaces");
    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")?.detail).toContain("generic-template overuse 4->0");
    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")?.detail).toContain("exact=31");
    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")?.detail).toContain("near=100");
    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")?.detail).toContain("unclassified human-review-required 54->0");
    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")?.detail).toContain("irrelevant document findings");
    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")?.detail).toContain("five-scenario/60-document contract");
    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")?.detail).toContain("preventing 비산 from being treated as rain");
    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")?.detail).toContain("humanReviewCompleted=false");
    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")?.detail).toContain("exact saved Share remains MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "product-capability-truth-2026-07-25", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")?.detail).toContain("preview-only");
    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")?.detail).toContain("dispatch-entry-capability-truth");
    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")?.detail).toContain("landing-human-review-boundary");
    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")?.detail).toContain("exact saved Share remains MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")?.detail).toContain("OPEN_SEPARATE_VIEWPORT_IA_WAVE");
    expect(audit.gates.find((gate) => gate.id === "dependency_security_remediation")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "dependency-security-remediation-2026-07-28", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "dependency_security_remediation")?.detail).toContain("19 findings to 0");
    expect(audit.gates.find((gate) => gate.id === "dependency_security_remediation")?.detail).toContain("not a full repository security-scan");
    expect(audit.gates.find((gate) => gate.id === "dependency_security_remediation")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "full_repository_security_scan")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "follow-up-full-repository-security-scan-2026-08-02", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "full_repository_security_scan")?.detail).toContain("5,241 tracked files");
    expect(audit.gates.find((gate) => gate.id === "full_repository_security_scan")?.detail).toContain("17 reportable findings");
    expect(audit.gates.find((gate) => gate.id === "full_repository_security_scan")?.detail).toContain("one renderer-dependent candidate deferred in the immutable baseline");
    expect(audit.gates.find((gate) => gate.id === "full_repository_security_scan")?.detail).toContain("distributed-rate residual");
    expect(audit.gates.find((gate) => gate.id === "full_repository_security_scan")?.detail).toContain("not a security-complete claim");
    expect(audit.gates.find((gate) => gate.id === "full_repository_security_scan")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "learning_export_renderer_security")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "learning-export-renderer-security-2026-08-02", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "learning_export_renderer_security")?.detail).toContain("renderer-independent inert-text contract");
    expect(audit.gates.find((gate) => gate.id === "learning_export_renderer_security")?.detail).toContain("does not rewrite the sealed partial scan");
    expect(audit.gates.find((gate) => gate.id === "learning_export_renderer_security")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "tenant_authorization_remediation")).toMatchObject({ state: "proven" });
    expect(audit.gates.find((gate) => gate.id === "tenant_authorization_remediation")?.detail).toContain("2/2");
    expect(audit.gates.find((gate) => gate.id === "spreadsheet_formula_neutralization")).toMatchObject({ state: "proven" });
    expect(audit.gates.find((gate) => gate.id === "spreadsheet_formula_neutralization")?.detail).toContain("12 remain");
    expect(audit.gates.find((gate) => gate.id === "public_provider_work_budget")).toMatchObject({ state: "proven" });
    expect(audit.gates.find((gate) => gate.id === "public_provider_work_budget")?.detail).toContain("8 remain");
    expect(audit.gates.find((gate) => gate.id === "document_export_work_budget")).toMatchObject({ state: "proven" });
    expect(audit.gates.find((gate) => gate.id === "document_export_work_budget")?.detail).toContain("All 18");
    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_authority")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "hermes-knowledge-review-contract-live-2026-07-25", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_authority")?.detail).toContain("SIF -> KOSHA -> law");
    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_authority")?.detail).toContain("APPROVAL_GATED");
    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_authority")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_ui")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "hermes-knowledge-review-authority-ui-2026-07-25", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_ui")?.detail).toContain("8/8");
    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_ui")?.detail).toContain("APPROVAL_GATED");
    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_ui")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "live_document_secondary_grounding")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "live-document-secondary-grounding-2026-07-25", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_secondary_grounding")?.detail).toContain("documents=30/30");
    expect(audit.gates.find((gate) => gate.id === "live_document_secondary_grounding")?.detail).toContain("cross-scenario leakage=0");
    expect(audit.gates.find((gate) => gate.id === "live_document_secondary_grounding")?.detail).toContain("exact saved Share remains MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "live_document_seed_profile_isolation")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "live-document-seed-profile-isolation-2026-07-25", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_seed_profile_isolation")?.detail).toContain("forbidden fragments 90->0");
    expect(audit.gates.find((gate) => gate.id === "live_document_seed_profile_isolation")?.detail).toContain("document surface=60");
    expect(audit.gates.find((gate) => gate.id === "live_document_seed_profile_isolation")?.detail).toContain("exact saved Share remains MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.state).toBe("proven");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("Scoped first-task cockpit proof only, not full Documents/Share IA completion");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("12 unique document keys");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("exactly 3 visible core launchers");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("0 visible supporting launchers");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("legacy document index hidden");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("12 document first-task cockpits");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("staged Share rail");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("desktop-short 1440x723");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("three-zone cockpit");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("390x723 mobile stack");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("invited recipient fixture retains a separate desktop two-zone contract");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("live mobile selected-summary");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("exact 844px viewport");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("exact one-viewport Documents");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("selected editor/detail field-summary risk-row landing");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("selected-editor field summary plus evidence/recheck CTA before raw textarea");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("not a claim that the whole Documents page is short");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("raw textarea/full long-form editing remains open secondary drilldown");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("/share/[sessionId] desktop recipient confirmation");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("mobile confirmation CTA before document details");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.evidencePath).toBe(
      path.join("evaluation", "documents-cockpit-workbench-geometry-2026-07-22", "report.json"),
    );
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("raw textarea and deeper row/all-document authoring");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("selected-editor evidence/recheck CTA is live-proven before raw textarea");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("default exposure budget");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("shell ratio target <= 3");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("first viewport shows current status, core 3 launcher, selected document workbench");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("2-3 region cockpit for recipient/channel/status/provenance");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("exact saved user session");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("do not phrase it as documents page height fixed");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("desktop width-ratio/grid metrics");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("/share/[sessionId] recipient cockpit geometry is live-proven");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("invited recipient fixture, exact saved/generated /share/[sessionId], and manager/workspace share-result");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).not.toContain("Promote the Share staged rail");
    expect(audit.gates.find((gate) => gate.id === "dispatch_standalone_cockpit")?.state).toBe("proven");
    expect(audit.gates.find((gate) => gate.id === "dispatch_standalone_cockpit")?.evidencePath).toBe(
      path.join("evaluation", "dispatch-standalone-viewport-2026-07-28", "report.json"),
    );
    expect(audit.gates.find((gate) => gate.id === "dispatch_standalone_cockpit")?.detail).toContain("mobile Day/Night primary bottom=581/581");
    expect(audit.gates.find((gate) => gate.id === "dispatch_standalone_cockpit")?.detail).toContain("exact saved Share MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "share_result_fixture_cockpit")?.state).toBe("proven");
    expect(audit.gates.find((gate) => gate.id === "share_recipient_long_content_fixture")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "share-recipient-long-content-fixture-2026-07-25", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "share_recipient_long_content_fixture")?.detail).toContain("six day/night");
    expect(audit.gates.find((gate) => gate.id === "share_recipient_long_content_fixture")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "share_recipient_long_content_fixture")?.detail).toContain("Route split alone");
    expect(audit.gates.find((gate) => gate.id === "share_exact_saved_session_boundary")?.state).toBe("notice");
    expect(audit.gates.find((gate) => gate.id === "share_exact_saved_session_boundary")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "share_exact_saved_session_boundary")?.detail).toContain("fixture or generated /workspace Share proof is explicitly not accepted");
    expect(audit.gates.find((gate) => gate.id === "share_exact_saved_session_boundary")?.detail).toContain("PGRST205");
    expect(audit.gates.find((gate) => gate.id === "share_exact_saved_session_boundary")?.detail).toContain("APPROVAL_REQUIRED_PUBLIC_SHARE_SESSION_STORAGE_MIGRATION_NO_MUTATION");
    expect(audit.gates.find((gate) => gate.id === "share_exact_saved_session_boundary")?.detail).toContain("share-session creation would insert storage is true");
    expect(audit.gates.find((gate) => gate.id === "share_exact_saved_session_boundary")?.nextActions.join("\n")).toContain("concrete production /share/[sessionId]?workerId=...");
    expect(audit.gates.find((gate) => gate.id === "share_exact_saved_session_boundary")?.nextActions.join("\n")).toContain("sessionKind=saved-exact");
    expect(audit.gates.find((gate) => gate.id === "share_exact_saved_session_boundary")?.nextActions.join("\n")).toContain("PostgREST schema cache");
    expect(audit.gates.find((gate) => gate.id === "share_exact_saved_session_boundary")?.nextActions.join("\n")).toContain("Do not call POST /api/workpacks/[id]/share-sessions without explicit DB-backed share-session creation approval");
    expect(audit.gates.find((gate) => gate.id === "provider_dispatch_persistence")?.state).toBe("approval_gated");
    expect(audit.gates.find((gate) => gate.id === "provider_dispatch_persistence")?.detail).toContain("attempt-level idempotency reservation");
    expect(audit.gates.find((gate) => gate.id === "provider_dispatch_persistence")?.detail).toContain("per-channel result persistence");
    expect(audit.gates.find((gate) => gate.id === "provider_dispatch_persistence")?.evidencePath).toBe(
      path.join("evaluation", "provider-dispatch-idempotency-gate-2026-07-19", "report.json"),
    );
    expect(audit.gates.find((gate) => gate.id === "supabase_rls_launch_isolation")?.state).toBe("approval_gated");
    expect(audit.gates.find((gate) => gate.id === "llm_wiki_publication")?.state).toBe("approval_gated");
    expect(audit.gates.find((gate) => gate.id === "sif_embedding_runtime")?.state).toBe("approval_gated");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_trust_registry")?.state).toBe("proven");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_trust_registry")?.nextActions).toContain(
      "Use evaluation\\kosha-exact-promotion-packet-2026-07-22\\report.json as the bounded operator-review set before any exact-trust promotion.",
    );
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.state).toBe("approval_gated");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.detail).toContain("blocked by default");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.detail).toContain("separate approval");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.detail).toContain("machine-verified all 8 PDF/body pairs");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.detail).toContain("shallow human-confirmation-only reviews are blocked");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.detail).toContain("completed review remains no-mutation plus separate approval");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.detail).toContain("24/24 semantic groups");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.detail).toContain("64 required human inputs");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.detail).toContain("viewport-contained no-mutation UI");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.nextActions.join("\n")).toContain(
      "Re-run scripts\\kosha_exact_promotion_review_gate.mjs",
    );
    expect(audit.forbiddenClaims).toContain("LLM Wiki publishes itself.");
    expect(audit.forbiddenClaims).toContain("All KOSHA metadata-verified candidates are exact production evidence.");
    expect(audit.forbiddenClaims).toContain("KOSHA operator checklist completion alone approves exact-trust promotion.");
    expect(audit.forbiddenClaims).toContain("Real provider dispatch is production-live for any channel before persistent idempotency and provider result persistence approval.");
    expect(audit.safeDemoClaims).toContain("Photo hazard analysis readiness supports up to 10 images and keeps Before/After improvements as reviewed operation memory.");
  });

  it("fails the standalone dispatch gate closed when mobile-short leaves the first viewport", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "dispatch-standalone-viewport-2026-07-28", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      afterLive: { mobileShortDay: { primaryBottom: number } };
    };
    report.afterLive.mobileShortDay.primaryBottom = 724;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-28T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "dispatch_standalone_cockpit")).toMatchObject({
      state: "contradicted",
      evidencePath: path.join("evaluation", "dispatch-standalone-viewport-2026-07-28", "report.json"),
    });
  });

  it("fails the live document quality matrix closed when a live scenario fails", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const matrixPath = path.join(rootDir, "evaluation", "live-document-quality-matrix-2026-07-24", "report.json");
    const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8")) as {
      afterLive: { pass: number; fail: number };
    };
    matrix.afterLive.pass = 4;
    matrix.afterLive.fail = 1;
    fs.writeFileSync(matrixPath, `${JSON.stringify(matrix, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "live_document_quality_matrix")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_quality_matrix")?.detail).toContain("live=4/5");
  });

  it("fails the high-risk stress matrix closed when a live scenario fails", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const matrixPath = path.join(rootDir, "evaluation", "live-document-quality-stress-matrix-2026-07-24", "report.json");
    const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8")) as {
      afterLive: { pass: number; fail: number };
    };
    matrix.afterLive.pass = 4;
    matrix.afterLive.fail = 1;
    fs.writeFileSync(matrixPath, `${JSON.stringify(matrix, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "live_document_quality_stress_matrix")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_quality_stress_matrix")?.detail).toContain("live=4/5");
  });

  it("fails exact KOSHA materialization closed on a live failure or registry expansion", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "live-kosha-exact-materialization-2026-07-25", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      afterLive: { pass: number; fail: number };
      mutationBoundary: { exactTrustRegistryExpanded: boolean };
    };
    report.afterLive.pass = 2;
    report.afterLive.fail = 1;
    report.mutationBoundary.exactTrustRegistryExpanded = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "live_kosha_exact_materialization")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "live_kosha_exact_materialization")?.detail).toContain("live=2/3");
    expect(audit.gates.find((gate) => gate.id === "live_kosha_exact_materialization")?.detail).toContain("noMutation=false");
  });

  it("fails the synthetic wording review closed when a live scenario fails", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "live-document-wording-review-2026-07-24", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      afterLive: { pass: number; fail: number };
    };
    report.afterLive.pass = 4;
    report.afterLive.fail = 1;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "live_document_wording_review")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_wording_review")?.detail).toContain("live=4/5");
  });

  it("fails the 12-deliverable broad review closed when one work permit is not present", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "live-document-broad-review-2026-07-25", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      workPermitMatrix: Array<{ status: string; verdict: string }>;
    };
    report.workPermitMatrix[4] = {
      status: "missingUnexpected",
      verdict: "RED",
    };
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "live_document_broad_review")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_broad_review")?.detail).toContain("workPermit=4/5");
  });

  it("does not promote the automated editorial contract into a completed human review", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "live-document-editorial-review-2026-07-25", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      humanReviewCompleted: boolean;
      evidenceBoundary: { humanReviewCompleted: boolean };
    };
    report.humanReviewCompleted = true;
    report.evidenceBoundary.humanReviewCompleted = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")?.detail).toContain("humanReviewCompleted=true");
  });

  it("fails the editorial gate closed when live generic template overuse returns", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "live-document-editorial-duplicate-classification-2026-07-25",
      "report.json",
    );
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      afterLive: { genericTemplateOveruseCount: number };
    };
    report.afterLive.genericTemplateOveruseCount = 1;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")?.detail).toContain("generic=1");
  });

  it("fails the editorial gate closed when near findings are hidden instead of classified", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "live-document-editorial-near-classification-2026-07-25",
      "report.json",
    );
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      afterLive: { nearDuplicateLineOveruseCount: number };
    };
    report.afterLive.nearDuplicateLineOveruseCount = 99;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")?.detail).toContain("nearClassificationReady=false");
  });

  it("fails the editorial gate closed when rain-context contamination returns", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "live-document-rain-context-isolation-2026-07-25",
      "report.json",
    );
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      afterLive: { scenarioIrrelevantContextFindingCount: number };
    };
    report.afterLive.scenarioIrrelevantContextFindingCount = 1;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")?.detail).toContain(
      "rainContextReady=false",
    );
  });

  it("fails the editorial gate closed when the full rain-context matrix finds a forbidden fragment", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "live-document-rain-context-isolation-2026-07-25",
      "report.json",
    );
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      afterLiveFull: { matchedForbiddenDocumentFragmentCount: number };
    };
    report.afterLiveFull.matchedForbiddenDocumentFragmentCount = 1;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_editorial_review")?.detail).toContain(
      "rainContextReady=false",
    );
  });

  it("fails product capability truth closed when a provider call is claimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "product-capability-truth-2026-07-25", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      mutationBoundary: { providerDispatchCalled: boolean };
    };
    report.mutationBoundary.providerDispatchCalled = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-25T00:00:00.000Z",
    });

    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")?.detail).toContain("noMutation=false");
  });

  it("fails product capability truth closed when exact Share or viewport IA is overclaimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "product-capability-truth-2026-07-25", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remainingBoundaries: {
        exactSavedShareVerdict: string;
        documentsShareIaVerdict: string;
      };
    };
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    report.remainingBoundaries.documentsShareIaVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-25T00:00:00.000Z",
    });

    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")?.detail).toContain("exactShare=PASS");
    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")?.detail).toContain("ia=PASS");
  });

  it("fails product capability truth closed when live dispatch entry copy is not proven", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "dispatch-entry-capability-truth-2026-07-28", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      liveAfter: { dispatchDescriptionVisible: boolean };
    };
    report.liveAfter.dispatchDescriptionVisible = false;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-28T00:00:00.000Z",
    });

    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")?.detail).toContain("entryTruthPass=false");
  });

  it("fails product capability truth closed when landing copy claims human role replacement", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "landing-human-review-boundary-2026-07-28", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      liveAfter: { oldReplacementClaimVisible: boolean };
    };
    report.liveAfter.oldReplacementClaimVisible = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-28T00:00:00.000Z",
    });

    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")?.detail).toContain("landingTruthPass=false");
  });

  it("fails dependency security remediation closed when the zero-audit evidence is contradicted", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "dependency-security-remediation-2026-07-28", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remainingBoundaries: {
        fullRepositorySecurityScanCompleted: boolean;
        residualVulnerablePackages: number;
      };
    };
    report.remainingBoundaries.fullRepositorySecurityScanCompleted = true;
    report.remainingBoundaries.residualVulnerablePackages = 1;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-28T00:00:00.000Z",
    });

    expect(audit.gates.find((gate) => gate.id === "dependency_security_remediation")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "dependency_security_remediation")?.detail).toContain("residuals=1");
    expect(audit.gates.find((gate) => gate.id === "dependency_security_remediation")?.detail).toContain("fullScan=true");
  });

  it("fails the full repository security scan closed when findings are hidden behind a security-complete claim", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "follow-up-full-repository-security-scan-2026-08-02", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      scan: { reportableFindingCount: number };
      remainingBoundaries: {
        securityCompleteClaimAllowed: boolean;
        reportableFindingCount: number;
      };
    };
    report.scan.reportableFindingCount = 0;
    report.remainingBoundaries.reportableFindingCount = 0;
    report.remainingBoundaries.securityCompleteClaimAllowed = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-28T00:00:00.000Z",
    });

    expect(audit.gates.find((gate) => gate.id === "full_repository_security_scan")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "full_repository_security_scan")?.detail).toContain("reportable=0");
    expect(audit.gates.find((gate) => gate.id === "full_repository_security_scan")?.detail).toContain("securityComplete=true");
  });

  it("fails the learning export renderer gate closed when the canonical deferred boundary is erased", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "learning-export-renderer-security-2026-08-02", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remainingBoundaries: {
        canonicalDeferredCandidateCount: number;
        securityCompleteClaimAllowed: boolean;
      };
    };
    report.remainingBoundaries.canonicalDeferredCandidateCount = 0;
    report.remainingBoundaries.securityCompleteClaimAllowed = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, generatedAt: "2026-08-02T00:00:00.000Z" });
    expect(audit.gates.find((gate) => gate.id === "learning_export_renderer_security")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "learning_export_renderer_security")?.detail).toContain("canonicalDeferred=0");
    expect(audit.gates.find((gate) => gate.id === "learning_export_renderer_security")?.detail).toContain("securityComplete=true");
  });

  it("fails Hermes knowledge review authority closed when machine evidence replaces human review", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "hermes-knowledge-review-contract-live-2026-07-25", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      reviewContract: {
        humanReviewRequired: boolean;
        machineEvidenceReplacesHumanReview: boolean;
      };
    };
    report.reviewContract.humanReviewRequired = false;
    report.reviewContract.machineEvidenceReplacesHumanReview = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-25T00:00:00.000Z",
    });

    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_authority")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_authority")?.detail).toContain("humanReview=false");
  });

  it("fails Hermes reviewer UI closed when machine evidence replaces human review", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "hermes-knowledge-review-authority-ui-2026-07-25", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      authorityContract: {
        humanReviewRequired: boolean;
        machineEvidenceReplacesHumanReview: boolean;
      };
    };
    report.authorityContract.humanReviewRequired = false;
    report.authorityContract.machineEvidenceReplacesHumanReview = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-25T00:00:00.000Z",
    });

    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_ui")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_ui")?.detail).toContain("humanReview=false");
  });

  it("fails security remediation waves closed when non-closure boundaries are weakened", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const tenantPath = path.join(rootDir, "evaluation", "tenant-authorization-boundary-preflight-2026-07-29", "report.json");
    const formulaPath = path.join(rootDir, "evaluation", "spreadsheet-formula-neutralization-2026-08-01", "report.json");
    const providerPath = path.join(rootDir, "evaluation", "public-provider-work-budget-2026-08-01", "report.json");
    const exportPath = path.join(rootDir, "evaluation", "document-export-work-budget-2026-08-01", "report.json");
    const tenant = JSON.parse(fs.readFileSync(tenantPath, "utf8")) as {
      remainingBoundaries: { securityCompleteClaimAllowed: boolean };
    };
    const formula = JSON.parse(fs.readFileSync(formulaPath, "utf8")) as {
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    const provider = JSON.parse(fs.readFileSync(providerPath, "utf8")) as {
      mutationBoundary: { productionProviderLoadTestPerformed: boolean };
    };
    const exportReport = JSON.parse(fs.readFileSync(exportPath, "utf8")) as {
      findingClosure: { fullRepositoryRescanCompleted: boolean };
    };
    tenant.remainingBoundaries.securityCompleteClaimAllowed = true;
    formula.remainingBoundaries.exactSavedShareVerdict = "PASS";
    provider.mutationBoundary.productionProviderLoadTestPerformed = true;
    exportReport.findingClosure.fullRepositoryRescanCompleted = true;
    fs.writeFileSync(tenantPath, `${JSON.stringify(tenant, null, 2)}\n`, "utf8");
    fs.writeFileSync(formulaPath, `${JSON.stringify(formula, null, 2)}\n`, "utf8");
    fs.writeFileSync(providerPath, `${JSON.stringify(provider, null, 2)}\n`, "utf8");
    fs.writeFileSync(exportPath, `${JSON.stringify(exportReport, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, generatedAt: "2026-08-01T00:00:00.000Z" });

    expect(audit.gates.find((gate) => gate.id === "tenant_authorization_remediation")).toMatchObject({ state: "contradicted" });
    expect(audit.gates.find((gate) => gate.id === "spreadsheet_formula_neutralization")).toMatchObject({ state: "contradicted" });
    expect(audit.gates.find((gate) => gate.id === "public_provider_work_budget")).toMatchObject({ state: "contradicted" });
    expect(audit.gates.find((gate) => gate.id === "document_export_work_budget")).toMatchObject({ state: "contradicted" });
  });

  it("fails secondary document grounding closed when one supporting document is not grounded", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "live-document-secondary-grounding-2026-07-25", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      stages: {
        afterLive: {
          pass: number;
          fail: number;
          secondaryPassed: number;
        };
      };
    };
    report.stages.afterLive.pass = 4;
    report.stages.afterLive.fail = 1;
    report.stages.afterLive.secondaryPassed = 29;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "live_document_secondary_grounding")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_secondary_grounding")?.detail).toContain("documents=29/30");
  });

  it("contradicts the UI gate when a supporting document launcher is visible by default", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const geometryPath = path.join(rootDir, "evaluation", "documents-cockpit-workbench-geometry-2026-07-22", "report.json");
    const geometry = JSON.parse(fs.readFileSync(geometryPath, "utf8")) as {
      rows: Array<{ metrics: { visibleSupportingButtonCount: number } }>;
    };
    geometry.rows[0].metrics.visibleSupportingButtonCount = 1;
    fs.writeFileSync(geometryPath, `${JSON.stringify(geometry, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const gate = audit.gates.find((item) => item.id === "ui_documents_share_cockpit");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.evidencePath).toBe(path.join("evaluation", "documents-cockpit-workbench-geometry-2026-07-22", "report.json"));
    expect(gate?.detail).toContain("12/3/9/0 default document exposure budget");
  });

  it("fails seed-profile isolation closed when one forbidden fragment remains live", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "live-document-seed-profile-isolation-2026-07-25", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      afterLive: {
        pass: number;
        fail: number;
        seedProfileLeakageCount: number;
      };
    };
    report.afterLive.pass = 4;
    report.afterLive.fail = 1;
    report.afterLive.seedProfileLeakageCount = 1;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "live_document_seed_profile_isolation")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_seed_profile_isolation")?.detail).toContain("forbiddenFragments=1");
  });

  it("fails evidence completeness when the LLM Wiki publication packet is missing", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    fs.rmSync(path.join(rootDir, "evaluation", "llm-wiki-rls-approval-2026-07-17"), {
      recursive: true,
      force: true,
    });

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("evidence_missing");
    expect(audit.gates.find((gate) => gate.id === "llm_wiki_publication")?.state).toBe("missing");
  }, 15_000);

  it("records explicitly carried final-99 notices without allowing a fully automated launch claim", async () => {
    const { buildNorthstarOpenGateAudit, renderNorthstarOpenGateMarkdown } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    writeJson(rootDir, path.join("evaluation", "final-99-gate", "notice-carry.json"), {
      verdict: "carried",
      fullyAutomatedLaunchClaimAllowed: false,
      safeLaunchDemoClaimAllowed: true,
      notices: [
        {
          gate: "auth-history-reuse",
          carried: true,
          launchImpact: "operator-auth-gated",
        },
        {
          gate: "dispatch-policy",
          carried: true,
          launchImpact: "provider-approval-gated",
        },
      ],
    });
    writeJson(rootDir, path.join("evaluation", "final-99-no-approval-boundary-2026-07-23", "report.json"), {
      verdict: "NO_APPROVAL_FINAL_99_RERUN_BLOCKED_BOUNDARY_DOCUMENTED",
      dbMutationPerformed: false,
    });

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const finalGate = audit.gates.find((gate) => gate.id === "final_99_gate");
    const markdown = renderNorthstarOpenGateMarkdown(audit);

    expect(audit.overall).toBe("open");
    expect(finalGate?.state).toBe("notice");
    expect(finalGate?.detail).toContain("2 notices are explicitly carried");
    expect(finalGate?.detail).toContain("auth-history-reuse=operator-auth-gated");
    expect(finalGate?.detail).toContain("dispatch-policy=provider-approval-gated");
    expect(finalGate?.detail).toContain("Fully automated launch remains forbidden");
    expect(finalGate?.detail).toContain("Full final-99 rerun is not treated as no-approval cleanup");
    expect(finalGate?.detail).toContain(path.join("evaluation", "final-99-no-approval-boundary-2026-07-23", "report.json"));
    expect(finalGate?.nextActions).toEqual([
      "Do not claim fully automated launch readiness until admin-auth live save/reopen and approved provider dispatch are executed in a secure environment.",
      "Do not rerun full final-99 as a no-approval cleanup when SAFEGUARD_AUTH_TOKEN is configured.",
    ]);
    expect(markdown).toContain("notice-carry.json");
    expect(markdown).toContain("Do not claim fully automated launch readiness");
  });

  it("prefers the current final-99 evidence packet over the legacy default folder", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    writeJson(rootDir, path.join("evaluation", "final-99-gate", "report.json"), {
      overall: "blocked",
    });
    writeJson(rootDir, path.join("evaluation", "final-99-gate-current-2026-07-22", "report.json"), {
      overall: "pass_with_notice",
    });
    writeJson(rootDir, path.join("evaluation", "final-99-gate-current-2026-07-22", "notice-carry.json"), {
      verdict: "carried",
      fullyAutomatedLaunchClaimAllowed: false,
      safeLaunchDemoClaimAllowed: true,
      notices: [
        {
          gate: "auth-history-reuse",
          carried: true,
          launchImpact: "operator-auth-gated",
        },
        {
          gate: "dispatch-policy",
          carried: true,
          launchImpact: "provider-approval-gated",
        },
      ],
    });

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const finalGate = audit.gates.find((gate) => gate.id === "final_99_gate");

    expect(finalGate?.state).toBe("notice");
    expect(finalGate?.evidencePath).toBe(path.join("evaluation", "final-99-gate-current-2026-07-22", "report.json"));
    expect(finalGate?.detail).toContain(path.join("evaluation", "final-99-gate-current-2026-07-22", "notice-carry.json"));
    expect(finalGate?.detail).toContain("auth-history-reuse=operator-auth-gated");
    expect(finalGate?.detail).toContain("dispatch-policy=provider-approval-gated");
  });

  it("contradicts the KOSHA exact trust gate when live exact pins are stale", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join("evaluation", "kosha-current-northstar-regression-2026-07-22", "report.json");
    const report = JSON.parse(fs.readFileSync(path.join(rootDir, reportPath), "utf8")) as Record<string, unknown>;
    report.coveredExactPins = ["D-C-13-2026", "D-C-7-2026"];
    writeJson(rootDir, reportPath, report);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_trust_registry")?.state).toBe("contradicted");
  });

  it("contradicts the KOSHA exact trust gate when mutation safety is lost", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join("evaluation", "kosha-current-northstar-regression-2026-07-22", "report.json");
    const report = JSON.parse(fs.readFileSync(path.join(rootDir, reportPath), "utf8")) as Record<string, unknown>;
    report.supabaseWrites = true;
    writeJson(rootDir, reportPath, report);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_trust_registry")?.state).toBe("contradicted");
  });

  it("contradicts provider dispatch persistence when live dispatch unlock is claimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join("evaluation", "provider-dispatch-idempotency-gate-2026-07-19", "report.json");
    const report = JSON.parse(fs.readFileSync(path.join(rootDir, reportPath), "utf8")) as Record<string, unknown>;
    report.liveDispatchState = {
      capability: true,
      mode: "live",
      reason: "enabled",
      codeLock: "PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED=true",
    };
    report.safetyLocks = {
      dbMigrationApplied: false,
      dbMutationPerformed: false,
      providerMessageSent: true,
      liveDispatchUnlocked: true,
    };
    writeJson(rootDir, reportPath, report);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "provider_dispatch_persistence")?.state).toBe("contradicted");
  });

  it("contradicts provider dispatch persistence when channel-level exactly-once is overclaimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join("evaluation", "provider-dispatch-idempotency-gate-2026-07-19", "report.json");
    const report = JSON.parse(fs.readFileSync(path.join(rootDir, reportPath), "utf8")) as Record<string, unknown>;
    report.channelResultPersistence = {
      channelLevelExactlyOnceProven: true,
      currentShape: "channels text[] plus provider_result jsonb on one attempt row",
      requiredBeforeClaimingExactlyOnce: [],
    };
    writeJson(rootDir, reportPath, report);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "provider_dispatch_persistence")?.state).toBe("contradicted");
  });

  it("contradicts stale SIF embedding preflight evidence from outside the current history", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join("evaluation", "sif-embedding-gate", "approval-preflight-report.json");
    const report = JSON.parse(fs.readFileSync(path.join(rootDir, reportPath), "utf8")) as Record<string, unknown>;
    report.sourceSha = "0000000000000000000000000000000000000000";
    writeJson(rootDir, reportPath, report);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    const sifGate = audit.gates.find((gate) => gate.id === "sif_embedding_runtime");
    expect(sifGate?.state).toBe("contradicted");
    expect(sifGate?.detail).toContain("not an ancestor");
  });

  it("contradicts SIF embedding preflight when corpus row integrity is incomplete", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join("evaluation", "sif-embedding-gate", "approval-preflight-report.json");
    const report = JSON.parse(fs.readFileSync(path.join(rootDir, reportPath), "utf8")) as {
      corpusInspection: { invalidRecordCount: number };
    };
    report.corpusInspection.invalidRecordCount = 1;
    writeJson(rootDir, reportPath, report);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    const sifGate = audit.gates.find((gate) => gate.id === "sif_embedding_runtime");
    expect(sifGate?.state).toBe("contradicted");
    expect(sifGate?.detail).toContain("6,032-record integrity contract");
  });

  it("contradicts stale LLM Wiki publication preflight evidence from outside the current history", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join("evaluation", "rls-llm-wiki-approval-preflight-current-2026-07-20", "report.json");
    const report = JSON.parse(fs.readFileSync(path.join(rootDir, reportPath), "utf8")) as Record<string, unknown>;
    report.sourceSha = "0000000000000000000000000000000000000000";
    writeJson(rootDir, reportPath, report);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    const wikiGate = audit.gates.find((gate) => gate.id === "llm_wiki_publication");
    expect(wikiGate?.state).toBe("contradicted");
    expect(wikiGate?.detail).toContain("not an ancestor");
  });

  it("contradicts LLM Wiki preflight when executable publication surface evidence is incomplete", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join("evaluation", "rls-llm-wiki-approval-preflight-current-2026-07-20", "report.json");
    const report = JSON.parse(fs.readFileSync(path.join(rootDir, reportPath), "utf8")) as {
      checks: Array<{ id: string; passed: boolean }>;
      publicationSurfaceInventory: {
        publicationRoutePaths: string[];
      };
    };
    report.checks = report.checks.filter((check) => check.id !== "wiki_no_executable_publication_surface");
    report.publicationSurfaceInventory.publicationRoutePaths = ["app/api/knowledge/publish/route.ts"];
    writeJson(rootDir, reportPath, report);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    const wikiGate = audit.gates.find((gate) => gate.id === "llm_wiki_publication");
    expect(wikiGate?.state).toBe("contradicted");
    expect(wikiGate?.detail).toContain("preflight is missing or failed");
  });

  it("contradicts stale RLS approval preflight evidence from outside the current history", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join("evaluation", "rls-llm-wiki-approval-preflight-current-2026-07-20", "report.json");
    const report = JSON.parse(fs.readFileSync(path.join(rootDir, reportPath), "utf8")) as Record<string, unknown>;
    report.sourceSha = "0000000000000000000000000000000000000000";
    writeJson(rootDir, reportPath, report);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("contradicted");
    const rlsGate = audit.gates.find((gate) => gate.id === "supabase_rls_launch_isolation");
    expect(rlsGate?.state).toBe("contradicted");
    expect(rlsGate?.detail).toContain("not an ancestor");
  }, 15_000);

  it("fails evidence completeness when the current KOSHA reconciliation is missing", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    fs.rmSync(path.join(rootDir, "evaluation", "kosha-current-northstar-regression-2026-07-22"), {
      recursive: true,
      force: true,
    });
    fs.rmSync(path.join(rootDir, "evaluation", "kosha-current-live-gate-2026-07-20"), {
      recursive: true,
      force: true,
    });
    fs.rmSync(path.join(rootDir, "evaluation", "kosha-current-master-reconciliation-2026-07-19"), {
      recursive: true,
      force: true,
    });

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("evidence_missing");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_trust_registry")?.state).toBe("missing");
  });

  it("fails closed when the KOSHA exact promotion review gate is missing", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    fs.rmSync(path.join(rootDir, "evaluation", "kosha-exact-promotion-review-gate-2026-07-22"), {
      recursive: true,
      force: true,
    });

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("evidence_missing");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_trust_registry")?.state).toBe("proven");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.state).toBe("missing");
  });

  it("fails closed when the KOSHA official PDF companion audit no longer preserves review boundaries", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const auditPath = path.join(rootDir, "evaluation", "kosha-exact-official-pdf-audit-2026-07-25", "report.json");
    const officialPdfAudit = JSON.parse(fs.readFileSync(auditPath, "utf8")) as {
      reviewChecklistImpact: { reviewChecklistComplete: boolean };
    };
    officialPdfAudit.reviewChecklistImpact.reviewChecklistComplete = true;
    writeJson(rootDir, path.relative(rootDir, auditPath), officialPdfAudit);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.state).toBe("contradicted");
  });

  it("fails closed when the KOSHA lifecycle companion audit loses exact title identity", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const auditPath = path.join(rootDir, "evaluation", "kosha-exact-official-lifecycle-audit-2026-07-25", "report.json");
    const lifecycleAudit = JSON.parse(fs.readFileSync(auditPath, "utf8")) as {
      exactTitleIdentityMatchCount: number;
    };
    lifecycleAudit.exactTitleIdentityMatchCount = 7;
    writeJson(rootDir, path.relative(rootDir, auditPath), lifecycleAudit);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.state).toBe("contradicted");
  });

  it("fails closed when the KOSHA reviewer cockpit unlocks export before human review", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const cockpitPath = path.join(
      rootDir,
      "evaluation",
      "kosha-exact-promotion-reviewer-cockpit-2026-07-25",
      "report.json",
    );
    const cockpit = JSON.parse(fs.readFileSync(cockpitPath, "utf8")) as {
      exportInitiallyDisabled: boolean;
    };
    cockpit.exportInitiallyDisabled = false;
    writeJson(rootDir, path.relative(rootDir, cockpitPath), cockpit);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.state).toBe("contradicted");
  });

  it("renders the approval boundary and forbidden claims in the Markdown report", async () => {
    const { buildNorthstarOpenGateAudit, renderNorthstarOpenGateMarkdown } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const markdown = renderNorthstarOpenGateMarkdown(audit);

    expect(markdown).toContain("| llm_wiki_publication | approval_gated |");
    expect(markdown).toContain("| provider_dispatch_persistence | approval_gated |");
    expect(markdown).toContain("| kosha_exact_trust_registry | proven |");
    expect(markdown).toContain("| kosha_exact_promotion_review_gate | approval_gated |");
    expect(markdown).toContain("shallow human-confirmation-only reviews are blocked");
    expect(markdown).toContain("LLM Wiki publishes itself.");
    expect(markdown).toContain("SafeClaw fixes SIF/KOSHA/current work-history evidence before LLM wording.");
  });
});
