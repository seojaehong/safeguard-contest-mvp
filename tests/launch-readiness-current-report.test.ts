import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

type LaunchReadinessReport = {
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
    noticeCount: number;
    overall: string;
    safeLaunchDemoClaimAllowed: boolean;
  };
  forbiddenClaims: string[];
  fullyAutomatedLaunchClaimAllowed: boolean;
  productionCommit: string;
  providerDispatchLiveClaimed: boolean;
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
    apiAskOk: true,
    apiAskStatus: 200,
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
  fs.writeFileSync(path.join(rootDir, "README.md"), "fixture\n", "utf8");
  git(rootDir, ["add", "."]);
  git(rootDir, ["commit", "-qm", "fixture"]);
  return { head: git(rootDir, ["rev-parse", "HEAD"]), rootDir };
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
    expect(markdown).toContain("Exact saved user share session reproduced: `false`");
    expect(markdown).toContain("Final-99 remains `pass_with_notice`; 2 notices are carried.");
    expect(markdown).not.toContain("Final-99 remains `undefined`");
    expect(markdown).toContain("Fully automated self-serve launch and real provider dispatch readiness are not allowed.");
  });

  it("marks a source-only evidence head pending when production lags", async () => {
    const module = await loadReportModule();
    const { rootDir } = createFixtureRoot();

    const report = module.buildLaunchReadinessCurrentReport({
      generatedAt: "2026-07-22T00:00:00.000Z",
      productionCommit: "previous-live-commit",
      rootDir,
    });

    expect(report.currentHeadIsEvidenceOnlyPending).toBe(true);
    expect(report.productionCommit).toBe("previous-live-commit");
    expect(report.verdict).toBe("PASS_LIVE_PRODUCTION_WITH_BOUNDARIES");
    expect(report.dispatchCalled).toBe(false);
  });
});
