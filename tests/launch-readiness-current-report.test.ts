import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

type LaunchReadinessReport = {
  approvalGatedBoundaries: Array<{
    currentSafetyLock: string;
    gate: string;
    state: string;
  }>;
  approvalGatedBoundaryCount: number;
  approvalGatedBoundaryIds: string[];
  apiAsk: {
    errorCode: string;
    rateLimit: string;
    requestedAiMode: string;
    retryAfterSeconds: number | null;
    status: number | null;
    workUnit: string;
  };
  connectionVerdict: string;
  currentHeadIsEvidenceOnlyPending: boolean;
  dispatchCalled: boolean;
  documentCoverage: {
    expectedCount: number;
    missing: string[];
    present: string[];
    presentCount: number;
  };
  final99Boundary: {
    fullyAutomatedLaunchClaimAllowed: boolean;
    historicalGateSafeLaunchDemoClaimAllowed: boolean;
    noticeCount: number;
    overall: string;
    safeLaunchDemoClaimAllowed: boolean;
  };
  forbiddenClaims: string[];
  fullyAutomatedLaunchClaimAllowed: boolean;
  productionCommit: string;
  providerDispatchLiveClaimed: boolean;
  rawAuditFreshness: {
    ready: boolean;
    reasons: string[];
  };
  runtimeBoundary: {
    databaseMutationPerformed: boolean;
    distributedAdmissionActivation: string;
    distributedAdmissionBlocked: boolean;
    enhancedFullDistributedAdmissionPending: boolean;
    exactSavedShareVerdict: string;
    providerBackedModesReady: boolean | null;
    providerDispatchExecuted: boolean;
    providerWorkExecuted: boolean | null;
    templateModeOnly: boolean;
  };
  safeLaunchDemoClaimAllowed: boolean;
  sourceHeadAtGeneration: string;
  uiArchitectureBoundary: {
    exactSavedUserShareSessionReproduced: boolean;
    routeSplitAloneAcceptedAsFix: boolean;
    shareRouteEvidenceBoundary: string;
  };
  verdict: string;
};

type LaunchReportModule = {
  buildLaunchReadinessCurrentReport: (options: {
    approvalRunwayPath?: string;
    generatedAt?: string;
    productionCommit?: string;
    rootDir: string;
    sourceHead?: string;
  }) => LaunchReadinessReport;
  renderLaunchReadinessCurrentMarkdown: (report: LaunchReadinessReport) => string;
};

const tempRoots: string[] = [];

async function loadReportModule(): Promise<LaunchReportModule> {
  const sourcePath = path.resolve("scripts", "launch_readiness_current_report.mjs");
  const moduleDir = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-launch-report-module-"));
  const modulePath = path.join(moduleDir, "launch_readiness_current_report.mjs");
  const source = fs.readFileSync(sourcePath, "utf8").replace(/^#!.*\r?\n/u, "");
  fs.writeFileSync(modulePath, source, "utf8");
  return await import(pathToFileURL(modulePath).href) as LaunchReportModule;
}

function writeJson(rootDir: string, relativePath: string, value: unknown): void {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function git(rootDir: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function createFixtureRoot(): { head: string; rootDir: string } {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-launch-report-"));
  tempRoots.push(rootDir);
  git(rootDir, ["init", "-q"]);
  git(rootDir, ["config", "user.email", "codex@example.test"]);
  git(rootDir, ["config", "user.name", "Codex Test"]);
  writeJson(rootDir, "evaluation/launch-readiness-current-2026-07-22/api-connection-audit.json", {
    generatedAt: "2026-07-22T00:00:00.000Z",
    apiAskOk: true,
    apiAskStatus: 200,
    requestedAiMode: "template",
    baseUrl: "https://www.safeclaw.kr",
    connections: [
      { liveStatus: "연결됨", name: "Law.go / korean-law-mcp" },
      { liveStatus: "연결됨", name: "Gemini" },
      { liveStatus: "연결됨", name: "기상청" },
      { liveStatus: "연결됨", name: "Work24" },
      { liveStatus: "연결됨", name: "KOSHA 교육" },
      { liveStatus: "연결됨", name: "KOSHA 공식자료" },
      { liveStatus: "연결됨", name: "KOSHA 재해사례" },
      { liveStatus: "설정 점검만 수행", name: "n8n dispatch" },
    ],
    dispatchOk: null,
    dispatchStatus: null,
    documents: {
      emergencyResponseDraft: true,
      foreignWorkerBriefing: true,
      foreignWorkerTransmission: true,
      kakaoMessage: true,
      photoEvidenceDraft: true,
      riskAssessmentDraft: true,
      safetyEducationRecordDraft: true,
      tbmBriefing: true,
      tbmLogDraft: true,
      workpackSummaryDraft: true,
      workPlanDraft: true,
      workPermitDraft: true,
    },
    elapsedMs: 1234,
    scenario: { workSummary: "fixture launch smoke" },
  });
  writeJson(rootDir, "evaluation/final-99-gate-current-2026-07-22/report.json", {
    overall: "pass_with_notice",
  });
  writeJson(rootDir, "evaluation/final-99-gate-current-2026-07-22/notice-carry.json", {
    notices: [
      {
        allowedClaim: "safe launch demo",
        forbiddenClaim: "fully automated launch",
        gate: "auth-history-reuse",
        launchImpact: "operator auth required",
      },
      {
        allowedClaim: "preview dispatch policy",
        forbiddenClaim: "live provider dispatch",
        gate: "dispatch-policy",
        launchImpact: "provider approval required",
      },
    ],
  });
  writeJson(rootDir, "evaluation/northstar-next-runway-current-2026-07-22/report.json", {
    documentsLongFormIA: { verdict: "PASS_CURRENT_SOURCE_LOCAL_PRODUCTION" },
    shareExactSessionBoundary: { exactSavedUserSessionReproduced: false },
    shareGeneratedSessionPerception: { verdict: "PASS_CURRENT_SOURCE_GENERATED_RESULT_FIXTURE" },
    uiInterpretation: {
      shareRouteEvidenceBoundary: "fixture recipient pass, exact saved/session missing, manager share route unconfirmed",
    },
  });
  writeJson(rootDir, "evaluation/northstar-open-gates-current/report.json", { overall: "open" });
  writeJson(rootDir, "evaluation/northstar-live-rollup-2026-07-20/report.json", {});
  writeJson(rootDir, "evaluation/northstar-approval-runway-2026-07-21/report.json", {
    approvalGates: [
      "distributed_admission_activation",
      "share_recipient_ack_approval",
      "provider_dispatch_persistence",
      "supabase_rls_launch_isolation",
      "llm_wiki_publication",
      "sif_embedding_runtime",
      "kosha_exact_promotion_review_gate",
      "security_atomic_db_race_remediation",
    ].map((id) => ({
      approvalNeeded: [`approve ${id}`],
      currentSafetyLock: `${id}_locked`,
      evidencePath: `evaluation/${id}/report.json`,
      forbiddenUntilApproved: [`do not activate ${id}`],
      id,
      readyForOperatorReview: true,
      state: "approval_gated",
    })),
  });
  fs.writeFileSync(path.join(rootDir, "README.md"), "fixture\n", "utf8");
  git(rootDir, ["add", "."]);
  git(rootDir, ["commit", "-qm", "fixture"]);
  const head = git(rootDir, ["rev-parse", "HEAD"]);
  const rawAuditPath = path.join(rootDir, "evaluation/launch-readiness-current-2026-07-22/api-connection-audit.json");
  const rawAudit = JSON.parse(fs.readFileSync(rawAuditPath, "utf8")) as Record<string, unknown>;
  writeJson(rootDir, "evaluation/launch-readiness-current-2026-07-22/api-connection-audit.json", {
    ...rawAudit,
    productionCommit: head,
  });
  return { head, rootDir };
}

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    fs.rmSync(rootDir, { force: true, recursive: true });
  }
});

describe("launch readiness current report", () => {
  it("builds the live no-dispatch launch boundary without broad launch claims", async () => {
    const module = await loadReportModule();
    const { head, rootDir } = createFixtureRoot();

    const report = module.buildLaunchReadinessCurrentReport({
      generatedAt: "2026-07-22T00:00:00.000Z",
      productionCommit: head,
      rootDir,
    });
    const markdown = module.renderLaunchReadinessCurrentMarkdown(report);

    expect(report).toMatchObject({
      connectionVerdict: "PASS_CONNECTED_NO_DISPATCH",
      currentHeadIsEvidenceOnlyPending: false,
      dispatchCalled: false,
      fullyAutomatedLaunchClaimAllowed: false,
      productionCommit: head,
      providerDispatchLiveClaimed: false,
      safeLaunchDemoClaimAllowed: true,
      sourceHeadAtGeneration: head,
      verdict: "PASS_LIVE_PRODUCTION_WITH_BOUNDARIES",
    });
    expect(report.documentCoverage).toMatchObject({
      expectedCount: 12,
      missing: [],
      presentCount: 12,
    });
    expect(report.documentCoverage.present).toContain("workPermitDraft");
    expect(report.apiAsk.requestedAiMode).toBe("template");
    expect(report.rawAuditFreshness).toMatchObject({ ready: true, reasons: [] });
    expect(report.approvalGatedBoundaryCount).toBe(8);
    expect(report.approvalGatedBoundaryIds).toEqual([
      "distributed_admission_activation",
      "share_recipient_ack_approval",
      "provider_dispatch_persistence",
      "supabase_rls_launch_isolation",
      "llm_wiki_publication",
      "sif_embedding_runtime",
      "kosha_exact_promotion_review_gate",
      "security_atomic_db_race_remediation",
    ]);
    expect(report.approvalGatedBoundaries[0]).toMatchObject({
      currentSafetyLock: "distributed_admission_activation_locked",
      gate: "distributed_admission_activation",
      state: "approval_gated",
    });
    expect(report.runtimeBoundary).toMatchObject({
      distributedAdmissionActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      enhancedFullDistributedAdmissionPending: true,
      providerBackedModesReady: false,
      providerWorkExecuted: false,
      templateModeOnly: true,
    });
    expect(report.final99Boundary).toMatchObject({
      fullyAutomatedLaunchClaimAllowed: false,
      noticeCount: 2,
      overall: "pass_with_notice",
      safeLaunchDemoClaimAllowed: true,
    });
    expect(report.uiArchitectureBoundary).toMatchObject({
      exactSavedUserShareSessionReproduced: false,
      routeSplitAloneAcceptedAsFix: false,
    });
    expect(report.uiArchitectureBoundary.shareRouteEvidenceBoundary).toContain("exact saved/session missing");
    expect(report.forbiddenClaims).toContain("Real provider dispatch is production-live for any channel.");
    expect(markdown).toContain("SAFETYGUARD_AUDIT_DISPATCH=false");
    expect(markdown).toContain("requested AI mode: `template`");
    expect(markdown).toContain("Enhanced/full provider-backed generation remains separately approval-gated.");
    expect(markdown).toContain("Exact saved user share session reproduced: `false`");
    expect(markdown).toContain("Final-99 remains `pass_with_notice`; 2 notices are carried.");
    expect(markdown).not.toContain("Final-99 remains `undefined`");
    expect(markdown).toContain("Fully automated self-serve launch and real provider dispatch readiness are not allowed.");
  });

  it("marks a source-only evidence head pending when production lags", async () => {
    const module = await loadReportModule();
    const { rootDir } = createFixtureRoot();
    const rawAuditPath = "evaluation/launch-readiness-current-2026-07-22/api-connection-audit.json";
    const rawAudit = JSON.parse(fs.readFileSync(path.join(rootDir, rawAuditPath), "utf8")) as Record<string, unknown>;
    writeJson(rootDir, rawAuditPath, {
      ...rawAudit,
      productionCommit: "previous-live-commit",
    });

    const report = module.buildLaunchReadinessCurrentReport({
      generatedAt: "2026-07-22T00:00:00.000Z",
      productionCommit: "previous-live-commit",
      rootDir,
    });

    expect(report.currentHeadIsEvidenceOnlyPending).toBe(true);
    expect(report.productionCommit).toBe("previous-live-commit");
    expect(report.verdict).toBe("PASS_LIVE_PRODUCTION_WITH_BOUNDARIES");
    expect(report.dispatchCalled).toBe(false);
    expect(report.final99Boundary).toMatchObject({
      historicalGateSafeLaunchDemoClaimAllowed: true,
      safeLaunchDemoClaimAllowed: true,
    });
  });

  it("keeps template demo readiness separate from bounded external connection status", async () => {
    const module = await loadReportModule();
    const { head, rootDir } = createFixtureRoot();
    const rawAuditPath = "evaluation/launch-readiness-current-2026-07-22/api-connection-audit.json";
    const rawAudit = JSON.parse(fs.readFileSync(path.join(rootDir, rawAuditPath), "utf8")) as Record<string, unknown>;
    const connections = rawAudit.connections as Array<Record<string, unknown>>;
    writeJson(rootDir, rawAuditPath, {
      ...rawAudit,
      connections: connections.map((connection, index) => index === 0
        ? { ...connection, liveStatus: "연결 점검 필요" }
        : connection),
    });

    const report = module.buildLaunchReadinessCurrentReport({
      generatedAt: "2026-07-22T00:00:00.000Z",
      productionCommit: head,
      rootDir,
    });

    expect(report).toMatchObject({
      connectionVerdict: "PASS_TEMPLATE_GENERATION_CONNECTIONS_BOUNDED_NO_DISPATCH",
      safeLaunchDemoClaimAllowed: true,
      guidedPilotClaimAllowed: true,
      verdict: "PASS_LIVE_PRODUCTION_WITH_BOUNDARIES",
    });
  });

  it("classifies distributed admission unavailability as a live launch blocker without overclaiming document failure", async () => {
    const module = await loadReportModule();
    const { head, rootDir } = createFixtureRoot();
    writeJson(rootDir, "evaluation/launch-readiness-current-2026-07-22/api-connection-audit.json", {
      generatedAt: "2026-08-28T00:00:00.000Z",
      productionCommit: head,
      apiAskError: "request protection unavailable",
      apiAskErrorCode: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      apiAskOk: false,
      apiAskRateLimit: "distributed",
      apiAskRetryAfterSeconds: 5,
      apiAskStatus: 503,
      apiAskWorkUnit: "generation",
      requestedAiMode: "enhanced",
      baseUrl: "https://www.safeclaw.kr",
      connections: [],
      dispatchOk: null,
      dispatchStatus: null,
      documents: {},
      elapsedMs: 696,
      scenario: null,
    });

    const report = module.buildLaunchReadinessCurrentReport({
      generatedAt: "2026-08-28T00:00:00.000Z",
      productionCommit: head,
      rootDir,
    });
    const markdown = module.renderLaunchReadinessCurrentMarkdown(report);

    expect(report).toMatchObject({
      connectionVerdict: "BLOCKED_BEFORE_CONNECTION_CHECK_NO_DISPATCH",
      dispatchCalled: false,
      providerDispatchLiveClaimed: false,
      safeLaunchDemoClaimAllowed: false,
      verdict: "BLOCKED_LIVE_PRODUCTION_DISTRIBUTED_ADMISSION_REQUIRED_NO_DISPATCH",
    });
    expect(report.apiAsk).toMatchObject({
      errorCode: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      rateLimit: "distributed",
      retryAfterSeconds: 5,
      status: 503,
      workUnit: "generation",
    });
    expect(report.runtimeBoundary).toEqual({
      databaseMutationPerformed: false,
      distributedAdmissionActivation: "OPERATOR_CONFIGURATION_REQUIRED",
      distributedAdmissionBlocked: true,
      enhancedFullDistributedAdmissionPending: true,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      providerBackedModesReady: false,
      providerDispatchExecuted: false,
      providerWorkExecuted: false,
      templateModeOnly: false,
    });
    expect(report.final99Boundary).toMatchObject({
      historicalGateSafeLaunchDemoClaimAllowed: true,
      safeLaunchDemoClaimAllowed: false,
    });
    expect(report.forbiddenClaims).toContain("Current live /api/ask generation is available for a launch demo.");
    expect(markdown).toContain("Current live launch demo generation is not allowed");
    expect(markdown).toContain("DISTRIBUTED_RATE_LIMIT_UNAVAILABLE");
  });

  it("fails closed when a successful audit does not prove explicit template mode", async () => {
    const module = await loadReportModule();
    const { head, rootDir } = createFixtureRoot();
    const rawAuditPath = "evaluation/launch-readiness-current-2026-07-22/api-connection-audit.json";
    const rawAudit = JSON.parse(fs.readFileSync(path.join(rootDir, rawAuditPath), "utf8")) as Record<string, unknown>;
    const { requestedAiMode: _requestedAiMode, ...withoutMode } = rawAudit;
    writeJson(rootDir, rawAuditPath, withoutMode);

    const report = module.buildLaunchReadinessCurrentReport({
      generatedAt: "2026-07-22T00:00:00.000Z",
      productionCommit: head,
      rootDir,
    });

    expect(report).toMatchObject({
      safeLaunchDemoClaimAllowed: false,
      verdict: "REVIEW_REQUIRED_WITH_BOUNDARIES",
    });
    expect(report.apiAsk.requestedAiMode).toBe("");
  });

  it("fails closed when a historical raw audit is relabeled with the current production marker", async () => {
    const module = await loadReportModule();
    const { head, rootDir } = createFixtureRoot();
    const rawAuditPath = "evaluation/launch-readiness-current-2026-07-22/api-connection-audit.json";
    const rawAudit = JSON.parse(fs.readFileSync(path.join(rootDir, rawAuditPath), "utf8")) as Record<string, unknown>;
    writeJson(rootDir, rawAuditPath, {
      ...rawAudit,
      generatedAt: "2026-07-22T00:00:00.000Z",
      productionCommit: "historical-production-commit",
    });

    const report = module.buildLaunchReadinessCurrentReport({
      generatedAt: "2026-08-29T00:00:00.000Z",
      productionCommit: head,
      rootDir,
    });

    expect(report).toMatchObject({
      connectionVerdict: "STALE_PROBE_NOT_CURRENT_LIVE_EVIDENCE",
      safeLaunchDemoClaimAllowed: false,
      verdict: "STALE_LIVE_PROBE_REQUIRES_RERUN_NO_DISPATCH",
    });
    expect(report.rawAuditFreshness).toMatchObject({
      ready: false,
      reasons: ["raw_audit_production_commit_mismatch", "raw_audit_too_old"],
    });
    expect(report.forbiddenClaims).toContain("The stored launch smoke proves the current production runtime is launch-ready.");
  });

  it("fails closed when the canonical approval runway is incomplete", async () => {
    const module = await loadReportModule();
    const { head, rootDir } = createFixtureRoot();
    writeJson(rootDir, "evaluation/northstar-approval-runway-2026-07-21/report.json", {
      approvalGates: [{ id: "distributed_admission_activation", state: "proven" }],
    });

    expect(() => module.buildLaunchReadinessCurrentReport({
      productionCommit: head,
      rootDir,
    })).toThrow("incomplete or not approval_gated");
  });
});
