#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = "safeclaw-kosha-exact-promotion-review-gate/v1";
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const DEFAULT_PACKET_PATH = path.join("evaluation", "kosha-exact-promotion-packet-2026-07-22", "report.json");
const DEFAULT_OUTPUT_DIR = path.join("evaluation", "kosha-exact-promotion-review-gate-2026-07-22");

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
 * @param {unknown} value
 */
function asBoolean(value) {
  return value === true;
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
function resolveInsideRoot(rootDir, relativePath) {
  const resolved = path.resolve(rootDir, relativePath);
  const root = path.resolve(rootDir);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`path-outside-root:${relativePath}`);
  }
  return resolved;
}

/**
 * @param {string} absolutePath
 */
function readJson(absolutePath) {
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

/**
 * @param {unknown} packet
 */
function assertPacketShape(packet) {
  if (!isRecord(packet)) throw new Error("kosha-review-gate-invalid-packet");
  if (asString(packet.verdict) !== "EXACT_PROMOTION_PACKET_READY_FOR_OPERATOR_REVIEW") {
    throw new Error("kosha-review-gate-packet-not-ready");
  }
  if (packet.mutationPerformed !== false || packet.dbMutationPerformed !== false || packet.embeddingGenerationPerformed !== false) {
    throw new Error("kosha-review-gate-packet-mutating");
  }
  if (!Array.isArray(packet.candidates) || packet.candidates.length === 0) {
    throw new Error("kosha-review-gate-packet-missing-candidates");
  }
}

/**
 * @param {unknown} review
 */
function assertReviewShape(review) {
  if (!isRecord(review)) throw new Error("kosha-review-gate-invalid-review");
  if (asString(review.schemaVersion) !== "safeclaw-kosha-exact-promotion-review/v1") {
    throw new Error("kosha-review-gate-invalid-review-schema");
  }
  if (!Array.isArray(review.candidateReviews)) {
    throw new Error("kosha-review-gate-missing-candidate-reviews");
  }
}

/**
 * @param {Record<string, unknown>} candidate
 */
function candidateKey(candidate) {
  return asString(candidate.stableKey);
}

/**
 * @param {Record<string, unknown>} review
 */
function reviewKey(review) {
  return asString(review.stableKey);
}

/**
 * @param {Record<string, unknown>} review
 */
function requiredReviewChecks(review) {
  return Array.isArray(review.requiredReviewChecks) ? review.requiredReviewChecks.filter(isRecord) : [];
}

/**
 * @param {{
 *   rootDir: string;
 *   packetPath?: string;
 *   reviewPath: string;
 *   generatedAt?: string;
 * }} options
 */
export function buildKoshaExactPromotionReviewGate(options) {
  const rootDir = options.rootDir;
  const packetPath = options.packetPath || DEFAULT_PACKET_PATH;
  const packet = readJson(resolveInsideRoot(rootDir, packetPath));
  const review = readJson(resolveInsideRoot(rootDir, options.reviewPath));
  assertPacketShape(packet);
  assertReviewShape(review);

  const packetRecord = /** @type {Record<string, unknown>} */ (packet);
  const reviewRecord = /** @type {Record<string, unknown>} */ (review);
  const candidates = /** @type {Record<string, unknown>[]} */ (packetRecord.candidates);
  const candidateReviews = /** @type {Record<string, unknown>[]} */ (reviewRecord.candidateReviews);
  const reviewByStableKey = new Map(candidateReviews.map((row) => [reviewKey(row), row]));
  const failures = [];
  const passed = [];

  if (candidateReviews.length !== candidates.length) {
    failures.push(`candidate-review-count-mismatch:${candidateReviews.length}:${candidates.length}`);
  }

  for (const candidate of candidates) {
    const stableKey = candidateKey(candidate);
    const reviewRow = reviewByStableKey.get(stableKey);
    if (!reviewRow) {
      failures.push(`missing-review:${stableKey}`);
      continue;
    }
    const mismatches = [
      ["version", asString(candidate.version), asString(reviewRow.version)],
      ["officialFileId", asString(candidate.officialFileId), asString(reviewRow.officialFileId)],
      ["bodySha256", asString(candidate.bodySha256), asString(reviewRow.bodySha256)],
      ["pdfSha256", asString(candidate.pdfSha256), asString(reviewRow.pdfSha256)],
    ].filter(([, expected, actual]) => expected !== actual);
    for (const [field] of mismatches) failures.push(`review-metadata-mismatch:${stableKey}:${field}`);

    const requiredChecks = Array.isArray(candidate.requiredReviewChecks)
      ? candidate.requiredReviewChecks.map(asString).filter(Boolean)
      : [];
    const checkRows = requiredReviewChecks(reviewRow);
    const checkedByText = new Map(checkRows.map((row) => [asString(row.text), row]));
    for (const checkText of requiredChecks) {
      const checkRow = checkedByText.get(checkText);
      if (!checkRow) {
        failures.push(`missing-required-check:${stableKey}:${checkText}`);
      } else if (!asBoolean(checkRow.confirmed)) {
        failures.push(`unconfirmed-required-check:${stableKey}:${checkText}`);
      }
    }
    if (checkRows.length !== requiredChecks.length) {
      failures.push(`required-check-count-mismatch:${stableKey}:${checkRows.length}:${requiredChecks.length}`);
    }
    if (!asBoolean(reviewRow.humanConfirmed)) failures.push(`missing-human-confirmation:${stableKey}`);
    if (!asString(reviewRow.reviewer)) failures.push(`missing-reviewer:${stableKey}`);
    if (!asString(reviewRow.reviewedAt)) failures.push(`missing-reviewed-at:${stableKey}`);
    if (mismatches.length === 0 && requiredChecks.every((checkText) => asBoolean(checkedByText.get(checkText)?.confirmed)) && asBoolean(reviewRow.humanConfirmed) && asString(reviewRow.reviewer) && asString(reviewRow.reviewedAt)) {
      passed.push(stableKey);
    }
  }

  const reviewChecklistComplete = failures.length === 0 && passed.length === candidates.length;
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    sourceHead: gitHead(rootDir),
    packetPath,
    reviewPath: options.reviewPath,
    verdict: reviewChecklistComplete ? "REVIEW_CHECKLIST_COMPLETE_READY_FOR_SEPARATE_APPROVAL" : "REVIEW_CHECKLIST_INCOMPLETE_BLOCKED",
    mutationPerformed: false,
    dbMutationPerformed: false,
    embeddingGenerationPerformed: false,
    exactPromotionPerformed: false,
    providerDispatchLiveClaimed: false,
    candidateCount: candidates.length,
    reviewedCandidateCount: candidateReviews.length,
    passedCandidateCount: passed.length,
    reviewChecklistComplete,
    exactTrustPromotionBlockedUntilChecklistComplete: !reviewChecklistComplete,
    exactTrustPromotionStillRequiresSeparateApproval: true,
    passedStableKeys: passed,
    failures,
    forbiddenClaims: [
      "This review gate mutated the exact-kosha registry.",
      "KOSHA vector retrieval or embeddings are production-active because of this review gate.",
      "Operator checklist completion alone approves exact-trust promotion.",
    ],
  };
}

/**
 * @param {ReturnType<typeof buildKoshaExactPromotionReviewGate>} report
 */
function renderMarkdown(report) {
  const failures = report.failures.length > 0
    ? report.failures.map((failure) => `- ${failure}`).join("\n")
    : "- No review-gate failures.";
  return `# KOSHA Exact Promotion Review Gate

Generated at: ${report.generatedAt}

Verdict: \`${report.verdict}\`

Source HEAD: \`${report.sourceHead}\`

Packet: \`${report.packetPath}\`

Review input: \`${report.reviewPath}\`

Checklist complete: \`${report.reviewChecklistComplete}\`

Exact promotion performed: \`${report.exactPromotionPerformed}\`

Exact trust promotion still requires separate approval: \`${report.exactTrustPromotionStillRequiresSeparateApproval}\`

## Candidate Review Counts

- Packet candidates: ${report.candidateCount}
- Review rows: ${report.reviewedCandidateCount}
- Passed rows: ${report.passedCandidateCount}

## Failures

${failures}

## Forbidden Claims

${report.forbiddenClaims.map((claim) => `- ${claim}`).join("\n")}
`;
}

/**
 * @param {string[]} args
 */
function parseArgs(args) {
  /** @type {{ rootDir: string; packet: string; review: string; output: string; generatedAt: string }} */
  const parsed = {
    rootDir: REPO_ROOT,
    packet: DEFAULT_PACKET_PATH,
    review: "",
    output: DEFAULT_OUTPUT_DIR,
    generatedAt: "",
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1] || "";
    if (arg === "--root") {
      parsed.rootDir = path.resolve(next);
      index += 1;
    } else if (arg === "--packet") {
      parsed.packet = next;
      index += 1;
    } else if (arg === "--review") {
      parsed.review = next;
      index += 1;
    } else if (arg === "--output") {
      parsed.output = next;
      index += 1;
    } else if (arg === "--generated-at") {
      parsed.generatedAt = next;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!parsed.review) throw new Error("missing-required-argument:--review");
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = buildKoshaExactPromotionReviewGate({
    rootDir: args.rootDir,
    packetPath: args.packet,
    reviewPath: args.review,
    generatedAt: args.generatedAt || undefined,
  });
  const outputDir = resolveInsideRoot(args.rootDir, args.output);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outputDir, "report.md"), renderMarkdown(report), "utf8");
  console.log(JSON.stringify({ output: args.output, verdict: report.verdict, failureCount: report.failures.length }, null, 2));
  if (!report.reviewChecklistComplete) {
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  await main();
}
