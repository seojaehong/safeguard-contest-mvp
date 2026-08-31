import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const temporaryPaths = new Set<string>();

function createTemporaryDirectory(prefix: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryPaths.add(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryPaths) {
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
  temporaryPaths.clear();
});

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
  const moduleDir = createTemporaryDirectory("safeclaw-northstar-module-");
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

function documentEditorialReviewCockpitFixture(): Record<string, unknown> {
  const results = [
    { theme: "day", width: 1440, height: 723, workbenchColumns: 3 },
    { theme: "night", width: 1440, height: 723, workbenchColumns: 3 },
    { theme: "day", width: 390, height: 723, workbenchColumns: 1 },
    { theme: "night", width: 390, height: 723, workbenchColumns: 1 },
  ].map(({ theme, width, height, workbenchColumns }) => ({
    theme,
    width,
    height,
    beforeCompletion: {
      viewportHeight: height,
      bodyHeight: height,
      workbenchColumns,
      reviewDocumentCount: 12,
      uniqueDocumentCount: 12,
      includesRiskAssessment: true,
      checkboxCount: 5,
      horizontalOverflow: false,
      storageStatus: "empty",
    },
    afterCompletion: {
      currentWorkpackUnchanged: true,
      reviewerStorageKeyCount: 1,
      storageStatus: "saved",
      apiRequestCount: 0,
      dialogScrollTop: 0,
    },
    afterReload: {
      storageStatus: "restored",
      reviewerInputValue: "자동 검증 검토자",
      persistedReviewer: "자동 검증 검토자",
    },
    accessibility: {
      initialFocusLabel: "문서 사람 검토 닫기",
      initialFocusIsCloseButton: true,
      initialFocusInsideDialog: true,
      describedBy: "document-editorial-review-description",
      liveProgress: "polite",
      tablistOrientation: "vertical",
      tabCount: 12,
      selectedTabCount: 1,
      tabbableTabCount: 1,
      arrowNavigationPass: true,
      homeNavigationPass: true,
      tabpanelLinked: true,
      dialogClosedOnEscape: true,
      escapeRestoresLaunchFocus: true,
    },
    verdict: "PASS",
  }));

  return {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_EDITORIAL_REVIEW_COCKPIT",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", environment: "production" },
    sourceHeadMatchesProduction: true,
    total: 4,
    pass: 4,
    fail: 0,
    storageFailureProbePass: true,
    storageFailureProbe: {
      verdict: "PASS",
      status: "error",
      visible: true,
      message: "브라우저 저장소 오류로 검토 기록을 복원하거나 저장할 수 없습니다.",
    },
    acceptanceContract: {
      canonicalDocumentCount: 12,
      includesRiskAssessment: true,
      reviewerCheckCount: 5,
      desktopZones: 3,
      mobileColumns: 1,
      bodyHeightUnchangedWhileOpen: true,
      longCopyContained: true,
      reviewStateStoredSeparately: true,
      reviewerHydrationDoesNotOverwriteStorage: true,
      storageLifecycleVisible: true,
      storageFailureVisible: true,
      editedTextInvalidatesCompletion: true,
      automaticReviewCannotClaimHumanCompletion: true,
      keyboardRovingTabNavigation: true,
      screenReaderTabPanelContract: true,
      escapeRestoresLaunchFocus: true,
    },
    reviewBoundary: {
      automatedInteractionOnly: true,
      humanReviewCompleted: false,
      localCompletionIsApproval: false,
      broadHumanWordingReviewRequired: true,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorRuntimeCalled: false,
      wikiPublished: false,
      koshaRegistryMutationPerformed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
    results,
  };
}

function freshCurrentSourceSecurityScanFixture(): Record<string, unknown> {
  return {
    verdict: "NOTICE_CURRENT_SOURCE_STANDARD_SCAN_14_FINDINGS_PARTIAL_COVERAGE",
    scanId: "a4044172-9b4b-4e36-84be-a8955d9150ac",
    sourceHead: "121c8a017c18b58874ef965cece12bc3e0f0df2f",
    deployedProductSource: "121c8a017c18b58874ef965cece12bc3e0f0df2f",
    scan: {
      status: "completed",
      mode: "standard",
      targetKind: "git_revision",
      coverageCompleteness: "partial",
      trackedFileCount: 6981,
      reviewWorklistCount: 5,
      closedReviewWorklistCount: 5,
      reviewedSurfaceCount: 21,
      deferredCoverageItemCount: 22,
      reportableFindingCount: 14,
      uniqueFindingWriteupCount: 14,
      severity: { critical: 0, high: 0, medium: 10, low: 4 },
    },
    baseline: { immutableOriginalFindingCount: 18, preserved: true, rewritten: false },
    currentDisposition: {
      approvalGatedDatabaseOrAtomicityCount: 7,
      approvalSensitiveShareCapabilityCount: 0,
      approvalFreeProductSourceResidualCount: 7,
      fullyClosedBoundedSourceCandidateCount: 0,
      securityCompleteClaimAllowed: false,
    },
    postScanRemediation: {
      browserSessionBindingProductCommit: "e36356d84fa8ac2331f8d0b81229d0532024a876",
      browserSessionBindingVerdict: "PASS_LIVE_DEPLOYED_SOURCE_BROWSER_SESSION_BINDING_RESCAN_PENDING",
      browserSessionBindingProductionCommit: "77bcd6ea4ec1ea1914126dd7ba924f788b972602",
      providerOutputBudgetProductCommit: "e99346797f4d874e83188d8f37941a603a272a6d",
      providerOutputBudgetEvidenceCommit: "18a9fc1a",
      providerOutputBudgetVerdict: "PASS_LIVE_DEPLOYED_SOURCE_PUBLIC_PROVIDER_OUTPUT_BUDGET_RESCAN_PENDING",
      providerOutputBudgetProductionCommit: "18a9fc1a7f9a549d73474d5fb881268bb69404d9",
      scanFindingReclassified: false,
      remainingApprovalFreeFindingCount: 5,
    },
    canonicalArtifacts: {
      manifest: "evaluation/current-source-standard-security-scan-2026-08-31-121c8a01-complete/canonical/scan-manifest.json",
      findings: "evaluation/current-source-standard-security-scan-2026-08-31-121c8a01-complete/canonical/findings.json",
      coverage: "evaluation/current-source-standard-security-scan-2026-08-31-121c8a01-complete/canonical/coverage.json",
      markdown: "evaluation/current-source-standard-security-scan-2026-08-31-121c8a01-complete/scan-report.md",
      findingWriteupCount: 14,
      supportingEvidenceCount: 14,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      embeddingGenerated: false,
      vectorUploadPerformed: false,
      wikiPublished: false,
      exactTrustRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      databaseSecurityRemediation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
      llmWikiPublication: "APPROVAL_GATED",
      sifVectorRuntime: "APPROVAL_GATED",
      koshaExactRegistryPromotion: "APPROVAL_GATED",
      freshFullRepositoryScanCompleted: true,
      securityCompleteClaimAllowed: false,
    },
  };
}

function completedCurrentHeadStandardSecurityScanFixture(hashes: Record<string, string>): Record<string, unknown> {
  const root = "evaluation/current-head-standard-security-scan-2026-08-31-9504d8db-complete";
  return {
    verdict: "NOTICE_CURRENT_HEAD_STANDARD_SCAN_21_FINDINGS_PARTIAL_COVERAGE",
    scanId: "f6bef30a-7250-428b-9f66-0bad1e42058c",
    sourceHead: "9504d8db95fcbc9f37f6c5abc638e9ad0813a325",
    userContextPreserved: true,
    scan: {
      status: "completed", mode: "standard", targetKind: "git_revision", coverageCompleteness: "partial",
      trackedFileCount: 6881, reviewWorklistCount: 6, closedReviewWorklistCount: 6,
      recordedSurfaceCount: 25, deferredCoverageItemCount: 36, reportableFindingCount: 21,
      uniqueFindingWriteupCount: 21, severity: { critical: 0, high: 0, medium: 7, low: 14 },
    },
    baseline: {
      immutableOriginalFindingCount: 18, preserved: true, rewritten: false,
      completedPriorScanId: "8fe9c06a-018c-446f-aa98-1b37df95287a",
    },
    currentDisposition: {
      approvalGatedDatabaseOrAtomicityCount: 9, approvalSensitiveShareCapabilityCount: 1,
      approvalFreeProductSourceResidualCount: 11, securityCompleteClaimAllowed: false,
    },
    canonicalArtifacts: {
      manifest: `${root}/canonical/scan-manifest.json`, findings: `${root}/canonical/findings.json`,
      coverage: `${root}/canonical/coverage.json`, markdown: `${root}/scan-report.md`,
      findingWriteupCount: 21, supportingEvidenceCount: 21, sha256: hashes,
    },
    mutationBoundary: {
      dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false,
      embeddingGenerated: false, vectorUploadPerformed: false, wikiPublished: false,
      exactTrustRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE", databaseSecurityRemediation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED", llmWikiPublication: "APPROVAL_GATED",
      sifVectorRuntime: "APPROVAL_GATED", koshaExactRegistryPromotion: "APPROVAL_GATED",
      coverageClosureCompleted: false, approvalFreeCurrentSourceRemediation: "OPEN_11_FINDINGS",
      securityCompleteClaimAllowed: false,
    },
  };
}

function currentSourceForwardedIdentityRemediationFixture(): Record<string, unknown> {
  return {
    verdict: "PASS_LIVE_PRODUCTION_SOURCE_INCLUDED_VERIFIED_DISTRIBUTED_ADMISSION_IDENTITY",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    sourceIncludedInProduction: true,
    securityBaseline: {
      scanId: "f6bef30a-7250-428b-9f66-0bad1e42058c",
      findingRule: "rate-limit-bypass.untrusted-forwarded-identity",
      immutableFindingCount: 21,
      findingReclassified: false,
    },
    remediation: {
      trustedVercelIngressRequires: ["NODE_ENV=production", "VERCEL=1", "VERCEL_ENV=production"],
      unverifiedForwardedIdentity: "CONSERVATIVE_UNKNOWN_BUCKET",
      injectedEnvironmentUsedForIdentity: true,
      rawClientIpStoredInDistributedKey: false,
    },
    verification: {
      focusedAndAdjacent: { files: 7, tests: 44, status: "PASS" },
      typecheck: "PASS",
      liveBehavioralProbeExecuted: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      embeddingGenerated: false,
      vectorUploadPerformed: false,
      wikiPublished: false,
      exactTrustRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      liveDeploymentVerification: "SOURCE_INCLUDED_NO_IDENTITY_KEY_DISCLOSURE",
      freshFollowUpSecurityScan: "REQUIRED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      databaseSecurityRemediation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
      llmWikiPublication: "APPROVAL_GATED",
      sifVectorRuntime: "APPROVAL_GATED",
      koshaExactRegistryPromotion: "APPROVAL_GATED",
      securityCompleteClaimAllowed: false,
    },
  };
}

function currentSourceTemplateInventoryRemediationFixture(): Record<string, unknown> {
  return {
    verdict: "PASS_LIVE_PRODUCTION_SOURCE_INCLUDED_BOUNDED_TEMPLATE_INVENTORY_SCAN",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    sourceIncludedInProduction: true,
    securityBaseline: {
      scanId: "f6bef30a-7250-428b-9f66-0bad1e42058c",
      findingId: "csf_4ee29cf0d24bdba57c1518a1",
      findingRule: "resource-exhaustion.unbounded-template-inventory",
      severity: "medium",
      immutableFindingCount: 21,
      findingReclassified: false,
    },
    remediation: {
      noFollowTraversal: true, sourceRootSymlinkRejected: true,
      maxFiles: 10000, maxTotalBytes: 4294967296, maxFileBytes: 134217728,
      maxParserFiles: 2000, maxElapsedSeconds: 900, maxImagePixels: 80000000,
      structuredArchivePreflightBeforeParser: true, maxArchiveMembers: 4096,
      maxArchiveMemberBytes: 67108864, maxArchiveTotalUncompressedBytes: 536870912,
      maxArchiveCompressionRatio: 100, maxArchiveCentralDirectoryBytes: 16777216,
      budgetFailureExitCode: 2, partialOutputWrittenOnAdmissionFailure: false,
      limitsRecordedInSummary: true,
    },
    verification: {
      scannerUnitTests: { tests: 6, status: "PASS" },
      archiveSafetyTests: { tests: 5, status: "PASS" },
      pythonCompile: { status: "PASS" },
      cliSuccessAndFailClosedContract: "PASS",
      liveBehavioralProbeExecuted: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false,
      embeddingGenerated: false, vectorUploadPerformed: false, wikiPublished: false,
      exactTrustRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      liveDeploymentVerification: "SOURCE_INCLUDED_OPERATOR_SCRIPT_NOT_REMOTELY_EXECUTED",
      freshFollowUpSecurityScan: "REQUIRED", exactSavedShareVerdict: "MISSING_EVIDENCE",
      databaseSecurityRemediation: "APPROVAL_GATED", providerDispatchPersistence: "APPROVAL_GATED",
      llmWikiPublication: "APPROVAL_GATED", sifVectorRuntime: "APPROVAL_GATED",
      koshaExactRegistryPromotion: "APPROVAL_GATED", securityCompleteClaimAllowed: false,
    },
  };
}

function currentSourceApprovalFreeSecurityRemediationFixture(): Record<string, unknown> {
  return {
    schemaVersion: "safeclaw-current-source-security-approval-free-remediation/v1",
    verdict: "PASS_LIVE_PRODUCTION_FOUR_APPROVAL_FREE_SECURITY_REMEDIATIONS_RESCAN_PENDING",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    scannedBaseline: {
      scanId: "8d7fd844-d4cb-49ab-b984-36ed6ab0beba",
      reportableFindingCount: 9,
      approvalFreeFindingCount: 4,
      approvalGatedFindingCount: 5,
      immutableOriginalBaselinePreserved: true,
    },
    remediation: {
      currentSourceRemediatedCount: 4,
      currentSourceOpenApprovalFreeCount: 0,
      scanFindingReclassificationPerformed: false,
    },
    receipts: [
      ["structured-xlsx-render-budget", "evaluation/security-structured-xlsx-render-budget-2026-08-31/report.json"],
      ["operator-document-parser-admission", "evaluation/security-operator-parser-admission-2026-08-31/report.json"],
      ["orchestration-smoke-csv-neutralization", "evaluation/security-orchestration-smoke-csv-neutralization-2026-08-31/report.json"],
      ["hwpx-anonymization-archive-budget", "evaluation/security-hwpx-anonymization-archive-2026-08-31/report.json"],
    ].map(([id, evidencePath]) => ({ id, evidencePath, verdict: "PASS_FIXTURE" })),
    boundaries: {
      freshFullRepositoryRescanRequired: true,
      securityCompleteClaimAllowed: false,
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      embeddingOrVectorMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      databaseSecurityRemediation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
      llmWikiPublication: "APPROVAL_GATED",
      sifVectorRuntime: "APPROVAL_GATED",
      koshaExactRegistryPromotion: "APPROVAL_GATED",
    },
  };
}

function currentSourceSecurityResourceBudgetRemediationFixture(): Record<string, unknown> {
  return {
    schemaVersion: "safeclaw-security-resource-budget-remediation/v1",
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_APPROVAL_FREE_SECURITY_RESOURCE_BUDGETS_DIRECT_PROBE_ADMISSION_BLOCKED",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    source: {
      evidenceCommit: "fixture-sha",
      productionCommitAtVerification: "fixture-sha",
      sourceHeadMatchesProduction: true,
      liveAfterDeploymentRequired: false,
    },
    securityBaseline: {
      scanId: "76e79aa5-1391-4014-8671-ead3c48b6ee9",
      canonicalArtifactsPresent: true,
      canonicalFindingCount: 10,
      canonicalSeverityCounts: { medium: 5, low: 5 },
      manifestStatus: "failed",
      immutableOriginalFindingBaselineCount: 18,
      originalBaselinePreserved: true,
    },
    remediatedFindings: [
      "csf_189f90e7a24ec6708057ff03",
      "csf_f026a78c7fde954e6de62b35",
      "csf_54bf3910ec279d5af8646218",
      "csf_8f5647dae8aa76ce7a7fb396",
      "csf_5b39903c1c8d110acb501e38",
    ].map((findingId) => ({ findingId, status: "current_source_verified" })),
    verification: {
      python: { passed: 159, failed: 0 },
      typescriptResourceRegression: { passed: 174, failed: 0 },
      documentsShareUiRegression: { passed: 60, failed: 0 },
      typecheck: "PASS",
      productionBuild: { verdict: "PASS", staticPages: 28 },
    },
    liveChecks: {
      ontologyGraph: { status: 503, code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", providerOrSupabaseGraphReadReached: false },
      learningExportUnauthenticated: { status: 401 },
      mcpProviderFanoutExecuted: false,
      directLiveBudgetExecutionProven: false,
    },
    remainingApprovalGatedFindings: Array.from({ length: 5 }, (_, index) => `approval-${index + 1}`),
    boundaries: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaExactRegistryMutationPerformed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      approvalGatedFindingsClosed: false,
    },
  };
}

function currentSourceLogoutStorageRemediationFixture(): Record<string, unknown> {
  return {
    schemaVersion: "safeclaw-current-source-security-logout-storage-remediation/v1",
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_LOGOUT_USER_CONTENT_PURGE_CONTRACT",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommitAtVerification: "fixture-sha",
    finding: {
      findingId: "csf_939ccf5e3f2f0fa1963be3e5",
      occurrenceId: "occ_26f3ceb91a01b89d9502da8d",
      ruleId: "client-data.persistent-logout-retention",
      sealedFindingReclassified: false,
      freshRescanRequired: true,
    },
    remediation: {
      explicitLogoutPaths: ["components/AdminLoginPanel.tsx", "components/FieldOperationsWorkspace.tsx"],
      authEvent: "SIGNED_OUT",
      workspaceAutoSaveRepopulationPreventedBy: "navigate_to_login_after_cleanup",
      clearedExactKeys: ["safeclaw.currentWorkpack.v1", "safeclaw.operationImprovements.v1"],
      clearedPrefixes: [
        "safeclaw-workpack:",
        "safeclaw.documentEditorialReview.v1:",
        "safeclaw.documentEditorialReviewReviewer.v1:",
      ],
      preservedPreferenceKeys: ["safeclaw.moduleTheme", "safeclaw.aiMode"],
      cleanupFailureReported: true,
      supabaseSignOutFailureStillAttemptsLocalCleanup: true,
    },
    verification: {
      focusedAndAdjacentTests: { filesPassed: 5, testsPassed: 100, testsFailed: 0 },
      typecheck: { status: "PASS" },
      productionBuild: { status: "PASS", staticPages: 28 },
      frontendStaticAudit: { status: "pass", pageFiles: 33, componentFiles: 24, coverageIssues: 0, violationCount: 0 },
      liveDeployment: {
        vercelStatus: "success",
        commitSha: "fixture-sha",
        branch: "master",
        environment: "production",
        behavioralLogoutExecuted: false,
      },
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
      immutableOriginalBaselinePreserved: true,
      sealedCurrentHeadScanPreserved: true,
      securityComplete: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      approvalGatedFindingsRemainOpen: true,
      liveAfterDeploymentRequired: false,
    },
  };
}

function currentSourceOntologyErrorProjectionRemediationFixture(): Record<string, unknown> {
  return {
    schemaVersion: "safeclaw-current-source-security-ontology-error-projection-remediation/v1",
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_ONTOLOGY_ERROR_PROJECTION_CONTRACT",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    productionCommitAtVerification: "fixture-sha",
    finding: {
      findingId: "csf_74a68abc8d7370ed1b78fad3",
      occurrenceId: "occ_51adcb8d80b56ecdf1de9fb2",
      ruleId: "information-exposure.public-ontology-error-projection",
      sealedFindingReclassified: false,
      freshRescanRequired: true,
    },
    remediation: {
      publicErrorCodes: ["ONTOLOGY_GRAPH_BUDGET_EXCEEDED", "ONTOLOGY_GRAPH_UPSTREAM_UNAVAILABLE"],
      correlationIdGenerated: true,
      upstreamResponseBodyReturnedPublicly: false,
      upstreamResponseBodyLogged: false,
      unknownExceptionMessageLogged: false,
      diagnosticMessageMaxCharacters: 512,
      callerAbortPropagationPreserved: true,
      successOutputBudgetPreserved: true,
    },
    verification: {
      focusedAndAdjacentTests: { filesPassed: 3, testsPassed: 12, testsFailed: 0 },
      typecheck: { status: "PASS" },
      productionBuild: { status: "PASS", staticPages: 28 },
      liveDeployment: {
        status: "PASS_DEPLOYED_SOURCE_AND_PUBLIC_ADMISSION_BOUNDARY",
        commitSha: "fixture-sha",
        branch: "master",
        environment: "production",
        publicProbe: {
          path: "/api/ontology/graph",
          status: 503,
          code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
          upstreamReadReached: false,
          internalBodyExposed: false,
        },
        upstreamFailureInduced: false,
      },
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
      immutableOriginalBaselinePreserved: true,
      sealedCurrentHeadScanPreserved: true,
      securityComplete: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      approvalGatedFindingsRemainOpen: true,
      liveAfterDeploymentRequired: false,
    },
  };
}

function currentSourceRawErrorProjectionRemediationFixture(): Record<string, unknown> {
  return {
    schemaVersion: "safeclaw-current-source-security-raw-error-projection-remediation/v1",
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_RAW_ERROR_PROJECTION_CONTRACT",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    sourceIncludedInProduction: true,
    finding: {
      findingId: "csf_7aef114e48b74b34b829e893",
      occurrenceId: "occ_fe4f32e7d3d3cdce89f794db",
      ruleId: "information-exposure.raw-error-projection",
      sealedFindingReclassified: false,
      freshRescanRequired: true,
    },
    remediation: {
      stablePublicErrorCodes: ["KNOWLEDGE_MATCH_FAILED", "KNOWLEDGE_INGEST_PERSISTENCE_FAILED", "WORKFLOW_PROVIDER_FAILED", "BRIEFING_GENERATION_FAILED", "PHOTO_ANALYSIS_FAILED"],
      correlationIdGenerated: true,
      rawExceptionMessageReturnedPublicly: false,
      rawDatabaseErrorReturnedPublicly: false,
      failedWebhookResponseBodyReturnedOrThrown: false,
      successfulWebhookResponseAllowlisted: true,
      photoProviderAndHarnessErrorsReturnedPublicly: false,
      invalidPhotoSignatureIoDetailReturnedPublicly: false,
      callerCancellationPreserved: true,
    },
    verification: {
      focusedSecurityTests: { filesPassed: 5, testsPassed: 93, testsFailed: 0 },
      adjacentRegressionTests: { filesPassed: 6, testsPassed: 122, testsFailed: 0 },
      typecheck: { status: "PASS" },
      productionBuild: { status: "PASS", staticPages: 28 },
      liveDeployment: {
        status: "PASS_DEPLOYED_SOURCE_AND_READ_ONLY_PUBLIC_BOUNDARIES",
        commitSha: "fixture-sha",
        branch: "master",
        environment: "production",
        readOnlyProbes: [
          { path: "/api/knowledge/match", status: 200, internalErrorDetailExposed: false },
          { path: "/api/input-photos/hazard-analysis", status: 200, internalErrorDetailExposed: false },
          { path: "/api/workflow/dispatch", status: 200, providerCalled: false },
          { path: "/api/briefing/run", status: 401, internalErrorDetailExposed: false },
        ],
        liveFailureInduced: false,
      },
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
      immutableOriginal18FindingBaselinePreserved: true,
      sealedCurrentHeadScanPreserved: true,
      securityComplete: false,
      freshFollowUpSecurityScan: "REQUIRED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      approvalGatedFindingsRemainOpen: true,
      liveAfterDeploymentRequired: false,
    },
  };
}

function currentSourceCredentialOutputRemediationFixture(): Record<string, unknown> {
  return {
    schemaVersion: "safeclaw-current-source-security-credential-output-remediation/v1",
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_CREDENTIAL_OUTPUT_CONTRACT",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    sourceIncludedInProduction: true,
    masterContainsProductCommit: true,
    finding: { findingId: "csf_ad5c841841dbdcc55b2c1d5a", occurrenceId: "occ_a537b254313fd0a608524cc5", ruleId: "credential-exposure.token-stdout", sealedFindingReclassified: false, freshRescanRequired: true },
    remediation: {
      credentialCliCount: 2,
      credentialClis: ["scripts/issue-mcp-token.mjs", "scripts/issue_supabase_auth_token.mjs"],
      explicitOutputModeRequiredBeforeCredentialWork: true,
      defaultBearerTokenStdout: false,
      interactiveRevealRequiresTty: true,
      automationOutputUsesExclusiveCreate: true,
      automationOutputMode: "0600",
      writtenModeVerified: true,
      preExistingOutputFileRejected: true,
      windowsUnverifiableFileModeRejected: true,
      tier1AutomationUsesTemporaryDirectoryMode: "0700",
      tier1AutomationDeletesTemporaryCredential: true,
      tier1AutomationCleanupTrapInstalled: true,
      tokenHashOnlyDatabaseStoragePreserved: true,
      supabaseAuthenticationBehaviorPreserved: true,
    },
    verification: {
      focusedAndAdjacentTests: { filesPassed: 5, testsPassed: 88, testsFailed: 0 },
      ciFullSuiteObservation: { status: "COMPLETED_WITH_PRE_EXISTING_UNRELATED_RED", credentialOutputTestsPassed: 8, mcpTokenCliTestsPassed: 5, totalFilesPassed: 263, totalFilesFailed: 2, totalTestsPassed: 3193, totalTestsFailed: 8, unrelatedFailedFiles: ["tests/knowledge-promotion-gate.test.ts", "tests/knowledge-write-request-budget.test.ts"], ciBuildSkippedAfterUnrelatedTestFailure: true },
      syntax: { nodeCheckFiles: 3, nodeCheckStatus: "PASS", tier1BashSyntaxStatus: "PASS" },
      typecheck: { status: "PASS" },
      productionBuild: { status: "PASS", staticPages: 28 },
      failClosedCliProbes: [
        { status: 1, credentialWorkReached: false, plaintextTokenOutput: false },
        { status: 1, credentialWorkReached: false, plaintextTokenOutput: false },
        { status: 1, credentialWorkReached: false, plaintextTokenOutput: false },
      ],
      liveDeployment: { status: "PASS_DEPLOYED_SOURCE_NO_CREDENTIAL_ISSUANCE_EXECUTED", commitSha: "fixture-sha", environment: "production", productionDeploymentReady: true, credentialIssuanceExecuted: false },
    },
    mutationBoundary: { mcpTokenIssued: false, supabaseAuthTokenIssued: false, dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false, vectorOrEmbeddingMutationPerformed: false, wikiPublicationPerformed: false, koshaRegistryMutationPerformed: false },
    remainingBoundaries: { immutableOriginal18FindingBaselinePreserved: true, sealedCurrentHeadScanPreserved: true, securityComplete: false, freshFollowUpSecurityScan: "REQUIRED", exactSavedShareVerdict: "MISSING_EVIDENCE", approvalGatedFindingsRemainOpen: true, liveAfterDeploymentRequired: false },
  };
}

function currentSourceExportSmokeResourceRemediationFixture(): Record<string, unknown> {
  return {
    schemaVersion: "safeclaw-current-source-security-export-smoke-resource-remediation/v1",
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_OPERATOR_EXPORT_SMOKE_RESOURCE_BUDGET_RESCAN_PENDING",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", branch: "master", environment: "production" },
    immutableSecurityContext: {
      originalAccountedBaselineFindingCount: 18,
      originalAccountedBaselinePreserved: true,
      completedScan: { scanId: "8fe9c06a-018c-446f-aa98-1b37df95287a", targetRevision: "f0c8a7be02becd53c21fb80842cf23c571f22b1f", status: "complete", reportableFindingCount: 17, deferredCandidateCount: 1, approvalGatedFindingCount: 14, findingsRewritten: false },
      currentFinding: { scanId: "f6bef30a-7250-428b-9f66-0bad1e42058c", findingId: "csf_55bf22e9ff3507c519ffde3b", canonicalFindingState: "open_pending_fresh_rescan", findingRewritten: false },
    },
    remediation: {
      sharedHelper: "scripts/operator_smoke_resource_budget.mjs",
      http: { defaultTimeoutMs: 30000, maximumConfiguredTimeoutMs: 120000, defaultResponseMaxBytes: 8388608, maximumConfiguredResponseBytes: 33554432, contentLengthPrecheck: true, streamedByteCeiling: true, upstreamAbortForwarded: true },
      subprocess: { defaultTimeoutMs: 180000, defaultMaxBufferBytes: 8388608, killSignal: "SIGKILL", windowsHidden: true, chromeTimeoutMs: 30000, chromeMaxBufferBytes: 1048576, chromeTemporaryProfileRemoved: true },
    },
    verification: { focusedTests: { files: 3, tests: 17, failed: 0, status: "PASS" }, strictTypecheck: "PASS", build: { status: "PASS", staticPages: 28 }, liveProductCommitMarkerAligned: true, liveOperatorExportSmokeExecuted: false },
    mutationBoundary: { dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false, embeddingOrVectorMutationPerformed: false, wikiPublicationPerformed: false, koshaRegistryMutationPerformed: false },
    remainingBoundaries: { freshFullRepositoryRescanRequired: true, securityCompleteClaimAllowed: false, approvalGatedFindingsClosed: false, exactSavedShareVerdict: "MISSING_EVIDENCE" },
  };
}

function currentSourceSifMigrationScopeRemediationFixture(): Record<string, unknown> {
  return {
    schemaVersion: "safeclaw-current-source-security-sif-migration-scope-remediation/v1",
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_SIF_MIGRATION_SCOPE_AND_DIGEST_RESCAN_PENDING",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", branch: "master", environment: "production" },
    immutableSecurityContext: {
      originalAccountedBaselineFindingCount: 18,
      originalAccountedBaselinePreserved: true,
      currentFinding: { scanId: "f6bef30a-7250-428b-9f66-0bad1e42058c", targetRevision: "9504d8db95fcbc9f37f6c5abc638e9ad0813a325", findingId: "csf_3ca8a70c1e96599ce7b6b795", canonicalFindingState: "open_pending_fresh_rescan", findingRewritten: false },
    },
    remediation: {
      governedPath: "scripts/sif_embedding_approval_preflight.mjs",
      scopePolicy: { filenameControlsAdmission: false, topLevelSqlStatementAllowlist: true, allowedExtension: "vector", allowedTable: "safety_reference_embeddings", allowedFunction: "match_safety_reference_embeddings", allowedIndexPrefix: "idx_safety_reference_embeddings_", nonSifDdlOrDmlFailsClosed: true },
      digestBinding: { canonicalMigrationPath: "evaluation/sif-embedding-gate/sif-embedding-only-migration.sql", canonicalMigrationSha256: "a".repeat(64), arbitraryFilenameWithIdenticalBytesAllowed: true, contentChangeFailsClosed: true },
    },
    verification: {
      focusedAndAdjacentTests: { files: 4, tests: 19, failed: 0, status: "PASS" },
      strictTypecheck: "PASS",
      build: { status: "PASS", staticPages: 28 },
      preflight: { sourceSha: "fixture-sha", ok: true, approvalHeld: true, scopePass: true, digestPass: true, inspectedStatementCount: 9, violationCount: 0, corpusCount: 6032, batchCount: 61 },
      liveProductCommitMarkerAligned: true,
      liveMigrationOrEmbeddingExecutionPerformed: false,
    },
    mutationBoundary: { dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false, embeddingGenerated: false, embeddingUploaded: false, vectorRuntimeActivated: false, wikiPublicationPerformed: false, koshaRegistryMutationPerformed: false },
    remainingBoundaries: { freshFullRepositoryRescanRequired: true, securityCompleteClaimAllowed: false, sifEmbeddingRuntimeApprovalGated: true, approvalGatedFindingsClosed: false, exactSavedShareVerdict: "MISSING_EVIDENCE" },
  };
}

function currentSourceDocumentPublicationIsolationRemediationFixture(): Record<string, unknown> {
  const scriptBody = "export const boundedDocumentPublication = true;\n";
  const testBody = "export const boundedDocumentPublicationTest = true;\n";
  return {
    schemaVersion: "safeclaw-current-source-security-document-publication-isolation-remediation/v1",
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_DOCUMENT_PUBLICATION_ISOLATION_RESCAN_PENDING",
    userContext: "Preserve immutable original 18-finding baseline. Verify current f0c8a7be source/live-aligned state without DB, provider, share-session, vector, wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE and approval-gated boundaries must not be overclaimed.",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", branch: "master", environment: "production" },
    immutableSecurityContext: {
      originalAccountedBaselineFindingCount: 18,
      originalAccountedBaselinePreserved: true,
      completedPriorScan: { scanId: "8fe9c06a-018c-446f-aa98-1b37df95287a", targetRevision: "f0c8a7be02becd53c21fb80842cf23c571f22b1f", status: "complete", reportableFindingCount: 17, deferredCandidateCount: 1, findingsRewritten: false },
      sealedCurrentHeadScan: { scanId: "f6bef30a-7250-428b-9f66-0bad1e42058c", targetRevision: "9504d8db95fcbc9f37f6c5abc638e9ad0813a325", reportableFindingCount: 21, coverageCompleteness: "partial", findingsRewritten: false },
      currentFinding: { findingId: "csf_f95afe61f821089be16a9597", occurrenceId: "occ_a97b68814542094abd455220", ruleId: "supply-chain.unbound-publication-diff", canonicalFindingState: "open_pending_fresh_rescan", findingRewritten: false },
    },
    remediation: {
      governedPath: "scripts/commit_publish_document_dryrun.sh",
      cleanStartingTreeRequired: true,
      headStableDuringGenerationRequired: true,
      generatedSnapshotPaths: ["data/dryrun/latest-document-dryrun.json", "data/dryrun/latest-document-dryrun.md"],
      manifestPath: "data/dryrun/latest-document-dryrun-manifest.json",
      manifestSchemaVersion: "safeclaw-document-dryrun-publication/v1",
      artifactSha256Recorded: true,
      unexpectedGeneratedPathFailsClosed: true,
      unexpectedStagedPathFailsClosed: true,
      exactStagedDiffPrinted: true,
      commitApproval: { defaultHeld: true, explicitFlagRequired: true, expectedStartingHeadRequired: true, expectedSourceBranchRequired: true, committedPathSetRevalidated: true },
      pushApproval: { defaultDisabled: true, separateExplicitFlagRequired: true, expectedRemoteRequired: "contest-mvp-origin", expectedBranchRequired: "master", expectedPrefixRequired: "contest-mvp" },
      sourceArtifacts: [
        { path: "scripts/commit_publish_document_dryrun.sh", sha256: createHash("sha256").update(scriptBody).digest("hex") },
        { path: "tests/commit-publish-document-dryrun.test.ts", sha256: createHash("sha256").update(testBody).digest("hex") },
      ],
    },
    verification: {
      focusedTests: { files: 1, tests: 7, failed: 0, status: "PASS" },
      bashSyntax: "PASS",
      strictTypecheck: "PASS",
      build: { status: "PASS", staticPages: 28 },
      liveProductCommitMarkerAligned: true,
      livePublicationScriptExecuted: false,
      providerOrRepositoryPushExecutedByScript: false,
      fixtureCoverage: { cleanDefaultRunLeavesHeadUnchangedAndStagingEmpty: true, unexpectedGeneratedPathFailsClosed: true, missingExpectedHeadFailsClosed: true, approvedCommitContainsOnlyThreeDigestBoundPaths: true, pushRemainsDisabledAfterApprovedCommit: true },
    },
    mutationBoundary: { dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false, embeddingGenerated: false, vectorUploadPerformed: false, wikiPublished: false, koshaRegistryMutationPerformed: false },
    remainingBoundaries: { freshFullRepositoryRescanRequired: true, securityCompleteClaimAllowed: false, approvalGatedFindingsClosed: false, exactSavedShareVerdict: "MISSING_EVIDENCE" },
  };
}

function currentSourcePhotoReadinessAuthFanoutRemediationFixture(): Record<string, unknown> {
  return {
    schemaVersion: "safeclaw-current-source-security-photo-readiness-auth-fanout-remediation/v1",
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_PHOTO_READINESS_AUTH_FANOUT_CONTRACT",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    finding: {
      findingId: "csf_e70379e4470e7bf7ec2786a4",
      occurrenceId: "occ_cc14cdbca20eb2f3f41aa454",
      ruleId: "resource-exhaustion.photo-readiness-auth-fanout",
      sealedFindingReclassified: false,
      freshRescanRequired: true,
    },
    remediation: {
      publicGetReturnsCoarseReadinessOnly: true,
      publicGetCreatesSupabaseAdminClient: false,
      publicGetCallsSupabaseAuthentication: false,
      arbitraryBearerChangesPublicGetResponseShape: false,
      providerDiagnosticsExposedByPublicGet: false,
      postAuthenticationPreserved: true,
      postMultipartBudgetPreserved: true,
      postProviderExecutionPreserved: true,
    },
    verification: {
      focusedTests: { filesPassed: 2, testsPassed: 13, testsFailed: 0 },
      typecheck: { status: "PASS" },
      productionBuild: { status: "PASS", staticPages: 28 },
      liveDeployment: {
        status: "PASS_DEPLOYED_SOURCE_AND_PUBLIC_RESPONSE_BOUNDARY",
        commitSha: "fixture-sha",
        branch: "master",
        environment: "production",
        publicProbe: {
          path: "/api/input-photos/hazard-analysis",
          anonymousStatus: 200,
          arbitraryBearerStatus: 200,
          responseBodiesEqual: true,
          providerDiagnosticsExposed: false,
          apiKeyPresenceExposed: false,
          photoPostAnalysisExecuted: false,
        },
      },
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
      photoPostAnalysisExecuted: false,
    },
    remainingBoundaries: {
      immutableOriginalBaselinePreserved: true,
      sealedCurrentHeadScanPreserved: true,
      securityComplete: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      approvalGatedFindingsRemainOpen: true,
      liveAfterDeploymentRequired: false,
    },
  };
}

function currentSourceMcpGenerationCancellationRemediationFixture(): Record<string, unknown> {
  return {
    schemaVersion: "safeclaw-current-source-security-mcp-generation-cancellation-remediation/v1",
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_MCP_GENERATION_CANCELLATION_CONTRACT",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    finding: {
      findingId: "csf_c2f6fb44442dee56c0d5c2ed",
      occurrenceId: "occ_89f04a2500ced5cf2d9057fe",
      ruleId: "resource-exhaustion.mcp-generation-cancellation-dropped",
      sealedFindingReclassified: false,
      freshRescanRequired: true,
    },
    remediation: {
      plainGenerationTransportSignalForwarded: true,
      reviewedGenerationTransportSignalForwarded: true,
      ontologyNodeFetchSignalForwarded: true,
      ontologyEdgeFetchSignalForwarded: true,
      runAskSignalForwarded: true,
      qaReviewSignalForwarded: true,
      abortRemainsExceptionalInsteadOfFallback: true,
      persistenceSkippedAfterAbort: true,
      providerAdmissionReleasedByRejectedWorkFinally: true,
      existingDirectHandlerCallsRemainCompatible: true,
    },
    verification: {
      focusedTests: { filesPassed: 5, testsPassed: 54, testsFailed: 0 },
      adjacentTests: { filesPassed: 5, testsPassed: 143, testsFailed: 0 },
      typecheck: { status: "PASS" },
      productionBuild: { status: "PASS", staticPages: 28 },
      liveDeployment: {
        status: "PASS_DEPLOYED_SOURCE_CONTRACT_RUNTIME_CANCELLATION_NOT_PROBED",
        commitSha: "fixture-sha",
        branch: "master",
        environment: "production",
        sourceHeadMatchesProduction: true,
        authenticatedMcpCancellationProbeExecuted: false,
      },
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      mcpGenerationProviderCalled: false,
      shareSessionCreated: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      immutableOriginalBaselinePreserved: true,
      sealedCurrentHeadScanPreserved: true,
      securityComplete: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      approvalGatedFindingsRemainOpen: true,
      liveAfterDeploymentRequired: false,
      validAuthenticatedRuntimeCancellationProbeRequired: true,
    },
  };
}

function currentSourceKoshaArchivePreflightRemediationFixture(): Record<string, unknown> {
  return {
    schemaVersion: "safeclaw-current-source-security-kosha-archive-preflight-remediation/v1",
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_KOSHA_ARCHIVE_PREFLIGHT_CONTRACT",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    finding: {
      findingId: "csf_d7f23c57f1ee89b4c6cdad17",
      occurrenceId: "occ_150ad7ac80e3ea536f29ffcf",
      ruleId: "resource-exhaustion.unbounded-audit-archive-preflight",
      sealedFindingReclassified: false,
      freshRescanRequired: true,
    },
    remediation: {
      nodeAdmZipInventoryRemoved: true,
      boundedPythonInventoryUsed: true,
      endOfCentralDirectoryTailBytes: 65557,
      maxCentralDirectoryBytes: 64 * 1024 * 1024,
      maxMemberCount: 10000,
      maxMemberBytes: 64 * 1024 * 1024,
      maxTotalUncompressedBytes: 1024 * 1024 * 1024,
      maxCompressionRatio: 100,
      inventoryTimeoutMs: 60000,
      parseTimeoutMs: 900000,
      sameOpenFileHandleUsedForPreflightAndZipFile: true,
      aggregateArchiveMemberBudgetEnforced: true,
      aggregateArchiveByteBudgetEnforced: true,
      directPdfLegacyInventorySemanticsPreserved: true,
      fixedSanitizedHelperErrors: true,
      providerOrDatabaseWorkReachedByOverBudgetRegression: false,
    },
    verification: {
      focusedPython: { testsPassed: 64, testsFailed: 0 },
      focusedVitest: { testsPassed: 112, testsFailed: 0 },
      adjacentPython: { testsPassed: 13, testsFailed: 0 },
      adjacentVitest: { testsPassed: 37, testsFailed: 0 },
      typecheck: { status: "PASS" },
      productionBuild: { status: "PASS", staticPages: 28 },
      liveDeployment: {
        status: "PASS_DEPLOYED_SOURCE_CONTRACT_LOCAL_ARCHIVE_PROBE_NOT_EXECUTED",
        commitSha: "fixture-sha",
        branch: "master",
        environment: "production",
        sourceHeadMatchesProduction: true,
        runtimeArchiveProbeExecuted: false,
      },
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
      immutableOriginal18FindingBaselinePreserved: true,
      sealedCurrentHeadScanPreserved: true,
      securityComplete: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      approvalGatedFindingsRemainOpen: true,
      liveAfterDeploymentRequired: false,
      freshFullRepositorySecurityRescanRequired: true,
    },
  };
}

function currentSourceSecurityRemediationFollowupFixture(): Record<string, unknown> {
  return {
    verdict: "PASS_LIVE_PRODUCTION_APPROVAL_FREE_SECURITY_REMEDIATIONS_POST_FIX_RESCAN_PENDING",
    sourceHead: "a1a9da9bd663c05d69f8dbb00823e2761f19ad64",
    productionBuild: {
      commitSha: "a1a9da9bd663c05d69f8dbb00823e2761f19ad64",
      branch: "master",
      environment: "production",
    },
    baseline: {
      scanId: "f37c3e4a-294c-4ab9-b637-b944f33a2182",
      targetRevision: "28cc608700445d3f0ea1ad0aeb7004e9cf1b7fb2",
      reportableFindings: 20,
      medium: 4,
      low: 16,
      coverageCompleteness: "partial",
      immutableOriginalBaselinePreserved: true,
      postFixFullRepositoryRescanCompleted: false,
    },
    remediations: [
      "03fad2a499ad10e3a5762640a350a1f3b2f979eb",
      "165278c7e1596edc22a8e8a8ee532b0309a300ee",
      "165278c7e1596edc22a8e8a8ee532b0309a300ee",
      "3a35f1990d83d0c89554cd122379c4159cf84f00",
      "a1a9da9bd663c05d69f8dbb00823e2761f19ad64",
    ].map((commit, index) => ({ finding: `finding-${index + 1}`, commit, status: "current_source_and_live" })),
    koshaOfficialPdfAudit: {
      verdict: "PASS_OFFICIAL_PDF_AUTHENTICITY_BODY_PAIR_REVIEW_STILL_REQUIRED",
      candidateCount: 8,
      machineVerifiedCount: 8,
      failedCount: 0,
      temporaryPdfFilesRetained: 0,
      exactPromotionPerformed: false,
    },
    verification: {
      vitest: { files: 6, tests: 79, status: "PASS" },
      python: { files: 3, tests: 11, status: "PASS" },
      typecheck: "PASS",
      diffCheck: "PASS",
    },
    remainingBoundaries: {
      publicCatalogRls: "APPROVAL_GATED_DB_POLICY_CHANGE_NOT_PERFORMED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      providerDispatchPersistence: "APPROVAL_GATED",
      shareSessionMutationPerformed: false,
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      vectorMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaExactRegistryMutationPerformed: false,
      postFixFullRepositoryScan: "PENDING_DESKTOP_SECURITY_SCAN",
    },
  };
}

function currentSecurityGovernedPathCompatibilityFixture(): Record<string, unknown> {
  return {
    verdict: "PASS_CURRENT_SOURCE_LIVE_INCLUDED_SECURITY_GOVERNED_PATH_COMPATIBILITY_RESCAN_COMPLETE_FINDINGS_OPEN",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    productionIncludesSourceHead: true,
    coveredGateIds: [
      "share_ack_prebody_admission_security",
      "share_recipient_contact_verification_security",
      "public_json_request_body_budget",
      "improvement_photo_analysis_budget",
      "public_provider_admission",
      "public_ask_distributed_admission",
      "learning_export_renderer_security",
      "mcp_provider_admission_security",
      "mcp_generation_work_budget_security",
      "security_followup_remediation",
      "knowledge_preparation_capability_truth",
      "public_provider_cancellation",
      "public_generation_admission_security",
    ],
    governedPaths: [
      "app/api/ask/route.ts",
      "app/api/ask/stream/route.ts",
      "app/api/input-photos/hazard-analysis/route.ts",
      "app/api/knowledge/match/route.ts",
      "app/api/share-sessions/[sessionId]/route.ts",
      "app/api/weather/route.ts",
      "app/api/workpacks/[id]/improvements/route.ts",
      "app/api/workpacks/[id]/learning-export/route.ts",
      "app/share/[sessionId]/page.tsx",
      "components/SafeGuardCommandCenter.tsx",
      "lib/ask-stream-client.ts",
      "lib/photo-vision-analysis.ts",
      "lib/public-ask-admission.ts",
      "lib/public-distributed-rate-limit.ts",
      "lib/public-work-budget.ts",
      "lib/workpack-commercial.ts",
      "lib/workpack-learning-export.ts",
      "app/api/mcp/[transport]/implementation.ts",
      "app/api/mcp/[transport]/route.ts",
      "lib/mcp-auth.ts",
      "lib/mcp-provider-admission.ts",
      "lib/mcp-tools.ts",
      "lib/rate-limit.ts",
      "tests/mcp-auth.test.ts",
      "tests/mcp-provider-admission.test.ts",
      "tests/mcp-work-budget.test.ts",
      "tests/workpack-share-authority-routes.test.ts",
      "app/api/knowledge/review/prepare/route.ts",
      "app/knowledge/KnowledgeReviewInbox.tsx",
      "app/api/knowledge/regenerate/route.ts",
      "app/api/workpack/remediate/route.ts",
      "lib/ai.ts",
      "lib/knowledge-candidate-route.ts",
    ],
    verification: {
      vitest: {
        filesPassed: 28,
        filesSkipped: 1,
        testsPassed: 317,
        testsSkipped: 7,
        status: "PASS_WITH_BROWSER_OPT_IN_SKIPPED",
      },
      typecheck: "PASS",
      browserCompatibility: "PRESERVED_PRIOR_LIVE_EVIDENCE_NOT_REEXECUTED",
    },
    baselineBoundary: {
      immutableOriginalBaselinePreserved: true,
      postFixFullRepositoryRescanCompleted: true,
      securityCompleteClaimAllowed: false,
    },
    postFixFullRepositoryScan: {
      scanId: "f218c713-1a1c-4f4e-9777-8095926be1df",
      sourceHead: "b5f145120766cd2ef904fce38ef32ed1a9facf74",
      reportableFindingCount: 18,
      mediumFindingCount: 13,
      lowFindingCount: 5,
      coverageCompleteness: "partial",
      securityCompleteClaimAllowed: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerCallPerformedForEvidence: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      readConfirmationCreated: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaExactRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      distributedAdmissionActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      publicCatalogRls: "APPROVAL_GATED_DB_POLICY_CHANGE_NOT_PERFORMED",
      recipientAckLiveDataApproval: "APPROVAL_GATED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      postFixFullRepositoryScan: "COMPLETE_SEALED_PARTIAL_COVERAGE_18_FINDINGS_OPEN",
    },
  };
}

function staleApprovalEvidenceBindingRemediationFixture(): Record<string, unknown> {
  const workflowIds = ["rls_llm_wiki", "distributed_admission", "share_recipient_ack", "kosha_exact_promotion"];
  return {
    schemaVersion: "safeclaw-stale-approval-evidence-binding-remediation/v1",
    generatedAt: "2026-08-31T00:00:00.000Z",
    sourceHead: "fixture-sha",
    verdict: "PASS_CURRENT_SOURCE_STALE_APPROVAL_EVIDENCE_BINDING_FAIL_CLOSED",
    finding: {
      findingId: "csf_86ec127fb3d5b7d397649611",
      ruleId: "approval-integrity.stale-evidence-binding",
    },
    workflowCount: 4,
    passedCount: 4,
    failedCount: 0,
    rows: workflowIds.map((id, index) => ({
      id,
      overall: "blocked_preflight_failed",
      verdict: id === "kosha_exact_promotion" ? "REVIEW_CHECKLIST_INCOMPLETE_BLOCKED" : null,
      bindingVerified: true,
      bindingFailureExposed: false,
      blocked: true,
      sourceHead: "fixture-sha",
      productionCommit: "fixture-sha",
      artifactCount: index + 4,
      packetDigest: `${String(index + 1).repeat(64)}`,
      bindingFailures: [],
      contractPassed: true,
    })),
    contract: {
      currentHeadRequired: true,
      productionCommitRequired: true,
      everyRequiredInputSha256Bound: true,
      currentHeadTrackedBlobMatchRequired: true,
      mixedSourceLiveEvidenceFailsClosed: true,
      deterministicPacketDigestRequired: true,
      mutationApprovalRemainsSeparate: true,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
    remainingBoundary: {
      freshFullRepositorySecurityRescanRequiredForClosure: true,
      approvalGatedMutationsRemainClosed: true,
    },
  };
}

function currentSourceSecurityResidualRemediationFixture(): Record<string, unknown> {
  return {
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_SECURITY_RESIDUAL_REMEDIATION_RESCAN_PENDING",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    productionIncludesProductCommit: true,
    baseline: {
      scanId: "3358978a-75d1-454a-9dcd-4b63b52b9768",
      immutableOriginalFindingCount: 18,
      currentScanFindingCount: 17,
      coverageCompleteness: "partial",
      baselineRewritten: false,
    },
    remediatedSourceResiduals: [
      { anchor: "provider-detail", status: "PASS_CURRENT_SOURCE_LOCAL" },
      { anchor: "dns-toctou", status: "PASS_CURRENT_SOURCE_LOCAL" },
      { anchor: "xff-spoof", status: "PASS_CURRENT_SOURCE_LOCAL" },
    ],
    verification: {
      focusedSecurity: { testFiles: 3, tests: 33, status: "PASS" },
      adjacentPublicAdmissionAndHarness: { testFiles: 7, tests: 141, status: "PASS" },
      typecheck: "PASS",
      productionBuild: "PASS",
      staticPages: 28,
    },
    liveVerification: {
      status: "PASS_DEPLOYED_SOURCE_MARKER_ONLY",
      buildInfoCommit: "fixture-sha",
      behavioralProbeExecuted: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      embeddingGenerated: false,
      vectorUploadPerformed: false,
      wikiPublished: false,
      exactTrustRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      databaseSecurityRemediation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
      llmWikiPublication: "APPROVAL_GATED",
      sifVectorRuntime: "APPROVAL_GATED",
      koshaExactRegistryPromotion: "APPROVAL_GATED",
      followUpSecurityScanRequired: true,
      securityCompleteClaimAllowed: false,
    },
  };
}

function shareAckPreBodyAdmissionFixture(): Record<string, unknown> {
  return {
    verdict: "PASS_LIVE_PRODUCTION_SHARE_ACK_PREBODY_ADMISSION_SOURCE_REMEDIATED",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    finding: {
      scanId: "1411fb32-5c18-4d6a-b8ba-d52697757d8a",
      slug: "share-ack-prebody-admission",
    },
    currentSourceContract: {
      coarseIpRateAdmissionBeforeBody: true,
      coarseBodyConcurrencyLeaseBeforeBody: true,
      bodyBudgetAfterCoarseAdmission: true,
      jsonParseAfterCoarseAdmission: true,
      recipientSpecificAdmissionRetainedAfterParse: true,
      preBodyRateLimitPerMinute: 60,
      preBodyConcurrency: 8,
      preBodyLeaseMs: 15000,
      bodyBudgetBytes: 16384,
      bodyReadTimeoutMs: 10000,
    },
    verification: {
      focusedAndAdjacentTests: { testFiles: 3, testsPassed: 66, testsFailed: 0 },
      typecheck: { status: "PASS" },
      build: { status: "PASS", staticPagesPassed: 28, staticPagesFailed: 0 },
    },
    liveProbe: {
      requestBodyBytes: 16385,
      status: 503,
      code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      rateLimitHeader: "distributed",
      applicationBodyBudgetReached: false,
      sessionLookupReached: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      readConfirmationInserted: false,
      providerDispatchCalled: false,
      vectorRuntimeCalled: false,
      wikiPublished: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      findingSourceRemediated: true,
      freshFullRepositoryRescanRequiredForScanClosure: true,
      securityCompleteClaimAllowed: false,
      shareRecipientAckLiveDataApproval: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  };
}

function safetyStatusDisconnectLeaseFixture(): Record<string, unknown> {
  return {
    verdict: "PASS_LIVE_PRODUCTION_SAFETY_STATUS_DISCONNECT_LEASE_SOURCE_REMEDIATED",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    finding: {
      scanId: "1411fb32-5c18-4d6a-b8ba-d52697757d8a",
      findingId: "csf_b08a96f6b1ba27a33af52a6a",
      slug: "status-disconnect-residual",
    },
    currentSourceContract: {
      preAbortedRequestsRejectedBeforeWork: true,
      disconnectRecordedWithoutEarlySettlement: true,
      underlyingWorkSettlementPrecedesAbortRejection: true,
      admissionLeaseHeldUntilUnderlyingSettlement: true,
      disconnectedWorkStillConsumesConcurrency: true,
      thirdConcurrentRequestRejectedWhileTwoDisconnectedTasksSettle: true,
      concurrencyLimit: 2,
    },
    verification: {
      focusedAndAdjacentTests: { testFiles: 4, testsPassed: 16, testsFailed: 0 },
      typecheck: { status: "PASS" },
      build: { status: "PASS", staticPagesPassed: 28, staticPagesFailed: 0 },
    },
    liveProbe: {
      status: 503,
      code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      rateLimitHeader: "distributed",
      workUnitHeader: "safety-reference-status",
      statusWorkReached: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      readConfirmationInserted: false,
      providerDispatchCalled: false,
      vectorRuntimeCalled: false,
      wikiPublished: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      findingSourceRemediated: true,
      freshFullRepositoryRescanRequiredForScanClosure: true,
      securityCompleteClaimAllowed: false,
      distributedAdmissionActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      providerDispatchPersistence: "APPROVAL_GATED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  };
}

function weatherFallbackErrorRedactionFixture(): Record<string, unknown> {
  return {
    verdict: "PASS_LIVE_PRODUCTION_WEATHER_FALLBACK_ERROR_REDACTION_SOURCE_REMEDIATED",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    finding: {
      scanId: "1411fb32-5c18-4d6a-b8ba-d52697757d8a",
      findingId: "csf_fdda99ed09c6fb65bc74caff",
      slug: "weather-fallback-error-exposure",
      ruleId: "information-exposure.upstream-errors",
    },
    currentSourceContract: {
      providerFallbackBranchCount: 8,
      allProviderFallbackBranchesUseFixedPublicDetail: true,
      rawProviderErrorsLoggedServerSide: true,
      aggregateWeatherDetailOmitsRawProviderErrors: true,
      signalDetailsOmitRawProviderErrors: true,
      callerAbortStillPropagatesBeforeFallbackProjection: true,
      privateUpstreamDiagnosticsRemainServerOnly: true,
    },
    verification: {
      focusedAndAdjacentTests: { testFiles: 3, testsPassed: 16, testsFailed: 0 },
      typecheck: { status: "PASS" },
      build: { status: "PASS", staticPagesPassed: 28, staticPagesFailed: 0 },
    },
    liveProbe: {
      status: 503,
      code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      rateLimitHeader: "distributed",
      providerWorkReached: false,
      rawProviderErrorObserved: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      readConfirmationInserted: false,
      providerDispatchCalled: false,
      vectorRuntimeCalled: false,
      wikiPublished: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      findingSourceRemediated: true,
      freshFullRepositoryRescanRequiredForScanClosure: true,
      securityCompleteClaimAllowed: false,
      distributedAdmissionActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      providerDispatchPersistence: "APPROVAL_GATED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  };
}

function hwpxArchiveExpansionSecurityFixture(): Record<string, unknown> {
  return {
    verdict: "PASS_LIVE_PRODUCTION_HWPX_ARCHIVE_EXPANSION_SOURCE_REMEDIATED",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    finding: {
      scanId: "1411fb32-5c18-4d6a-b8ba-d52697757d8a",
      findingId: "csf_f8f783170119f2531bcc3163",
      slug: "hwpx-archive-expansion",
      ruleId: "resource-exhaustion.hwpx-archive-expansion",
    },
    currentSourceContract: {
      centralDirectoryCheckedBeforeEntryData: true,
      entryDataReadBeforeBudgetPass: false,
      outputBufferBuiltBeforeBudgetPass: false,
      entryCountBudget: 64,
      totalUncompressedBytesBudget: 20 * 1024 * 1024,
      largestEntryUncompressedBytesBudget: 10 * 1024 * 1024,
      estimatedPeakWorkingBytesBudget: 40 * 1024 * 1024,
      invalidOrUnsafeIntegerMetadataRejected: true,
      archiveBudgetFailureUsesBoundedPublic413: true,
    },
    committedTemplateManifest: {
      templateCount: 25,
      availableTemplateCount: 25,
      allTemplatesPassPreDecompressionBudget: true,
      maximumEntryCount: 32,
      maximumTotalUncompressedBytes: 15184195,
      maximumLargestEntryUncompressedBytes: 8532294,
    },
    verification: {
      focusedAndAdjacentTests: { testFiles: 4, testsPassed: 37, testsFailed: 0 },
      typecheck: { status: "PASS" },
      build: { status: "PASS", staticPagesPassed: 28, staticPagesFailed: 0 },
    },
    liveProbe: {
      status: 503,
      code: "PUBLIC_EXPORT_CONCURRENCY_LIMIT",
      rateLimitHeader: "instance",
      archiveProcessingReached: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      readConfirmationInserted: false,
      providerDispatchCalled: false,
      vectorRuntimeCalled: false,
      wikiPublished: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      findingSourceRemediated: true,
      freshFullRepositoryRescanRequiredForScanClosure: true,
      securityCompleteClaimAllowed: false,
      publicExportDistributedAdmission: "OPEN_OPERATOR_CONFIGURATION",
      providerDispatchPersistence: "APPROVAL_GATED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  };
}

function documentEditorialReviewReceiptFixture(): Record<string, unknown> {
  return {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_EDITORIAL_REVIEW_RECEIPT",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", environment: "production" },
    sourceHeadMatchesProduction: true,
    acceptanceContract: {
      canonicalDocumentCount: 12,
      reviewerCheckCount: 5,
      reviewerRequired: true,
      receiptLockedBeforeAllDocuments: true,
      currentTextFingerprintRequired: true,
      editorialFindingsFingerprintRequired: true,
      editorialFindingReviewRequired: true,
      localDownloadOnly: true,
      reviewerIdentityVerified: false,
      serverRecorded: false,
      approvalGranted: false,
    },
    results: [
      { viewport: { width: 1440, height: 723 }, bodyHeightBefore: 723, bodyHeightAfter: 723, bodyHeightUnchanged: true, dialog: { left: 130, top: 12, right: 1310, bottom: 711 }, checklist: { overflowY: "auto" }, receiptLockedAtZero: true, reviewerInputVisible: true, horizontalOverflow: false },
      { viewport: { width: 390, height: 723 }, bodyHeightBefore: 723, bodyHeightAfter: 723, bodyHeightUnchanged: true, dialog: { left: 8, top: 8, right: 382, bottom: 715 }, checklist: { overflowY: "auto" }, receiptLockedAtZero: true, reviewerInputVisible: true, horizontalOverflow: false },
    ],
    receiptVerification: {
      schemaVersion: "safeclaw-document-editorial-review-receipt/v2",
      reviewerRecorded: true,
      reviewedAtRecorded: true,
      generationFingerprintRecorded: true,
      documentCount: 12,
      uniqueDocumentKeyCount: 12,
      reviewerCheckCount: 5,
      checksComplete: true,
      fingerprintsCurrent: true,
      findingsBound: true,
      editorialFindingsFingerprint: "fixture-findings-fingerprint",
      editorialFindingCount: 31,
      editorialFindingIdsRecorded: true,
      editorialFindingCategoriesReconcile: true,
      apiRequestCount: 0,
      reviewCompletion: { localChecklistCompleted: true, editorialFindingsReviewed: true, reviewerSelfAttested: true, reviewerIdentityVerified: false, serverRecorded: false, approvalGranted: false },
    },
    reviewBoundary: { automatedInteractionOnly: true, humanReviewCompleted: false, localReceiptProvesHumanIdentity: false, broadHumanWordingReviewRequired: true },
    mutationBoundary: { dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false, vectorRuntimeCalled: false, wikiPublished: false, koshaRegistryMutationPerformed: false, exactSavedShareVerdict: "MISSING_EVIDENCE" },
  };
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
  const rootDir = createTemporaryDirectory("safeclaw-northstar-open-gate-");
  execFileSync("git", ["init"], { cwd: rootDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: rootDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "SafeClaw Test"], { cwd: rootDir, stdio: "ignore" });
  execFileSync("git", ["config", "gc.auto", "0"], { cwd: rootDir, stdio: "ignore" });
  execFileSync("git", ["config", "maintenance.auto", "false"], { cwd: rootDir, stdio: "ignore" });
  writeText(rootDir, "app/api/knowledge/review/prepare/route.ts", "export const fixture = true;\n");
  writeText(rootDir, "app/knowledge/KnowledgeReviewInbox.tsx", "export const fixture = true;\n");
  writeText(rootDir, "lib/api-guard.ts", "export const trustedForwardedIdentity = true;\n");
  writeText(rootDir, "lib/public-distributed-rate-limit.ts", "export const injectedIdentityEnvironment = true;\n");
  writeText(rootDir, "tests/api-guard.test.ts", "export const apiGuardFixture = true;\n");
  writeText(rootDir, "tests/public-distributed-rate-limit.test.ts", "export const distributedLimiterFixture = true;\n");
  writeText(rootDir, "scripts/scan_industrial_safety_templates.py", "BOUNDED_TEMPLATE_SCAN = True\n");
  writeText(rootDir, "scripts/tests/test_scan_industrial_safety_templates.py", "BOUNDED_TEMPLATE_SCAN_TEST = True\n");

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
  writeJson(rootDir, path.join("evaluation", "ci-supply-chain-pinning-2026-08-29", "report.json"), {
    verdict: "PASS_GITHUB_CI_PINNED_ACTIONS_MINIMUM_TOKEN_PERMISSIONS_WITH_EXISTING_SUITE_RED",
    workflow: {
      defaultPermissions: { contents: "read" },
      actions: [
        { name: "actions/checkout", sha: "11bd71901bbe5b1630ceea73d27597364c9af683", officialTagVerifiedByGitLsRemote: true },
        { name: "actions/setup-node", sha: "49933ea5288caeca8642d1e84afbd3f7d6820020", officialTagVerifiedByGitLsRemote: true },
      ],
    },
    verification: { githubActions: { conclusion: "failure", tests: { passed: 3098, failed: 5 } } },
    remainingBoundaries: { fullRepositoryCiGreenClaimed: false },
  });
  writeJson(rootDir, path.join("evaluation", "ci-full-suite-remediation-2026-08-29", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_GITHUB_CI_NODE24_ACTIONS_FULL_SUITE",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", branch: "master", environment: "production" },
    remediation: { commit: "fixture-sha" },
    localVerification: {
      typecheck: "PASS",
      build: { status: "PASS", staticPages: 28 },
      fullSuite: { testFilesPassed: 256, testFilesSkipped: 11, testFilesTotal: 267, testsPassed: 3103, testsSkipped: 26, testsTotal: 3129 },
    },
    actionRuntimeUpgrade: {
      checkout: { tag: "v7.0.1", sha: "3d3c42e5aac5ba805825da76410c181273ba90b1", runtime: "node24", officialReleaseVerified: true },
      setupNode: { tag: "v7.0.0", sha: "820762786026740c76f36085b0efc47a31fe5020", runtime: "node24", officialReleaseVerified: true },
      packageManagerCache: false,
      node20DeprecationWarningCount: 0,
    },
    githubActions: {
      runId: 33223625501,
      conclusion: "success",
      pinnedCheckout: "3d3c42e5aac5ba805825da76410c181273ba90b1",
      pinnedSetupNode: "820762786026740c76f36085b0efc47a31fe5020",
      typecheck: "success",
      fullSuite: { status: "success", testFilesPassed: 257, testFilesSkipped: 11, testsPassed: 3114, testsSkipped: 26, testsTotal: 3140 },
      build: "success",
    },
    boundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
      approvalGatedBoundariesClosed: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "knowledge-preparation-capability-truth-2026-08-28", "report.json"), {
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_KNOWLEDGE_PREPARATION_CAPABILITY_TRUTH_AUTHENTICATED_PROBE_HELD",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    productionIncludesProductCommit: true,
    before: {
      distributedAdmissionFailurePublicCode: "PUBLIC_ASK_CONCURRENCY_LIMIT",
      reviewInboxFailureMessage: "검토 후보를 준비하지 못했습니다.",
      configurationLockDistinguishedFromLoad: false,
    },
    currentSourceContract: {
      distributedAdmissionFailurePublicCode: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      temporaryConcurrencyPublicCode: "PUBLIC_ASK_CONCURRENCY_LIMIT",
      configurationLockDistinguishedFromLoad: true,
      rawAdmissionErrorPubliclyExposed: false,
      configurationLockMessageVisible: true,
      temporaryLoadMessageVisible: true,
      authenticationMessageVisible: true,
      storageOrGuardMessageVisible: true,
      existingCandidateReviewRemainsAvailable: true,
      publicationState: "unpublished",
      publishAllowed: false,
    },
    verification: {
      focused: { files: 2, tests: 29, failed: 0 },
      adjacentKnowledgeAndAdmission: { files: 4, tests: 88, failed: 0 },
      strictTypecheck: "PASS",
      productionBuild: "PASS",
      staticPages: 28,
    },
    liveVerification: {
      status: "PASS_DEPLOYED_SOURCE_MARKER_ONLY_AUTHENTICATED_PROBE_HELD",
      buildInfoCommit: "fixture-sha",
      branch: "master",
      environment: "production",
      behavioralProbeExecuted: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerCallPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      wikiPublicationPerformed: false,
      ontologyPublicationPerformed: false,
      embeddingGenerated: false,
      vectorUploadPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      enhancedLlmRuntime: "BLOCKED_DISTRIBUTED_RATE_LIMIT_CONFIGURATION",
      authenticatedLivePreparationProbe: "APPROVAL_GATED",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      securityCompleteClaimAllowed: false,
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
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_SEARCH_DISTRIBUTED_CONFIGURATION_TRUTH",
    sourceHead: "fixture-sha",
    productionBuild: {
      commitSha: "fixture-sha",
      sourceHeadMatchesProduction: true,
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
      productionRequiresDistributedAdmission: true,
      absentConfigurationFailsClosedBeforeProviderWork: true,
      productionInstanceFallbackAllowed: false,
      developmentInstanceFallbackAllowed: true,
      responseModeHeader: "X-SafeClaw-Rate-Limit",
      providerCallsOnPartialConfiguration: 0,
      providerCallsOnAbsentConfiguration: 0,
    },
    configuration: {
      productionConfigured: false,
      productionModeVerified: true,
      configurationState: "absent",
      readinessMode: "unavailable",
      observedResponseMode: "distributed",
      responseModeHeaderDoesNotProveConfigurationReady: true,
      distributedActivationPending: true,
    },
    liveProbes: [
      { route: "/api/search", status: 503, rateLimitHeader: "distributed", retryAfterSeconds: 5, code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", providerCallExecuted: false },
      { route: "/api/safety-reference/search", status: 503, rateLimitHeader: "distributed", retryAfterSeconds: 5, code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", providerCallExecuted: false },
    ],
    verification: {
      focusedAndAdjacentTests: { files: 3, tests: 19, failed: 0 },
      typecheck: "PASS",
      build: { status: "PASS", staticPages: 28 },
    },
    boundary: {
      sealedScanMutated: false,
      sealedFindingsClosedWithoutRescan: false,
      immutableOriginalBaselinePreserved: true,
      distributedProtectionConfiguredLive: false,
      productionFailClosedObserved: true,
      databaseFindingsRemainApprovalGated: true,
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
  writeJson(rootDir, path.join("evaluation", "hermes-knowledge-review-selected-workbench-2026-08-14", "report.json"), {
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
    workbenchContract: {
      candidateCount: 3,
      selectedCandidateCount: 1,
      selectedBodyCount: 1,
      desktopColumns: 2,
      mobileColumns: 1,
      candidateBodyInternalScroll: true,
      candidateTablist: true,
      candidateRovingTabStop: true,
      candidateKeyboardNavigation: true,
      breakpointOrientationSynchronized: true,
      mobilePaneTabsLinked: true,
      mobilePaneKeyboardNavigation: true,
      decisionPendingStatusLive: true,
      decisionBusyStateExposed: true,
      decisionActionsDisabledDuringSave: true,
      decisionSettlesAccessibly: true,
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
  writeJson(rootDir, path.join("evaluation", "hermes-knowledge-review-structured-sections-2026-08-28", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_STRUCTURED_CANDIDATE_REVIEW",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    afterLive: {
      verdict: "PASS_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_READINESS",
      productionCommit: "fixture-sha",
      productionAligned: true,
      viewportCount: 8,
      passedCount: 8,
      failedCount: 0,
      selectedCandidateCount: 1,
      selectedBodyCount: 1,
      selectedBodyFormat: "structured",
      candidateSectionCount: 4,
      candidateSectionsNonEmpty: true,
      desktopColumns: 2,
      mobileColumns: 1,
      candidateBodyInternalScroll: true,
      firstDecisionActionInViewport: true,
      horizontalOverflow: false,
      candidateMultilineContinuationPreserved: true,
      actualProductionCandidateQueueRead: false,
      routeControlledBrowserFixture: true,
    },
    reviewBoundary: {
      humanReviewCompleted: false,
      machineEvidenceReplacesHumanReview: false,
      publicationState: "unpublished",
      publishAllowed: false,
      rawFallbackPreserved: true,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      ontologyPublicationPerformed: false,
      vectorRuntimeCalled: false,
      wikiPublished: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      liveAfterDeploymentRequired: false,
      actualProductionCandidateQueueRead: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      enhancedLlmRuntime: "BLOCKED_DISTRIBUTED_RATE_LIMIT_CONFIGURATION",
      securityComplete: false,
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
      { id: "hermes_review_authority_ui_live", passed: true },
      { id: "hermes_review_authority_contract", passed: true },
      { id: "hermes_review_selected_workbench", passed: true },
      { id: "hermes_review_authority_non_mutating", passed: true },
      { id: "hermes_review_authority_boundaries_open", passed: true },
      { id: "hermes_review_evidence_inspector_live", passed: true },
      { id: "hermes_review_evidence_inspector_contract", passed: true },
      { id: "hermes_review_evidence_inspector_verified", passed: true },
      { id: "hermes_review_evidence_inspector_non_mutating", passed: true },
      { id: "hermes_review_evidence_inspector_boundaries_open", passed: true },
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
    hermesReviewAuthorityUi: {
      verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI",
      liveViewportCount: 8,
      livePassedCount: 8,
      candidateCount: 3,
      selectedCandidateCount: 1,
      selectedBodyCount: 1,
      desktopColumns: 2,
      mobileColumns: 1,
      candidateBodyInternalScroll: true,
      humanReviewRequired: true,
      machineEvidenceReplacesHumanReview: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
    },
    hermesReviewEvidenceInspector: {
      verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR",
      liveViewportCount: 8,
      livePassedCount: 8,
      productionAligned: true,
      itemLimit: 20,
      fixtureItemCount: 5,
      desktopEvidenceColumns: 2,
      mobileMountedPaneCount: 1,
      publicOfficialHttpsLinkCount: 3,
      privateEvidenceRawIdentityExposed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
    },
  });
  writeJson(rootDir, path.join("evaluation", "live-document-editorial-template-runtime-2026-08-27", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_TEMPLATE_EDITORIAL_RUNTIME",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    beforeLive: {
      verdict: "BLOCKED_LIVE_PRODUCTION_EDITORIAL_REVIEW_RUNTIME_UNAVAILABLE",
      total: 5,
      pass: 0,
      fail: 0,
      blocked: 5,
      contentReviewExecutedCount: 0,
      requestedDocumentSurfaceCount: 60,
      reviewedDocumentSurfaceCount: 0,
      runtimeBlockCodeCounts: { DISTRIBUTED_RATE_LIMIT_UNAVAILABLE: 5 },
    },
    afterLive: {
      sourceHead: "fixture-sha",
      productionCommit: "fixture-sha",
      verdict: "PASS_LIVE_PRODUCTION_12_DELIVERABLE_EDITORIAL_CONTRACT_REVIEWER_READY",
      total: 5,
      pass: 5,
      fail: 0,
      blocked: 0,
      canonicalDocumentCount: 12,
      requestedDocumentSurfaceCount: 60,
      reviewedDocumentSurfaceCount: 60,
      requestedAiMode: "template",
      expectedProviderWorkUnit: 0,
      providerGenerationRequested: false,
      runtimeContractPassCount: 5,
      runtimeContractEvaluatedCount: 5,
      automatedFindingCounts: {
        placeholder: 0,
        legalOverclaim: 0,
        awkwardComposition: 0,
        scenarioIrrelevantContext: 0,
        evidenceDomainMismatch: 0,
        genericTemplateOveruse: 0,
      },
      retainedReviewerFindings: {
        exactLineOveruse: 15,
        nearDuplicateLineOveruse: 100,
      },
    },
    providerBoundary: {
      enhancedStatus: 503,
      fullStatus: 503,
      code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      distributedAdmissionRequirementPreserved: true,
      providerBackedLiveEditorialPassClaimed: false,
    },
    boundaries: {
      broadHumanReviewRequired: true,
      humanReviewCompleted: false,
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(
    rootDir,
    path.join("evaluation", "document-editorial-review-cockpit-2026-08-16", "report.json"),
    documentEditorialReviewCockpitFixture(),
  );
  writeJson(
    rootDir,
    path.join("evaluation", "document-editorial-review-receipt-2026-08-17", "report.json"),
    documentEditorialReviewReceiptFixture(),
  );
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
  writeJson(rootDir, path.join("evaluation", "share-recipient-disclosure-affordance-2026-08-31", "after-live", "report.json"), {
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
    exactSavedUserSessionReproduced: false,
    exactSavedSessionVerdict: "MISSING_EVIDENCE",
    results: [
      ...[
        { label: "desktop-short-1440x723", width: 1440, height: 723 },
        { label: "desktop-1440x900", width: 1440, height: 900 },
        { label: "mobile-short-390x723", width: 390, height: 723 },
        { label: "mobile-390x844", width: 390, height: 844 },
      ].map((viewport) => ({
        route: "/share/[sessionId] invited recipient fixture",
        viewport,
        verdict: "PASS",
        metrics: {
          documentsPanelOpen: false,
          documentsSummaryAffordance: "+",
          horizontalOverflow: false,
          outsideElements: 0,
        },
      })),
    ],
  });
  writeJson(rootDir, path.join("evaluation", "share-channel-label-polish-2026-08-27", "report.json"), {
    schema: "safeclaw-share-channel-label-polish/v1",
    verdict: "PASS_LIVE_PRODUCTION_SHARE_CHANNEL_LABEL_POLISH",
    productCommit: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", branch: "master", environment: "production" },
    crossSessionUiIntegration: {
      integratedIntoProductHistory: true,
      desktopThreeZoneContractPreserved: true,
      mobileStackContractPreserved: true,
    },
    afterLive: {
      desktop: {
        viewport: { width: 1440, height: 723 },
        documentHeight: 723,
        bodyHeight: 723,
        horizontalOverflow: 0,
        root: { width: 1180, bottom: 716 },
        preview: { bottom: 571 },
        statusRail: { display: "grid", bottom: 678 },
        primary: { bottom: 389 },
        distinctRegions: 3,
        channelCards: ["메일", "문자", "카카오"].map((label) => ({
          label,
          width: 159,
          height: 56,
          labelLineCount: 1,
          whiteSpace: "nowrap",
        })),
      },
      mobile: {
        viewport: { width: 390, height: 723 },
        documentHeight: 723,
        bodyHeight: 723,
        horizontalOverflow: 0,
        root: { bottom: 704 },
        preview: { bottom: 637 },
        primary: { bottom: 696 },
        statusRailDisplay: "none",
        configurationCollapsed: true,
      },
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
      embeddedWorkspaceShareOnly: true,
      exactSavedSessionReproduced: false,
      providerLiveDispatchProven: false,
      routeSplitAloneAcceptedAsFix: false,
    },
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
  writeJson(rootDir, path.join("evaluation", "live-current-documents-share-geometry-2026-08-31", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_CURRENT_DOCUMENTS_AND_SCOPED_WORKSPACE_SHARE_GEOMETRY",
    sourceHead: "fixture-evidence-sha",
    productCommit: "fixture-product-sha",
    productionBuild: {
      commitSha: "fixture-product-sha",
      branch: "master",
      environment: "production",
    },
    documents: {
      desktop1440x723: {
        documentHeight: 723,
        bodyHeight: 723,
        horizontalOverflow: false,
      },
      mobile390x723: {
        documentHeight: 723,
        bodyHeight: 723,
        horizontalOverflow: false,
      },
      afterLiveRemediation: {
        productCommit: "fixture-product-sha",
        productionCommit: "fixture-product-sha",
        viewport: "390x723",
        horizontalOverflow: false,
        workpackShellClientWidth: 327,
        workpackShellScrollWidth: 327,
        riskRowClientWidth: 264,
        riskRowScrollWidth: 264,
        visualHorizontalScrollbarPresent: false,
      },
    },
    workspaceShare: {
      desktop1440x723: {
        pageHeight: 723,
        horizontalOverflow: 0,
        visiblePhoneShellCount: 0,
        root: { columns: [509, 400, 227] },
      },
      mobile390x723: {
        pageHeight: 723,
        horizontalOverflow: 0,
        desktopStatusRailDisplay: "none",
        root: { columns: [304] },
      },
    },
    boundaries: {
      routeSplitAloneAcceptedAsFix: false,
      exactSavedUserSessionReproduced: false,
      exactSavedSessionVerdict: "MISSING_EVIDENCE",
      invitedFixtureAcceptedAsExactSavedSessionProof: false,
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "live-foreign-worker-scenario-guidance-2026-08-27", "report.json"), {
    schema: "safeclaw-live-foreign-worker-scenario-guidance/v1",
    verdict: "PASS_LIVE_PRODUCTION_FOREIGN_WORKER_SCENARIO_GUIDANCE",
    productCommit: "fixture-product",
    productionCommit: "fixture-product",
    afterLive: {
      passed: 2,
      failed: 0,
      providerGenerationRequested: false,
      cases: [
        {
          id: "chemical-cleaning-negative",
          status: 200,
          responseAiMode: "template",
          providerWorkUnit: 0,
          heatGuidancePresent: false,
          expectedScenarioContextPresent: true,
          pass: true,
        },
        {
          id: "heat-logistics-positive",
          status: 200,
          responseAiMode: "template",
          providerWorkUnit: 0,
          heatGuidancePresent: true,
          expectedScenarioContextPresent: true,
          pass: true,
        },
      ],
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerGenerationPerformed: false,
      providerDispatchPerformed: false,
      shareSessionCreated: false,
    },
    remainingBoundaries: {
      humanReviewCompleted: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      fullyAutomatedLaunchClaimAllowed: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "live-roof-repair-scenario-isolation-2026-08-27", "report.json"), {
    schema: "safeclaw-live-roof-repair-scenario-isolation/v1",
    verdict: "PASS_LIVE_PRODUCTION_ROOF_REPAIR_SCENARIO_ISOLATION",
    productCommit: "fixture-product",
    productionCommit: "fixture-product",
    afterLive: {
      passed: 2,
      failed: 0,
      providerGenerationRequested: false,
      cases: [
        {
          id: "roof-repair-heat",
          status: 200,
          responseAiMode: "template",
          providerWorkUnit: 0,
          roofIdentityPresent: true,
          fallContextPresent: true,
          heatContextPresent: true,
          heatGuidancePresent: true,
          warehouseSeedPresent: false,
          pass: true,
        },
        {
          id: "warehouse-heat-control",
          status: 200,
          responseAiMode: "template",
          providerWorkUnit: 0,
          roofIdentityPresent: false,
          heatContextPresent: true,
          heatGuidancePresent: true,
          warehouseSeedPresent: true,
          warehouseIdentityPresent: true,
          pass: true,
        },
      ],
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerGenerationPerformed: false,
      providerDispatchPerformed: false,
      shareSessionCreated: false,
    },
    remainingBoundaries: {
      humanReviewCompleted: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      fullyAutomatedLaunchClaimAllowed: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "live-accident-case-scenario-isolation-2026-08-27", "report.json"), {
    schema: "safeclaw-live-accident-case-scenario-isolation/v1",
    verdict: "PASS_LIVE_PRODUCTION_ACCIDENT_CASE_SCENARIO_ISOLATION",
    productCommit: "fixture-product",
    productionCommit: "fixture-product",
    afterLive: {
      total: 5,
      passed: 5,
      failed: 0,
      forbiddenIndustryCaseCount: 0,
      providerGenerationRequested: false,
      cases: [
        { id: "roof-heat", status: 200, responseAiMode: "template", providerWorkUnit: 0, accidentMode: "fallback", caseCount: 2, titles: ["추락", "온열질환"], requiredTermsPresent: true, forbiddenIndustryPresent: false, pass: true },
        { id: "warehouse-heat", status: 200, responseAiMode: "template", providerWorkUnit: 0, accidentMode: "fallback", caseCount: 2, titles: ["지게차", "온열질환"], requiredTermsPresent: true, forbiddenIndustryPresent: false, pass: true },
        { id: "chemical-cleaning", status: 200, responseAiMode: "template", providerWorkUnit: 0, accidentMode: "fallback", caseCount: 1, titles: ["세척"], requiredTermsPresent: true, forbiddenIndustryPresent: false, pass: true },
        { id: "manufacturing-hotwork", status: 200, responseAiMode: "template", providerWorkUnit: 0, accidentMode: "fallback", caseCount: 1, titles: ["용접"], requiredTermsPresent: true, forbiddenIndustryPresent: false, pass: true },
        { id: "facility-electrical", status: 200, responseAiMode: "template", providerWorkUnit: 0, accidentMode: "fallback", caseCount: 1, titles: ["기계실"], requiredTermsPresent: true, forbiddenIndustryPresent: false, pass: true },
      ],
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerGenerationPerformed: false,
      providerDispatchPerformed: false,
      shareSessionCreated: false,
    },
    remainingBoundaries: {
      humanReviewCompleted: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      fullyAutomatedLaunchClaimAllowed: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "live-accident-case-maintenance-isolation-2026-08-27", "report.json"), {
    schema: "safeclaw-live-accident-case-maintenance-isolation/v1",
    verdict: "PASS_LIVE_PRODUCTION_ACCIDENT_CASE_MAINTENANCE_ISOLATION",
    productCommit: "fixture-product",
    productionCommit: "fixture-product",
    afterLive: {
      total: 5,
      passed: 5,
      failed: 0,
      forbiddenIndustryCaseCount: 0,
      providerGenerationRequested: false,
      cases: [
        { id: "ulsan-chemical", status: 200, responseAiMode: "template", providerWorkUnit: 0, rateLimitMode: "instance", accidentMode: "fallback", caseCount: 1, titles: ["세척 작업 중 화학물질 노출 및 미끄럼 재해사례"], forbiddenIndustryPresent: false, pass: true },
        { id: "pyeongtaek-simultaneous", status: 200, responseAiMode: "template", providerWorkUnit: 0, rateLimitMode: "instance", accidentMode: "fallback", caseCount: 1, titles: ["상하부 양중·화기 동시작업 중 낙하물·화재 재해사례"], forbiddenIndustryPresent: false, pass: true },
        { id: "daejeon-maintenance", status: 200, responseAiMode: "template", providerWorkUnit: 0, rateLimitMode: "instance", accidentMode: "fallback", caseCount: 1, titles: ["자동화설비 정비 중 끼임·예기치 않은 기동 재해사례"], forbiddenIndustryPresent: false, pass: true },
        { id: "gumi-guarding", status: 200, responseAiMode: "template", providerWorkUnit: 0, rateLimitMode: "instance", accidentMode: "fallback", caseCount: 1, titles: ["자동화설비 정비 중 끼임·예기치 않은 기동 재해사례"], forbiddenIndustryPresent: false, pass: true },
        { id: "jeju-electrical", status: 200, responseAiMode: "template", providerWorkUnit: 0, rateLimitMode: "instance", accidentMode: "fallback", caseCount: 1, titles: ["지하 기계실 점검 중 감전·미끄럼 재해사례"], forbiddenIndustryPresent: false, pass: true },
      ],
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerGenerationPerformed: false,
      providerDispatchPerformed: false,
      shareSessionCreated: false,
    },
    remainingBoundaries: {
      humanReviewCompleted: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      fullyAutomatedLaunchClaimAllowed: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "hermes-review-decision-first-viewport-2026-08-27", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_DECISION_FIRST_VIEWPORT",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    beforeLive: {
      verdict: "RED_HERMES_REVIEW_AUTHORITY_UI",
      viewportCount: 8,
      passedCount: 0,
      failedCount: 8,
      desktopShortFirstActionBottom: 957.39,
      mobileShortFirstActionBottom: 818.8,
    },
    afterLocal: {
      verdict: "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_AUTHORITY_UI",
      viewportCount: 8,
      passedCount: 8,
      failedCount: 0,
      decisionConfirmationRequired: true,
      decisionConfirmationUnlocksAllActions: true,
      firstDecisionActionInViewport: true,
      horizontalOverflowCount: 0,
    },
    afterLive: {
      verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI",
      viewportCount: 8,
      passedCount: 8,
      failedCount: 0,
      desktopShortFirstActionBottom: 532.44,
      mobileShortFirstActionBottom: 622.75,
      occludedFirstActionCount: 0,
      decisionConfirmationRequired: true,
      decisionConfirmationUnlocksAllActions: true,
      firstDecisionActionInViewport: true,
      horizontalOverflowCount: 0,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      embeddingOrVectorMutationPerformed: false,
      ontologyPublicationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    reviewBoundary: {
      humanReviewCompleted: false,
      machineEvidenceReplacesHumanReview: false,
      candidateApproved: false,
      wikiPublished: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
    },
  });
  writeJson(rootDir, path.join("evaluation", "hermes-review-candidate-position-2026-08-27", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_CANDIDATE_POSITION",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    baseline: {
      numericCandidatePositionVisible: false,
      measurementMethod: "visual and source snapshot; no retroactive RED runner claim",
    },
    afterLocal: {
      verdict: "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_AUTHORITY_UI",
      viewportCount: 8,
      passedCount: 8,
      failedCount: 0,
      candidatePositionLabels: true,
      candidatePositions: ["1/3", "2/3", "3/3"],
    },
    afterLive: {
      verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI",
      viewportCount: 8,
      passedCount: 8,
      failedCount: 0,
      candidatePositionLabels: true,
      candidatePositions: ["1/3", "2/3", "3/3"],
      productionAligned: true,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      embeddingOrVectorMutationPerformed: false,
      ontologyPublicationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    reviewBoundary: {
      humanReviewCompleted: false,
      machineEvidenceReplacesHumanReview: false,
      candidateApproved: false,
      wikiPublished: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
    },
  });
  writeJson(rootDir, path.join("evaluation", "launch-operations-readiness-2026-08-26", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_LAUNCH_OPERATIONS_CONFIGURATION_TRUTH",
    sourceHead: "fixture-sha",
    productCommit: "fixture-product-sha",
    productionBuild: { commitSha: "fixture-sha", environment: "production" },
    rows: [
      { name: "desktop-day", cardCount: 4, firstViewport: true, horizontalOverflow: false, browserConsoleErrors: [], publicAdmission: "unavailable", publicAdmissionConfiguration: "absent", configurationLabelPresent: true, providerDispatch: "preview_only", photoVision: "ready", localHorizontalScroll: false, root: { bottom: 503 } },
      { name: "desktop-night", cardCount: 4, firstViewport: true, horizontalOverflow: false, browserConsoleErrors: [], publicAdmission: "unavailable", publicAdmissionConfiguration: "absent", configurationLabelPresent: true, providerDispatch: "preview_only", photoVision: "ready", localHorizontalScroll: false, root: { bottom: 503 } },
      { name: "mobile-day", cardCount: 4, firstViewport: true, horizontalOverflow: false, browserConsoleErrors: [], publicAdmission: "unavailable", publicAdmissionConfiguration: "absent", configurationLabelPresent: true, providerDispatch: "preview_only", photoVision: "ready", localHorizontalScroll: true, root: { bottom: 492 } },
      { name: "mobile-night", cardCount: 4, firstViewport: true, horizontalOverflow: false, browserConsoleErrors: [], publicAdmission: "unavailable", publicAdmissionConfiguration: "absent", configurationLabelPresent: true, providerDispatch: "preview_only", photoVision: "ready", localHorizontalScroll: true, root: { bottom: 492 } },
    ],
    boundaries: {
      distributedAdmissionConfigured: false,
      providerDispatchReady: false,
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      wikiPublished: false,
      embeddingOrVectorMutationPerformed: false,
      koshaRegistryMutated: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      fullyAutomatedLaunchClaimAllowed: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "distributed-admission-activation-approval-2026-08-29", "report.json"), {
    sourceSha: "current-sha",
    productionCommit: "current-sha",
    sourceMatchesProduction: true,
    verdict: "APPROVAL_REQUIRED_DISTRIBUTED_ADMISSION_ACTIVATION_NO_MUTATION",
    overall: "approval_ready_open",
    operatorApprovalRequired: true,
    configurationChangeApproved: false,
    activationPerformed: false,
    runtimeBehavioralProbePerformed: false,
    secretValuesInspected: false,
    secretValuesRecorded: false,
    ephemeralRedisMutationPerformed: false,
    requestedChange: {
      environment: "Production",
      requiredVariables: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
      remoteHermesLedgerModeChangeRequested: false,
    },
    sharedCredentialBoundary: {
      remoteHermesLedgerEnabledByThisChange: false,
    },
    currentRuntimeTruth: {
      operationsVerdict: "PASS_LIVE_PRODUCTION_LAUNCH_OPERATIONS_CONFIGURATION_TRUTH",
      viewportPassCount: 4,
      viewportCount: 4,
      configurationState: "absent",
      publicAdmission: "unavailable",
      providerDispatch: "preview_only",
    },
    checks: Array.from({ length: 8 }, (_, index) => ({ id: `check-${index + 1}`, passed: true, message: "ok" })),
    failedCheckIds: [],
    mutationBoundary: {
      dbSchemaMutationPerformed: false,
      dbDataMutationPerformed: false,
      providerCallPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(rootDir, path.join("evaluation", "documents-mobile-review-launch-2026-08-17", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_REVIEW_LAUNCH_CONTAINMENT",
    sourceHead: "product-sha",
    productionCommit: "evidence-sha",
    afterLive: [
      {
        viewport: { width: 1440, height: 723 },
        bodyHeight: 723,
        bodyRatio: 1,
        horizontalOverflow: false,
        overlapCount: 0,
        reviewLaunch: { top: 212, bottom: 242, height: 30 },
      },
      {
        viewport: { width: 390, height: 723 },
        bodyHeight: 723,
        bodyRatio: 1,
        horizontalOverflow: false,
        overlapCount: 0,
        coreDocumentCount: 3,
        reviewLaunch: { top: 256, bottom: 300, height: 44 },
        thirdCoreDocument: { top: 186, bottom: 252 },
      },
    ],
    boundaries: {
      liveAfterDeploymentPending: false,
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(rootDir, path.join("evaluation", "document-export-capability-truth-2026-08-17", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_EXPORT_CAPABILITY_TRUTH",
    sourceHead: "fixture-sha",
    productCommit: "fixture-product-sha",
    productionCommit: "fixture-sha",
    productCommitIncludedInProduction: true,
    sourceHeadMatchesProduction: true,
    capability: {
      getStatus: 200,
      admission: { configurationState: "absent", mode: "unavailable", ready: false, reason: "distributed_limiter_unavailable" },
      credentialMaterialExposed: false,
      localGuardedPostStatus: 503,
      localGuardedPostCode: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      localGuardedPostRateLimit: "distributed",
      localGuardedPostWorkUnit: "document-export",
      misleadingConcurrencyStatusObserved: false,
      liveGuardedExportRoutes: [
        { route: "/api/export/hwpx-template", status: 503, code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", rateLimit: "distributed", workUnit: "document-export", retryAfterSeconds: 5 },
        { route: "/api/export/pdf", status: 503, code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", rateLimit: "distributed", workUnit: "document-export", retryAfterSeconds: 5 },
        { route: "/api/export/hwp", status: 503, code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", rateLimit: "distributed", workUnit: "document-export", retryAfterSeconds: 5 },
        { route: "/api/export/xlsx", status: 503, code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", rateLimit: "distributed", workUnit: "document-export", retryAfterSeconds: 5 },
      ],
      serverExportWorkExecuted: false,
    },
    browser: {
      desktop: {
        bodyHeight: 723, viewportHeight: 723, horizontalOverflow: false,
        readiness: "locked", readinessText: "정식 출력 잠김 · PDF·호환 형식 사용",
        panelWidth: 843, toolsWidth: 855, xlsxButtonWidth: 805, legacyXlsButtonWidth: 191.25,
        xlsxDisabled: true, hwpDisabled: true, pdfDisabled: false, legacyXlsDisabled: false, legacyHwpxDisabled: false,
      },
      mobile: {
        bodyHeight: 723, viewportHeight: 723, horizontalOverflow: false,
        readiness: "locked", readinessText: "정식 출력 잠김 · PDF·호환 형식 사용",
        panelWidth: 262, toolsWidth: 285, pdfButtonWidth: 236, legacyXlsButtonWidth: 220,
        xlsxDisabled: true, hwpDisabled: true, pdfDisabled: false, legacyXlsDisabled: false, legacyHwpxDisabled: false,
      },
    },
    mutationBoundary: {
      dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false,
      vectorMutationPerformed: false, wikiPublicationPerformed: false, koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      distributedAdmissionActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      liveAfterDeploymentRequired: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      fullyAutomatedLaunchClaimAllowed: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "ontology-viewport-workbench-2026-08-17", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_ONTOLOGY_VIEWPORT_WORKBENCH",
    sourceHead: "fixture-sha",
    productCommit: "fixture-product-sha",
    productionCommit: "fixture-sha",
    sourceHeadMatchesProduction: true,
    productCommitIncludedInProduction: true,
    routeSplitAloneAcceptedAsFix: false,
    browser: {
      rowCount: 10, passCount: 10, maxBodyRatio: 1, horizontalOverflowRows: 0,
      overlapRows: 0, minimumControlHeight: 44, screenshotCount: 14,
      desktop: { caseCount: 4, explorerPaneWidth: 848.56, directoryPaneWidth: 339.44, localScrollContained: true },
      tablet: { caseCount: 2, singleTaskPane: true, localScrollContained: true },
      mobile: { caseCount: 4, taskSwitchVerifiedCount: 4, minimumPaneClientHeight: 322, localScrollContained: true, selectionReturnsToExplorerTop: true },
    },
    mutationBoundary: {
      dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false,
      vectorMutationPerformed: false, wikiPublicationPerformed: false, koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: { exactSavedShareVerdict: "MISSING_EVIDENCE", fullyAutomatedLaunchClaimAllowed: false },
  });
  writeJson(rootDir, path.join("evaluation", "knowledge-viewport-workbench-2026-08-17", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_KNOWLEDGE_VIEWPORT_WORKBENCH",
    sourceHead: "fixture-sha",
    productCommit: "fixture-product-sha",
    productionCommit: "fixture-sha",
    sourceHeadMatchesProduction: true,
    productCommitIncludedInProduction: true,
    routeSplitAloneAcceptedAsFix: false,
    selectedOnlyWorkbenchRequired: true,
    browser: {
      rowCount: 10, passCount: 10, maxBodyRatio: 1.02, horizontalOverflowRows: 0,
      outsideElementRows: 0, visiblePanelCountPerRow: 1, reachableSectionCountPerRow: 6,
      minimumControlHeight: 44, minimumLocalScrollPanelCount: 4, screenshotCount: 18,
      desktop: { caseCount: 4, selectedOnly: true, localScrollContained: true },
      tablet: { caseCount: 2, selectedOnly: true, localScrollContained: true },
      mobile: { caseCount: 4, selectedOnly: true, localScrollContained: true },
      referenceDisclosure: {
        technicalDisclosureCount: 6, referenceDisclosureCount: 7, defaultOpenDisclosureCount: 0,
        exclusiveDisclosureGroups: true, maxMobileTechnicalScrollRatio: 4.47,
        maxMobileReferenceScrollRatio: 3.68, maxFirstDisclosureBottom: 590.97,
        minPanelBottom: 611.39, firstDisclosureInsidePanel: true,
      },
      progressiveDisclosure: {
        technicalDisclosureCount: 6, referenceDisclosureCount: 7,
        wikiDisclosureCount: 2, governanceDisclosureCount: 2,
        defaultOpenDisclosureCount: 0, exclusiveDisclosureGroups: true,
        maxMobileTechnicalScrollRatio: 4.47, maxMobileReferenceScrollRatio: 3.68,
        maxMobileWikiScrollRatio: 2.03, maxMobileGovernanceScrollRatio: 2.2,
        firstDisclosureInsidePanel: true, firstReviewStateInsidePanel: true,
      },
    },
    mutationBoundary: {
      dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false,
      vectorMutationPerformed: false, wikiPublicationPerformed: false, koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublicationVerdict: "APPROVAL_GATED",
      sifEmbeddingRuntimeVerdict: "APPROVAL_GATED",
      fullyAutomatedLaunchClaimAllowed: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "knowledge-mobile-task-rail-2026-08-27", "report.json"), {
    schema: "safeclaw-knowledge-mobile-task-rail/v1",
    verdict: "PASS_LIVE_PRODUCTION_KNOWLEDGE_MOBILE_TASK_RAIL",
    productCommit: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", branch: "master", environment: "production" },
    scope: {
      route: "/knowledge", viewport: { width: 390, height: 723 }, themes: ["day", "night"],
      hashTargets: ["wiki", "governance"], existingSelectedOnlyWorkbenchPreserved: true,
      routeSplitAloneAcceptedAsFix: false,
    },
    beforeLive: {
      selectorCount: 6, selectorRows: 2, selectorHeight: 44, taskIndexHeight: 129, panelTop: 437.99,
    },
    afterLive: {
      resultCount: 4, passCount: 4, failCount: 0,
      commonContract: {
        documentHeight: 733, horizontalOverflow: 0, railHeight: 46, railClientWidth: 366,
        railScrollWidth: 644, selectorCount: 6, selectorRows: 1, minimumSelectorHeight: 44,
        selectedFullyVisible: true, panelTop: 381.97, panelBottom: 610.97,
        panelClientHeight: 229, panelOverflowY: "auto",
      },
    },
    verification: {
      knowledgeGovernanceUiContract: { status: "PASS", tests: 18 },
      focusedBrowser: { status: "PASS", tests: 1 }, typecheck: "PASS",
      build: { status: "PASS", staticPages: 28 },
    },
    mutationBoundary: {
      dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false,
      embeddingOrVectorMutationPerformed: false, wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE", llmWikiPublication: "APPROVAL_GATED",
      sifEmbeddingRuntime: "APPROVAL_GATED", providerDispatchPersistence: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED", koshaExactPromotionReview: "APPROVAL_GATED",
      humanReviewCompleted: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "llm-wiki-candidate-readiness-2026-08-25", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_READINESS",
    sourceHead: "a".repeat(40),
    productCommit: "b".repeat(40),
    productionCommit: "a".repeat(40),
    liveAfterDeploymentRequired: false,
    local: {
      verdict: "PASS_CURRENT_SOURCE_LOCAL_LLM_WIKI_CANDIDATE_CONTENT_READINESS",
      viewportCount: 8,
      passedCount: 8,
      failedCount: 0,
    },
    afterLive: {
      verdict: "PASS_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_READINESS",
      viewportCount: 8,
      passedCount: 8,
      failedCount: 0,
      productionAligned: true,
      browserErrorCount: 0,
    },
    contentReadinessContract: {
      contractVersion: "knowledge-candidate-content-readiness.v1",
      requiredSectionCount: 4,
      readyFixtureCount: 2,
      revisionRequiredFixtureCount: 1,
      selectedReadinessPanelCount: 1,
      approvalFailsClosedForRevision: true,
      revisionGuidanceVisible: true,
      revisionIssueCount: 4,
      revisionIssueCodesExposed: false,
      approvalFailsClosedAfterConfirmation: true,
      keepSiteOnlyAvailableForRevision: true,
      rejectAvailableForRevision: true,
      humanReviewCompleted: false,
      publicationState: "unpublished",
      publishAllowed: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      ontologyPublicationPerformed: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
    },
  });
  writeJson(rootDir, path.join("evaluation", "llm-wiki-candidate-content-matrix-2026-08-25", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_WIKI_EVENT_SEMANTIC_AND_EVIDENCE_VISIBILITY_LLM_ENHANCED_RUNTIME_BLOCKED",
    productCommit: "b".repeat(40),
    sourceHead: "a".repeat(40),
    productionCommit: "a".repeat(40),
    liveAfterDeploymentRequired: false,
    evidenceVisibilityBeforeLive: {
      verdict: "RED_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX",
      sourceHead: "a".repeat(40),
      productionCommit: "a".repeat(40),
      passedCount: 0,
      failedCount: 5,
      reviewerEvidenceTraceCount: 0,
      technicalGuidanceBoundaryCount: 0,
      lawCandidateBoundaryCount: 0,
    },
    evidenceVisibilityAfterLocal: {
      verdict: "PASS_CURRENT_SOURCE_LOCAL_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX",
      sourceHead: "a".repeat(40),
      generationMode: "deterministic",
      passedCount: 5,
      failedCount: 0,
      reviewerEvidenceTraceCount: 5,
      technicalGuidanceBoundaryCount: 5,
      lawCandidateBoundaryCount: 5,
    },
    evidenceVisibilityAfterLive: {
      verdict: "PASS_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX",
      sourceHead: "a".repeat(40),
      productionCommit: "a".repeat(40),
      generationMode: "deterministic",
      passedCount: 5,
      failedCount: 0,
      reviewerEvidenceTraceCount: 5,
      technicalGuidanceBoundaryCount: 5,
      lawCandidateBoundaryCount: 5,
    },
    eventSemanticBeforeLive: {
      verdict: "RED_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX",
      sourceHead: "a".repeat(40), productionCommit: "a".repeat(40), passedCount: 0, failedCount: 5,
      eventSemanticGroundingCount: 0, privateEventExposureCount: 0,
    },
    eventSemanticAfterLocal: {
      verdict: "PASS_CURRENT_SOURCE_LOCAL_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX",
      sourceHead: "a".repeat(40), passedCount: 5, failedCount: 0,
      eventSemanticGroundingCount: 5, privateEventExposureCount: 0,
    },
    eventSemanticAfterLive: {
      verdict: "PASS_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX",
      sourceHead: "a".repeat(40), productionCommit: "a".repeat(40), passedCount: 5, failedCount: 0,
      eventSemanticGroundingCount: 5, privateEventExposureCount: 0,
    },
    afterLiveProvider: {
      verdict: "RED_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_MATRIX",
      sourceHead: "a".repeat(40),
      productionCommit: "a".repeat(40),
      generationMode: "provider",
      passedCount: 0,
      failedCount: 5,
      httpStatuses: [503, 503, 503, 503, 503],
      runtimeBlocker: "distributed_rate_limit_unavailable_before_ai_generation",
    },
    contentContract: {
      scenarioCount: 5,
      requiredSectionCount: 4,
      scenarioSpecificTermGroupsRequired: true,
      textualHazardGroundingRequired: true,
      matchedHazardMetadataAloneAccepted: false,
      reviewerVisibleEvidenceTraceRequired: true,
      scenarioSpecificOfficialSourceTermsRequired: true,
      technicalGuidanceAndLawRolesSeparated: true,
      explicitEventReviewFactsRequired: true,
      arbitraryRawPayloadAcceptedAsReviewFact: false,
      privateEventTermExposureAllowed: false,
      placeholderFindingCount: 0,
      legalOverclaimFindingCount: 0,
      humanReviewCompleted: false,
      publicationState: "unpublished",
      publishAllowed: false,
    },
    scopeBoundary: {
      actualProductionCandidateQueueRead: false,
      routeControlledBrowserFixtureAcceptedAsGenerationProof: false,
      deterministicFallbackProvenCurrentSource: true,
      deterministicFallbackProvenLive: true,
      evidenceVisibilityContractProvenLive: true,
      eventSemanticGroundingProvenCurrentSource: true,
      eventSemanticGroundingProvenLive: true,
      enhancedLlmGenerationProvenLive: false,
      enhancedLlmRuntimeState: "BLOCKED_DISTRIBUTED_RATE_LIMIT_CONFIGURATION",
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      ontologyPublicationPerformed: false,
      vectorOrEmbeddingMutationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
    },
  });
  writeJson(rootDir, path.join("evaluation", "llm-wiki-sif-evidence-matrix-2026-08-26", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_SIF_KOSHA_LAW_WIKI_CANDIDATE_EVIDENCE",
    productCommit: "fixture-sha", sourceHead: "fixture-sha", productionCommit: "fixture-sha",
    liveAfterDeploymentRequired: false,
    afterLocal: {
      verdict: "PASS_CURRENT_SOURCE_LOCAL_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX",
      passedCount: 5, failedCount: 0, sifEvidenceBoundaryCount: 5,
      technicalGuidanceBoundaryCount: 5, lawCandidateBoundaryCount: 5, privateEventExposureCount: 0,
    },
    afterLive: {
      verdict: "PASS_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX",
      sourceHead: "fixture-sha", productionCommit: "fixture-sha", passedCount: 5, failedCount: 0,
      sifEvidenceBoundaryCount: 5, technicalGuidanceBoundaryCount: 5, lawCandidateBoundaryCount: 5,
      eventSemanticGroundingCount: 5, privateEventExposureCount: 0,
    },
    contentContract: {
      authorityOrder: ["sif", "kosha", "law"], scenarioCount: 5,
      reviewerVisibleSifEvidenceRequired: true, sifProvenanceRequired: true,
      sifIncidentControlEvidenceIsNonStatutory: true, koshaTechnicalGuidanceIsNonStatutory: true,
      statutoryClaimsRequireLawProvenance: true, privateSifTitleExposureAllowed: false,
      humanReviewCompleted: false, publicationState: "unpublished", publishAllowed: false,
    },
    compatibilityContracts: {
      providerCancellation: {
        verdict: "PASS_CURRENT_SOURCE_WIKI_SIF_PROVIDER_CANCELLATION_COMPATIBILITY",
        sourceHead: "fixture-sha",
        changedGovernedPath: "lib/knowledge-candidate-route.ts",
        focusedVitest: { file: "tests/knowledge-regenerate-route.test.ts", files: 1, tests: 18, failed: 0 },
        requestSignalForwardedToGeneration: true,
        abortSkipsProviderFallback: true,
        originalSecurityBaselineRewritten: false,
      },
    },
    mutationBoundary: {
      dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false,
      ontologyPublicationPerformed: false, vectorOrEmbeddingMutationPerformed: false, koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      actualProductionCandidateQueueRead: false,
      enhancedLlmRuntime: "BLOCKED_DISTRIBUTED_RATE_LIMIT_CONFIGURATION",
      exactSavedShareVerdict: "MISSING_EVIDENCE", llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
    },
  });
  writeJson(rootDir, path.join("evaluation", "documents-touch-targets-2026-08-17", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_TOUCH_TARGETS",
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
      { width: 1440, height: 723, verdict: "PASS" },
      { width: 1440, height: 723, verdict: "PASS" },
      { width: 390, height: 723, verdict: "PASS" },
      { width: 390, height: 723, verdict: "PASS" },
    ].map((item) => ({
      ...item,
      cockpit: {
        viewportWidth: item.width,
        viewportHeight: item.height,
        bodyHeight: item.height,
        horizontalOverflow: false,
        shellRatio: item.width === 390 ? 2.07 : 1.75,
        shellOverflowY: "auto",
        actionHeights: [44, 44],
        selectorHeights: [44, 44, 44],
        coreButtonCount: 3,
        supportingDocumentsOpen: false,
      },
      reviewDialog: {
        closeWidth: 44,
        closeHeight: 44,
        horizontalOverflow: false,
      },
    })),
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
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_GENERATION_DISTRIBUTED_CONFIGURATION_TRUTH",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    baseSecurityScan: {
      scanId: "d12d04ce-deaf-497d-8754-33d5baab2ca0",
      targetCommit: "e087d474a1de72bd3687c703a61a4263fe792fa4",
      immutableBaselinePreserved: true,
      reportableFindingCount: 28,
    },
    admissionControls: [
      { route: "/api/knowledge/regenerate", namespace: "knowledge-regeneration", limit: 20, windowMs: 60000, beforeRequestBodyParsing: true, beforeAiGeneration: true, requireDistributedInProduction: true },
      { route: "/api/workpack/remediate", namespace: "workpack-remediation", limit: 12, windowMs: 60000, beforeRequestBodyParsing: true, beforeReferenceSearch: true, beforeAiGeneration: true, requireDistributedInProduction: true },
    ],
    runtimeBoundary: {
      productionRequiresDistributedAdmission: true,
      productionInstanceFallbackAllowed: false,
      developmentInstanceFallbackAllowed: true,
      partialDistributedConfigFailsClosed: true,
      absentDistributedConfigFailsClosed: true,
      successHeader: "X-SafeClaw-Rate-Limit",
      liveDeploymentVerified: true,
      configurationState: "absent",
      readinessMode: "unavailable",
      observedResponseMode: "distributed",
      responseModeHeaderDoesNotProveConfigurationReady: true,
      distributedProtectionConfiguredLive: false,
      productionFailClosedObserved: true,
      distributedProductionActivationPending: true,
    },
    beforeLive: {
      sourceHead: "fixture-sha",
      probes: [
        { route: "/api/knowledge/regenerate", status: 400, rateLimitHeader: "instance", providerCallPerformed: false, referenceSearchPerformed: false, dbMutationPerformed: false },
        { route: "/api/workpack/remediate", status: 400, rateLimitHeader: "instance", providerCallPerformed: false, referenceSearchPerformed: false, dbMutationPerformed: false },
      ],
    },
    afterLocal: {
      sourceHead: "fixture-sha",
      mode: "current-source-local-production",
      probes: [
        { route: "/api/knowledge/regenerate", status: 503, rateLimitHeader: "distributed", code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", providerCallPerformed: false, referenceSearchPerformed: false, dbMutationPerformed: false },
        { route: "/api/workpack/remediate", status: 503, rateLimitHeader: "distributed", code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", providerCallPerformed: false, referenceSearchPerformed: false, dbMutationPerformed: false },
      ],
    },
    afterLive: {
      sourceHead: "fixture-sha",
      productionCommit: "fixture-sha",
      productionBranch: "master",
      productionEnvironment: "production",
      deploymentUrl: "fixture.vercel.app",
      probes: [
        { route: "/api/knowledge/regenerate", status: 503, rateLimitHeader: "distributed", code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", providerCallPerformed: false, referenceSearchPerformed: false, dbMutationPerformed: false },
        { route: "/api/workpack/remediate", status: 503, rateLimitHeader: "distributed", code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", providerCallPerformed: false, referenceSearchPerformed: false, dbMutationPerformed: false },
      ],
    },
    dependencyAudit: { after: { total: 0 } },
    verification: {
      focused: { files: 3, tests: 34, status: "PASS" },
      northstar: { files: 3, tests: 174, status: "PASS" },
      typecheck: "PASS",
      build: { verdict: "PASS", staticPages: 28 },
      npmAudit: { verdict: "PASS", vulnerabilityCount: 0 },
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
      distributedProductionActivationPending: true,
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
    latestPathCompatibility: {
      verdict: "PASS_LIVE_PRODUCTION_CURRENT_SEARCH_KOSHA_COMPATIBILITY",
      sourceHead: "fixture-sha",
      productionCommit: "fixture-sha",
      changedGovernedPaths: ["lib/search.ts"],
      focusedVitest: { files: 14, tests: 245, failed: 0 },
      fullCi: { filesPassed: 249, testsPassed: 2927, failed: 0 },
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
  writeJson(rootDir, path.join("evaluation", "security-accident-case-compatibility-2026-08-27", "report.json"), {
    schema: "safeclaw-security-accident-case-compatibility/v1",
    verdict: "PASS_LIVE_PRODUCTION_ACCIDENT_CASE_SECURITY_COMPATIBILITY",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    governedPathCompatibility: {
      verdict: "PASS_LIVE_PRODUCTION_ACCIDENT_CASE_GOVERNED_PATH_COMPATIBILITY",
      sourceHead: "fixture-sha",
      productionCommit: "fixture-sha",
      coveredGateIds: ["security_followup_remediation"],
      changedGovernedPaths: ["lib/accident-cases.ts"],
    },
    verification: {
      focusedAndAdjacentTests: { files: 6, tests: 146, failed: 0, status: "PASS" },
      typecheck: "PASS",
      build: { status: "PASS", staticPages: 28 },
    },
    securityContracts: {
      callerAbortPropagated: true,
      accidentBranchesReceiveCallerSignal: true,
      oversizedKoshaResponseFallsBackWithinBudget: true,
      privateProxyAndRelayTokenRejected: true,
      redirectsRemainManual: true,
      liveScenarioFallbackIsolationPassed: true,
      liveScenarioCount: 5,
      unrelatedIndustryCaseCount: 0,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchPerformed: false,
      shareSessionCreated: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      originalBaselineRewritten: false,
      securityCompleteClaimed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
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
  writeJson(rootDir, path.join("evaluation", "current-full-repository-security-scan-2026-08-27", "report.json"), {
    verdict: "NOTICE_CURRENT_HEAD_STANDARD_SCAN_19_FINDINGS_PARTIAL_COVERAGE_REMEDIATION_REQUIRED",
    scanId: "da97e400-1f4d-40b9-a434-ab5ab013fdb3",
    scanRevision: "4e3e7e5d9ebad7e91f428a856019122431410be4",
    productCommit: "4e3e7e5d9ebad7e91f428a856019122431410be4",
    productionCommit: "4e3e7e5d9ebad7e91f428a856019122431410be4",
    immutableOriginalBaselineFindingCount: 18,
    scan: {
      status: "complete",
      coverage: "partial",
      reviewedSurfaceCount: 9,
      deferredCoverageItemCount: 26,
      reportableFindingCount: 19,
      severityCounts: { medium: 14, low: 5 },
    },
    findingDisposition: {
      total: 19,
      approvalGatedDatabaseOrAtomicityCount: 12,
      approvalFreeProductSourceCandidateCount: 7,
      approvalFreeRemediatedCount: 0,
      securityCompleteClaimAllowed: false,
    },
    approvalFreeProductSourceCandidates: {
      count: 7,
      findings: Array.from({ length: 7 }, (_, index) => `source-candidate-${index + 1}`),
      remediationPending: true,
    },
    currentSourceRemediation: {
      sourceHead: "f95773c2f4b55fe0ba8b199b5218800067e09bdf",
      scanTimeCandidateCount: 7,
      approvalFreeCandidateCount: 6,
      approvalFreeRemediatedCount: 6,
      approvalFreeOpenCount: 0,
      approvalSensitiveShareCapabilityCount: 1,
      approvalSensitiveFinding: "public-share-object-id-credential",
      freshFullRepositoryRescanRequired: true,
      liveAfterDeployment: {
        status: "PASS_SOURCE_INCLUDED",
        productionCommit: "607c39b3204fd4e1732890bcc6dbad30e4815ea2",
        sourceRemediationIncluded: true,
        providerDispatchCalled: false,
        dbMutationPerformed: false,
        shareSessionCreated: false,
      },
    },
    approvalGatedDatabaseOrAtomicity: {
      count: 12,
      findings: Array.from({ length: 12 }, (_, index) => `db-approval-gated-${index + 1}`),
      databaseOrAtomicityApprovalRequired: true,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      databaseSecurityRemediation: "APPROVAL_GATED",
      approvalFreeProductSourceRemediation: "LIVE_SOURCE_INCLUDED_FRESH_RESCAN_REQUIRED",
      shareCapabilityCredentialRemediation: "APPROVAL_GATED",
      coverageCompleteness: "partial",
      deferredCoverageItemCount: 26,
      securityCompleteClaimAllowed: false,
    },
  });
  const freshScanRoot = path.join("evaluation", "current-source-standard-security-scan-2026-08-31-121c8a01-complete");
  writeJson(rootDir, path.join(freshScanRoot, "report.json"), freshCurrentSourceSecurityScanFixture());
  const completedScanRoot = path.join("evaluation", "current-head-standard-security-scan-2026-08-31-9504d8db-complete");
  const completedArtifacts = {
    manifest: path.join(completedScanRoot, "canonical", "scan-manifest.json"),
    findings: path.join(completedScanRoot, "canonical", "findings.json"),
    coverage: path.join(completedScanRoot, "canonical", "coverage.json"),
    markdown: path.join(completedScanRoot, "scan-report.md"),
  };
  writeJson(rootDir, completedArtifacts.manifest, { scan: { status: "completed" } });
  writeJson(rootDir, completedArtifacts.findings, { findings: Array.from({ length: 21 }, (_, index) => ({ id: index + 1 })) });
  writeJson(rootDir, completedArtifacts.coverage, { completeness: "partial" });
  const completedMarkdownPath = path.join(rootDir, completedArtifacts.markdown);
  fs.mkdirSync(path.dirname(completedMarkdownPath), { recursive: true });
  fs.writeFileSync(completedMarkdownPath, "# sealed current-head scan\n", "utf8");
  const completedHashes = Object.fromEntries(
    Object.entries(completedArtifacts).map(([key, relativePath]) => [
      key,
      createHash("sha256").update(fs.readFileSync(path.join(rootDir, relativePath))).digest("hex"),
    ]),
  );
  writeJson(
    rootDir,
    path.join(completedScanRoot, "report.json"),
    completedCurrentHeadStandardSecurityScanFixture(completedHashes),
  );
  writeJson(
    rootDir,
    path.join("evaluation", "current-source-security-forwarded-identity-remediation-2026-08-31", "report.json"),
    currentSourceForwardedIdentityRemediationFixture(),
  );
  writeJson(
    rootDir,
    path.join("evaluation", "current-source-security-template-inventory-remediation-2026-08-31", "report.json"),
    currentSourceTemplateInventoryRemediationFixture(),
  );
  const approvalFreeRemediation = currentSourceApprovalFreeSecurityRemediationFixture();
  writeJson(
    rootDir,
    path.join("evaluation", "current-source-security-approval-free-remediation-2026-08-31", "report.json"),
    approvalFreeRemediation,
  );
  writeJson(
    rootDir,
    path.join("evaluation", "current-source-security-resource-budget-remediation-2026-08-31", "report.json"),
    currentSourceSecurityResourceBudgetRemediationFixture(),
  );
  writeJson(
    rootDir,
    path.join("evaluation", "current-source-security-logout-storage-remediation-2026-08-31", "report.json"),
    currentSourceLogoutStorageRemediationFixture(),
  );
  writeJson(
    rootDir,
    path.join("evaluation", "current-source-security-ontology-error-projection-remediation-2026-08-31", "report.json"),
    currentSourceOntologyErrorProjectionRemediationFixture(),
  );
  writeJson(
    rootDir,
    path.join("evaluation", "current-source-security-raw-error-projection-remediation-2026-08-31", "report.json"),
    currentSourceRawErrorProjectionRemediationFixture(),
  );
  writeJson(
    rootDir,
    path.join("evaluation", "current-source-security-credential-output-remediation-2026-08-31", "report.json"),
    currentSourceCredentialOutputRemediationFixture(),
  );
  writeJson(
    rootDir,
    path.join("evaluation", "current-source-security-export-smoke-resource-remediation-2026-08-31", "report.json"),
    currentSourceExportSmokeResourceRemediationFixture(),
  );
  for (const relativePath of [
    "scripts/operator_smoke_resource_budget.mjs",
    "scripts/prod_orchestration_download_smoke.mjs",
    "scripts/final_e2e_matrix_runner.mjs",
    "scripts/final_output_integrity_audit.mjs",
    "scripts/submission_readiness_smoke.mjs",
    "scripts/final_99_gate_runner.mjs",
  ]) {
    writeText(rootDir, relativePath, "export const boundedOperatorSmoke = true;\n");
  }
  writeJson(
    rootDir,
    path.join("evaluation", "current-source-security-sif-migration-scope-remediation-2026-08-31", "report.json"),
    currentSourceSifMigrationScopeRemediationFixture(),
  );
  writeText(rootDir, "scripts/sif_embedding_approval_preflight.mjs", "export const boundedSifMigrationScope = true;\n");
  writeText(rootDir, "tests/sif-embedding-preflight.test.ts", "export const boundedSifMigrationScopeTest = true;\n");
  writeJson(
    rootDir,
    path.join("evaluation", "current-source-security-document-publication-isolation-remediation-2026-08-31", "report.json"),
    currentSourceDocumentPublicationIsolationRemediationFixture(),
  );
  writeText(rootDir, "scripts/commit_publish_document_dryrun.sh", "export const boundedDocumentPublication = true;\n");
  writeText(rootDir, "tests/commit-publish-document-dryrun.test.ts", "export const boundedDocumentPublicationTest = true;\n");
  writeJson(
    rootDir,
    path.join("evaluation", "current-source-security-photo-readiness-auth-fanout-remediation-2026-08-31", "report.json"),
    currentSourcePhotoReadinessAuthFanoutRemediationFixture(),
  );
  writeJson(
    rootDir,
    path.join("evaluation", "current-source-security-mcp-generation-cancellation-remediation-2026-08-31", "report.json"),
    currentSourceMcpGenerationCancellationRemediationFixture(),
  );
  writeJson(
    rootDir,
    path.join("evaluation", "current-source-security-kosha-archive-preflight-remediation-2026-08-31", "report.json"),
    currentSourceKoshaArchivePreflightRemediationFixture(),
  );
  for (const receipt of approvalFreeRemediation.receipts as Array<{ evidencePath: string }>) {
    writeJson(rootDir, receipt.evidencePath, { verdict: "PASS_FIXTURE" });
  }
  writeJson(
    rootDir,
    path.join("evaluation", "current-source-security-remediation-2026-08-30", "report.json"),
    currentSourceSecurityRemediationFollowupFixture(),
  );
  writeJson(
    rootDir,
    path.join("evaluation", "current-security-governed-path-compatibility-2026-08-30", "report.json"),
    currentSecurityGovernedPathCompatibilityFixture(),
  );
  writeJson(
    rootDir,
    path.join("evaluation", "current-source-security-stale-approval-evidence-binding-remediation-2026-08-31", "report.json"),
    staleApprovalEvidenceBindingRemediationFixture(),
  );
  for (const relativePath of [
    "scripts/approval_evidence_binding.mjs",
    "scripts/distributed_admission_activation_preflight.mjs",
    "scripts/kosha_exact_promotion_review_gate.mjs",
    "scripts/rls_llm_wiki_approval_preflight.mjs",
    "scripts/share_recipient_ack_approval_preflight.mjs",
    "scripts/stale_approval_evidence_binding_remediation.mjs",
  ]) {
    writeText(rootDir, relativePath, "export const approvalEvidenceBindingFixture = true;\n");
  }
  writeJson(rootDir, path.join(freshScanRoot, "canonical", "scan-manifest.json"), { scan: { status: "completed" } });
  writeJson(rootDir, path.join(freshScanRoot, "canonical", "findings.json"), { findings: [] });
  writeJson(rootDir, path.join(freshScanRoot, "canonical", "coverage.json"), { completeness: "partial" });
  fs.writeFileSync(path.join(rootDir, freshScanRoot, "scan-report.md"), "# sealed fixture\n", "utf8");
  writeJson(
    rootDir,
    path.join("evaluation", "current-source-security-residual-remediation-2026-08-28", "report.json"),
    currentSourceSecurityResidualRemediationFixture(),
  );
  writeJson(
    rootDir,
    path.join("evaluation", "share-ack-prebody-admission-2026-08-28", "report.json"),
    shareAckPreBodyAdmissionFixture(),
  );
  writeText(rootDir, path.join("app", "api", "share-sessions", "[sessionId]", "route.ts"), "export const preBodyAdmission = true;\n");
  writeText(rootDir, path.join("tests", "workpack-share-authority-routes.test.ts"), "export const preBodyAdmissionTest = true;\n");
  writeJson(
    rootDir,
    path.join("evaluation", "safety-status-disconnect-lease-2026-08-28", "report.json"),
    safetyStatusDisconnectLeaseFixture(),
  );
  writeText(rootDir, path.join("app", "api", "safety-reference", "status", "route.ts"), "export const settleBeforeRelease = true;\n");
  writeText(rootDir, path.join("tests", "safety-reference-status-route.test.ts"), "export const settleBeforeReleaseTest = true;\n");
  writeJson(
    rootDir,
    path.join("evaluation", "weather-fallback-error-redaction-2026-08-28", "report.json"),
    weatherFallbackErrorRedactionFixture(),
  );
  writeText(rootDir, path.join("lib", "weather.ts"), "export const publicFallbackDetail = true;\n");
  writeText(rootDir, path.join("tests", "upstream-integration-security.test.ts"), "export const weatherRedactionTest = true;\n");
  writeJson(
    rootDir,
    path.join("evaluation", "hwpx-archive-expansion-security-2026-08-28", "report.json"),
    hwpxArchiveExpansionSecurityFixture(),
  );
  writeText(rootDir, path.join("lib", "hwpx-template.ts"), "export const archiveBudget = true;\n");
  writeText(rootDir, path.join("tests", "document-export-localization.test.ts"), "export const archiveBudgetTest = true;\n");
  writeJson(rootDir, path.join("evaluation", "hermes-knowledge-review-evidence-inspector-2026-08-14", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    local: {
      verdict: "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_EVIDENCE_INSPECTOR",
      viewportCount: 8,
      passedCount: 8,
      failedCount: 0,
    },
    afterLive: {
      verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR",
      viewportCount: 8,
      passedCount: 8,
      failedCount: 0,
      productionAligned: true,
      browserErrorCount: 0,
    },
    evidenceContract: {
      itemLimit: 20,
      fixtureItemCount: 5,
      authorityCountsMatchReviewContract: true,
      desktopCandidateAndEvidenceMounted: true,
      desktopEvidenceColumns: 2,
      mobileMountedPaneCount: 1,
      mobileCandidateEvidenceSegmentedControl: true,
      candidateTablist: true,
      candidateRovingTabStop: true,
      candidateKeyboardNavigation: true,
      breakpointOrientationSynchronized: true,
      mobilePaneTabsLinked: true,
      mobilePaneKeyboardNavigation: true,
      decisionPendingStatusLive: true,
      decisionBusyStateExposed: true,
      decisionActionsDisabledDuringSave: true,
      decisionSettlesAccessibly: true,
      publicOfficialHttpsLinkCount: 3,
      privateEvidenceRawIdentityExposed: false,
      evidenceInternalScroll: true,
      horizontalOverflow: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      ontologyPublicationPerformed: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    securityBoundary: {
      immutableOriginal18FindingBaselinePreserved: true,
      freshFullRepositoryScanRequired: true,
      securityComplete: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
    },
  });
  writeJson(rootDir, path.join("evaluation", "hermes-evidence-digest-readability-2026-08-26", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_EVIDENCE_READABILITY",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    afterLive: {
      verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR",
      productionCommit: "fixture-sha",
      viewportCount: 8,
      passedCount: 8,
      failedCount: 0,
      evidenceDigestMinWidth: 242,
      evidenceDigestMaxHeight: 18,
      desktopReadinessSectionMinWidth: 167.75,
      mobileReadinessSectionMinWidth: 104,
      readinessLabelMaxHeight: 36,
      horizontalOverflow: false,
    },
    boundaries: {
      humanReviewCompleted: false,
      wikiPublished: false,
      dbMutationPerformed: false,
      providerCallPerformed: false,
      shareSessionCreated: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublicationVerdict: "APPROVAL_GATED",
      liveAfterDeploymentRequired: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "hermes-review-subject-context-2026-08-27", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_SUBJECT_CONTEXT",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    afterLive: {
      verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR",
      productionCommit: "fixture-sha",
      viewportCount: 8,
      passedCount: 8,
      failedCount: 0,
      candidateBodyBeforeReadinessCount: 8,
      candidateBodyTopVisibleCount: 8,
      desktopEvidenceSubjectContextCount: 4,
      mobileEvidenceSubjectContextVisibleCount: 4,
      maxEvidenceSubjectContextHeight: 47,
      horizontalOverflowCount: 0,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      ontologyPublicationPerformed: false,
      wikiPublicationPerformed: false,
    },
    reviewBoundary: {
      humanReviewCompleted: false,
      machineEvidenceReplacesHumanReview: false,
      candidateApproved: false,
      wikiPublished: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
    },
  });
  const routePerceptionDir = path.join("evaluation", "live-documents-share-route-perception-2026-08-28");
  const screenshots = [
    "documents-desktop-after-live-1440x723.png",
    "documents-mobile-after-live-390x723.png",
    "workspace-share-desktop-after-live-1440x723.png",
    "workspace-share-mobile-after-live-390x723.png",
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
          moduleRail: { clientHeight: 723, scrollHeight: 723, overflowDelta: 0 },
          frontVisibleCoreLauncherCount: 3, frontVisibleCoreLaunchers: ["riskAssessmentDraft", "tbmBriefing", "tbmLogDraft"],
          frontVisibleSupportingLauncherCount: 0, horizontalOverflow: false, stickyOverlapCount: 0,
          screenshot: path.join(routePerceptionDir, screenshots[0]), verdict: "PASS",
        },
        {
          route: "/documents?theme=day", viewport: { width: 390, height: 723 }, documentHeight: 723, bodyHeight: 723,
          bodyViewportRatio: 1, workbench: { bottom: 669 }, frontVisibleCoreLauncherCount: 3,
          moduleRail: { clientHeight: 64, scrollHeight: 64, overflowDelta: 0 },
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
      documentsRailRemediation: {
        beforeLiveClientHeight: 723,
        beforeLiveScrollHeight: 724,
        beforeLiveOverflowDelta: 1,
        afterLiveClientHeight: 723,
        afterLiveScrollHeight: 723,
        afterLiveOverflowDelta: 0,
        actualOverflowAccessibilityPreserved: true,
        liveAfterDeploymentRequired: false,
        screenshot: path.join(routePerceptionDir, screenshots[0]),
      },
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
    currentSourceRefresh: {
      verdict: "PASS_LIVE_PRODUCTION_PUBLIC_PROVIDER_CANCELLATION_CURRENT_SOURCE_REFRESH",
      sourceHead: "fixture-sha",
      productionCommit: "fixture-sha",
      productionBranch: "master",
      productionEnvironment: "production",
      deploymentUrl: "https://example.test",
      liveProviderCallExecuted: false,
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
        },
        workpackRemediation: {
          requestSignalForwardedToReferenceSearch: true,
          requestSignalForwardedToGeneration: true,
          abortSkipsProviderFallback: true,
        },
      },
      verification: {
        focusedAndAdjacentVitest: { files: 6, tests: 49, failed: 0 },
      },
      mutationBoundary: {
        dbMutationPerformed: false,
        providerDispatchCalled: false,
        shareSessionCreated: false,
        vectorRuntimeMutationPerformed: false,
        wikiPublicationPerformed: false,
        koshaRegistryMutationPerformed: false,
      },
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
  writeJson(rootDir, path.join("evaluation", "public-ask-distributed-admission-2026-08-14", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_ASK_PROVIDER_MODES_FAIL_CLOSED_WITHOUT_DISTRIBUTED_ADMISSION",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    securityFinding: {
      findingId: "csf_9b3cc6648586dabf4bfa61e9",
      canonicalFindingRemainsImmutable: true,
      freshFollowUpScanRequired: true,
    },
    currentSourceContract: {
      templateProviderWorkUnit: 0,
      templateRequiresDistributedAdmission: false,
      enhancedProviderWorkUnit: 2,
      fullProviderWorkUnit: 12,
      providerModesRequireDistributedRateAdmissionInProduction: true,
      providerModesRequireDistributedWeightedLeaseInProduction: true,
      jsonAndSseShareFailClosedContract: true,
      explicitHttpAdmissionFailureRetriedViaLegacyJson: false,
      providerWorkStartsAfterAdmission: true,
    },
    localProductionProbe: {
      distributedBackendConfigured: false,
      providerCallExecuted: false,
      cases: [
        { path: "/api/ask", case: "template-no-provider", status: 200, rateLimitMode: "instance", aiMode: "template", workUnit: 0 },
        { path: "/api/ask", case: "enhanced-distributed-unavailable", status: 503, rateLimitMode: "distributed", code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE" },
        { path: "/api/ask/stream", case: "enhanced-distributed-unavailable", status: 503, rateLimitMode: "distributed", code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE" },
      ],
    },
    liveProductionProbe: {
      productionCommit: "fixture-sha",
      providerCallExecuted: false,
      cases: [
        { path: "/api/ask", case: "template-no-provider", status: 200, rateLimitMode: "instance", aiMode: "template", workUnit: 0 },
        { path: "/api/ask", case: "enhanced-distributed-unavailable", status: 503, rateLimitMode: "distributed", code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE" },
        { path: "/api/ask", case: "full-distributed-unavailable", status: 503, rateLimitMode: "distributed", code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE" },
        { path: "/api/ask/stream", case: "enhanced-distributed-unavailable", status: 503, rateLimitMode: "distributed", code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE" },
        { path: "/api/ask/stream", case: "full-distributed-unavailable", status: 503, rateLimitMode: "distributed", code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE" },
      ],
    },
    verification: {
      focusedVitest: { files: 3, tests: 21, failed: 0 },
      focusedAndAdjacentVitest: { files: 11, tests: 67, failed: 0 },
      typecheck: "PASS",
      build: { status: "PASS", staticPages: 28 },
      dependencyAuditVulnerabilities: 0,
      diffCheck: "PASS",
    },
    productionBuild: {
      currentCommitSha: "fixture-sha",
      productCommitDeployed: true,
      liveAfterDeploymentPending: false,
      previewDeploymentCompleted: true,
    },
    governedPathCompatibility: {
      verdict: "PASS_LIVE_PRODUCTION_PUBLIC_ASK_DISTRIBUTED_ADMISSION_GOVERNED_PATH_COMPATIBILITY",
      sourceHead: "fixture-sha",
      productionCommit: "fixture-sha",
      coveredGateIds: [
        "public_json_request_body_budget",
        "public_provider_cancellation",
        "public_provider_admission",
        "public_generation_admission_security",
      ],
      changedProductPaths: [
        "app/api/ask/route.ts",
        "app/api/ask/stream/route.ts",
        "app/api/knowledge/regenerate/route.ts",
        "app/api/knowledge/review/prepare/route.ts",
        "app/api/workpack/remediate/route.ts",
        "components/SafeGuardCommandCenter.tsx",
        "lib/ask-stream-client.ts",
        "lib/public-ask-admission.ts",
      ],
      focusedVitest: { files: 3, tests: 21, failed: 0 },
      focusedAndAdjacentVitest: { files: 11, tests: 67, failed: 0 },
      originalSecurityBaselineRewritten: false,
      noMutation: true,
      providerCallExecuted: false,
      freshFollowUpScan: "REQUIRED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
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
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      securityCompleteClaimAllowed: false,
      freshFollowUpScan: "REQUIRED",
      distributedBackendActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      approvalGatedOperationsUnchanged: true,
    },
  });
  writeJson(rootDir, path.join("evaluation", "public-search-distributed-admission-2026-08-14", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_SEARCH_PROVIDER_WORK_FAILS_CLOSED_WITHOUT_DISTRIBUTED_ADMISSION",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    securityFinding: { findingId: "csf_bb897a39277591f4fbab0ca7", canonicalFindingRemainsImmutable: true, freshFollowUpScanRequired: true },
    currentSourceContract: {
      capacity: 12,
      leaseMs: 70000,
      namespace: "public-search-provider-work",
      weights: { legal: 6, "safety-reference": 3, weather: 1 },
      validRequestsRequireDistributedRateAdmissionInProduction: true,
      newCoalescedJobsRequireDistributedWeightedLeaseInProduction: true,
      leaseCountedPerCoalescedUpstreamJob: true,
      leaseReleasedOnSuccessErrorAndFinalConsumerCancellation: true,
      providerWorkStartsAfterAdmission: true,
    },
    liveProductionProbe: {
      productionCommit: "fixture-sha",
      distributedBackendConfigured: false,
      providerCallExecutedForEvidence: false,
      cases: [
        { path: "/api/search", kind: "legal", status: 503, rateLimitMode: "distributed", code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", retryAfterSeconds: 5 },
        { path: "/api/safety-reference/search", kind: "safety-reference", status: 503, rateLimitMode: "distributed", code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", retryAfterSeconds: 5 },
        { path: "/api/weather", kind: "weather", status: 503, rateLimitMode: "distributed", code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", retryAfterSeconds: 5 },
      ],
    },
    verification: {
      focusedAndAdjacentVitest: { files: 5, tests: 35, failed: 0 },
      coalescedDistributedLeaseRegression: { httpConsumers: 2, upstreamJobs: 1, leaseAcquires: 1, leaseReleases: 1 },
      typecheck: "PASS",
      build: { status: "PASS" },
      diffCheck: "PASS",
    },
    productionBuild: { currentCommitSha: "fixture-sha", productCommitDeployed: true, liveAfterDeploymentPending: false },
    governedPathCompatibility: {
      verdict: "PASS_LIVE_PRODUCTION_PUBLIC_SEARCH_DISTRIBUTED_ADMISSION_GOVERNED_PATH_COMPATIBILITY",
      sourceHead: "fixture-sha",
      productionCommit: "fixture-sha",
      coveredGateIds: ["public_provider_cancellation", "public_provider_admission"],
      changedProductPaths: ["app/api/search/route.ts", "app/api/safety-reference/search/route.ts", "app/api/weather/route.ts", "lib/public-search-admission.ts"],
      focusedAndAdjacentVitest: { files: 5, tests: 35, failed: 0 },
      originalSecurityBaselineRewritten: false,
      noMutation: true,
      providerCallExecuted: false,
      freshFollowUpScan: "REQUIRED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
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
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      securityCompleteClaimAllowed: false,
      freshFollowUpScan: "REQUIRED",
      distributedBackendActivation: "OPERATOR_CONFIGURATION_REQUIRED",
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
      verdict: "PASS_LIVE_PRODUCTION_MCP_PREAUTH_ADMISSION_FAIL_CLOSED_REFRESH",
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
        status: 503,
        rateLimitHeader: "distributed",
        errorCode: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
        retryAfterSeconds: 5,
        distributedAdmissionRequired: true,
        distributedAdmissionAvailable: false,
        distributedAdmissionFailedClosed: true,
        authenticationNotReachedBecauseAdmissionFailedClosed: true,
        mcpToolDispatchPerformed: false,
        providerCallPerformed: false,
        validAuthenticatedBudgetProbeExecuted: false,
      },
      configurationReadiness: {
        path: "/api/export/pdf",
        method: "GET",
        status: 200,
        configurationState: "absent",
        mode: "unavailable",
        ready: false,
        reason: "distributed_limiter_unavailable",
      },
      verification: {
        focused: { files: 3, tests: 65, failed: 0, status: "PASS" },
        adjacentMcp: { files: 8, tests: 126, failed: 0, status: "PASS" },
        typecheck: "PASS",
        build: { status: "PASS", staticPages: 28 },
        dependencyAuditVulnerabilities: 0,
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
      distributedProductionHealthRequired: false,
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
  writeJson(rootDir, path.join("evaluation", "public-admission-current-source-compatibility-2026-08-28", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_ADMISSION_CURRENT_SOURCE_COMPATIBILITY",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    coveredGateIds: [
      "public_json_request_body_budget",
      "public_provider_cancellation",
      "public_provider_admission",
      "public_ask_distributed_admission",
      "public_search_distributed_admission",
      "improvement_photo_analysis_budget",
    ],
    verification: {
      focusedAndAdjacentVitest: { files: 13, tests: 100, failed: 0, status: "PASS" },
      typecheck: "PASS",
      build: "PASS",
      dependencyAuditVulnerabilities: 0,
    },
    liveReadOnlyProbe: {
      providerCallExecuted: false,
      cases: [
        { name: "oversize-ask", status: 413, code: "PUBLIC_WORK_BUDGET_EXCEEDED", rateLimit: "instance" },
        { name: "oversize-ask-stream", status: 413, code: "PUBLIC_WORK_BUDGET_EXCEEDED", rateLimit: "instance" },
        { name: "oversize-knowledge-match", status: 413, code: "PUBLIC_WORK_BUDGET_EXCEEDED", rateLimit: "instance" },
        { name: "ask-template", status: 200, code: "", rateLimit: "instance" },
        { name: "ask-enhanced", status: 503, code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", rateLimit: "distributed" },
        { name: "ask-full", status: 503, code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", rateLimit: "distributed" },
        { name: "ask-stream-enhanced", status: 503, code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", rateLimit: "distributed" },
        { name: "ask-stream-full", status: 503, code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", rateLimit: "distributed" },
        { name: "search-legal", status: 503, code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", rateLimit: "distributed" },
        { name: "search-safety-reference", status: 503, code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", rateLimit: "distributed" },
        { name: "search-weather", status: 503, code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", rateLimit: "distributed" },
        { name: "photo-readiness", status: 200, code: "", rateLimit: "" },
      ],
    },
    originalSecurityBaselinesRewritten: false,
    mutationBoundary: {
      dbSchemaMutationPerformed: false,
      dbDataMutationPerformed: false,
      providerCallPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      freshFollowUpScan: "REQUIRED",
      securityCompleteClaimAllowed: false,
      distributedBackendActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(rootDir, path.join("evaluation", "share-mcp-current-source-compatibility-2026-08-28", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_SHARE_MCP_CURRENT_SOURCE_FAIL_CLOSED_COMPATIBILITY",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    coveredGateIds: [
      "share_session_revocation_security",
      "share_recipient_contact_verification_security",
      "share_ack_prebody_admission_security",
      "mcp_provider_admission_security",
    ],
    verification: {
      focusedAndAdjacentVitest: {
        filesPassed: 8,
        filesSkipped: 0,
        testsPassed: 205,
        testsSkipped: 0,
        failed: 0,
        status: "PASS",
      },
      recipientBrowser: { files: 1, tests: 7, failed: 0, status: "PASS" },
      typecheck: "PASS",
      build: "PASS",
      staticPages: 28,
      dependencyAuditVulnerabilities: 0,
    },
    liveReadOnlyProbe: {
      providerGenerationExecuted: false,
      mcpToolDispatchPerformed: false,
      shareSessionCreated: false,
      shareSessionRevoked: false,
      readConfirmationCreated: false,
      cases: [
        { name: "share-revoke-unauthenticated", status: 401 },
        {
          name: "share-contact-missing-session",
          status: 503,
          code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
          rateLimit: "distributed",
        },
        {
          name: "share-ack-oversize-missing-session",
          status: 503,
          code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
          rateLimit: "distributed",
        },
        {
          name: "mcp-invalid-token",
          status: 503,
          code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
          rateLimit: "distributed",
        },
      ],
    },
    originalSecurityBaselinesRewritten: false,
    mutationBoundary: {
      dbSchemaMutationPerformed: false,
      dbDataMutationPerformed: false,
      providerGenerationExecuted: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      shareSessionRevoked: false,
      readConfirmationCreated: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      distributedBackendActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      validAuthenticatedMcpProbe: "NOT_EXECUTED_NO_MCP_TOKEN",
      shareRecipientAckLiveDataApproval: "APPROVAL_GATED",
      shareStorageAndCreationApproval: "APPROVAL_GATED",
      freshFollowUpScan: "REQUIRED",
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(rootDir, path.join("evaluation", "document-risk-row-mobile-density-2026-08-27", "report.json"), {
    schema: "safeclaw-document-risk-row-mobile-density/v1",
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_MOBILE_DENSITY",
    productCommit: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", branch: "master", environment: "production" },
    crossSessionUiReview: {
      reviewedBranches: [
        { branch: "feat/safeclaw-document-rail", integratedIntoCurrent: false },
        { branch: "feat/safeclaw-linear-shell", integratedIntoCurrent: false },
        { branch: "feat/safeclaw-share-workflow", integratedIntoCurrent: false },
        { branch: "fix/docs-share-viewport-ia", integratedIntoCurrent: true },
      ],
      existingDirectionPreserved: true,
      wholesaleUiBranchMergePerformed: false,
    },
    beforeLive: {
      riskRowSelectorCount: 5,
      riskRowSelectorRows: 2,
      riskRowRailHeight: 94,
      firstActiveEditorGroupTop: 716,
    },
    afterLive: {
      mobileDay390x723: {
        viewport: { width: 390, height: 723 },
        documentHeight: 723,
        horizontalOverflow: 0,
        riskRowSelectorCount: 5,
        riskRowSelectorRows: 1,
        riskRowRailHeight: 46,
        riskRowRailClientWidth: 265,
        riskRowRailScrollWidth: 446,
        selectorHeights: [44, 44, 44, 44, 44],
        activeHazardBottom: 667,
      },
      mobileNight390x723: {
        viewport: { width: 390, height: 723 },
        documentHeight: 723,
        horizontalOverflow: 0,
        riskRowSelectorCount: 5,
        riskRowSelectorRows: 1,
        riskRowRailHeight: 46,
        riskRowRailClientWidth: 265,
        riskRowRailScrollWidth: 446,
        selectorHeights: [44, 44, 44, 44, 44],
        activeHazardBottom: 667,
      },
      desktopDay1440x723: {
        viewport: { width: 1440, height: 723 },
        documentHeight: 723,
        horizontalOverflow: 0,
        riskRowSelectorCount: 5,
        riskRowSelectorRows: 1,
        activeHazardBottom: 642,
      },
    },
    verification: {
      focusedFiveRowBrowser: { status: "PASS", tests: 1 },
      documentsEditorLayout: { status: "PASS", tests: 44 },
      typecheck: "PASS",
      build: { status: "PASS", staticPages: 28 },
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
      providerLiveDispatchProven: false,
      routeSplitAloneAcceptedAsFix: false,
      wholeDocumentsPageClaimedShort: false,
      rawSourceDrilldownRemainsBoundedSecondary: true,
    },
  });
  writeJson(rootDir, path.join("evaluation", "document-risk-row-add-touch-2026-08-27", "browser-metrics.json"), {
    schema: "safeclaw-document-risk-row-add-touch-browser/v1",
    beforeLive: {
      source: "https://www.safeclaw.kr",
      commitSha: "eb0000396fde7ab41e37f2853318d8bacadd91b1",
      theme: "day",
      viewport: { width: 390, height: 723 },
      documentHeight: 723,
      horizontalOverflow: 0,
      addRiskRowButton: { height: 32, minHeight: "32px", width: 90.5 },
      shell: { clientHeight: 352, scrollHeight: 860, overflowY: "auto" },
      verdict: "RED_MOBILE_ADD_RISK_ROW_TOUCH_TARGET_BELOW_44PX",
    },
    afterLocal: ["day", "night"].map((theme) => ({
      source: "http://127.0.0.1:3084",
      theme,
      viewport: { width: 390, height: 723 },
      documentHeight: 723,
      horizontalOverflow: 0,
      addRiskRowButton: { height: 44, minHeight: "44px", width: 90.34 },
      shell: { clientHeight: 352, scrollHeight: 732, overflowY: "auto" },
      verdict: "PASS",
    })),
    afterLive: ["day", "night"].map((theme) => ({
      source: "https://www.safeclaw.kr",
      theme,
      viewport: { width: 390, height: 723 },
      documentHeight: 723,
      horizontalOverflow: 0,
      addRiskRowButton: { height: 44, minHeight: "44px", width: 90.5 },
      shell: { clientHeight: 352, scrollHeight: 868, overflowY: "auto" },
      verdict: "PASS",
    })),
  });
  writeJson(rootDir, path.join("evaluation", "document-risk-row-add-touch-2026-08-27", "report.json"), {
    schema: "safeclaw-document-risk-row-add-touch/v1",
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_ADD_TOUCH_TARGET",
    productCommit: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", branch: "master", environment: "production" },
    scope: {
      route: "/documents",
      selectedDocument: "riskAssessmentDraft",
      action: "addRiskRow",
      viewport: { width: 390, height: 723 },
      themes: ["day", "night"],
      existingSelectedOnlyWorkbenchPreserved: true,
      routeSplitAloneAcceptedAsFix: false,
    },
    beforeLive: {
      commitSha: "eb0000396fde7ab41e37f2853318d8bacadd91b1",
      buttonHeight: 32,
      requiredHeight: 44,
      verdict: "RED_MOBILE_ADD_RISK_ROW_TOUCH_TARGET_BELOW_44PX",
    },
    afterLocal: { passCount: 2, rowCount: 2, buttonHeight: 44 },
    afterLive: {
      passCount: 2,
      rowCount: 2,
      buttonHeight: 44,
      metricsPath: "evaluation/document-risk-row-add-touch-2026-08-27/browser-metrics.json",
    },
    verification: {
      cssTokenContract: { files: 1, tests: 3, failed: 0, status: "PASS" },
      typecheck: "PASS",
      build: { status: "PASS", staticPages: 28 },
      localBrowser: { rows: 2, passed: 2, status: "PASS" },
      liveBrowser: { rows: 2, passed: 2, status: "PASS" },
      visualInspection: { screenshots: 5, status: "PASS" },
      isolatedBrowserHarness: {
        status: "ENVIRONMENT_TIMEOUT_BEFORE_ASSERTION",
        productAssertionExecuted: false,
        treatedAsProductFailure: false,
      },
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
      llmWikiPublication: "APPROVAL_GATED",
      sifEmbeddingRuntime: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      koshaExactPromotionReview: "APPROVAL_GATED",
      humanReviewCompleted: false,
    },
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
  writeText(
    rootDir,
    path.join("evaluation", "kosha-exact-promotion-review-gate-2026-07-22", "review-template.md"),
    [
      "# KOSHA Exact Promotion Human Review Checklist",
      "",
      "- 기계 evidence는 사람 검토를 대체하지 않습니다.",
      "- 체크 완료만으로 exact-trust promotion이 승인되거나 registry artifact가 생성되지 않습니다.",
      "- 별도 promotion 승인 전에는 exact-kosha registry를 생성하거나 수정하지 않습니다.",
      "",
      ...Array.from({ length: 8 }, (_, candidateIndex) => [
        `## ${candidateIndex + 1}. KEY-${candidateIndex} · Official title ${candidateIndex}`,
        "",
        `- 공식 PDF: [KOSHA PDF 열기](https://kosha.example.test/KEY-${candidateIndex}.pdf)`,
        ...Array.from({ length: 3 }, (_, groupIndex) => [
          `- Group ${groupIndex + 1}: term-${groupIndex + 1}`,
          `  - page receipt: p.${groupIndex + 1} chars 10-20 sha dddddddddddd`,
        ]).flat(),
        ...Array.from({ length: 6 }, (_, inputIndex) => `- [ ] Human input ${inputIndex + 1}`),
        "",
      ]).flat(),
    ].join("\n"),
  );
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
    pageReceiptCount: 24,
    semanticGroupsWithoutPageReceipt: 0,
    bodySnapshotId: "fixture-snapshot",
    bodySourceIdentitySha256: "c".repeat(64),
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
    results: Array.from({ length: 8 }, (_, candidateIndex) => ({
      stableKey: `KEY-${candidateIndex}`,
      contentRationaleMachineSupported: true,
      failedSemanticGroups: [],
      humanReviewCompleted: false,
      humanConfirmed: false,
      semanticGroups: Array.from({ length: 3 }, (_, groupIndex) => ({
        group: groupIndex + 1,
        evidenceTerm: `term-${groupIndex + 1}`,
        matchBodyCharStart: groupIndex * 100 + 10,
        matchBodyCharEnd: groupIndex * 100 + 20,
        locationMappingComplete: true,
        locationMappingFailure: null,
        machineSupported: true,
        pageReceipts: [{
          pageNumber: groupIndex + 1,
          bodyCharStart: groupIndex * 100,
          bodyCharEnd: (groupIndex + 1) * 100,
          matchCharStart: groupIndex * 100 + 10,
          matchCharEnd: groupIndex * 100 + 20,
          normalizedTextSha256: "d".repeat(64),
          ocrCandidate: false,
        }],
      })),
    })),
  });
  writeJson(rootDir, path.join("evaluation", "hermes-knowledge-review-event-facts-2026-08-26", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVENT_FACT_TRACEABILITY",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    beforeLive: { verdict: "RED_HERMES_REVIEW_EVENT_FACTS", viewportCount: 8, passedCount: 0, failedCount: 8, visibleFactCount: 0, boundFactCount: 0 },
    local: { verdict: "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_EVENT_FACTS", viewportCount: 8, passedCount: 8, failedCount: 0 },
    afterLive: { verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVENT_FACTS", viewportCount: 8, passedCount: 8, failedCount: 0, productionAligned: true, browserErrorCount: 0 },
    eventFactsContract: {
      explicitReviewFactsOnly: true,
      expectedFactCount: 2,
      panelCount: 1,
      visibleFactCount: 2,
      boundFactCount: 2,
      evidenceRowCount: 1,
      orphanFactCount: 0,
      insideCandidatePane: true,
      candidateBodyMarkerDuplicated: false,
      privateEventTextExposed: false,
      humanVerificationRequired: true,
      beforeVisibleFactCount: 0,
      beforeBoundFactCount: 0,
      humanReviewCompleted: false,
      machineEvidenceReplacesHumanReview: false,
      publicationState: "unpublished",
    },
    compatibilityContracts: {
      providerCancellation: {
        verdict: "PASS_CURRENT_SOURCE_HERMES_EVENT_FACT_PROVIDER_CANCELLATION_COMPATIBILITY",
        sourceHead: "fixture-sha",
        changedGovernedPath: "lib/knowledge-candidate-route.ts",
        focusedVitest: { file: "tests/knowledge-regenerate-route.test.ts", files: 1, tests: 18, failed: 0 },
        requestSignalForwardedToGeneration: true,
        abortSkipsProviderFallback: true,
        originalSecurityBaselineRewritten: false,
      },
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      ontologyPublicationPerformed: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    securityBoundary: { immutableOriginal18FindingBaselinePreserved: true },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
    },
  });
  writeJson(rootDir, path.join("evaluation", "hermes-knowledge-review-trace-blocks-2026-08-26", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_BLOCKS",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    beforeLive: { verdict: "RED_HERMES_REVIEW_TRACE_BLOCKS", viewportCount: 8, passedCount: 0, failedCount: 8, panelCount: 0, resolvedTraceCount: 0, unresolvedTraceCount: 0 },
    local: { verdict: "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_TRACE_BLOCKS", viewportCount: 8, passedCount: 8, failedCount: 0 },
    afterLive: { verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_BLOCKS", viewportCount: 8, passedCount: 8, failedCount: 0, productionAligned: true, browserErrorCount: 0 },
    traceabilityContract: {
      expectedTraceCount: 1,
      panelCount: 1,
      resolvedTraceCount: 1,
      unresolvedTraceCount: 0,
      hazardBound: true,
      controlsBound: true,
      primaryDocumentsBound: true,
      evidenceRowsBound: true,
      insideCandidatePane: true,
      approvalFailsClosedWhenIncomplete: true,
      humanReviewCompleted: false,
      publicationState: "unpublished",
      beforePanelCount: 0,
      beforeResolvedTraceCount: 0,
      beforeUnresolvedTraceCount: 0,
      scopedFixtureHazardCount: 1,
      allHazardsClosed: false,
      allDocumentsClosed: false,
      machineEvidenceReplacesHumanReview: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      ontologyPublicationPerformed: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    securityBoundary: { immutableOriginal18FindingBaselinePreserved: true },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
    },
  });
  writeJson(rootDir, path.join("evaluation", "hermes-knowledge-review-trace-matrix-2026-08-26", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_MATRIX",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    beforeLive: {
      verdict: "RED_HERMES_REVIEW_TRACE_MATRIX",
      viewportCount: 8,
      passedCount: 0,
      failedCount: 8,
      canonicalMatrixComplete: false,
      missingControls: ["사진·증빙 보관"],
      missingPrimaryDocuments: ["안전보건교육"],
    },
    local: { verdict: "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_TRACE_MATRIX", viewportCount: 8, passedCount: 8, failedCount: 0 },
    afterLive: { verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_MATRIX", viewportCount: 8, passedCount: 8, failedCount: 0, productionAligned: true, browserErrorCount: 0 },
    traceabilityContract: {
      expectedTraceCount: 8,
      panelCount: 1,
      resolvedTraceCount: 8,
      unresolvedTraceCount: 0,
      canonicalHazardCount: 8,
      canonicalControlLinkCount: 33,
      canonicalDocumentLinkCount: 33,
      canonicalMatrixComplete: true,
      traceListInternalScroll: false,
      traceScrollOwner: "candidate-pane",
      candidatePaneInternalScroll: true,
      traceScreenshotContextVisible: true,
      missingControls: [],
      missingPrimaryDocuments: [],
      hazardBound: true,
      controlsBound: true,
      primaryDocumentsBound: true,
      evidenceRowsBound: true,
      insideCandidatePane: true,
      approvalFailsClosedWhenIncomplete: true,
      humanReviewCompleted: false,
      publicationState: "unpublished",
      beforeCanonicalMatrixComplete: false,
      allHazardsClosed: true,
      allCanonicalMappingsClosed: true,
      machineEvidenceReplacesHumanReview: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      ontologyPublicationPerformed: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    securityBoundary: { immutableOriginal18FindingBaselinePreserved: true },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
    },
  });
  writeJson(rootDir, path.join("evaluation", "kosha-exact-promotion-reviewer-cockpit-2026-07-25", "report.json"), {
    schemaVersion: "safeclaw-kosha-exact-promotion-reviewer-cockpit/v1",
    verdict: "PASS_NO_MUTATION_KOSHA_REVIEWER_COCKPIT_READY",
    candidateCount: 8,
    semanticGroupCount: 24,
    pageReceiptCount: 24,
    titleReconciledCandidateCount: 2,
    bodySnapshotId: "fixture-snapshot",
    bodySourceIdentitySha256: "c".repeat(64),
    checklistInputCount: 64,
    initialCompletedInputCount: 0,
    exportInitiallyDisabled: true,
    reviewChecklistPath: path.join("evaluation", "kosha-exact-promotion-review-gate-2026-07-22", "review-template.md"),
    reviewChecklistMetrics: {
      candidateCount: 8,
      uncheckedInputCount: 48,
      precheckedInputCount: 0,
      officialPdfLinkCount: 8,
      pageReceiptCount: 24,
      boundaryPreserved: true,
    },
    accessibilityContract: {
      candidateTabCount: 8,
      candidateRovingTabStop: true,
      candidateKeyboardNavigation: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"],
      breakpointOrientationSynchronized: true,
      mobileEvidenceReviewTabs: true,
      responsiveTabPanelSemantics: true,
      candidateBoundDraftStorage: true,
      evidencePageReceipts: true,
      draftBoundToCorpusIdentity: true,
      titleProvenanceVisible: true,
      progressLiveRegion: true,
      candidatePositionLabels: true,
      mobileCandidateProgressVisible: true,
      visibleDraftPersistenceStatus: true,
      draftRestoreStatusVisible: true,
      draftSaveFailureVisible: true,
      nextIncompleteCandidateNavigation: true,
      futureReviewTimestampBlocked: true,
      mobileCandidateScrollSnap: true,
      selectedCandidateAutoReveal: true,
      readableEvidenceCues: true,
      rawEvidenceExcerptPreservedInDisclosure: true,
      reviewerChecklistLinkVisible: true,
      reviewerChecklistLinkAvailableBeforeCompletion: true,
    },
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
  writeJson(rootDir, path.join("evaluation", "dispatch-first-viewport-containment-2026-08-27", "report.json"), {
    verdict: "PASS_LIVE_PRODUCTION_STANDALONE_DISPATCH_FIRST_VIEWPORT_CONTAINMENT",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    beforeLive: {
      verdict: "RED_DESKTOP_CONTROLS_HIDDEN_IN_INTERNAL_SCROLL_MOBILE_CARD_METAPHOR",
      desktopShort: {
        rootScrollDebt: 232,
        channelActionBottom: 892,
      },
    },
    afterLive: {
      total: 4,
      pass: 4,
      fail: 0,
      desktopShort: {
        day: {
          viewportHeight: 723,
          rootScrollDebt: 1,
          primaryBottom: 448,
          previewBottom: 639,
          channelActionBottom: 706,
          titleFontSize: 20,
          statusReasonFontSize: 12,
          channelHeadingFontSize: 12,
          channelCardWidths: [193, 193, 193],
          channelCardTops: [616, 616, 616],
          horizontalOverflow: 0,
        },
        night: {
          viewportHeight: 723,
          rootScrollDebt: 1,
          primaryBottom: 448,
          previewBottom: 639,
          channelActionBottom: 706,
          channelCardWidths: [193, 193, 193],
          channelCardTops: [616, 616, 616],
          horizontalOverflow: 0,
        },
      },
      mobileShort: {
        day: {
          viewportHeight: 723,
          summaryBottom: 522,
          primaryBottom: 581,
          visibleConfigCardCount: 0,
          horizontalOverflow: 0,
        },
        night: {
          viewportHeight: 723,
          summaryBottom: 522,
          primaryBottom: 581,
          visibleConfigCardCount: 0,
          horizontalOverflow: 0,
        },
      },
    },
    acceptanceContract: {
      routeSplitAloneAcceptedAsFix: false,
      desktopRequiresTwoPaneWorkbench: true,
      desktopRootScrollDebtAtMostOnePixel: true,
      desktopPrimaryPreviewAndChannelActionsInFirstViewport: true,
      desktopChannelCardsUseThreeReadableColumns: true,
      desktopComponentTypographyNotHeroTypography: true,
      mobilePrimaryActionContainedInFirstViewport: true,
      mobileConfigurationCollapsedByDefault: true,
      longPreviewUsesInternalScroll: true,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      embeddingOrVectorMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      exactSavedShareUserSessionReproduced: false,
      workspaceShareEvidenceSubstitutesForExactSavedSession: false,
    },
  });
  writeJson(rootDir, path.join("evaluation", "kosha-exact-promotion-reviewer-cockpit-2026-07-25", "browser-report.json"), {
    schemaVersion: "safeclaw-kosha-exact-promotion-reviewer-cockpit-browser/v1",
    verdict: "PASS_LOCAL_KOSHA_REVIEWER_COCKPIT_GEOMETRY",
    cases: 3,
    passedCases: 3,
    desktopPass: true,
    mobilePass: true,
    responsiveTabPanelPass: true,
    draftStorageIdentityPass: true,
    titleReconciliationPass: true,
    candidateNavigationReadabilityPass: true,
    evidenceReadingHierarchyPass: true,
    mobileCandidateProgressVisibilityPass: true,
    draftPersistenceVisibilityPass: true,
    nextIncompleteNavigationPass: true,
    futureReviewTimestampPass: true,
    reviewChecklistAccessPass: true,
    draftStorageIdentity: {
      sameFingerprintPreserved: true,
      sourceIdentityPresent: true,
      staleEnvelopeInjected: true,
      staleFingerprintDiscarded: true,
      staleExportDisabled: true,
      staleDraftNotice: "후보 구성이 변경되어 이전 검토 초안을 복원하지 않았습니다. 0개 완료, 64개 입력이 남았습니다.",
      emptyDraftStatus: "로컬 초안 · 빈 상태 저장됨",
      changedDraftStatus: "로컬 초안 · 변경사항 저장됨",
      restoredDraftStatus: "로컬 초안 · 저장된 입력 복원됨",
      staleDraftStatus: "로컬 초안 · 이전 초안 제외 · 빈 상태 저장됨",
      saveFailureStatus: "로컬 초안 · 저장 실패 · 입력은 현재 화면에만 유지",
      nextIncompleteInitialSelectedIndex: 1,
      nextIncompleteSkippedCompletedIndex: 2,
      futureTimestampState: {
        ariaInvalid: "true",
        errorVisible: true,
        candidateProgress: "0/8",
      },
      titleReconciliationAccess: {
        candidateVisible: true,
        officialCurrentTitleVisible: true,
        corpusSourceTitleVisible: true,
        provenanceFullyVisible: true,
      },
    },
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
      candidateRail: { top: 68, bottom: row.viewport.height - 52 },
      candidateContext: { top: 74, bottom: 90 },
      visibleCandidatePanelCount: 1,
      candidateButtonCount: 8,
      candidateTablistRole: "tablist",
      candidateTablistOrientation: row.viewport.width <= 767 ? "horizontal" : "vertical",
      selectedCandidateTabCount: 1,
      tabbableCandidateTabCount: 1,
      candidateControlLinksValid: true,
      candidateEndState: { selectedIndex: 7, focusedIndex: 7, selectedFullyVisible: true },
      candidateHomeState: { selectedIndex: 0, focusedIndex: 0, selectedFullyVisible: true },
      candidateContextText: "후보 1/8 · 현재 0/8 · 전체 0/64",
      candidateRailHeaderDisplay: "flex",
      firstCandidateButtonWidth: row.viewport.width <= 767 ? 176 : 205,
      selectedCandidateText: "D-C-1 · 후보 1/8 D-C-1-2026 0/8",
      progressLiveRole: "status",
      progressLiveMode: "polite",
      draftStatusRole: "status",
      draftStatusLiveMode: "polite",
      draftStatusText: "로컬 초안 · 빈 상태 저장됨",
      draftStatusVisible: true,
      mobileTablistRole: "tablist",
      selectedMobileTabCount: 1,
      tabbableMobileTabCount: 1,
      mobileControlLinksValid: true,
      selectedCandidateMobilePaneRoleCount: row.viewport.width <= 767 ? 2 : 0,
      selectedCandidateVisibleMobilePaneCount: row.viewport.width <= 767 ? 1 : 2,
      requiredCheckCount: 40,
      semanticGroupCount: 24,
      evidenceReceiptCount: 24,
      evidenceReadingCueCount: 24,
      rawExcerptDisclosureCount: 24,
      openRawExcerptDisclosureCount: 0,
      rawExcerptTextPreserved: true,
      receiptAccess: row.name === "mobile-review-390x723"
        ? null
        : { fullyVisibleInsidePane: true },
      exportInitiallyDisabled: true,
      reviewChecklistVisible: true,
      reviewChecklistHref: "../kosha-exact-promotion-review-gate-2026-07-22/review-template.md",
      reviewChecklistTargetExists: true,
      nextIncompleteVisible: true,
      nextIncompleteInitiallyEnabled: true,
      reviewedAtMaxPresent: true,
      futureTimestampErrorInitiallyHidden: true,
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
  writeJson(rootDir, path.join("evaluation", "hermes-openclaw-runtime-current-gate-2026-07-20", "report.json"), {
    verdict: "adapter_boundary_pass_live_execution_not_claimed",
    sourceShaForFocusedTests: "fixture-sha",
    sourceHeadMatchesProduction: true,
    productionBuildInfoAtLiveSmoke: { commitSha: "fixture-sha" },
    focusedTests: { status: "pass", testFilesPassed: 15, testsPassed: 333 },
    liveUnauthenticatedBrokerSmoke: {
      status: "pass", httpStatus: 401, code: "AUTH_REQUIRED", engineExecutionReached: false,
    },
    sourceContract: {
      routeWiresConfiguredTransport: true,
      configuredTransportFailsClosed: true,
      trustedTransportWired: true,
      durableAttemptLedgerWired: true,
      ledgerExplicitOptIn: true,
      ledgerAtomicReservation: true,
      ledgerTerminalRequiresReservation: true,
      ledgerStoresTerminalDigestOnly: true,
      readinessKeepsLedgerOpen: true,
      executionReadyClaimed: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchLiveClaimed: false,
      shareSessionCreated: false,
      vectorRuntimeActivated: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
      engineExecutionClaimed: false,
      liveAuthenticatedExecutionPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
      sifEmbeddingRuntime: "APPROVAL_GATED",
      koshaExactPromotion: "APPROVAL_GATED",
      authenticatedHermesCanary: "APPROVAL_GATED",
    },
    liveExecutionReadiness: { claimed: false },
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

describe("northstar open gate audit", { timeout: 60_000 }, () => {
  it("keeps approval-gated north-star work open instead of complete", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.overall).toBe("open");
    expect(audit.gates.find((gate) => gate.id === "stale_approval_evidence_binding_security")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "current-source-security-stale-approval-evidence-binding-remediation-2026-08-31", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "stale_approval_evidence_binding_security")?.detail).toContain("All four workflows remain fail-closed");
    expect(audit.gates.find((gate) => gate.id === "stale_approval_evidence_binding_security")?.detail).toContain("exact saved Share remains MISSING_EVIDENCE");
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
    expect(audit.gates.find((gate) => gate.id === "live_document_field_isolation")?.detail).toContain("heat guidance absent for chemical cleaning");
    expect(audit.gates.find((gate) => gate.id === "live_document_field_isolation")?.detail).toContain("work-unit 0");
    expect(audit.gates.find((gate) => gate.id === "live_document_field_isolation")?.detail).toContain("roof-repair heat case");
    expect(audit.gates.find((gate) => gate.id === "live_document_field_isolation")?.detail).toContain("warehouse seed absent");
    expect(audit.gates.find((gate) => gate.id === "live_document_field_isolation")?.detail).toContain("5/5 live fallback accident-case arrays");
    expect(audit.gates.find((gate) => gate.id === "live_document_field_isolation")?.detail).toContain("0 unrelated-industry cases");
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
    expect(audit.gates.find((gate) => gate.id === "current_live_document_editorial_runtime")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "live-document-editorial-template-runtime-2026-08-27", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "current_live_document_editorial_runtime")?.detail).toContain("60/60 document surfaces");
    expect(audit.gates.find((gate) => gate.id === "current_live_document_editorial_runtime")?.detail).toContain("DISTRIBUTED_RATE_LIMIT_UNAVAILABLE");
    expect(audit.gates.find((gate) => gate.id === "current_live_document_editorial_runtime")?.detail).toContain("runtime mode/work-unit contract 5/5");
    expect(audit.gates.find((gate) => gate.id === "current_live_document_editorial_runtime")?.detail).toContain("no provider-backed editorial PASS is claimed");
    expect(audit.gates.find((gate) => gate.id === "current_live_document_editorial_runtime")?.detail).toContain("exact saved Share remains MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "document_editorial_review_cockpit")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "document-editorial-review-cockpit-2026-08-16", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "document_editorial_review_cockpit")?.detail).toContain("pass 4/4");
    expect(audit.gates.find((gate) => gate.id === "document_editorial_review_cockpit")?.detail).toContain("12 canonical documents");
    expect(audit.gates.find((gate) => gate.id === "document_editorial_review_cockpit")?.detail).toContain("five explicit reviewer checks");
    expect(audit.gates.find((gate) => gate.id === "document_editorial_review_cockpit")?.detail).toContain("zero API calls");
    expect(audit.gates.find((gate) => gate.id === "document_editorial_review_cockpit")?.detail).toContain("no current-workpack mutation");
    expect(audit.gates.find((gate) => gate.id === "document_editorial_review_cockpit")?.detail).toContain("Arrow/Home roving navigation");
    expect(audit.gates.find((gate) => gate.id === "document_editorial_review_cockpit")?.detail).toContain("Escape focus restoration");
    expect(audit.gates.find((gate) => gate.id === "document_editorial_review_cockpit")?.detail).toContain("empty -> saved -> reload-restored");
    expect(audit.gates.find((gate) => gate.id === "document_editorial_review_cockpit")?.detail).toContain("storage-denial probe fails visibly");
    expect(audit.gates.find((gate) => gate.id === "document_editorial_review_cockpit")?.detail).toContain("humanReviewCompleted=false");
    expect(audit.gates.find((gate) => gate.id === "document_editorial_review_cockpit")?.detail).toContain("fail-closed local JSON export");
    expect(audit.gates.find((gate) => gate.id === "document_editorial_review_cockpit")?.detail).toContain("does not prove reviewer identity");
    expect(audit.gates.find((gate) => gate.id === "document_editorial_review_cockpit")?.detail).toContain("exact saved Share remains MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "product-capability-truth-2026-07-25", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")?.detail).toContain("preview-only");
    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")?.detail).toContain("dispatch-entry-capability-truth");
    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")?.detail).toContain("landing-human-review-boundary");
    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")?.detail).toContain("exact saved Share remains MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "product_capability_truth")?.detail).toContain("Scoped Documents and Workspace/fixture Share viewport IA");
    expect(audit.gates.find((gate) => gate.id === "ci_supply_chain_full_suite")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "ci-full-suite-remediation-2026-08-29", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "ci_supply_chain_full_suite")?.detail).toContain("3098-pass/5-fail");
    expect(audit.gates.find((gate) => gate.id === "ci_supply_chain_full_suite")?.detail).toContain("3114/3140 tests");
    expect(audit.gates.find((gate) => gate.id === "ci_supply_chain_full_suite")?.detail).toContain("zero Node 20 deprecation warnings");
    expect(audit.gates.find((gate) => gate.id === "ci_supply_chain_full_suite")?.detail).toContain("does not close other security findings");
    expect(audit.gates.find((gate) => gate.id === "ci_supply_chain_full_suite")?.detail).toContain("exact saved Share remains MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "knowledge_preparation_capability_truth")).toMatchObject({
      state: "notice",
      evidencePath: path.join("evaluation", "knowledge-preparation-capability-truth-2026-08-28", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "knowledge_preparation_capability_truth")?.detail).toContain("marker-only capability truth");
    expect(audit.gates.find((gate) => gate.id === "knowledge_preparation_capability_truth")?.detail).toContain("enhanced LLM preparation remains blocked");
    expect(audit.gates.find((gate) => gate.id === "knowledge_preparation_capability_truth")?.detail).toContain("exact saved Share remains MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "launch_operations_readiness_cockpit")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "launch-operations-readiness-2026-08-26", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "launch_operations_readiness_cockpit")?.detail).toContain("passes 4/4");
    expect(audit.gates.find((gate) => gate.id === "launch_operations_readiness_cockpit")?.detail).toContain("provider dispatch preview-only");
    expect(audit.gates.find((gate) => gate.id === "launch_operations_readiness_cockpit")?.detail).toContain("exact saved Share remains MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "distributed_admission_activation")).toMatchObject({
      state: "approval_gated",
      evidencePath: path.join("evaluation", "distributed-admission-activation-approval-2026-08-29", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "distributed_admission_activation")?.detail).toContain("not activated");
    expect(audit.gates.find((gate) => gate.id === "distributed_admission_activation")?.detail).toContain("remote Hermes mode separate");
    expect(audit.gates.find((gate) => gate.id === "distributed_admission_activation")?.detail).toContain("exact saved Share as MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "document_export_capability_truth")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "document-export-capability-truth-2026-08-17", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "document_export_capability_truth")?.detail).toContain("honestly locked");
    expect(audit.gates.find((gate) => gate.id === "document_export_capability_truth")?.detail).toContain("OPERATOR_CONFIGURATION_REQUIRED");
    expect(audit.gates.find((gate) => gate.id === "document_export_capability_truth")?.detail).toContain("exact saved Share remains MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "ontology_viewport_workbench")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "ontology-viewport-workbench-2026-08-17", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "ontology_viewport_workbench")?.detail).toContain("mobile task switching passes 4/4");
    expect(audit.gates.find((gate) => gate.id === "ontology_viewport_workbench")?.detail).toContain("exact saved Share remains MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "knowledge_viewport_workbench")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "knowledge-mobile-task-rail-2026-08-27", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "knowledge_viewport_workbench")?.detail).toContain("six reachable tasks");
    expect(audit.gates.find((gate) => gate.id === "knowledge_viewport_workbench")?.detail).toContain("KOSHA disclosures are 6/7");
    expect(audit.gates.find((gate) => gate.id === "knowledge_viewport_workbench")?.detail).toContain("Wiki/governance disclosures are 2/2");
    expect(audit.gates.find((gate) => gate.id === "knowledge_viewport_workbench")?.detail).toContain("3x2, 129px block to one 46px horizontal rail");
    expect(audit.gates.find((gate) => gate.id === "knowledge_viewport_workbench")?.detail).toContain("panel top from 437.99px to 381.97px");
    expect(audit.gates.find((gate) => gate.id === "llm_wiki_candidate_content_readiness")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "llm-wiki-candidate-readiness-2026-08-25", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "llm_wiki_candidate_content_readiness")?.detail).toContain("four required sections");
    expect(audit.gates.find((gate) => gate.id === "llm_wiki_candidate_content_readiness")?.detail).toContain("exact saved Share remains MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "llm_wiki_candidate_content_matrix")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "llm-wiki-candidate-content-matrix-2026-08-25", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "llm_wiki_candidate_content_matrix")?.detail).toContain("pass 5/5");
    expect(audit.gates.find((gate) => gate.id === "llm_wiki_candidate_content_matrix")?.detail).toContain("blocked 0/5");
    expect(audit.gates.find((gate) => gate.id === "llm_wiki_candidate_content_matrix")?.detail).toContain("event review facts separately move 0/5 to 5/5");
    expect(audit.gates.find((gate) => gate.id === "llm_wiki_candidate_content_matrix")?.detail).toContain("exact saved Share remains MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "llm_wiki_sif_evidence_matrix")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "llm-wiki-sif-evidence-matrix-2026-08-26", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "llm_wiki_sif_evidence_matrix")?.detail).toContain("SIF -> KOSHA -> law");
    expect(audit.gates.find((gate) => gate.id === "llm_wiki_sif_evidence_matrix")?.detail).toContain("exact saved Share remains MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "knowledge_viewport_workbench")?.detail).toContain("first review state panel-contained=true");
    expect(audit.gates.find((gate) => gate.id === "knowledge_viewport_workbench")?.detail).toContain("Wiki publication plus SIF embedding remain APPROVAL_GATED");
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
    expect(audit.gates.find((gate) => gate.id === "public_search_distributed_rate_limit_readiness")?.detail).toContain("HTTP 503");
    expect(audit.gates.find((gate) => gate.id === "public_search_distributed_rate_limit_readiness")?.detail).toContain("not configured distributed protection");
    expect(audit.gates.find((gate) => gate.id === "public_search_distributed_rate_limit_readiness")?.detail).toContain("database findings remain approval-gated");
    expect(audit.gates.find((gate) => gate.id === "public_search_distributed_rate_limit_readiness")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "public_generation_admission_security")).toMatchObject({
      state: "notice",
      evidencePath: path.join("evaluation", "security-public-generation-admission-2026-08-04", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "public_generation_admission_security")?.detail).toContain("503 DISTRIBUTED_RATE_LIMIT_UNAVAILABLE");
    expect(audit.gates.find((gate) => gate.id === "public_generation_admission_security")?.detail).toContain("before reference search, AI/provider work, or DB mutation");
    expect(audit.gates.find((gate) => gate.id === "public_generation_admission_security")?.detail).toContain("fresh scan remain open");
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
    expect(audit.gates.find((gate) => gate.id === "public_ask_distributed_admission")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "public-ask-distributed-admission-2026-08-14", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "public_ask_distributed_admission")?.detail).toContain("csf_9b3cc6648586dabf4bfa61e9");
    expect(audit.gates.find((gate) => gate.id === "public_ask_distributed_admission")?.detail).toContain("OPERATOR_CONFIGURATION_REQUIRED");
    expect(audit.gates.find((gate) => gate.id === "public_ask_distributed_admission")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "public_search_distributed_admission")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "public-search-distributed-admission-2026-08-14", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "public_search_distributed_admission")?.detail).toContain("csf_bb897a39277591f4fbab0ca7");
    expect(audit.gates.find((gate) => gate.id === "public_search_distributed_admission")?.detail).toContain("OPERATOR_CONFIGURATION_REQUIRED");
    expect(audit.gates.find((gate) => gate.id === "public_search_distributed_admission")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "mcp_generation_work_budget_security")).toMatchObject({
      state: "notice",
      evidencePath: path.join("evaluation", "security-mcp-generation-work-budget-2026-08-04", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "mcp_generation_work_budget_security")?.detail).toContain("96 KiB");
    expect(audit.gates.find((gate) => gate.id === "mcp_generation_work_budget_security")?.detail).toContain("503 DISTRIBUTED_RATE_LIMIT_UNAVAILABLE");
    expect(audit.gates.find((gate) => gate.id === "mcp_generation_work_budget_security")?.detail).toContain("configurationState=absent");
    expect(audit.gates.find((gate) => gate.id === "mcp_generation_work_budget_security")?.detail).toContain("required but not configured");
    expect(audit.gates.find((gate) => gate.id === "mcp_generation_work_budget_security")?.detail).toContain("8 files / 126 adjacent MCP tests");
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
      evidencePath: path.join("evaluation", "hermes-knowledge-review-selected-workbench-2026-08-14", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_ui")?.detail).toContain("8/8");
    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_ui")?.detail).toContain("four numbered");
    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_ui")?.detail).toContain("multiline continuation");
    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_ui")?.detail).toContain("actual production candidate queue");
    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_ui")?.detail).toContain("APPROVAL_GATED");
    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_ui")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_decision_first_viewport")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "hermes-review-decision-first-viewport-2026-08-27", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "hermes_review_decision_first_viewport")?.detail).toContain("0/8 to 8/8");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_decision_first_viewport")?.detail).toContain("532.44/622.75");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_decision_first_viewport")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_decision_first_viewport")?.detail).toContain("APPROVAL_GATED");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_candidate_position")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "hermes-review-candidate-position-2026-08-27", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "hermes_review_candidate_position")?.detail).toContain("1/3, 2/3, 3/3");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_candidate_position")?.detail).toContain("no retroactive RED runner claim");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_candidate_position")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_evidence_inspector")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "hermes-evidence-digest-readability-2026-08-26", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "hermes_review_evidence_inspector")?.detail).toContain("8/8");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_evidence_inspector")?.detail).toContain("242x18px");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_evidence_inspector")?.detail).toContain("167.75px desktop");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_evidence_inspector")?.detail).toContain("104px mobile");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_evidence_inspector")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_evidence_inspector")?.detail).toContain("fresh full-repository scan");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_event_fact_traceability")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "hermes-knowledge-review-event-facts-2026-08-26", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "hermes_review_event_fact_traceability")?.detail).toContain("zero orphan facts");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_event_fact_traceability")?.detail).toContain("not complete hazard-to-control-to-document-to-evidence");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_event_fact_traceability")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_trace_blocks")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "hermes-knowledge-review-trace-blocks-2026-08-26", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "hermes_review_trace_blocks")?.detail).toContain("one scoped hazard");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_trace_blocks")?.detail).toContain("not all-hazard or all-document closure");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_trace_blocks")?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_trace_matrix")).toMatchObject({
      state: "proven",
      evidencePath: path.join("evaluation", "hermes-knowledge-review-trace-matrix-2026-08-26", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "hermes_review_trace_matrix")?.detail).toContain("8 hazards, 33 controls, and 33 primary-document bindings");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_trace_matrix")?.detail).toContain("MISSING_EVIDENCE");
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
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("327/360px to 327/327px");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("active risk row at 264/264px");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("mobile document-review launcher overlap moved from 1 to 0");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("44px section actions");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("44px risk-row selectors");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("44x44 human-review close control");
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
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("five-row density companion");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("two rows/94px to one horizontal row/46px");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("active hazard field bottom to 667px");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("restores the mobile + 위험 항목 action from 32px to 44px");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("12 document first-task cockpits");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("staged Share rail");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("desktop-short 1440x723");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("three-zone cockpit");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("1180px workspace step rail");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("zero overflowing step-status labels");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("390x723 mobile stack");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("invited recipient fixture retains a separate desktop two-zone contract");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("closed by default with a visible + affordance");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("메일, 문자, and 카카오 channel labels each remain on one nowrap line");
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
      path.join("evaluation", "live-current-documents-share-geometry-2026-08-31", "report.json"),
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
      evidencePath: path.join("evaluation", "live-documents-share-route-perception-2026-08-28", "report.json"),
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
      path.join("evaluation", "dispatch-first-viewport-containment-2026-08-27", "report.json"),
    );
    expect(audit.gates.find((gate) => gate.id === "dispatch_standalone_cockpit")?.detail).toContain("hidden root scroll debt 232->1px");
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
    expect(audit.gates.find((gate) => gate.id === "llm_wiki_publication")?.detail).toContain("candidates/selected/body 3/1/1");
    expect(audit.gates.find((gate) => gate.id === "llm_wiki_publication")?.detail).toContain("private raw identity exposed=false");
    expect(audit.gates.find((gate) => gate.id === "llm_wiki_publication")?.detail).toContain("Exact saved Share remains MISSING_EVIDENCE");
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
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.detail).toContain("24/24 PDF page/body location receipts");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.detail).toContain("2 reconciled official/corpus title provenance rows");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.detail).toContain("64 required human inputs");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.detail).toContain("viewport-contained no-mutation UI");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.detail).toContain("human checklist is directly reachable before completion");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.detail).toContain("48 initially unchecked human inputs");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.detail).toContain("8 official PDF links");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.detail).toContain("24 page receipts");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.nextActions.join("\n")).toContain(
      "Re-run scripts\\kosha_exact_promotion_review_gate.mjs",
    );
    expect(audit.forbiddenClaims).toContain("LLM Wiki publishes itself.");
    expect(audit.forbiddenClaims).toContain("All KOSHA metadata-verified candidates are exact production evidence.");
    expect(audit.forbiddenClaims).toContain("KOSHA operator checklist completion alone approves exact-trust promotion.");
    expect(audit.forbiddenClaims).toContain("Real provider dispatch is production-live for any channel before persistent idempotency and provider result persistence approval.");
    expect(audit.safeDemoClaims).toContain("Photo hazard analysis readiness supports up to 10 images and keeps Before/After improvements as reviewed operation memory.");
  });

  it("fails the CI full-suite gate closed when approval boundaries are claimed closed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "ci-full-suite-remediation-2026-08-29", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      boundaries: { approvalGatedBoundariesClosed: boolean; exactSavedShareVerdict: string };
    };
    report.boundaries.approvalGatedBoundariesClosed = true;
    report.boundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, sourceSha: "fixture-sha" });
    const gate = audit.gates.find((item) => item.id === "ci_supply_chain_full_suite");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.detail).toContain("exactShare=PASS");
    expect(gate?.detail).toContain("noMutation=false");
  });

  it("fails the CI full-suite gate closed when the Node 20 deprecation warning returns", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "ci-full-suite-remediation-2026-08-29", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      actionRuntimeUpgrade: { node20DeprecationWarningCount: number };
    };
    report.actionRuntimeUpgrade.node20DeprecationWarningCount = 1;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, sourceSha: "fixture-sha" });
    const gate = audit.gates.find((item) => item.id === "ci_supply_chain_full_suite");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.detail).toContain("node24ActionsReady=false");
  });

  it.each([
    {
      label: "configuration is claimed ready despite the absent live state",
      mutate: (report: {
        configuration: { configurationState: string };
        liveProbes: Array<{ providerCallExecuted: boolean }>;
      }) => {
        report.configuration.configurationState = "ready";
      },
    },
    {
      label: "a provider call is claimed on the unavailable guard path",
      mutate: (report: {
        configuration: { configurationState: string };
        liveProbes: Array<{ providerCallExecuted: boolean }>;
      }) => {
        report.liveProbes[0].providerCallExecuted = true;
      },
    },
  ])("fails public-search distributed configuration truth closed when $label", async ({ mutate }) => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "public-search-distributed-rate-limit-readiness-2026-08-02",
      "report.json",
    );
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      configuration: { configurationState: string };
      liveProbes: Array<{ providerCallExecuted: boolean }>;
    };
    mutate(report);
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "public_search_distributed_rate_limit_readiness")).toMatchObject({
      state: "contradicted",
    });
  });

  it("fails the current editorial runtime boundary closed on a provider-backed overclaim", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "live-document-editorial-template-runtime-2026-08-27",
      "report.json",
    );
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      providerBoundary: { providerBackedLiveEditorialPassClaimed: boolean };
    };
    report.providerBoundary.providerBackedLiveEditorialPassClaimed = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "current_live_document_editorial_runtime")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "current_live_document_editorial_runtime")?.detail).toContain(
      "providerBoundaryPass=false",
    );
  });

  it("fails stale approval evidence binding closed when exact saved Share is overclaimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-source-security-stale-approval-evidence-binding-remediation-2026-08-31",
      "report.json",
    );
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      mutationBoundary: { exactSavedShareVerdict: string };
    };
    report.mutationBoundary.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "stale_approval_evidence_binding_security")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "stale_approval_evidence_binding_security")?.detail).toContain("exactShare=PASS");
  });

  it.each([
    {
      name: "human review completion",
      mutate: (report: Record<string, unknown>) => {
        (report.reviewBoundary as Record<string, unknown>).humanReviewCompleted = true;
      },
      detail: "humanReviewCompleted=true",
    },
    {
      name: "exact saved Share PASS",
      mutate: (report: Record<string, unknown>) => {
        (report.mutationBoundary as Record<string, unknown>).exactSavedShareVerdict = "PASS";
      },
      detail: "exactShare=PASS",
    },
    {
      name: "an API request",
      mutate: (report: Record<string, unknown>) => {
        const results = report.results as Array<Record<string, unknown>>;
        (results[0].afterCompletion as Record<string, unknown>).apiRequestCount = 1;
      },
      detail: "rowsPass=false",
    },
    {
      name: "missing Escape focus restoration",
      mutate: (report: Record<string, unknown>) => {
        const results = report.results as Array<Record<string, unknown>>;
        (results[0].accessibility as Record<string, unknown>).escapeRestoresLaunchFocus = false;
      },
      detail: "accessibilityPass=false",
    },
    {
      name: "a hidden storage failure",
      mutate: (report: Record<string, unknown>) => {
        (report.storageFailureProbe as Record<string, unknown>).visible = false;
      },
      detail: "storagePass=false",
    },
    {
      name: "reviewer storage overwritten after reload",
      mutate: (report: Record<string, unknown>) => {
        const results = report.results as Array<Record<string, unknown>>;
        (results[0].afterReload as Record<string, unknown>).persistedReviewer = "";
      },
      detail: "rowsPass=false",
    },
    {
      name: "a vector runtime mutation",
      mutate: (report: Record<string, unknown>) => {
        (report.mutationBoundary as Record<string, unknown>).vectorRuntimeCalled = true;
      },
      detail: "noMutation=false",
    },
  ])("contradicts the editorial review cockpit on $name", async ({ mutate, detail }) => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "document-editorial-review-cockpit-2026-08-16",
      "report.json",
    );
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as Record<string, unknown>;
    mutate(report);
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.overall).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "document_editorial_review_cockpit")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "document_editorial_review_cockpit")?.detail).toContain(detail);
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

    const compatibilityPath = path.join(
      rootDir,
      "evaluation",
      "current-security-governed-path-compatibility-2026-08-30",
      "report.json",
    );
    const compatibility = JSON.parse(fs.readFileSync(compatibilityPath, "utf8")) as {
      sourceHead: string;
      productionCommit: string;
    };
    compatibility.sourceHead = "self-asserted";
    compatibility.productionCommit = "self-asserted";
    fs.writeFileSync(compatibilityPath, `${JSON.stringify(compatibility, null, 2)}\n`, "utf8");

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
  it("keeps the current repository rescan at notice and fails closed on overclaim or count drift", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-full-repository-security-scan-2026-08-27",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "current_repository_security_rescan");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("19 findings (14 medium, 5 low)");
    expect(gate?.detail).toContain("partial across 9 reviewed surfaces with 26 deferred items");
    expect(gate?.detail).toContain("Production 607c39b3 includes focused remediation for six approval-free candidates");
    expect(gate?.detail).toContain("Share object-ID credential finding and twelve database/RLS/atomicity findings remain approval-gated");
    expect(gate?.detail).toContain("remains notice");
    expect(gate?.detail).toContain("not a proven or security-complete claim");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      findingDisposition: {
        approvalFreeProductSourceCandidateCount: number;
        approvalGatedDatabaseOrAtomicityCount: number;
      };
      currentSourceRemediation: {
        approvalFreeRemediatedCount: number;
        approvalSensitiveShareCapabilityCount: number;
        liveAfterDeployment: { sourceRemediationIncluded: boolean };
      };
      scan: { deferredCoverageItemCount: number };
      remainingBoundaries: {
        exactSavedShareVerdict: string;
        databaseSecurityRemediation: string;
      };
    };
    const original = JSON.stringify(report, null, 2);
    const contradictions: Array<(candidate: typeof report) => void> = [
      (candidate) => { candidate.remainingBoundaries.exactSavedShareVerdict = "PASS"; },
      (candidate) => { candidate.remainingBoundaries.databaseSecurityRemediation = "COMPLETED"; },
      (candidate) => { candidate.findingDisposition.approvalFreeProductSourceCandidateCount = 6; },
      (candidate) => { candidate.findingDisposition.approvalGatedDatabaseOrAtomicityCount = 11; },
      (candidate) => { candidate.currentSourceRemediation.approvalFreeRemediatedCount = 5; },
      (candidate) => { candidate.currentSourceRemediation.approvalSensitiveShareCapabilityCount = 0; },
      (candidate) => { candidate.currentSourceRemediation.liveAfterDeployment.sourceRemediationIncluded = false; },
      (candidate) => { candidate.scan.deferredCoverageItemCount = 25; },
    ];
    for (const contradict of contradictions) {
      const candidate = JSON.parse(original) as typeof report;
      contradict(candidate);
      fs.writeFileSync(reportPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
      const contradicted = buildNorthstarOpenGateAudit({ rootDir });
      expect(contradicted.gates.find((item) => item.id === "current_repository_security_rescan")?.state)
        .toBe("contradicted");
    }
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
      .toContain("126 adjacent MCP tests");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      contracts: { preservedBehavior: { existingTransportBodyAndAuthenticationBudgetsRetained: boolean } };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.contracts.preservedBehavior.existingTransportBodyAndAuthenticationBudgetsRetained = false;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const currentReceiptPath = path.join(
      rootDir,
      "evaluation",
      "current-security-governed-path-compatibility-2026-08-30",
      "report.json",
    );
    const currentReceipt = JSON.parse(fs.readFileSync(currentReceiptPath, "utf8")) as {
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    currentReceipt.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(currentReceiptPath, `${JSON.stringify(currentReceipt, null, 2)}\n`, "utf8");

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

  it("records the fresh current-source scan as notice and fails closed on boundary drift", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-source-standard-security-scan-2026-08-31-121c8a01-complete",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "fresh_current_source_security_scan");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("14 findings (10 medium, 4 low)");
    expect(gate?.detail).toContain("14 finding write-ups");
    expect(gate?.detail).toContain("partial canonical coverage across 21 recorded surface rows");
    expect(gate?.detail).toContain("22 deferred entries");
    expect(gate?.detail).toContain("Seven approval-free source findings");
    expect(gate?.detail).toContain("seven database/RLS/atomicity findings");
    expect(gate?.detail).toContain("current-source approval-free residual to five");
    expect(gate?.detail).toContain("production 18a9fc1a contains provider-output remediation e9934679");
    expect(gate?.detail).toContain("not security-complete");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      scan: { reportableFindingCount: number };
      currentDisposition: { approvalFreeProductSourceResidualCount: number };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "fresh_current_source_security_scan")?.state)
      .toBe("contradicted");
  });

  it("records the completed current-head scan as notice and fails closed on boundary or hash drift", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-head-standard-security-scan-2026-08-31-9504d8db-complete",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "completed_current_head_standard_security_scan");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("21 findings (7 medium, 14 low)");
    expect(gate?.detail).toContain("Canonical artifact hashes match");
    expect(gate?.detail).toContain("immutable original 18-finding baseline");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const manifestPath = path.join(
      rootDir,
      "evaluation",
      "current-head-standard-security-scan-2026-08-31-9504d8db-complete",
      "canonical",
      "scan-manifest.json",
    );
    const manifestLf = fs.readFileSync(manifestPath, "utf8").replaceAll("\r\n", "\n");
    fs.writeFileSync(manifestPath, manifestLf.replaceAll("\n", "\r\n"), "utf8");
    expect(buildNorthstarOpenGateAudit({ rootDir }).gates
      .find((item) => item.id === "completed_current_head_standard_security_scan")?.state).toBe("notice");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    expect(buildNorthstarOpenGateAudit({ rootDir }).gates
      .find((item) => item.id === "completed_current_head_standard_security_scan")?.state).toBe("contradicted");

    writeJson(rootDir, path.relative(rootDir, reportPath), completedCurrentHeadStandardSecurityScanFixture(
      (JSON.parse(fs.readFileSync(reportPath, "utf8")) as { canonicalArtifacts?: { sha256?: Record<string, string> } })
        .canonicalArtifacts?.sha256 ?? {},
    ));
    fs.appendFileSync(manifestPath, "drift", "utf8");
    expect(buildNorthstarOpenGateAudit({ rootDir }).gates
      .find((item) => item.id === "completed_current_head_standard_security_scan")?.state).toBe("contradicted");
  });

  it("records the deployed forwarded identity fix without closing scan or approval boundaries", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-source-security-forwarded-identity-remediation-2026-08-31",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "current_source_forwarded_identity_remediation");
    expect(gate?.state).toBe("proven");
    expect(gate?.detail).toContain("verified Vercel production ingress");
    expect(gate?.detail).toContain("44 tests");
    expect(gate?.detail).toContain("fresh rescan remains required");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    expect(buildNorthstarOpenGateAudit({ rootDir }).gates
      .find((item) => item.id === "current_source_forwarded_identity_remediation")?.state).toBe("contradicted");
  });

  it("records bounded template inventory scanning without closing scan or approval boundaries", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-source-security-template-inventory-remediation-2026-08-31",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "current_source_template_inventory_remediation");
    expect(gate?.state).toBe("proven");
    expect(gate?.detail).toContain("before parser initialization");
    expect(gate?.detail).toContain("Scanner 6/6");
    expect(gate?.detail).toContain("fresh rescan remains required");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remediation: { partialOutputWrittenOnAdmissionFailure: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.remediation.partialOutputWrittenOnAdmissionFailure = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    expect(buildNorthstarOpenGateAudit({ rootDir }).gates
      .find((item) => item.id === "current_source_template_inventory_remediation")?.state).toBe("contradicted");
  });

  it("records all four approval-free scan residuals as source-remediated without reclassifying the sealed scan", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-source-security-approval-free-remediation-2026-08-31",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "current_source_approval_free_security_remediation");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("All four approval-free findings");
    expect(gate?.detail).toContain("sealed 9-finding scan is unchanged");
    expect(gate?.detail).toContain("five database/RLS/atomicity findings remain approval-gated");
    expect(gate?.detail).toContain("fresh full repository rescan is still required");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remediation: { currentSourceOpenApprovalFreeCount: number };
      boundaries: { exactSavedShareVerdict: string };
    };
    report.remediation.currentSourceOpenApprovalFreeCount = 1;
    report.boundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "current_source_approval_free_security_remediation")?.state)
      .toBe("contradicted");
  });

  it("records deployed resource budgets without closing failed scan or approval boundaries", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-source-security-resource-budget-remediation-2026-08-31",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "current_source_security_resource_budget_remediation");
    expect(gate?.state).toBe("proven");
    expect(gate?.detail).toContain("Five approval-free resource-budget findings");
    expect(gate?.detail).toContain("manifest remains failed");
    expect(gate?.detail).toContain("Five database/RLS/atomicity findings remain approval-gated");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      boundaries: { exactSavedShareVerdict: string };
    };
    report.boundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "current_source_security_resource_budget_remediation")?.state)
      .toBe("contradicted");
  });

  it("records deployed logout cleanup without closing the sealed finding or approval boundaries", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-source-security-logout-storage-remediation-2026-08-31",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "current_source_logout_storage_remediation");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("clears worker/workpack/editorial browser content");
    expect(gate?.detail).toContain("Five files / 100 tests");
    expect(gate?.detail).toContain("Behavioral live logout was intentionally not executed");
    expect(gate?.detail).toContain("sealed finding remains open pending a fresh scan");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      mutationBoundary: { dbMutationPerformed: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.mutationBoundary.dbMutationPerformed = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "current_source_logout_storage_remediation")?.state)
      .toBe("contradicted");
  });

  it("records deployed ontology error redaction without closing the sealed finding or approval boundaries", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-source-security-ontology-error-projection-remediation-2026-08-31",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "current_source_ontology_error_projection_remediation");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("two fixed public ontology error codes");
    expect(gate?.detail).toContain("Three files / 12 tests");
    expect(gate?.detail).toContain("No provider failure was induced");
    expect(gate?.detail).toContain("sealed finding remains open pending a fresh scan");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      mutationBoundary: { dbMutationPerformed: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.mutationBoundary.dbMutationPerformed = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "current_source_ontology_error_projection_remediation")?.state)
      .toBe("contradicted");
  });

  it("records deployed raw error projection without closing the sealed finding or approval boundaries", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-source-security-raw-error-projection-remediation-2026-08-31",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "current_source_raw_error_projection_remediation");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("five stable public codes");
    expect(gate?.detail).toContain("Five security files / 93 tests");
    expect(gate?.detail).toContain("without inducing a production failure");
    expect(gate?.detail).toContain("sealed 21-finding scan remains unchanged pending a fresh scan");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      mutationBoundary: { dbMutationPerformed: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.mutationBoundary.dbMutationPerformed = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "current_source_raw_error_projection_remediation")?.state)
      .toBe("contradicted");
  });

  it("records protected credential output without issuing credentials or closing the sealed finding", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "current-source-security-credential-output-remediation-2026-08-31", "report.json");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "current_source_credential_output_remediation");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("two credential issuance CLIs");
    expect(gate?.detail).toContain("Five files / 88 tests");
    expect(gate?.detail).toContain("No credential was issued");
    expect(gate?.detail).toContain("sealed 21-finding scan remains unchanged pending a fresh scan");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      mutationBoundary: { mcpTokenIssued: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.mutationBoundary.mcpTokenIssued = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "current_source_credential_output_remediation")?.state)
      .toBe("contradicted");
  });

  it("records bounded operator smoke resources without closing the sealed finding", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "current-source-security-export-smoke-resource-remediation-2026-08-31", "report.json");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "current_source_export_smoke_resource_remediation");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("deadlines, byte ceilings, termination");
    expect(gate?.detail).toContain("Three files / 17 tests");
    expect(gate?.detail).toContain("sealed finding remains open pending a fresh scan");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remediation: { http: { defaultResponseMaxBytes: number } };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.remediation.http.defaultResponseMaxBytes = 0;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "current_source_export_smoke_resource_remediation")?.state)
      .toBe("contradicted");
  });

  it("records SIF migration scope and digest binding without activating the approval gate", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "current-source-security-sif-migration-scope-remediation-2026-08-31", "report.json");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "current_source_sif_migration_scope_remediation");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("top-level SQL allowlist and the canonical migration SHA-256");
    expect(gate?.detail).toContain("Four files / 19 tests");
    expect(gate?.detail).toContain("SIF runtime remains approval-gated");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      verification: { preflight: { digestPass: boolean } };
      mutationBoundary: { embeddingGenerated: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.verification.preflight.digestPass = false;
    report.mutationBoundary.embeddingGenerated = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "current_source_sif_migration_scope_remediation")?.state)
      .toBe("contradicted");
  });

  it("records digest-bound document publication without closing the sealed finding", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "current-source-security-document-publication-isolation-remediation-2026-08-31", "report.json");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "current_source_document_publication_isolation_remediation");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("two generated snapshots plus their SHA-256 manifest");
    expect(gate?.detail).toContain("independently binds commit and push approvals");
    expect(gate?.detail).toContain("sealed finding remains open pending a fresh scan");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

  });

  it("fails document publication isolation closed for each immutable or approval boundary independently", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "current-source-security-document-publication-isolation-remediation-2026-08-31", "report.json");
    type PublicationReport = {
      userContext: string;
      productionBuild: { commitSha: string };
      immutableSecurityContext: {
        completedPriorScan: { targetRevision: string };
        currentFinding: { findingRewritten: boolean };
      };
      remediation: { commitApproval: { expectedSourceBranchRequired: boolean } };
      mutationBoundary: { providerDispatchCalled: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    const original = JSON.parse(fs.readFileSync(reportPath, "utf8")) as PublicationReport;
    const mutations: Array<{ label: string; apply: (report: PublicationReport) => void }> = [
      { label: "user context", apply: (report) => { report.userContext = "changed"; } },
      { label: "baseline target", apply: (report) => { report.immutableSecurityContext.completedPriorScan.targetRevision = "0".repeat(40); } },
      { label: "finding rewrite", apply: (report) => { report.immutableSecurityContext.currentFinding.findingRewritten = true; } },
      { label: "source/live identity", apply: (report) => { report.productionBuild.commitSha = "0".repeat(40); } },
      { label: "source branch approval", apply: (report) => { report.remediation.commitApproval.expectedSourceBranchRequired = false; } },
      { label: "provider mutation", apply: (report) => { report.mutationBoundary.providerDispatchCalled = true; } },
      { label: "exact saved Share", apply: (report) => { report.remainingBoundaries.exactSavedShareVerdict = "PASS"; } },
    ];

    for (const mutation of mutations) {
      const report = structuredClone(original);
      mutation.apply(report);
      fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      const contradicted = buildNorthstarOpenGateAudit({ rootDir });
      expect(
        contradicted.gates.find((item) => item.id === "current_source_document_publication_isolation_remediation")?.state,
        mutation.label,
      ).toBe("contradicted");
    }
  });

  it("records auth-free photo readiness without closing the sealed finding or approval boundaries", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-source-security-photo-readiness-auth-fanout-remediation-2026-08-31",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "current_source_photo_readiness_auth_fanout_remediation");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("without creating a Supabase admin client or calling authentication");
    expect(gate?.detail).toContain("Two files / 13 tests");
    expect(gate?.detail).toContain("sealed finding stays open pending a fresh scan");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((item) => item.id === "improvement_photo_analysis_budget")?.state).toBe("notice");
    expect(audit.gates.find((item) => item.id === "current_security_governed_path_compatibility")?.state).toBe("notice");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remediation: { publicGetCallsSupabaseAuthentication: boolean };
      mutationBoundary: { dbMutationPerformed: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.remediation.publicGetCallsSupabaseAuthentication = true;
    report.mutationBoundary.dbMutationPerformed = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "current_source_photo_readiness_auth_fanout_remediation")?.state)
      .toBe("contradicted");
  });

  it("records MCP cancellation propagation without claiming a runtime probe or security closure", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-source-security-mcp-generation-cancellation-remediation-2026-08-31",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "current_source_mcp_generation_cancellation_remediation");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("both ontology fetches, runAsk, and QA");
    expect(gate?.detail).toContain("54 tests plus five adjacent files / 143 tests");
    expect(gate?.detail).toContain("No authenticated runtime cancellation probe");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((item) => item.id === "mcp_provider_admission_security")?.state).toBe("notice");
    expect(audit.gates.find((item) => item.id === "mcp_generation_work_budget_security")?.state).toBe("notice");
    expect(audit.gates.find((item) => item.id === "current_security_governed_path_compatibility")?.state).toBe("notice");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remediation: { qaReviewSignalForwarded: boolean };
      mutationBoundary: { mcpGenerationProviderCalled: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.remediation.qaReviewSignalForwarded = false;
    report.mutationBoundary.mcpGenerationProviderCalled = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "current_source_mcp_generation_cancellation_remediation")?.state)
      .toBe("contradicted");
  });

  it("records bounded KOSHA archive preflight without closing the sealed finding or approval boundaries", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-source-security-kosha-archive-preflight-remediation-2026-08-31",
      "report.json",
    );

    const productCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: rootDir,
      encoding: "utf8",
    }).trim();
    fs.writeFileSync(path.join(rootDir, "deployed-evidence-marker.txt"), "evidence-only deployment\n", "utf8");
    execFileSync("git", ["add", "deployed-evidence-marker.txt"], { cwd: rootDir, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "deploy evidence marker"], { cwd: rootDir, stdio: "ignore" });
    const productionCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: rootDir,
      encoding: "utf8",
    }).trim();
    const deployedReport = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      sourceHead: string;
      productCommit: string;
      productionCommit: string;
      verification: { liveDeployment: { commitSha: string } };
    };
    deployedReport.sourceHead = productCommit;
    deployedReport.productCommit = productCommit;
    deployedReport.productionCommit = productionCommit;
    deployedReport.verification.liveDeployment.commitSha = productionCommit;
    fs.writeFileSync(reportPath, `${JSON.stringify(deployedReport, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "current_source_kosha_archive_preflight_remediation");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("same open file handle");
    expect(gate?.detail).toContain("64/112");
    expect(gate?.detail).toContain("No live local-archive probe");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");
    expect(audit.gates.find((item) => item.id === "kosha_exact_promotion_review_gate")?.state)
      .toBe("approval_gated");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remediation: { sameOpenFileHandleUsedForPreflightAndZipFile: boolean };
      mutationBoundary: { dbMutationPerformed: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.remediation.sameOpenFileHandleUsedForPreflightAndZipFile = false;
    report.mutationBoundary.dbMutationPerformed = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "current_source_kosha_archive_preflight_remediation")?.state)
      .toBe("contradicted");
  });

  it("records live bounded security remediation without closing the post-fix scan or approval boundaries", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-source-security-remediation-2026-08-30",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "current_source_security_remediation_followup");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("five bounded approval-free remediation receipts");
    expect(gate?.detail).toContain("79 Vitest plus 11 Python tests");
    expect(gate?.detail).toContain("KOSHA PDF audit remains 8/8");
    expect(gate?.detail).toContain("post-fix full repository scan remains pending");
    expect(gate?.detail).toContain("public-catalog RLS stays approval-gated");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");
    expect(gate?.detail).toContain("not security-complete proof");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      baseline: { postFixFullRepositoryRescanCompleted: boolean };
      remainingBoundaries: {
        dbMutationPerformed: boolean;
        exactSavedShareVerdict: string;
        postFixFullRepositoryScan: string;
      };
    };
    const original = JSON.stringify(report, null, 2);
    const contradictions: Array<(candidate: typeof report) => void> = [
      (candidate) => { candidate.baseline.postFixFullRepositoryRescanCompleted = true; },
      (candidate) => { candidate.remainingBoundaries.dbMutationPerformed = true; },
      (candidate) => { candidate.remainingBoundaries.exactSavedShareVerdict = "PASS"; },
      (candidate) => { candidate.remainingBoundaries.postFixFullRepositoryScan = "COMPLETE"; },
    ];
    for (const contradict of contradictions) {
      const candidate = JSON.parse(original) as typeof report;
      contradict(candidate);
      fs.writeFileSync(reportPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
      const contradicted = buildNorthstarOpenGateAudit({ rootDir });
      expect(contradicted.gates.find((item) => item.id === "current_source_security_remediation_followup")?.state)
        .toBe("contradicted");
    }
  });

  it("uses current governed-path compatibility without claiming skipped browser or security completion", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-security-governed-path-compatibility-2026-08-30",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "current_security_governed_path_compatibility");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("13 security notices across 33 governed paths");
    expect(gate?.detail).toContain("28 files / 317 tests");
    expect(gate?.detail).toContain("7 tests were skipped");
    expect(gate?.detail).toContain("no fresh browser PASS is claimed");
    expect(gate?.detail).toContain("Sealed full scan f218c713 is complete with 18 open findings and partial coverage");
    expect(gate?.detail).toContain("does not rewrite immutable findings or claim security completion");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");
    for (const gateId of [
      "share_ack_prebody_admission_security",
      "share_recipient_contact_verification_security",
      "public_json_request_body_budget",
      "improvement_photo_analysis_budget",
      "public_provider_admission",
      "public_ask_distributed_admission",
      "learning_export_renderer_security",
      "mcp_provider_admission_security",
      "mcp_generation_work_budget_security",
      "security_followup_remediation",
      "knowledge_preparation_capability_truth",
      "public_provider_cancellation",
      "public_generation_admission_security",
    ]) {
      expect(audit.gates.find((item) => item.id === gateId)?.state).not.toBe("contradicted");
    }

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      verification: { vitest: { status: string } };
      mutationBoundary: { dbMutationPerformed: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.verification.vitest.status = "PASS_BROWSER_EXECUTED";
    report.mutationBoundary.dbMutationPerformed = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "current_security_governed_path_compatibility")?.state)
      .toBe("contradicted");
  });

  it("uses the current governed-path receipt when provider cancellation evidence is stale", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    writeText(rootDir, path.join("lib", "ai.ts"), "export const currentProviderCancellationCompatibility = true;\n");
    execFileSync("git", ["add", "lib/ai.ts"], { cwd: rootDir, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "update provider cancellation path"], { cwd: rootDir, stdio: "ignore" });
    const currentSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8" }).trim();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-security-governed-path-compatibility-2026-08-30",
      "report.json",
    );
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      sourceHead: string;
      productionCommit: string;
    };
    report.sourceHead = currentSha;
    report.productionCommit = currentSha;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((item) => item.id === "public_provider_cancellation")?.state).toBe("notice");
    expect(audit.gates.find((item) => item.id === "current_security_governed_path_compatibility")?.state)
      .toBe("notice");
  });

  it("uses current companion receipts for governed paths changed after the shared compatibility receipt", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    for (const relativePath of [
      "app/api/input-photos/hazard-analysis/route.ts",
      "app/api/knowledge/match/route.ts",
      "app/api/mcp/[transport]/implementation.ts",
      "lib/public-distributed-rate-limit.ts",
      "lib/api-guard.ts",
      "tests/api-guard.test.ts",
    ]) {
      writeText(rootDir, relativePath, `export const currentCompanionReceipt = ${JSON.stringify(relativePath)};\n`);
    }
    execFileSync("git", [
      "add",
      "app/api/input-photos/hazard-analysis/route.ts",
      "app/api/knowledge/match/route.ts",
      "app/api/mcp/[transport]/implementation.ts",
      "lib/public-distributed-rate-limit.ts",
      "lib/api-guard.ts",
      "tests/api-guard.test.ts",
    ], { cwd: rootDir, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "apply current companion remediations"], { cwd: rootDir, stdio: "ignore" });
    const currentSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8" }).trim();

    const rawPath = path.join(rootDir, "evaluation", "current-source-security-raw-error-projection-remediation-2026-08-31", "report.json");
    const raw = JSON.parse(fs.readFileSync(rawPath, "utf8")) as {
      sourceHead: string;
      productCommit: string;
      productionCommit: string;
      verification: { liveDeployment: { commitSha: string } };
      mutationBoundary: { dbMutationPerformed: boolean };
    };
    raw.sourceHead = currentSha;
    raw.productCommit = currentSha;
    raw.productionCommit = currentSha;
    raw.verification.liveDeployment.commitSha = currentSha;
    fs.writeFileSync(rawPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");

    const mcpPath = path.join(rootDir, "evaluation", "current-source-security-mcp-generation-cancellation-remediation-2026-08-31", "report.json");
    const mcp = JSON.parse(fs.readFileSync(mcpPath, "utf8")) as {
      sourceHead: string;
      productCommit: string;
      productionCommit: string;
      verification: { liveDeployment: { commitSha: string } };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    mcp.sourceHead = currentSha;
    mcp.productCommit = currentSha;
    mcp.productionCommit = currentSha;
    mcp.verification.liveDeployment.commitSha = currentSha;
    fs.writeFileSync(mcpPath, `${JSON.stringify(mcp, null, 2)}\n`, "utf8");

    const identityPath = path.join(rootDir, "evaluation", "current-source-security-forwarded-identity-remediation-2026-08-31", "report.json");
    const identity = JSON.parse(fs.readFileSync(identityPath, "utf8")) as {
      sourceHead: string;
      productionCommit: string;
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    identity.sourceHead = currentSha;
    identity.productionCommit = currentSha;
    fs.writeFileSync(identityPath, `${JSON.stringify(identity, null, 2)}\n`, "utf8");

    const current = buildNorthstarOpenGateAudit({ rootDir });
    expect(current.gates.find((item) => item.id === "public_json_request_body_budget")?.state).toBe("proven");
    expect(current.gates.find((item) => item.id === "improvement_photo_analysis_budget")?.state).toBe("notice");
    expect(current.gates.find((item) => item.id === "public_provider_admission")?.state).toBe("notice");
    expect(current.gates.find((item) => item.id === "security_followup_remediation")?.state).toBe("proven");
    expect(current.gates.find((item) => item.id === "current_security_governed_path_compatibility")?.state).toBe("notice");
    expect(current.gates.find((item) => item.id === "current_source_security_residual_remediation")?.state)
      .toBe("notice");

    raw.mutationBoundary.dbMutationPerformed = true;
    mcp.remainingBoundaries.exactSavedShareVerdict = "PASS";
    identity.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(rawPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
    fs.writeFileSync(mcpPath, `${JSON.stringify(mcp, null, 2)}\n`, "utf8");
    fs.writeFileSync(identityPath, `${JSON.stringify(identity, null, 2)}\n`, "utf8");

    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "current_security_governed_path_compatibility")?.state)
      .toBe("contradicted");
    expect(contradicted.gates.find((item) => item.id === "current_source_security_residual_remediation")?.state)
      .toBe("contradicted");
  });

  it("records deployed security residual remediation as notice without closing the sealed scan", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-source-security-residual-remediation-2026-08-28",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "current_source_security_residual_remediation");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("provider-detail, dns-toctou, and xff-spoof");
    expect(gate?.detail).toContain("174 focused and adjacent tests");
    expect(gate?.detail).toContain("sealed 17-finding partial-coverage scan remain visible");
    expect(gate?.detail).toContain("follow-up full scan is required");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "current_source_security_residual_remediation")?.state)
      .toBe("contradicted");
  });

  it("uses the deployed residual receipt for older weather and follow-up governed paths", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    writeText(rootDir, path.join("lib", "weather.ts"), "export const redactedWeatherFallback = true;\n");
    writeText(rootDir, path.join("lib", "work24.ts"), "export const redactedProviderDetail = true;\n");
    execFileSync("git", ["add", "lib/weather.ts", "lib/work24.ts"], { cwd: rootDir, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "apply deployed residual remediation"], { cwd: rootDir, stdio: "ignore" });
    const currentSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8" }).trim();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "current-source-security-residual-remediation-2026-08-28",
      "report.json",
    );
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      sourceHead: string;
      productionCommit: string;
      liveVerification: { buildInfoCommit: string };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.sourceHead = currentSha;
    report.productionCommit = currentSha;
    report.liveVerification.buildInfoCommit = currentSha;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const compatible = buildNorthstarOpenGateAudit({ rootDir });
    expect(compatible.gates.find((item) => item.id === "current_source_security_residual_remediation")?.state)
      .toBe("notice");
    expect(compatible.gates.find((item) => item.id === "weather_fallback_error_redaction_security")?.state)
      .toBe("notice");
    expect(compatible.gates.find((item) => item.id === "security_followup_remediation")?.state)
      .toBe("proven");

    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "weather_fallback_error_redaction_security")?.state)
      .toBe("contradicted");
    expect(contradicted.gates.find((item) => item.id === "security_followup_remediation")?.state)
      .toBe("contradicted");
  });

  it("records Share ACK pre-body admission as notice and preserves approval boundaries", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "share-ack-prebody-admission-2026-08-28",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "share_ack_prebody_admission_security");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("pre-body admission");
    expect(gate?.detail).toContain("fresh full scan");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "share_ack_prebody_admission_security")?.state)
      .toBe("contradicted");
  });

  it("records safety status disconnect lease retention as notice and preserves rescan boundaries", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "safety-status-disconnect-lease-2026-08-28",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "safety_status_disconnect_lease_security");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("until the real catalog");
    expect(gate?.detail).toContain("fresh full scan");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      currentSourceContract: { admissionLeaseHeldUntilUnderlyingSettlement: boolean };
    };
    report.currentSourceContract.admissionLeaseHeldUntilUnderlyingSettlement = false;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "safety_status_disconnect_lease_security")?.state)
      .toBe("contradicted");
  });

  it("records weather fallback error redaction as notice and fails closed on public-detail drift", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "weather-fallback-error-redaction-2026-08-28",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "weather_fallback_error_redaction_security");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("all eight weather provider fallbacks");
    expect(gate?.detail).toContain("fresh full scan");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      currentSourceContract: { aggregateWeatherDetailOmitsRawProviderErrors: boolean };
    };
    report.currentSourceContract.aggregateWeatherDetailOmitsRawProviderErrors = false;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "weather_fallback_error_redaction_security")?.state)
      .toBe("contradicted");
  });

  it("records HWPX archive expansion as notice and fails closed on preflight drift", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "hwpx-archive-expansion-security-2026-08-28",
      "report.json",
    );

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "hwpx_archive_expansion_security");
    expect(gate?.state).toBe("notice");
    expect(gate?.detail).toContain("before getData or toBuffer");
    expect(gate?.detail).toContain("25 committed templates");
    expect(gate?.detail).toContain("MISSING_EVIDENCE");

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      currentSourceContract: { centralDirectoryCheckedBeforeEntryData: boolean };
    };
    report.currentSourceContract.centralDirectoryCheckedBeforeEntryData = false;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((item) => item.id === "hwpx_archive_expansion_security")?.state)
      .toBe("contradicted");
  });

  it("keeps accident-case governed-path compatibility fail-closed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    writeText(rootDir, path.join("lib", "accident-cases.ts"), "export const scenarioIsolation = true;\n");
    execFileSync("git", ["add", "lib/accident-cases.ts"], { cwd: rootDir, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "isolate accident evidence"], { cwd: rootDir, stdio: "ignore" });
    const currentSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8" }).trim();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "security-accident-case-compatibility-2026-08-27",
      "report.json",
    );
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      productCommit: string;
      productionCommit: string;
      governedPathCompatibility: { sourceHead: string; productionCommit: string };
      securityContracts: { callerAbortPropagated: boolean };
    };
    report.productCommit = currentSha;
    report.productionCommit = currentSha;
    report.governedPathCompatibility.sourceHead = currentSha;
    report.governedPathCompatibility.productionCommit = currentSha;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const compatible = buildNorthstarOpenGateAudit({ rootDir });
    expect(compatible.gates.find((gate) => gate.id === "security_followup_remediation")?.state).toBe("proven");
    expect(compatible.gates.find((gate) => gate.id === "security_followup_remediation")?.detail).toContain("6 files / 146 tests");

    report.securityContracts.callerAbortPropagated = false;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradicted.gates.find((gate) => gate.id === "security_followup_remediation")?.state).toBe("contradicted");
    expect(contradicted.gates.find((gate) => gate.id === "security_followup_remediation")?.detail).toContain("accidentCompatibilityCurrent=false");
  });

  it("fails security follow-up closed when the latest search compatibility receipt overclaims boundaries", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "codex-security-followup-remediation-2026-08-11", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      latestPathCompatibility: {
        focusedVitest: { tests: number };
        exactSavedShareVerdict: string;
      };
    };
    report.latestPathCompatibility.focusedVitest.tests = 244;
    report.latestPathCompatibility.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "security_followup_remediation")?.state).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "security_followup_remediation")?.detail).toContain("latestCompatibilityPass=false");
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

  it("keeps current public admission compatibility fail-closed on live probe or Share overclaim", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    writeText(rootDir, path.join("app", "api", "ask", "stream", "route.ts"), "export const currentAskStreamAdmission = true;\n");
    writeText(rootDir, path.join("app", "api", "weather", "route.ts"), "export const currentWeatherAdmission = true;\n");
    execFileSync("git", ["add", "app/api/ask/stream/route.ts", "app/api/weather/route.ts"], { cwd: rootDir, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "refresh public admission"], { cwd: rootDir, stdio: "ignore" });
    const currentSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8" }).trim();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "public-admission-current-source-compatibility-2026-08-28",
      "report.json",
    );
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      sourceHead: string;
      productionCommit: string;
      liveReadOnlyProbe: { cases: Array<{ name: string; status: number }> };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.sourceHead = currentSha;
    report.productionCommit = currentSha;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const compatible = buildNorthstarOpenGateAudit({ rootDir });
    expect(compatible.gates.find((gate) => gate.id === "public_json_request_body_budget")?.state).toBe("proven");
    expect(compatible.gates.find((gate) => gate.id === "public_provider_cancellation")?.state).toBe("notice");
    expect(compatible.gates.find((gate) => gate.id === "public_provider_admission")?.state).toBe("notice");
    expect(compatible.gates.find((gate) => gate.id === "public_ask_distributed_admission")?.state).toBe("proven");
    expect(compatible.gates.find((gate) => gate.id === "public_search_distributed_admission")?.state).toBe("proven");
    expect(compatible.gates.find((gate) => gate.id === "improvement_photo_analysis_budget")?.state).toBe("notice");

    const fullCase = report.liveReadOnlyProbe.cases.find((item) => item.name === "ask-full");
    if (!fullCase) throw new Error("ask-full fixture is missing");
    fullCase.status = 200;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    for (const gateId of [
      "public_json_request_body_budget",
      "public_provider_cancellation",
      "public_ask_distributed_admission",
      "public_search_distributed_admission",
    ]) {
      expect(contradicted.gates.find((gate) => gate.id === gateId)?.state).toBe("contradicted");
    }
  });

  it("keeps current Share and MCP compatibility fail-closed on live or saved-session overclaim", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const changedPaths = [
      path.join("app", "api", "workpacks", "[id]", "share-sessions", "route.ts"),
      path.join("app", "api", "share-sessions", "[sessionId]", "route.ts"),
      path.join("app", "api", "mcp", "[transport]", "implementation.ts"),
    ];
    for (const changedPath of changedPaths) {
      writeText(rootDir, changedPath, `export const compatibilityRefresh = ${JSON.stringify(changedPath)};\n`);
    }
    execFileSync("git", ["add", ...changedPaths.map((item) => item.replaceAll("\\", "/"))], {
      cwd: rootDir,
      stdio: "ignore",
    });
    execFileSync("git", ["commit", "-m", "refresh Share and MCP admission"], { cwd: rootDir, stdio: "ignore" });
    const currentSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8" }).trim();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "share-mcp-current-source-compatibility-2026-08-28",
      "report.json",
    );
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      sourceHead: string;
      productionCommit: string;
      liveReadOnlyProbe: { cases: Array<{ name: string; status: number }> };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.sourceHead = currentSha;
    report.productionCommit = currentSha;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const compatible = buildNorthstarOpenGateAudit({ rootDir });
    expect(compatible.gates.find((gate) => gate.id === "share_session_revocation_security")?.state).toBe("notice");
    expect(compatible.gates.find((gate) => gate.id === "share_recipient_contact_verification_security")?.state).toBe("notice");
    expect(compatible.gates.find((gate) => gate.id === "share_ack_prebody_admission_security")?.state).toBe("notice");
    expect(compatible.gates.find((gate) => gate.id === "mcp_provider_admission_security")?.state).toBe("notice");

    const mcpCase = report.liveReadOnlyProbe.cases.find((item) => item.name === "mcp-invalid-token");
    if (!mcpCase) throw new Error("mcp-invalid-token fixture is missing");
    mcpCase.status = 200;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const contradicted = buildNorthstarOpenGateAudit({ rootDir });
    for (const gateId of [
      "share_session_revocation_security",
      "share_recipient_contact_verification_security",
      "share_ack_prebody_admission_security",
      "mcp_provider_admission_security",
    ]) {
      expect(contradicted.gates.find((gate) => gate.id === gateId)?.state).toBe("contradicted");
    }
  });

  it("keeps provider cancellation current through the Wiki SIF compatibility receipt and fails closed when it breaks", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    writeText(rootDir, path.join("lib", "knowledge-candidate-route.ts"), "export const sifEvidenceCompatibility = true;\n");
    execFileSync("git", ["add", "lib/knowledge-candidate-route.ts"], { cwd: rootDir, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "change Wiki SIF renderer"], { cwd: rootDir, stdio: "ignore" });
    const currentSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8" }).trim();
    const reportPath = path.join(rootDir, "evaluation", "llm-wiki-sif-evidence-matrix-2026-08-26", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      productCommit: string;
      compatibilityContracts: {
        providerCancellation: { sourceHead: string; abortSkipsProviderFallback: boolean };
      };
    };
    report.productCommit = currentSha;
    report.compatibilityContracts.providerCancellation.sourceHead = currentSha;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const compatibleAudit = buildNorthstarOpenGateAudit({ rootDir });
    expect(compatibleAudit.gates.find((gate) => gate.id === "public_provider_cancellation")?.state).toBe("notice");
    expect(compatibleAudit.gates.find((gate) => gate.id === "public_provider_cancellation")?.detail).toContain("current 1 file / 18 tests");

    report.compatibilityContracts.providerCancellation.abortSkipsProviderFallback = false;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const contradictedAudit = buildNorthstarOpenGateAudit({ rootDir });
    expect(contradictedAudit.gates.find((gate) => gate.id === "public_provider_cancellation")?.state).toBe("contradicted");
    expect(contradictedAudit.gates.find((gate) => gate.id === "public_provider_cancellation")?.detail).toContain("sourceCurrent=false");
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
    const reportPath = path.join(rootDir, "evaluation", "hermes-knowledge-review-selected-workbench-2026-08-14", "report.json");
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

  it("fails Hermes reviewer UI closed when structured candidate evidence overclaims the production queue", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "hermes-knowledge-review-structured-sections-2026-08-28", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      afterLive: {
        candidateSectionCount: number;
        candidateMultilineContinuationPreserved: boolean;
        actualProductionCandidateQueueRead: boolean;
      };
    };
    report.afterLive.candidateSectionCount = 3;
    report.afterLive.candidateMultilineContinuationPreserved = false;
    report.afterLive.actualProductionCandidateQueueRead = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-25T00:00:00.000Z",
    });

    const gate = audit.gates.find((item) => item.id === "hermes_knowledge_review_ui");
    expect(gate).toMatchObject({ state: "contradicted" });
    expect(gate?.detail).toContain("structuredCompanion=false");
    expect(gate?.detail).toContain("structuredSections=3");
    expect(gate?.detail).toContain("multiline=false");
    expect(gate?.detail).toContain("actualQueueRead=true");
  });

  it("fails Hermes evidence inspector closed when saved Share or security boundaries are overclaimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "hermes-knowledge-review-evidence-inspector-2026-08-14", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      evidenceContract: {
        privateEvidenceRawIdentityExposed: boolean;
        candidateKeyboardNavigation: boolean;
        mobilePaneKeyboardNavigation: boolean;
      };
      securityBoundary: { securityComplete: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.evidenceContract.privateEvidenceRawIdentityExposed = true;
    report.evidenceContract.candidateKeyboardNavigation = false;
    report.evidenceContract.mobilePaneKeyboardNavigation = false;
    report.securityBoundary.securityComplete = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "hermes_review_evidence_inspector")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "hermes_review_evidence_inspector")?.detail).toContain("exactShare=PASS");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_evidence_inspector")?.detail).toContain("securityComplete=true");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_evidence_inspector")?.detail).toContain("candidateKeyboard=false");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_evidence_inspector")?.detail).toContain("mobilePaneKeyboard=false");
  });

  it("fails knowledge preparation capability truth closed when runtime or exact Share is overclaimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "knowledge-preparation-capability-truth-2026-08-28",
      "report.json",
    );
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remainingBoundaries: {
        enhancedLlmRuntime: string;
        exactSavedShareVerdict: string;
      };
    };
    report.remainingBoundaries.enhancedLlmRuntime = "READY";
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-08-28T00:00:00.000Z",
    });

    expect(audit.gates.find((gate) => gate.id === "knowledge_preparation_capability_truth")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "knowledge_preparation_capability_truth")?.detail).toContain("runtime=READY");
    expect(audit.gates.find((gate) => gate.id === "knowledge_preparation_capability_truth")?.detail).toContain("exactShare=PASS");
  });

  it("fails the standalone dispatch gate closed when desktop hidden root scroll debt returns", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "dispatch-first-viewport-containment-2026-08-27", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      afterLive: { desktopShort: { day: { rootScrollDebt: number } } };
    };
    report.afterLive.desktopShort.day.rootScrollDebt = 2;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-08-27T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "dispatch_standalone_cockpit")).toMatchObject({
      state: "contradicted",
      evidencePath: path.join("evaluation", "dispatch-first-viewport-containment-2026-08-27", "report.json"),
    });
  });

  it("fails Hermes evidence inspector closed when live digest readability collapses", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "hermes-evidence-digest-readability-2026-08-26", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      afterLive: { evidenceDigestMinWidth: number; readinessLabelMaxHeight: number };
      boundaries: { exactSavedShareVerdict: string };
    };
    report.afterLive.evidenceDigestMinWidth = 80;
    report.afterLive.readinessLabelMaxHeight = 72;
    report.boundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "hermes_review_evidence_inspector")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "hermes_review_evidence_inspector")?.detail).toContain("digest=80x18");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_evidence_inspector")?.detail).toContain("readiness=167.75/104/72");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_evidence_inspector")?.detail).toContain("readabilityExactShare=PASS");
  });

  it("fails Hermes evidence inspector closed when candidate subject context disappears", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "hermes-review-subject-context-2026-08-27", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      afterLive: { candidateBodyBeforeReadinessCount: number; mobileEvidenceSubjectContextVisibleCount: number };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.afterLive.candidateBodyBeforeReadinessCount = 7;
    report.afterLive.mobileEvidenceSubjectContextVisibleCount = 3;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "hermes_review_evidence_inspector")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "hermes_review_evidence_inspector")?.detail).toContain("subject=7/8/4/3");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_evidence_inspector")?.detail).toContain("subjectExactShare=PASS");
  });

  it("fails launch operations readiness closed when automatic launch or exact Share is overclaimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "launch-operations-readiness-2026-08-26", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      boundaries: { fullyAutomatedLaunchClaimAllowed: boolean; exactSavedShareVerdict: string };
    };
    report.boundaries.fullyAutomatedLaunchClaimAllowed = true;
    report.boundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, generatedAt: "2026-08-26T00:00:00.000Z" });
    expect(audit.gates.find((gate) => gate.id === "launch_operations_readiness_cockpit")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "launch_operations_readiness_cockpit")?.detail).toContain("fullyAutomated=true");
    expect(audit.gates.find((gate) => gate.id === "launch_operations_readiness_cockpit")?.detail).toContain("exactShare=PASS");
  });

  it("fails launch operations readiness closed when absent distributed configuration is overclaimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "launch-operations-readiness-2026-08-26", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      rows: Array<{ publicAdmissionConfiguration: string }>;
    };
    report.rows[0].publicAdmissionConfiguration = "ready";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "launch_operations_readiness_cockpit")?.state).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "launch_operations_readiness_cockpit")?.detail).toContain("configurationStates=ready");
  });

  it("fails Hermes event fact traceability closed on orphan facts, private text, or saved Share overclaim", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "hermes-knowledge-review-event-facts-2026-08-26", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      eventFactsContract: { orphanFactCount: number; privateEventTextExposed: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.eventFactsContract.orphanFactCount = 1;
    report.eventFactsContract.privateEventTextExposed = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "hermes_review_event_fact_traceability")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "hermes_review_event_fact_traceability")?.detail).toContain("orphan=1");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_event_fact_traceability")?.detail).toContain("private=true");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_event_fact_traceability")?.detail).toContain("exactShare=PASS");
  });

  it("fails Hermes review trace blocks closed on unresolved traces or scope overclaim", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "hermes-knowledge-review-trace-blocks-2026-08-26", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      traceabilityContract: { unresolvedTraceCount: number; allHazardsClosed: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.traceabilityContract.unresolvedTraceCount = 1;
    report.traceabilityContract.allHazardsClosed = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "hermes_review_trace_blocks")).toMatchObject({ state: "contradicted" });
    expect(audit.gates.find((gate) => gate.id === "hermes_review_trace_blocks")?.detail).toContain("unresolved=1");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_trace_blocks")?.detail).toContain("allHazards=true");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_trace_blocks")?.detail).toContain("exactShare=PASS");
  });

  it("fails the Hermes canonical trace matrix closed on incomplete mappings or saved Share overclaim", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "hermes-knowledge-review-trace-matrix-2026-08-26", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      traceabilityContract: { canonicalControlLinkCount: number };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.traceabilityContract.canonicalControlLinkCount = 32;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "hermes_review_trace_matrix")).toMatchObject({ state: "contradicted" });
    expect(audit.gates.find((gate) => gate.id === "hermes_review_trace_matrix")?.detail).toContain("controls=32");
    expect(audit.gates.find((gate) => gate.id === "hermes_review_trace_matrix")?.detail).toContain("exactShare=PASS");
  });

  it("fails the public Ask distributed admission gate closed on provider execution or saved Share overclaim", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "public-ask-distributed-admission-2026-08-14", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      liveProductionProbe: { providerCallExecuted: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.liveProductionProbe.providerCallExecuted = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "public_ask_distributed_admission")?.state).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "public_ask_distributed_admission")?.detail).toContain("providerCall=true");
    expect(audit.gates.find((gate) => gate.id === "public_ask_distributed_admission")?.detail).toContain("exactShare=PASS");
  });

  it("fails the public search distributed admission gate closed on provider execution or saved Share overclaim", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "public-search-distributed-admission-2026-08-14", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      liveProductionProbe: { providerCallExecutedForEvidence: boolean };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.liveProductionProbe.providerCallExecutedForEvidence = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "public_search_distributed_admission")?.state).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "public_search_distributed_admission")?.detail).toContain("providerCall=true");
    expect(audit.gates.find((gate) => gate.id === "public_search_distributed_admission")?.detail).toContain("exactShare=PASS");
  });

  it("fails Hermes reviewer UI closed when more than one review body is selected", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "hermes-knowledge-review-selected-workbench-2026-08-14", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      workbenchContract: {
        selectedBodyCount: number;
      };
    };
    report.workbenchContract.selectedBodyCount = 2;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-08-14T00:00:00.000Z",
    });

    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_ui")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "hermes_knowledge_review_ui")?.detail).toContain("bodies=2");
  });

  it("fails Hermes reviewer UI closed when keyboard navigation is not proven", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "hermes-knowledge-review-selected-workbench-2026-08-14", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      workbenchContract: {
        candidateKeyboardNavigation: boolean;
        mobilePaneKeyboardNavigation: boolean;
      };
    };
    report.workbenchContract.candidateKeyboardNavigation = false;
    report.workbenchContract.mobilePaneKeyboardNavigation = false;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "hermes_knowledge_review_ui");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.detail).toContain("candidateKeyboard=false");
    expect(gate?.detail).toContain("mobilePaneKeyboard=false");
  });

  it("fails Hermes reviewer UI and evidence inspector closed when decision pending state is not proven", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const authorityPath = path.join(rootDir, "evaluation", "hermes-knowledge-review-selected-workbench-2026-08-14", "report.json");
    const inspectorPath = path.join(rootDir, "evaluation", "hermes-knowledge-review-evidence-inspector-2026-08-14", "report.json");
    const authority = JSON.parse(fs.readFileSync(authorityPath, "utf8")) as {
      workbenchContract: { decisionPendingStatusLive: boolean };
    };
    const inspector = JSON.parse(fs.readFileSync(inspectorPath, "utf8")) as {
      evidenceContract: { decisionBusyStateExposed: boolean };
    };
    authority.workbenchContract.decisionPendingStatusLive = false;
    inspector.evidenceContract.decisionBusyStateExposed = false;
    fs.writeFileSync(authorityPath, `${JSON.stringify(authority, null, 2)}\n`, "utf8");
    fs.writeFileSync(inspectorPath, `${JSON.stringify(inspector, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((item) => item.id === "hermes_knowledge_review_ui")?.state).toBe("contradicted");
    expect(audit.gates.find((item) => item.id === "hermes_review_evidence_inspector")?.state).toBe("contradicted");
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

  it("proves the Hermes durable ledger without claiming authenticated execution", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const audit = buildNorthstarOpenGateAudit({ rootDir, generatedAt: "2026-08-14T00:00:00.000Z" });

    expect(audit.gates.find((gate) => gate.id === "hermes_remote_durable_ledger")).toMatchObject({
      state: "proven",
    });
    expect(audit.gates.find((gate) => gate.id === "hermes_remote_durable_ledger")?.detail).toContain("authenticated execution");
    expect(audit.gates.find((gate) => gate.id === "hermes_remote_durable_ledger")?.detail).toContain("MISSING_EVIDENCE");
  });

  it("fails the Hermes durable ledger closed when an authenticated canary is overclaimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "hermes-openclaw-runtime-current-gate-2026-07-20", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      mutationBoundary: { liveAuthenticatedExecutionPerformed: boolean };
      remainingBoundaries: { authenticatedHermesCanary: string };
      liveExecutionReadiness: { claimed: boolean };
    };
    report.mutationBoundary.liveAuthenticatedExecutionPerformed = true;
    report.remainingBoundaries.authenticatedHermesCanary = "PASS";
    report.liveExecutionReadiness.claimed = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, generatedAt: "2026-08-14T00:00:00.000Z" });
    expect(audit.gates.find((gate) => gate.id === "hermes_remote_durable_ledger")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "hermes_remote_durable_ledger")?.detail).toContain("liveClaim=true");
  });

  it("fails live route perception closed when the reported long page and mobile-like desktop share return", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "live-documents-share-route-perception-2026-08-28", "report.json");
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

  it("fails live route perception closed when the redundant Documents rail scrollbar returns", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "live-documents-share-route-perception-2026-08-28", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      measurement: {
        documents: Array<{ viewport: { width: number }; moduleRail: { overflowDelta: number } }>;
        documentsRailRemediation: { afterLiveScrollHeight: number; afterLiveOverflowDelta: number };
      };
    };
    const desktopDocument = report.measurement.documents.find((row) => row.viewport.width === 1440);
    if (!desktopDocument) throw new Error("desktop route perception fixture row missing");
    desktopDocument.moduleRail.overflowDelta = 1;
    report.measurement.documentsRailRemediation.afterLiveScrollHeight = 724;
    report.measurement.documentsRailRemediation.afterLiveOverflowDelta = 1;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, generatedAt: "2026-08-28T00:00:00.000Z", sourceSha: "fixture-sha" });
    const gate = audit.gates.find((item) => item.id === "live_documents_share_route_perception");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.detail).toContain("documents=false");
    expect(gate?.detail).toContain("railRemediation=false");
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

  it("contradicts the UI gate when the recipient document disclosure loses its visible affordance", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "share-recipient-disclosure-affordance-2026-08-31", "after-live", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      results: Array<{ metrics: { documentsSummaryAffordance: string } }>;
    };
    report.results[0].metrics.documentsSummaryAffordance = "";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-08-31T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const gate = audit.gates.find((item) => item.id === "ui_documents_share_cockpit");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.evidencePath).toBe(path.join("evaluation", "share-recipient-disclosure-affordance-2026-08-31", "after-live", "report.json"));
    expect(gate?.detail).toContain("shareRecipientDisclosureAffordance=false");
  });

  it("contradicts the UI gate when a desktop share channel label wraps", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "share-channel-label-polish-2026-08-27", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      afterLive: { desktop: { channelCards: Array<{ label: string; labelLineCount: number }> } };
    };
    const kakao = report.afterLive.desktop.channelCards.find((card) => card.label === "카카오");
    if (!kakao) throw new Error("Missing Kakao channel fixture");
    kakao.labelLineCount = 2;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-08-12T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const gate = audit.gates.find((item) => item.id === "ui_documents_share_cockpit");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.evidencePath).toBe(path.join("evaluation", "share-channel-label-polish-2026-08-27", "report.json"));
    expect(gate?.detail).toContain("shareChannelLabelPolish=false");
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

  it("fails public generation admission security closed when the live unavailable path claims provider work", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "security-public-generation-admission-2026-08-04", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      afterLive: { probes: Array<{ providerCallPerformed: boolean }> };
    };
    report.afterLive.probes[0].providerCallPerformed = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-08-11T00:00:00.000Z",
    });

    expect(audit.gates.find((gate) => gate.id === "public_generation_admission_security")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "public_generation_admission_security")?.detail).toContain("live=false");
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

  it("fails MCP generation security closed when distributed admission does not fail closed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "security-mcp-generation-work-budget-2026-08-04", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      currentLiveRefresh: { probe: { distributedAdmissionFailedClosed: boolean } };
    };
    report.currentLiveRefresh.probe.distributedAdmissionFailedClosed = false;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "mcp_generation_work_budget_security")?.state).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "mcp_generation_work_budget_security")?.detail).toContain("currentRefresh=false");
  });

  it("fails MCP generation security closed when an absent configuration is overclaimed as ready", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "security-mcp-generation-work-budget-2026-08-04", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      currentLiveRefresh: { configurationReadiness: { configurationState: string } };
    };
    report.currentLiveRefresh.configurationReadiness.configurationState = "ready";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.gates.find((gate) => gate.id === "mcp_generation_work_budget_security")?.state).toBe("contradicted");
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

  it("fails Hermes first-viewport decisions closed when hit testing or saved Share boundaries regress", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "hermes-review-decision-first-viewport-2026-08-27", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      afterLive: { occludedFirstActionCount: number };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.afterLive.occludedFirstActionCount = 1;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "hermes_review_decision_first_viewport");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.detail).toContain("occluded=1");
    expect(gate?.detail).toContain("exactShare=PASS");
  });

  it("fails Hermes candidate positions closed when the sequence or saved Share boundary regresses", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "hermes-review-candidate-position-2026-08-27", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      afterLive: { candidatePositions: string[] };
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.afterLive.candidatePositions = ["1/3", "3/3"];
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    const gate = audit.gates.find((item) => item.id === "hermes_review_candidate_position");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.detail).toContain("1/3,3/3");
    expect(gate?.detail).toContain("exactShare=PASS");
  });

  it("contradicts the UI gate when the live mobile document shell regains horizontal overflow", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "live-current-documents-share-geometry-2026-08-31", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      documents: { afterLiveRemediation: { workpackShellScrollWidth: number } };
    };
    report.documents.afterLiveRemediation.workpackShellScrollWidth = 360;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-08-26T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const gate = audit.gates.find((item) => item.id === "ui_documents_share_cockpit");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.evidencePath).toBe(path.join("evaluation", "live-current-documents-share-geometry-2026-08-31", "report.json"));
  });

  it("fails document export capability truth closed when locked server actions are enabled", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "document-export-capability-truth-2026-08-17", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      browser: { desktop: { xlsxDisabled: boolean } };
    };
    report.browser.desktop.xlsxDisabled = false;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, generatedAt: "2026-08-17T00:00:00.000Z" });
    expect(audit.gates.find((gate) => gate.id === "document_export_capability_truth")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "document_export_capability_truth")?.detail).toContain("viewportPass=false");
  });

  it("fails document export capability truth closed when exact Share is overclaimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "document-export-capability-truth-2026-08-17", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, generatedAt: "2026-08-17T00:00:00.000Z" });
    expect(audit.gates.find((gate) => gate.id === "document_export_capability_truth")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "document_export_capability_truth")?.detail).toContain("exactShare=PASS");
  });

  it("fails document export capability truth closed on misleading instance concurrency evidence", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "document-export-capability-truth-2026-08-17", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      capability: { localGuardedPostCode: string; localGuardedPostRateLimit: string; misleadingConcurrencyStatusObserved: boolean };
    };
    report.capability.localGuardedPostCode = "PUBLIC_EXPORT_CONCURRENCY_LIMIT";
    report.capability.localGuardedPostRateLimit = "instance";
    report.capability.misleadingConcurrencyStatusObserved = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, generatedAt: "2026-08-17T00:00:00.000Z" });
    expect(audit.gates.find((gate) => gate.id === "document_export_capability_truth")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "document_export_capability_truth")?.detail).toContain("guardedRoutesPass=false");
  });

  it("fails ontology viewport workbench closed when mobile task switching regresses", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "ontology-viewport-workbench-2026-08-17", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      browser: { mobile: { taskSwitchVerifiedCount: number } };
    };
    report.browser.mobile.taskSwitchVerifiedCount = 3;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, generatedAt: "2026-08-17T00:00:00.000Z" });
    expect(audit.gates.find((gate) => gate.id === "ontology_viewport_workbench")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "ontology_viewport_workbench")?.detail).toContain("mobileSwitch=3/4");
  });

  it("fails Knowledge viewport workbench closed when publication boundaries are overclaimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "knowledge-viewport-workbench-2026-08-17", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remainingBoundaries: { llmWikiPublicationVerdict: string };
    };
    report.remainingBoundaries.llmWikiPublicationVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, generatedAt: "2026-08-17T00:00:00.000Z" });
    expect(audit.gates.find((gate) => gate.id === "knowledge_viewport_workbench")).toMatchObject({ state: "contradicted" });
    expect(audit.gates.find((gate) => gate.id === "knowledge_viewport_workbench")?.detail).toContain("wiki=PASS");
  });

  it("fails Knowledge viewport workbench closed when the mobile task rail wraps again", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "knowledge-mobile-task-rail-2026-08-27", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      afterLive: { commonContract: { selectorRows: number } };
    };
    report.afterLive.commonContract.selectorRows = 2;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, generatedAt: "2026-08-17T00:00:00.000Z" });
    expect(audit.gates.find((gate) => gate.id === "knowledge_viewport_workbench")).toMatchObject({
      state: "contradicted",
      evidencePath: path.join("evaluation", "knowledge-mobile-task-rail-2026-08-27", "report.json"),
    });
    expect(audit.gates.find((gate) => gate.id === "knowledge_viewport_workbench")?.detail).toContain("mobileTaskRail=false");
  });

  it.each([
    {
      name: "human review is claimed complete",
      mutate: (report: Record<string, unknown>) => {
        (report.contentReadinessContract as Record<string, unknown>).humanReviewCompleted = true;
      },
    },
    {
      name: "revision guidance exposes internal codes",
      mutate: (report: Record<string, unknown>) => {
        (report.contentReadinessContract as Record<string, unknown>).revisionIssueCodesExposed = true;
      },
    },
    {
      name: "publication and exact Share boundaries are overclaimed",
      mutate: (report: Record<string, unknown>) => {
        const boundaries = report.remainingBoundaries as Record<string, unknown>;
        boundaries.exactSavedShareVerdict = "PASS";
        boundaries.llmWikiPublication = "PASS";
      },
    },
    {
      name: "a database mutation is claimed",
      mutate: (report: Record<string, unknown>) => {
        (report.mutationBoundary as Record<string, unknown>).dbMutationPerformed = true;
      },
    },
  ])("fails LLM Wiki candidate readiness closed when $name", async ({ mutate }) => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "llm-wiki-candidate-readiness-2026-08-25", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as Record<string, unknown>;
    mutate(report);
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, sourceSha: "fixture-sha" });
    expect(audit.gates.find((gate) => gate.id === "llm_wiki_candidate_content_readiness")?.state).toBe("contradicted");
  });

  it("fails the Wiki candidate matrix closed when enhanced LLM generation is overclaimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "llm-wiki-candidate-content-matrix-2026-08-25", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      scopeBoundary: { enhancedLlmGenerationProvenLive: boolean };
    };
    report.scopeBoundary.enhancedLlmGenerationProvenLive = true;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, sourceSha: "fixture-sha" });
    const gate = audit.gates.find((item) => item.id === "llm_wiki_candidate_content_matrix");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.detail).toContain("enhancedLive=true");
  });

  it("fails the Wiki candidate matrix closed when reviewer-visible live evidence is incomplete", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "llm-wiki-candidate-content-matrix-2026-08-25", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      evidenceVisibilityAfterLive: { reviewerEvidenceTraceCount: number };
    };
    report.evidenceVisibilityAfterLive.reviewerEvidenceTraceCount = 4;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, sourceSha: "fixture-sha" });
    const gate = audit.gates.find((item) => item.id === "llm_wiki_candidate_content_matrix");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.detail).toContain("visibleTrace=4/5");
  });

  it("fails the Wiki candidate matrix closed when event semantics or privacy regress", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "llm-wiki-candidate-content-matrix-2026-08-25", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      eventSemanticAfterLive: { eventSemanticGroundingCount: number; privateEventExposureCount: number };
    };
    report.eventSemanticAfterLive.eventSemanticGroundingCount = 4;
    report.eventSemanticAfterLive.privateEventExposureCount = 1;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, sourceSha: "fixture-sha" });
    const gate = audit.gates.find((item) => item.id === "llm_wiki_candidate_content_matrix");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.detail).toContain("eventFacts=4/5");
    expect(gate?.detail).toContain("privateExposure=1");
  });

  it("fails the Wiki SIF evidence matrix closed when live SIF coverage regresses", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "llm-wiki-sif-evidence-matrix-2026-08-26", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      afterLive: { sifEvidenceBoundaryCount: number };
    };
    report.afterLive.sifEvidenceBoundaryCount = 4;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, sourceSha: "fixture-sha" });
    const gate = audit.gates.find((item) => item.id === "llm_wiki_sif_evidence_matrix");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.detail).toContain("SIF=4/5");
  });

  it("fails the Wiki SIF evidence matrix closed when exact saved Share is overclaimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "llm-wiki-sif-evidence-matrix-2026-08-26", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remainingBoundaries: { exactSavedShareVerdict: string };
    };
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, sourceSha: "fixture-sha" });
    const gate = audit.gates.find((item) => item.id === "llm_wiki_sif_evidence_matrix");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.detail).toContain("exactShare=PASS");
  });

  it("fails Knowledge viewport workbench closed when progressive disclosures open by default", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "knowledge-viewport-workbench-2026-08-17", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      browser: { progressiveDisclosure: { defaultOpenDisclosureCount: number } };
    };
    report.browser.progressiveDisclosure.defaultOpenDisclosureCount = 1;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, generatedAt: "2026-08-17T00:00:00.000Z" });
    expect(audit.gates.find((gate) => gate.id === "knowledge_viewport_workbench")).toMatchObject({ state: "contradicted" });
    expect(audit.gates.find((gate) => gate.id === "knowledge_viewport_workbench")?.detail).toContain("defaultOpen=1");
  });

  it.each([
    { name: "wiki disclosure count", field: "wikiDisclosureCount", value: 1 },
    { name: "governance disclosure count", field: "governanceDisclosureCount", value: 1 },
    { name: "first review state containment", field: "firstReviewStateInsidePanel", value: false },
  ] as const)("fails Knowledge viewport workbench closed when $name is broken", async ({ field, value }) => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "knowledge-viewport-workbench-2026-08-17", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      browser: { progressiveDisclosure: Record<string, number | boolean> };
    };
    report.browser.progressiveDisclosure[field] = value;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, generatedAt: "2026-08-17T00:00:00.000Z" });
    expect(audit.gates.find((gate) => gate.id === "knowledge_viewport_workbench")).toMatchObject({ state: "contradicted" });
  });

  it.each([
    {
      name: "mobile Wiki scroll ratio is missing",
      mutate: (browser: {
        progressiveDisclosure: Record<string, unknown>;
        referenceDisclosure: Record<string, unknown>;
      }) => {
        delete browser.progressiveDisclosure.maxMobileWikiScrollRatio;
      },
    },
    {
      name: "first disclosure bottom is missing",
      mutate: (browser: {
        progressiveDisclosure: Record<string, unknown>;
        referenceDisclosure: Record<string, unknown>;
      }) => {
        delete browser.referenceDisclosure.maxFirstDisclosureBottom;
      },
    },
  ])("fails Knowledge viewport workbench closed when $name", async ({ mutate }) => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(rootDir, "evaluation", "knowledge-viewport-workbench-2026-08-17", "report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      browser: {
        progressiveDisclosure: Record<string, unknown>;
        referenceDisclosure: Record<string, unknown>;
      };
    };
    mutate(report.browser);
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir, generatedAt: "2026-08-17T00:00:00.000Z" });
    expect(audit.gates.find((gate) => gate.id === "knowledge_viewport_workbench")).toMatchObject({ state: "contradicted" });
  });

  it.each([
    {
      name: "unbound editorial findings",
      mutate: (report: Record<string, unknown>) => {
        const verification = report.receiptVerification as Record<string, unknown>;
        verification.findingsBound = false;
        verification.editorialFindingsFingerprint = "";
        (verification.reviewCompletion as Record<string, unknown>).editorialFindingsReviewed = false;
      },
      detail: "receiptFindingsBound=false",
    },
    {
      name: "claimed reviewer identity",
      mutate: (report: Record<string, unknown>) => {
        const verification = report.receiptVerification as Record<string, unknown>;
        (verification.reviewCompletion as Record<string, unknown>).reviewerIdentityVerified = true;
      },
      detail: "receiptReviewerIdentityVerified=true",
    },
    {
      name: "claimed completed human review",
      mutate: (report: Record<string, unknown>) => {
        (report.reviewBoundary as Record<string, unknown>).humanReviewCompleted = true;
      },
      detail: "receiptHumanReviewCompleted=true",
    },
    {
      name: "claimed exact saved Share",
      mutate: (report: Record<string, unknown>) => {
        (report.mutationBoundary as Record<string, unknown>).exactSavedShareVerdict = "PASS";
      },
      detail: "receiptExactShare=PASS",
    },
  ])("contradicts the editorial review receipt on $name", async ({ mutate, detail }) => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join(
      rootDir,
      "evaluation",
      "document-editorial-review-receipt-2026-08-17",
      "report.json",
    );
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as Record<string, unknown>;
    mutate(report);
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({ rootDir });
    expect(audit.overall).toBe("contradicted");
    expect(audit.gates.find((gate) => gate.id === "document_editorial_review_cockpit")).toMatchObject({ state: "contradicted" });
    expect(audit.gates.find((gate) => gate.id === "document_editorial_review_cockpit")?.detail).toContain(detail);
  });

  it("contradicts the UI gate when a mobile document control falls below 44px", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const geometryPath = path.join(rootDir, "evaluation", "documents-touch-targets-2026-08-17", "report.json");
    const geometry = JSON.parse(fs.readFileSync(geometryPath, "utf8")) as {
      results: Array<{ cockpit: { selectorHeights: number[] } }>;
    };
    geometry.results[2].cockpit.selectorHeights[0] = 36;
    fs.writeFileSync(geometryPath, `${JSON.stringify(geometry, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const gate = audit.gates.find((item) => item.id === "ui_documents_share_cockpit");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.evidencePath).toBe(path.join("evaluation", "documents-touch-targets-2026-08-17", "report.json"));
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

  it("contradicts the UI gate when five mobile risk rows wrap again", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const geometryPath = path.join(rootDir, "evaluation", "document-risk-row-mobile-density-2026-08-27", "report.json");
    const geometry = JSON.parse(fs.readFileSync(geometryPath, "utf8")) as {
      afterLive: { mobileDay390x723: { riskRowSelectorRows: number } };
    };
    geometry.afterLive.mobileDay390x723.riskRowSelectorRows = 2;
    fs.writeFileSync(geometryPath, `${JSON.stringify(geometry, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const gate = audit.gates.find((item) => item.id === "ui_documents_share_cockpit");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.evidencePath).toBe(path.join("evaluation", "document-risk-row-mobile-density-2026-08-27", "report.json"));
    expect(gate?.detail).toContain("documentRiskRowMobileDensity=false");
  });

  it("contradicts the UI gate when the mobile add-risk-row action drops below 44px", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const geometryPath = path.join(rootDir, "evaluation", "document-risk-row-add-touch-2026-08-27", "browser-metrics.json");
    const geometry = JSON.parse(fs.readFileSync(geometryPath, "utf8")) as {
      afterLive: Array<{ theme: string; addRiskRowButton: { height: number; minHeight: string } }>;
    };
    const day = geometry.afterLive.find((row) => row.theme === "day");
    if (!day) throw new Error("Missing live Day add-risk-row fixture");
    day.addRiskRowButton.height = 32;
    day.addRiskRowButton.minHeight = "32px";
    fs.writeFileSync(geometryPath, `${JSON.stringify(geometry, null, 2)}\n`, "utf8");

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const gate = audit.gates.find((item) => item.id === "ui_documents_share_cockpit");
    expect(gate?.state).toBe("contradicted");
    expect(gate?.evidencePath).toBe(path.join("evaluation", "document-risk-row-add-touch-2026-08-27", "report.json"));
    expect(gate?.detail).toContain("documentRiskRowAddTouch=false");
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
  }, 90_000);

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
      "Configure approved distributed admission before claiming live export and weather-dependent orchestration readiness.",
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

  it("keeps final-99 as notice while recording source-aligned 12-document no-mutation coverage and the live distributed blocker", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    writeJson(rootDir, path.join("evaluation", "final-99-12-document-no-mutation-2026-08-17", "report.json"), {
      schema: "safeclaw-final-99-12-document-no-mutation/v1",
      verdict: "PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_12_DOCUMENT_NO_MUTATION_LIVE_HORIZONTAL_ADMISSION_BLOCKED",
      currentSourceCommit: "fixture-sha",
      currentSourceLocal: {
        overall: "pass_with_notice",
        canonicalDocumentCount: 12,
        canonicalDocumentsPassed: 12,
        corePdfCount: 4,
        corePdfsPassed: 4,
        orchestrationDocumentCount: 12,
        orchestrationDownloadCount: 14,
        orchestrationFailureCount: 0,
        askVerdict: "pass",
        requestedAiMode: "template",
      },
      liveAfterDeployment: {
        sourceCommit: "fixture-sha",
        productionCommit: "fixture-sha",
        overall: "blocked",
        canonicalDocumentCount: 12,
        canonicalDocumentsPassed: 12,
        documentDownloadVerdict: "blocked",
        blockerCode: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
        askVerdict: "pass",
        requestedAiMode: "template",
        blockerSurfaces: ["core_pdf_exports", "weather_preflight"],
        freshLiveRerunCompleted: true,
        liveRemediationRequired: true,
      },
      mutationBoundary: {
        executionMode: "no-mutation",
        dbMutationPerformed: false,
        providerGenerationCalled: false,
        providerDispatchCalled: false,
        shareSessionCreated: false,
        vectorOrEmbeddingMutationPerformed: false,
        wikiPublicationPerformed: false,
        koshaRegistryMutationPerformed: false,
      },
      remainingBoundaries: {
        exactSavedShareVerdict: "MISSING_EVIDENCE",
        providerDispatchPersistence: "APPROVAL_GATED",
        fullyAutomatedLaunchClaimAllowed: false,
      },
    });

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-08-17T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const finalGate = audit.gates.find((gate) => gate.id === "final_99_gate");

    expect(finalGate?.state).toBe("notice");
    expect(finalGate?.detail).toContain("coverage 12/12, 4/4");
    expect(finalGate?.detail).toContain("14 downloads and 0 failures");
    expect(finalGate?.detail).toContain("DISTRIBUTED_RATE_LIMIT_UNAVAILABLE");
    expect(finalGate?.detail).toContain("exact saved Share is MISSING_EVIDENCE");
  });

  it("contradicts final-99 when its 12-document companion closes a protected boundary", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join("evaluation", "final-99-12-document-no-mutation-2026-08-17", "report.json");
    writeJson(rootDir, reportPath, {
      schema: "safeclaw-final-99-12-document-no-mutation/v1",
      verdict: "PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_12_DOCUMENT_NO_MUTATION_LIVE_HORIZONTAL_ADMISSION_BLOCKED",
      currentSourceCommit: "fixture-sha",
      currentSourceLocal: {
        overall: "pass_with_notice",
        canonicalDocumentCount: 12,
        canonicalDocumentsPassed: 12,
        corePdfCount: 4,
        corePdfsPassed: 4,
        orchestrationDocumentCount: 12,
        orchestrationDownloadCount: 14,
        orchestrationFailureCount: 0,
        askVerdict: "pass",
        requestedAiMode: "template",
      },
      liveAfterDeployment: {
        sourceCommit: "fixture-sha",
        productionCommit: "fixture-sha",
        overall: "blocked",
        canonicalDocumentCount: 12,
        canonicalDocumentsPassed: 12,
        documentDownloadVerdict: "blocked",
        blockerCode: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
        askVerdict: "pass",
        requestedAiMode: "template",
        blockerSurfaces: ["core_pdf_exports", "weather_preflight"],
        freshLiveRerunCompleted: true,
        liveRemediationRequired: true,
      },
      mutationBoundary: {
        executionMode: "no-mutation",
        dbMutationPerformed: false,
        providerGenerationCalled: false,
        providerDispatchCalled: false,
        shareSessionCreated: false,
        vectorOrEmbeddingMutationPerformed: false,
        wikiPublicationPerformed: false,
        koshaRegistryMutationPerformed: false,
      },
      remainingBoundaries: {
        exactSavedShareVerdict: "PASS",
        providerDispatchPersistence: "APPROVAL_GATED",
        fullyAutomatedLaunchClaimAllowed: false,
      },
    });

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-08-17T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });
    const finalGate = audit.gates.find((gate) => gate.id === "final_99_gate");

    expect(finalGate?.state).toBe("contradicted");
    expect(finalGate?.detail).toContain("violates its source/live, coverage, mutation, or approval-boundary contract");
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
  }, 90_000);

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
  }, 90_000);

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

  it("contradicts LLM Wiki preflight when Hermes inspector closes protected boundaries", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const reportPath = path.join("evaluation", "rls-llm-wiki-approval-preflight-current-2026-07-20", "report.json");
    const report = JSON.parse(fs.readFileSync(path.join(rootDir, reportPath), "utf8")) as {
      hermesReviewEvidenceInspector: {
        privateEvidenceRawIdentityExposed: boolean;
        exactSavedShareVerdict: string;
        llmWikiPublication: string;
      };
    };
    report.hermesReviewEvidenceInspector.privateEvidenceRawIdentityExposed = true;
    report.hermesReviewEvidenceInspector.exactSavedShareVerdict = "PASS";
    report.hermesReviewEvidenceInspector.llmWikiPublication = "PROVEN";
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
  }, 90_000);

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

  it("fails closed when the reviewer-facing KOSHA checklist contains a pre-checked item", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const checklistPath = path.join(
      rootDir,
      "evaluation",
      "kosha-exact-promotion-review-gate-2026-07-22",
      "review-template.md",
    );
    const checklist = fs.readFileSync(checklistPath, "utf8").replace("- [ ] Human input 1", "- [x] Human input 1");
    writeText(rootDir, path.relative(rootDir, checklistPath), checklist);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.state).toBe("contradicted");
  });

  it("fails closed when KOSHA reviewer support loses a page-to-body mapping receipt", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const supportPath = path.join(
      rootDir,
      "evaluation",
      "kosha-exact-promotion-reviewer-support-2026-07-25",
      "report.json",
    );
    const support = JSON.parse(fs.readFileSync(supportPath, "utf8")) as {
      results: Array<{
        semanticGroups: Array<{
          locationMappingComplete: boolean;
          locationMappingFailure: string | null;
        }>;
      }>;
    };
    support.results[0]!.semanticGroups[0]!.locationMappingComplete = false;
    support.results[0]!.semanticGroups[0]!.locationMappingFailure = "semantic-match-non-whitespace-gap";
    writeJson(rootDir, path.relative(rootDir, supportPath), support);

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

  it("fails closed when the KOSHA reviewer cockpit loses linked roving tabs", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const browserPath = path.join(
      rootDir,
      "evaluation",
      "kosha-exact-promotion-reviewer-cockpit-2026-07-25",
      "browser-report.json",
    );
    const browser = JSON.parse(fs.readFileSync(browserPath, "utf8")) as {
      results: Array<{ candidateControlLinksValid: boolean }>;
    };
    browser.results[0]!.candidateControlLinksValid = false;
    writeJson(rootDir, path.relative(rootDir, browserPath), browser);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.state).toBe("contradicted");
  });

  it("fails closed when the KOSHA reviewer cockpit loses the human checklist link", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const browserPath = path.join(
      rootDir,
      "evaluation",
      "kosha-exact-promotion-reviewer-cockpit-2026-07-25",
      "browser-report.json",
    );
    const browser = JSON.parse(fs.readFileSync(browserPath, "utf8")) as {
      reviewChecklistAccessPass: boolean;
    };
    browser.reviewChecklistAccessPass = false;
    writeJson(rootDir, path.relative(rootDir, browserPath), browser);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.state).toBe("contradicted");
  });

  it("fails closed when the KOSHA mobile candidate rail can hide the selected review", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const browserPath = path.join(
      rootDir,
      "evaluation",
      "kosha-exact-promotion-reviewer-cockpit-2026-07-25",
      "browser-report.json",
    );
    const browser = JSON.parse(fs.readFileSync(browserPath, "utf8")) as {
      candidateNavigationReadabilityPass: boolean;
      results: Array<{ candidateEndState: { selectedFullyVisible: boolean } }>;
    };
    browser.candidateNavigationReadabilityPass = false;
    browser.results[1]!.candidateEndState.selectedFullyVisible = false;
    writeJson(rootDir, path.relative(rootDir, browserPath), browser);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.state).toBe("contradicted");
  });

  it("fails closed when the KOSHA mobile candidate rail hides review progress", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const browserPath = path.join(
      rootDir,
      "evaluation",
      "kosha-exact-promotion-reviewer-cockpit-2026-07-25",
      "browser-report.json",
    );
    const browser = JSON.parse(fs.readFileSync(browserPath, "utf8")) as {
      mobileCandidateProgressVisibilityPass: boolean;
      results: Array<{
        candidateRailHeaderDisplay: string;
        candidateContextText: string;
      }>;
    };
    browser.mobileCandidateProgressVisibilityPass = false;
    browser.results[1]!.candidateRailHeaderDisplay = "none";
    browser.results[1]!.candidateContextText = "";
    writeJson(rootDir, path.relative(rootDir, browserPath), browser);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.state).toBe("contradicted");
  });

  it("fails closed when the KOSHA reviewer cockpit hides raw evidence instead of preserving it", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const browserPath = path.join(
      rootDir,
      "evaluation",
      "kosha-exact-promotion-reviewer-cockpit-2026-07-25",
      "browser-report.json",
    );
    const browser = JSON.parse(fs.readFileSync(browserPath, "utf8")) as {
      evidenceReadingHierarchyPass: boolean;
      results: Array<{ rawExcerptTextPreserved: boolean }>;
    };
    browser.evidenceReadingHierarchyPass = false;
    browser.results[1]!.rawExcerptTextPreserved = false;
    writeJson(rootDir, path.relative(rootDir, browserPath), browser);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.state).toBe("contradicted");
  });

  it("fails closed when the KOSHA mobile tabs lose reciprocal tabpanel semantics", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const browserPath = path.join(
      rootDir,
      "evaluation",
      "kosha-exact-promotion-reviewer-cockpit-2026-07-25",
      "browser-report.json",
    );
    const browser = JSON.parse(fs.readFileSync(browserPath, "utf8")) as {
      responsiveTabPanelPass: boolean;
      results: Array<{ selectedCandidateVisibleMobilePaneCount: number }>;
    };
    browser.responsiveTabPanelPass = false;
    browser.results[1]!.selectedCandidateVisibleMobilePaneCount = 2;
    writeJson(rootDir, path.relative(rootDir, browserPath), browser);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.state).toBe("contradicted");
  });

  it("fails closed when the KOSHA reviewer cockpit cannot reject a stale draft", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const browserPath = path.join(
      rootDir,
      "evaluation",
      "kosha-exact-promotion-reviewer-cockpit-2026-07-25",
      "browser-report.json",
    );
    const browser = JSON.parse(fs.readFileSync(browserPath, "utf8")) as {
      draftStorageIdentityPass: boolean;
    };
    browser.draftStorageIdentityPass = false;
    writeJson(rootDir, path.relative(rootDir, browserPath), browser);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.state).toBe("contradicted");
  });

  it("fails closed when the KOSHA reviewer cockpit hides draft persistence status", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const browserPath = path.join(
      rootDir,
      "evaluation",
      "kosha-exact-promotion-reviewer-cockpit-2026-07-25",
      "browser-report.json",
    );
    const browser = JSON.parse(fs.readFileSync(browserPath, "utf8")) as {
      draftPersistenceVisibilityPass: boolean;
      results: Array<{ draftStatusVisible: boolean }>;
    };
    browser.draftPersistenceVisibilityPass = false;
    browser.results[1]!.draftStatusVisible = false;
    writeJson(rootDir, path.relative(rootDir, browserPath), browser);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.state).toBe("contradicted");
  });

  it("fails closed when the KOSHA reviewer cockpit cannot navigate to the next incomplete candidate", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const browserPath = path.join(
      rootDir,
      "evaluation",
      "kosha-exact-promotion-reviewer-cockpit-2026-07-25",
      "browser-report.json",
    );
    const browser = JSON.parse(fs.readFileSync(browserPath, "utf8")) as {
      nextIncompleteNavigationPass: boolean;
      draftStorageIdentity: { nextIncompleteSkippedCompletedIndex: number };
    };
    browser.nextIncompleteNavigationPass = false;
    browser.draftStorageIdentity.nextIncompleteSkippedCompletedIndex = 1;
    writeJson(rootDir, path.relative(rootDir, browserPath), browser);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.state).toBe("contradicted");
  });

  it("fails closed when the KOSHA reviewer cockpit accepts a future review timestamp", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const browserPath = path.join(
      rootDir,
      "evaluation",
      "kosha-exact-promotion-reviewer-cockpit-2026-07-25",
      "browser-report.json",
    );
    const browser = JSON.parse(fs.readFileSync(browserPath, "utf8")) as {
      futureReviewTimestampPass: boolean;
      draftStorageIdentity: { futureTimestampState: { ariaInvalid: string } };
    };
    browser.futureReviewTimestampPass = false;
    browser.draftStorageIdentity.futureTimestampState.ariaInvalid = "false";
    writeJson(rootDir, path.relative(rootDir, browserPath), browser);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.state).toBe("contradicted");
  });

  it("fails closed when the KOSHA reviewer cockpit loses title provenance", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const cockpitPath = path.join(
      rootDir,
      "evaluation",
      "kosha-exact-promotion-reviewer-cockpit-2026-07-25",
      "report.json",
    );
    const browserPath = path.join(
      rootDir,
      "evaluation",
      "kosha-exact-promotion-reviewer-cockpit-2026-07-25",
      "browser-report.json",
    );
    const cockpit = JSON.parse(fs.readFileSync(cockpitPath, "utf8")) as {
      titleReconciledCandidateCount: number;
    };
    const browser = JSON.parse(fs.readFileSync(browserPath, "utf8")) as {
      titleReconciliationPass: boolean;
    };
    cockpit.titleReconciledCandidateCount = 1;
    browser.titleReconciliationPass = false;
    writeJson(rootDir, path.relative(rootDir, cockpitPath), cockpit);
    writeJson(rootDir, path.relative(rootDir, browserPath), browser);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.state).toBe("contradicted");
  });

  it("fails document field isolation closed when foreign-worker heat guidance leaks into chemical work", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const guidancePath = path.join(
      rootDir,
      "evaluation",
      "live-foreign-worker-scenario-guidance-2026-08-27",
      "report.json",
    );
    const guidance = JSON.parse(fs.readFileSync(guidancePath, "utf8")) as {
      afterLive: { cases: Array<{ id: string; heatGuidancePresent: boolean }> };
    };
    const chemicalCase = guidance.afterLive.cases.find((item) => item.id === "chemical-cleaning-negative");
    expect(chemicalCase).toBeDefined();
    chemicalCase!.heatGuidancePresent = true;
    writeJson(rootDir, path.relative(rootDir, guidancePath), guidance);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "live_document_field_isolation")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_field_isolation")?.detail).toContain("foreignWorkerGuidance=false");
  });

  it("fails document field isolation closed when the warehouse seed leaks into roof repair", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const roofPath = path.join(
      rootDir,
      "evaluation",
      "live-roof-repair-scenario-isolation-2026-08-27",
      "report.json",
    );
    const roofReport = JSON.parse(fs.readFileSync(roofPath, "utf8")) as {
      afterLive: { cases: Array<{ id: string; warehouseSeedPresent: boolean }> };
    };
    const roofCase = roofReport.afterLive.cases.find((item) => item.id === "roof-repair-heat");
    expect(roofCase).toBeDefined();
    roofCase!.warehouseSeedPresent = true;
    writeJson(rootDir, path.relative(rootDir, roofPath), roofReport);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "live_document_field_isolation")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_field_isolation")?.detail).toContain("roofRepairIsolation=false");
  });

  it("fails document field isolation closed when an unrelated accident case is claimed", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const accidentPath = path.join(
      rootDir,
      "evaluation",
      "live-accident-case-scenario-isolation-2026-08-27",
      "report.json",
    );
    const accidentReport = JSON.parse(fs.readFileSync(accidentPath, "utf8")) as {
      afterLive: { cases: Array<{ id: string; titles: string[]; forbiddenIndustryPresent: boolean }> };
    };
    const roofCase = accidentReport.afterLive.cases.find((item) => item.id === "roof-heat");
    expect(roofCase).toBeDefined();
    roofCase!.titles.push("지게차 후진 충돌");
    roofCase!.forbiddenIndustryPresent = true;
    writeJson(rootDir, path.relative(rootDir, accidentPath), accidentReport);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "live_document_field_isolation")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_field_isolation")?.detail).toContain("accidentCaseIsolation=false");
  });

  it("fails document field isolation closed when maintenance accident evidence leaks another industry", async () => {
    const { buildNorthstarOpenGateAudit } = await loadAuditModule();
    const rootDir = createFixtureRoot();
    const maintenancePath = path.join(
      rootDir,
      "evaluation",
      "live-accident-case-maintenance-isolation-2026-08-27",
      "report.json",
    );
    const maintenanceReport = JSON.parse(fs.readFileSync(maintenancePath, "utf8")) as {
      afterLive: { cases: Array<{ id: string; titles: string[]; forbiddenIndustryPresent: boolean }> };
    };
    const maintenanceCase = maintenanceReport.afterLive.cases.find((item) => item.id === "gumi-guarding");
    expect(maintenanceCase).toBeDefined();
    maintenanceCase!.titles = ["지게차 후진 충돌 재해사례"];
    maintenanceCase!.forbiddenIndustryPresent = true;
    writeJson(rootDir, path.relative(rootDir, maintenancePath), maintenanceReport);

    const audit = buildNorthstarOpenGateAudit({
      rootDir,
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceSha: "fixture-sha",
    });

    expect(audit.gates.find((gate) => gate.id === "live_document_field_isolation")).toMatchObject({
      state: "contradicted",
    });
    expect(audit.gates.find((gate) => gate.id === "live_document_field_isolation")?.detail).toContain("maintenanceAccidentIsolation=false");
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
    expect(markdown).toContain("| distributed_admission_activation | approval_gated |");
    expect(markdown).toContain("| kosha_exact_trust_registry | proven |");
    expect(markdown).toContain("| kosha_exact_promotion_review_gate | approval_gated |");
    expect(markdown).toContain("shallow human-confirmation-only reviews are blocked");
    expect(markdown).toContain("LLM Wiki publishes itself.");
    expect(markdown).toContain("SafeClaw fixes SIF/KOSHA/current work-history evidence before LLM wording.");
  });
});
