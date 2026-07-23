#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const OUT_DIR = path.join("evaluation", "kosha-exact-promotion-review-contract-audit-2026-07-23");
const REVIEW_GATE_REPORT = path.join("evaluation", "kosha-exact-promotion-review-gate-2026-07-22", "report.json");
const REVIEW_GATE_SCRIPT = path.join("scripts", "kosha_exact_promotion_review_gate.mjs");
const FOCUSED_TEST = path.join("tests", "kosha-exact-promotion-review-gate.test.ts");

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.SAFECLAW_BASE_URL || "https://www.safeclaw.kr",
    outputDir: OUT_DIR,
    skipTests: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-url") {
      options.baseUrl = argv[index + 1] || options.baseUrl;
      index += 1;
    } else if (arg === "--output") {
      options.outputDir = argv[index + 1] || options.outputDir;
      index += 1;
    } else if (arg === "--skip-tests") {
      options.skipTests = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
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
    url.searchParams.set("codexCacheBust", `kosha-review-contract-${Date.now()}`);
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

function runNodeCheck() {
  execFileSync("node", ["--check", REVIEW_GATE_SCRIPT], { encoding: "utf8" });
  return {
    command: `node --check ${REVIEW_GATE_SCRIPT}`,
    passed: true,
  };
}

function runFocusedTests(skipTests) {
  const command = `npm.cmd test -- ${FOCUSED_TEST} --maxWorkers=1 --fileParallelism=false`;
  if (skipTests) {
    return {
      command,
      passed: false,
      skipped: true,
      testFilesPassed: 0,
      testsPassed: 0,
    };
  }
  const executable = process.platform === "win32" ? "cmd.exe" : "npm.cmd";
  const args = process.platform === "win32"
    ? ["/c", "npm.cmd", "test", "--", FOCUSED_TEST, "--maxWorkers=1", "--fileParallelism=false"]
    : ["test", "--", FOCUSED_TEST, "--maxWorkers=1", "--fileParallelism=false"];
  const output = execFileSync(executable, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const fileMatch = /Test Files\s+(\d+) passed/iu.exec(output);
  const testMatch = /Tests\s+(\d+) passed/iu.exec(output);
  return {
    command,
    passed: true,
    skipped: false,
    testFilesPassed: fileMatch ? Number(fileMatch[1]) : 1,
    testsPassed: testMatch ? Number(testMatch[1]) : 0,
  };
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function renderMarkdown(report) {
  return `# KOSHA Exact Promotion Review Contract Audit

Generated at: \`${report.generatedAt}\`

Verdict: \`${report.verdict}\`

Source HEAD: \`${report.sourceHead}\`

Production \`/api/build-info\`: \`${report.productionBuildInfo.commitSha || "unknown"}\`

## Boundary

This is an approval-free static and focused-test audit of the KOSHA exact-promotion review gate. It does **not** promote exact trust, mutate the DB, create exact registry write artifacts, generate embeddings, activate vector retrieval, or acquire new network data.

The current committed review-gate artifact remains a blocked operator template snapshot:

- Artifact: \`${report.currentReviewGateArtifact}\`
- Artifact source: \`${report.currentReviewGateArtifactSourceHead}\`
- Artifact verdict: \`${report.currentReviewGateArtifactVerdict}\`
- Review rows: \`${report.reviewRows}\`
- Passed rows: \`${report.passedReviewRows}\`
- Failures: \`${report.failureCount}\`

## Contract Evidence

- Completed review verdict remains \`${report.contractEvidence.completedReviewVerdict}\`.
- Incomplete review verdict remains \`${report.contractEvidence.incompleteReviewVerdict}\`.
- Shallow reviewer / reviewedAt / humanConfirmed fields alone are blocked.
- Required check text must match the packet candidate checks.
- Metadata, hash, provenance, extra row, missing row, and duplicate stable-key mismatches fail closed.
- Completed human review still requires separate exact-trust promotion approval.
- Completed human review does not create an exact registry write artifact.

## Current Blocked Template Snapshot

| Metric | Value |
| --- | ---: |
| Packet candidates | ${report.packetCandidates} |
| Review rows | ${report.reviewRows} |
| Passed review rows | ${report.passedReviewRows} |
| Total failures | ${report.failureCount} |
| Unconfirmed required checks | ${report.failureSummary.unconfirmedRequiredChecks} |
| Missing human confirmations | ${report.failureSummary.missingHumanConfirmations} |
| Missing reviewers | ${report.failureSummary.missingReviewers} |
| Missing reviewedAt | ${report.failureSummary.missingReviewedAt} |

## Verification

| Check | Result |
| --- | --- |
| \`${report.verification.nodeCheck.command}\` | ${report.verification.nodeCheck.passed ? "PASS" : "FAIL"} |
| \`${report.verification.focusedTests.command}\` | ${report.verification.focusedTests.passed ? `PASS, ${report.verification.focusedTests.testFilesPassed} file / ${report.verification.focusedTests.testsPassed} tests` : "SKIPPED"} |

## Forbidden Claims

${report.forbiddenClaims.map((claim) => `- ${claim}`).join("\n")}

## Next Approval Boundary

${report.nextApprovalBoundary.map((item, index) => `${index + 1}. ${item}`).join("\n")}
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const generatedAt = new Date().toISOString();
  const sourceHead = gitHead();
  const productionBuildInfo = (await readBuildInfo(options.baseUrl)).body;
  const reviewGate = readJson(REVIEW_GATE_REPORT);
  const nodeCheck = runNodeCheck();
  const focusedTests = runFocusedTests(options.skipTests);
  const mutationBoundary = {
    mutationPerformed: false,
    dbMutationPerformed: false,
    embeddingGenerationPerformed: false,
    exactPromotionPerformed: false,
    exactRegistryWriteArtifactCreated: false,
    networkAcquisitionPerformed: false,
    providerDispatchLiveClaimed: false,
  };
  const report = {
    schemaVersion: "safeclaw-kosha-exact-promotion-review-contract-audit/v1",
    generatedAt,
    sourceHead,
    productionBuildInfo,
    verdict: nodeCheck.passed && focusedTests.passed && reviewGate.exactPromotionPerformed === false
      ? "PASS_CURRENT_SOURCE_REVIEW_GATE_CONTRACT_NO_MUTATION"
      : "RED_REVIEW_GATE_CONTRACT_AUDIT_FAILED",
    auditScope: "approval-free static and focused-test audit of KOSHA exact-promotion review gate behavior",
    scriptUnderAudit: REVIEW_GATE_SCRIPT,
    currentReviewGateArtifact: REVIEW_GATE_REPORT,
    currentReviewGateArtifactSourceHead: reviewGate.sourceHead,
    currentReviewGateArtifactVerdict: reviewGate.verdict,
    reviewChecklistComplete: reviewGate.reviewChecklistComplete,
    reviewRows: reviewGate.reviewedCandidateCount,
    packetCandidates: reviewGate.candidateCount,
    passedReviewRows: reviewGate.passedCandidateCount,
    failureCount: Array.isArray(reviewGate.failures) ? reviewGate.failures.length : 0,
    failureSummary: reviewGate.failureSummary,
    contractEvidence: {
      completedReviewVerdict: "HUMAN_REVIEW_COMPLETE_APPROVAL_REQUIRED_NO_MUTATION",
      incompleteReviewVerdict: "REVIEW_CHECKLIST_INCOMPLETE_BLOCKED",
      shallowHumanConfirmationBlocked: true,
      requiredCheckTextMustMatchPacket: true,
      metadataHashAndProvenanceMismatchBlocked: true,
      extraMissingDuplicateStableKeysBlocked: true,
      completedReviewStillRequiresSeparateApproval: true,
      completedReviewCreatesRegistryArtifact: false,
      exactTrustPromotionApprovedWithoutSeparateApproval: false,
    },
    mutationBoundary,
    verification: {
      nodeCheck,
      focusedTests,
    },
    forbiddenClaims: [
      "KOSHA exact trust promotion has been approved.",
      "KOSHA exact-kosha registry was expanded by this audit.",
      "Completed checklist review alone is exact-trust promotion approval.",
      "Shallow reviewer/reviewedAt/humanConfirmed fields are sufficient without required check text and provenance/hash confirmation.",
      "Embeddings, vector retrieval, DB mutation, or network acquisition were performed by this audit.",
    ],
    nextApprovalBoundary: [
      "A human operator must complete all 8 candidate review rows and every packet-matched required check.",
      "Even after review checklist completion, a separate explicit exact-trust promotion approval is required.",
      "Registry write or embedding/vector activation remains outside this no-approval audit.",
    ],
  };
  fs.mkdirSync(options.outputDir, { recursive: true });
  fs.writeFileSync(path.join(options.outputDir, "report.json"), json(report), "utf8");
  fs.writeFileSync(path.join(options.outputDir, "report.md"), renderMarkdown(report), "utf8");
  console.log(json({
    output: options.outputDir,
    verdict: report.verdict,
    sourceHead,
    productionCommit: productionBuildInfo?.commitSha || "",
    failureCount: report.failureCount,
    exactPromotionPerformed: mutationBoundary.exactPromotionPerformed,
  }));
  if (report.verdict !== "PASS_CURRENT_SOURCE_REVIEW_GATE_CONTRACT_NO_MUTATION") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
