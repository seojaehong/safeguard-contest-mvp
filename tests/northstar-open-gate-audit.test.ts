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
      { id: "tenant_manifest_v3", passed: true },
      { id: "tenant_harness_no_live_adapter", passed: true },
      { id: "northstar_rls_gate_approval_gated", passed: true },
    ],
  });
  writeJson(rootDir, path.join("evaluation", "sif-embedding-gate", "approval-preflight-report.json"), {
    ok: true,
    approvalHeld: true,
    dbMutationPerformed: false,
    embeddingGenerated: false,
    uploaded: false,
    corpusCount: 6032,
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
    failures: Array.from({ length: 64 }, (_, index) => `unconfirmed-required-check:${index}`),
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
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.state).toBe("proven");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("Scoped first-task cockpit proof only, not full Documents/Share IA completion");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("12 document first-task cockpits");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("staged Share rail");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.detail).toContain("desktop-short 1440x723");
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
      path.join("evaluation", "workspace-ia-live-7b36-2026-07-22", "report.json"),
    );
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("raw textarea and deeper row/all-document authoring");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("selected-editor evidence/recheck CTA is live-proven before raw textarea");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("default exposure budget");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("shell ratio target <= 3");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("first viewport shows current status, core 3 launcher, selected document workbench");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("2-3 region cockpit for recipient/channel/status/provenance");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("do not phrase it as documents page height fixed");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("desktop width-ratio/grid metrics");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("/share/[sessionId] recipient cockpit geometry is live-proven");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).toContain("invited recipient fixture, exact saved/generated /share/[sessionId], and manager/workspace share-result");
    expect(audit.gates.find((gate) => gate.id === "ui_documents_share_cockpit")?.nextActions.join("\n")).not.toContain("Promote the Share staged rail");
    expect(audit.gates.find((gate) => gate.id === "dispatch_standalone_cockpit")?.state).toBe("proven");
    expect(audit.gates.find((gate) => gate.id === "share_result_fixture_cockpit")?.state).toBe("proven");
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
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.detail).toContain("shallow human-confirmation-only reviews are blocked");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.detail).toContain("completed review remains no-mutation plus separate approval");
    expect(audit.gates.find((gate) => gate.id === "kosha_exact_promotion_review_gate")?.nextActions.join("\n")).toContain(
      "Re-run scripts\\kosha_exact_promotion_review_gate.mjs",
    );
    expect(audit.forbiddenClaims).toContain("LLM Wiki publishes itself.");
    expect(audit.forbiddenClaims).toContain("All KOSHA metadata-verified candidates are exact production evidence.");
    expect(audit.forbiddenClaims).toContain("KOSHA operator checklist completion alone approves exact-trust promotion.");
    expect(audit.forbiddenClaims).toContain("Real provider dispatch is production-live for any channel before persistent idempotency and provider result persistence approval.");
    expect(audit.safeDemoClaims).toContain("Photo hazard analysis readiness supports up to 10 images and keeps Before/After improvements as reviewed operation memory.");
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
