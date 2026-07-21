#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = "safeclaw-northstar-approval-runway/v1";
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const DEFAULT_OUTPUT_DIR = path.join("evaluation", "northstar-approval-runway-2026-07-21");
const DEFAULT_OPEN_GATE_PATH = path.join("evaluation", "northstar-open-gates-current", "report.json");
const DEFAULT_BUILD_INFO_URL = "https://www.safeclaw.kr/api/build-info";

const APPROVAL_GATE_CONTRACTS = Object.freeze({
  provider_dispatch_persistence: Object.freeze({
    currentSafetyLock: "preview_only",
    approvalNeeded: Object.freeze([
      "approve persistent idempotency migration scope",
      "choose per-channel child table or canonical provider_result JSONB ledger",
      "add updated_at trigger or route-owned timestamp contract",
      "test reservation-before-provider-call, duplicate replay, and per-channel result retention",
    ]),
    forbiddenUntilApproved: Object.freeze([
      "real provider dispatch",
      "PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED=true",
      "channel-level exactly-once persistence claim",
    ]),
  }),
  supabase_rls_launch_isolation: Object.freeze({
    currentSafetyLock: "read_only_preflight",
    approvalNeeded: Object.freeze([
      "approve authoritative Supabase project and credential provenance",
      "run read-only live catalog capture",
      "run disposable tenant A/B negative matrix",
      "verify Storage object isolation and service-role route invariants",
    ]),
    forbiddenUntilApproved: Object.freeze([
      "RLS launch isolation proven",
      "production migration approved",
      "service-role routes safe because table RLS exists",
    ]),
  }),
  llm_wiki_publication: Object.freeze({
    currentSafetyLock: "candidate_unpublished",
    approvalNeeded: Object.freeze([
      "approve final DDL, RPC, grants, and append-only ledger",
      "approve graph pointer and publication threat model",
      "run isolated publication canary with atomicity, idempotency, rollback, and leak tests",
    ]),
    forbiddenUntilApproved: Object.freeze([
      "LLM Wiki publication available",
      "LLM Wiki publishes itself",
      "generated wiki candidates published without human confirmation and RPC evidence",
    ]),
  }),
  sif_embedding_runtime: Object.freeze({
    currentSafetyLock: "approval_held_no_vectors",
    corpusCount: 6032,
    batchCount: 61,
    approvalNeeded: Object.freeze([
      "approve SIF-only embedding migration",
      "approve embedding cost and upload",
      "run post-upload vector runtime verification",
      "keep SAFETY_REFERENCE_VECTOR_SEARCH disabled until upload is verified",
    ]),
    forbiddenUntilApproved: Object.freeze([
      "SIF vector retrieval production-active",
      "embedding/upload completed",
      "broader corpus exact-publishing or DB persistence claim",
    ]),
  }),
});

const APPROVAL_GATE_IDS = Object.freeze(Object.keys(APPROVAL_GATE_CONTRACTS));

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 */
function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {string} rootDir
 */
function gitHead(rootDir) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * @param {string} rootDir
 * @param {string} relativePath
 */
function readJson(rootDir, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
}

/**
 * @param {{ buildInfoFile: string, buildInfoUrl: string }} options
 */
async function readBuildInfo(options) {
  if (options.buildInfoFile) {
    return JSON.parse(fs.readFileSync(options.buildInfoFile, "utf8"));
  }
  const response = await fetch(options.buildInfoUrl);
  if (!response.ok) {
    throw new Error(`Failed to read build info: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ rootDir: string, outputDir: string, openGatePath: string, buildInfoFile: string, buildInfoUrl: string }} */
  const options = {
    rootDir: REPO_ROOT,
    outputDir: DEFAULT_OUTPUT_DIR,
    openGatePath: DEFAULT_OPEN_GATE_PATH,
    buildInfoFile: "",
    buildInfoUrl: DEFAULT_BUILD_INFO_URL,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--root" && next) {
      options.rootDir = next;
      index += 1;
    } else if (arg === "--output" && next) {
      options.outputDir = next;
      index += 1;
    } else if (arg === "--open-gate" && next) {
      options.openGatePath = next;
      index += 1;
    } else if (arg === "--build-info-file" && next) {
      options.buildInfoFile = path.resolve(options.rootDir, next);
      index += 1;
    } else if (arg === "--build-info-url" && next) {
      options.buildInfoUrl = next;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/northstar_approval_runway.mjs [--root DIR] [--output DIR] [--open-gate FILE] [--build-info-file FILE]");
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }
  return options;
}

/**
 * @param {{ rootDir: string, openGatePath: string, buildInfo: unknown, generatedAt?: string }} options
 */
export function buildNorthstarApprovalRunway(options) {
  const openGate = readJson(options.rootDir, options.openGatePath);
  if (!isRecord(openGate) || !Array.isArray(openGate.gates)) {
    throw new Error("North Star open gate report is missing gates.");
  }

  const gates = openGate.gates.filter(isRecord);
  const approvalGates = APPROVAL_GATE_IDS.map((id) => {
    const gate = gates.find((item) => item.id === id);
    if (!gate) {
      throw new Error(`Missing approval gate: ${id}`);
    }
    if (gate.state !== "approval_gated") {
      throw new Error(`Approval gate ${id} must remain approval_gated, got ${asString(gate.state) || "unknown"}.`);
    }
    const contract = APPROVAL_GATE_CONTRACTS[id];
    return {
      id,
      state: "approval_gated",
      evidencePath: asString(gate.evidencePath).replaceAll("\\", "/"),
      readyForOperatorReview: true,
      currentSafetyLock: contract.currentSafetyLock,
      ...(typeof contract.corpusCount === "number" ? { corpusCount: contract.corpusCount } : {}),
      ...(typeof contract.batchCount === "number" ? { batchCount: contract.batchCount } : {}),
      approvalNeeded: [...contract.approvalNeeded],
      forbiddenUntilApproved: [...contract.forbiddenUntilApproved],
    };
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    sourceHeadAtDraft: gitHead(options.rootDir),
    liveCommitAtDraft: isRecord(options.buildInfo) ? asString(options.buildInfo.commitSha) : "",
    overall: "approval_runway_ready_open",
    launchReadiness: false,
    dbMutationPerformed: false,
    providerMessageSent: false,
    embeddingGenerated: false,
    uploaded: false,
    routeSplitAloneAcceptedAsUxFix: false,
    approvalGates,
    operatorSequence: [
      "Confirm target production/staging project and secret-free evidence boundaries.",
      "Approve or reject RLS live catalog and tenant A/B read-only probes.",
      "Approve or reject LLM Wiki isolated publication canary.",
      "Approve or reject SIF embedding migration, cost, and upload as a separate gate.",
      "Approve or reject provider dispatch persistence migration and route-level replay tests.",
      "Only after each gate has post-approval evidence, regenerate northstar-open-gates-current and northstar-live-rollup.",
    ],
    nonApprovalWorkStillAllowed: [
      "UI/UX cockpit and drilldown refinements",
      "KOSHA exact-trust evidence refreshes without DB writes",
      "read-only live geometry probes",
      "approval packet validation and report hygiene",
    ],
    completionBoundary: "North Star remains open until approval-gated runtime/database/provider/vector publication checks are approved and verified. This runway is a launch-control artifact, not a launch-complete claim.",
  };
}

/**
 * @param {ReturnType<typeof buildNorthstarApprovalRunway>} report
 */
export function renderNorthstarApprovalRunwayMarkdown(report) {
  const rows = report.approvalGates.map((gate) => (
    `| \`${gate.id}\` | \`${gate.state}\` | \`${gate.evidencePath}\` | \`${gate.currentSafetyLock}\` | ${gate.approvalNeeded.join("; ")} |`
  ));
  const forbidden = report.approvalGates.flatMap((gate) => (
    gate.forbiddenUntilApproved.map((claim) => `- ${claim}`)
  ));
  return `# SafeClaw North Star Approval Runway

Generated at: ${report.generatedAt}

Source HEAD at draft: \`${report.sourceHeadAtDraft}\`

Live commit at draft: \`${report.liveCommitAtDraft}\`

Overall: \`${report.overall}\`

## Purpose

This artifact separates launch-control approval work from ordinary UI/evidence iteration.

The current North Star is not complete. The UI, KOSHA exact-trust, live harness, dispatch cockpit, and generated share result fixture gates have proof, but four runtime/provider/database publication surfaces still require explicit operator approval before any live claim.

No DB migration, DB mutation, embedding generation, upload, provider send, or live dispatch unlock was performed for this runway.

## Approval Gates

| Gate | State | Evidence | Current Lock | Approval Needed |
| --- | --- | --- | --- | --- |
${rows.join("\n")}

## Forbidden Until Approved

${forbidden.join("\n")}

## Operator Sequence

${report.operatorSequence.map((item, index) => `${index + 1}. ${item}`).join("\n")}

## Still Safe Without Approval

${report.nonApprovalWorkStillAllowed.map((item) => `- ${item}.`).join("\n")}

## Boundary

Route/page split alone is not accepted as the UX fix. The durable UI structure remains first-viewport cockpit plus bounded drilldown/detail containment.

This runway is not a launch-complete claim. It is the current approval map for the remaining runtime/database/provider/vector publication gates.
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const buildInfo = await readBuildInfo(options);
  const report = buildNorthstarApprovalRunway({
    rootDir: options.rootDir,
    openGatePath: options.openGatePath,
    buildInfo,
  });
  const outputDir = path.isAbsolute(options.outputDir)
    ? options.outputDir
    : path.join(options.rootDir, options.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outputDir, "report.md"), renderNorthstarApprovalRunwayMarkdown(report), "utf8");
  console.log(JSON.stringify({
    overall: report.overall,
    output: path.relative(options.rootDir, outputDir),
    sourceHeadAtDraft: report.sourceHeadAtDraft,
    liveCommitAtDraft: report.liveCommitAtDraft,
    gateCount: report.approvalGates.length,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
