#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const OUT_DIR = path.join("evaluation", "final-99-no-approval-boundary-2026-07-23");
const DEFAULT_BASE_URL = "https://www.safeclaw.kr";
const FINAL_99_REPORT_PATH = path.join("evaluation", "final-99-gate-current-2026-07-22", "report.json");
const RUNNER_PATH = path.join("scripts", "final_99_gate_runner.mjs");

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.SAFECLAW_BASE_URL || DEFAULT_BASE_URL,
    outputDir: OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-url") {
      options.baseUrl = argv[index + 1] || options.baseUrl;
      index += 1;
    } else if (arg === "--output") {
      options.outputDir = argv[index + 1] || options.outputDir;
      index += 1;
    }
  }
  return options;
}

function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function readBuildInfo(baseUrl) {
  try {
    const url = new URL("/api/build-info", baseUrl);
    url.searchParams.set("codexCacheBust", `final99-no-approval-${Date.now()}`);
    const response = await fetch(url, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      status: response.status,
      body,
      commitSha: typeof body?.commitSha === "string" ? body.commitSha : "",
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      body: {},
      commitSha: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function inspectRunnerSource() {
  const source = fs.readFileSync(RUNNER_PATH, "utf8");
  return {
    runnerPath: RUNNER_PATH,
    authTokenAbsentSkipsLiveWrites: source.includes("if (!authToken)")
      && source.includes("SAFEGUARD_AUTH_TOKEN")
      && source.includes("pass_with_notice"),
    tokenPathPostsWorkers: source.includes('fetchJson("/api/workers"')
      && source.includes('method: "POST"'),
    tokenPathPostsWorkpacks: source.includes('fetchJson("/api/workpacks"')
      && source.includes('method: "POST"'),
    tokenPathPostsEducationRecords: source.includes('fetchJson("/api/education-records"')
      && source.includes('method: "POST"'),
    tokenPathPostsDispatchLogs: source.includes('fetchJson("/api/dispatch-logs"')
      && source.includes('method: "POST"'),
  };
}

function summarizeFinal99(report) {
  const gates = Array.isArray(report.gates) ? report.gates : [];
  const noticeGates = gates.filter((gate) => gate && gate.verdict === "pass_with_notice");
  return {
    overall: typeof report.overall === "string" ? report.overall : "",
    noticeGateIds: noticeGates.map((gate) => String(gate.id || gate.name || "unknown")),
    noticeCount: noticeGates.length,
    fullyAutomatedLaunchClaimAllowed: false,
    safeLaunchDemoClaimAllowed: report.overall === "pass_with_notice" || report.overall === "pass",
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const generatedAt = new Date().toISOString();
  const sourceHead = gitHead();
  const buildInfo = await readBuildInfo(options.baseUrl);
  const final99 = summarizeFinal99(readJson(FINAL_99_REPORT_PATH));
  const runner = inspectRunnerSource();
  const authTokenPresentInThisReview = Boolean(process.env.SAFEGUARD_AUTH_TOKEN);
  const tokenPathWrites = runner.tokenPathPostsWorkers
    || runner.tokenPathPostsWorkpacks
    || runner.tokenPathPostsEducationRecords
    || runner.tokenPathPostsDispatchLogs;
  const noApprovalBoundaryIntact = final99.overall === "pass_with_notice"
    && final99.noticeCount >= 2
    && final99.fullyAutomatedLaunchClaimAllowed === false
    && final99.safeLaunchDemoClaimAllowed === true
    && runner.authTokenAbsentSkipsLiveWrites
    && tokenPathWrites;

  const report = {
    schemaVersion: "safeclaw-final-99-no-approval-boundary/v1",
    generatedAt,
    baseUrl: options.baseUrl,
    sourceHead,
    productionBuildInfoAtReview: buildInfo.body,
    productionCommit: buildInfo.commitSha,
    verdict: noApprovalBoundaryIntact
      ? "NO_APPROVAL_FINAL_99_RERUN_BLOCKED_BOUNDARY_DOCUMENTED"
      : "RED_FINAL_99_NO_APPROVAL_BOUNDARY_CONTRACT_DRIFT",
    dbMutationPerformed: false,
    providerDispatchLiveClaimed: false,
    final99CurrentReportPath: FINAL_99_REPORT_PATH,
    currentFinal99Overall: final99.overall,
    currentCarriedNoticeCount: final99.noticeCount,
    currentNoticeGateIds: final99.noticeGateIds,
    fullyAutomatedLaunchClaimAllowed: final99.fullyAutomatedLaunchClaimAllowed,
    safeLaunchDemoClaimAllowed: final99.safeLaunchDemoClaimAllowed,
    currentAllowedClaim: "safe launch demo with explicit approval/auth/provider boundaries",
    currentForbiddenClaim: "fully automated launch or approved live provider dispatch is complete",
    runnerPath: RUNNER_PATH,
    runnerNoApprovalRisk: {
      safeWhenSafeguardAuthTokenAbsent: runner.authTokenAbsentSkipsLiveWrites,
      authTokenPresentInThisReview,
      authHistoryReuseWritesWhenTokenPresent: runner.tokenPathPostsWorkers
        && runner.tokenPathPostsWorkpacks
        && runner.tokenPathPostsEducationRecords,
      dispatchLogWritesWhenTokenPresent: runner.tokenPathPostsDispatchLogs,
      reason: "runAuthHistoryGate returns pass_with_notice without SAFEGUARD_AUTH_TOKEN, but with a token it POSTs workers, workpacks, education records, and dispatch logs before checking archive/reopen state.",
    },
    sourceLineEvidence: [
      {
        path: RUNNER_PATH,
        meaning: "SAFEGUARD_AUTH_TOKEN absence creates pass_with_notice and skips live admin save/reopen.",
      },
      {
        path: RUNNER_PATH,
        meaning: "When SAFEGUARD_AUTH_TOKEN is present, the runner POSTs workers, workpacks, and education records.",
      },
      {
        path: RUNNER_PATH,
        meaning: "When a workpack exists, the runner POSTs dispatch logs and reads dispatch-log archive state.",
      },
    ],
    nextApprovalNeeded: [
      "Provide SAFEGUARD_AUTH_TOKEN in a secure operator environment before rerunning final-99 auth-history reuse as a live save/reopen proof.",
      "Approve provider/channel scope before claiming live provider dispatch or final-99 dispatch-policy closure.",
      "Keep final-99 pass_with_notice carried until both approval/auth gates have direct evidence.",
    ],
    forbiddenActionsWithoutApproval: [
      "Do not run the full final_99_gate_runner as a cleanup step if SAFEGUARD_AUTH_TOKEN is configured.",
      "Do not create workpacks, workers, education records, dispatch logs, or share sessions to close final-99 notices without explicit approval.",
      "Do not reinterpret pass_with_notice as fully automated launch readiness.",
    ],
  };

  fs.mkdirSync(options.outputDir, { recursive: true });
  fs.writeFileSync(path.join(options.outputDir, "report.json"), json(report), "utf8");
  fs.writeFileSync(path.join(options.outputDir, "report.md"), `# Final-99 No-Approval Boundary

Generated at: \`${generatedAt}\`

Source HEAD: \`${sourceHead}\`

Production \`/api/build-info\` at review: \`${buildInfo.commitSha || "unknown"}\`

Verdict: \`${report.verdict}\`

DB mutation performed: \`${report.dbMutationPerformed}\`

Provider live dispatch claimed: \`${report.providerDispatchLiveClaimed}\`

## Current Final-99 State

- Current report: \`${FINAL_99_REPORT_PATH}\`
- Overall: \`${report.currentFinal99Overall}\`
- Carried notices: \`${report.currentCarriedNoticeCount}\`
- Notice gates: ${report.currentNoticeGateIds.map((item) => `\`${item}\``).join(", ")}
- Fully automated launch claim allowed: \`${report.fullyAutomatedLaunchClaimAllowed}\`
- Safe launch demo claim allowed: \`${report.safeLaunchDemoClaimAllowed}\`
- Allowed claim: ${report.currentAllowedClaim}.
- Forbidden claim: ${report.currentForbiddenClaim}.

## Why Full Final-99 Was Not Rerun

The full runner is not a harmless marker refresh when \`SAFEGUARD_AUTH_TOKEN\` is configured. The no-token path is intentionally safe and returns \`pass_with_notice\`, but the token path performs live writes:

- \`${RUNNER_PATH}\`: absence of \`SAFEGUARD_AUTH_TOKEN\` skips live admin save/reopen and records \`pass_with_notice\`.
- \`${RUNNER_PATH}\`: token-present path POSTs workers, workpacks, and education records.
- \`${RUNNER_PATH}\`: token-present path POSTs dispatch logs and reads dispatch-log archive state.

Therefore this evidence pass documents the approval boundary instead of rerunning final-99 as a no-approval cleanup.

## Next Approval Needed

${report.nextApprovalNeeded.map((item) => `- ${item}`).join("\n")}

## Forbidden Actions Without Approval

${report.forbiddenActionsWithoutApproval.map((item) => `- ${item}`).join("\n")}
`, "utf8");

  console.log(json({
    output: options.outputDir,
    verdict: report.verdict,
    sourceHead,
    productionCommit: buildInfo.commitSha,
    currentFinal99Overall: report.currentFinal99Overall,
    currentCarriedNoticeCount: report.currentCarriedNoticeCount,
    dbMutationPerformed: report.dbMutationPerformed,
    providerDispatchLiveClaimed: report.providerDispatchLiveClaimed,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
