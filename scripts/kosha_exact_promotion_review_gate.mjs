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
const DEFAULT_OFFICIAL_PDF_AUDIT_PATH = path.join("evaluation", "kosha-exact-official-pdf-audit-2026-07-25", "report.json");
const DEFAULT_OFFICIAL_LIFECYCLE_AUDIT_PATH = path.join("evaluation", "kosha-exact-official-lifecycle-audit-2026-07-25", "report.json");
const DEFAULT_REVIEWER_SUPPORT_PATH = path.join("evaluation", "kosha-exact-promotion-reviewer-support-2026-07-25", "report.json");
const DEFAULT_OUTPUT_DIR = path.join("evaluation", "kosha-exact-promotion-review-gate-2026-07-22");
const REVIEW_SCHEMA_VERSION = "safeclaw-kosha-exact-promotion-review/v1";
const REVIEW_COMPLETE_VERDICT = "HUMAN_REVIEW_COMPLETE_APPROVAL_REQUIRED_NO_MUTATION";
const REVIEW_INCOMPLETE_VERDICT = "REVIEW_CHECKLIST_INCOMPLETE_BLOCKED";

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
 * @param {string} value
 */
function isIsoTimestamp(value) {
  if (!value) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth && Number.isFinite(Date.parse(value));
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
 * @param {unknown} audit
 */
function assertOfficialPdfAuditShape(audit) {
  if (!isRecord(audit)) throw new Error("kosha-review-gate-invalid-official-pdf-audit");
  if (asString(audit.schemaVersion) !== "safeclaw-kosha-exact-official-pdf-audit/v1") {
    throw new Error("kosha-review-gate-invalid-official-pdf-audit-schema");
  }
  if (!Array.isArray(audit.results)) {
    throw new Error("kosha-review-gate-official-pdf-audit-missing-results");
  }
}

/**
 * @param {unknown} audit
 */
function assertOfficialLifecycleAuditShape(audit) {
  if (!isRecord(audit)) throw new Error("kosha-review-gate-invalid-official-lifecycle-audit");
  if (asString(audit.schemaVersion) !== "safeclaw-kosha-exact-official-lifecycle-audit/v1") {
    throw new Error("kosha-review-gate-invalid-official-lifecycle-audit-schema");
  }
  if (!Array.isArray(audit.results)) {
    throw new Error("kosha-review-gate-official-lifecycle-audit-missing-results");
  }
}

/**
 * @param {unknown} report
 */
function assertReviewerSupportShape(report) {
  if (!isRecord(report)) throw new Error("kosha-review-gate-invalid-reviewer-support");
  if (asString(report.schemaVersion) !== "safeclaw-kosha-exact-promotion-reviewer-support/v1") {
    throw new Error("kosha-review-gate-invalid-reviewer-support-schema");
  }
  if (!Array.isArray(report.results)) {
    throw new Error("kosha-review-gate-reviewer-support-missing-results");
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
 * @param {string[]} failures
 */
function summarizeFailures(failures) {
  const summary = {
    candidateReviewCountMismatch: 0,
    missingReviewRows: 0,
    unexpectedReviewRows: 0,
    duplicateReviewRows: 0,
    metadataMismatches: 0,
    missingRequiredChecks: 0,
    unconfirmedRequiredChecks: 0,
    unexpectedRequiredChecks: 0,
    requiredCheckCountMismatches: 0,
    missingHumanConfirmations: 0,
    missingReviewers: 0,
    missingReviewedAt: 0,
    invalidReviewedAt: 0,
    officialPdfAuditFailures: 0,
    officialLifecycleAuditFailures: 0,
    other: 0,
  };
  for (const failure of failures) {
    if (failure.startsWith("candidate-review-count-mismatch:")) summary.candidateReviewCountMismatch += 1;
    else if (failure.startsWith("missing-review:")) summary.missingReviewRows += 1;
    else if (failure.startsWith("unexpected-review:")) summary.unexpectedReviewRows += 1;
    else if (failure.startsWith("duplicate-review:")) summary.duplicateReviewRows += 1;
    else if (failure.startsWith("review-metadata-mismatch:")) summary.metadataMismatches += 1;
    else if (failure.startsWith("missing-required-check:")) summary.missingRequiredChecks += 1;
    else if (failure.startsWith("unconfirmed-required-check:")) summary.unconfirmedRequiredChecks += 1;
    else if (failure.startsWith("unexpected-required-check:")) summary.unexpectedRequiredChecks += 1;
    else if (failure.startsWith("required-check-count-mismatch:")) summary.requiredCheckCountMismatches += 1;
    else if (failure.startsWith("missing-human-confirmation:")) summary.missingHumanConfirmations += 1;
    else if (failure.startsWith("missing-reviewer:")) summary.missingReviewers += 1;
    else if (failure.startsWith("missing-reviewed-at:")) summary.missingReviewedAt += 1;
    else if (failure.startsWith("invalid-reviewed-at:")) summary.invalidReviewedAt += 1;
    else if (failure.startsWith("official-pdf-audit-")) summary.officialPdfAuditFailures += 1;
    else if (failure.startsWith("official-lifecycle-audit-")) summary.officialLifecycleAuditFailures += 1;
    else summary.other += 1;
  }
  return summary;
}

/**
 * @param {{
 *   rootDir: string;
 *   packetPath?: string;
 *   officialPdfAuditPath?: string;
 *   officialLifecycleAuditPath?: string;
 *   reviewerSupportPath?: string;
 *   reviewPath: string;
 *   generatedAt?: string;
 * }} options
 */
export function buildKoshaExactPromotionReviewGate(options) {
  const rootDir = options.rootDir;
  const packetPath = options.packetPath || DEFAULT_PACKET_PATH;
  const officialPdfAuditPath = options.officialPdfAuditPath || DEFAULT_OFFICIAL_PDF_AUDIT_PATH;
  const officialLifecycleAuditPath = options.officialLifecycleAuditPath || DEFAULT_OFFICIAL_LIFECYCLE_AUDIT_PATH;
  const reviewerSupportPath = options.reviewerSupportPath || DEFAULT_REVIEWER_SUPPORT_PATH;
  const packet = readJson(resolveInsideRoot(rootDir, packetPath));
  const officialPdfAudit = readJson(resolveInsideRoot(rootDir, officialPdfAuditPath));
  const officialLifecycleAudit = readJson(resolveInsideRoot(rootDir, officialLifecycleAuditPath));
  const reviewerSupport = readJson(resolveInsideRoot(rootDir, reviewerSupportPath));
  const review = readJson(resolveInsideRoot(rootDir, options.reviewPath));
  assertPacketShape(packet);
  assertOfficialPdfAuditShape(officialPdfAudit);
  assertOfficialLifecycleAuditShape(officialLifecycleAudit);
  assertReviewerSupportShape(reviewerSupport);
  assertReviewShape(review);

  const packetRecord = /** @type {Record<string, unknown>} */ (packet);
  const officialPdfAuditRecord = /** @type {Record<string, unknown>} */ (officialPdfAudit);
  const officialLifecycleAuditRecord = /** @type {Record<string, unknown>} */ (officialLifecycleAudit);
  const reviewerSupportRecord = /** @type {Record<string, unknown>} */ (reviewerSupport);
  const reviewRecord = /** @type {Record<string, unknown>} */ (review);
  const candidates = /** @type {Record<string, unknown>[]} */ (packetRecord.candidates);
  const officialPdfAuditRows = /** @type {Record<string, unknown>[]} */ (officialPdfAuditRecord.results);
  const officialLifecycleAuditRows = /** @type {Record<string, unknown>[]} */ (officialLifecycleAuditRecord.results);
  const reviewerSupportRows = /** @type {Record<string, unknown>[]} */ (reviewerSupportRecord.results);
  const candidateReviews = /** @type {Record<string, unknown>[]} */ (reviewRecord.candidateReviews);
  const reviewByStableKey = new Map(candidateReviews.map((row) => [reviewKey(row), row]));
  const officialPdfAuditByStableKey = new Map(officialPdfAuditRows.map((row) => [asString(row.stableKey), row]));
  const officialLifecycleAuditByStableKey = new Map(officialLifecycleAuditRows.map((row) => [asString(row.stableKey), row]));
  const reviewerSupportByStableKey = new Map(reviewerSupportRows.map((row) => [asString(row.stableKey), row]));
  const candidateKeySet = new Set(candidates.map(candidateKey).filter(Boolean));
  const failures = [];
  const passed = [];

  if (
    asString(officialPdfAuditRecord.verdict) !== "PASS_OFFICIAL_PDF_AUTHENTICITY_BODY_PAIR_REVIEW_STILL_REQUIRED" ||
    officialPdfAuditRecord.exactPromotionPerformed !== false ||
    officialPdfAuditRecord.separatePromotionApprovalRequired !== true
  ) {
    failures.push("official-pdf-audit-verdict-or-boundary-mismatch");
  }
  if (officialPdfAuditRows.length !== candidates.length) {
    failures.push(`official-pdf-audit-count-mismatch:${officialPdfAuditRows.length}:${candidates.length}`);
  }
  const lifecycleVerdict = asString(officialLifecycleAuditRecord.verdict);
  const lifecycleTitleVariantCount = typeof officialLifecycleAuditRecord.titleVariantFindingCount === "number"
    ? officialLifecycleAuditRecord.titleVariantFindingCount
    : -1;
  const lifecycleVerdictMatchesFindings =
    (lifecycleTitleVariantCount === 0 && lifecycleVerdict === "PASS_OFFICIAL_CURRENT_LIFECYCLE_MACHINE_SUPPORTED_HUMAN_REVIEW_REQUIRED") ||
    (lifecycleTitleVariantCount > 0 && lifecycleVerdict === "REVIEW_REQUIRED_OFFICIAL_CURRENT_LIFECYCLE_MACHINE_SUPPORTED_TITLE_VARIANTS_UNRESOLVED");
  if (
    !lifecycleVerdictMatchesFindings ||
    officialLifecycleAuditRecord.exactPromotionPerformed !== false ||
    officialLifecycleAuditRecord.separatePromotionApprovalRequired !== true ||
    !isRecord(officialLifecycleAuditRecord.reviewChecklistImpact) ||
    officialLifecycleAuditRecord.reviewChecklistImpact.operatorLifecycleCurrentStatusConfirmed !== false ||
    officialLifecycleAuditRecord.reviewChecklistImpact.humanConfirmationRecorded !== false ||
    officialLifecycleAuditRecord.reviewChecklistImpact.reviewChecklistComplete !== false
  ) {
    failures.push("official-lifecycle-audit-verdict-or-boundary-mismatch");
  }
  if (officialLifecycleAuditRows.length !== candidates.length) {
    failures.push(`official-lifecycle-audit-count-mismatch:${officialLifecycleAuditRows.length}:${candidates.length}`);
  }
  const reviewerSupportBoundary = isRecord(reviewerSupportRecord.reviewBoundary)
    ? reviewerSupportRecord.reviewBoundary
    : null;
  const reviewerSupportMutationBoundary = isRecord(reviewerSupportRecord.mutationBoundary)
    ? reviewerSupportRecord.mutationBoundary
    : null;
  if (
    asString(reviewerSupportRecord.verdict) !== "PASS_MACHINE_REVIEWER_SUPPORT_HUMAN_CONFIRMATION_REQUIRED" ||
    reviewerSupportRecord.machineSupportedCount !== candidates.length ||
    reviewerSupportRecord.failedCount !== 0 ||
    reviewerSupportRecord.semanticGroupCount !== candidates.length * 3 ||
    reviewerSupportRecord.failedSemanticGroupCount !== 0 ||
    reviewerSupportRecord.exactPromotionPerformed !== false ||
    reviewerSupportRecord.exactRegistryWriteArtifactCreated !== false ||
    reviewerSupportRecord.separatePromotionApprovalRequired !== true ||
    reviewerSupportBoundary === null ||
    reviewerSupportBoundary.humanReviewCompleted !== false ||
    reviewerSupportBoundary.reviewChecklistComplete !== false ||
    reviewerSupportBoundary.machineEvidenceReplacesHumanReview !== false ||
    reviewerSupportMutationBoundary === null ||
    reviewerSupportMutationBoundary.dbMutationPerformed !== false ||
    reviewerSupportMutationBoundary.providerDispatchCalled !== false ||
    reviewerSupportMutationBoundary.shareSessionCreated !== false ||
    reviewerSupportMutationBoundary.embeddingGenerated !== false ||
    reviewerSupportMutationBoundary.vectorUploadPerformed !== false ||
    reviewerSupportMutationBoundary.exactTrustRegistryMutationPerformed !== false
  ) {
    failures.push("reviewer-support-verdict-or-boundary-mismatch");
  }
  if (reviewerSupportRows.length !== candidates.length) {
    failures.push(`reviewer-support-count-mismatch:${reviewerSupportRows.length}:${candidates.length}`);
  }

  if (candidateReviews.length !== candidates.length) {
    failures.push(`candidate-review-count-mismatch:${candidateReviews.length}:${candidates.length}`);
  }

  const seenReviewKeys = new Set();
  for (const reviewRow of candidateReviews) {
    const stableKey = reviewKey(reviewRow);
    if (stableKey && seenReviewKeys.has(stableKey)) {
      failures.push(`duplicate-review:${stableKey}`);
    }
    if (stableKey) seenReviewKeys.add(stableKey);
    if (!stableKey || !candidateKeySet.has(stableKey)) {
      failures.push(`unexpected-review:${stableKey || "missing-stable-key"}`);
    }
  }

  for (const candidate of candidates) {
    const stableKey = candidateKey(candidate);
    const officialPdfAuditRow = officialPdfAuditByStableKey.get(stableKey);
    const officialLifecycleAuditRow = officialLifecycleAuditByStableKey.get(stableKey);
    const reviewerSupportRow = reviewerSupportByStableKey.get(stableKey);
    const reviewRow = reviewByStableKey.get(stableKey);
    let officialPdfAuditPass = true;
    let officialLifecycleAuditPass = true;
    let reviewerSupportPass = true;
    if (!officialPdfAuditRow) {
      failures.push(`official-pdf-audit-missing-row:${stableKey}`);
      officialPdfAuditPass = false;
    } else {
      const auditMismatches = [
        ["version", asString(candidate.version), asString(officialPdfAuditRow.version)],
        ["officialFileId", asString(candidate.officialFileId), asString(officialPdfAuditRow.officialFileId)],
        ["bodySha256", asString(candidate.bodySha256), asString(officialPdfAuditRow.bodySha256)],
        ["pdfSha256", asString(candidate.pdfSha256), asString(officialPdfAuditRow.pdfSha256)],
      ].filter(([, expected, actual]) => expected !== actual);
      for (const [field] of auditMismatches) {
        failures.push(`official-pdf-audit-metadata-mismatch:${stableKey}:${field}`);
      }
      if (officialPdfAuditRow.machineVerificationPassed !== true || auditMismatches.length > 0) {
        failures.push(`official-pdf-audit-candidate-not-verified:${stableKey}`);
        officialPdfAuditPass = false;
      }
      if (officialPdfAuditRow.humanLifecycleConfirmed !== false || officialPdfAuditRow.humanConfirmed !== false) {
        failures.push(`official-pdf-audit-human-boundary-mismatch:${stableKey}`);
        officialPdfAuditPass = false;
      }
    }
    if (!officialLifecycleAuditRow) {
      failures.push(`official-lifecycle-audit-missing-row:${stableKey}`);
      officialLifecycleAuditPass = false;
    } else {
      const lifecycleMismatches = [
        ["version", asString(candidate.version), asString(officialLifecycleAuditRow.packetVersion)],
        ["officialFileId", asString(candidate.officialFileId), asString(officialLifecycleAuditRow.currentOfficialFileId)],
        ["publishedAt", asString(candidate.publishedAt), asString(officialLifecycleAuditRow.currentPublishedAt)],
      ].filter(([, expected, actual]) => expected !== actual);
      for (const [field] of lifecycleMismatches) {
        failures.push(`official-lifecycle-audit-metadata-mismatch:${stableKey}:${field}`);
      }
      if (officialLifecycleAuditRow.machineLifecycleSupported !== true || lifecycleMismatches.length > 0) {
        failures.push(`official-lifecycle-audit-candidate-not-supported:${stableKey}`);
        officialLifecycleAuditPass = false;
      }
      if (
        officialLifecycleAuditRow.operatorLifecycleCurrentStatusConfirmed !== false ||
        officialLifecycleAuditRow.humanConfirmed !== false
      ) {
        failures.push(`official-lifecycle-audit-human-boundary-mismatch:${stableKey}`);
        officialLifecycleAuditPass = false;
      }
    }
    if (!reviewerSupportRow) {
      failures.push(`reviewer-support-missing-row:${stableKey}`);
      reviewerSupportPass = false;
    } else {
      const semanticGroups = Array.isArray(reviewerSupportRow.semanticGroups)
        ? reviewerSupportRow.semanticGroups.filter(isRecord)
        : [];
      const semanticGroupsPass = semanticGroups.length === 3
        && semanticGroups.every((group) => group.machineSupported === true && Boolean(asString(group.excerpt)));
      if (
        asString(reviewerSupportRow.version) !== asString(candidate.version) ||
        reviewerSupportRow.contentRationaleMachineSupported !== true ||
        !Array.isArray(reviewerSupportRow.failedSemanticGroups) ||
        reviewerSupportRow.failedSemanticGroups.length !== 0 ||
        !semanticGroupsPass ||
        reviewerSupportRow.humanReviewCompleted !== false ||
        reviewerSupportRow.humanConfirmed !== false
      ) {
        failures.push(`reviewer-support-candidate-not-supported:${stableKey}`);
        reviewerSupportPass = false;
      }
    }
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
    const requiredCheckSet = new Set(requiredChecks);
    for (const checkText of requiredChecks) {
      const checkRow = checkedByText.get(checkText);
      if (!checkRow) {
        failures.push(`missing-required-check:${stableKey}:${checkText}`);
      } else if (!asBoolean(checkRow.confirmed)) {
        failures.push(`unconfirmed-required-check:${stableKey}:${checkText}`);
      }
    }
    for (const checkRow of checkRows) {
      const checkText = asString(checkRow.text);
      if (!checkText || !requiredCheckSet.has(checkText)) {
        failures.push(`unexpected-required-check:${stableKey}:${checkText || "missing-text"}`);
      }
    }
    if (checkRows.length !== requiredChecks.length) {
      failures.push(`required-check-count-mismatch:${stableKey}:${checkRows.length}:${requiredChecks.length}`);
    }
    if (!asBoolean(reviewRow.humanConfirmed)) failures.push(`missing-human-confirmation:${stableKey}`);
    if (!asString(reviewRow.reviewer)) failures.push(`missing-reviewer:${stableKey}`);
    const reviewedAt = asString(reviewRow.reviewedAt);
    if (!reviewedAt) failures.push(`missing-reviewed-at:${stableKey}`);
    else if (!isIsoTimestamp(reviewedAt)) failures.push(`invalid-reviewed-at:${stableKey}`);
    if (officialPdfAuditPass && officialLifecycleAuditPass && reviewerSupportPass && mismatches.length === 0 && requiredChecks.every((checkText) => asBoolean(checkedByText.get(checkText)?.confirmed)) && asBoolean(reviewRow.humanConfirmed) && asString(reviewRow.reviewer) && isIsoTimestamp(reviewedAt)) {
      passed.push(stableKey);
    }
  }

  const reviewChecklistComplete = failures.length === 0 && passed.length === candidates.length;
  const failureSummary = summarizeFailures(failures);
  const packetCandidateSetMatchesReview =
    failureSummary.candidateReviewCountMismatch === 0 &&
    failureSummary.missingReviewRows === 0 &&
    failureSummary.unexpectedReviewRows === 0 &&
    failureSummary.duplicateReviewRows === 0;
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    sourceHead: gitHead(rootDir),
    packetPath,
    officialPdfAuditPath,
    officialLifecycleAuditPath,
    reviewerSupportPath,
    reviewPath: options.reviewPath,
    verdict: reviewChecklistComplete ? REVIEW_COMPLETE_VERDICT : REVIEW_INCOMPLETE_VERDICT,
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
    approvalRequiredBeforeExactPromotion: true,
    promotionApprovalInputProvided: false,
    reviewCompletionIsPromotionApproval: false,
    exactTrustPromotionApproved: false,
    exactRegistryWriteArtifactCreated: false,
    completedReviewCreatesRegistryArtifact: false,
    exactRegistryWriteArtifactPath: null,
    packetCandidateSetMatchesReview,
    officialPdfAuditMachineVerified:
      failureSummary.officialPdfAuditFailures === 0 &&
      officialPdfAuditRows.length === candidates.length,
    officialLifecycleAuditMachineSupported:
      failureSummary.officialLifecycleAuditFailures === 0 &&
      officialLifecycleAuditRows.length === candidates.length,
    officialLifecycleTitleVariantFindingCount: lifecycleTitleVariantCount,
    reviewerSupportMachineVerified:
      !failures.some((failure) => failure.startsWith("reviewer-support-")) &&
      reviewerSupportRows.length === candidates.length,
    reviewerSupportHumanReviewCompleted: reviewerSupportBoundary?.humanReviewCompleted === true,
    failureSummary,
    passedStableKeys: passed,
    failures,
    forbiddenClaims: [
      "This review gate mutated the exact-kosha registry.",
      "KOSHA vector retrieval or embeddings are production-active because of this review gate.",
      "Operator checklist completion alone approves exact-trust promotion.",
      "Completed human review alone writes an exact-kosha registry artifact.",
    ],
  };
}

/**
 * @param {{
 *   rootDir: string;
 *   packetPath?: string;
 *   generatedAt?: string;
 * }} options
 */
export function buildKoshaExactPromotionReviewTemplate(options) {
  const rootDir = options.rootDir;
  const packetPath = options.packetPath || DEFAULT_PACKET_PATH;
  const packet = readJson(resolveInsideRoot(rootDir, packetPath));
  assertPacketShape(packet);
  const packetRecord = /** @type {Record<string, unknown>} */ (packet);
  const candidates = /** @type {Record<string, unknown>[]} */ (packetRecord.candidates);
  return {
    schemaVersion: REVIEW_SCHEMA_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    sourceHead: gitHead(rootDir),
    packetPath,
    reviewTemplateOnly: true,
    exactPromotionPerformed: false,
    instructions: [
      "Fill reviewer and reviewedAt for each candidate.",
      "Confirm every requiredReviewChecks entry only after comparing official URL, file ID, version, body hash, PDF hash, lifecycle/current status, and immutable acquisition evidence.",
      "Set humanConfirmed true only after the full candidate review is complete.",
      "Run scripts/kosha_exact_promotion_review_gate.mjs with this filled review file before any separate exact-trust promotion approval.",
    ],
    candidateReviews: candidates.map((candidate) => ({
      order: typeof candidate.order === "number" && Number.isFinite(candidate.order) ? candidate.order : null,
      stableKey: asString(candidate.stableKey),
      version: asString(candidate.version),
      title: asString(candidate.title),
      category: asString(candidate.category),
      publishedAt: asString(candidate.publishedAt),
      officialFileId: asString(candidate.officialFileId),
      officialUrl: asString(candidate.officialUrl),
      bodySha256: asString(candidate.bodySha256),
      pdfSha256: asString(candidate.pdfSha256),
      normalizedCharCount: typeof candidate.normalizedCharCount === "number" && Number.isFinite(candidate.normalizedCharCount) ? candidate.normalizedCharCount : null,
      pageCount: typeof candidate.pageCount === "number" && Number.isFinite(candidate.pageCount) ? candidate.pageCount : null,
      rationale: asString(candidate.rationale),
      reviewer: "",
      reviewedAt: "",
      humanConfirmed: false,
      requiredReviewChecks: Array.isArray(candidate.requiredReviewChecks)
        ? candidate.requiredReviewChecks.map((text) => ({ text: asString(text), confirmed: false }))
        : [],
    })),
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

Official PDF audit: \`${report.officialPdfAuditPath}\`

Official lifecycle audit: \`${report.officialLifecycleAuditPath}\`

Reviewer support: \`${report.reviewerSupportPath}\`

Review input: \`${report.reviewPath}\`

Checklist complete: \`${report.reviewChecklistComplete}\`

Exact promotion performed: \`${report.exactPromotionPerformed}\`

Exact trust promotion still requires separate approval: \`${report.exactTrustPromotionStillRequiresSeparateApproval}\`

Review completion is promotion approval: \`${report.reviewCompletionIsPromotionApproval}\`

Promotion approval input provided: \`${report.promotionApprovalInputProvided}\`

Exact trust promotion approved: \`${report.exactTrustPromotionApproved}\`

Exact registry write artifact created: \`${report.exactRegistryWriteArtifactCreated}\`

Completed review creates registry artifact: \`${report.completedReviewCreatesRegistryArtifact}\`

## Candidate Review Counts

- Packet candidates: ${report.candidateCount}
- Review rows: ${report.reviewedCandidateCount}
- Passed rows: ${report.passedCandidateCount}
- Packet/review set matches: ${report.packetCandidateSetMatchesReview}

## Failure Summary

${Object.entries(report.failureSummary).map(([key, value]) => `- ${key}: ${value}`).join("\n")}

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
  /** @type {{ rootDir: string; packet: string; officialPdfAudit: string; officialLifecycleAudit: string; reviewerSupport: string; review: string; output: string; generatedAt: string; writeTemplate: boolean }} */
  const parsed = {
    rootDir: REPO_ROOT,
    packet: DEFAULT_PACKET_PATH,
    officialPdfAudit: DEFAULT_OFFICIAL_PDF_AUDIT_PATH,
    officialLifecycleAudit: DEFAULT_OFFICIAL_LIFECYCLE_AUDIT_PATH,
    reviewerSupport: DEFAULT_REVIEWER_SUPPORT_PATH,
    review: "",
    output: DEFAULT_OUTPUT_DIR,
    generatedAt: "",
    writeTemplate: false,
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
    } else if (arg === "--official-pdf-audit") {
      parsed.officialPdfAudit = next;
      index += 1;
    } else if (arg === "--official-lifecycle-audit") {
      parsed.officialLifecycleAudit = next;
      index += 1;
    } else if (arg === "--reviewer-support") {
      parsed.reviewerSupport = next;
      index += 1;
    } else if (arg === "--output") {
      parsed.output = next;
      index += 1;
    } else if (arg === "--generated-at") {
      parsed.generatedAt = next;
      index += 1;
    } else if (arg === "--write-template") {
      parsed.writeTemplate = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!parsed.review && !parsed.writeTemplate) throw new Error("missing-required-argument:--review");
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = resolveInsideRoot(args.rootDir, args.output);
  fs.mkdirSync(outputDir, { recursive: true });
  if (args.writeTemplate) {
    const template = buildKoshaExactPromotionReviewTemplate({
      rootDir: args.rootDir,
      packetPath: args.packet,
      generatedAt: args.generatedAt || undefined,
    });
    fs.writeFileSync(path.join(outputDir, "review-template.json"), `${JSON.stringify(template, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ output: args.output, template: "review-template.json", candidateCount: template.candidateReviews.length }, null, 2));
    return;
  }
  const report = buildKoshaExactPromotionReviewGate({
    rootDir: args.rootDir,
    packetPath: args.packet,
    officialPdfAuditPath: args.officialPdfAudit,
    officialLifecycleAuditPath: args.officialLifecycleAudit,
    reviewerSupportPath: args.reviewerSupport,
    reviewPath: args.review,
    generatedAt: args.generatedAt || undefined,
  });
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
