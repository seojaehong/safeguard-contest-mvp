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
  dispatchStandaloneCockpit: {
    firstViewportContainmentVerdict: string;
    beforeDesktopShort: { rootScrollDebt: number };
    liveDesktopShort: { rootScrollDebt: number; channelActionBottom: number; previewBottom: number };
    liveMobileShortDay: { primaryBottom: number };
    liveMobileShortNight: { primaryBottom: number };
    containmentExactSavedShareVerdict: string;
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
    dbMutationPerformed: boolean;
    wikiPublicationPerformed: boolean;
    exactSavedShareVerdict: string;
    llmWikiPublication: string;
    supabaseRlsLaunchIsolation: string;
  };
  llmWikiCandidateContentMatrix: {
    verdict: string;
    localPassed: number | null;
    localFailed: number | null;
    livePassed: number | null;
    liveFailed: number | null;
    beforeVisibleEvidenceTraceCount: number | null;
    liveVisibleEvidenceTraceCount: number | null;
    liveTechnicalGuidanceBoundaryCount: number | null;
    liveLawCandidateBoundaryCount: number | null;
    providerVerdict: string;
    providerPassed: number | null;
    providerFailed: number | null;
    providerRuntimeBlocker: string;
    scenarioCount: number | null;
    requiredSectionCount: number | null;
    textualHazardGroundingRequired: boolean;
    matchedHazardMetadataAloneAccepted: boolean;
    reviewerVisibleEvidenceTraceRequired: boolean;
    scenarioSpecificOfficialSourceTermsRequired: boolean;
    technicalGuidanceAndLawRolesSeparated: boolean;
    explicitEventReviewFactsRequired: boolean;
    arbitraryRawPayloadAcceptedAsReviewFact: boolean;
    liveEventSemanticGroundingCount: number | null;
    livePrivateEventExposureCount: number | null;
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
    localPassed: number | null;
    livePassed: number | null;
    liveSifEvidenceBoundaryCount: number | null;
    liveTechnicalGuidanceBoundaryCount: number | null;
    liveLawCandidateBoundaryCount: number | null;
    authorityOrder: string[];
    exactSavedShareVerdict: string;
  };
  tenantAuthorizationRemediation: {
    verdict: string;
    greenFindings: number | null;
    remainingBeforeFullRescan: number | null;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  spreadsheetFormulaNeutralization: {
    verdict: string;
    remediatedFindings: number | null;
    cumulativeRemediatedFindings: number;
    remainingBeforeFullRescan: number | null;
    fullRepositoryRescanCompleted: boolean;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  publicProviderWorkBudget: {
    verdict: string;
    remediatedFindings: number | null;
    cumulativeRemediatedFindings: number;
    remainingBeforeFullRescan: number | null;
    fullRepositoryRescanCompleted: boolean;
    securityCompleteClaimAllowed: boolean;
    productionProviderLoadTestPerformed: boolean;
    exactSavedShareVerdict: string;
  };
  documentExportWorkBudget: {
    verdict: string;
    remediatedFindings: number | null;
    cumulativeRemediatedFindings: number | null;
    remainingBeforeFullRescan: number | null;
    fullRepositoryRescanCompleted: boolean;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  fullRepositorySecurityScan: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    completeness: string;
    fileCount: number | null;
    reportableFindingCount: number | null;
    deferredCandidateCount: number | null;
    medium: number | null;
    low: number | null;
    securityCompleteClaimAllowed: boolean | null;
    distributedRateLimitResidual: boolean | null;
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
    receiptArtifact: string;
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
  currentRepositorySecurityRescan: {
    verdict: string;
    scanId: string;
    scanRevision: string;
    productCommit: string;
    productionCommit: string;
    originalBaselineFindingCount: number | null;
    reportableFindingCount: number | null;
    mediumFindingCount: number | null;
    lowFindingCount: number | null;
    coverageCompleteness: string;
    reviewedSurfaceCount: number | null;
    deferredCoverageItemCount: number | null;
    approvalFreeProductSourceCandidateCount: number | null;
    approvalFreeRemediatedCount: number | null;
    currentSourceRemediatedCount: number | null;
    currentSourceRemediationHead: string;
    approvalSensitiveShareCapabilityCount: number | null;
    freshFullRepositoryRescanRequired: boolean;
    currentSourceLiveProductionCommit: string;
    currentSourceLiveIncluded: boolean;
    databaseApprovalGatedRemainingCount: number | null;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
    databaseSecurityRemediation: string;
    approvalFreeProductSourceRemediation: string;
  };
  freshCurrentSourceSecurityScan: {
    verdict: string;
    scanId: string;
    sourceHead: string;
    deployedProductSource: string;
    reportableFindingCount: number | null;
    mediumFindingCount: number | null;
    lowFindingCount: number | null;
    coverageCompleteness: string;
    reviewedSurfaceCount: number | null;
    deferredCoverageItemCount: number | null;
    approvalGatedDatabaseOrAtomicityCount: number | null;
    approvalSensitiveShareCapabilityCount: number | null;
    approvalFreeProductSourceResidualCount: number | null;
    fullyClosedBoundedSourceCandidateCount: number | null;
    freshFullRepositoryScanCompleted: boolean;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
  };
  shareAckPreBodyAdmission: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    scanId: string;
    findingSlug: string;
    coarseIpRateAdmissionBeforeBody: boolean;
    coarseBodyConcurrencyLeaseBeforeBody: boolean;
    recipientSpecificAdmissionRetainedAfterParse: boolean;
    testsPassed: number | null;
    liveStatus: number | null;
    liveCode: string;
    liveRateLimitHeader: string;
    freshRescanRequired: boolean;
    securityCompleteClaimAllowed: boolean;
    recipientAckLiveDataApproval: string;
    exactSavedShareVerdict: string;
  };
  safetyStatusDisconnectLease: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    scanId: string;
    findingId: string;
    findingSlug: string;
    underlyingWorkSettlementPrecedesAbortRejection: boolean;
    admissionLeaseHeldUntilUnderlyingSettlement: boolean;
    thirdConcurrentRequestRejectedWhileTwoDisconnectedTasksSettle: boolean;
    testsPassed: number | null;
    liveStatus: number | null;
    liveCode: string;
    liveWorkUnit: string;
    freshRescanRequired: boolean;
    securityCompleteClaimAllowed: boolean;
    distributedAdmissionActivation: string;
    exactSavedShareVerdict: string;
  };
  weatherFallbackErrorRedaction: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    scanId: string;
    findingId: string;
    findingSlug: string;
    providerFallbackBranchCount: number | null;
    allProviderFallbackBranchesUseFixedPublicDetail: boolean;
    rawProviderErrorsLoggedServerSide: boolean;
    aggregateWeatherDetailOmitsRawProviderErrors: boolean;
    testsPassed: number | null;
    liveStatus: number | null;
    liveCode: string;
    liveRateLimitHeader: string;
    freshRescanRequired: boolean;
    securityCompleteClaimAllowed: boolean;
    distributedAdmissionActivation: string;
    exactSavedShareVerdict: string;
  };
  hwpxArchiveExpansionSecurity: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    scanId: string;
    findingId: string;
    findingSlug: string;
    centralDirectoryCheckedBeforeEntryData: boolean;
    entryCountBudget: number | null;
    totalUncompressedBytesBudget: number | null;
    largestEntryUncompressedBytesBudget: number | null;
    estimatedPeakWorkingBytesBudget: number | null;
    templateCount: number | null;
    availableTemplateCount: number | null;
    allTemplatesPassPreDecompressionBudget: boolean;
    testsPassed: number | null;
    liveStatus: number | null;
    liveCode: string;
    liveRateLimitHeader: string;
    archiveProcessingReached: boolean;
    freshRescanRequired: boolean;
    securityCompleteClaimAllowed: boolean;
    publicExportDistributedAdmission: string;
    exactSavedShareVerdict: string;
  };
  publicSearchDistributedRateLimitReadiness: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    productionModeVerified: boolean;
    configurationState: string;
    readinessMode: string;
    observedResponseMode: string;
    distributedActivationPending: boolean;
    sealedFindingsClosedWithoutRescan: boolean;
    productionFailClosedObserved: boolean;
    databaseFindingsRemainApprovalGated: boolean;
    exactSavedShareVerdict: string;
  };
  publicGenerationAdmissionSecurity: {
    verdict: string;
    productCommit: string;
    productionCommit: string;
    configurationState: string;
    readinessMode: string;
    observedResponseMode: string;
    productionFailClosedObserved: boolean;
    distributedActivationPending: boolean;
    freshRescanRequired: boolean;
    vulnerabilityCount: number | null;
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
    postBodyMaxBytes: number | null;
    adjacentTests: number | null;
    validAuthenticatedRuntimeProbeRequired: boolean;
    distributedActivationRequired: boolean;
    distributedHealthRequired: boolean;
    currentRefreshStatus: number | null;
    currentRefreshRateLimitMode: string;
    currentRefreshErrorCode: string;
    currentRefreshConfigurationState: string;
    currentRefreshReadinessReason: string;
    freshRescanRequired: boolean;
    exactSavedShareVerdict: string;
  };
  learningExportRendererSecurity: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    currentSourceDisposition: string;
    canonicalDeferredCandidateCount: number | null;
    fullRepositoryRescanRequired: boolean;
    securityCompleteClaimAllowed: boolean;
    exactSavedShareVerdict: string;
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
  hermesOpenclawRuntime: {
    verdict: string;
    sourceHead: string;
    productionCommit: string;
    testFilesPassed: number | null;
    testsPassed: number | null;
    durableAttemptLedgerWired: boolean;
    ledgerAtomicReservation: boolean;
    ledgerTerminalRequiresReservation: boolean;
    ledgerStoresTerminalDigestOnly: boolean;
    liveExecutionClaimed: boolean;
    exactSavedShareVerdict: string;
    authenticatedHermesCanary: string;
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
  final99: {
    twelveDocumentNoMutation: {
      verdict: string;
      localCanonicalPassed: number | null;
      localCorePdfsPassed: number | null;
      localOrchestrationDownloads: number | null;
      liveOverall: string;
      liveBlockerCode: string;
      exactSavedShareVerdict: string;
      fullyAutomatedLaunchClaimAllowed: boolean;
    };
  };
  evidence: Array<{
    id: string;
    sourceCommit: string | null;
    sourceStatus: string;
    productionCommit: string | null;
    productionStatus: string;
  }>;
  contradictions: unknown[];
};

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
    sourceHead: "TO_FILL",
    productionBuild: { commitSha: "TO_FILL", environment: "production" },
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

function freshCurrentSourceSecurityScanFixture(): Record<string, unknown> {
  return {
    verdict: "NOTICE_FRESH_CURRENT_SOURCE_STANDARD_SCAN_17_OPEN_FINDINGS_PARTIAL_COVERAGE_RECOVERED_DRAFT_HISTORY",
    scanId: "3358978a-75d1-454a-9dcd-4b63b52b9768",
    sourceHead: "TO_FILL",
    deployedProductSource: "ab30f5c5269430a558fcd8ef5c6331fb3c952a4e",
    scan: { status: "completed", mode: "standard", targetKind: "git_revision", coverageCompleteness: "partial", reviewedSurfaceCount: 12, deferredCoverageItemCount: 66, reportableFindingCount: 17, severity: { critical: 0, high: 0, medium: 2, low: 15 }, draftHistoryRecoveredByFinalizer: true },
    baseline: { immutableOriginalFindingCount: 18, preserved: true, rewritten: false },
    currentDisposition: { approvalGatedDatabaseOrAtomicityCount: 14, approvalSensitiveShareCapabilityCount: 0, approvalFreeProductSourceResidualCount: 3, fullyClosedBoundedSourceCandidateCount: 0, securityCompleteClaimAllowed: false },
    remainingBoundaries: { exactSavedShareVerdict: "MISSING_EVIDENCE", freshFullRepositoryScanCompleted: true, coverageClosureCompleted: false, securityCompleteClaimAllowed: false },
  };
}

function shareAckPreBodyAdmissionFixture(): Record<string, unknown> {
  return {
    verdict: "PASS_LIVE_PRODUCTION_SHARE_ACK_PREBODY_ADMISSION_SOURCE_REMEDIATED",
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
    finding: { scanId: "1411fb32-5c18-4d6a-b8ba-d52697757d8a", slug: "share-ack-prebody-admission" },
    currentSourceContract: {
      coarseIpRateAdmissionBeforeBody: true,
      coarseBodyConcurrencyLeaseBeforeBody: true,
      recipientSpecificAdmissionRetainedAfterParse: true,
    },
    verification: { focusedAndAdjacentTests: { testsPassed: 66 } },
    liveProbe: { status: 503, code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", rateLimitHeader: "distributed" },
    remainingBoundaries: {
      freshFullRepositoryRescanRequiredForScanClosure: true,
      securityCompleteClaimAllowed: false,
      shareRecipientAckLiveDataApproval: "APPROVAL_GATED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  };
}

function safetyStatusDisconnectLeaseFixture(): Record<string, unknown> {
  return {
    verdict: "PASS_LIVE_PRODUCTION_SAFETY_STATUS_DISCONNECT_LEASE_SOURCE_REMEDIATED",
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
    finding: { scanId: "1411fb32-5c18-4d6a-b8ba-d52697757d8a", findingId: "csf_b08a96f6b1ba27a33af52a6a", slug: "status-disconnect-residual" },
    currentSourceContract: {
      underlyingWorkSettlementPrecedesAbortRejection: true,
      admissionLeaseHeldUntilUnderlyingSettlement: true,
      thirdConcurrentRequestRejectedWhileTwoDisconnectedTasksSettle: true,
    },
    verification: { focusedAndAdjacentTests: { testsPassed: 16 } },
    liveProbe: { status: 503, code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", workUnitHeader: "safety-reference-status" },
    remainingBoundaries: {
      freshFullRepositoryRescanRequiredForScanClosure: true,
      securityCompleteClaimAllowed: false,
      distributedAdmissionActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  };
}

function weatherFallbackErrorRedactionFixture(): Record<string, unknown> {
  return {
    verdict: "PASS_LIVE_PRODUCTION_WEATHER_FALLBACK_ERROR_REDACTION_SOURCE_REMEDIATED",
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
    finding: {
      scanId: "1411fb32-5c18-4d6a-b8ba-d52697757d8a",
      findingId: "csf_fdda99ed09c6fb65bc74caff",
      slug: "weather-fallback-error-exposure",
    },
    currentSourceContract: {
      providerFallbackBranchCount: 8,
      allProviderFallbackBranchesUseFixedPublicDetail: true,
      rawProviderErrorsLoggedServerSide: true,
      aggregateWeatherDetailOmitsRawProviderErrors: true,
    },
    verification: { focusedAndAdjacentTests: { testsPassed: 16 } },
    liveProbe: { status: 503, code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", rateLimitHeader: "distributed" },
    remainingBoundaries: {
      freshFullRepositoryRescanRequiredForScanClosure: true,
      securityCompleteClaimAllowed: false,
      distributedAdmissionActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  };
}

function hwpxArchiveExpansionSecurityFixture(): Record<string, unknown> {
  return {
    verdict: "PASS_LIVE_PRODUCTION_HWPX_ARCHIVE_EXPANSION_SOURCE_REMEDIATED",
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
    finding: {
      scanId: "1411fb32-5c18-4d6a-b8ba-d52697757d8a",
      findingId: "csf_f8f783170119f2531bcc3163",
      slug: "hwpx-archive-expansion",
    },
    currentSourceContract: {
      centralDirectoryCheckedBeforeEntryData: true,
      entryCountBudget: 64,
      totalUncompressedBytesBudget: 20 * 1024 * 1024,
      largestEntryUncompressedBytesBudget: 10 * 1024 * 1024,
      estimatedPeakWorkingBytesBudget: 40 * 1024 * 1024,
    },
    committedTemplateManifest: {
      templateCount: 25,
      availableTemplateCount: 25,
      allTemplatesPassPreDecompressionBudget: true,
    },
    verification: { focusedAndAdjacentTests: { testsPassed: 37 } },
    liveProbe: {
      status: 503,
      code: "PUBLIC_EXPORT_CONCURRENCY_LIMIT",
      rateLimitHeader: "instance",
      archiveProcessingReached: false,
    },
    remainingBoundaries: {
      freshFullRepositoryRescanRequiredForScanClosure: true,
      securityCompleteClaimAllowed: false,
      publicExportDistributedAdmission: "OPEN_OPERATOR_CONFIGURATION",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  };
}

function documentEditorialReviewReceiptFixture(): Record<string, unknown> {
  return {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_EDITORIAL_REVIEW_RECEIPT",
    sourceHead: "TO_FILL",
    productionBuild: { commitSha: "TO_FILL", environment: "production" },
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
      { id: "document_editorial_review_cockpit", state: "proven", evidencePath: "evaluation/document-editorial-review-cockpit-2026-08-16/report.json", detail: "live 4/4 cockpit preserves human review and exact Share boundaries" },
      { id: "product_capability_truth", state: "proven", evidencePath: "evaluation/product-capability-truth-2026-07-25/report.json", detail: "live capability truth passed without unlocking provider dispatch" },
      { id: "document_export_capability_truth", state: "proven", evidencePath: "evaluation/document-export-capability-truth-2026-08-17/report.json", detail: "live export truth passed while distributed admission remains locked" },
      { id: "ontology_viewport_workbench", state: "proven", evidencePath: "evaluation/ontology-viewport-workbench-2026-08-17/report.json", detail: "live ontology viewport workbench passed with exact Share boundary retained" },
      { id: "tenant_authorization_remediation", state: "proven", evidencePath: "evaluation/tenant-authorization-boundary-preflight-2026-07-29/report.json", detail: "two tenant findings remediated" },
      { id: "spreadsheet_formula_neutralization", state: "proven", evidencePath: "evaluation/spreadsheet-formula-neutralization-2026-08-01/report.json", detail: "four formula findings remediated" },
      { id: "public_provider_work_budget", state: "proven", evidencePath: "evaluation/public-provider-work-budget-2026-08-01/report.json", detail: "four provider-budget findings remediated" },
      { id: "document_export_work_budget", state: "proven", evidencePath: "evaluation/document-export-work-budget-2026-08-01/report.json", detail: "eight export-budget findings remediated" },
      { id: "full_repository_security_scan", state: "proven", evidencePath: "evaluation/follow-up-full-repository-security-scan-2026-08-02/report.json", detail: "sealed follow-up scan with 17 reportable findings and one deferred candidate" },
      { id: "repository_security_scan_reconciliation", state: "notice", evidencePath: "evaluation/repository-security-scan-reconciliation-2026-08-11/report.json", detail: "same-target scan conflict with fail-open receipts" },
      { id: "current_security_remediation_ledger", state: "notice", evidencePath: "evaluation/security-current-remediation-ledger-2026-08-13/report.json", detail: "17/23 deployed-source remediated; six approval or distributed-runtime boundaries remain open" },
      { id: "current_repository_security_rescan", state: "notice", evidencePath: "evaluation/current-full-repository-security-scan-2026-08-27/report.json", detail: "19 findings with partial coverage; 12 approval-gated and 7 approval-free source candidates remain open" },
      { id: "fresh_current_source_security_scan", state: "notice", evidencePath: "evaluation/current-source-standard-security-scan-2026-08-28-complete/report.json", detail: "17 findings with partial recovered coverage; three approval-free source residuals and approval-gated boundaries remain open" },
      { id: "share_ack_prebody_admission_security", state: "notice", evidencePath: "evaluation/share-ack-prebody-admission-2026-08-28/report.json", detail: "Share ACK pre-body admission is live; fresh rescan and exact saved Share remain open" },
      { id: "safety_status_disconnect_lease_security", state: "notice", evidencePath: "evaluation/safety-status-disconnect-lease-2026-08-28/report.json", detail: "Safety status disconnect lease retention is live; fresh rescan and durable activation remain open" },
      { id: "weather_fallback_error_redaction_security", state: "notice", evidencePath: "evaluation/weather-fallback-error-redaction-2026-08-28/report.json", detail: "Weather fallback errors are server-only; fresh rescan and durable activation remain open" },
      { id: "public_search_distributed_rate_limit_readiness", state: "notice", evidencePath: "evaluation/public-search-distributed-rate-limit-readiness-2026-08-02/report.json", detail: "current-source capability with production configuration pending" },
      { id: "public_generation_admission_security", state: "notice", evidencePath: "evaluation/security-public-generation-admission-2026-08-04/report.json", detail: "live generation routes fail closed when distributed configuration is unavailable; activation and fresh rescan pending" },
      { id: "security_followup_remediation", state: "proven", evidencePath: "evaluation/codex-security-followup-remediation-2026-08-11/report.json", detail: "deployed three-finding remediation with immutable baseline preserved" },
      { id: "security_resource_remediation", state: "proven", evidencePath: "evaluation/security-resource-remediation-2026-08-11/report.json", detail: "live 6/20 resource findings remediated with 14 remaining" },
      { id: "security_upstream_transport_remediation", state: "proven", evidencePath: "evaluation/security-upstream-transport-remediation-2026-08-11/report.json", detail: "live/source 2 upstream findings remediated, cumulative 8/20 with 12 remaining" },
      { id: "security_safety_reference_surface_remediation", state: "proven", evidencePath: "evaluation/security-safety-reference-surface-remediation-2026-08-11/report.json", detail: "live public safety-reference bodies omitted, cumulative 9/20 with 11 remaining" },
      { id: "public_json_request_body_budget", state: "proven", evidencePath: "evaluation/public-json-request-body-budget-2026-08-11/report.json", detail: "three public JSON routes reject oversized bodies before parsing" },
      { id: "improvement_photo_analysis_budget", state: "notice", evidencePath: "evaluation/improvement-photo-analysis-budget-2026-08-11/report.json", detail: "photo budgets are live with instance admission and distributed activation open" },
      { id: "public_provider_cancellation", state: "notice", evidencePath: "evaluation/public-provider-cancellation-2026-08-11/report.json", detail: "provider cancellation is source-proven in deployed production with live provider probe held" },
      { id: "public_provider_admission", state: "notice", evidencePath: "evaluation/public-provider-admission-2026-08-11/report.json", detail: "weighted instance admission is live with distributed activation pending" },
      { id: "public_ask_distributed_admission", state: "proven", evidencePath: "evaluation/public-ask-distributed-admission-2026-08-14/report.json", detail: "JSON and SSE provider modes fail closed without distributed admission" },
      { id: "public_search_distributed_admission", state: "proven", evidencePath: "evaluation/public-search-distributed-admission-2026-08-14/report.json", detail: "legal, safety-reference, and weather provider work fails closed without distributed admission" },
      { id: "learning_export_renderer_security", state: "proven", evidencePath: "evaluation/learning-export-renderer-security-2026-08-02/report.json", detail: "renderer-independent inert learning export source contract" },
      { id: "hermes_remote_durable_ledger", state: "proven", evidencePath: "evaluation/hermes-openclaw-runtime-current-gate-2026-07-20/report.json", detail: "durable ledger wired without authenticated execution claim" },
      { id: "live_document_secondary_grounding", state: "proven", evidencePath: "evaluation/live-document-secondary-grounding-2026-07-25/report.json", detail: "all 30 supporting documents passed scenario grounding" },
      { id: "live_document_seed_profile_isolation", state: "proven", evidencePath: "evaluation/live-document-seed-profile-isolation-2026-07-25/report.json", detail: "all 60 documents passed seed-profile isolation" },
      { id: "security_atomic_db_race_remediation", state: "approval_gated", evidencePath: "evaluation/security-atomic-db-race-approval-boundary-2026-08-14/report.json", detail: "two sealed findings require transactional DB approval" },
      { id: "live_documents_share_route_perception", state: "proven", evidencePath: "evaluation/live-documents-share-route-perception-2026-08-14/report.json", detail: "fresh scoped live route geometry with exact saved Share gap" },
      { id: "deployment_freshness_guard", state: "proven", evidencePath: "evaluation/deployment-freshness-guard-2026-08-14/report.json", detail: "live stale-tab refresh guard with exact saved Share gap" },
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
  writeJson(root, "evaluation/final-99-12-document-no-mutation-2026-08-17/report.json", {
    schema: "safeclaw-final-99-12-document-no-mutation/v1",
    verdict: "PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_12_DOCUMENT_NO_MUTATION_LIVE_HORIZONTAL_ADMISSION_BLOCKED",
    currentSourceCommit: "TO_FILL",
    productionCommit: "TO_FILL",
    currentSourceLocal: {
      canonicalDocumentsPassed: 12,
      corePdfsPassed: 4,
      orchestrationDownloadCount: 14,
      askVerdict: "pass",
      requestedAiMode: "template",
    },
    liveAfterDeployment: {
      sourceCommit: "TO_FILL",
      productionCommit: "TO_FILL",
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
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
    before: {
      nearDuplicateLineOveruseCount: 100,
      nearCategories: { "human-review-required": 54, "document-role-prefix-variant": 46 },
    },
    afterLive: {
      sourceHead: "TO_FILL",
      productionCommit: "TO_FILL",
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
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
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
    verdict: "PASS_LIVE_PRODUCTION_LAUNCH_OPERATIONS_CONFIGURATION_TRUTH",
    sourceHead: "TO_FILL",
    productCommit: "TO_FILL",
    productionBuild: { commitSha: "TO_FILL", environment: "production" },
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
  writeJson(root, "evaluation/document-export-capability-truth-2026-08-17/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_EXPORT_CAPABILITY_TRUTH",
    sourceHead: "TO_FILL",
    productCommit: "TO_FILL",
    productionCommit: "TO_FILL",
    capability: { admission: { configurationState: "absent", mode: "unavailable", ready: false, reason: "distributed_limiter_unavailable" } },
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
    sourceHead: "TO_FILL",
    productCommit: "TO_FILL",
    productionCommit: "TO_FILL",
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
    sourceHead: "TO_FILL", productCommit: "TO_FILL", productionCommit: "TO_FILL",
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
    sourceHead: "TO_FILL", productCommit: "TO_FILL", productionCommit: "TO_FILL",
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
    productCommit: "TO_FILL",
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
    liveAfterDeploymentRequired: false,
    evidenceVisibilityBeforeLive: { verdict: "RED_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX", sourceHead: "TO_FILL", productionCommit: "TO_FILL", passedCount: 0, failedCount: 5, reviewerEvidenceTraceCount: 0, technicalGuidanceBoundaryCount: 0, lawCandidateBoundaryCount: 0 },
    evidenceVisibilityAfterLocal: { verdict: "PASS_CURRENT_SOURCE_LOCAL_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX", sourceHead: "TO_FILL", generationMode: "deterministic", passedCount: 5, failedCount: 0, reviewerEvidenceTraceCount: 5, technicalGuidanceBoundaryCount: 5, lawCandidateBoundaryCount: 5 },
    evidenceVisibilityAfterLive: { verdict: "PASS_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX", sourceHead: "TO_FILL", productionCommit: "TO_FILL", generationMode: "deterministic", passedCount: 5, failedCount: 0, reviewerEvidenceTraceCount: 5, technicalGuidanceBoundaryCount: 5, lawCandidateBoundaryCount: 5 },
    eventSemanticBeforeLive: { verdict: "RED_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX", sourceHead: "TO_FILL", productionCommit: "TO_FILL", passedCount: 0, failedCount: 5, eventSemanticGroundingCount: 0, privateEventExposureCount: 0 },
    eventSemanticAfterLocal: { verdict: "PASS_CURRENT_SOURCE_LOCAL_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX", sourceHead: "TO_FILL", passedCount: 5, failedCount: 0, eventSemanticGroundingCount: 5, privateEventExposureCount: 0 },
    eventSemanticAfterLive: { verdict: "PASS_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX", sourceHead: "TO_FILL", productionCommit: "TO_FILL", passedCount: 5, failedCount: 0, eventSemanticGroundingCount: 5, privateEventExposureCount: 0 },
    afterLiveProvider: {
      verdict: "RED_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_MATRIX",
      sourceHead: "TO_FILL",
      productionCommit: "TO_FILL",
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
    productCommit: "TO_FILL", sourceHead: "TO_FILL", productionCommit: "TO_FILL", liveAfterDeploymentRequired: false,
    afterLocal: { verdict: "PASS_CURRENT_SOURCE_LOCAL_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX", passedCount: 5, failedCount: 0, sifEvidenceBoundaryCount: 5, technicalGuidanceBoundaryCount: 5, lawCandidateBoundaryCount: 5, privateEventExposureCount: 0 },
    afterLive: { verdict: "PASS_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX", sourceHead: "TO_FILL", productionCommit: "TO_FILL", passedCount: 5, failedCount: 0, sifEvidenceBoundaryCount: 5, technicalGuidanceBoundaryCount: 5, lawCandidateBoundaryCount: 5, eventSemanticGroundingCount: 5, privateEventExposureCount: 0 },
    contentContract: { authorityOrder: ["sif", "kosha", "law"], scenarioCount: 5, reviewerVisibleSifEvidenceRequired: true, sifProvenanceRequired: true, sifIncidentControlEvidenceIsNonStatutory: true, koshaTechnicalGuidanceIsNonStatutory: true, statutoryClaimsRequireLawProvenance: true, privateSifTitleExposureAllowed: false, humanReviewCompleted: false, publicationState: "unpublished", publishAllowed: false },
    mutationBoundary: { dbMutationPerformed: false, providerDispatchCalled: false, shareSessionCreated: false, ontologyPublicationPerformed: false, vectorOrEmbeddingMutationPerformed: false, koshaRegistryMutationPerformed: false },
    remainingBoundaries: { actualProductionCandidateQueueRead: false, enhancedLlmRuntime: "BLOCKED_DISTRIBUTED_RATE_LIMIT_CONFIGURATION", exactSavedShareVerdict: "MISSING_EVIDENCE", llmWikiPublication: "APPROVAL_GATED", supabaseRlsLaunchIsolation: "APPROVAL_GATED" },
  });
  writeJson(root, "evaluation/follow-up-full-repository-security-scan-2026-08-02/report.json", {
    verdict: "COMPLETED_FOLLOWUP_REPOSITORY_SECURITY_SCAN_OPEN_FINDINGS_AND_DEFERRED_REVIEW",
    sourceHead: "TO_FILL",
    productionBuild: {
      commitSha: "TO_FILL",
    },
    scan: {
      completeness: "partial",
      fileCount: 5241,
      reportableFindingCount: 17,
      deferredCandidateCount: 1,
      severity: {
        medium: 5,
        low: 12,
      },
    },
    remainingBoundaries: {
      securityCompleteClaimAllowed: false,
      distributedRateLimitResidual: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/public-search-distributed-rate-limit-readiness-2026-08-02/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_SEARCH_DISTRIBUTED_CONFIGURATION_TRUTH",
    sourceHead: "TO_FILL",
    productionBuild: { commitSha: "TO_FILL", sourceHeadMatchesProduction: true },
    configuration: {
      productionModeVerified: true,
      configurationState: "absent",
      readinessMode: "unavailable",
      observedResponseMode: "distributed",
      distributedActivationPending: true,
    },
    boundary: {
      sealedFindingsClosedWithoutRescan: false,
      productionFailClosedObserved: true,
      databaseFindingsRemainApprovalGated: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/learning-export-renderer-security-2026-08-02/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_RENDERER_INERT_LEARNING_EXPORT_SOURCE_CONTRACT",
    sourceHead: "TO_FILL",
    productionBuild: { commitSha: "TO_FILL" },
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
    sourceHead: "TO_FILL",
    productionBuild: { commitSha: "TO_FILL", sourceHeadIsAncestorOfProduction: true },
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
      productCommit: "TO_FILL",
      evidenceHead: "TO_FILL",
      productionMarkerAtValidation: "TO_FILL",
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
      productCommit: "TO_FILL",
      evidenceHead: "TO_FILL",
      productionMarkerAtValidation: "TO_FILL",
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
    sourceHead: "TO_FILL",
    productCommit: "TO_FILL",
    productionBuild: { commitSha: "TO_FILL", productCommitIsAncestorOfProduction: true },
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
    sourceHead: "TO_FILL",
    productCommit: "TO_FILL",
    productionCommit: "TO_FILL",
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
  writeJson(root, "evaluation/security-public-generation-admission-2026-08-04/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_GENERATION_DISTRIBUTED_CONFIGURATION_TRUTH",
    productCommit: "TO_FILL",
    productionCommit: "TO_FILL",
    runtimeBoundary: {
      liveDeploymentVerified: true,
      configurationState: "absent",
      readinessMode: "unavailable",
      observedResponseMode: "distributed",
      productionFailClosedObserved: true,
      distributedProductionActivationPending: true,
    },
    verification: { npmAudit: { verdict: "PASS", vulnerabilityCount: 0 } },
    remainingBoundaries: {
      freshPostChangeSecurityRescanRequired: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/codex-security-followup-remediation-2026-08-11/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_DEPLOYED_SECURITY_FOLLOWUP",
    sourceHead: "TO_FILL",
    securityScan: { sealedFindingCount: 3, immutableOriginalBaselineFindingCount: 18, deferredCandidateCount: 2 },
    verification: { focusedVitest: { tests: 129 } },
    deployment: { productionCommit: "TO_FILL", liveProviderCancellationProbeExecuted: false },
    remainingSecurityWork: [],
    boundaries: { originalBaselineRewritten: false, exactSavedShareVerdict: "MISSING_EVIDENCE" },
  });
  writeJson(root, "evaluation/security-resource-remediation-2026-08-11/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_SECURITY_RESOURCE_REMEDIATION",
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
    sourceScan: { findingCount: 20 },
    remediatedFindings: [{}, {}, {}, {}, {}, {}],
    remainingBoundaries: {
      remainingScanFindings: 14,
      providerDispatchPersistence: "APPROVAL_GATED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/security-upstream-transport-remediation-2026-08-11/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_SOURCE_PROVEN_UPSTREAM_TRANSPORT_SECURITY_NO_PROVIDER_PROBE",
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
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
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
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
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
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
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
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
    sourceHead: "TO_FILL",
    securityFinding: { findingId: "csf_278e8efc9722eb80016c42a3" },
    verification: { focusedAndAdjacentVitest: { tests: 104 } },
    productionBuild: { commitSha: "TO_FILL", liveProviderCallExecuted: false },
    remainingBoundaries: {
      followUpSecurityScan: "REQUIRED",
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/public-provider-admission-2026-08-11/report.json", {
    verdict: "PARTIAL_LIVE_PRODUCTION_WEIGHTED_INSTANCE_ADMISSION_DISTRIBUTED_ACTIVATION_PENDING",
    sourceHead: "TO_FILL",
    securityFindings: [{}, {}],
    contracts: { publicAskProviderAdmission: { capacity: 12, modeWeights: { full: 12 } } },
    productionBuild: { commitSha: "TO_FILL" },
    liveChecks: [{}, {}, {}],
    remainingBoundaries: {
      distributedProductionActivation: "PENDING_CONFIGURATION",
      followUpSecurityScan: "REQUIRED",
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
    sourceHead: "TO_FILL",
    productionBuild: { commitSha: "TO_FILL" },
    findingDisposition: {
      total: 23,
      deployedSourceRemediationCount: 17,
      unresolvedCount: 6,
      approvalGatedCount: 3,
      distributedRuntimeOpenCount: 3,
    },
    remainingBoundaries: { securityCompleteClaimAllowed: false, exactSavedShareVerdict: "MISSING_EVIDENCE" },
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
  writeJson(root, "evaluation/current-full-repository-security-scan-2026-08-27/report.json", {
    verdict: "NOTICE_CURRENT_HEAD_STANDARD_SCAN_19_FINDINGS_PARTIAL_COVERAGE_REMEDIATION_REQUIRED",
    scanId: "da97e400-1f4d-40b9-a434-ab5ab013fdb3",
    scanRevision: "4e3e7e5d9ebad7e91f428a856019122431410be4",
    productCommit: "4e3e7e5d9ebad7e91f428a856019122431410be4",
    productionCommit: "TO_FILL",
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
    currentSourceRemediation: {
      sourceHead: "f95773c2f4b55fe0ba8b199b5218800067e09bdf",
      approvalFreeRemediatedCount: 6,
      approvalSensitiveShareCapabilityCount: 1,
      freshFullRepositoryRescanRequired: true,
      liveAfterDeployment: {
        productionCommit: "607c39b3204fd4e1732890bcc6dbad30e4815ea2",
        sourceRemediationIncluded: true,
      },
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      databaseSecurityRemediation: "APPROVAL_GATED",
      approvalFreeProductSourceRemediation: "LIVE_SOURCE_INCLUDED_FRESH_RESCAN_REQUIRED",
      coverageCompleteness: "partial",
      deferredCoverageItemCount: 26,
      securityCompleteClaimAllowed: false,
    },
  });
  writeJson(root, "evaluation/current-source-standard-security-scan-2026-08-28-complete/report.json", freshCurrentSourceSecurityScanFixture());
  writeJson(root, "evaluation/share-ack-prebody-admission-2026-08-28/report.json", shareAckPreBodyAdmissionFixture());
  writeJson(root, "evaluation/safety-status-disconnect-lease-2026-08-28/report.json", safetyStatusDisconnectLeaseFixture());
  writeJson(root, "evaluation/weather-fallback-error-redaction-2026-08-28/report.json", weatherFallbackErrorRedactionFixture());
  writeJson(root, "evaluation/hwpx-archive-expansion-security-2026-08-28/report.json", hwpxArchiveExpansionSecurityFixture());
  writeJson(root, "evaluation/security-mcp-generation-work-budget-2026-08-04/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_SOURCE_INCLUDED_MCP_GENERATION_WORK_BUDGET_AUTHENTICATED_RUNTIME_PROBE_AND_RESCAN_PENDING",
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
    sourceHeadMatchesProduction: true,
    currentSourceContract: { postBodyMaxBytes: 98304 },
    verification: { adjacentMcp: { tests: 77 } },
    currentLiveRefresh: {
      probe: {
        status: 503,
        rateLimitHeader: "distributed",
        errorCode: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      },
      configurationReadiness: {
        configurationState: "absent",
        reason: "distributed_limiter_unavailable",
      },
    },
    remainingBoundaries: {
      validAuthenticatedRuntimeProbeRequired: true,
      distributedProductionActivationRequired: true,
      distributedProductionHealthRequired: false,
      freshSecurityRescanRequired: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/security-mcp-provider-admission-2026-08-14/report.json", {
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_DURABLE_MCP_PROVIDER_ADMISSION_RESCAN_PENDING",
    sourceHead: "TO_FILL",
    productionBuild: { commitSha: "TO_FILL" },
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
      freshFullRepositorySecurityScanRequiredForCanonicalClosure: true,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/hermes-knowledge-review-evidence-inspector-2026-08-14/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR",
    sourceHead: "TO_FILL",
    productCommit: "TO_FILL",
    productionCommit: "TO_FILL",
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
  writeJson(root, "evaluation/hermes-knowledge-review-event-facts-2026-08-26/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVENT_FACT_TRACEABILITY",
    sourceHead: "TO_FILL",
    productCommit: "TO_FILL",
    productionCommit: "TO_FILL",
    beforeLive: { verdict: "RED_HERMES_REVIEW_EVENT_FACTS", viewportCount: 8, passedCount: 0, failedCount: 8, visibleFactCount: 0, boundFactCount: 0 },
    local: { verdict: "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_EVENT_FACTS", viewportCount: 8, passedCount: 8, failedCount: 0 },
    afterLive: { verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVENT_FACTS", viewportCount: 8, passedCount: 8, failedCount: 0, productionAligned: true, browserErrorCount: 0 },
    eventFactsContract: { boundFactCount: 2, orphanFactCount: 0, privateEventTextExposed: false, humanReviewCompleted: false },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
    },
  });
  writeJson(root, "evaluation/hermes-review-decision-first-viewport-2026-08-27/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_DECISION_FIRST_VIEWPORT",
    sourceHead: "TO_FILL",
    productCommit: "TO_FILL",
    productionCommit: "TO_FILL",
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
    sourceHead: "TO_FILL",
    productCommit: "TO_FILL",
    productionCommit: "TO_FILL",
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
  writeJson(root, "evaluation/hermes-knowledge-review-trace-blocks-2026-08-26/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_BLOCKS",
    sourceHead: "TO_FILL",
    productCommit: "TO_FILL",
    productionCommit: "TO_FILL",
    beforeLive: { verdict: "RED_HERMES_REVIEW_TRACE_BLOCKS", viewportCount: 8, passedCount: 0, failedCount: 8, panelCount: 0, resolvedTraceCount: 0 },
    local: { verdict: "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_TRACE_BLOCKS", viewportCount: 8, passedCount: 8, failedCount: 0 },
    afterLive: { verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_BLOCKS", viewportCount: 8, passedCount: 8, failedCount: 0, productionAligned: true, browserErrorCount: 0 },
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
    sourceHead: "TO_FILL",
    productCommit: "TO_FILL",
    productionCommit: "TO_FILL",
    beforeLive: { verdict: "RED_HERMES_REVIEW_TRACE_MATRIX", viewportCount: 8, passedCount: 0, failedCount: 8 },
    local: { verdict: "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_TRACE_MATRIX", viewportCount: 8, passedCount: 8, failedCount: 0 },
    afterLive: { verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_MATRIX", viewportCount: 8, passedCount: 8, failedCount: 0 },
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
  writeJson(root, "evaluation/public-ask-distributed-admission-2026-08-14/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_ASK_PROVIDER_MODES_FAIL_CLOSED_WITHOUT_DISTRIBUTED_ADMISSION",
    sourceHead: "TO_FILL",
    productCommit: "TO_FILL",
    productionCommit: "TO_FILL",
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
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
    securityFinding: { findingId: "csf_bb897a39277591f4fbab0ca7" },
    liveProductionProbe: { providerCallExecutedForEvidence: false, cases: [{}, {}, {}] },
    remainingBoundaries: {
      distributedBackendActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      freshFollowUpScan: "REQUIRED",
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/share-recipient-contact-verification-2026-08-14/report.json", {
    verdict: "PASS_LIVE_DEPLOYED_SOURCE_SHARE_RECIPIENT_CONTACT_VERIFICATION_RESCAN_PENDING",
    sourceHead: "TO_FILL",
    productionCommit: "TO_FILL",
    productionBuild: { branch: "master", environment: "production" },
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
    sourceHead: "TO_FILL",
    sealedScan: {
      scanId: "bd135da7-c309-4e8d-ace5-15222dd3f1c7",
      immutableFindingsPreserved: true,
    },
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
    sourceHead: "TO_FILL",
    productionBuild: { commitSha: "TO_FILL" },
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
    sourceHead: "TO_FILL",
    productionBuild: { commitSha: "TO_FILL" },
    verification: {
      liveBrowser: {
        normalCurrentDeployment: { noticePresent: false },
        simulatedShaDrift: { refreshButtonVisible: true },
      },
      canonicalFrontendStaticAudit: { violationCount: 0 },
    },
    remainingBoundaries: {
      liveAfterDeploymentPending: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
    mutationBoundary: { dbMutationPerformed: false },
  });
  writeJson(root, "evaluation/document-authoring-pane-margin-2026-08-02/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_ACTION_PANE_MARGIN",
    productCommit: "TO_FILL",
    productionCommit: "TO_FILL",
    sourceHeadMatchesProduction: true,
    beforeLive: { paneMarginBelow16Count: 44 },
    afterLive: { paneMarginBelow16Count: 0, minimumPaneMargin: 16, maximumShellRatio: 2.36 },
    remainingBoundaries: { exactSavedShareVerdict: "MISSING_EVIDENCE" },
  });
  writeJson(root, "evaluation/dispatch-first-viewport-containment-2026-08-27/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_STANDALONE_DISPATCH_FIRST_VIEWPORT_CONTAINMENT",
    sourceHead: "TO_FILL",
    productCommit: "TO_FILL",
    productionCommit: "TO_FILL",
    beforeLive: { desktopShort: { rootScrollDebt: 232 } },
    afterLive: {
      desktopShort: { day: { rootScrollDebt: 1, channelActionBottom: 706, previewBottom: 639 } },
      mobileShort: { day: { primaryBottom: 581 }, night: { primaryBottom: 581 } },
    },
    remainingBoundaries: { exactSavedShareVerdict: "MISSING_EVIDENCE" },
  });
  writeJson(root, "evaluation/hermes-openclaw-runtime-current-gate-2026-07-20/report.json", {
    verdict: "adapter_boundary_pass_live_execution_not_claimed",
    sourceShaForFocusedTests: "TO_FILL",
    productionBuildInfoAtLiveSmoke: { commitSha: "TO_FILL" },
    focusedTests: { status: "pass", testFilesPassed: 15, testsPassed: 333 },
    sourceContract: {
      durableAttemptLedgerWired: true,
      ledgerAtomicReservation: true,
      ledgerTerminalRequiresReservation: true,
      ledgerStoresTerminalDigestOnly: true,
    },
    liveExecutionReadiness: { claimed: false },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      authenticatedHermesCanary: "APPROVAL_GATED",
    },
  });

  const firstCommit = commitAll(root, "seed fixtures");
  const replaceToken = (relativePath: string, commit = firstCommit): void => {
    const absolutePath = path.join(root, relativePath);
    const next = fs.readFileSync(absolutePath, "utf8").replaceAll("TO_FILL", commit);
    fs.writeFileSync(absolutePath, next, "utf8");
  };
  [
    "evaluation/final-99-gate-current-2026-07-22/report.json",
    "evaluation/final-99-12-document-no-mutation-2026-08-17/report.json",
    "evaluation/live-harness-quality-probe-current-2026-07-20/report.json",
    "evaluation/live-document-quality-matrix-2026-07-24/report.json",
    "evaluation/live-document-quality-stress-matrix-2026-07-24/report.json",
    "evaluation/live-document-field-isolation-2026-07-25/report.json",
    "evaluation/live-kosha-exact-materialization-2026-07-25/report.json",
    "evaluation/live-document-wording-review-2026-07-24/report.json",
    "evaluation/live-document-broad-review-2026-07-25/report.json",
    "evaluation/live-document-editorial-review-2026-07-25/report.json",
    "evaluation/document-editorial-review-cockpit-2026-08-16/report.json",
    "evaluation/document-editorial-review-receipt-2026-08-17/report.json",
    "evaluation/live-document-editorial-duplicate-classification-2026-07-25/report.json",
    "evaluation/live-document-editorial-near-classification-2026-07-25/report.json",
    "evaluation/product-capability-truth-2026-07-25/report.json",
    "evaluation/launch-operations-readiness-2026-08-26/report.json",
    "evaluation/document-export-capability-truth-2026-08-17/report.json",
    "evaluation/ontology-viewport-workbench-2026-08-17/report.json",
    "evaluation/knowledge-viewport-workbench-2026-08-17/report.json",
    "evaluation/llm-wiki-candidate-readiness-2026-08-25/report.json",
    "evaluation/llm-wiki-candidate-content-matrix-2026-08-25/report.json",
    "evaluation/llm-wiki-sif-evidence-matrix-2026-08-26/report.json",
    "evaluation/tenant-authorization-boundary-preflight-2026-07-29/report.json",
    "evaluation/spreadsheet-formula-neutralization-2026-08-01/report.json",
    "evaluation/public-provider-work-budget-2026-08-01/report.json",
    "evaluation/document-export-work-budget-2026-08-01/report.json",
    "evaluation/follow-up-full-repository-security-scan-2026-08-02/report.json",
    "evaluation/public-search-distributed-rate-limit-readiness-2026-08-02/report.json",
    "evaluation/security-public-generation-admission-2026-08-04/report.json",
    "evaluation/codex-security-followup-remediation-2026-08-11/report.json",
    "evaluation/security-resource-remediation-2026-08-11/report.json",
    "evaluation/security-upstream-transport-remediation-2026-08-11/report.json",
    "evaluation/security-safety-reference-surface-remediation-2026-08-11/report.json",
    "evaluation/security-current-remediation-ledger-2026-08-13/report.json",
    "evaluation/current-full-repository-security-scan-2026-08-27/report.json",
    "evaluation/current-source-standard-security-scan-2026-08-28-complete/report.json",
    "evaluation/share-ack-prebody-admission-2026-08-28/report.json",
    "evaluation/safety-status-disconnect-lease-2026-08-28/report.json",
    "evaluation/weather-fallback-error-redaction-2026-08-28/report.json",
    "evaluation/hwpx-archive-expansion-security-2026-08-28/report.json",
    "evaluation/public-json-request-body-budget-2026-08-11/report.json",
    "evaluation/improvement-photo-analysis-budget-2026-08-11/report.json",
    "evaluation/public-provider-cancellation-2026-08-11/report.json",
    "evaluation/public-provider-admission-2026-08-11/report.json",
    "evaluation/public-ask-distributed-admission-2026-08-14/report.json",
    "evaluation/public-search-distributed-admission-2026-08-14/report.json",
    "evaluation/security-mcp-generation-work-budget-2026-08-04/report.json",
    "evaluation/security-mcp-provider-admission-2026-08-14/report.json",
    "evaluation/share-recipient-contact-verification-2026-08-14/report.json",
    "evaluation/security-atomic-db-race-approval-boundary-2026-08-14/report.json",
    "evaluation/live-documents-share-route-perception-2026-08-14/report.json",
    "evaluation/deployment-freshness-guard-2026-08-14/report.json",
    "evaluation/learning-export-renderer-security-2026-08-02/report.json",
    "evaluation/hermes-knowledge-review-selected-workbench-2026-08-14/report.json",
    "evaluation/hermes-review-decision-first-viewport-2026-08-27/report.json",
    "evaluation/hermes-review-candidate-position-2026-08-27/report.json",
    "evaluation/hermes-knowledge-review-evidence-inspector-2026-08-14/report.json",
    "evaluation/hermes-knowledge-review-event-facts-2026-08-26/report.json",
    "evaluation/hermes-knowledge-review-trace-blocks-2026-08-26/report.json",
    "evaluation/hermes-knowledge-review-trace-matrix-2026-08-26/report.json",
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
    "evaluation/document-authoring-pane-margin-2026-08-02/report.json",
    "evaluation/dispatch-first-viewport-containment-2026-08-27/report.json",
    "evaluation/hermes-openclaw-runtime-current-gate-2026-07-20/report.json",
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
    expect(report.documentAuthoringPaneMargin).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_ACTION_PANE_MARGIN",
      sourceHeadMatchesProduction: true,
      beforeBelowMargin: 44,
      liveBelowMargin: 0,
      liveMinimumMargin: 16,
      liveMaximumShellRatio: 2.36,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.evidence.find((item) => item.id === "document_authoring_pane_margin")?.productionStatus).toBe("ancestor_of_head");
    expect(report.dispatchStandaloneCockpit).toMatchObject({
      firstViewportContainmentVerdict: "PASS_LIVE_PRODUCTION_STANDALONE_DISPATCH_FIRST_VIEWPORT_CONTAINMENT",
      beforeDesktopShort: { rootScrollDebt: 232 },
      liveDesktopShort: { rootScrollDebt: 1, channelActionBottom: 706, previewBottom: 639 },
      liveMobileShortDay: { primaryBottom: 581 },
      liveMobileShortNight: { primaryBottom: 581 },
      containmentExactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.evidence.find((item) => item.id === "dispatch_first_viewport_containment")?.productionStatus).toBe("ancestor_of_head");
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
    expect(report.hermesOpenclawRuntime).toMatchObject({
      verdict: "adapter_boundary_pass_live_execution_not_claimed",
      testFilesPassed: 15,
      testsPassed: 333,
      durableAttemptLedgerWired: true,
      ledgerAtomicReservation: true,
      ledgerTerminalRequiresReservation: true,
      ledgerStoresTerminalDigestOnly: true,
      liveExecutionClaimed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      authenticatedHermesCanary: "APPROVAL_GATED",
    });
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
    expect(report.evidence.find((item) => item.id === "live_document_editorial_near_classification")?.productionStatus).toBe("ancestor_of_head");
    expect(report.evidence.find((item) => item.id === "live_document_editorial_review")?.productionStatus).toBe("ancestor_of_head");
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
    expect(report.evidence.find((item) => item.id === "product_capability_truth")?.productionStatus).toBe("ancestor_of_head");
    expect(report.launchOperationsReadiness).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_LAUNCH_OPERATIONS_CONFIGURATION_TRUTH",
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
    expect(report.evidence.find((item) => item.id === "launch_operations_readiness_cockpit")?.productionStatus).toBe("ancestor_of_head");
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
    expect(report.evidence.find((item) => item.id === "document_export_capability_truth")?.productionStatus).toBe("ancestor_of_head");
    expect(report.ontologyViewportWorkbench).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_ONTOLOGY_VIEWPORT_WORKBENCH",
      rowCount: 10,
      passCount: 10,
      maxBodyRatio: 1,
      mobileTaskSwitchVerifiedCount: 4,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      fullyAutomatedLaunchClaimAllowed: false,
    });
    expect(report.evidence.find((item) => item.id === "ontology_viewport_workbench")?.productionStatus).toBe("ancestor_of_head");
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
    expect(report.evidence.find((item) => item.id === "knowledge_viewport_workbench")?.productionStatus).toBe("ancestor_of_head");
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
      dbMutationPerformed: false,
      wikiPublicationPerformed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
    });
    expect(report.evidence.find((item) => item.id === "llm_wiki_candidate_content_readiness")?.productionStatus).toBe("ancestor_of_head");
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
    expect(report.evidence.find((item) => item.id === "llm_wiki_candidate_content_matrix")?.productionStatus).toBe("ancestor_of_head");
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
    expect(report.evidence.find((item) => item.id === "llm_wiki_sif_evidence_matrix")?.productionStatus).toBe("ancestor_of_head");
    expect(report.tenantAuthorizationRemediation).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_TENANT_AUTHORIZATION_REMEDIATED_NO_MUTATION",
      greenFindings: 2,
      remainingBeforeFullRescan: 16,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.evidence.find((item) => item.id === "tenant_authorization_remediation")?.productionStatus).toBe("ancestor_of_head");
    expect(report.spreadsheetFormulaNeutralization).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_SPREADSHEET_FORMULA_NEUTRALIZATION",
      remediatedFindings: 4,
      cumulativeRemediatedFindings: 6,
      remainingBeforeFullRescan: 12,
      fullRepositoryRescanCompleted: false,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.evidence.find((item) => item.id === "spreadsheet_formula_neutralization")?.productionStatus).toBe("ancestor_of_head");
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
    expect(report.evidence.find((item) => item.id === "public_provider_work_budget")?.productionStatus).toBe("ancestor_of_head");
    expect(report.documentExportWorkBudget).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_EXPORT_WORK_BUDGETS",
      remediatedFindings: 8,
      cumulativeRemediatedFindings: 18,
      remainingBeforeFullRescan: 0,
      fullRepositoryRescanCompleted: false,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.evidence.find((item) => item.id === "document_export_work_budget")?.productionStatus).toBe("ancestor_of_head");
    expect(report.fullRepositorySecurityScan).toMatchObject({
      verdict: "COMPLETED_FOLLOWUP_REPOSITORY_SECURITY_SCAN_OPEN_FINDINGS_AND_DEFERRED_REVIEW",
      completeness: "partial",
      fileCount: 5241,
      reportableFindingCount: 17,
      deferredCandidateCount: 1,
      medium: 5,
      low: 12,
      securityCompleteClaimAllowed: false,
      distributedRateLimitResidual: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.evidence.find((item) => item.id === "full_repository_security_scan")?.productionStatus).toBe("ancestor_of_head");
    expect(report.publicSearchDistributedRateLimitReadiness).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_PUBLIC_SEARCH_DISTRIBUTED_CONFIGURATION_TRUTH",
      productionModeVerified: true,
      configurationState: "absent",
      readinessMode: "unavailable",
      observedResponseMode: "distributed",
      distributedActivationPending: true,
      sealedFindingsClosedWithoutRescan: false,
      productionFailClosedObserved: true,
      databaseFindingsRemainApprovalGated: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.publicGenerationAdmissionSecurity).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_PUBLIC_GENERATION_DISTRIBUTED_CONFIGURATION_TRUTH",
      configurationState: "absent",
      readinessMode: "unavailable",
      observedResponseMode: "distributed",
      productionFailClosedObserved: true,
      distributedActivationPending: true,
      freshRescanRequired: true,
      vulnerabilityCount: 0,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
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
    expect(report.securityResourceRemediation).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_SECURITY_RESOURCE_REMEDIATION",
      scanFindingCount: 20,
      remediatedFindingCount: 6,
      remainingScanFindings: 14,
      providerDispatchPersistence: "APPROVAL_GATED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.evidence.find((item) => item.id === "security_resource_remediation")).toBeDefined();
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
    expect(report.evidence.find((item) => item.id === "security_upstream_transport_remediation")).toBeDefined();
    expect(report.evidence.find((item) => item.id === "security_safety_reference_surface_remediation")).toBeDefined();
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
    expect(report.evidence.find((item) => item.id === "current_security_remediation_ledger")).toBeDefined();
    expect(report.evidence.find((item) => item.id === "current_repository_security_rescan")).toMatchObject({
      artifact: path.join("evaluation", "current-full-repository-security-scan-2026-08-27", "report.json"),
      productionStatus: "ancestor_of_head",
    });
    expect(report.currentRepositorySecurityRescan).toMatchObject({
      verdict: "NOTICE_CURRENT_HEAD_STANDARD_SCAN_19_FINDINGS_PARTIAL_COVERAGE_REMEDIATION_REQUIRED",
      scanId: "da97e400-1f4d-40b9-a434-ab5ab013fdb3",
      scanRevision: "4e3e7e5d9ebad7e91f428a856019122431410be4",
      productCommit: "4e3e7e5d9ebad7e91f428a856019122431410be4",
      productionCommit: expect.stringMatching(/^[0-9a-f]{40}$/u),
      originalBaselineFindingCount: 18,
      reportableFindingCount: 19,
      mediumFindingCount: 14,
      lowFindingCount: 5,
      coverageCompleteness: "partial",
      reviewedSurfaceCount: 9,
      deferredCoverageItemCount: 26,
      approvalFreeProductSourceCandidateCount: 7,
      approvalFreeRemediatedCount: 0,
      currentSourceRemediatedCount: 6,
      currentSourceRemediationHead: "f95773c2f4b55fe0ba8b199b5218800067e09bdf",
      approvalSensitiveShareCapabilityCount: 1,
      freshFullRepositoryRescanRequired: true,
      currentSourceLiveProductionCommit: "607c39b3204fd4e1732890bcc6dbad30e4815ea2",
      currentSourceLiveIncluded: true,
      databaseApprovalGatedRemainingCount: 12,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      databaseSecurityRemediation: "APPROVAL_GATED",
      approvalFreeProductSourceRemediation: "LIVE_SOURCE_INCLUDED_FRESH_RESCAN_REQUIRED",
    });
    expect(report.evidence.find((item) => item.id === "fresh_current_source_security_scan")).toMatchObject({
      artifact: path.join("evaluation", "current-source-standard-security-scan-2026-08-28-complete", "report.json"),
    });
    expect(report.freshCurrentSourceSecurityScan).toMatchObject({
      verdict: "NOTICE_FRESH_CURRENT_SOURCE_STANDARD_SCAN_17_OPEN_FINDINGS_PARTIAL_COVERAGE_RECOVERED_DRAFT_HISTORY",
      scanId: "3358978a-75d1-454a-9dcd-4b63b52b9768",
      sourceHead: expect.stringMatching(/^[0-9a-f]{40}$/u),
      deployedProductSource: "ab30f5c5269430a558fcd8ef5c6331fb3c952a4e",
      reportableFindingCount: 17,
      mediumFindingCount: 2,
      lowFindingCount: 15,
      coverageCompleteness: "partial",
      reviewedSurfaceCount: 12,
      deferredCoverageItemCount: 66,
      approvalGatedDatabaseOrAtomicityCount: 14,
      approvalSensitiveShareCapabilityCount: 0,
      approvalFreeProductSourceResidualCount: 3,
      fullyClosedBoundedSourceCandidateCount: 0,
      freshFullRepositoryScanCompleted: true,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.evidence.find((item) => item.id === "share_ack_prebody_admission_security")).toMatchObject({
      artifact: path.join("evaluation", "share-ack-prebody-admission-2026-08-28", "report.json"),
    });
    expect(report.shareAckPreBodyAdmission).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_SHARE_ACK_PREBODY_ADMISSION_SOURCE_REMEDIATED",
      sourceHead: expect.stringMatching(/^[0-9a-f]{40}$/u),
      productionCommit: expect.stringMatching(/^[0-9a-f]{40}$/u),
      scanId: "1411fb32-5c18-4d6a-b8ba-d52697757d8a",
      findingSlug: "share-ack-prebody-admission",
      coarseIpRateAdmissionBeforeBody: true,
      coarseBodyConcurrencyLeaseBeforeBody: true,
      recipientSpecificAdmissionRetainedAfterParse: true,
      testsPassed: 66,
      liveStatus: 503,
      liveCode: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      liveRateLimitHeader: "distributed",
      freshRescanRequired: true,
      securityCompleteClaimAllowed: false,
      recipientAckLiveDataApproval: "APPROVAL_GATED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.evidence.find((item) => item.id === "safety_status_disconnect_lease_security")).toMatchObject({
      artifact: path.join("evaluation", "safety-status-disconnect-lease-2026-08-28", "report.json"),
    });
    expect(report.safetyStatusDisconnectLease).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_SAFETY_STATUS_DISCONNECT_LEASE_SOURCE_REMEDIATED",
      sourceHead: expect.stringMatching(/^[0-9a-f]{40}$/u),
      productionCommit: expect.stringMatching(/^[0-9a-f]{40}$/u),
      scanId: "1411fb32-5c18-4d6a-b8ba-d52697757d8a",
      findingId: "csf_b08a96f6b1ba27a33af52a6a",
      findingSlug: "status-disconnect-residual",
      underlyingWorkSettlementPrecedesAbortRejection: true,
      admissionLeaseHeldUntilUnderlyingSettlement: true,
      thirdConcurrentRequestRejectedWhileTwoDisconnectedTasksSettle: true,
      testsPassed: 16,
      liveStatus: 503,
      liveCode: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      liveWorkUnit: "safety-reference-status",
      freshRescanRequired: true,
      securityCompleteClaimAllowed: false,
      distributedAdmissionActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.evidence.find((item) => item.id === "weather_fallback_error_redaction_security")).toMatchObject({
      artifact: path.join("evaluation", "weather-fallback-error-redaction-2026-08-28", "report.json"),
    });
    expect(report.weatherFallbackErrorRedaction).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_WEATHER_FALLBACK_ERROR_REDACTION_SOURCE_REMEDIATED",
      sourceHead: expect.stringMatching(/^[0-9a-f]{40}$/u),
      productionCommit: expect.stringMatching(/^[0-9a-f]{40}$/u),
      scanId: "1411fb32-5c18-4d6a-b8ba-d52697757d8a",
      findingId: "csf_fdda99ed09c6fb65bc74caff",
      findingSlug: "weather-fallback-error-exposure",
      providerFallbackBranchCount: 8,
      allProviderFallbackBranchesUseFixedPublicDetail: true,
      rawProviderErrorsLoggedServerSide: true,
      aggregateWeatherDetailOmitsRawProviderErrors: true,
      testsPassed: 16,
      liveStatus: 503,
      liveCode: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      liveRateLimitHeader: "distributed",
      freshRescanRequired: true,
      securityCompleteClaimAllowed: false,
      distributedAdmissionActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.evidence.find((item) => item.id === "hwpx_archive_expansion_security")).toMatchObject({
      artifact: path.join("evaluation", "hwpx-archive-expansion-security-2026-08-28", "report.json"),
    });
    expect(report.hwpxArchiveExpansionSecurity).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_HWPX_ARCHIVE_EXPANSION_SOURCE_REMEDIATED",
      sourceHead: expect.stringMatching(/^[0-9a-f]{40}$/u),
      productionCommit: expect.stringMatching(/^[0-9a-f]{40}$/u),
      scanId: "1411fb32-5c18-4d6a-b8ba-d52697757d8a",
      findingId: "csf_f8f783170119f2531bcc3163",
      findingSlug: "hwpx-archive-expansion",
      centralDirectoryCheckedBeforeEntryData: true,
      entryCountBudget: 64,
      totalUncompressedBytesBudget: 20 * 1024 * 1024,
      largestEntryUncompressedBytesBudget: 10 * 1024 * 1024,
      estimatedPeakWorkingBytesBudget: 40 * 1024 * 1024,
      templateCount: 25,
      availableTemplateCount: 25,
      allTemplatesPassPreDecompressionBudget: true,
      testsPassed: 37,
      liveStatus: 503,
      liveCode: "PUBLIC_EXPORT_CONCURRENCY_LIMIT",
      liveRateLimitHeader: "instance",
      archiveProcessingReached: false,
      freshRescanRequired: true,
      securityCompleteClaimAllowed: false,
      publicExportDistributedAdmission: "OPEN_OPERATOR_CONFIGURATION",
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
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
    expect(report.evidence.find((item) => item.id === "improvement_photo_analysis_budget")?.productionStatus).toBe("ancestor_of_head");
    expect(report.publicProviderCancellation).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_PUBLIC_PROVIDER_CANCELLATION_SOURCE_PROVEN",
      findingId: "csf_278e8efc9722eb80016c42a3",
      tests: 104,
      liveProviderCallExecuted: false,
      followUpSecurityScan: "REQUIRED",
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.evidence.find((item) => item.id === "public_provider_cancellation")?.productionStatus).toBe("ancestor_of_head");
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
    expect(report.evidence.find((item) => item.id === "public_provider_admission")?.productionStatus).toBe("ancestor_of_head");
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
    expect(report.documentEditorialReviewCockpit).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_DOCUMENT_EDITORIAL_REVIEW_COCKPIT",
      sourceHead: expect.any(String),
      productionCommit: expect.any(String),
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
    expect(report.evidence.find((item) => item.id === "document_editorial_review_cockpit")?.productionStatus).toBe("ancestor_of_head");
    expect(report.evidence.find((item) => item.id === "public_ask_distributed_admission")?.productionStatus).toBe("ancestor_of_head");
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
    expect(report.evidence.find((item) => item.id === "public_search_distributed_admission")?.productionStatus).toBe("ancestor_of_head");
    expect(report.mcpGenerationWorkBudgetSecurity).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_SOURCE_INCLUDED_MCP_GENERATION_WORK_BUDGET_AUTHENTICATED_RUNTIME_PROBE_AND_RESCAN_PENDING",
      postBodyMaxBytes: 98304,
      adjacentTests: 77,
      validAuthenticatedRuntimeProbeRequired: true,
      distributedActivationRequired: true,
      distributedHealthRequired: false,
      currentRefreshStatus: 503,
      currentRefreshRateLimitMode: "distributed",
      currentRefreshErrorCode: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      currentRefreshConfigurationState: "absent",
      currentRefreshReadinessReason: "distributed_limiter_unavailable",
      freshRescanRequired: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.evidence.find((item) => item.id === "mcp_generation_work_budget_security")?.productionStatus).toBe("ancestor_of_head");
    expect(report.mcpProviderAdmission).toMatchObject({
      verdict: "PASS_LIVE_DEPLOYED_SOURCE_DURABLE_MCP_PROVIDER_ADMISSION_RESCAN_PENDING",
      findingId: "csf_b10479b6501c208c4d11644e",
      focusedTests: 61,
      adjacentTests: 94,
      liveRateLimitMode: "instance",
      authenticatedProviderGenerationAvailability: "FAIL_CLOSED_UNTIL_DISTRIBUTED_CONFIG",
      distributedProductionActivation: "OPEN_OPERATOR_CONFIGURATION",
      freshRescanRequired: true,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.evidence.find((item) => item.id === "mcp_provider_admission_security")?.productionStatus).toBe("ancestor_of_head");
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
    expect(report.evidence.find((item) => item.id === "share_recipient_contact_verification_security")?.productionStatus).toBe("ancestor_of_head");
    const shareRecipientEvidence = report.evidence.find((item) => item.id === "share_recipient_contact_verification_security");
    expect(shareRecipientEvidence?.productionCommit).toBe(shareRecipientEvidence?.sourceCommit);
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
    expect(report.evidence.find((item) => item.id === "security_atomic_db_race_remediation")?.sourceStatus).toBe("ancestor");
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
    expect(report.evidence.find((item) => item.id === "live_documents_share_route_perception")?.productionStatus).toBe("ancestor_of_head");
    expect(report.deploymentFreshnessGuard).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_DEPLOYMENT_FRESHNESS_GUARD",
      currentNoticePresent: false,
      driftRefreshVisible: true,
      frontendAuditViolations: 0,
      liveAfterDeploymentPending: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      dbMutationPerformed: false,
    });
    expect(report.evidence.find((item) => item.id === "deployment_freshness_guard")?.productionStatus).toBe("ancestor_of_head");
    expect(report.evidence.find((item) => item.id === "public_generation_admission_security")?.productionStatus).toBe("ancestor_of_head");
    expect(report.evidence.find((item) => item.id === "public_search_distributed_rate_limit_readiness")?.sourceStatus).toBe("ancestor");
    expect(report.learningExportRendererSecurity).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_RENDERER_INERT_LEARNING_EXPORT_SOURCE_CONTRACT",
      currentSourceDisposition: "bounded_renderer_independent_inert_text_contract",
      canonicalDeferredCandidateCount: 1,
      fullRepositoryRescanRequired: true,
      securityCompleteClaimAllowed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    });
    expect(report.evidence.find((item) => item.id === "learning_export_renderer_security")?.productionStatus).toBe("ancestor_of_head");
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
    expect(report.evidence.find((item) => item.id === "hermes_knowledge_review_ui")?.productionStatus).toBe("ancestor_of_head");
    expect(report.evidence.find((item) => item.id === "hermes_review_decision_first_viewport")?.productionStatus).toBe("ancestor_of_head");
    expect(report.evidence.find((item) => item.id === "hermes_review_candidate_position")?.productionStatus).toBe("ancestor_of_head");
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
    expect(report.evidence.find((item) => item.id === "hermes_review_evidence_inspector")?.productionStatus).toBe("ancestor_of_head");
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
    expect(report.evidence.find((item) => item.id === "hermes_review_event_fact_traceability")?.productionStatus).toBe("ancestor_of_head");
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
    expect(report.evidence.find((item) => item.id === "hermes_review_trace_blocks")?.productionStatus).toBe("ancestor_of_head");
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
    expect(report.evidence.find((item) => item.id === "hermes_review_trace_matrix")?.productionStatus).toBe("ancestor_of_head");
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
  }, 90_000);

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
  }, 90_000);

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
  }, 90_000);

  it("rolls up the source-aligned 12-document no-mutation companion without closing launch boundaries", () => {
    const { root, head } = createFixtureRoot();
    const report = runRollup(root, head);

    expect(report.final99.twelveDocumentNoMutation).toMatchObject({
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
    expect(report.evidence.find((item) => item.id === "final_99_12_document_no_mutation")?.sourceStatus).toBe("ancestor");
    expect(report.contradictions).toHaveLength(0);
  }, 90_000);
});
