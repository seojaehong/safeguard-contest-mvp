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

function currentSecurityRemediationLedgerFixture(): Record<string, unknown> {
  const findingIds = [
    "csf_32ed9bacd31d6e84ee96670c", "csf_60ae470f243100a5ceff1625", "csf_6ca85fcda2063dad372a1ba0",
    "csf_6003dccadac8eda2a4d965f1", "csf_db6606a70118268c2f1f9ed2", "csf_6c2ccea59dc8f8acd9414403",
    "csf_107c4ebc10082a6d894aedb4", "csf_72350152046c347d29921d05", "csf_6013fe31acab79c3e5823fe3",
    "csf_e9f6acc76158d6936fdc7ec1", "csf_2b1622ad26e5c29920dbee2f", "csf_fe92b01d367cd83f6f5a8db1",
    "csf_945cd27e0e1adc50b4c505e1", "csf_4ced3a81d9d5719a98310abe", "csf_0ab15ba3cb26ea2de42c969d",
    "csf_0b17ba1587b295e21dd8a141", "csf_7c6fb7d226f5f405b04f23f8", "csf_deda3425adf85884225538a4",
    "csf_e3ea8ca7f62b05b33d4beea2", "csf_5af1870f3c0d961bbbedb904", "csf_a993c141161ee9e601c1d09e",
    "csf_721663901ae58571bcc40d00", "csf_89fe636f990bbc8339535b55",
  ];
  const approvalGated = new Set([findingIds[1], findingIds[5], findingIds[7]]);
  const distributedOpen = new Set([findingIds[8], findingIds[9], findingIds[14]]);
  return {
    verdict: "NOTICE_LIVE_DEPLOYED_SOURCE_SECURITY_REMEDIATION_LEDGER_OPEN_BOUNDARIES",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", branch: "master", environment: "production" },
    immutableBaselines: {
      originalStandardScan: { scanId: "8fe9c06a-018c-446f-aa98-1b37df95287a", reportableFindingCount: 17, deferredCandidateCount: 1, preserved: true },
      currentFindingSet: { scanId: "c98ffa84-9951-4f68-9e1d-11f456abe901", findingCount: 23, preserved: true },
    },
    findingDisposition: { total: 23, deployedSourceRemediationCount: 17, unresolvedCount: 6, approvalGatedCount: 3, distributedRuntimeOpenCount: 3, securityCompleteClaimAllowed: false },
    findings: findingIds.map((findingId) => ({
      findingId,
      disposition: approvalGated.has(findingId)
        ? "approval_gated"
        : distributedOpen.has(findingId)
          ? "distributed_runtime_open"
          : "deployed_source_remediated",
      receiptPath: "evaluation/repository-security-scan-reconciliation-2026-08-11/report.json",
    })),
    mutationBoundary: {
      dbSchemaChanged: false, dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false,
      vectorOrEmbeddingMutationPerformed: false, wikiPublicationPerformed: false, koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      securityCompleteClaimAllowed: false,
      freshFullRepositorySecurityScanRequiredForClosure: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
      sifEmbeddingRuntime: "APPROVAL_GATED",
      llmWikiPublication: "APPROVAL_GATED",
      koshaExactPromotion: "APPROVAL_GATED",
    },
  };
}

function alignFixtureJsonSourceShas(directory: string, sourceSha: string): void {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      alignFixtureJsonSourceShas(entryPath, sourceSha);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      const source = fs.readFileSync(entryPath, "utf8");
      if (source.includes('"fixture-sha"')) {
        fs.writeFileSync(entryPath, source.replaceAll('"fixture-sha"', JSON.stringify(sourceSha)), "utf8");
      }
    }
  }
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
    currentViewportIaEvidence: {
      verdict: "PASS_SCOPED_LIVE_PRODUCTION_WITH_EXACT_SAVED_SESSION_GAP",
      gateId: "ui_documents_share_cockpit",
      boundedWorkbenchEvidencePath: "evaluation/workspace-bounded-workbench-current-2026-07-22/report.json",
      boundedWorkbenchVerdict: "PASS_LIVE_PRODUCTION_SCOPED_WITH_EXACT_SESSION_GAP",
      boundedWorkbenchSourceHead: "33a8167060d1f3433131ff687bd14eb4920e7520",
      scopedLiveDocumentsAndWorkspaceShareProven: true,
      routeSplitAloneAcceptedAsFix: false,
      exactSavedUserSessionReproduced: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      documentsShareIaVerdict: "PASS_SCOPED_LIVE_PRODUCTION_WITH_EXACT_SAVED_SESSION_GAP",
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
  writeJson(rootDir, path.join("evaluation", "public-search-distributed-rate-limit-readiness-2026-08-02", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_DISTRIBUTED_LIMITER_CAPABILITY_INSTANCE_FALLBACK_CONFIG_PENDING",
    sourceHead: "fixture-sha",
    productionBuild: {
      commitSha: "previous-live-sha",
      sourceHeadMatchesProduction: false,
      productCommitIsAncestorOfProduction: true,
    },
    currentSourceContract: {
      atomicDistributedCounter: true,
      serverOnlyRestCredentials: true,
      httpsOnlyEndpoint: true,
      clientIdentifierSha256Hashed: true,
      rawClientIpSentToStore: false,
      partialConfigurationFailsClosed: true,
      distributedFailureFailsClosedBeforeProviderWork: true,
      instanceFallbackWhenCompletelyUnconfigured: true,
      responseModeHeader: "X-SafeClaw-Rate-Limit",
      providerCallsOnPartialConfiguration: 0,
    },
    configuration: {
      productionConfigured: false,
      productionModeVerified: true,
      observedMode: "instance",
      distributedActivationPending: true,
    },
    verification: {
      focusedAndAdjacentTests: { files: 6, tests: 88, failed: 0 },
      typecheck: "PASS",
      build: { status: "PASS", staticPages: 28 },
    },
    boundary: {
      sealedScanMutated: false,
      sealedFindingsClosedWithoutRescan: false,
      capabilityIncludedInProduction: true,
      distributedProtectionClaimedLive: false,
      remainingDbRlsFindings: 13,
      remainingDbRlsFindingsRequireApproval: true,
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
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
    sourceSha: "fixture-sha",
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
    mode: "live-production",
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
          workspaceSideNavWidth: 1180,
          workspaceStepStatusOverflowCount: 0,
          workspaceStepStatusMaxOverflow: 0,
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
          workspaceSideNavWidth: 1180,
          workspaceStepStatusOverflowCount: 0,
          workspaceStepStatusMaxOverflow: 0,
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
  writeJson(rootDir, path.join("evaluation", "document-section-navigation-2026-08-02", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_SECTION_NAVIGATION",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", branch: "master", environment: "production" },
    total: 4,
    pass: 4,
    fail: 0,
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
    results: ["day-desktop", "night-desktop", "day-mobile", "night-mobile"].map((label) => ({
      label,
      verdict: "PASS",
      metrics: {
        viewportHeight: 723,
        bodyHeight: label.includes("mobile") ? 728 : 723,
        horizontalOverflow: false,
        shellRatio: label.includes("mobile") ? 2.76 : 2.21,
        actionBottom: label.includes("mobile") ? 536 : 340,
        sectionTabCount: 6,
        selectedSectionTabCount: 1,
        filledSectionTabCount: 6,
        emptySectionTabCount: 0,
        minimumSectionTabHeight: 46,
        sectionTabLabels: Array.from({ length: 6 }, (_, index) => `section ${index + 1}, 1줄 작성됨`),
        sectionLabelWhiteSpace: Array.from({ length: 6 }, () => "normal"),
        sectionLabelLineClamp: Array.from({ length: 6 }, () => "2"),
        selectedBackground: "selected",
        unselectedBackground: "unselected",
        selectedBoxShadow: "inset 0 -3px accent",
      },
    })),
  });
  const canonicalDocumentKeys = [
    "riskAssessmentDraft",
    "tbmBriefing",
    "tbmLogDraft",
    "workpackSummaryDraft",
    "workPlanDraft",
    "workPermitDraft",
    "safetyEducationRecordDraft",
    "emergencyResponseDraft",
    "photoEvidenceDraft",
    "foreignWorkerBriefing",
    "foreignWorkerTransmission",
    "kakaoMessage",
  ];
  writeJson(rootDir, path.join("evaluation", "document-all-authoring-geometry-2026-08-02", "after-live", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_12_DOCUMENT_AUTHORING_GEOMETRY",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", branch: "master", environment: "production" },
    sourceHeadMatchesProduction: true,
    documentCount: 12,
    viewportCaseCount: 4,
    total: 48,
    pass: 48,
    fail: 0,
    acceptanceContract: { firstActionInsidePaneWithMinimumMargin: 32 },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
    results: ["day-desktop", "night-desktop", "day-mobile", "night-mobile"].flatMap((label) => (
      canonicalDocumentKeys.map((documentKey) => ({
        theme: label.startsWith("day") ? "day" : "night",
        label,
        documentKey,
        verdict: "PASS",
        metrics: {
          viewportHeight: 723,
          pageHeight: label.includes("mobile") ? 728 : 723,
          horizontalOverflow: false,
          shellRatio: label.includes("mobile") ? 2.69 : 2.21,
          shellBottom: label.includes("mobile") ? 672 : 653,
          firstActionBottom: label.includes("mobile") ? 640 : 620,
          visibleCockpitCount: documentKey === "riskAssessmentDraft" ? 0 : 1,
          cockpitMaxHeight: documentKey === "riskAssessmentDraft" ? 0 : label.includes("mobile") ? 88 : 260,
          cockpitOverflowY: documentKey === "riskAssessmentDraft" ? "none" : "auto",
          sectionTabCount: documentKey === "riskAssessmentDraft" ? 0 : 4,
          selectedSectionTabCount: documentKey === "riskAssessmentDraft" ? 0 : 1,
          sourceEditorVisibleCount: 0,
        },
      }))
    )),
  });
  writeJson(rootDir, path.join("evaluation", "security-public-generation-admission-2026-08-04", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_GENERATION_ADMISSION_INSTANCE_MODE_DISTRIBUTED_HARDENING_OPEN",
    productCommit: "fixture-sha",
    evidenceCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    baseSecurityScan: {
      scanId: "d12d04ce-deaf-497d-8754-33d5baab2ca0",
      targetCommit: "e087d474a1de72bd3687c703a61a4263fe792fa4",
      immutableBaselinePreserved: true,
      reportableFindingCount: 28,
    },
    admissionControls: [
      { route: "/api/knowledge/regenerate", namespace: "knowledge-regeneration", limit: 20, windowMs: 60000, beforeRequestBodyParsing: true, beforeAiGeneration: true },
      { route: "/api/workpack/remediate", namespace: "workpack-remediation", limit: 12, windowMs: 60000, beforeRequestBodyParsing: true, beforeReferenceSearch: true, beforeAiGeneration: true },
    ],
    runtimeBoundary: {
      distributedWhenConfigured: true,
      instanceFallbackWhenDistributedConfigAbsent: true,
      partialDistributedConfigFailsClosed: true,
      successHeader: "X-SafeClaw-Rate-Limit",
      liveDeploymentVerified: true,
      liveMode: "instance",
      distributedProductionHardeningOpen: true,
    },
    liveChecks: {
      knowledgeRegeneration: { status: 400, message: "question is required", rateLimitHeader: "instance" },
      workpackRemediation: { status: 400, message: "question is required", rateLimitHeader: "instance" },
    },
    currentLiveRefresh: {
      verdict: "PASS_LIVE_PRODUCTION_PUBLIC_GENERATION_ADMISSION_REFRESH",
      sourceHead: "fixture-sha",
      productionCommit: "fixture-sha",
      productionBranch: "master",
      productionEnvironment: "production",
      deploymentUrl: "fixture.vercel.app",
      liveChecks: [
        { route: "/api/knowledge/regenerate", probe: "invalid-body-no-ai-call", status: 400, message: "question is required", rateLimitHeader: "instance", providerCallPerformed: false, referenceSearchPerformed: false },
        { route: "/api/workpack/remediate", probe: "invalid-body-no-reference-or-ai-call", status: 400, message: "question is required", rateLimitHeader: "instance", providerCallPerformed: false, referenceSearchPerformed: false },
      ],
      mutationBoundary: {
        dbMutationPerformed: false,
        providerDispatchCalled: false,
        shareSessionCreated: false,
        vectorOrEmbeddingMutationPerformed: false,
        wikiPublicationPerformed: false,
        koshaRegistryMutationPerformed: false,
      },
    },
    dependencyAudit: { after: { total: 0 } },
    verification: {
      focused: { testFiles: 3, tests: 23, passed: true },
      adjacentSecurity: { testFiles: 15, tests: 173, passed: true },
      typecheck: "PASS",
      build: { verdict: "PASS", staticPages: 28 },
      npmAudit: { verdict: "PASS", vulnerabilityCount: 0 },
    },
    refreshVerification: {
      focusedSecurity: { files: 5, tests: 37, status: "PASS" },
      northstar: { files: 3, tests: 64, status: "PASS" },
      pdf: { files: 1, tests: 18, status: "PASS" },
      typecheck: "PASS",
      build: { status: "PASS", nextVersion: "15.5.22", staticPages: 28 },
      npmAudit: { status: "PASS", vulnerabilityCount: 0 },
      diffCheck: "PASS",
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      approvalGatedOperationsUnchanged: true,
      freshPostChangeSecurityRescanRequired: true,
      liveDeploymentVerificationRequired: false,
      distributedProductionLimiterStillRecommended: true,
    },
  });
  writeJson(rootDir, path.join("evaluation", "codex-security-followup-remediation-2026-08-11", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_DEPLOYED_SECURITY_FOLLOWUP",
    sourceHead: "fixture-sha",
    securityScan: {
      scanId: "3f0107a8-e4a4-4a5b-be37-a28bcea8b05a",
      sealedFindingCount: 3,
      severityCounts: { medium: 1, low: 2 },
      immutableOriginalBaselineFindingCount: 18,
      deferredCandidateCount: 2,
    },
    remediations: [
      { id: "ask-descendant-cancellation", status: "PASS_CURRENT_SOURCE" },
      { id: "distributed-export-concurrency", status: "PASS_CURRENT_SOURCE" },
      { id: "safety-reference-body-deadline", status: "PASS_CURRENT_SOURCE" },
    ],
    verification: {
      focusedVitest: { files: 12, tests: 129, failed: 0 },
      typecheck: "PASS",
      build: { status: "PASS", staticPages: 28 },
      diffCheck: "PASS",
    },
    deployment: {
      liveAfterDeploymentRequired: false,
      productionCommit: "fixture-sha",
      branch: "master",
      environment: "production",
      liveProviderCancellationProbeExecuted: false,
    },
    currentPathCompatibility: {
      verdict: "PASS_LIVE_PRODUCTION_CURRENT_PATH_COMPATIBILITY",
      sourceHead: "fixture-sha",
      productionCommit: "fixture-sha",
      changedGovernedPaths: ["lib/ai.ts", "lib/public-distributed-rate-limit.ts"],
      focusedVitest: { files: 12, tests: 147, failed: 0 },
      noMutation: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      originalBaselineRewritten: false,
    },
    remainingSecurityWork: [],
    boundaries: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorRuntimeMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      approvalGatedBoundariesPreserved: true,
      originalBaselineRewritten: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "security-resource-remediation-2026-08-11", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_SECURITY_RESOURCE_REMEDIATION",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    liveAfterDeploymentPending: false,
    sourceScan: {
      scanId: "a8aa9242-ed42-4057-88e9-31a72e298292",
      targetRevision: "8cd86f7ab2abe4ad7d4948d8feda083b0b032386",
      findingCount: 20,
      mediumCount: 15,
      lowCount: 5,
      coverageCompleteness: "partial",
    },
    remediatedFindings: [
      "mcp-non-post-admission",
      "openclaw-output-budget",
      "openclaw-termination-grace",
      "knowledge-preauth-body-budget",
      "workpack-remediation-body-budget",
      "public-share-admission",
    ],
    governedPathCompatibility: {
      verdict: "PASS_LIVE_PRODUCTION_RESOURCE_REMEDIATION_COMPATIBILITY",
      sourceHead: "fixture-sha",
      productionCommit: "fixture-sha",
      coveredGateIds: [
        "public_json_request_body_budget",
        "public_provider_cancellation",
        "public_provider_admission",
      ],
      changedGovernedPaths: [
        "app/api/knowledge/ingest/route.ts",
        "app/api/knowledge/review/prepare/route.ts",
        "app/api/knowledge/review/route.ts",
        "app/api/mcp/[transport]/implementation.ts",
        "app/api/share-sessions/[sessionId]/route.ts",
        "app/api/workpack/remediate/route.ts",
        "lib/openclaw-chat.ts",
        "lib/public-work-budget.ts",
      ],
      focused: { testFiles: 5, tests: 79, status: "PASS" },
      adjacent: { testFiles: 12, tests: 156, status: "PASS" },
      noMutation: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
    verification: {
      focused: { testFiles: 5, tests: 79, status: "PASS" },
      adjacent: { testFiles: 12, tests: 156, status: "PASS" },
      typecheck: "PASS",
      build: "PASS",
      staticPages: 28,
      dependencyAuditVulnerabilities: 0,
    },
    liveChecks: {
      buildInfo: { status: "PASS", commitSha: "fixture-sha" },
      mcpNonPostAdmission: { status: 401, verdict: "PASS" },
      knowledgeOversizedBody: { routes: 3, status: 413, verdict: "PASS" },
      remediationOversizedBody: { status: 413, verdict: "PASS" },
      shareOversizedAck: { status: 413, verdict: "PASS" },
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      providerDispatchPersistence: "APPROVAL_GATED",
      remainingScanFindings: 14,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorUploadPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "security-upstream-transport-remediation-2026-08-11", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_SOURCE_PROVEN_UPSTREAM_TRANSPORT_SECURITY_NO_PROVIDER_PROBE",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    liveAfterDeploymentPending: false,
    sourceScan: {
      scanId: "a8aa9242-ed42-4057-88e9-31a72e298292",
      targetRevision: "8cd86f7ab2abe4ad7d4948d8feda083b0b032386",
      findingCount: 20,
      immutableBaselinePreserved: true,
    },
    remediatedFindings: [
      { findingId: "csf_afc7b9c8c2fe4982bcd22475", anchor: "configurable-mcp-upstream-ssrf" },
      { findingId: "csf_b39a066e2b5d07924770057a", anchor: "unbounded-mcp-upstream-response" },
    ],
    cumulativeRemediation: {
      previouslyRemediated: 6,
      remediatedThisWave: 2,
      remediatedTotal: 8,
      remainingScanFindings: 12,
      securityCompleteClaimAllowed: false,
      freshFollowUpScanRequired: true,
    },
    contracts: {
      configurableOriginsRequireExplicitAllowlist: true,
      credentialFreeHttpsDefaultPortOnly: true,
      allResolvedAddressesMustBePublic: true,
      literalPrivateAndLinkLocalAddressesRejected: true,
      redirectsDisabled: true,
      credentialsAttachedOnlyAfterUrlApproval: true,
      weatherResponseMaxBytes: 1048576,
      accidentResponseMaxBytes: 2097152,
      contentLengthPreflightEnforced: true,
      streamedByteLimitEnforced: true,
    },
    governedPathCompatibility: {
      verdict: "PASS_LIVE_PRODUCTION_UPSTREAM_TRANSPORT_COMPATIBILITY",
      sourceHead: "fixture-sha",
      productionCommit: "fixture-sha",
      coveredGateIds: [
        "security_followup_remediation",
        "public_provider_cancellation",
        "public_provider_work_budget",
      ],
      changedGovernedPaths: [
        ".env.example",
        "lib/accident-cases.ts",
        "lib/server/upstream-http.ts",
        "lib/weather.ts",
      ],
      focused: { testFiles: 5, tests: 32, status: "PASS" },
      adjacent: { testFiles: 11, tests: 119, status: "PASS" },
      noMutation: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
    verification: {
      focused: { testFiles: 5, tests: 32, status: "PASS" },
      adjacent: { testFiles: 11, tests: 119, status: "PASS" },
      typecheck: "PASS",
      build: "PASS",
      staticPages: 28,
      diffCheck: "PASS",
    },
    liveChecks: {
      buildInfo: { status: "PASS", commitSha: "fixture-sha" },
      externalProviderProbe: { executed: false },
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      providerDispatchPersistence: "APPROVAL_GATED",
      remainingScanFindings: 12,
      securityCompleteClaimAllowed: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      externalProviderProbeExecuted: false,
      shareSessionCreated: false,
      vectorUploadPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "security-safety-reference-surface-remediation-2026-08-11", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_SAFETY_REFERENCE_SURFACE_BOUNDED",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    liveAfterDeploymentPending: false,
    sourceScan: {
      scanId: "a8aa9242-ed42-4057-88e9-31a72e298292",
      targetRevision: "8cd86f7ab2abe4ad7d4948d8feda083b0b032386",
      findingCount: 20,
      immutableBaselinePreserved: true,
    },
    remediatedFinding: {
      findingId: "csf_343e69e970d1524202d48324",
      anchor: "safety-reference-local-body-amplification",
      severity: "medium",
    },
    cumulativeRemediation: {
      previouslyRemediated: 8,
      remediatedThisWave: 1,
      remediatedTotal: 9,
      remainingScanFindings: 11,
      securityCompleteClaimAllowed: false,
      freshFollowUpScanRequired: true,
    },
    contracts: {
      internalCorpusBodyRetainedForGrounding: true,
      publicSearchBodyOmitted: true,
      publicSearchPayloadOmitted: true,
      publicSearchMetadataOmitted: true,
      publicHarnessPacketBodyOmitted: true,
      comparisonOnlySearchBodyOmitted: true,
      promptEvidenceUsesBoundedExcerpt: true,
      summaryMaxChars: 480,
      controlsMaxItems: 12,
      controlMaxChars: 280,
      anchorsMaxItems: 8,
      anchorExcerptMaxChars: 360,
    },
    governedPathCompatibility: {
      verdict: "PASS_LIVE_PRODUCTION_SAFETY_REFERENCE_SURFACE_COMPATIBILITY",
      sourceHead: "fixture-sha",
      productionCommit: "fixture-sha",
      coveredGateIds: ["security_followup_remediation"],
      changedGovernedPaths: ["lib/safety-reference-catalog.ts"],
      focused: { testFiles: 4, tests: 103, status: "PASS" },
      adjacent: { testFiles: 8, tests: 176, status: "PASS" },
      noMutation: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
    verification: {
      focused: { testFiles: 4, tests: 103, status: "PASS" },
      adjacent: { testFiles: 8, tests: 176, status: "PASS" },
      typecheck: "PASS",
      build: "PASS",
      staticPages: 28,
      diffCheck: "PASS",
    },
    liveChecks: {
      buildInfo: { status: "PASS", commitSha: "fixture-sha" },
      publicSafetyReferenceSearch: {
        executed: true,
        readOnly: true,
        status: 200,
        returnedItems: 5,
        bodyFieldCount: 0,
        payloadFieldCount: 0,
        metadataFieldCount: 0,
        maxSummaryChars: 259,
        maxControlsPerItem: 2,
        rateLimitMode: "instance",
      },
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      providerDispatchPersistence: "APPROVAL_GATED",
      publicSearchDistributedRateLimitReadiness: "NOTICE_INSTANCE_MODE",
      remainingScanFindings: 11,
      securityCompleteClaimAllowed: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorUploadPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "repository-security-scan-reconciliation-2026-08-11", "report.json"), {
    verdict: "PASS_CORRECTED_FRESH_CURRENT_SOURCE_SCAN_SEALED_OPEN_FINDINGS",
    targetRevision: "f0c8a7be02becd53c21fb80842cf23c571f22b1f",
    scans: [
      { scanId: "8fe9c06a-018c-446f-aa98-1b37df95287a", reportableFindingCount: 17, deferredCandidateCount: 1 },
      { scanId: "03305068-49ff-4b73-8a24-84a91e64ff56", reportableFindingCount: 0, deferredCandidateCount: 0 },
    ],
    sameTargetConflict: { present: true, findingCountDelta: 17, zeroFindingClaimAcceptedForNorthstar: false },
    canonicalReceiptContradictions: [
      { surface: "document_export_work_budgets" },
      { surface: "archive_enrichment_membership" },
    ],
    laterSecurityChain: {
      diffScanId: "3f0107a8-e4a4-4a5b-be37-a28bcea8b05a",
      sealedFindingCount: 3,
      remediatedFindingCount: 3,
      deferredCandidateCount: 2,
      securityCompleteClaimAllowed: false,
    },
    correctedFreshScan: {
      scanId: "c4e9e2f1-7ce4-4313-a651-32205fca401f",
      targetRevision: "910eccb713848aa4aee26f0c411ed0f07ada04a6",
      status: "complete",
      mode: "standard",
      coverageCompleteness: "partial",
      reviewedSurfaceCount: 4,
      reportableFindingCount: 14,
      severityCounts: { medium: 8, low: 6 },
      deferredCandidateCount: 9,
      sourceIncludesLaterProductCommit: true,
      machinePredicatesAlignedWithDispositions: true,
      securityCompleteClaimAllowed: false,
    },
    requiredResolution: {
      correctedFreshFullRepositoryScanRequired: false,
      correctedFreshFullRepositoryScanCompleted: true,
      receiptPredicatesMustMatchDisposition: true,
      originalScansMustRemainImmutable: true,
    },
    boundaries: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorRuntimeMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      approvalGatedBoundariesPreserved: true,
    },
  });
  writeJson(
    rootDir,
    path.join("evaluation", "security-current-remediation-ledger-2026-08-13", "report.json"),
    currentSecurityRemediationLedgerFixture(),
  );
  writeJson(rootDir, path.join("evaluation", "current-full-repository-security-scan-2026-08-13", "report.json"), {
    verdict: "NOTICE_LIVE_DEPLOYED_SOURCE_FIVE_FINDING_REMEDIATION_RESCAN_PENDING",
    immutableBaseline: {
      scanId: "8fe9c06a-018c-446f-aa98-1b37df95287a",
      accountedFindingCount: 18,
      preserved: true,
      rewritten: false,
    },
    currentScan: {
      scanId: "528ad724-6251-46fa-a812-48264396f321",
      status: "completed",
      coverage: "partial",
      reportableFindingCount: 15,
      severityCounts: { medium: 11, low: 4 },
      canonicalArtifacts: {
        manifest: "evaluation/current-full-repository-security-scan-2026-08-13/canonical/scan-manifest.json",
        findings: "evaluation/current-full-repository-security-scan-2026-08-13/canonical/findings.json",
        coverage: "evaluation/current-full-repository-security-scan-2026-08-13/canonical/coverage.json",
        markdownProjection: "evaluation/current-full-repository-security-scan-2026-08-13/scan-report.md",
      },
    },
    currentSourceRemediation: {
      latestSourceHead: "fixture-sha",
      sourceRemediatedCount: 5,
      liveDeployedRemediationCount: 5,
      remainingReportableFindingCountBeforeRescan: 10,
      liveAfterDeploymentPending: false,
      freshPostRemediationScanRequired: true,
      securityCompleteClaimAllowed: false,
      productionBuild: { commitSha: "fixture-sha", branch: "master", environment: "production" },
      items: [
        { slug: "safety-reference-disconnect-cancellation" },
        { slug: "hwp-error-path-disclosure" },
        { slug: "sif-embedding-quality-admission" },
        { slug: "knowledge-reingest-review-reset" },
        { slug: "dispatch-archive-outcome-forgery" },
      ],
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      embeddingOrVectorMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      approvalGatedBoundariesPreserved: true,
      securityCompleteClaimAllowed: false,
    },
  });
  const routePerceptionDir = path.join("evaluation", "live-documents-share-route-perception-2026-08-14");
  const screenshots = [
    "documents-desktop-1440x723.png",
    "documents-mobile-390x723.png",
    "workspace-share-desktop-1440x723.png",
    "workspace-share-mobile-390x723.png",
  ];
  for (const screenshot of screenshots) {
    writeText(rootDir, path.join(routePerceptionDir, screenshot), "fixture image");
  }
  writeJson(rootDir, path.join(routePerceptionDir, "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_SCOPED_DOCUMENTS_AND_WORKSPACE_SHARE_EXACT_SESSION_GAP",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", branch: "master", environment: "production" },
    measurement: {
      documents: [
        {
          route: "/documents?theme=day", viewport: { width: 1440, height: 723 }, documentHeight: 723, bodyHeight: 723,
          bodyViewportRatio: 1, workbench: { bottom: 652 }, uniqueDocumentKeyCount: 12,
          frontVisibleCoreLauncherCount: 3, frontVisibleCoreLaunchers: ["riskAssessmentDraft", "tbmBriefing", "tbmLogDraft"],
          frontVisibleSupportingLauncherCount: 0, horizontalOverflow: false, stickyOverlapCount: 0,
          screenshot: path.join(routePerceptionDir, screenshots[0]), verdict: "PASS",
        },
        {
          route: "/documents?theme=day", viewport: { width: 390, height: 723 }, documentHeight: 723, bodyHeight: 723,
          bodyViewportRatio: 1, workbench: { bottom: 669 }, frontVisibleCoreLauncherCount: 3,
          frontVisibleCoreLaunchers: ["riskAssessmentDraft", "tbmBriefing", "tbmLogDraft"],
          frontVisibleSupportingLauncherCount: 0, horizontalOverflow: false, stickyOverlapCount: 0,
          screenshot: path.join(routePerceptionDir, screenshots[1]), verdict: "PASS",
        },
      ],
      workspaceShare: [
        {
          route: "/workspace share stage", viewport: { width: 1440, height: 723 }, documentHeight: 723, bodyHeight: 723,
          root: { width: 1180, bottom: 715 }, gridTemplateColumns: [509, 400, 227], configurationWidth: 509,
          messagePreviewWidth: 400, desktopStatusRailWidth: 227, distinctDesktopRegions: 3, horizontalOverflow: false,
          screenshot: path.join(routePerceptionDir, screenshots[2]), verdict: "PASS_DESKTOP_THREE_ZONE",
        },
        {
          route: "/workspace share stage", viewport: { width: 390, height: 723 }, documentHeight: 723, bodyHeight: 723,
          root: { width: 337, bottom: 704 }, gridTemplateColumns: [304], messagePreviewWidth: 304,
          desktopStatusRailDisplay: "none", horizontalOverflow: false,
          screenshot: path.join(routePerceptionDir, screenshots[3]), verdict: "PASS_MOBILE_STACK",
        },
      ],
    },
    interpretation: {
      reportedDocumentsBodyHeight2070Reproduced: false,
      reportedWorkspaceShareDesktopMobileCardReproduced: false,
      routeSplitAloneAcceptedAsFix: false,
    },
    remainingBoundaries: {
      exactSavedUserSessionReproduced: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      fixtureOrWorkspaceShareAcceptedAsExactSavedProof: false,
      concreteSavedSessionUrlProvided: false,
      dbBackedSessionCreationApproved: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false, shareSessionCreated: false, providerDispatchCalled: false,
      embeddingOrVectorMutationPerformed: false, wikiPublicationPerformed: false, koshaRegistryMutationPerformed: false,
    },
  });
  const freshnessDir = path.join("evaluation", "deployment-freshness-guard-2026-08-14");
  const freshnessDesktopScreenshot = path.join(freshnessDir, "stale-notice-desktop-1440x723.png");
  const freshnessMobileScreenshot = path.join(freshnessDir, "stale-notice-mobile-390x723.png");
  writeText(rootDir, freshnessDesktopScreenshot, "fixture image");
  writeText(rootDir, freshnessMobileScreenshot, "fixture image");
  writeJson(rootDir, path.join(freshnessDir, "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_DEPLOYMENT_FRESHNESS_GUARD",
    sourceHead: "fixture-sha",
    productionBuild: {
      commitSha: "fixture-sha", branch: "master", environment: "production", sourceHeadMatchesProduction: true,
    },
    verification: {
      liveBrowser: {
        normalCurrentDeployment: { noticePresent: false, bodyHeight: 723, documentHeight: 723, horizontalOverflow: false },
        simulatedShaDrift: {
          refreshButtonVisible: true, desktopNoticeBottom: 707.33, desktopBoxShadow: "none",
          desktopScreenshot: freshnessDesktopScreenshot,
          mobile: { bodyHeight: 723, horizontalOverflow: false, noticeBottom: 711.33, refreshButtonHeight: 44 },
          mobileScreenshot: freshnessMobileScreenshot,
        },
      },
      canonicalFrontendStaticAudit: {
        sourceSha: "fixture-sha", status: "pass", pageFiles: 33, componentFiles: 24,
        coverageIssues: 0, violationCount: 0, importantDeclarations: 0,
      },
    },
    remainingBoundaries: {
      liveAfterDeploymentPending: false, exactSavedUserSessionReproduced: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE", providerDispatchPersistenceApproved: false,
      fullyAutomatedLaunchClaimAllowed: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false, shareSessionCreated: false, providerDispatchCalled: false,
      embeddingOrVectorMutationPerformed: false, wikiPublicationPerformed: false, koshaRegistryMutationPerformed: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "current-full-repository-security-scan-2026-08-13", "canonical", "scan-manifest.json"), {});
  writeJson(rootDir, path.join("evaluation", "current-full-repository-security-scan-2026-08-13", "canonical", "findings.json"), {});
  writeJson(rootDir, path.join("evaluation", "current-full-repository-security-scan-2026-08-13", "canonical", "coverage.json"), {});
  writeText(rootDir, path.join("evaluation", "current-full-repository-security-scan-2026-08-13", "scan-report.md"), "# Scan\n");
  writeJson(rootDir, path.join("evaluation", "post-remediation-full-repository-security-scan-2026-08-14", "report.json"), {
    verdict: "NOTICE_POST_REMEDIATION_STANDARD_SCAN_20_FINDINGS_APPROVAL_BOUNDARIES_PRESERVED",
    scan: {
      scanId: "bd135da7-c309-4e8d-ace5-15222dd3f1c7",
      targetRevision: "8f5dc78f73d5048598fb2519bf7bb758ab090982",
      status: "complete",
      coverage: "partial",
      reviewedSurfaceCount: 5,
      reportableFindingCount: 20,
      severityCounts: { medium: 12, low: 8 },
    },
    baselineReconciliation: {
      immutableOriginalScanId: "8fe9c06a-018c-446f-aa98-1b37df95287a",
      immutableOriginalAccountedFindingCount: 18,
      immutableOriginalPreserved: true,
      priorCurrentScanFindingCount: 15,
    },
    canonicalArtifacts: {
      manifest: "evaluation/post-remediation-full-repository-security-scan-2026-08-14/canonical/scan-manifest.json",
      findings: "evaluation/post-remediation-full-repository-security-scan-2026-08-14/canonical/findings.json",
      coverage: "evaluation/post-remediation-full-repository-security-scan-2026-08-14/canonical/coverage.json",
      markdownProjection: "evaluation/post-remediation-full-repository-security-scan-2026-08-14/scan-report.md",
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      embeddingOrVectorMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      securityCompleteClaimAllowed: false,
      approvalGatedBoundariesPreserved: true,
    },
  });
  writeJson(rootDir, path.join("evaluation", "post-remediation-security-source-closure-2026-08-14", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_TWO_SECURITY_REMEDIATIONS_ONE_DISTRIBUTED_RESIDUAL_RESCAN_PENDING",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    sourceScan: {
      scanId: "bd135da7-c309-4e8d-ace5-15222dd3f1c7",
      reportableFindingCount: 20,
    },
    remediation: {
      productCommits: [
        "aa90789128023363263c18f89a9def85b5dc0c19",
        "0647d70259e82028ca5e66a1852b011ff77c9c28",
        "b026de1e82a936b03f04bbbcb3ae96f330afa832",
      ],
      sourceRemediatedCount: 2,
      sourceMitigatedCount: 1,
      liveDeployedRemediationCount: 2,
      liveDeployedMitigationCount: 1,
      remainingReportableFindingCountBeforeRescan: 18,
      freshPostRemediationScanRequired: true,
      liveAfterDeploymentPending: false,
      items: [
        { ruleId: "resource-exhaustion.request-body-budget" },
        { ruleId: "resource-exhaustion.unbounded-upstream-read" },
        { ruleId: "resource-exhaustion.public-status-fanout", disposition: "live_source_mitigated_distributed_admission_residual" },
      ],
    },
    verification: {
      focusedAndAdjacentTests: { files: 8, tests: 105, failed: 0, status: "PASS" },
      typecheck: "PASS",
      build: { status: "PASS", staticPages: 28 },
      liveVerification: {
        workflowDispatchOversizedStatus: 413,
        workflowDispatchOversizedCode: "WORKFLOW_DISPATCH_PAYLOAD_TOO_LARGE",
        safetyStatusRateLimitMode: "instance",
        work24BoundedReaderIncludedInProduction: true,
        work24OversizedLiveUpstreamNotExecuted: true,
      },
    },
    governedPathCompatibility: {
      verdict: "PASS_LIVE_PRODUCTION_POST_REMEDIATION_GOVERNED_PATH_COMPATIBILITY",
      coveredGateIds: [
        "public_json_request_body_budget",
        "public_provider_admission",
        "security_followup_remediation",
      ],
      changedGovernedPaths: [
        "app/api/workflow/dispatch/route.ts",
        "app/api/safety-reference/status/route.ts",
        "lib/public-work-budget.ts",
        "lib/work24.ts",
      ],
      originalSecurityBaselinesRewritten: false,
      noMutation: true,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      embeddingOrVectorMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      securityCompleteClaimAllowed: false,
      approvalGatedBoundariesPreserved: true,
    },
  });
  writeJson(rootDir, path.join("evaluation", "post-remediation-full-repository-security-scan-2026-08-14", "canonical", "scan-manifest.json"), {});
  writeJson(rootDir, path.join("evaluation", "post-remediation-full-repository-security-scan-2026-08-14", "canonical", "findings.json"), {});
  writeJson(rootDir, path.join("evaluation", "post-remediation-full-repository-security-scan-2026-08-14", "canonical", "coverage.json"), {});
  writeText(rootDir, path.join("evaluation", "post-remediation-full-repository-security-scan-2026-08-14", "scan-report.md"), "# Scan\n");
  writeJson(rootDir, path.join("evaluation", "share-session-revocation-remediation-2026-08-14", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_OWNER_SHARE_SESSION_REVOCATION_RESCAN_PENDING",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    securityFinding: {
      scanId: "bd135da7-c309-4e8d-ace5-15222dd3f1c7",
      findingId: "csf_81119e28edb5ebd0a227f9ca",
      ruleId: "authorization.missing-share-revocation",
      severity: "low",
      immutableFindingPreserved: true,
      freshPostRemediationScanRequired: true,
    },
    sourceContract: {
      method: "DELETE",
      managerAuthenticationRequired: true,
      ownedWorkpackContextRequired: true,
      tupleFilters: ["session_id", "workpack_id", "organization_id", "site_id"],
      revokedStatusPersisted: true,
      updatedAtAuditEvidenceReturned: true,
      malformedSessionIdRejectedBeforeStorage: true,
      unknownOrForeignTupleFailsClosed: true,
      operatorUiAction: "공유 세션 중지",
      confirmationRequired: true,
    },
    verification: {
      focusedTests: { files: 3, tests: 92, failed: 0, status: "PASS" },
      browserGeometry: { files: 1, tests: 4, failed: 0, status: "PASS" },
      typecheck: "PASS",
      build: { status: "PASS", staticPages: 28 },
    },
    liveVerification: {
      liveAfterDeploymentPending: false,
      productionBranch: "master",
      productionEnvironment: "production",
      unauthenticatedDeleteStatus: 401,
      unauthenticatedDeleteConfigured: true,
      unauthenticatedDeleteRevokedSessionId: null,
      destructiveRevokeProbeExecuted: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      shareSessionRevokedForEvidence: false,
      providerDispatchCalled: false,
      embeddingOrVectorMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      shareStorageAndCreationApproval: "APPROVAL_GATED",
      securityCompleteClaimAllowed: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "share-recipient-contact-verification-2026-08-14", "report.json"), {
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_SHARE_RECIPIENT_CONTACT_VERIFICATION_RESCAN_PENDING",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    securityFinding: {
      scanId: "bd135da7-c309-4e8d-ace5-15222dd3f1c7",
      findingId: "csf_e6a120c87c57d3529757bbde",
      ruleId: "authentication.bearer-invitation-attribution",
      severity: "low",
      immutableFindingPreserved: true,
      freshPostRemediationScanRequired: true,
    },
    sourceContract: {
      invitationWorkerIdAloneAcceptedForConfirmation: false,
      fullSnapshottedPhoneAccepted: true,
      fullSnapshottedEmailAccepted: true,
      partialPhoneAccepted: false,
      verificationValuePersisted: false,
      verificationValueReturned: false,
      verificationValueLogged: false,
      missingVerificationStatus: 403,
      mismatchedVerificationStatus: 403,
      missingRecipientContactStatus: 409,
      databaseInsertOccursOnlyAfterVerification: true,
      serverRecipientSnapshotRemainsAuthoritative: true,
      anonymousShareBehaviorPreserved: true,
    },
    uiContract: {
      inputCountIncrease: 0,
      mobileConfirmationRemainsInFirstViewport: true,
      desktopRecipientWorkbenchRemainsMultiRegion: true,
      longContentRemainsContained: true,
    },
    verification: {
      focusedAndAdjacent: { files: 7, tests: 124, failed: 0, status: "PASS" },
      recipientBrowser: { files: 1, tests: 7, failed: 0, status: "PASS" },
      typecheck: "PASS",
      build: { status: "PASS", staticPages: 28 },
    },
    liveProbe: {
      status: 404,
      confirmationId: null,
      realSavedSessionUsed: false,
      realWorkerIdentityUsed: false,
      contactVerificationBranchExecuted: false,
    },
    mutationBoundary: {
      dbSchemaChanged: false,
      dbMutationPerformed: false,
      shareSessionCreated: false,
      readConfirmationCreatedForEvidence: false,
      providerDispatchCalled: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      freshFullRepositorySecurityScanRequiredForCanonicalClosure: true,
      liveRealRecipientVerificationProbe: "NOT_EXECUTED_NO_EXISTING_SAVED_SESSION",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      shareStorageAndCreationApproval: "APPROVAL_GATED",
      recipientAckLiveDataApproval: "APPROVAL_GATED",
      securityCompleteClaimAllowed: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "security-atomic-db-race-approval-boundary-2026-08-14", "report.json"), {
    verdict: "APPROVAL_REQUIRED_TRANSACTIONAL_DB_RACE_REMEDIATION_NO_MUTATION",
    sourceHead: "fixture-sha",
    sealedScan: {
      scanId: "bd135da7-c309-4e8d-ace5-15222dd3f1c7",
      targetRevision: "8f5dc78f73d5048598fb2519bf7bb758ab090982",
      immutableFindingsPreserved: true,
    },
    findings: [
      {
        findingId: "csf_a98f91f2e28285923aa618aa",
        severity: "low",
        currentSourceStillAffected: true,
        requiredVerification: ["a", "b", "c", "d", "e"],
      },
      {
        findingId: "csf_8cec017794f281cd81e25643",
        severity: "low",
        currentSourceStillAffected: true,
        requiredVerification: ["a", "b", "c", "d", "e"],
      },
    ],
    approvalRequest: { required: true, notApprovedOrPerformed: true },
    mutationBoundary: {
      migrationAuthored: false,
      dbSchemaChanged: false,
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      embeddingOrVectorMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      securityCompleteClaimAllowed: false,
      freshFullRepositorySecurityScanRequiredAfterRemediation: true,
    },
  });
  writeJson(rootDir, path.join("evaluation", "security-agent-chat-durable-admission-2026-08-14", "report.json"), {
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_DURABLE_AGENT_ADMISSION_RESCAN_PENDING",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionBuild: {
      commitSha: "fixture-sha",
      branch: "master",
      environment: "production",
      sourceHeadMatchesProduction: true,
    },
    sealedFinding: {
      scanId: "bd135da7-c309-4e8d-ace5-15222dd3f1c7",
      findingId: "csf_dbfc57f541ee5079a9bf9735",
      ruleId: "resource-exhaustion.distributed-agent-admission",
      immutableFindingMutated: false,
      canonicalClosureClaimed: false,
    },
    contracts: {
      authenticatedIdentityQuota: {
        namespace: "agent-chat-authenticated",
        limit: 5,
        distributedRequiredInProduction: true,
        missingConfigurationFailsBeforeBodyAndSiteWork: true,
      },
      engineConcurrencyLease: {
        namespace: "agent-chat-engine-work",
        defaultConcurrency: 1,
        distributedRequiredInProduction: true,
        missingConfigurationFailsBeforeAvailabilityOrEngineWork: true,
        busyFailsBeforeEngineWork: true,
        availabilityFailureReleasesLease: true,
        completionAndCancellationReleaseLease: true,
      },
      preAuthBoundary: {
        existingUnauthenticated401Preserved: true,
        instanceFallbackRetained: true,
      },
    },
    verification: {
      focused: { files: 1, tests: 24, failed: 0, status: "PASS" },
      focusedAndAdjacentCore: { files: 5, tests: 55, failed: 0, status: "PASS" },
      broaderHermesAttempt: {
        testsPassed: 107,
        testsFailed: 1,
        status: "RED_EXISTING_APPROVAL_GATED_SCHEMA_DEPENDENCY",
        relatedToThisDiff: false,
      },
      typecheck: "PASS",
      build: { status: "PASS", staticPages: 28 },
    },
    liveProbe: {
      status: 401,
      code: "AUTH_REQUIRED",
      rateLimitMode: "instance",
      providerWorkExecuted: false,
      authenticatedFailClosedProbeExecuted: false,
      authenticatedAgentAvailability: "FAIL_CLOSED_UNTIL_DISTRIBUTED_CONFIG",
    },
    mutationBoundary: {
      dbSchemaChanged: false,
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      providerGenerationExecuted: false,
      shareSessionCreated: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      distributedProductionActivation: "OPEN_OPERATOR_CONFIGURATION",
      authenticatedRuntimeProbe: "NOT_EXECUTED_NO_USER_TOKEN",
      freshFullRepositorySecurityScanRequiredForCanonicalClosure: true,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      approvalGatedOperationsRemainApprovalGated: true,
    },
  });
  writeJson(rootDir, path.join("evaluation", "security-mcp-provider-admission-2026-08-14", "report.json"), {
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_DURABLE_MCP_PROVIDER_ADMISSION_RESCAN_PENDING",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionBuild: {
      commitSha: "fixture-sha",
      branch: "master",
      environment: "production",
      sourceHeadMatchesProduction: true,
    },
    sealedFinding: {
      scanId: "bd135da7-c309-4e8d-ace5-15222dd3f1c7",
      findingId: "csf_b10479b6501c208c4d11644e",
      ruleId: "resource-exhaustion.distributed-provider-admission",
      immutableFindingMutated: false,
      canonicalClosureClaimed: false,
    },
    contracts: {
      providerGeneratingTools: ["generate_safety_docpack", "generate_reviewed_safety_docpack"],
      tokenTenantRateAdmission: {
        namespace: "mcp-provider-generation",
        limit: 10,
        windowMs: 60000,
        bearerStoredOrLogged: false,
        sha256BearerFingerprintIncluded: true,
        organizationAndSiteIncluded: true,
        distributedRequiredInProduction: true,
        missingOrPartialConfigurationFailsBeforeProviderHandler: true,
      },
      providerConcurrencyLease: {
        namespace: "mcp-provider-generation-work",
        capacity: 12,
        leaseMs: 310000,
        weights: { template: 0, enhanced: 2, full: 12 },
        distributedRequiredInProduction: true,
        busyFailsBeforeProviderHandler: true,
        completionAndFailureReleaseLease: true,
      },
      preservedBehavior: {
        readOnlyMcpToolsUnaffected: true,
        templateModeOutsideProviderAdmission: true,
        developmentWeightedInstanceFallbackRetained: true,
        existingTransportBodyAndAuthenticationBudgetsRetained: true,
      },
    },
    verification: {
      focused: { files: 3, tests: 61, failed: 0, status: "PASS" },
      focusedAndAdjacentMcp: { files: 8, tests: 94, failed: 0, status: "PASS" },
      typecheck: "PASS",
      dependencyAuditVulnerabilities: 0,
      build: { status: "PASS", staticPages: 28 },
    },
    liveProbe: {
      status: 401,
      rateLimitMode: "instance",
      mcpToolDispatchPerformed: false,
      providerGenerationExecuted: false,
      validAuthenticatedFailClosedProbeExecuted: false,
      authenticatedProviderGenerationAvailability: "FAIL_CLOSED_UNTIL_DISTRIBUTED_CONFIG",
    },
    mutationBoundary: {
      dbSchemaChanged: false,
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      providerGenerationExecuted: false,
      shareSessionCreated: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      distributedProductionActivation: "OPEN_OPERATOR_CONFIGURATION",
      validAuthenticatedRuntimeProbe: "NOT_EXECUTED_NO_MCP_TOKEN",
      freshFullRepositorySecurityScanRequiredForCanonicalClosure: true,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      approvalGatedOperationsRemainApprovalGated: true,
    },
  });
  writeJson(rootDir, path.join("evaluation", "public-json-request-body-budget-2026-08-11", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_JSON_PRE_PARSE_BUDGET",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    productionIncludesProductCommit: true,
    scan: {
      scanId: "c4e9e2f1-7ce4-4313-a651-32205fca401f",
      findingId: "csf_44619971f6e14344d1d76da5",
      anchor: "json-body-budget-after-parse",
      immutableFindingPreserved: true,
      followUpScanRequired: true,
    },
    verification: {
      focusedSecurityTests: { files: 3, tests: 22, status: "PASS" },
      adjacentAdmissionTests: { files: 4, tests: 26, status: "PASS" },
      typecheck: "PASS",
      build: { status: "PASS", staticPages: 28 },
      diffCheck: "PASS",
    },
    liveVerification: {
      buildInfoCommit: "fixture-sha",
      providerWorkExpected: false,
      cases: [
        { path: "/api/ask", status: 413, code: "PUBLIC_WORK_BUDGET_EXCEEDED", limit: 131072 },
        { path: "/api/ask/stream", status: 413, code: "PUBLIC_WORK_BUDGET_EXCEEDED", limit: 131072 },
        { path: "/api/knowledge/match", status: 413, code: "PUBLIC_WORK_BUDGET_EXCEEDED", limit: 16384 },
      ],
    },
    mutationBoundary: {
      dbSchemaMutation: false,
      dbDataMutation: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorOrEmbeddingMutation: false,
      wikiPublication: false,
      koshaExactRegistryMutation: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      securityCompleteClaimAllowed: false,
      remainingScanFindingsStayVisible: true,
      followUpSecurityScan: "REQUIRED",
    },
  });
  writeJson(rootDir, path.join("evaluation", "improvement-photo-analysis-budget-2026-08-11", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_IMPROVEMENT_PHOTO_ANALYSIS_BUDGET_WITH_INSTANCE_ADMISSION",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    productionIncludesProductCommit: true,
    scan: {
      scanId: "c4e9e2f1-7ce4-4313-a651-32205fca401f",
      findingId: "csf_4632cfb321a45b5f7429daef",
      anchor: "improvement-photo-analysis-unbounded",
      immutableFindingPreserved: true,
      followUpScanRequired: true,
    },
    budgets: {
      maxRequestBytes: 42991616,
      maxAggregatePhotoBytes: 41943040,
      maxBytesPerPhoto: 20971520,
      maxImprovementPhotoFiles: 2,
      maxDedicatedHazardPhotoFiles: 10,
      rateLimitPerMinute: 8,
      aggregateConcurrency: 2,
    },
    controls: {
      contentLengthRequiredBeforeMultipartParse: true,
      oversizedDeclaredBodyRejectedBeforeMultipartParse: true,
      aggregateBytesCheckedAfterParseBeforeProvider: true,
      unexpectedFileFieldsRejected: true,
      mimeAllowlistChecked: true,
      fileSignatureChecked: true,
      improvementAnalyzerRevalidatesFiles: true,
      dedicatedAndImprovementRoutesShareAdmission: true,
      providerCalledOnRejectedInput: false,
      dbWriteCalledOnRejectedInput: false,
    },
    admission: { productionDistributedActivation: "INSTANCE_FALLBACK_ACTIVE" },
    verification: {
      focusedAndAdjacentTests: { files: 7, tests: 76, status: "PASS" },
      typecheck: "PASS",
      build: { status: "PASS", staticPages: 28 },
      diffCheck: "PASS",
      secretScan: "PASS",
    },
    liveVerification: {
      buildInfoCommit: "fixture-sha",
      status: "PASS_READ_ONLY_ADMISSION_PROBE",
      cases: [
        { path: "/api/input-photos/hazard-analysis", status: 401, rateLimitMode: "instance", workUnit: "photo-analysis", multipartParsed: false, providerCalled: false },
        { path: "/api/workpacks/id/improvements", status: 401, rateLimitMode: "instance", workUnit: "photo-analysis", multipartParsed: false, providerCalled: false, dbMutationPerformed: false },
      ],
    },
    mutationBoundary: {
      dbSchemaMutation: false,
      dbDataMutation: false,
      providerDispatchCalled: false,
      photoVisionProviderCalledDuringEvidence: false,
      shareSessionCreated: false,
      vectorOrEmbeddingMutation: false,
      wikiPublication: false,
      koshaExactRegistryMutation: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      securityCompleteClaimAllowed: false,
      remainingScanFindingsStayVisible: true,
      distributedProductionActivation: "INSTANCE_FALLBACK_ACTIVE_NOT_DISTRIBUTED",
      followUpSecurityScan: "REQUIRED",
    },
  });
  writeJson(rootDir, path.join("evaluation", "public-provider-cancellation-2026-08-11", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_PROVIDER_CANCELLATION_SOURCE_PROVEN",
    sourceHead: "fixture-sha",
    securityFinding: {
      scanId: "c4e9e2f1-7ce4-4313-a651-32205fca401f",
      findingId: "csf_278e8efc9722eb80016c42a3",
      anchor: "provider-work-survives-disconnect",
      canonicalFindingRemainsImmutable: true,
      followUpSecurityScanRequired: true,
    },
    contracts: {
      weatherSharedWork: {
        requestSignalForwarded: true,
        equivalentRequestsCoalesced: true,
        singleConsumerDisconnectDoesNotCancelSharedProvider: true,
        finalConsumerDisconnectCancelsSharedProvider: true,
      },
      knowledgeRegeneration: {
        requestSignalForwardedToGeneration: true,
        abortSkipsProviderFallback: true,
        dbMutationAllowed: false,
      },
      workpackRemediation: {
        requestSignalForwardedToReferenceSearch: true,
        requestSignalForwardedToGeneration: true,
        abortSkipsProviderFallback: true,
        dbMutationPerformed: false,
      },
    },
    verification: {
      focusedAndAdjacentVitest: { files: 9, tests: 104, failed: 0 },
      typecheck: "PASS",
      build: { status: "PASS", staticPages: 28 },
      diffCheck: "PASS",
    },
    productionBuild: {
      commitSha: "fixture-sha",
      branch: "master",
      environment: "production",
      sourceHeadMatchesProduction: true,
      liveAfterDeploymentPending: false,
      liveProviderCallExecuted: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorRuntimeMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      securityCompleteClaimAllowed: false,
      followUpSecurityScan: "REQUIRED",
      approvalGatedOperationsUnchanged: true,
    },
  });
  writeJson(rootDir, path.join("evaluation", "public-provider-admission-2026-08-11", "report.json"), {
    verdict: "PARTIAL_LIVE_PRODUCTION_WEIGHTED_INSTANCE_ADMISSION_DISTRIBUTED_ACTIVATION_PENDING",
    sourceHead: "fixture-sha",
    securityFindings: [
      { scanId: "c4e9e2f1-7ce4-4313-a651-32205fca401f", findingId: "csf_f5dd7b0bac8e0b7c7e531b29", canonicalFindingRemainsImmutable: true, followUpSecurityScanRequired: true },
      { scanId: "c4e9e2f1-7ce4-4313-a651-32205fca401f", findingId: "csf_a0ac317d9f81776462e0441a", canonicalFindingRemainsImmutable: true, followUpSecurityScanRequired: true },
    ],
    contracts: {
      publicAskProviderAdmission: {
        distributedLeaseSupported: true,
        productionFallbackMode: "instance",
        capacity: 12,
        modeWeights: { template: 0, enhanced: 2, full: 12 },
        queueRejectedBeforeProviderWork: true,
        jsonLeaseReleasedAfterWork: true,
        streamLeaseHeldUntilCompletionOrCancellation: true,
      },
      weatherAdmission: { distributedRateLimitSupported: true, productionFallbackMode: "instance", questionMaxChars: 240 },
      knowledgeMatchAdmission: { distributedRateLimitSupported: true, productionFallbackMode: "instance", questionMaxChars: 900, requestMaxBytes: 16384 },
    },
    verification: {
      focusedVitest: { files: 7, tests: 38, failed: 0 },
      focusedAndAdjacentVitest: { files: 10, tests: 52, failed: 0 },
      typecheck: "PASS",
      build: { status: "PASS", staticPages: 28 },
      diffCheck: "PASS",
    },
    governedPathCompatibility: {
      verdict: "PASS_LIVE_PRODUCTION_GOVERNED_PATH_COMPATIBILITY",
      sourceHead: "fixture-sha",
      productionCommit: "fixture-sha",
      coveredGateIds: [
        "security_followup_remediation",
        "public_json_request_body_budget",
        "improvement_photo_analysis_budget",
        "public_provider_cancellation",
      ],
      changedGovernedPaths: [
        "app/api/ask/route.ts",
        "app/api/ask/stream/route.ts",
        "app/api/knowledge/match/route.ts",
        "app/api/weather/route.ts",
        "lib/public-ask-admission.ts",
        "lib/public-distributed-rate-limit.ts",
      ],
      focusedVitest: { files: 23, tests: 215, failed: 0 },
      originalSecurityBaselinesRewritten: false,
      followUpSecurityScan: "REQUIRED",
      noMutation: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
    productionBuild: {
      commitSha: "fixture-sha",
      branch: "master",
      environment: "production",
      sourceHeadMatchesProduction: true,
      liveAfterDeploymentPending: false,
      liveTemplateAskExecuted: true,
      liveProviderBackedAskExecuted: false,
      liveWeatherProviderCallExecuted: false,
      liveKnowledgeMatchExecuted: false,
    },
    liveChecks: [
      { path: "/api/ask", status: 200, rateLimitMode: "instance", aiMode: "template", workUnit: 0 },
      { path: "/api/weather", status: 413, rateLimitMode: "instance", code: "PUBLIC_WORK_BUDGET_EXCEEDED" },
      { path: "/api/knowledge/match", status: 413, rateLimitMode: "instance", code: "PUBLIC_WORK_BUDGET_EXCEEDED" },
    ],
    mutationBoundary: {
      dbMutationPerformed: false,
      providerCallPerformedForEvidence: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorRuntimeMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      distributedProductionActivation: "PENDING_CONFIGURATION",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      securityCompleteClaimAllowed: false,
      followUpSecurityScan: "REQUIRED",
      approvalGatedOperationsUnchanged: true,
    },
  });
  writeJson(rootDir, path.join("evaluation", "security-mcp-generation-work-budget-2026-08-04", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_SOURCE_INCLUDED_MCP_GENERATION_WORK_BUDGET_AUTHENTICATED_RUNTIME_PROBE_AND_RESCAN_PENDING",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    sourceHeadMatchesProduction: true,
    canonicalBaseline: {
      scanId: "8fe9c06a-018c-446f-aa98-1b37df95287a",
      targetRevision: "f0c8a7be02becd53c21fb80842cf23c571f22b1f",
      findingId: "csf_f30faad248ef517b894c8946",
      ruleId: "resource-exhaustion.mcp-generation",
      findingStatus: "immutable_baseline_preserved_remediation_not_rescanned",
    },
    currentSourceContract: {
      postBodyMaxBytes: 98304,
      questionMaxChars: 4000,
      taskMaxChars: 256,
      documentTextMaxChars: 20000,
      rateLimit: {
        namespace: "mcp-authenticated",
        limit: 20,
        windowMs: 60000,
        rawBearerSentToLimiter: false,
        distributedWhenConfigured: true,
        instanceFallbackWhenAbsent: true,
        partialOrUnavailableDistributedConfigFailsClosed: true,
        responseModeHeader: "X-SafeClaw-Rate-Limit",
      },
      ordering: {
        authenticationWrapsBudgetedHandler: true,
        admissionBeforeBodyBuffering: true,
        bodyBudgetBeforeMcpToolDispatch: true,
        oversizedChunkedBodyRejected: true,
        declaredContentLengthBypassRejectedByMeasuredBytes: true,
      },
      preservedBehavior: {
        boundedAuthenticatedPost: true,
        maxQaDocumentPayload: true,
        getSseExcludedFromPostBudget: true,
        deleteSessionExcludedFromPostBudget: true,
      },
    },
    verification: {
      focused: { files: 2, tests: 14, status: "PASS" },
      adjacentMcp: { files: 7, tests: 77, status: "PASS" },
      typecheck: "PASS",
      dependencyAuditVulnerabilities: 0,
      build: { status: "PASS", staticPages: 28 },
      liveReadOnlyProbe: { status: 401, authenticationFailedClosed: true, validAuthenticatedBudgetProbeExecuted: false },
    },
    currentLiveRefresh: {
      verdict: "PASS_LIVE_PRODUCTION_MCP_INVALID_TOKEN_ADMISSION_REFRESH",
      sourceHead: "fixture-sha",
      productionCommit: "fixture-sha",
      productionBranch: "master",
      productionEnvironment: "production",
      deploymentUrl: "fixture.vercel.app",
      probe: {
        path: "/api/mcp/mcp",
        method: "POST",
        credential: "intentionally_invalid_non_secret",
        requestBodyBytes: 2,
        status: 401,
        authenticationFailedClosed: true,
        rateLimitHeader: "instance",
        mcpToolDispatchPerformed: false,
        providerCallPerformed: false,
        validAuthenticatedBudgetProbeExecuted: false,
      },
      mutationBoundary: {
        dbMutationPerformed: false,
        providerDispatchCalled: false,
        shareSessionCreated: false,
        embeddingOrVectorMutationPerformed: false,
        wikiPublished: false,
        koshaExactRegistryMutationPerformed: false,
      },
    },
    remainingBoundaries: {
      liveAfterDeploymentRequired: false,
      validAuthenticatedRuntimeProbeRequired: true,
      freshSecurityRescanRequired: true,
      distributedProductionActivationRequired: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      approvalGatedBoundariesUnchanged: true,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      embeddingOrVectorMutationPerformed: false,
      wikiPublished: false,
      koshaExactRegistryMutationPerformed: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "document-authoring-pane-margin-2026-08-02", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_ACTION_PANE_MARGIN",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    sourceHeadMatchesProduction: true,
    beforeLive: {
      paneMarginBelow16Count: 44,
      minimumPaneMargin: -41,
    },
    afterLive: {
      total: 48,
      pass: 48,
      fail: 0,
      paneMarginBelow16Count: 0,
      minimumPaneMargin: 16,
      maximumShellRatio: 2.36,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      routeSplitAloneAcceptedAsFix: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "document-raw-drilldown-geometry-2026-08-02", "after-live", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_12_DOCUMENT_RAW_DRILLDOWN_GEOMETRY",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", branch: "master", environment: "production" },
    sourceHeadMatchesProduction: true,
    documentCount: 12,
    viewportCaseCount: 4,
    total: 48,
    pass: 48,
    fail: 0,
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
    results: ["day-desktop", "night-desktop", "day-mobile", "night-mobile"].flatMap((label) => (
      canonicalDocumentKeys.map((documentKey) => ({
        theme: label.startsWith("day") ? "day" : "night",
        label,
        documentKey,
        verdict: "PASS",
        metrics: {
          viewportHeight: 723,
          pageHeight: label.includes("mobile") ? 728 : 723,
          horizontalOverflow: false,
          shellRatio: label.includes("mobile") ? 2.25 : 1.36,
          sourceTop: label.includes("mobile") ? 356 : 308,
          sourceBottom: label.includes("mobile") ? 616 : 568,
          sourceClientHeight: 258,
          sourceScrollHeight: 1200,
          sourceOverflowY: "auto",
          sourceEditorVisibleCount: 1,
          structuredEditorVisibleCount: 0,
          sourceModePressed: true,
          selectedEditorCount: 1,
        },
      }))
    )),
  });
  writeJson(rootDir, path.join("evaluation", "document-risk-row-navigation-2026-08-02", "after-live", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_NAVIGATION",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", branch: "master", environment: "production" },
    sourceHeadMatchesProduction: true,
    total: 4,
    pass: 4,
    fail: 0,
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
    results: ["day-desktop", "night-desktop", "day-mobile", "night-mobile"].map((label) => ({
      theme: label.startsWith("day") ? "day" : "night",
      label,
      verdict: "PASS",
      metrics: {
        viewportHeight: 723,
        bodyHeight: label.includes("mobile") ? 728 : 723,
        horizontalOverflow: false,
        shellRatio: label.includes("mobile") ? 2.23 : 1.75,
        riskRowCount: 3,
        uniqueVisibleLabelCount: 3,
        taskContextLabelCount: 1,
        rows: ["추락 위험", "낙하 위험", "충돌 위험"].map((riskLabel) => ({
          label: riskLabel,
          accessibleName: `${riskLabel} · 작업: 외벽 도장`,
          title: `${riskLabel} · 작업: 외벽 도장`,
        })),
      },
    })),
  });
  writeJson(rootDir, path.join("evaluation", "document-risk-row-mobile-order-2026-08-02", "after-live", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_MOBILE_ORDER",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", branch: "master", environment: "production" },
    sourceHeadMatchesProduction: true,
    total: 4,
    pass: 4,
    fail: 0,
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
    results: [
      { theme: "day", label: "desktop-short-1440x723", mobile: false },
      { theme: "night", label: "desktop-short-1440x723", mobile: false },
      { theme: "day", label: "mobile-short-390x723", mobile: true },
      { theme: "night", label: "mobile-short-390x723", mobile: true },
    ].map(({ theme, label, mobile }) => ({
      theme,
      label,
      verdict: "PASS",
      metrics: {
        viewportHeight: 723,
        bodyHeight: mobile ? 728 : 723,
        horizontalOverflow: false,
        shellRatio: mobile ? 2.11 : 1.75,
        tabsBottom: mobile ? 580 : 451,
        panelTop: mobile ? 583 : 463,
        hazardFieldBottom: mobile ? 703 : 632,
        selectorCount: 3,
        tabsBeforePanel: true,
        tabsVisibleInShell: true,
        hazardFieldVisibleInShell: true,
      },
    })),
  });
  writeJson(rootDir, path.join("evaluation", "document-risk-row-mobile-label-2026-08-02", "after-live", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_MOBILE_LABEL",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", branch: "master", environment: "production" },
    sourceHeadMatchesProduction: true,
    total: 4,
    pass: 4,
    fail: 0,
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
    results: [
      { theme: "day", label: "desktop-short-1440x723", mobile: false },
      { theme: "night", label: "desktop-short-1440x723", mobile: false },
      { theme: "day", label: "mobile-short-390x723", mobile: true },
      { theme: "night", label: "mobile-short-390x723", mobile: true },
    ].map(({ theme, label, mobile }) => ({
      theme,
      label,
      verdict: "PASS",
      metrics: {
        viewportWidth: mobile ? 390 : 1440,
        viewportHeight: 723,
        bodyHeight: mobile ? 728 : 723,
        horizontalOverflow: false,
        shellRatio: mobile ? 2.11 : 1.75,
        hazardFieldBottom: mobile ? 703 : 632,
        tabsBeforePanel: true,
        hazardFieldVisibleInShell: true,
        uniqueVisibleSelectorCount: 3,
        selectorMetrics: [
          { hazardText: "이동식 비계 추락", compactText: "추락" },
          { hazardText: "강풍 자재 낙하", compactText: "추락" },
          { hazardText: "지게차 동선 충돌", compactText: "충돌·맞음" },
        ].map(({ hazardText, compactText }, index) => ({
          hazardText,
          compactText,
          visibleText: `${String(index + 1).padStart(2, "0")} ${compactText} ${hazardText}`,
          accessibleName: `위험 항목 ${index + 1} 선택: ${hazardText}`,
          title: hazardText,
          hazardVisible: true,
          compactVisible: mobile,
          compactClipped: false,
        })),
      },
    })),
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
  const fixtureSourceSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: rootDir,
    encoding: "utf8",
  }).trim();
  alignFixtureJsonSourceShas(path.join(rootDir, "evaluation"), fixtureSourceSha);
  return rootDir;
}

describe("northstar open gate audit", { timeout: 15_000 }, () => {
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
    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")?.detail).toContain("Scoped Documents and Workspace/fixture Share viewport IA");
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
    expect(audit.gates.find((gate) => gate.id === "public_search_distributed_rate_limit_readiness")).toMatchObject({
      state: "notice",
      evidencePath: path.join("evaluation", "public-search-distributed-rate-limit-readiness-2026-08-02", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "public_search_distributed_rate_limit_readiness")?.detail).toContain("X-SafeClaw-Rate-Limit=instance");
    expect(audit.gates.find((gate) => gate.id === "public_search_distributed_rate_limit_readiness")?.detail).toContain("13 DB/RLS findings");
    expect(audit.gates.find((gate) => gate.id === "public_search_distributed_rate_limit_readiness")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "public_generation_admission_security")).toMatchObject({
      state: "notice",
      evidencePath: path.join("evaluation", "security-public-generation-admission-2026-08-04", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "public_generation_admission_security")?.detail).toContain("instance admission");
    expect(audit.gates.find((gate) => gate.id === "public_generation_admission_security")?.detail).toContain("zero provider or mutation work");
    expect(audit.gates.find((gate) => gate.id === "public_generation_admission_security")?.detail).toContain("fresh diff scan remain open");
    expect(audit.gates.find((gate) => gate.id === "public_generation_admission_security")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "security_followup_remediation")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "codex-security-followup-remediation-2026-08-11", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "security_followup_remediation")?.detail).toContain("three diff findings");
    expect(audit.gates.find((gate) => gate.id === "security_followup_remediation")?.detail).toContain("original 18-finding baseline");
    expect(audit.gates.find((gate) => gate.id === "security_followup_remediation")?.detail).toContain("two deferred candidates");
    expect(audit.gates.find((gate) => gate.id === "security_followup_remediation")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "security_resource_remediation")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "security-resource-remediation-2026-08-11", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "security_resource_remediation")?.detail).toContain("6/20");
    expect(audit.gates.find((gate) => gate.id === "security_resource_remediation")?.detail).toContain("remaining 14 findings");
    expect(audit.gates.find((gate) => gate.id === "security_resource_remediation")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "security_upstream_transport_remediation")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "security-upstream-transport-remediation-2026-08-11", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "security_upstream_transport_remediation")?.detail).toContain("cumulative 8/20");
    expect(audit.gates.find((gate) => gate.id === "security_upstream_transport_remediation")?.detail).toContain("leaves 12 visible");
    expect(audit.gates.find((gate) => gate.id === "security_upstream_transport_remediation")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "security_safety_reference_surface_remediation")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "security-safety-reference-surface-remediation-2026-08-11", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "security_safety_reference_surface_remediation")?.detail).toContain("cumulative 9/20");
    expect(audit.gates.find((gate) => gate.id === "security_safety_reference_surface_remediation")?.detail).toContain("leaves 11 visible");
    expect(audit.gates.find((gate) => gate.id === "security_safety_reference_surface_remediation")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "repository_security_scan_reconciliation")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "repository-security-scan-reconciliation-2026-08-11", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "repository_security_scan_reconciliation")?.detail).toContain("17 findings / 1 deferred versus 0 / 0");
    expect(audit.gates.find((gate) => gate.id === "repository_security_scan_reconciliation")?.detail).toContain("two fail-open receipt contradictions");
    expect(audit.gates.find((gate) => gate.id === "repository_security_scan_reconciliation")?.detail).toContain("14 open findings");
    expect(audit.gates.find((gate) => gate.id === "repository_security_scan_reconciliation")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "current_security_remediation_ledger")).toMatchObject({
      state: "notice",
      evidencePath: path.join("evaluation", "security-current-remediation-ledger-2026-08-13", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "current_security_remediation_ledger")?.detail).toContain("17/23");
    expect(audit.gates.find((gate) => gate.id === "current_security_remediation_ledger")?.detail).toContain("six findings visible");
    expect(audit.gates.find((gate) => gate.id === "current_security_remediation_ledger")?.detail).toContain("not a security-complete claim");
    expect(audit.gates.find((gate) => gate.id === "current_security_remediation_ledger")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "public_json_request_body_budget")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "public-json-request-body-budget-2026-08-11", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "public_json_request_body_budget")?.detail).toContain("pre-parse byte limits");
    expect(audit.gates.find((gate) => gate.id === "public_json_request_body_budget")?.detail).toContain("14-finding scan");
    expect(audit.gates.find((gate) => gate.id === "public_json_request_body_budget")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "improvement_photo_analysis_budget")).toMatchObject({
      state: "notice",
      evidencePath: path.join("evaluation", "improvement-photo-analysis-budget-2026-08-11", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "improvement_photo_analysis_budget")?.detail).toContain("76 tests");
    expect(audit.gates.find((gate) => gate.id === "improvement_photo_analysis_budget")?.detail).toContain("instance fallback");
    expect(audit.gates.find((gate) => gate.id === "improvement_photo_analysis_budget")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "public_provider_cancellation")).toMatchObject({
      state: "notice",
      evidencePath: path.join("evaluation", "public-provider-cancellation-2026-08-11", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "public_provider_cancellation")?.detail).toContain("104 tests");
    expect(audit.gates.find((gate) => gate.id === "public_provider_cancellation")?.detail).toContain("no live provider cancellation call");
    expect(audit.gates.find((gate) => gate.id === "public_provider_cancellation")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "public_provider_admission")).toMatchObject({
      state: "notice",
      evidencePath: path.join("evaluation", "public-provider-admission-2026-08-11", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "public_provider_admission")?.detail).toContain("template 0, enhanced 2, full 12");
    expect(audit.gates.find((gate) => gate.id === "public_provider_admission")?.detail).toContain("process-instance admission");
    expect(audit.gates.find((gate) => gate.id === "public_provider_admission")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "mcp_generation_work_budget_security")).toMatchObject({
      state: "notice",
      evidencePath: path.join("evaluation", "security-mcp-generation-work-budget-2026-08-04", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "mcp_generation_work_budget_security")?.detail).toContain("96 KiB");
    expect(audit.gates.find((gate) => gate.id === "mcp_generation_work_budget_security")?.detail).toContain("before any MCP tool dispatch");
    expect(audit.gates.find((gate) => gate.id === "mcp_generation_work_budget_security")?.detail).toContain("valid authenticated runtime probe");
    expect(audit.gates.find((gate) => gate.id === "mcp_generation_work_budget_security")?.detail).toContain("MISSING_EVIDENCE");
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
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("6 readable section tabs");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("44px minimum controls");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("two-line labels");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("48/48 rows");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("at most one role-specific cockpit");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("foreign-worker briefing no longer stacks");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("44/48 to 0/48");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("current all-document contract now requires and proves a 32px minimum");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("maximum shell ratio at 2.36");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("48/48 raw-source drilldown");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("local source scrolling");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("4/4 Day/Night desktop-short/mobile-short cases");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("hazard-first visible labels");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("selector rail precedes the active editor");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("first hazard bottom 703px");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("unclipped accident type plus hazard cue");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("12 document first-task cockpits");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("staged Share rail");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("desktop-short 1440x723");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("three-zone cockpit");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("1180px workspace step rail");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("zero overflowing step-status labels");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("390x723 mobile stack");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("invited recipient fixture retains a separate desktop two-zone contract");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("live mobile selected-summary");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("exact 844px viewport");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("exact one-viewport Documents");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("selected editor/detail field-summary risk-row landing");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("selected-editor field summary plus evidence/recheck CTA before raw textarea");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("not a claim that the whole Documents page is short");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("raw/source editing remains an explicit secondary drilldown and is now live-bounded");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("/share/[sessionId] desktop recipient confirmation");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("mobile confirmation CTA before document details");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.evidencePath).toBe(
      path.join("evaluation", "document-risk-row-mobile-label-2026-08-02", "after-live", "report.json"),
    );
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("raw/source editing as an explicit live-bounded secondary drilldown");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("selected-editor evidence/recheck CTA remains live-proven before raw editing");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("default exposure budget");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("shell ratio target <= 3");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("first viewport shows current status, core 3 launcher, selected document workbench");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("2-3 region cockpit for recipient/channel/status/provenance");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("exact saved user session");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("do not phrase them as the whole Documents page being short");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("desktop width-ratio/grid metrics");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("/share/[sessionId] recipient cockpit geometry is live-proven");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("invited recipient fixture, exact saved/generated /share/[sessionId], and manager/workspace share-result");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).not.toContain("Promote the Share staged rail");
    expect(audit.gates.find((gate) => gate.id === "live_documents_share_route_perception")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "live-documents-share-route-perception-2026-08-14", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "live_documents_share_route_perception")?.detail).toContain("1180px three-zone desktop workbench");
    expect(audit.gates.find((gate) => gate.id === "live_documents_share_route_perception")?.detail).toContain("exact saved /share/[sessionId]");
    expect(audit.gates.find((gate) => gate.id === "live_documents_share_route_perception")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "deployment_freshness_guard")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "deployment-freshness-guard-2026-08-14", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "deployment_freshness_guard")?.detail).toContain("long-open tab");
    expect(audit.gates.find((gate) => gate.id === "deployment_freshness_guard")?.detail).toContain("MISSING_EVIDENCE");
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
    expect(audit.gates.find((gate) => gate.id === "security_atomic_db_race_remediation")).toMatchObject({
      state: "approval_gated",
      evidencePath: path.join("evaluation", "security-atomic-db-race-approval-boundary-2026-08-14", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "security_atomic_db_race_remediation")?.detail).toContain("no migration");
    expect(audit.gates.find((gate) => gate.id === "security_atomic_db_race_remediation")?.detail).toContain("MISSING_EVIDENCE");
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

  it("fails security evidence closed when revision fields are not Git SHAs", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const rendererPath = path.join(rootDir, "evaluation", "learning-export-renderer-security-2026-08-02", "report.json");
    const renderer = JSON.parse(fs.readFileSync(rendererPath, "utf8")) as {
      sourceHead: string;
      productionBuild: { commitSha: string };
    };
    renderer.sourceHead = "self-asserted";
    renderer.productionBuild.commitSha = "self-asserted";
    fs.writeFileSync(rendererPath, `${JSON.stringify(renderer, null, 2)}\n`, "utf8");

    const publicPath = path.join(rootDir, "evaluation", "security-public-generation-admission-2026-08-04", "report.json");
    const publicReport = JSON.parse(fs.readFileSync(publicPath, "utf8")) as { productCommit: string };
    publicReport.productCommit = "self-asserted";
    fs.writeFileSync(publicPath, `${JSON.stringify(publicReport, null, 2)}\n`, "utf8");

    const mcpPath = path.join(rootDir, "evaluation", "security-mcp-generation-work-budget-2026-08-04", "report.json");
    const mcp = JSON.parse(fs.readFileSync(mcpPath, "utf8")) as {
      sourceHead: string;
      productionCommit: string;
    };
    mcp.sourceHead = "self-asserted";
    mcp.productionCommit = "self-asserted";
    fs.writeFileSync(mcpPath, `${JSON.stringify(mcp, null, 2)}\n`, "utf8");

    const followupPath = path.join(rootDir, "evaluation", "codex-security-followup-remediation-2026-08-11", "report.json");
    const followup = JSON.parse(fs.readFileSync(followupPath, "utf8")) as {
      sourceHead: string;
      deployment: { productionCommit: string };
    };
    followup.sourceHead = "self-asserted";
    followup.deployment.productionCommit = "self-asserted";
    fs.writeFileSync(followupPath, `${JSON.stringify(followup, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "learning_export_renderer_security")?.state).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "public_generation_admission_security")?.state).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "mcp_generation_work_budget_security")?.state).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "security_followup_remediation")?.state).toBe("contradicted");
  });

  it("invalidates only security gates whose governed paths changed after evidence", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    writeText(rootDir, path.join("lib", "public-distributed-rate-limit.ts"), "export const changed = true;\n");
    execFileSync("git", ["add", "lib/public-distributed-rate-limit.ts"], { cwd: rootDir, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "change governed security path"], { cwd: rootDir, stdio: "ignore" });

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "learning_export_renderer_security")?.state).toBe("proven");
    expect(audit.gates.find((gate) => gate.id === "public_generation_admission_security")?.state).toBe("notice");
    expect(audit.gates.find((gate) => gate.id === "mcp_generation_work_budget_security")?.state).toBe("notice");
    expect(audit.gates.find((gate) => gate.id === "security_followup_remediation")?.state).toBe("contradicted");
  });

  it("contradicts security resource remediation when remaining findings or exact Share boundaries are weakened", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "security-resource-remediation-2026-08-11", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as Record<string, unknown>;
    report.remainingBoundaries = {
      exactSavedShareVerdict: "PASS",
      providerDispatchPersistence: "APPROVAL_GATED",
      remainingScanFindings: 13,
    };
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "security_resource_remediation")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "security_resource_remediation")?.detail).toContain("remaining=13");
    expect(audit.gates.find((gate) => gate.id === "security_resource_remediation")?.detail).toContain("exactShare=PASS");
  });

  it("contradicts upstream transport remediation when provider probing or exact Share closure is claimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "security-upstream-transport-remediation-2026-08-11", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as Record<string, unknown>;
    report.liveChecks = {
      buildInfo: { status: "PASS", commitSha: "fixture-sha" },
      externalProviderProbe: { executed: true },
    };
    report.remainingBoundaries = {
      exactSavedShareVerdict: "PASS",
      providerDispatchPersistence: "APPROVAL_GATED",
      remainingScanFindings: 12,
      securityCompleteClaimAllowed: false,
    };
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "security_upstream_transport_remediation")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "security_upstream_transport_remediation")?.detail).toContain("providerProbe=true");
    expect(audit.gates.find((gate) => gate.id === "security_upstream_transport_remediation")?.detail).toContain("exactShare=PASS");
  });

  it("contradicts safety-reference surface remediation when a public body or exact Share closure is claimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "security-safety-reference-surface-remediation-2026-08-11", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as Record<string, unknown>;
    const liveChecks = report.liveChecks as Record<string, unknown>;
    liveChecks.publicSafetyReferenceSearch = {
      ...(liveChecks.publicSafetyReferenceSearch as Record<string, unknown>),
      bodyFieldCount: 1,
    };
    report.remainingBoundaries = {
      ...(report.remainingBoundaries as Record<string, unknown>),
      exactSavedShareVerdict: "PASS",
    };
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "security_safety_reference_surface_remediation")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "security_safety_reference_surface_remediation")?.detail).toContain("publicFields=1/0/0");
    expect(audit.gates.find((gate) => gate.id === "security_safety_reference_surface_remediation")?.detail).toContain("exactShare=PASS");
  });

  it("accepts the current public admission companion for older governed-path evidence", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    writeText(rootDir, path.join("app", "api", "ask", "route.ts"), "export const changed = true;\n");
    writeText(rootDir, path.join("app", "api", "weather", "route.ts"), "export const changed = true;\n");
    writeText(rootDir, path.join("lib", "public-distributed-rate-limit.ts"), "export const changed = true;\n");
    execFileSync("git", ["add", "app/api/ask/route.ts", "app/api/weather/route.ts", "lib/public-distributed-rate-limit.ts"], { cwd: rootDir, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "change governed admission paths"], { cwd: rootDir, stdio: "ignore" });
    const currentSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8" }).trim();
    const reportPath = path.join(rootDir, "evaluation", "public-provider-admission-2026-08-11", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      sourceHead: string;
      productionBuild: { commitSha: string };
      governedPathCompatibility: { sourceHead: string; productionCommit: string };
    };
    report.sourceHead = currentSha;
    report.productionBuild.commitSha = currentSha;
    report.governedPathCompatibility.sourceHead = currentSha;
    report.governedPathCompatibility.productionCommit = currentSha;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "security_followup_remediation")?.state).toBe("proven");
    expect(audit.gates.find((gate) => gate.id === "public_json_request_body_budget")?.state).toBe("proven");
    expect(audit.gates.find((gate) => gate.id === "improvement_photo_analysis_budget")?.state).toBe("notice");
    expect(audit.gates.find((gate) => gate.id === "public_provider_cancellation")?.state).toBe("notice");
    expect(audit.gates.find((gate) => gate.id === "public_provider_admission")?.state).toBe("notice");
  });

  it("accepts the current security compatibility baseline plus the governed agent-chat delta", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const baselineSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8" }).trim();
    writeText(rootDir, path.join("lib", "openclaw-broker-route.ts"), "export const distributed = true;\n");
    writeText(rootDir, path.join("tests", "claw-chat-route.test.ts"), "export const covered = true;\n");
    execFileSync("git", ["add", "lib/openclaw-broker-route.ts", "tests/claw-chat-route.test.ts"], { cwd: rootDir, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "change agent chat admission"], { cwd: rootDir, stdio: "ignore" });
    const currentSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8" }).trim();
    const reportPath = path.join(rootDir, "evaluation", "security-current-remediation-ledger-2026-08-13", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as Record<string, unknown>;
    report.sourceHead = currentSha;
    report.productionBuild = { commitSha: currentSha, branch: "master", environment: "production" };
    report.governedPathCompatibility = {
      verdict: "PASS_LIVE_DEPLOYED_SOURCE_CURRENT_SECURITY_GOVERNED_PATH_COMPATIBILITY",
      sourceHead: currentSha,
      productionCommit: currentSha,
      coveredGateIds: [
        "public_json_request_body_budget",
        "improvement_photo_analysis_budget",
        "public_provider_cancellation",
        "public_provider_admission",
        "public_generation_admission_security",
        "security_followup_remediation",
        "mcp_generation_work_budget_security",
      ],
      verification: {
        strategy: "baseline_plus_governed_delta",
        baseline: { sourceHead: baselineSha, files: 27, tests: 269, failed: 0, status: "PASS" },
        delta: {
          sourceHead: currentSha,
          changedProductPaths: ["lib/openclaw-broker-route.ts"],
          changedTestPaths: ["tests/claw-chat-route.test.ts"],
          files: 5,
          tests: 42,
          failed: 0,
          typecheck: "PASS",
          build: "PASS",
          status: "PASS",
        },
        status: "PASS",
      },
      originalSecurityBaselinesRewritten: false,
      noMutation: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    };
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "current_security_remediation_ledger")?.state).toBe("notice");
    expect(audit.gates.find((gate) => gate.id === "public_json_request_body_budget")?.state).toBe("proven");
    expect(audit.gates.find((gate) => gate.id === "public_provider_admission")?.state).toBe("notice");
  });

  it("keeps the current repository scan open and fails closed if saved Share is overclaimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-full-repository-security-scan-2026-08-13",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "current_repository_security_rescan");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("15 findings");
    expect(gate?.detail).toContain("10 findings");
    expect(gate?.detail).toContain("changed-knowledge review reset");
    expect(gate?.detail).toContain("authoritative dispatch receipt");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "current_repository_security_rescan")?.state)
      .toBe("contradicted");
  });

  it("connects the post-remediation scan without hiding its distributed and saved Share residuals", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const closurePath = path.join(
      rootDir,
      "evaluation",
      "post-remediation-security-source-closure-2026-08-14",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "post_remediation_repository_security_scan");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("20 findings");
    expect(gate?.detail).toContain("distributed-admission residual");
    expect(gate?.detail).toContain("18 findings");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const closure = JSON.parse(fs.readFileSync(closurePath, "utf8")) as {
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    closure.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(closurePath, `${JSON.stringify(closure, null, 2)}\n`, "utf8");

    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "post_remediation_repository_security_scan")?.state)
      .toBe("contradicted");
  });

  it("keeps owner Share revocation open for rescan and fails closed on exact Share overclaim", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "share-session-revocation-remediation-2026-08-14",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "share_session_revocation_security");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("owner-only");
    expect(gate?.detail).toContain("401");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      liveVerification: { destructiveRevokeProbeExecuted: boolean };
      mutationBoundary: { dbMutationPerformed: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.liveVerification.destructiveRevokeProbeExecuted = true;
    report.mutationBoundary.dbMutationPerformed = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "share_session_revocation_security")?.state)
      .toBe("contradicted");
  });

  it("keeps recipient contact verification open for rescan and fails closed on attribution overclaim", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "share-recipient-contact-verification-2026-08-14",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "share_recipient_contact_verification_security");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("full snapshotted phone or email");
    expect(gate?.detail).toContain("fresh rescan");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      sourceContract: { invitationWorkerIdAloneAcceptedForConfirmation: boolean; verificationValuePersisted: boolean };
      mutationBoundary: { dbMutationPerformed: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string; recipientAckLiveDataApproval: string };
    };
    report.sourceContract.invitationWorkerIdAloneAcceptedForConfirmation = true;
    report.sourceContract.verificationValuePersisted = true;
    report.mutationBoundary.dbMutationPerformed = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    report.remainingBoundaries.recipientAckLiveDataApproval = "PROVEN";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "share_recipient_contact_verification_security")?.state)
      .toBe("contradicted");
  });

  it("keeps atomic database race remediation approval-gated and rejects mutation overclaim", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "security-atomic-db-race-approval-boundary-2026-08-14",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "security_atomic_db_race_remediation");
    expect(gate?.state).toBe("approval_gated");
    expect(gate?.detail).toContain("Both sealed low findings remain open");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      findings: Array<{ currentSourceStillAffected: boolean }>;
      approvalRequest: { notApprovedOrPerformed: boolean };
      mutationBoundary: { migrationAuthored: boolean; dbMutationPerformed: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string; securityCompleteClaimAllowed: boolean };
    };
    report.findings[0].currentSourceStillAffected = false;
    report.approvalRequest.notApprovedOrPerformed = false;
    report.mutationBoundary.migrationAuthored = true;
    report.mutationBoundary.dbMutationPerformed = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    report.remainingBoundaries.securityCompleteClaimAllowed = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "security_atomic_db_race_remediation")?.state)
      .toBe("contradicted");
  });

  it("connects durable Agent Chat admission without hiding activation, rescan, or exact Share gaps", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "security-agent-chat-durable-admission-2026-08-14",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "agent_chat_durable_admission_security");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("fail-closed");
    expect(gate?.detail).toContain("immutable medium finding");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      liveProbe: { authenticatedFailClosedProbeExecuted: boolean };
      mutationBoundary: { providerGenerationExecuted: boolean };
      remainingBoundaries: {
        distributedProductionActivation: string;
        exactSavedShareVerdict: string;
      };
    };
    report.liveProbe.authenticatedFailClosedProbeExecuted = true;
    report.mutationBoundary.providerGenerationExecuted = true;
    report.remainingBoundaries.distributedProductionActivation = "DISTRIBUTED_ACTIVE";
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "agent_chat_durable_admission_security")?.state)
      .toBe("contradicted");
  });

  it("connects durable MCP provider admission without hiding activation, rescan, or exact Share gaps", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "security-mcp-provider-admission-2026-08-14",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "mcp_provider_admission_security");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("token-and-tenant-bound");
    expect(gate?.detail).toContain("fail-closed");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      liveProbe: { providerGenerationExecuted: boolean };
      remainingBoundaries: {
        distributedProductionActivation: string;
        exactSavedShareVerdict: string;
      };
    };
    report.liveProbe.providerGenerationExecuted = true;
    report.remainingBoundaries.distributedProductionActivation = "DISTRIBUTED_ACTIVE";
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "mcp_provider_admission_security")?.state)
      .toBe("contradicted");
  });

  it("uses durable MCP provider evidence as a fail-closed compatibility receipt for the earlier body budget", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "security-mcp-provider-admission-2026-08-14",
      "report.json",
    );
    const earlierPath = path.join(
      rootDir,
      "evaluation",
      "security-mcp-generation-work-budget-2026-08-04",
      "report.json",
    );
    const earlier = JSON.parse(fs.readFileSync(earlierPath, "utf8")) as {
      currentLiveRefresh: { verdict: string };
    };
    earlier.currentLiveRefresh.verdict = "STALE_REFRESH_FOR_COMPANION_TEST";
    fs.writeFileSync(earlierPath, `${JSON.stringify(earlier, null, 2)}\n`, "utf8");
    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((item) => item.id === "mcp_generation_work_budget_security")?.state)
      .toBe("notice");
    expect(audit.gates.find((item) => item.id === "mcp_generation_work_budget_security")?.detail)
      .toContain("94 adjacent MCP tests");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      contracts: { preservedBehavior: { existingTransportBodyAndAuthenticationBudgetsRetained: boolean } };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.contracts.preservedBehavior.existingTransportBodyAndAuthenticationBudgetsRetained = false;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "mcp_generation_work_budget_security")?.state)
      .toBe("contradicted");
  });

  it("uses the post-remediation receipt for older governed paths and fails closed if its boundaries weaken", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    writeText(rootDir, path.join("lib", "public-work-budget.ts"), "export const workflowDispatchLimit = 65536;\n");
    writeText(rootDir, path.join("lib", "work24.ts"), "export const boundedWork24 = true;\n");
    execFileSync("git", ["add", "lib/public-work-budget.ts", "lib/work24.ts"], { cwd: rootDir, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "apply post-remediation governed path changes"], { cwd: rootDir, stdio: "ignore" });
    const currentSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8" }).trim();
    const closurePath = path.join(
      rootDir,
      "evaluation",
      "post-remediation-security-source-closure-2026-08-14",
      "report.json",
    );
    const closure = JSON.parse(fs.readFileSync(closurePath, "utf8")) as {
      sourceHead: string;
      productionCommit: string;
      governedPathCompatibility: { noMutation: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    closure.sourceHead = currentSha;
    closure.productionCommit = currentSha;
    fs.writeFileSync(closurePath, `${JSON.stringify(closure, null, 2)}\n`, "utf8");

    const compatible = buildNorthstarOpenGateAudit({ rootDir });
    expect(compatible.gates.find((gate) => gate.id === "public_json_request_body_budget")?.state).toBe("proven");
    expect(compatible.gates.find((gate) => gate.id === "public_provider_admission")?.state).toBe("notice");
    expect(compatible.gates.find((gate) => gate.id === "security_followup_remediation")?.state).toBe("proven");

    closure.governedPathCompatibility.noMutation = false;
    closure.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(closurePath, `${JSON.stringify(closure, null, 2)}\n`, "utf8");

    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((gate) => gate.id === "public_json_request_body_budget")?.state).toBe("contradicted");
    expect(contradicted.gates.find((gate) => gate.id === "public_provider_admission")?.state).toBe("contradicted");
    expect(contradicted.gates.find((gate) => gate.id === "security_followup_remediation")?.state).toBe("contradicted");
  });

  it("fails older governed-path gates closed when the companion weakens boundaries", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    writeText(rootDir, path.join("app", "api", "ask", "route.ts"), "export const changed = true;\n");
    writeText(rootDir, path.join("app", "api", "weather", "route.ts"), "export const changed = true;\n");
    writeText(rootDir, path.join("lib", "public-distributed-rate-limit.ts"), "export const changed = true;\n");
    execFileSync("git", ["add", "app/api/ask/route.ts", "app/api/weather/route.ts", "lib/public-distributed-rate-limit.ts"], { cwd: rootDir, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "change governed admission paths"], { cwd: rootDir, stdio: "ignore" });
    const currentSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8" }).trim();
    const reportPath = path.join(rootDir, "evaluation", "public-provider-admission-2026-08-11", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      sourceHead: string;
      productionBuild: { commitSha: string };
      governedPathCompatibility: {
        sourceHead: string;
        productionCommit: string;
        exactSavedShareVerdict: string;
        originalSecurityBaselinesRewritten: boolean;
      };
    };
    report.sourceHead = currentSha;
    report.productionBuild.commitSha = currentSha;
    report.governedPathCompatibility.sourceHead = currentSha;
    report.governedPathCompatibility.productionCommit = currentSha;
    report.governedPathCompatibility.exactSavedShareVerdict = "PASS";
    report.governedPathCompatibility.originalSecurityBaselinesRewritten = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "security_followup_remediation")?.state).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "public_json_request_body_budget")?.state).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "improvement_photo_analysis_budget")?.state).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "public_provider_cancellation")?.state).toBe("contradicted");
  });

  it("keeps security follow-up non-closure boundaries fail-closed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "codex-security-followup-remediation-2026-08-11", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      deployment: { liveProviderCancellationProbeExecuted: boolean };
      boundaries: { exactSavedShareVerdict: string; originalBaselineRewritten: boolean };
    };
    report.deployment.liveProviderCancellationProbeExecuted = true;
    report.boundaries.exactSavedShareVerdict = "PASS";
    report.boundaries.originalBaselineRewritten = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "security_followup_remediation")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "security_followup_remediation")?.detail).toContain("liveProviderProbe=true");
    expect(audit.gates.find((gate) => gate.id === "security_followup_remediation")?.detail).toContain("baselineRewritten=true");
    expect(audit.gates.find((gate) => gate.id === "security_followup_remediation")?.detail).toContain("exactShare=PASS");
  });

  it("fails security follow-up closed when current governed-path compatibility is overstated", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "codex-security-followup-remediation-2026-08-11", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      currentPathCompatibility: {
        focusedVitest: { tests: number };
        exactSavedShareVerdict: string;
        originalBaselineRewritten: boolean;
      };
    };
    report.currentPathCompatibility.focusedVitest.tests = 146;
    report.currentPathCompatibility.exactSavedShareVerdict = "PASS";
    report.currentPathCompatibility.originalBaselineRewritten = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "security_followup_remediation")?.state).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "security_followup_remediation")?.detail).toContain("compatibilityPass=false");
  });

  it("keeps public JSON body-budget scan and exact Share boundaries fail-closed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "public-json-request-body-budget-2026-08-11", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remainingBoundaries: {
        exactSavedShareVerdict: string;
        securityCompleteClaimAllowed: boolean;
        followUpSecurityScan: string;
      };
    };
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    report.remainingBoundaries.securityCompleteClaimAllowed = true;
    report.remainingBoundaries.followUpSecurityScan = "NOT_REQUIRED";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "public_json_request_body_budget")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "public_json_request_body_budget")?.detail).toContain("followUp=NOT_REQUIRED");
    expect(audit.gates.find((gate) => gate.id === "public_json_request_body_budget")?.detail).toContain("securityComplete=true");
    expect(audit.gates.find((gate) => gate.id === "public_json_request_body_budget")?.detail).toContain("exactShare=PASS");
  });

  it("keeps photo admission distribution, rescan, and exact Share boundaries fail-closed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "improvement-photo-analysis-budget-2026-08-11", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      admission: { productionDistributedActivation: string };
      remainingBoundaries: {
        distributedProductionActivation: string;
        exactSavedShareVerdict: string;
        securityCompleteClaimAllowed: boolean;
        followUpSecurityScan: string;
      };
    };
    report.admission.productionDistributedActivation = "DISTRIBUTED_ACTIVE";
    report.remainingBoundaries.distributedProductionActivation = "DISTRIBUTED_ACTIVE";
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    report.remainingBoundaries.securityCompleteClaimAllowed = true;
    report.remainingBoundaries.followUpSecurityScan = "NOT_REQUIRED";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "improvement_photo_analysis_budget")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "improvement_photo_analysis_budget")?.detail).toContain("admission=DISTRIBUTED_ACTIVE");
    expect(audit.gates.find((gate) => gate.id === "improvement_photo_analysis_budget")?.detail).toContain("followUp=NOT_REQUIRED");
    expect(audit.gates.find((gate) => gate.id === "improvement_photo_analysis_budget")?.detail).toContain("exactShare=PASS");
  });

  it("keeps provider cancellation rescan and exact Share boundaries fail-closed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "public-provider-cancellation-2026-08-11", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      productionBuild: { liveProviderCallExecuted: boolean };
      remainingBoundaries: {
        exactSavedShareVerdict: string;
        securityCompleteClaimAllowed: boolean;
        followUpSecurityScan: string;
      };
    };
    report.productionBuild.liveProviderCallExecuted = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    report.remainingBoundaries.securityCompleteClaimAllowed = true;
    report.remainingBoundaries.followUpSecurityScan = "NOT_REQUIRED";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "public_provider_cancellation")?.state).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "public_provider_cancellation")?.detail).toContain("liveProviderCall=true");
    expect(audit.gates.find((gate) => gate.id === "public_provider_cancellation")?.detail).toContain("followUp=NOT_REQUIRED");
    expect(audit.gates.find((gate) => gate.id === "public_provider_cancellation")?.detail).toContain("exactShare=PASS");
  });

  it("keeps distributed provider admission and exact Share boundaries fail-closed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "public-provider-admission-2026-08-11", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remainingBoundaries: {
        distributedProductionActivation: string;
        exactSavedShareVerdict: string;
        securityCompleteClaimAllowed: boolean;
        followUpSecurityScan: string;
      };
    };
    report.remainingBoundaries.distributedProductionActivation = "DISTRIBUTED_ACTIVE";
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    report.remainingBoundaries.securityCompleteClaimAllowed = true;
    report.remainingBoundaries.followUpSecurityScan = "NOT_REQUIRED";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "public_provider_admission")?.state).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "public_provider_admission")?.detail).toContain("distributed=DISTRIBUTED_ACTIVE");
    expect(audit.gates.find((gate) => gate.id === "public_provider_admission")?.detail).toContain("followUp=NOT_REQUIRED");
    expect(audit.gates.find((gate) => gate.id === "public_provider_admission")?.detail).toContain("exactShare=PASS");
  });

  it("rejects a conflicting zero-finding scan when Northstar acceptance is claimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "repository-security-scan-reconciliation-2026-08-11", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      sameTargetConflict: { zeroFindingClaimAcceptedForNorthstar: boolean };
    };
    report.sameTargetConflict.zeroFindingClaimAcceptedForNorthstar = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "repository_security_scan_reconciliation")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "repository_security_scan_reconciliation")?.detail).toContain("zeroAccepted=true");
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

  it("fails product capability truth closed when scoped IA claims an exact saved session", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "product-capability-truth-2026-07-25", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      currentViewportIaEvidence: { exactSavedUserSessionReproduced: boolean };
    };
    report.currentViewportIaEvidence.exactSavedUserSessionReproduced = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-08-11T00:00:00.000Z",
    });

    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")?.detail).toContain("viewportIaPass=false");
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

  it("fails live route perception closed when the reported long page and mobile-like desktop share return", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "live-documents-share-route-perception-2026-08-14", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      measurement: { documents: Array<{ viewport: { width: number }; bodyHeight: number }>; workspaceShare: Array<{ viewport: { width: number }; distinctDesktopRegions?: number }> };
      interpretation: { reportedDocumentsBodyHeight2070Reproduced: boolean; reportedWorkspaceShareDesktopMobileCardReproduced: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string };
      mutationBoundary: { dbMutationPerformed: boolean };
    };
    const desktopDocument = report.measurement.documents.find((row) => row.viewport.width === 1440);
    const desktopShare = report.measurement.workspaceShare.find((row) => row.viewport.width === 1440);
    if (!desktopDocument || !desktopShare) throw new Error("route perception fixture rows missing");
    desktopDocument.bodyHeight = 2070;
    desktopShare.distinctDesktopRegions = 1;
    report.interpretation.reportedDocumentsBodyHeight2070Reproduced = true;
    report.interpretation.reportedWorkspaceShareDesktopMobileCardReproduced = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    report.mutationBoundary.dbMutationPerformed = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, generatedAt: "2026-08-14T00:00:00.000Z", sourceSha: "fixture-sha" });
    const gate = audit.gates.find((item) => item.id === "live_documents_share_route_perception");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.detail).toContain("documents=false");
    expect(gate?.detail).toContain("share=false");
    expect(gate?.detail).toContain("exactShare=PASS");
  });

  it("fails deployment freshness closed when the exact Share or mutation boundary is overclaimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "deployment-freshness-guard-2026-08-14", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      verification: { liveBrowser: { simulatedShaDrift: { refreshButtonVisible: boolean } } };
      remainingBoundaries: { exactSavedShareVerdict: string };
      mutationBoundary: { dbMutationPerformed: boolean };
    };
    report.verification.liveBrowser.simulatedShaDrift.refreshButtonVisible = false;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    report.mutationBoundary.dbMutationPerformed = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, generatedAt: "2026-08-14T00:00:00.000Z", sourceSha: "fixture-sha" });
    const gate = audit.gates.find((item) => item.id === "deployment_freshness_guard");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.detail).toContain("driftNotice=false");
    expect(gate?.detail).toContain("noMutation=false");
    expect(gate?.detail).toContain("exactShare=PASS");
  });

  it("contradicts the UI gate when one document stacks two authoring cockpits", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const geometryPath = path.join(rootDir, "evaluation", "document-all-authoring-geometry-2026-08-02", "after-live", "report.json");
    const geometry = JSON.parse(fs.readFileSync(geometryPath, "utf8")) as {
      results: Array<{ documentKey: string; metrics: { visibleCockpitCount: number } }>;
    };
    const briefing = geometry.results.find((row) => row.documentKey === "foreignWorkerBriefing");
    if (!briefing) throw new Error("foreignWorkerBriefing fixture missing");
    briefing.metrics.visibleCockpitCount = 2;
    fs.writeFileSync(geometryPath, `${JSON.stringify(geometry, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const gate = audit.gates.find((item) => item.id === "ui_documents_share_cockpit");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.evidencePath).toBe(path.join("evaluation", "document-all-authoring-geometry-2026-08-02", "after-live", "report.json"));
    expect(gate?.detail).toContain("48/48 all-document selected-authoring and raw-source containment");
  });

  it("contradicts the UI gate when a desktop workspace step status overflows its button", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "share-desktop-perception-2026-07-22", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      results: Array<{ route: string; viewport: { width: number }; metrics: { workspaceStepStatusOverflowCount: number } }>;
    };
    const desktop = report.results.find((row) => row.route === "/workspace share step" && row.viewport.width === 1440);
    if (!desktop) throw new Error("Workspace desktop fixture missing");
    desktop.metrics.workspaceStepStatusOverflowCount = 1;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-08-12T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const gate = audit.gates.find((item) => item.id === "ui_documents_share_cockpit");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.evidencePath).toBe(path.join("evaluation", "share-desktop-perception-2026-07-22", "report.json"));
  });

  it("contradicts the UI gate when a document action loses the 32px pane margin", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const geometryPath = path.join(rootDir, "evaluation", "document-all-authoring-geometry-2026-08-02", "after-live", "report.json");
    const geometry = JSON.parse(fs.readFileSync(geometryPath, "utf8")) as {
      results: Array<{ documentKey: string; metrics: { shellBottom: number; firstActionBottom: number } }>;
    };
    const briefing = geometry.results.find((row) => row.documentKey === "tbmBriefing");
    if (!briefing) throw new Error("tbmBriefing fixture missing");
    briefing.metrics.firstActionBottom = briefing.metrics.shellBottom - 31;
    fs.writeFileSync(geometryPath, `${JSON.stringify(geometry, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-08-12T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const gate = audit.gates.find((item) => item.id === "ui_documents_share_cockpit");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.evidencePath).toBe(path.join("evaluation", "document-all-authoring-geometry-2026-08-02", "after-live", "report.json"));
  });

  it("fails public generation admission security closed when exact Share is overclaimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "security-public-generation-admission-2026-08-04", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-08-04T00:00:00.000Z",
    });

    expect(audit.gates.find((gate) => gate.id === "public_generation_admission_security")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "public_generation_admission_security")?.detail).toContain("exactShare=PASS");
  });

  it("fails public generation admission security closed when the current refresh claims provider work", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "security-public-generation-admission-2026-08-04", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      currentLiveRefresh: { liveChecks: Array<{ providerCallPerformed: boolean }> };
    };
    report.currentLiveRefresh.liveChecks[0].providerCallPerformed = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-08-11T00:00:00.000Z",
    });

    expect(audit.gates.find((gate) => gate.id === "public_generation_admission_security")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "public_generation_admission_security")?.detail).toContain("currentRefresh=false");
  });

  it("fails MCP generation security closed when the current refresh claims tool dispatch", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "security-mcp-generation-work-budget-2026-08-04", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      currentLiveRefresh: { probe: { mcpToolDispatchPerformed: boolean } };
    };
    report.currentLiveRefresh.probe.mcpToolDispatchPerformed = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-08-11T00:00:00.000Z",
    });

    expect(audit.gates.find((gate) => gate.id === "mcp_generation_work_budget_security")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "mcp_generation_work_budget_security")?.detail).toContain("currentRefresh=false");
  });

  it("contradicts the UI gate when a document action loses its inner-pane margin", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const geometryPath = path.join(rootDir, "evaluation", "document-authoring-pane-margin-2026-08-02", "report.json");
    const geometry = JSON.parse(fs.readFileSync(geometryPath, "utf8")) as {
      afterLive: { paneMarginBelow16Count: number; minimumPaneMargin: number };
    };
    geometry.afterLive.paneMarginBelow16Count = 1;
    geometry.afterLive.minimumPaneMargin = 15;
    fs.writeFileSync(geometryPath, `${JSON.stringify(geometry, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const gate = audit.gates.find((item) => item.id === "ui_documents_share_cockpit");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.evidencePath).toBe(path.join("evaluation", "document-authoring-pane-margin-2026-08-02", "report.json"));
    expect(gate?.detail).toContain("48/48 all-document selected-authoring and raw-source containment");
  });

  it("contradicts the UI gate when a raw source editor escapes its bounded viewport", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const geometryPath = path.join(rootDir, "evaluation", "document-raw-drilldown-geometry-2026-08-02", "after-live", "report.json");
    const geometry = JSON.parse(fs.readFileSync(geometryPath, "utf8")) as {
      results: Array<{ metrics: { sourceBottom: number } }>;
    };
    geometry.results[0].metrics.sourceBottom = 724;
    fs.writeFileSync(geometryPath, `${JSON.stringify(geometry, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const gate = audit.gates.find((item) => item.id === "ui_documents_share_cockpit");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.evidencePath).toBe(path.join("evaluation", "document-raw-drilldown-geometry-2026-08-02", "after-live", "report.json"));
    expect(gate?.detail).toContain("48/48 all-document selected-authoring and raw-source containment");
  });

  it("contradicts the UI gate when risk-row labels repeat", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const geometryPath = path.join(rootDir, "evaluation", "document-risk-row-navigation-2026-08-02", "after-live", "report.json");
    const geometry = JSON.parse(fs.readFileSync(geometryPath, "utf8")) as {
      results: Array<{ metrics: { uniqueVisibleLabelCount: number } }>;
    };
    geometry.results[0].metrics.uniqueVisibleLabelCount = 2;
    fs.writeFileSync(geometryPath, `${JSON.stringify(geometry, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const gate = audit.gates.find((item) => item.id === "ui_documents_share_cockpit");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.evidencePath).toBe(path.join("evaluation", "document-risk-row-navigation-2026-08-02", "after-live", "report.json"));
    expect(gate?.detail).toContain("distinct hazard-first risk-row navigation");
  });

  it("contradicts the UI gate when mobile risk-row navigation follows the active editor", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const geometryPath = path.join(rootDir, "evaluation", "document-risk-row-mobile-order-2026-08-02", "after-live", "report.json");
    const geometry = JSON.parse(fs.readFileSync(geometryPath, "utf8")) as {
      results: Array<{ label: string; metrics: { tabsBeforePanel: boolean; tabsBottom: number; panelTop: number } }>;
    };
    const mobile = geometry.results.find((row) => row.label === "mobile-short-390x723");
    if (!mobile) throw new Error("Missing mobile risk-row order fixture");
    mobile.metrics.tabsBeforePanel = false;
    mobile.metrics.tabsBottom = 751;
    mobile.metrics.panelTop = 542;
    fs.writeFileSync(geometryPath, `${JSON.stringify(geometry, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const gate = audit.gates.find((item) => item.id === "ui_documents_share_cockpit");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.evidencePath).toBe(path.join("evaluation", "document-risk-row-mobile-order-2026-08-02", "after-live", "report.json"));
    expect(gate?.detail).toContain("selector-before-editor mobile risk-row order");
  });

  it("contradicts the UI gate when a mobile risk-row label is clipped", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const geometryPath = path.join(rootDir, "evaluation", "document-risk-row-mobile-label-2026-08-02", "after-live", "report.json");
    const geometry = JSON.parse(fs.readFileSync(geometryPath, "utf8")) as {
      results: Array<{ label: string; metrics: { selectorMetrics: Array<{ compactClipped: boolean }> } }>;
    };
    const mobile = geometry.results.find((row) => row.label === "mobile-short-390x723");
    if (!mobile) throw new Error("Missing mobile risk-row label fixture");
    mobile.metrics.selectorMetrics[0].compactClipped = true;
    fs.writeFileSync(geometryPath, `${JSON.stringify(geometry, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const gate = audit.gates.find((item) => item.id === "ui_documents_share_cockpit");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.evidencePath).toBe(path.join("evaluation", "document-risk-row-mobile-label-2026-08-02", "after-live", "report.json"));
    expect(gate?.detail).toContain("distinct unclipped mobile risk-row labels");
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
  }, 15_000);

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
  }, 15_000);

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
