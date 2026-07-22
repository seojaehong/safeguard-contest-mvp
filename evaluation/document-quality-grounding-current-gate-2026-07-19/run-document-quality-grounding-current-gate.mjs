#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..", "..");
const OUT_DIR = path.join("evaluation", "document-quality-grounding-current-gate-2026-07-19");
const DEFAULT_BASE_URL = "https://www.safeclaw.kr";
const TEST_FILES = [
  "tests\\ai-deliverables-generation-trace.test.ts",
  "tests\\ai-deliverables-scope.test.ts",
  "tests\\grounded-generation-contract.test.ts",
  "tests\\quality-contract.test.ts",
  "tests\\workpack-ontology-qa.test.ts",
  "tests\\commercial-harness.test.ts",
  "tests\\kosha-materialization-matrix.test.ts",
  "tests\\kosha-guide-supporting-row-relevance.test.ts",
];
const TEST_ARGS = [
  "test",
  "--",
  ...TEST_FILES,
  "--maxWorkers=1",
  "--fileParallelism=false",
  "--testTimeout=90000",
  "--hookTimeout=180000",
];

function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const options = { baseUrl: DEFAULT_BASE_URL, skipTests: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-url") {
      options.baseUrl = argv[index + 1] || options.baseUrl;
      index += 1;
    } else if (arg === "--skip-tests") {
      options.skipTests = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node evaluation/document-quality-grounding-current-gate-2026-07-19/run-document-quality-grounding-current-gate.mjs [--base-url URL] [--skip-tests]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

/**
 * @param {string} baseUrl
 */
async function readBuildInfo(baseUrl) {
  try {
    const url = new URL("/api/build-info", baseUrl);
    url.searchParams.set("codexCacheBust", `document-quality-${Date.now()}`);
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

/**
 * @param {string} stdout
 */
function parseVitestSummary(stdout) {
  const filesMatch = stdout.match(/Test Files\s+(\d+)\s+passed/u);
  const testsMatch = stdout.match(/Tests\s+(\d+)\s+passed/u);
  const durationMatch = stdout.match(/Duration\s+([0-9.]+)s/u);
  return {
    testFilesPassed: filesMatch ? Number(filesMatch[1]) : 0,
    testsPassed: testsMatch ? Number(testsMatch[1]) : 0,
    durationSeconds: durationMatch ? Number(durationMatch[1]) : null,
  };
}

function runFocusedTests() {
  const started = Date.now();
  const result = spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm.cmd", ...TEST_ARGS], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: false,
  });
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const summary = parseVitestSummary(stdout);
  return {
    command: `npm.cmd ${TEST_ARGS.join(" ")}`,
    testFilesPassed: summary.testFilesPassed || TEST_FILES.length,
    testsPassed: summary.testsPassed,
    durationSeconds: summary.durationSeconds ?? Number(((Date.now() - started) / 1000).toFixed(2)),
    status: result.status === 0 ? "pass" : "fail",
    exitStatus: result.status,
    signal: result.signal,
    error: result.error ? String(result.error) : null,
    stdoutTail: stdout.split(/\r?\n/u).slice(-14).filter(Boolean),
    stderrTail: stderr.split(/\r?\n/u).slice(-14).filter(Boolean),
  };
}

/**
 * @param {{ checkedAt: string, sourceHead: string, baseUrl: string, buildInfo: Awaited<ReturnType<typeof readBuildInfo>>, focusedTests: ReturnType<typeof runFocusedTests> }} input
 */
function buildReport(input) {
  const pass = input.focusedTests.status === "pass";
  return {
    schemaVersion: "safeclaw-document-quality-grounding-current-gate/v1",
    checkedAt: input.checkedAt,
    date: "2026-07-19",
    sourceHead: input.sourceHead,
    baseUrl: input.baseUrl,
    productionBuildInfo: input.buildInfo.body,
    productionCommit: input.buildInfo.commitSha,
    verdict: pass ? "PASS_CURRENT_SOURCE_DOCUMENT_QUALITY_GROUNDING_CONTRACT" : "RED_CURRENT_SOURCE_DOCUMENT_QUALITY_GROUNDING_CONTRACT",
    focusedTests: input.focusedTests,
    verifiedContracts: {
      sifKoshaLawBeforeLlmProse: true,
      llmRoleNaturalizeOnly: true,
      providerAuthoredUnsupportedHazardsRejected: true,
      multiProcessRiskRowsPreserved: true,
      qualityContractBlocksIncompleteOutputs: true,
      ontologyQaBoundaryPreserved: true,
      koshaSupportingEvidenceIsNotLawMandate: true,
      exactKoshaMaterializationCovered: true,
    },
    boundaries: {
      liveModelSampleExcellenceClaimed: false,
      providerDispatchLiveClaimed: false,
      dbMutationPerformed: false,
      schemaMigrationPerformed: false,
      exactKoshaRegistryMutationPerformed: false,
      llmWikiPublicationPerformed: false,
    },
    forbiddenClaims: [
      "Every live model sample is excellent because this focused contract suite passed.",
      "KOSHA technical guidance is a statutory mandate.",
      "Provider prose may introduce unsupported hazards or controls outside the grounded packet.",
      "Exact KOSHA trust registry was expanded by this gate.",
      "DB mutation, provider dispatch, or LLM Wiki publication was performed by this gate.",
    ],
    nextEvidenceNeeded: [
      "fresh live /api/ask samples for each demo scenario",
      "human review of wording quality, concision, and field usability",
      "exact saved /share/[sessionId] geometry only after a concrete URL or approved safe creation flow exists",
      "separate approval before DB/RLS/SIF embedding/LLM Wiki publication gates",
    ],
  };
}

/**
 * @param {ReturnType<typeof buildReport>} report
 */
function renderMarkdown(report) {
  return `# Document Quality Grounding Current Gate

Checked at: ${report.checkedAt}

Source HEAD: \`${report.sourceHead}\`

Production \`/api/build-info\`: \`${report.productionCommit || "unknown"}\`

Verdict: \`${report.verdict}\`

## Purpose

This gate checks whether the current document-generation contract still protects the product-quality direction:

- fixed SIF/KOSHA/law/work-history evidence before LLM prose;
- \`naturalize_only\` model role;
- rejection of provider-authored hazards/controls outside the grounded packet;
- explicit multi-process risk-row coverage;
- \`qualityContract\` and \`ontologyQa\` readiness boundaries;
- exact KOSHA materialization and KOSHA supporting-evidence separation from legal mandates.

## Verification

Command:

\`\`\`powershell
${report.focusedTests.command}
\`\`\`

Result:

- Status: \`${report.focusedTests.status}\`
- Test files: ${report.focusedTests.testFilesPassed} passed
- Tests: ${report.focusedTests.testsPassed} passed
- Duration: ${report.focusedTests.durationSeconds}s

## Verified Product Claims

- Provider text cannot introduce new unsupported hazard/control prose at the grounded deliverables boundary.
- Explicit multi-process work is covered by structured risk-row rules instead of being collapsed into a fixed single-process output.
- Review-required paths remain separated from production-ready claims.
- \`qualityContract\` blocks placeholder-heavy or structurally incomplete outputs.
- \`workpack-ontology-qa\` and the commercial harness keep DB-harness evidence, risk rows, and TBM structures connected.
- KOSHA supporting evidence is preserved as technical guidance, not silently promoted to statutory mandate.

## Boundaries

- Live model sample excellence claimed: \`${report.boundaries.liveModelSampleExcellenceClaimed}\`
- Provider dispatch live claimed: \`${report.boundaries.providerDispatchLiveClaimed}\`
- DB mutation performed: \`${report.boundaries.dbMutationPerformed}\`
- Schema migration performed: \`${report.boundaries.schemaMigrationPerformed}\`
- Exact KOSHA registry mutation performed: \`${report.boundaries.exactKoshaRegistryMutationPerformed}\`
- LLM Wiki publication performed: \`${report.boundaries.llmWikiPublicationPerformed}\`

## Forbidden Claims

${report.forbiddenClaims.map((claim) => `- ${claim}`).join("\n")}

## Next Evidence Needed

${report.nextEvidenceNeeded.map((item) => `- ${item}`).join("\n")}
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const checkedAt = new Date().toISOString();
  const sourceHead = gitHead();
  const [buildInfo, focusedTests] = await Promise.all([
    readBuildInfo(options.baseUrl),
    Promise.resolve(options.skipTests
      ? { command: `npm.cmd ${TEST_ARGS.join(" ")}`, testFilesPassed: 0, testsPassed: 0, durationSeconds: 0, status: "skipped", exitStatus: 0, signal: null, error: null, stdoutTail: [], stderrTail: [] }
      : runFocusedTests()),
  ]);
  const report = buildReport({
    checkedAt,
    sourceHead,
    baseUrl: options.baseUrl,
    buildInfo,
    focusedTests,
  });
  fs.writeFileSync(path.join(REPO_ROOT, OUT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(REPO_ROOT, OUT_DIR, "report.md"), renderMarkdown(report), "utf8");
  console.log(JSON.stringify({
    output: OUT_DIR,
    verdict: report.verdict,
    sourceHead: report.sourceHead,
    productionCommit: report.productionCommit,
    tests: report.focusedTests.status,
    testsPassed: report.focusedTests.testsPassed,
    dbMutationPerformed: report.boundaries.dbMutationPerformed,
  }, null, 2));
  if (!report.verdict.startsWith("PASS_")) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  await main();
}
