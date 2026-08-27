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
  final99TwelveDocumentNoMutation: {
    verdict: string;
    currentSourceCommit: string;
    localCanonicalPassed: number | null;
    localCorePdfsPassed: number | null;
    localOrchestrationDownloads: number | null;
    liveOverall: string;
    liveBlockerCode: string;
    exactSavedShareVerdict: string;
    fullyAutomatedLaunchClaimAllowed: boolean;
  };
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
  launchOperationsReadiness: {
    verdict: string;
    rowCount: number;
    firstViewportCount: number;
    desktopFourColumnCount: number;
    mobileLocalScrollCount: number;
    browserConsoleErrorCount: number;
    publicAdmission: string;
    providerDispatch: string;
    photoVision: string;
    distributedAdmissionConfigured: boolean;
    providerDispatchReady: boolean;
    fullyAutomatedLaunchClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  documentExportCapabilityTruth: {
    verdict: string;
    admissionMode: string;
    admissionReason: string;
    admissionReady: boolean;
    desktopPanelWidth: number;
    desktopBetaButtonWidth: number;
    mobilePanelWidth: number;
    mobileBetaButtonWidth: number;
    distributedAdmissionActivation: string;
    exactSavedShareVerdict: string;
    fullyAutomatedLaunchClaimAllowed: boolean;
  };
  ontologyViewportWorkbench: {
    verdict: string;
    rowCount: number;
    passCount: number;
    maxBodyRatio: number;
    mobileTaskSwitchVerifiedCount: number;
    exactSavedShareVerdict: string;
    fullyAutomatedLaunchClaimAllowed: boolean;
  };
  knowledgeViewportWorkbench: {
    verdict: string;
    rowCount: number;
    passCount: number;
    maxBodyRatio: number;
    visiblePanelCountPerRow: number;
    reachableSectionCountPerRow: number;
    technicalDisclosureCount: number;
    referenceDisclosureCount: number;
    defaultOpenDisclosureCount: number;
    exclusiveDisclosureGroups: boolean;
    maxMobileTechnicalScrollRatio: number;
    maxMobileReferenceScrollRatio: number;
    wikiDisclosureCount: number;
    governanceDisclosureCount: number;
    maxMobileWikiScrollRatio: number;
    maxMobileGovernanceScrollRatio: number;
    firstDisclosureInsidePanel: boolean;
    firstReviewStateInsidePanel: boolean;
    exactSavedShareVerdict: string;
    llmWikiPublicationVerdict: string;
    sifEmbeddingRuntimeVerdict: string;
    fullyAutomatedLaunchClaimAllowed: boolean;
  };
  llmWikiCandidateContentReadiness: {
    verdict: string;
    localPassed: number;
    localViewportCount: number;
    livePassed: number;
    liveViewportCount: number;
    browserErrorCount: number;
    requiredSectionCount: number;
    readyFixtureCount: number;
    revisionRequiredFixtureCount: number;
    approvalFailsClosedForRevision: boolean;
    keepSiteOnlyAvailableForRevision: boolean;
    rejectAvailableForRevision: boolean;
    humanReviewCompleted: boolean;
    publicationState: string;
    publishAllowed: boolean;
    exactSavedShareVerdict: string;
    llmWikiPublication: string;
    supabaseRlsLaunchIsolation: string;
  };
  llmWikiCandidateContentMatrix: {
    verdict: string;
    localPassed: number;
    localFailed: number;
    livePassed: number;
    liveFailed: number;
    beforeVisibleEvidenceTraceCount: number;
    liveVisibleEvidenceTraceCount: number;
    liveTechnicalGuidanceBoundaryCount: number;
    liveLawCandidateBoundaryCount: number;
    providerVerdict: string;
    providerPassed: number;
    providerFailed: number;
    providerRuntimeBlocker: string;
    scenarioCount: number;
    requiredSectionCount: number;
    textualHazardGroundingRequired: boolean;
    matchedHazardMetadataAloneAccepted: boolean;
    reviewerVisibleEvidenceTraceRequired: boolean;
    scenarioSpecificOfficialSourceTermsRequired: boolean;
    technicalGuidanceAndLawRolesSeparated: boolean;
    explicitEventReviewFactsRequired: boolean;
    arbitraryRawPayloadAcceptedAsReviewFact: boolean;
    liveEventSemanticGroundingCount: number;
    livePrivateEventExposureCount: number;
    actualProductionCandidateQueueRead: boolean;
    routeFixtureAcceptedAsGenerationProof: boolean;
    deterministicFallbackProvenLive: boolean;
    evidenceVisibilityContractProvenLive: boolean;
    eventSemanticGroundingProvenLive: boolean;
    enhancedLlmGenerationProvenLive: boolean;
    humanReviewCompleted: boolean;
    publicationState: string;
    exactSavedShareVerdict: string;
    llmWikiPublication: string;
    supabaseRlsLaunchIsolation: string;
  };
  llmWikiSifEvidenceMatrix: {
    verdict: string;
    localPassed: number;
    livePassed: number;
    liveSifEvidenceBoundaryCount: number;
    liveTechnicalGuidanceBoundaryCount: number;
    liveLawCandidateBoundaryCount: number;
    authorityOrder: string[];
    exactSavedShareVerdict: string;
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
  tenantAuthorizationRemediation: {
    verdict: string;
    remediatedFindings: number;
    remainingBeforeFullRescan: number;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  spreadsheetFormulaNeutralization: {
    verdict: string;
    remediatedFindings: number;
    cumulativeRemediatedFindings: number;
    remainingBeforeFullRescan: number;
    fullRepositoryRescanCompleted: boolean;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  publicProviderWorkBudget: {
    verdict: string;
    remediatedFindings: number;
    cumulativeRemediatedFindings: number;
    remainingBeforeFullRescan: number;
    fullRepositoryRescanCompleted: boolean;
    securityCompleteClaimAllowed: boolean;
    productionProviderLoadTestPerformed: boolean;
    exactSavedShareVerdict: string;
  };
  documentExportWorkBudget: {
    verdict: string;
    remediatedFindings: number;
    cumulativeRemediatedFindings: number;
    remainingBeforeFullRescan: number;
    fullRepositoryRescanCompleted: boolean;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  fullRepositorySecurityScan: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    completeness: string;
    fileCount: number;
    candidateCount: number;
    reportableFindingCount: number;
    ignoredCandidateCount: number;
    deferredCandidateCount: number;
    medium: number;
    low: number;
    fullRepositorySecurityScanCompleted: boolean;
    securityCompleteClaimAllowed: boolean;
    remediationRequired: boolean;
    distributedRateLimitResidual: boolean;
    exactSavedShareVerdict: string;
  };
  repositorySecurityScanReconciliation: {
    verdict: string;
    targetRevision: string;
    conflictingScanCount: number | null;
    findingCountDelta: number | null;
    zeroFindingClaimAccepted: boolean;
    receiptContradictionCount: number | null;
    laterDeferredCandidateCount: number | null;
    correctedFreshScanRequired: boolean;
    correctedFreshScanCompleted: boolean;
    correctedScanId: string;
    correctedReportableFindingCount: number | null;
    correctedDeferredCandidateCount: number | null;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  documentEditorialReviewCockpit: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    livePassed: number;
    liveFailed: number;
    canonicalDocumentCount: number;
    reviewerCheckCount: number;
    desktopZones: number;
    mobileColumns: number;
    keyboardRovingTabNavigation: boolean;
    screenReaderTabPanelContract: boolean;
    escapeRestoresLaunchFocus: boolean;
    accessibilityRowsPassed: number;
    cockpitReady: boolean;
    receiptVerdict: string;
    receiptReady: boolean;
    receiptLockedCases: number;
    receiptDocumentCount: number;
    receiptUniqueDocumentKeyCount: number;
    receiptReviewerCheckCount: number;
    receiptApiRequestCount: number;
    reviewerSelfAttested: boolean;
    reviewerIdentityVerified: boolean;
    serverRecorded: boolean;
    approvalGranted: boolean;
    localReceiptProvesHumanIdentity: boolean;
    humanReviewCompleted: boolean;
    broadHumanWordingReviewRequired: boolean;
    dbMutationPerformed: boolean;
    providerDispatchCalled: boolean;
    shareSessionCreated: boolean;
    vectorRuntimeCalled: boolean;
    wikiPublished: boolean;
    koshaRegistryMutationPerformed: boolean;
    exactSavedShareVerdict: string;
  };
  currentSecurityRemediationLedger: {
    verdict: string;
    totalFindings: number | null;
    deployedSourceRemediationCount: number | null;
    unresolvedCount: number | null;
    approvalGatedCount: number | null;
    distributedRuntimeOpenCount: number | null;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  currentRepositorySecurityRescan: {
    verdict: string;
    scanId: string;
    scanRevision: string;
    productCommit: string;
    productionCommit: string;
    originalBaselineFindingCount: number | null;
    freshReportableFindingCount: number | null;
    liveRemediatedCount: number | null;
    databaseApprovalGatedRemainingCount: number | null;
    focusedTestFiles: number | null;
    focusedTestCount: number | null;
    focusedTestStatus: string;
    typecheck: string;
    build: string;
    exactSavedShareVerdict: string;
    databaseSecurityRemediation: string;
  };
  publicSearchDistributedRateLimitReadiness: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    sourceHeadMatchesProduction: boolean;
    productionModeVerified: boolean;
    observedMode: string;
    distributedActivationPending: boolean;
    sealedFindingsClosedWithoutRescan: boolean;
    remainingDbRlsFindings: number;
    exactSavedShareVerdict: string;
  };
  learningExportRendererSecurity: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    currentSourceDisposition: string;
    canonicalDeferredCandidateCount: number;
    fullRepositoryRescanRequired: boolean;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  hermesOpenclaw: {
    verdict: string;
    trustedTransportWired: boolean;
    durableAttemptLedgerWired: boolean;
    ledgerExplicitOptIn: boolean;
    ledgerAtomicReservation: boolean;
    ledgerTerminalRequiresReservation: boolean;
    ledgerStoresTerminalDigestOnly: boolean;
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
  hermesReviewDecisionFirstViewport: {
    verdict: string;
    beforePassed: number;
    beforeViewportCount: number;
    localPassed: number;
    localViewportCount: number;
    livePassed: number;
    liveViewportCount: number;
    desktopShortFirstActionBottom: number;
    mobileShortFirstActionBottom: number;
    occludedFirstActionCount: number;
    decisionConfirmationRequired: boolean;
    decisionConfirmationUnlocksAllActions: boolean;
    humanReviewCompleted: boolean;
    exactSavedShareVerdict: string;
    llmWikiPublication: string;
    supabaseRlsLaunchIsolation: string;
    providerDispatchPersistence: string;
  };
  hermesReviewCandidatePosition: {
    verdict: string;
    localPassed: number;
    localViewportCount: number;
    livePassed: number;
    liveViewportCount: number;
    baselineNumericPositionVisible: boolean;
    baselineMeasurementMethod: string;
    localCandidatePositions: string[];
    liveCandidatePositions: string[];
    humanReviewCompleted: boolean;
    exactSavedShareVerdict: string;
    llmWikiPublication: string;
    supabaseRlsLaunchIsolation: string;
    providerDispatchPersistence: string;
  };
  hermesKnowledgeReviewEvidenceInspector: {
    verdict: string;
    localPassed: number;
    localViewportCount: number;
    livePassed: number;
    liveViewportCount: number;
    productionAligned: boolean;
    browserErrorCount: number;
    itemLimit: number;
    fixtureItemCount: number;
    desktopEvidenceColumns: number;
    mobileMountedPaneCount: number;
    publicOfficialHttpsLinkCount: number;
    privateEvidenceRawIdentityExposed: boolean;
    evidenceInternalScroll: boolean;
    securityComplete: boolean;
    freshFullRepositoryScanRequired: boolean;
    exactSavedShareVerdict: string;
    llmWikiPublication: string;
    supabaseRlsLaunchIsolation: string;
    providerDispatchPersistence: string;
  };
  hermesReviewEventFactTraceability: {
    verdict: string;
    beforePassed: number;
    beforeViewportCount: number;
    localPassed: number;
    localViewportCount: number;
    livePassed: number;
    liveViewportCount: number;
    boundFactCount: number;
    orphanFactCount: number;
    privateEventTextExposed: boolean;
    humanReviewCompleted: boolean;
    exactSavedShareVerdict: string;
  };
  hermesReviewTraceBlocks: {
    verdict: string;
    beforePassed: number;
    beforeViewportCount: number;
    localPassed: number;
    localViewportCount: number;
    livePassed: number;
    liveViewportCount: number;
    resolvedTraceCount: number;
    unresolvedTraceCount: number;
    scopedFixtureHazardCount: number;
    allHazardsClosed: boolean;
    allDocumentsClosed: boolean;
    humanReviewCompleted: boolean;
    exactSavedShareVerdict: string;
  };
  hermesReviewTraceMatrix: {
    verdict: string;
    beforePassed: number;
    beforeViewportCount: number;
    localPassed: number;
    localViewportCount: number;
    livePassed: number;
    liveViewportCount: number;
    canonicalHazardCount: number;
    canonicalControlLinkCount: number;
    canonicalDocumentLinkCount: number;
    canonicalMatrixComplete: boolean;
    traceListInternalScroll: boolean;
    traceScrollOwner: string;
    candidatePaneInternalScroll: boolean;
    traceScreenshotContextVisible: boolean;
    humanReviewCompleted: boolean;
    exactSavedShareVerdict: string;
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
  documentSectionNavigation: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    sourceHeadMatchesProduction: boolean;
    total: number | null;
    pass: number | null;
    fail: number | null;
    rows: Array<{
      theme: string;
      label: string;
      verdict: string;
      shellRatio: number | null;
      sectionTabCount: number | null;
      selectedSectionTabCount: number | null;
      minimumSectionTabHeight: number | null;
      horizontalOverflow: boolean;
    }>;
    dbMutationPerformed: boolean;
    providerDispatchCalled: boolean;
    shareSessionCreated: boolean;
    exactSavedShareVerdict: string;
  };
  documentAllAuthoringGeometry: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    sourceHeadMatchesProduction: boolean;
    documentCount: number | null;
    viewportCaseCount: number | null;
    total: number | null;
    pass: number | null;
    fail: number | null;
    maximumShellRatio: number | null;
    maximumFirstActionBottom: number | null;
    dbMutationPerformed: boolean;
    providerDispatchCalled: boolean;
    shareSessionCreated: boolean;
    exactSavedShareVerdict: string;
  };
  publicGenerationAdmissionSecurity: {
    verdict: string;
    productCommit: string;
    productionCommit: string;
    liveMode: string;
    liveDeploymentVerified: boolean;
    distributedHardeningOpen: boolean;
    vulnerabilityCount: number;
    freshRescanRequired: boolean;
    exactSavedShareVerdict: string;
  };
  securityFollowupRemediation: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    sealedFindingCount: number | null;
    immutableOriginalBaselineFindingCount: number | null;
    deferredCandidateCount: number | null;
    focusedTests: number | null;
    liveProviderCancellationProbeExecuted: boolean;
    remainingSecurityWorkCount: number | null;
    originalBaselineRewritten: boolean;
    exactSavedShareVerdict: string;
  };
  securityResourceRemediation: {
    verdict: string;
    scanFindingCount: number | null;
    remediatedFindingCount: number | null;
    remainingScanFindings: number | null;
    providerDispatchPersistence: string;
    exactSavedShareVerdict: string;
  };
  securityUpstreamTransportRemediation: {
    verdict: string;
    scanFindingCount: number | null;
    remediatedThisWave: number | null;
    remediatedTotal: number | null;
    remainingScanFindings: number | null;
    externalProviderProbeExecuted: boolean;
    providerDispatchPersistence: string;
    exactSavedShareVerdict: string;
  };
  securitySafetyReferenceSurfaceRemediation: {
    verdict: string;
    findingId: string;
    scanFindingCount: number | null;
    remediatedThisWave: number | null;
    remediatedTotal: number | null;
    remainingScanFindings: number | null;
    liveReturnedItems: number | null;
    publicBodyFieldCount: number | null;
    publicPayloadFieldCount: number | null;
    publicMetadataFieldCount: number | null;
    rateLimitMode: string;
    providerDispatchPersistence: string;
    exactSavedShareVerdict: string;
  };
  publicJsonRequestBodyBudget: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    findingId: string;
    liveCaseCount: number;
    followUpSecurityScan: string;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  improvementPhotoAnalysisBudget: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    findingId: string;
    maxRequestBytes: number | null;
    aggregateConcurrency: number | null;
    liveCaseCount: number;
    distributedProductionActivation: string;
    followUpSecurityScan: string;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  publicProviderCancellation: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    findingId: string;
    tests: number | null;
    liveProviderCallExecuted: boolean;
    followUpSecurityScan: string;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  publicProviderAdmission: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    findingCount: number;
    capacity: number | null;
    fullModeWeight: number | null;
    liveCaseCount: number;
    distributedProductionActivation: string;
    followUpSecurityScan: string;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  publicAskDistributedAdmission: {
    verdict: string;
    sourceHead: string;
    productCommit: string;
    productionCommit: string;
    findingId: string;
    localCaseCount: number;
    liveCaseCount: number;
    providerCallExecuted: boolean;
    distributedBackendActivation: string;
    freshFollowUpScan: string;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  publicSearchDistributedAdmission: {
    verdict: string;
    sourceHead: string;
    productCommit: string;
    productionCommit: string;
    findingId: string;
    liveCaseCount: number;
    providerCallExecuted: boolean;
    distributedBackendActivation: string;
    freshFollowUpScan: string;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  mcpProviderAdmission: {
    verdict: string;
    findingId: string;
    focusedTests: number | null;
    adjacentTests: number | null;
    liveRateLimitMode: string;
    authenticatedProviderGenerationAvailability: string;
    distributedProductionActivation: string;
    validAuthenticatedRuntimeProbe: string;
    freshRescanRequired: boolean;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  shareRecipientContactVerification: {
    verdict: string;
    findingId: string;
    workerIdAloneAccepted: boolean;
    verificationValuePersisted: boolean;
    adjacentTests: number | null;
    browserTests: number | null;
    liveMissingSessionStatus: number | null;
    liveRealRecipientVerificationProbe: string;
    freshRescanRequired: boolean;
    recipientAckLiveDataApproval: string;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  securityAtomicDbRaceRemediation: {
    verdict: string;
    scanId: string;
    findingIds: string[];
    openFindingCount: number;
    approvalRequired: boolean;
    approvalPerformed: boolean;
    migrationAuthored: boolean;
    dbMutationPerformed: boolean;
    freshRescanRequired: boolean;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  liveDocumentsShareRoutePerception: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    documentsRows: number;
    workspaceShareRows: number;
    desktopShareRegions: number | null;
    routeSplitAloneAcceptedAsFix: boolean;
    exactSavedUserSessionReproduced: boolean;
    exactSavedShareVerdict: string;
    dbMutationPerformed: boolean;
  };
  deploymentFreshnessGuard: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    currentNoticePresent: boolean;
    driftRefreshVisible: boolean;
    frontendAuditViolations: number | null;
    liveAfterDeploymentPending: boolean;
    exactSavedShareVerdict: string;
    dbMutationPerformed: boolean;
  };
  mcpGenerationWorkBudgetSecurity: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    sourceHeadMatchesProduction: boolean;
    postBodyMaxBytes: number | null;
    adjacentTests: number | null;
    validAuthenticatedRuntimeProbeRequired: boolean;
    distributedActivationRequired: boolean;
    freshRescanRequired: boolean;
    exactSavedShareVerdict: string;
  };
  documentAuthoringPaneMargin: {
    verdict: string;
    productCommit: string;
    productionCommit: string;
    sourceHeadMatchesProduction: boolean;
    beforeBelowMargin: number | null;
    liveBelowMargin: number | null;
    liveMinimumMargin: number | null;
    liveMaximumShellRatio: number | null;
    exactSavedShareVerdict: string;
    routeSplitAloneAcceptedAsFix: boolean;
  };
  documentRawDrilldownGeometry: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    sourceHeadMatchesProduction: boolean;
    documentCount: number | null;
    viewportCaseCount: number | null;
    total: number | null;
    pass: number | null;
    fail: number | null;
    maximumShellRatio: number | null;
    maximumSourceBottom: number | null;
    maximumSourceClientHeight: number | null;
    maximumSourceRatio: number | null;
    overflowAutoCount: number;
    dbMutationPerformed: boolean;
    providerDispatchCalled: boolean;
    shareSessionCreated: boolean;
    exactSavedShareVerdict: string;
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
    storageFailureProbe: { verdict: "PASS", status: "error", visible: true },
    acceptanceContract: {
      canonicalDocumentCount: 12,
      includesRiskAssessment: true,
      reviewerCheckCount: 5,
      desktopZones: 3,
      mobileColumns: 1,
      keyboardRovingTabNavigation: true,
      screenReaderTabPanelContract: true,
      escapeRestoresLaunchFocus: true,
      bodyHeightUnchangedWhileOpen: true,
      longCopyContained: true,
      reviewStateStoredSeparately: true,
      reviewerHydrationDoesNotOverwriteStorage: true,
      storageLifecycleVisible: true,
      storageFailureVisible: true,
      editedTextInvalidatesCompletion: true,
      automaticReviewCannotClaimHumanCompletion: true,
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

function documentEditorialReviewReceiptFixture(): Record<string, unknown> {
  return {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_EDITORIAL_REVIEW_RECEIPT",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", environment: "production" },
    sourceHeadMatchesProduction: true,
    acceptanceContract: { canonicalDocumentCount: 12, reviewerCheckCount: 5, reviewerRequired: true, receiptLockedBeforeAllDocuments: true, currentTextFingerprintRequired: true, editorialFindingsFingerprintRequired: true, editorialFindingReviewRequired: true, localDownloadOnly: true, reviewerIdentityVerified: false, serverRecorded: false, approvalGranted: false },
    results: [
      { viewport: { width: 1440, height: 723 }, bodyHeightBefore: 723, bodyHeightAfter: 723, bodyHeightUnchanged: true, dialog: { right: 1310, bottom: 711 }, checklist: { overflowY: "auto" }, receiptLockedAtZero: true, reviewerInputVisible: true, horizontalOverflow: false },
      { viewport: { width: 390, height: 723 }, bodyHeightBefore: 723, bodyHeightAfter: 723, bodyHeightUnchanged: true, dialog: { right: 382, bottom: 715 }, checklist: { overflowY: "auto" }, receiptLockedAtZero: true, reviewerInputVisible: true, horizontalOverflow: false },
    ],
    receiptVerification: { schemaVersion: "safeclaw-document-editorial-review-receipt/v2", documentCount: 12, uniqueDocumentKeyCount: 12, reviewerCheckCount: 5, checksComplete: true, fingerprintsCurrent: true, findingsBound: true, editorialFindingsFingerprint: "fixture-findings-fingerprint", editorialFindingCount: 31, editorialFindingIdsRecorded: true, editorialFindingCategoriesReconcile: true, apiRequestCount: 0, reviewCompletion: { localChecklistCompleted: true, editorialFindingsReviewed: true, reviewerSelfAttested: true, reviewerIdentityVerified: false, serverRecorded: false, approvalGranted: false } },
    reviewBoundary: { automatedInteractionOnly: true, humanReviewCompleted: false, localReceiptProvesHumanIdentity: false, broadHumanWordingReviewRequired: true },
    mutationBoundary: { dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false, vectorRuntimeCalled: false, wikiPublished: false, koshaRegistryMutationPerformed: false, exactSavedShareVerdict: "MISSING_EVIDENCE" },
  };
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
      durableAttemptLedgerWired: true,
      ledgerExplicitOptIn: true,
      ledgerAtomicReservation: true,
      ledgerTerminalRequiresReservation: true,
      ledgerStoresTerminalDigestOnly: true,
      readinessKeepsLedgerOpen: true,
    },
    liveExecutionReadiness: {
      claimed: false,
      requires: [
        "operator configuration for the remote Hermes gateway and explicit durable ledger mode",
        "authenticated live execution canary after runtime configuration approval",
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
      documentsShareIaVerdict: "PASS_SCOPED_LIVE_PRODUCTION_WITH_EXACT_SAVED_SESSION_GAP",
    },
  });
  writeJson(root, "evaluation/launch-operations-readiness-2026-08-26/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_LAUNCH_OPERATIONS_READINESS",
    sourceHead: "fixture-sha",
    productCommit: "fixture-product",
    productionBuild: { commitSha: "fixture-sha", environment: "production" },
    rows: [
      { name: "desktop-day", cardCount: 4, firstViewport: true, horizontalOverflow: false, localHorizontalScroll: false, publicAdmission: "unavailable", providerDispatch: "preview_only", photoVision: "ready", browserConsoleErrors: [], root: { bottom: 503 } },
      { name: "desktop-night", cardCount: 4, firstViewport: true, horizontalOverflow: false, localHorizontalScroll: false, publicAdmission: "unavailable", providerDispatch: "preview_only", photoVision: "ready", browserConsoleErrors: [], root: { bottom: 503 } },
      { name: "mobile-day", cardCount: 4, firstViewport: true, horizontalOverflow: false, localHorizontalScroll: true, publicAdmission: "unavailable", providerDispatch: "preview_only", photoVision: "ready", browserConsoleErrors: [], root: { bottom: 492 } },
      { name: "mobile-night", cardCount: 4, firstViewport: true, horizontalOverflow: false, localHorizontalScroll: true, publicAdmission: "unavailable", providerDispatch: "preview_only", photoVision: "ready", browserConsoleErrors: [], root: { bottom: 492 } },
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
  writeJson(root, "evaluation/dependency-security-remediation-2026-07-28/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_DEPENDENCY_AUDIT_ZERO_FULL_SECURITY_SCAN_OPEN",
    sourceHead: "fixture-sha",
    productCommit: "fixture-product",
    productionBuild: {
      commitSha: "fixture-sha",
    },
    auditBefore: {
      totalVulnerablePackages: 19,
    },
    auditAfter: {
      totalVulnerablePackages: 0,
      high: 0,
      moderate: 0,
    },
    remainingBoundaries: {
      fullRepositorySecurityScanCompleted: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/follow-up-full-repository-security-scan-2026-08-02/report.json", {
    verdict: "COMPLETED_FOLLOWUP_REPOSITORY_SECURITY_SCAN_OPEN_FINDINGS_AND_DEFERRED_REVIEW",
    sourceHead: "fixture-sha",
    productionBuild: {
      commitSha: "fixture-sha",
    },
    scan: {
      completeness: "partial",
      fileCount: 5241,
      candidateCount: 32,
      reportableFindingCount: 17,
      ignoredCandidateCount: 8,
      deferredCandidateCount: 1,
      severity: {
        medium: 5,
        low: 12,
      },
    },
    remainingBoundaries: {
      fullRepositorySecurityScanCompleted: true,
      securityCompleteClaimAllowed: false,
      remediationRequired: true,
      distributedRateLimitResidual: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/public-search-distributed-rate-limit-readiness-2026-08-02/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_DISTRIBUTED_LIMITER_CAPABILITY_INSTANCE_FALLBACK_CONFIG_PENDING",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "previous-live-sha", sourceHeadMatchesProduction: false },
    configuration: {
      productionModeVerified: true,
      observedMode: "instance",
      distributedActivationPending: true,
    },
    boundary: {
      sealedFindingsClosedWithoutRescan: false,
      remainingDbRlsFindings: 13,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/learning-export-renderer-security-2026-08-02/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_RENDERER_INERT_LEARNING_EXPORT_SOURCE_CONTRACT",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha" },
    candidate: {
      currentSourceDisposition: "bounded_renderer_independent_inert_text_contract",
      fullRepositoryRescanRequiredForCanonicalClosure: true,
    },
    remainingBoundaries: {
      canonicalDeferredCandidateCount: 1,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/tenant-authorization-boundary-preflight-2026-07-29/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_TENANT_AUTHORIZATION_REMEDIATED_NO_MUTATION",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", sourceHeadIsAncestorOfProduction: true },
    summary: { greenCount: 2 },
    remainingBoundaries: {
      reportableFindingCount: 16,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/spreadsheet-formula-neutralization-2026-08-01/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_SPREADSHEET_FORMULA_NEUTRALIZATION",
    source: {
      productCommit: "fixture-sha",
      evidenceHead: "fixture-sha",
      productionMarkerAtValidation: "fixture-sha",
      liveAfterProductDeploy: "PASS",
    },
    changes: {
      findingClosure: {
        spreadsheetFormulaInjectionFindingsRemediatedInCurrentSource: 4,
        remainingReportableFindingsBeforeFullRescan: 12,
        fullRepositoryRescanCompleted: false,
        securityCompleteClaimAllowed: false,
      },
    },
    remainingBoundaries: { exactSavedShareVerdict: "MISSING_EVIDENCE" },
  });
  writeJson(root, "evaluation/public-provider-work-budget-2026-08-01/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_PROVIDER_WORK_BUDGETS",
    source: {
      productCommit: "fixture-sha",
      evidenceHead: "fixture-sha",
      productionMarkerAtValidation: "fixture-sha",
      liveAfterProductDeploy: "PASS",
    },
    changes: {
      findingClosure: {
        publicProviderAndUpstreamFindingsRemediatedInCurrentSource: 4,
        remainingReportableFindingsBeforeFullRescan: 8,
        fullRepositoryRescanCompleted: false,
        securityCompleteClaimAllowed: false,
      },
    },
    mutationBoundary: { productionProviderLoadTestPerformed: false },
    remainingBoundaries: { exactSavedShareVerdict: "MISSING_EVIDENCE" },
  });
  writeJson(root, "evaluation/document-export-work-budget-2026-08-01/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_EXPORT_WORK_BUDGETS",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha", productCommitIsAncestorOfProduction: true },
    findingClosure: {
      documentExportFindingsRemediatedInLiveProduction: 8,
      cumulativeBaselineFindingsWithBoundedRemediationEvidence: 18,
      remainingReportableFindingsBeforeFullRescan: 0,
      fullRepositoryRescanCompleted: false,
      securityCompleteClaimAllowed: false,
    },
    openBoundaries: { exactSavedShare: "MISSING_EVIDENCE" },
  });
  writeJson(root, "evaluation/hermes-knowledge-review-selected-workbench-2026-08-14/report.json", {
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
  writeJson(root, "evaluation/document-section-navigation-2026-08-02/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_SECTION_NAVIGATION",
    sourceHead: "TO_FILL",
    productionBuild: { commitSha: "TO_FILL", branch: "master", environment: "production" },
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
        shellRatio: label.includes("mobile") ? 2.76 : 2.21,
        actionBottom: label.includes("mobile") ? 536 : 340,
        sectionTabCount: 6,
        selectedSectionTabCount: 1,
        filledSectionTabCount: 6,
        emptySectionTabCount: 0,
        minimumSectionTabHeight: 46,
        horizontalOverflow: false,
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
  writeJson(root, "evaluation/document-all-authoring-geometry-2026-08-02/after-live/report.json", {
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
        documentKey,
        verdict: "PASS",
        metrics: {
          shellRatio: label.includes("mobile") ? 2.69 : 2.21,
          shellBottom: label.includes("mobile") ? 672 : 653,
          firstActionBottom: label.includes("mobile") ? 640 : 620,
        },
      }))
    )),
  });
  writeJson(root, "evaluation/security-public-generation-admission-2026-08-04/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_GENERATION_ADMISSION_INSTANCE_MODE_DISTRIBUTED_HARDENING_OPEN",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    runtimeBoundary: {
      liveDeploymentVerified: true,
      liveMode: "instance",
      distributedProductionHardeningOpen: true,
    },
    verification: { npmAudit: { verdict: "PASS", vulnerabilityCount: 0 } },
    remainingBoundaries: {
      freshPostChangeSecurityRescanRequired: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/codex-security-followup-remediation-2026-08-11/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_DEPLOYED_SECURITY_FOLLOWUP",
    sourceHead: "fixture-sha",
    securityScan: { sealedFindingCount: 3, immutableOriginalBaselineFindingCount: 18, deferredCandidateCount: 2 },
    verification: { focusedVitest: { tests: 129 } },
    deployment: { productionCommit: "fixture-sha", liveProviderCancellationProbeExecuted: false },
    remainingSecurityWork: [],
    boundaries: { originalBaselineRewritten: false, exactSavedShareVerdict: "MISSING_EVIDENCE" },
  });
  writeJson(
    root,
    "evaluation/document-editorial-review-cockpit-2026-08-16/report.json",
    documentEditorialReviewCockpitFixture(),
  );
  writeJson(
    root,
    "evaluation/document-editorial-review-receipt-2026-08-17/report.json",
    documentEditorialReviewReceiptFixture(),
  );
  writeJson(root, "evaluation/security-resource-remediation-2026-08-11/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_SECURITY_RESOURCE_REMEDIATION",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    sourceScan: { findingCount: 20 },
    remediatedFindings: [{}, {}, {}, {}, {}, {}],
    remainingBoundaries: {
      remainingScanFindings: 14,
      providerDispatchPersistence: "APPROVAL_GATED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/hermes-knowledge-review-evidence-inspector-2026-08-14/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR",
    sourceHead: "fixture-sha",
    productCommit: "fixture-product",
    productionCommit: "fixture-sha",
    local: { viewportCount: 8, passedCount: 8, failedCount: 0 },
    afterLive: { viewportCount: 8, passedCount: 8, failedCount: 0, productionAligned: true, browserErrorCount: 0 },
    evidenceContract: {
      itemLimit: 20,
      fixtureItemCount: 5,
      desktopEvidenceColumns: 2,
      mobileMountedPaneCount: 1,
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
    },
    mutationBoundary: { dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false },
    securityBoundary: { freshFullRepositoryScanRequired: true, securityComplete: false },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
    },
  });
  writeJson(root, "evaluation/security-upstream-transport-remediation-2026-08-11/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_SOURCE_PROVEN_UPSTREAM_TRANSPORT_SECURITY_NO_PROVIDER_PROBE",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    sourceScan: { findingCount: 20 },
    cumulativeRemediation: { remediatedThisWave: 2, remediatedTotal: 8 },
    liveChecks: { externalProviderProbe: { executed: false } },
    remainingBoundaries: {
      remainingScanFindings: 12,
      providerDispatchPersistence: "APPROVAL_GATED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/security-safety-reference-surface-remediation-2026-08-11/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_SAFETY_REFERENCE_SURFACE_BOUNDED",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    sourceScan: { findingCount: 20 },
    remediatedFinding: { findingId: "csf_343e69e970d1524202d48324" },
    cumulativeRemediation: { remediatedThisWave: 1, remediatedTotal: 9 },
    liveChecks: {
      publicSafetyReferenceSearch: {
        returnedItems: 5,
        bodyFieldCount: 0,
        payloadFieldCount: 0,
        metadataFieldCount: 0,
        rateLimitMode: "instance",
      },
    },
    remainingBoundaries: {
      remainingScanFindings: 11,
      providerDispatchPersistence: "APPROVAL_GATED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/public-json-request-body-budget-2026-08-11/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_JSON_PRE_PARSE_BUDGET",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    scan: { findingId: "csf_44619971f6e14344d1d76da5" },
    liveVerification: { cases: [{}, {}, {}] },
    remainingBoundaries: {
      followUpSecurityScan: "REQUIRED",
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/improvement-photo-analysis-budget-2026-08-11/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_IMPROVEMENT_PHOTO_ANALYSIS_BUDGET_WITH_INSTANCE_ADMISSION",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    scan: { findingId: "csf_4632cfb321a45b5f7429daef" },
    budgets: { maxRequestBytes: 42991616, aggregateConcurrency: 2 },
    liveVerification: { cases: [{}, {}] },
    remainingBoundaries: {
      distributedProductionActivation: "INSTANCE_FALLBACK_ACTIVE_NOT_DISTRIBUTED",
      followUpSecurityScan: "REQUIRED",
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/public-provider-cancellation-2026-08-11/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_PROVIDER_CANCELLATION_SOURCE_PROVEN",
    sourceHead: "fixture-sha",
    securityFinding: { findingId: "csf_278e8efc9722eb80016c42a3" },
    verification: { focusedAndAdjacentVitest: { tests: 104 } },
    productionBuild: { commitSha: "fixture-sha", liveProviderCallExecuted: false },
    remainingBoundaries: {
      followUpSecurityScan: "REQUIRED",
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/public-provider-admission-2026-08-11/report.json", {
    verdict: "PARTIAL_LIVE_PRODUCTION_WEIGHTED_INSTANCE_ADMISSION_DISTRIBUTED_ACTIVATION_PENDING",
    sourceHead: "fixture-sha",
    securityFindings: [{}, {}],
    contracts: { publicAskProviderAdmission: { capacity: 12, modeWeights: { full: 12 } } },
    productionBuild: { commitSha: "fixture-sha" },
    liveChecks: [{}, {}, {}],
    remainingBoundaries: {
      distributedProductionActivation: "PENDING_CONFIGURATION",
      followUpSecurityScan: "REQUIRED",
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/public-ask-distributed-admission-2026-08-14/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_ASK_PROVIDER_MODES_FAIL_CLOSED_WITHOUT_DISTRIBUTED_ADMISSION",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    securityFinding: { findingId: "csf_9b3cc6648586dabf4bfa61e9" },
    localProductionProbe: { providerCallExecuted: false, cases: [{}, {}, {}] },
    liveProductionProbe: { providerCallExecuted: false, cases: [{}, {}, {}, {}, {}] },
    remainingBoundaries: {
      distributedBackendActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      freshFollowUpScan: "REQUIRED",
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/public-search-distributed-admission-2026-08-14/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_SEARCH_PROVIDER_WORK_FAILS_CLOSED_WITHOUT_DISTRIBUTED_ADMISSION",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    securityFinding: { findingId: "csf_bb897a39277591f4fbab0ca7" },
    liveProductionProbe: { providerCallExecutedForEvidence: false, cases: [{}, {}, {}] },
    remainingBoundaries: {
      distributedBackendActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      freshFollowUpScan: "REQUIRED",
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/repository-security-scan-reconciliation-2026-08-11/report.json", {
    verdict: "PASS_CORRECTED_FRESH_CURRENT_SOURCE_SCAN_SEALED_OPEN_FINDINGS",
    targetRevision: "f0c8a7be02becd53c21fb80842cf23c571f22b1f",
    scans: [{}, {}],
    sameTargetConflict: { findingCountDelta: 17, zeroFindingClaimAcceptedForNorthstar: false },
    canonicalReceiptContradictions: [{}, {}],
    laterSecurityChain: { deferredCandidateCount: 2 },
    correctedFreshScan: {
      scanId: "c4e9e2f1-7ce4-4313-a651-32205fca401f",
      targetRevision: "910eccb713848aa4aee26f0c411ed0f07ada04a6",
      reportableFindingCount: 14,
      deferredCandidateCount: 9,
      coverageCompleteness: "partial",
      securityCompleteClaimAllowed: false,
    },
    requiredResolution: {
      correctedFreshFullRepositoryScanRequired: false,
      correctedFreshFullRepositoryScanCompleted: true,
    },
    boundaries: { exactSavedShareVerdict: "MISSING_EVIDENCE" },
  });
  writeJson(root, "evaluation/security-current-remediation-ledger-2026-08-13/report.json", {
    verdict: "NOTICE_LIVE_DEPLOYED_SOURCE_SECURITY_REMEDIATION_LEDGER_OPEN_BOUNDARIES",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha" },
    findingDisposition: {
      total: 23,
      deployedSourceRemediationCount: 17,
      unresolvedCount: 6,
      approvalGatedCount: 3,
      distributedRuntimeOpenCount: 3,
    },
    remainingBoundaries: { securityCompleteClaimAllowed: false, exactSavedShareVerdict: "MISSING_EVIDENCE" },
  });
  writeJson(root, "evaluation/final-approval-free-security-rescan-2026-08-16/report.json", {
    verdict: "NOTICE_FRESH_STANDARD_SCAN_APPROVAL_FREE_FINDINGS_CLOSED_NINE_APPROVAL_GATED_REMAIN",
    scanId: "38b87f68-ea7c-4843-a89c-5f97ba99e319",
    scanRevision: "52fc4e1896c0dda73b9d3181d5239cdf14c3f00f",
    productCommit: "52fc4e1896c0dda73b9d3181d5239cdf14c3f00f",
    productionCommit: "52fc4e1896c0dda73b9d3181d5239cdf14c3f00f",
    immutableOriginalBaselineFindingCount: 18,
    freshReportableFindingCount: 9,
    approvalFreeRemediatedCount: 5,
    approvalGatedRemainingCount: 9,
    verification: {
      focusedTests: { files: 8, tests: 88, status: "PASS" },
      typecheck: "PASS",
      build: { status: "PASS" },
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      databaseSecurityRemediation: "APPROVAL_GATED",
      liveAfterDeploymentRequired: false,
    },
  });
  writeJson(root, "evaluation/security-mcp-generation-work-budget-2026-08-04/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_SOURCE_INCLUDED_MCP_GENERATION_WORK_BUDGET_AUTHENTICATED_RUNTIME_PROBE_AND_RESCAN_PENDING",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    sourceHeadMatchesProduction: true,
    currentSourceContract: { postBodyMaxBytes: 98304 },
    verification: { adjacentMcp: { tests: 77 } },
    remainingBoundaries: {
      validAuthenticatedRuntimeProbeRequired: true,
      distributedProductionActivationRequired: true,
      freshSecurityRescanRequired: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/security-mcp-provider-admission-2026-08-14/report.json", {
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_DURABLE_MCP_PROVIDER_ADMISSION_RESCAN_PENDING",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha" },
    sealedFinding: { findingId: "csf_b10479b6501c208c4d11644e" },
    verification: {
      focused: { tests: 61 },
      focusedAndAdjacentMcp: { tests: 94 },
    },
    liveProbe: {
      rateLimitMode: "instance",
      authenticatedProviderGenerationAvailability: "FAIL_CLOSED_UNTIL_DISTRIBUTED_CONFIG",
    },
    remainingBoundaries: {
      distributedProductionActivation: "OPEN_OPERATOR_CONFIGURATION",
      validAuthenticatedRuntimeProbe: "NOT_EXECUTED_NO_MCP_TOKEN",
      freshFullRepositorySecurityScanRequiredForCanonicalClosure: true,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/share-recipient-contact-verification-2026-08-14/report.json", {
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_SHARE_RECIPIENT_CONTACT_VERIFICATION_RESCAN_PENDING",
    sourceHead: "fixture-sha",
    productionCommit: "fixture-sha",
    securityFinding: { findingId: "csf_e6a120c87c57d3529757bbde" },
    sourceContract: {
      invitationWorkerIdAloneAcceptedForConfirmation: false,
      verificationValuePersisted: false,
    },
    verification: {
      focusedAndAdjacent: { tests: 124 },
      recipientBrowser: { tests: 7 },
    },
    liveProbe: { status: 404 },
    remainingBoundaries: {
      liveRealRecipientVerificationProbe: "NOT_EXECUTED_NO_EXISTING_SAVED_SESSION",
      freshFullRepositorySecurityScanRequiredForCanonicalClosure: true,
      recipientAckLiveDataApproval: "APPROVAL_GATED",
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/security-atomic-db-race-approval-boundary-2026-08-14/report.json", {
    verdict: "APPROVAL_REQUIRED_TRANSACTIONAL_DB_RACE_REMEDIATION_NO_MUTATION",
    sourceHead: "fixture-sha",
    sealedScan: { scanId: "bd135da7-c309-4e8d-ace5-15222dd3f1c7", immutableFindingsPreserved: true },
    findings: [
      { findingId: "csf_a98f91f2e28285923aa618aa", currentSourceStillAffected: true },
      { findingId: "csf_8cec017794f281cd81e25643", currentSourceStillAffected: true },
    ],
    approvalRequest: { required: true, notApprovedOrPerformed: true },
    mutationBoundary: { migrationAuthored: false, dbMutationPerformed: false },
    remainingBoundaries: {
      freshFullRepositorySecurityScanRequiredAfterRemediation: true,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/live-documents-share-route-perception-2026-08-14/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_SCOPED_DOCUMENTS_AND_WORKSPACE_SHARE_EXACT_SESSION_GAP",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha" },
    measurement: {
      documents: [{ viewport: { width: 1440, height: 723 } }, { viewport: { width: 390, height: 723 } }],
      workspaceShare: [{ viewport: { width: 1440, height: 723 }, distinctDesktopRegions: 3 }, { viewport: { width: 390, height: 723 } }],
    },
    interpretation: { routeSplitAloneAcceptedAsFix: false },
    remainingBoundaries: { exactSavedUserSessionReproduced: false, exactSavedShareVerdict: "MISSING_EVIDENCE" },
    mutationBoundary: { dbMutationPerformed: false },
  });
  writeJson(root, "evaluation/deployment-freshness-guard-2026-08-14/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_DEPLOYMENT_FRESHNESS_GUARD",
    sourceHead: "fixture-sha",
    productionBuild: { commitSha: "fixture-sha" },
    verification: {
      liveBrowser: {
        normalCurrentDeployment: { noticePresent: false },
        simulatedShaDrift: { refreshButtonVisible: true },
      },
      canonicalFrontendStaticAudit: { violationCount: 0 },
    },
    remainingBoundaries: { liveAfterDeploymentPending: false, exactSavedShareVerdict: "MISSING_EVIDENCE" },
    mutationBoundary: { dbMutationPerformed: false },
  });
  writeJson(root, "evaluation/document-authoring-pane-margin-2026-08-02/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_ACTION_PANE_MARGIN",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    sourceHeadMatchesProduction: true,
    beforeLive: { paneMarginBelow16Count: 44 },
    afterLive: { paneMarginBelow16Count: 0, minimumPaneMargin: 16, maximumShellRatio: 2.36 },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      routeSplitAloneAcceptedAsFix: false,
    },
  });
  writeJson(root, "evaluation/document-raw-drilldown-geometry-2026-08-02/after-live/report.json", {
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
        documentKey,
        verdict: "PASS",
        metrics: {
          shellRatio: label.includes("mobile") ? 2.25 : 1.36,
          sourceBottom: label.includes("mobile") ? 693 : 568,
          sourceClientHeight: 258,
          sourceRatio: documentKey === "foreignWorkerTransmission" ? 35.91 : 8.8,
          sourceOverflowY: "auto",
        },
      }))
    )),
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
  writeJson(root, "evaluation/final-99-12-document-no-mutation-2026-08-17/report.json", {
    schema: "safeclaw-final-99-12-document-no-mutation/v1",
    verdict: "PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_12_DOCUMENT_NO_MUTATION_LIVE_HORIZONTAL_ADMISSION_BLOCKED",
    currentSourceCommit: firstHead,
    productionCommit: firstHead,
    currentSourceLocal: {
      canonicalDocumentsPassed: 12,
      corePdfsPassed: 4,
      orchestrationDownloadCount: 14,
      askVerdict: "pass",
      requestedAiMode: "template",
    },
    liveAfterDeployment: {
      sourceCommit: firstHead,
      productionCommit: firstHead,
      overall: "blocked",
      blockerCode: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      askVerdict: "pass",
      requestedAiMode: "template",
      blockerSurfaces: ["core_pdf_exports", "weather_preflight"],
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      fullyAutomatedLaunchClaimAllowed: false,
    },
  });
  writeJson(root, "evaluation/hermes-review-decision-first-viewport-2026-08-27/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_DECISION_FIRST_VIEWPORT",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    beforeLive: {
      viewportCount: 8,
      passedCount: 0,
      failedCount: 8,
      desktopShortFirstActionBottom: 957.39,
      mobileShortFirstActionBottom: 818.8,
    },
    afterLocal: { viewportCount: 8, passedCount: 8, failedCount: 0 },
    afterLive: {
      viewportCount: 8,
      passedCount: 8,
      failedCount: 0,
      desktopShortFirstActionBottom: 532.44,
      mobileShortFirstActionBottom: 622.75,
      occludedFirstActionCount: 0,
      decisionConfirmationRequired: true,
      decisionConfirmationUnlocksAllActions: true,
    },
    reviewBoundary: { humanReviewCompleted: false },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
    },
  });
  writeJson(root, "evaluation/hermes-review-candidate-position-2026-08-27/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_CANDIDATE_POSITION",
    sourceHead: "fixture-sha",
    productCommit: "fixture-sha",
    productionCommit: "fixture-sha",
    baseline: {
      numericCandidatePositionVisible: false,
      measurementMethod: "visual and source snapshot; no retroactive RED runner claim",
    },
    afterLocal: { viewportCount: 8, passedCount: 8, failedCount: 0, candidatePositions: ["1/3", "2/3", "3/3"] },
    afterLive: { viewportCount: 8, passedCount: 8, failedCount: 0, candidatePositions: ["1/3", "2/3", "3/3"] },
    reviewBoundary: { humanReviewCompleted: false },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
    },
  });
  writeJson(root, "evaluation/hermes-knowledge-review-event-facts-2026-08-26/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVENT_FACT_TRACEABILITY",
    sourceHead: "fixture-sha",
    productCommit: "fixture-product",
    productionCommit: "fixture-sha",
    beforeLive: { viewportCount: 8, passedCount: 0, failedCount: 8 },
    local: { viewportCount: 8, passedCount: 8, failedCount: 0 },
    afterLive: { viewportCount: 8, passedCount: 8, failedCount: 0 },
    eventFactsContract: { boundFactCount: 2, orphanFactCount: 0, privateEventTextExposed: false, humanReviewCompleted: false },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
    },
  });
  writeJson(root, "evaluation/hermes-knowledge-review-trace-blocks-2026-08-26/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_BLOCKS",
    sourceHead: "fixture-sha",
    productCommit: "fixture-product",
    productionCommit: "fixture-sha",
    beforeLive: { viewportCount: 8, passedCount: 0, failedCount: 8 },
    local: { viewportCount: 8, passedCount: 8, failedCount: 0 },
    afterLive: { viewportCount: 8, passedCount: 8, failedCount: 0 },
    traceabilityContract: {
      resolvedTraceCount: 1,
      unresolvedTraceCount: 0,
      scopedFixtureHazardCount: 1,
      allHazardsClosed: false,
      allDocumentsClosed: false,
      humanReviewCompleted: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
    },
  });
  writeJson(root, "evaluation/hermes-knowledge-review-trace-matrix-2026-08-26/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_MATRIX",
    sourceHead: "fixture-sha",
    productCommit: "fixture-product",
    productionCommit: "fixture-sha",
    beforeLive: { viewportCount: 8, passedCount: 0, failedCount: 8 },
    local: { viewportCount: 8, passedCount: 8, failedCount: 0 },
    afterLive: { viewportCount: 8, passedCount: 8, failedCount: 0 },
    traceabilityContract: {
      canonicalHazardCount: 8,
      canonicalControlLinkCount: 33,
      canonicalDocumentLinkCount: 33,
      canonicalMatrixComplete: true,
      traceListInternalScroll: false,
      traceScrollOwner: "candidate-pane",
      candidatePaneInternalScroll: true,
      traceScreenshotContextVisible: true,
      humanReviewCompleted: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
    },
  });
  writeJson(root, "evaluation/document-export-capability-truth-2026-08-17/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_EXPORT_CAPABILITY_TRUTH",
    sourceHead: "fixture-sha",
    productCommit: "fixture-product-sha",
    productionCommit: "fixture-sha",
    capability: { admission: { mode: "unavailable", ready: false, reason: "distributed_limiter_unavailable" } },
    browser: {
      desktop: { panelWidth: 843, legacyXlsButtonWidth: 191.25 },
      mobile: { panelWidth: 262, legacyXlsButtonWidth: 220 },
    },
    remainingBoundaries: {
      distributedAdmissionActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      fullyAutomatedLaunchClaimAllowed: false,
    },
  });
  writeJson(root, "evaluation/ontology-viewport-workbench-2026-08-17/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_ONTOLOGY_VIEWPORT_WORKBENCH",
    sourceHead: firstHead,
    productCommit: firstHead,
    productionCommit: firstHead,
    sourceHeadMatchesProduction: true,
    productCommitIncludedInProduction: true,
    routeSplitAloneAcceptedAsFix: false,
    browser: {
      rowCount: 10,
      passCount: 10,
      maxBodyRatio: 1,
      horizontalOverflowRows: 0,
      overlapRows: 0,
      minimumControlHeight: 44,
      screenshotCount: 14,
      desktop: { caseCount: 4, explorerPaneWidth: 848.5625, directoryPaneWidth: 339.4375, localScrollContained: true },
      tablet: { caseCount: 2, singleTaskPane: true, localScrollContained: true },
      mobile: { caseCount: 4, taskSwitchVerifiedCount: 4, minimumPaneClientHeight: 322, localScrollContained: true, selectionReturnsToExplorerTop: true },
    },
    mutationBoundary: { dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false, vectorMutationPerformed: false, wikiPublicationPerformed: false, koshaRegistryMutationPerformed: false },
    remainingBoundaries: { exactSavedShareVerdict: "MISSING_EVIDENCE", fullyAutomatedLaunchClaimAllowed: false },
  });
  writeJson(root, "evaluation/knowledge-viewport-workbench-2026-08-17/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_KNOWLEDGE_VIEWPORT_WORKBENCH",
    sourceHead: firstHead, productCommit: firstHead, productionCommit: firstHead,
    sourceHeadMatchesProduction: true, productCommitIncludedInProduction: true,
    routeSplitAloneAcceptedAsFix: false, selectedOnlyWorkbenchRequired: true,
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
        maxMobileReferenceScrollRatio: 3.68, firstDisclosureInsidePanel: true,
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
    mutationBoundary: { dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false, vectorMutationPerformed: false, wikiPublicationPerformed: false, koshaRegistryMutationPerformed: false },
    remainingBoundaries: { exactSavedShareVerdict: "MISSING_EVIDENCE", llmWikiPublicationVerdict: "APPROVAL_GATED", sifEmbeddingRuntimeVerdict: "APPROVAL_GATED", fullyAutomatedLaunchClaimAllowed: false },
  });
  writeJson(root, "evaluation/llm-wiki-candidate-readiness-2026-08-25/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_READINESS",
    sourceHead: firstHead, productCommit: firstHead, productionCommit: firstHead,
    local: { verdict: "PASS_CURRENT_SOURCE_LOCAL_LLM_WIKI_CANDIDATE_CONTENT_READINESS", viewportCount: 8, passedCount: 8, failedCount: 0 },
    afterLive: { verdict: "PASS_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_READINESS", viewportCount: 8, passedCount: 8, failedCount: 0, productionAligned: true, browserErrorCount: 0 },
    contentReadinessContract: {
      requiredSectionCount: 4, readyFixtureCount: 2, revisionRequiredFixtureCount: 1,
      selectedReadinessPanelCount: 1, approvalFailsClosedForRevision: true,
      keepSiteOnlyAvailableForRevision: true, rejectAvailableForRevision: true,
      humanReviewCompleted: false, publicationState: "unpublished", publishAllowed: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false,
      ontologyPublicationPerformed: false, vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false, koshaRegistryMutationPerformed: false,
    },
    remainingBoundaries: { exactSavedShareVerdict: "MISSING_EVIDENCE", llmWikiPublication: "APPROVAL_GATED", supabaseRlsLaunchIsolation: "APPROVAL_GATED" },
  });
  writeJson(root, "evaluation/llm-wiki-candidate-content-matrix-2026-08-25/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_WIKI_EVENT_SEMANTIC_AND_EVIDENCE_VISIBILITY_LLM_ENHANCED_RUNTIME_BLOCKED",
    productCommit: firstHead,
    sourceHead: firstHead,
    productionCommit: firstHead,
    liveAfterDeploymentRequired: false,
    evidenceVisibilityBeforeLive: { verdict: "RED_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX", sourceHead: firstHead, productionCommit: firstHead, passedCount: 0, failedCount: 5, reviewerEvidenceTraceCount: 0, technicalGuidanceBoundaryCount: 0, lawCandidateBoundaryCount: 0 },
    evidenceVisibilityAfterLocal: { verdict: "PASS_CURRENT_SOURCE_LOCAL_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX", sourceHead: firstHead, generationMode: "deterministic", passedCount: 5, failedCount: 0, reviewerEvidenceTraceCount: 5, technicalGuidanceBoundaryCount: 5, lawCandidateBoundaryCount: 5 },
    evidenceVisibilityAfterLive: { verdict: "PASS_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX", sourceHead: firstHead, productionCommit: firstHead, generationMode: "deterministic", passedCount: 5, failedCount: 0, reviewerEvidenceTraceCount: 5, technicalGuidanceBoundaryCount: 5, lawCandidateBoundaryCount: 5 },
    eventSemanticBeforeLive: { verdict: "RED_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX", sourceHead: firstHead, productionCommit: firstHead, passedCount: 0, failedCount: 5, eventSemanticGroundingCount: 0, privateEventExposureCount: 0 },
    eventSemanticAfterLocal: { verdict: "PASS_CURRENT_SOURCE_LOCAL_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX", sourceHead: firstHead, passedCount: 5, failedCount: 0, eventSemanticGroundingCount: 5, privateEventExposureCount: 0 },
    eventSemanticAfterLive: { verdict: "PASS_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX", sourceHead: firstHead, productionCommit: firstHead, passedCount: 5, failedCount: 0, eventSemanticGroundingCount: 5, privateEventExposureCount: 0 },
    afterLiveProvider: {
      verdict: "RED_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_MATRIX",
      sourceHead: firstHead,
      productionCommit: firstHead,
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
    remainingBoundaries: { exactSavedShareVerdict: "MISSING_EVIDENCE", llmWikiPublication: "APPROVAL_GATED", supabaseRlsLaunchIsolation: "APPROVAL_GATED" },
  });
  writeJson(root, "evaluation/llm-wiki-sif-evidence-matrix-2026-08-26/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_SIF_KOSHA_LAW_WIKI_CANDIDATE_EVIDENCE",
    productCommit: firstHead, sourceHead: firstHead, productionCommit: firstHead, liveAfterDeploymentRequired: false,
    afterLocal: { verdict: "PASS_CURRENT_SOURCE_LOCAL_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX", passedCount: 5, failedCount: 0, sifEvidenceBoundaryCount: 5, technicalGuidanceBoundaryCount: 5, lawCandidateBoundaryCount: 5, privateEventExposureCount: 0 },
    afterLive: { verdict: "PASS_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX", sourceHead: firstHead, productionCommit: firstHead, passedCount: 5, failedCount: 0, sifEvidenceBoundaryCount: 5, technicalGuidanceBoundaryCount: 5, lawCandidateBoundaryCount: 5, eventSemanticGroundingCount: 5, privateEventExposureCount: 0 },
    contentContract: { authorityOrder: ["sif", "kosha", "law"], scenarioCount: 5, reviewerVisibleSifEvidenceRequired: true, sifProvenanceRequired: true, sifIncidentControlEvidenceIsNonStatutory: true, koshaTechnicalGuidanceIsNonStatutory: true, statutoryClaimsRequireLawProvenance: true, privateSifTitleExposureAllowed: false, humanReviewCompleted: false, publicationState: "unpublished", publishAllowed: false },
    mutationBoundary: { dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false, ontologyPublicationPerformed: false, vectorOrEmbeddingMutationPerformed: false, koshaRegistryMutationPerformed: false },
    remainingBoundaries: { actualProductionCandidateQueueRead: false, enhancedLlmRuntime: "BLOCKED_DISTRIBUTED_RATE_LIMIT_CONFIGURATION", exactSavedShareVerdict: "MISSING_EVIDENCE", llmWikiPublication: "APPROVAL_GATED", supabaseRlsLaunchIsolation: "APPROVAL_GATED" },
  });
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
    const { buildNorthstarNextRunway, renderNorthstarNextRunwayMarkdown } = await loadNextRunwayModule();
    const { root, secondHead } = createFixtureRoot();
    pointLiveRollupAt(root, secondHead);
    const report = buildNorthstarNextRunway({
      rootDir: root,
      buildInfo: { commitSha: secondHead },
      generatedAt: "2026-07-22T00:00:00.000Z",
    });
    const markdown = renderNorthstarNextRunwayMarkdown(report);

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
    expect(report.final99TwelveDocumentNoMutation).toMatchObject({
      verdict: "PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_12_DOCUMENT_NO_MUTATION_LIVE_HORIZONTAL_ADMISSION_BLOCKED",
      localCanonicalPassed: 12,
      localCorePdfsPassed: 4,
      localOrchestrationDownloads: 14,
      liveOverall: "blocked",
      liveBlockerCode: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      liveAskVerdict: "pass",
      liveRequestedAiMode: "template",
      liveBlockerSurfaces: ["core_pdf_exports", "weather_preflight"],
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      fullyAutomatedLaunchClaimAllowed: false,
    });
    expect(markdown).toContain("DISTRIBUTED_RATE_LIMIT_UNAVAILABLE");
    expect(markdown).toContain("Exact saved Share remains `MISSING_EVIDENCE`");
    expect(report.approvalGated.map((gate) => gate.gate)).toEqual([
      "share_recipient_ack_approval",
      "provider_dispatch_persistence",
      "supabase_rls_launch_isolation",
      "llm_wiki_publication",
      "sif_embedding_runtime",
      "kosha_exact_promotion_review_gate",
      "security_atomic_db_race_remediation",
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
    expect(report.provenCurrentState).toContain("current_live_document_editorial_runtime");
    expect(report.noticeState).not.toContainEqual(expect.objectContaining({
      gate: "current_live_document_editorial_runtime",
    }));
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
      documentsShareIaVerdict: "PASS_SCOPED_LIVE_PRODUCTION_WITH_EXACT_SAVED_SESSION_GAP",
    });
    expect(report.provenCurrentState).toContain("product_capability_truth");
    expect(report.launchOperationsReadiness).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_LAUNCH_OPERATIONS_READINESS",
      rowCount: 4,
      firstViewportCount: 4,
      desktopFourColumnCount: 2,
      mobileLocalScrollCount: 2,
      browserConsoleErrorCount: 0,
      publicAdmission: "unavailable",
      providerDispatch: "preview_only",
      photoVision: "ready",
      distributedAdmissionConfigured: false,
      providerDispatchReady: false,
      fullyAutomatedLaunchClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.provenCurrentState).toContain("launch_operations_readiness_cockpit");
    expect(report.documentExportCapabilityTruth).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_EXPORT_CAPABILITY_TRUTH",
      admissionMode: "unavailable",
      admissionReason: "distributed_limiter_unavailable",
      admissionReady: false,
      desktopPanelWidth: 843,
      desktopBetaButtonWidth: 191.25,
      mobilePanelWidth: 262,
      mobileBetaButtonWidth: 220,
      distributedAdmissionActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      fullyAutomatedLaunchClaimAllowed: false,
    });
    expect(report.provenCurrentState).toContain("document_export_capability_truth");
    expect(report.ontologyViewportWorkbench).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_ONTOLOGY_VIEWPORT_WORKBENCH",
      rowCount: 10,
      passCount: 10,
      maxBodyRatio: 1,
      mobileTaskSwitchVerifiedCount: 4,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      fullyAutomatedLaunchClaimAllowed: false,
    });
    expect(report.provenCurrentState).toContain("ontology_viewport_workbench");
    expect(report.knowledgeViewportWorkbench).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_KNOWLEDGE_VIEWPORT_WORKBENCH",
      rowCount: 10,
      passCount: 10,
      maxBodyRatio: 1.02,
      visiblePanelCountPerRow: 1,
      reachableSectionCountPerRow: 6,
      technicalDisclosureCount: 6,
      referenceDisclosureCount: 7,
      defaultOpenDisclosureCount: 0,
      exclusiveDisclosureGroups: true,
      maxMobileTechnicalScrollRatio: 4.47,
      maxMobileReferenceScrollRatio: 3.68,
      wikiDisclosureCount: 2,
      governanceDisclosureCount: 2,
      maxMobileWikiScrollRatio: 2.03,
      maxMobileGovernanceScrollRatio: 2.2,
      firstDisclosureInsidePanel: true,
      firstReviewStateInsidePanel: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublicationVerdict: "APPROVAL_GATED",
      sifEmbeddingRuntimeVerdict: "APPROVAL_GATED",
      fullyAutomatedLaunchClaimAllowed: false,
    });
    expect(report.provenCurrentState).toContain("knowledge_viewport_workbench");
    expect(report.llmWikiCandidateContentReadiness).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_READINESS",
      localPassed: 8,
      localViewportCount: 8,
      livePassed: 8,
      liveViewportCount: 8,
      browserErrorCount: 0,
      requiredSectionCount: 4,
      readyFixtureCount: 2,
      revisionRequiredFixtureCount: 1,
      approvalFailsClosedForRevision: true,
      keepSiteOnlyAvailableForRevision: true,
      rejectAvailableForRevision: true,
      humanReviewCompleted: false,
      publicationState: "unpublished",
      publishAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
    });
    expect(report.provenCurrentState).toContain("llm_wiki_candidate_content_readiness");
    expect(report.llmWikiCandidateContentMatrix).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_WIKI_EVENT_SEMANTIC_AND_EVIDENCE_VISIBILITY_LLM_ENHANCED_RUNTIME_BLOCKED",
      localPassed: 5,
      localFailed: 0,
      livePassed: 5,
      liveFailed: 0,
      beforeVisibleEvidenceTraceCount: 0,
      liveVisibleEvidenceTraceCount: 5,
      liveTechnicalGuidanceBoundaryCount: 5,
      liveLawCandidateBoundaryCount: 5,
      providerVerdict: "RED_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_MATRIX",
      providerPassed: 0,
      providerFailed: 5,
      providerRuntimeBlocker: "distributed_rate_limit_unavailable_before_ai_generation",
      scenarioCount: 5,
      requiredSectionCount: 4,
      textualHazardGroundingRequired: true,
      matchedHazardMetadataAloneAccepted: false,
      reviewerVisibleEvidenceTraceRequired: true,
      scenarioSpecificOfficialSourceTermsRequired: true,
      technicalGuidanceAndLawRolesSeparated: true,
      explicitEventReviewFactsRequired: true,
      arbitraryRawPayloadAcceptedAsReviewFact: false,
      liveEventSemanticGroundingCount: 5,
      livePrivateEventExposureCount: 0,
      actualProductionCandidateQueueRead: false,
      routeFixtureAcceptedAsGenerationProof: false,
      deterministicFallbackProvenLive: true,
      evidenceVisibilityContractProvenLive: true,
      eventSemanticGroundingProvenLive: true,
      enhancedLlmGenerationProvenLive: false,
      humanReviewCompleted: false,
      publicationState: "unpublished",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
    });
    expect(report.provenCurrentState).toContain("llm_wiki_candidate_content_matrix");
    expect(markdown).toContain("does not read the production candidate queue or claim enhanced LLM quality");
    expect(report.llmWikiSifEvidenceMatrix).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_SIF_KOSHA_LAW_WIKI_CANDIDATE_EVIDENCE",
      localPassed: 5,
      livePassed: 5,
      liveSifEvidenceBoundaryCount: 5,
      liveTechnicalGuidanceBoundaryCount: 5,
      liveLawCandidateBoundaryCount: 5,
      authorityOrder: ["sif", "kosha", "law"],
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.provenCurrentState).toContain("llm_wiki_sif_evidence_matrix");
    expect(markdown).toContain("Reviewer-visible SIF evidence is measured by a separate companion matrix");
    expect(report.hermesOpenclaw).toMatchObject({
      verdict: "adapter_boundary_pass_live_execution_not_claimed",
      trustedTransportWired: true,
      durableAttemptLedgerWired: true,
      ledgerExplicitOptIn: true,
      ledgerAtomicReservation: true,
      ledgerTerminalRequiresReservation: true,
      ledgerStoresTerminalDigestOnly: true,
      readinessKeepsLedgerOpen: true,
      liveExecutionClaimed: false,
      remainingRequirements: [
        "operator configuration for the remote Hermes gateway and explicit durable ledger mode",
        "authenticated live execution canary after runtime configuration approval",
      ],
    });
    expect(report.noticeState).not.toContainEqual(expect.objectContaining({
      gate: "dependency_security_remediation",
    }));
    expect(report.dependencySecurityRemediation).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_DEPENDENCY_AUDIT_ZERO_FULL_SECURITY_SCAN_OPEN",
      beforeVulnerablePackages: 19,
      liveVulnerablePackages: 0,
      liveHigh: 0,
      liveModerate: 0,
      fullRepositorySecurityScanCompleted: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.provenCurrentState).toContain("dependency_security_remediation");
    expect(report.fullRepositorySecurityScan).toMatchObject({
      verdict: "COMPLETED_FOLLOWUP_REPOSITORY_SECURITY_SCAN_OPEN_FINDINGS_AND_DEFERRED_REVIEW",
      sourceHead: "fixture-sha",
      productionCommit: "fixture-sha",
      completeness: "partial",
      fileCount: 5241,
      candidateCount: 32,
      reportableFindingCount: 17,
      ignoredCandidateCount: 8,
      deferredCandidateCount: 1,
      medium: 5,
      low: 12,
      fullRepositorySecurityScanCompleted: true,
      securityCompleteClaimAllowed: false,
      remediationRequired: true,
      distributedRateLimitResidual: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.provenCurrentState).toContain("full_repository_security_scan");
    expect(report.noticeState).toContainEqual(expect.objectContaining({
      gate: "public_search_distributed_rate_limit_readiness",
      state: "notice",
    }));
    expect(report.publicSearchDistributedRateLimitReadiness).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_DISTRIBUTED_LIMITER_CAPABILITY_INSTANCE_FALLBACK_CONFIG_PENDING",
      sourceHead: "fixture-sha",
      productionCommit: "previous-live-sha",
      sourceHeadMatchesProduction: false,
      productionModeVerified: true,
      observedMode: "instance",
      distributedActivationPending: true,
      sealedFindingsClosedWithoutRescan: false,
      remainingDbRlsFindings: 13,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.provenCurrentState).toContain("learning_export_renderer_security");
    expect(report.learningExportRendererSecurity).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_RENDERER_INERT_LEARNING_EXPORT_SOURCE_CONTRACT",
      sourceHead: "fixture-sha",
      productionCommit: "fixture-sha",
      currentSourceDisposition: "bounded_renderer_independent_inert_text_contract",
      canonicalDeferredCandidateCount: 1,
      fullRepositoryRescanRequired: true,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.nextSafeWorkWithoutApproval).toContain(
      "preserve the immutable original 18-finding repository scan as the historical baseline; the sealed follow-up scan accounts for 5,241 files and retains 17 reportable findings plus one renderer-dependent deferred candidate, while the companion no-DB wave bounds 2 findings and mitigates 2 with a distributed-rate residual; resolve the remaining DB/RLS, renderer, distributed-rate, and exact saved Share boundaries before any security-complete claim",
    );
    expect(report.provenCurrentState).toContain("tenant_authorization_remediation");
    expect(report.provenCurrentState).toContain("spreadsheet_formula_neutralization");
    expect(report.provenCurrentState).toContain("public_provider_work_budget");
    expect(report.provenCurrentState).toContain("document_export_work_budget");
    expect(report.publicProviderWorkBudget).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_PUBLIC_PROVIDER_WORK_BUDGETS",
      remediatedFindings: 4,
      cumulativeRemediatedFindings: 10,
      remainingBeforeFullRescan: 8,
      fullRepositoryRescanCompleted: false,
      securityCompleteClaimAllowed: false,
      productionProviderLoadTestPerformed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.documentExportWorkBudget).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_EXPORT_WORK_BUDGETS",
      remediatedFindings: 8,
      cumulativeRemediatedFindings: 18,
      remainingBeforeFullRescan: 0,
      fullRepositoryRescanCompleted: false,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.provenCurrentState).toContain("hermes_knowledge_review_authority");
    expect(report.provenCurrentState).toContain("hermes_knowledge_review_ui");
    expect(report.provenCurrentState).toContain("hermes_review_decision_first_viewport");
    expect(report.provenCurrentState).toContain("hermes_review_candidate_position");
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
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      ontologyPublicationPerformed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
    });
    expect(report.hermesReviewDecisionFirstViewport).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_DECISION_FIRST_VIEWPORT",
      beforePassed: 0,
      beforeViewportCount: 8,
      localPassed: 8,
      localViewportCount: 8,
      livePassed: 8,
      liveViewportCount: 8,
      desktopShortFirstActionBottom: 532.44,
      mobileShortFirstActionBottom: 622.75,
      occludedFirstActionCount: 0,
      decisionConfirmationRequired: true,
      decisionConfirmationUnlocksAllActions: true,
      humanReviewCompleted: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
    });
    expect(report.hermesReviewCandidatePosition).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_CANDIDATE_POSITION",
      localPassed: 8,
      localViewportCount: 8,
      livePassed: 8,
      liveViewportCount: 8,
      baselineNumericPositionVisible: false,
      baselineMeasurementMethod: "visual and source snapshot; no retroactive RED runner claim",
      localCandidatePositions: ["1/3", "2/3", "3/3"],
      liveCandidatePositions: ["1/3", "2/3", "3/3"],
      humanReviewCompleted: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
    });
    expect(report.hermesKnowledgeReviewEvidenceInspector).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR",
      localPassed: 8,
      localViewportCount: 8,
      livePassed: 8,
      liveViewportCount: 8,
      productionAligned: true,
      browserErrorCount: 0,
      itemLimit: 20,
      fixtureItemCount: 5,
      desktopEvidenceColumns: 2,
      mobileMountedPaneCount: 1,
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
      securityComplete: false,
      freshFullRepositoryScanRequired: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
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
      documentsRemainingDebt: "full 12-document authoring and broad human wording polish remain separate; the all-12 launcher exposure and explicit raw/source editor are now live-bounded secondary drilldowns rather than serial page content, while deeper row/detail editing keeps the local workbench shell ratio target <= 3",
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
    expect(report.documentSectionNavigation).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_SECTION_NAVIGATION",
      sourceHeadMatchesProduction: true,
      total: 4,
      pass: 4,
      fail: 0,
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      rows: expect.arrayContaining([
        expect.objectContaining({
          theme: "day",
          label: "day-desktop",
          verdict: "PASS",
          shellRatio: 2.21,
          sectionTabCount: 6,
          selectedSectionTabCount: 1,
          minimumSectionTabHeight: 46,
          horizontalOverflow: false,
        }),
      ]),
    });
    expect(report.documentAllAuthoringGeometry).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_12_DOCUMENT_AUTHORING_GEOMETRY",
      sourceHeadMatchesProduction: true,
      documentCount: 12,
      viewportCaseCount: 4,
      total: 48,
      pass: 48,
      fail: 0,
      maximumShellRatio: 2.69,
      maximumFirstActionBottom: 640,
      minimumPaneMargin: 32,
      requiredPaneMargin: 32,
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.publicGenerationAdmissionSecurity).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_PUBLIC_GENERATION_ADMISSION_INSTANCE_MODE_DISTRIBUTED_HARDENING_OPEN",
      productCommit: "fixture-sha",
      productionCommit: "fixture-sha",
      liveMode: "instance",
      liveDeploymentVerified: true,
      distributedHardeningOpen: true,
      vulnerabilityCount: 0,
      freshRescanRequired: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.provenCurrentState).toContain("security_followup_remediation");
    expect(report.securityFollowupRemediation).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_DEPLOYED_SECURITY_FOLLOWUP",
      sealedFindingCount: 3,
      immutableOriginalBaselineFindingCount: 18,
      deferredCandidateCount: 2,
      focusedTests: 129,
      liveProviderCancellationProbeExecuted: false,
      remainingSecurityWorkCount: 0,
      originalBaselineRewritten: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.provenCurrentState).toContain("security_resource_remediation");
    expect(report.securityResourceRemediation).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_SECURITY_RESOURCE_REMEDIATION",
      scanFindingCount: 20,
      remediatedFindingCount: 6,
      remainingScanFindings: 14,
      providerDispatchPersistence: "APPROVAL_GATED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.documentEditorialReviewCockpit).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_EDITORIAL_REVIEW_COCKPIT",
      livePassed: 4,
      liveFailed: 0,
      canonicalDocumentCount: 12,
      reviewerCheckCount: 5,
      desktopZones: 3,
      mobileColumns: 1,
      keyboardRovingTabNavigation: true,
      screenReaderTabPanelContract: true,
      escapeRestoresLaunchFocus: true,
      accessibilityRowsPassed: 4,
      reviewerHydrationDoesNotOverwriteStorage: true,
      storageLifecycleVisible: true,
      storageFailureVisible: true,
      storageFailureProbePass: true,
      cockpitReady: true,
      receiptVerdict: "PASS_LIVE_PRODUCTION_DOCUMENT_EDITORIAL_REVIEW_RECEIPT",
      receiptReady: true,
      receiptLockedCases: 2,
      receiptDocumentCount: 12,
      receiptUniqueDocumentKeyCount: 12,
      receiptReviewerCheckCount: 5,
      receiptApiRequestCount: 0,
      reviewerSelfAttested: true,
      reviewerIdentityVerified: false,
      serverRecorded: false,
      approvalGranted: false,
      localReceiptProvesHumanIdentity: false,
      humanReviewCompleted: false,
      broadHumanWordingReviewRequired: true,
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorRuntimeCalled: false,
      wikiPublished: false,
      koshaRegistryMutationPerformed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.provenCurrentState).toContain("document_editorial_review_cockpit");
    expect(markdown).toContain("live geometry `4/4`");
    expect(markdown).toContain("accessibility cases `4/4`");
    expect(markdown).toContain("roving tabs/labelled tabpanel/Escape focus restore `true/true/true`");
    expect(markdown).toContain("humanReviewCompleted=`false`");
    expect(markdown).toContain("local receipt is `PASS_LIVE_PRODUCTION_DOCUMENT_EDITORIAL_REVIEW_RECEIPT`");
    expect(markdown).toContain("identity verified/server recorded/approval granted remain `false/false/false`");
    expect(markdown).toContain("broadHumanWordingReviewRequired=`true`");
    expect(markdown).toContain("exact saved Share remains `MISSING_EVIDENCE`");
    expect(report.provenCurrentState).toContain("security_upstream_transport_remediation");
    expect(report.provenCurrentState).toContain("security_safety_reference_surface_remediation");
    expect(report.securityUpstreamTransportRemediation).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_SOURCE_PROVEN_UPSTREAM_TRANSPORT_SECURITY_NO_PROVIDER_PROBE",
      scanFindingCount: 20,
      remediatedThisWave: 2,
      remediatedTotal: 8,
      remainingScanFindings: 12,
      externalProviderProbeExecuted: false,
      providerDispatchPersistence: "APPROVAL_GATED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.securitySafetyReferenceSurfaceRemediation).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_PUBLIC_SAFETY_REFERENCE_SURFACE_BOUNDED",
      findingId: "csf_343e69e970d1524202d48324",
      scanFindingCount: 20,
      remediatedThisWave: 1,
      remediatedTotal: 9,
      remainingScanFindings: 11,
      liveReturnedItems: 5,
      publicBodyFieldCount: 0,
      publicPayloadFieldCount: 0,
      publicMetadataFieldCount: 0,
      rateLimitMode: "instance",
      providerDispatchPersistence: "APPROVAL_GATED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.repositorySecurityScanReconciliation).toMatchObject({
      verdict: "PASS_CORRECTED_FRESH_CURRENT_SOURCE_SCAN_SEALED_OPEN_FINDINGS",
      conflictingScanCount: 2,
      findingCountDelta: 17,
      zeroFindingClaimAccepted: false,
      receiptContradictionCount: 2,
      laterDeferredCandidateCount: 2,
      correctedFreshScanRequired: false,
      correctedFreshScanCompleted: true,
      correctedScanId: "c4e9e2f1-7ce4-4313-a651-32205fca401f",
      correctedReportableFindingCount: 14,
      correctedDeferredCandidateCount: 9,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.currentSecurityRemediationLedger).toMatchObject({
      verdict: "NOTICE_LIVE_DEPLOYED_SOURCE_SECURITY_REMEDIATION_LEDGER_OPEN_BOUNDARIES",
      totalFindings: 23,
      deployedSourceRemediationCount: 17,
      unresolvedCount: 6,
      approvalGatedCount: 3,
      distributedRuntimeOpenCount: 3,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.noticeState).toContainEqual(expect.objectContaining({
      gate: "current_security_remediation_ledger",
      state: "notice",
    }));
    expect(report.noticeState).toContainEqual(expect.objectContaining({
      gate: "current_repository_security_rescan",
      state: "notice",
      reason: expect.stringContaining("all 5 approval-free candidates disappear"),
    }));
    expect(report.currentRepositorySecurityRescan).toMatchObject({
      verdict: "NOTICE_FRESH_STANDARD_SCAN_APPROVAL_FREE_FINDINGS_CLOSED_NINE_APPROVAL_GATED_REMAIN",
      scanId: "38b87f68-ea7c-4843-a89c-5f97ba99e319",
      scanRevision: "52fc4e1896c0dda73b9d3181d5239cdf14c3f00f",
      productCommit: "52fc4e1896c0dda73b9d3181d5239cdf14c3f00f",
      productionCommit: "52fc4e1896c0dda73b9d3181d5239cdf14c3f00f",
      originalBaselineFindingCount: 18,
      freshReportableFindingCount: 9,
      liveRemediatedCount: 5,
      databaseApprovalGatedRemainingCount: 9,
      focusedTestFiles: 8,
      focusedTestCount: 88,
      focusedTestStatus: "PASS",
      typecheck: "PASS",
      build: "PASS",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      databaseSecurityRemediation: "APPROVAL_GATED",
      liveAfterDeploymentRequired: false,
    });
    expect(report.provenCurrentState).toContain("public_json_request_body_budget");
    expect(report.publicJsonRequestBodyBudget).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_PUBLIC_JSON_PRE_PARSE_BUDGET",
      findingId: "csf_44619971f6e14344d1d76da5",
      liveCaseCount: 3,
      followUpSecurityScan: "REQUIRED",
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.improvementPhotoAnalysisBudget).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_IMPROVEMENT_PHOTO_ANALYSIS_BUDGET_WITH_INSTANCE_ADMISSION",
      findingId: "csf_4632cfb321a45b5f7429daef",
      maxRequestBytes: 42991616,
      aggregateConcurrency: 2,
      liveCaseCount: 2,
      distributedProductionActivation: "INSTANCE_FALLBACK_ACTIVE_NOT_DISTRIBUTED",
      followUpSecurityScan: "REQUIRED",
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.noticeState).toContainEqual(expect.objectContaining({
      gate: "improvement_photo_analysis_budget",
      state: "notice",
    }));
    expect(report.publicProviderCancellation).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_PUBLIC_PROVIDER_CANCELLATION_SOURCE_PROVEN",
      findingId: "csf_278e8efc9722eb80016c42a3",
      tests: 104,
      liveProviderCallExecuted: false,
      followUpSecurityScan: "REQUIRED",
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.noticeState).toContainEqual(expect.objectContaining({
      gate: "public_provider_cancellation",
      state: "notice",
    }));
    expect(report.publicProviderAdmission).toMatchObject({
      verdict: "PARTIAL_LIVE_PRODUCTION_WEIGHTED_INSTANCE_ADMISSION_DISTRIBUTED_ACTIVATION_PENDING",
      findingCount: 2,
      capacity: 12,
      fullModeWeight: 12,
      liveCaseCount: 3,
      distributedProductionActivation: "PENDING_CONFIGURATION",
      followUpSecurityScan: "REQUIRED",
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.noticeState).toContainEqual(expect.objectContaining({
      gate: "public_provider_admission",
      state: "notice",
    }));
    expect(report.publicAskDistributedAdmission).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_PUBLIC_ASK_PROVIDER_MODES_FAIL_CLOSED_WITHOUT_DISTRIBUTED_ADMISSION",
      findingId: "csf_9b3cc6648586dabf4bfa61e9",
      localCaseCount: 3,
      liveCaseCount: 5,
      providerCallExecuted: false,
      distributedBackendActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      freshFollowUpScan: "REQUIRED",
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.publicSearchDistributedAdmission).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_PUBLIC_SEARCH_PROVIDER_WORK_FAILS_CLOSED_WITHOUT_DISTRIBUTED_ADMISSION",
      findingId: "csf_bb897a39277591f4fbab0ca7",
      liveCaseCount: 3,
      providerCallExecuted: false,
      distributedBackendActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      freshFollowUpScan: "REQUIRED",
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.provenCurrentState).toContain("public_ask_distributed_admission");
    expect(report.provenCurrentState).toContain("repository_security_scan_reconciliation");
    expect(report.noticeState).not.toContainEqual(expect.objectContaining({
      gate: "repository_security_scan_reconciliation",
    }));
    expect(report.mcpGenerationWorkBudgetSecurity).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_SOURCE_INCLUDED_MCP_GENERATION_WORK_BUDGET_AUTHENTICATED_RUNTIME_PROBE_AND_RESCAN_PENDING",
      postBodyMaxBytes: 98304,
      adjacentTests: 77,
      validAuthenticatedRuntimeProbeRequired: true,
      distributedActivationRequired: true,
      freshRescanRequired: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.noticeState).toContainEqual(expect.objectContaining({
      gate: "mcp_generation_work_budget_security",
      state: "notice",
    }));
    expect(report.mcpProviderAdmission).toMatchObject({
      verdict: "PASS_LIVE_DEPLOYED_SOURCE_DURABLE_MCP_PROVIDER_ADMISSION_RESCAN_PENDING",
      findingId: "csf_b10479b6501c208c4d11644e",
      focusedTests: 61,
      adjacentTests: 94,
      liveRateLimitMode: "instance",
      authenticatedProviderGenerationAvailability: "FAIL_CLOSED_UNTIL_DISTRIBUTED_CONFIG",
      distributedProductionActivation: "OPEN_OPERATOR_CONFIGURATION",
      validAuthenticatedRuntimeProbe: "NOT_EXECUTED_NO_MCP_TOKEN",
      freshRescanRequired: true,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.noticeState).toContainEqual(expect.objectContaining({
      gate: "mcp_provider_admission_security",
      state: "notice",
    }));
    expect(report.shareRecipientContactVerification).toMatchObject({
      verdict: "PASS_LIVE_DEPLOYED_SOURCE_SHARE_RECIPIENT_CONTACT_VERIFICATION_RESCAN_PENDING",
      findingId: "csf_e6a120c87c57d3529757bbde",
      workerIdAloneAccepted: false,
      verificationValuePersisted: false,
      adjacentTests: 124,
      browserTests: 7,
      liveMissingSessionStatus: 404,
      liveRealRecipientVerificationProbe: "NOT_EXECUTED_NO_EXISTING_SAVED_SESSION",
      freshRescanRequired: true,
      recipientAckLiveDataApproval: "APPROVAL_GATED",
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.noticeState).toContainEqual(expect.objectContaining({
      gate: "share_recipient_contact_verification_security",
      state: "notice",
    }));
    expect(report.securityAtomicDbRaceRemediation).toMatchObject({
      verdict: "APPROVAL_REQUIRED_TRANSACTIONAL_DB_RACE_REMEDIATION_NO_MUTATION",
      scanId: "bd135da7-c309-4e8d-ace5-15222dd3f1c7",
      findingIds: ["csf_a98f91f2e28285923aa618aa", "csf_8cec017794f281cd81e25643"],
      openFindingCount: 2,
      approvalRequired: true,
      approvalPerformed: false,
      migrationAuthored: false,
      dbMutationPerformed: false,
      freshRescanRequired: true,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.approvalGated).toContainEqual(expect.objectContaining({
      gate: "security_atomic_db_race_remediation",
      state: "approval_gated",
    }));
    expect(report.liveDocumentsShareRoutePerception).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_SCOPED_DOCUMENTS_AND_WORKSPACE_SHARE_EXACT_SESSION_GAP",
      documentsRows: 2,
      workspaceShareRows: 2,
      desktopShareRegions: 3,
      routeSplitAloneAcceptedAsFix: false,
      exactSavedUserSessionReproduced: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      dbMutationPerformed: false,
    });
    expect(report.provenCurrentState).toContain("deployment_freshness_guard");
    expect(report.deploymentFreshnessGuard).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_DEPLOYMENT_FRESHNESS_GUARD",
      currentNoticePresent: false,
      driftRefreshVisible: true,
      frontendAuditViolations: 0,
      liveAfterDeploymentPending: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      dbMutationPerformed: false,
    });
    expect(report.noticeState).toContainEqual(expect.objectContaining({
      gate: "public_generation_admission_security",
      state: "notice",
    }));
    expect(report.documentAuthoringPaneMargin).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_ACTION_PANE_MARGIN",
      productCommit: "fixture-sha",
      productionCommit: "fixture-sha",
      sourceHeadMatchesProduction: true,
      beforeBelowMargin: 44,
      liveBelowMargin: 0,
      liveMinimumMargin: 16,
      liveMaximumShellRatio: 2.36,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      routeSplitAloneAcceptedAsFix: false,
    });
    expect(report.documentRawDrilldownGeometry).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_12_DOCUMENT_RAW_DRILLDOWN_GEOMETRY",
      sourceHeadMatchesProduction: true,
      documentCount: 12,
      viewportCaseCount: 4,
      total: 48,
      pass: 48,
      fail: 0,
      maximumShellRatio: 2.25,
      maximumSourceBottom: 693,
      maximumSourceClientHeight: 258,
      maximumSourceRatio: 35.91,
      overflowAutoCount: 48,
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
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
    expect(report.uiInterpretation.selectedEditorDetail).toContain("raw/source editing is separately live-bounded across 48/48 rows");
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
      "keep Hermes/OpenClaw authenticated live execution held: tenant envelope, tool denial, Evidence Harness, DNS-pinned trusted transport, and the explicit opt-in atomic attempt/terminal ledger are source/live-proven, while operator configuration and the authenticated canary remain approval-gated",
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
  }, 60_000);

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
  }, 15_000);

  it("does not prove Wiki candidate readiness when a publication boundary is overclaimed", async () => {
    const { buildNorthstarNextRunway } = await loadNextRunwayModule();
    const { root, secondHead } = createFixtureRoot();
    const reportPath = path.join(root, "evaluation/llm-wiki-candidate-readiness-2026-08-25/report.json");
    const evidence = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      remainingBoundaries: { llmWikiPublication: string };
    };
    evidence.remainingBoundaries.llmWikiPublication = "PASS";
    fs.writeFileSync(reportPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    pointLiveRollupAt(root, secondHead);

    const report = buildNorthstarNextRunway({
      rootDir: root,
      buildInfo: { commitSha: secondHead },
    });
    expect(report.hermesReviewEventFactTraceability).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVENT_FACT_TRACEABILITY",
      beforePassed: 0,
      beforeViewportCount: 8,
      localPassed: 8,
      localViewportCount: 8,
      livePassed: 8,
      liveViewportCount: 8,
      boundFactCount: 2,
      orphanFactCount: 0,
      privateEventTextExposed: false,
      humanReviewCompleted: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.provenCurrentState).toContain("hermes_review_event_fact_traceability");
    expect(report.hermesReviewTraceBlocks).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_BLOCKS",
      beforePassed: 0,
      beforeViewportCount: 8,
      localPassed: 8,
      localViewportCount: 8,
      livePassed: 8,
      liveViewportCount: 8,
      resolvedTraceCount: 1,
      unresolvedTraceCount: 0,
      scopedFixtureHazardCount: 1,
      allHazardsClosed: false,
      allDocumentsClosed: false,
      humanReviewCompleted: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.provenCurrentState).toContain("hermes_review_trace_blocks");
    expect(report.hermesReviewTraceMatrix).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_MATRIX",
      beforePassed: 0,
      beforeViewportCount: 8,
      localPassed: 8,
      localViewportCount: 8,
      livePassed: 8,
      liveViewportCount: 8,
      canonicalHazardCount: 8,
      canonicalControlLinkCount: 33,
      canonicalDocumentLinkCount: 33,
      canonicalMatrixComplete: true,
      traceListInternalScroll: false,
      traceScrollOwner: "candidate-pane",
      candidatePaneInternalScroll: true,
      traceScreenshotContextVisible: true,
      humanReviewCompleted: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.provenCurrentState).toContain("hermes_review_trace_matrix");

    expect(report.provenCurrentState).not.toContain("llm_wiki_candidate_content_readiness");
    expect(report.llmWikiCandidateContentReadiness.llmWikiPublication).toBe("PASS");
  }, 30_000);
});
