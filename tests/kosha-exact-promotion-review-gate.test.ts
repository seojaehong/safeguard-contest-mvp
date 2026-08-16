import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

type Candidate = {
  order: number;
  stableKey: string;
  version: string;
  title: string;
  officialCurrentTitle: string;
  sourceTitle: string;
  category: string;
  publishedAt: string;
  officialFileId: string;
  officialUrl: string;
  bodySha256: string;
  pdfSha256: string;
  normalizedCharCount: number;
  pageCount: number;
  rationale: string;
  requiredReviewChecks: string[];
};

type ReviewGateReport = {
  verdict: string;
  mutationPerformed: boolean;
  dbMutationPerformed: boolean;
  embeddingGenerationPerformed: boolean;
  exactPromotionPerformed: boolean;
  providerDispatchLiveClaimed: boolean;
  candidateCount: number;
  reviewedCandidateCount: number;
  passedCandidateCount: number;
  reviewChecklistComplete: boolean;
  exactTrustPromotionBlockedUntilChecklistComplete: boolean;
  exactTrustPromotionStillRequiresSeparateApproval: boolean;
  approvalRequiredBeforeExactPromotion: boolean;
  promotionApprovalInputProvided: boolean;
  reviewCompletionIsPromotionApproval: boolean;
  exactTrustPromotionApproved: boolean;
  exactRegistryWriteArtifactCreated: boolean;
  completedReviewCreatesRegistryArtifact: boolean;
  exactRegistryWriteArtifactPath: string | null;
  packetCandidateSetMatchesReview: boolean;
  officialPdfAuditMachineVerified: boolean;
  officialLifecycleAuditMachineSupported: boolean;
  officialLifecycleTitleVariantFindingCount: number;
  reviewerSupportMachineVerified: boolean;
  reviewerSupportHumanReviewCompleted: boolean;
  failureSummary: {
    candidateReviewCountMismatch: number;
    missingReviewRows: number;
    unexpectedReviewRows: number;
    duplicateReviewRows: number;
    metadataMismatches: number;
    missingRequiredChecks: number;
    unconfirmedRequiredChecks: number;
    unexpectedRequiredChecks: number;
    requiredCheckCountMismatches: number;
    missingHumanConfirmations: number;
    missingReviewers: number;
    missingReviewedAt: number;
    invalidReviewedAt: number;
    officialPdfAuditFailures: number;
    officialLifecycleAuditFailures: number;
    other: number;
  };
  failures: string[];
  forbiddenClaims: string[];
};

type ReviewGateModule = {
  buildKoshaExactPromotionReviewGate: (options: {
    rootDir: string;
    packetPath?: string;
    officialPdfAuditPath?: string;
    officialLifecycleAuditPath?: string;
    reviewerSupportPath?: string;
    reviewPath: string;
    generatedAt?: string;
  }) => ReviewGateReport;
  buildKoshaExactPromotionReviewTemplate: (options: {
    rootDir: string;
    packetPath?: string;
    reviewerSupportPath?: string;
    generatedAt?: string;
  }) => {
    schemaVersion: string;
    reviewTemplateOnly: boolean;
    exactPromotionPerformed: boolean;
    machineReviewerSupportIncluded: boolean;
    machineEvidenceReplacesHumanReview: boolean;
    bodySnapshotId: string;
    bodySourceIdentitySha256: string;
    candidateReviews: Array<{
      order: number | null;
      stableKey: string;
      title: string;
      officialCurrentTitle: string;
      sourceTitle: string;
      titleReconciled: boolean;
      category: string;
      publishedAt: string;
      officialUrl: string;
      normalizedCharCount: number | null;
      pageCount: number | null;
      rationale: string;
      machineReviewerSupport: {
        machineEvidenceOnly: boolean;
        humanConfirmationRequired: boolean;
        contentRationaleMachineSupported: boolean;
        semanticGroups: Array<{
          group: number | null;
          requiredAny: string[];
          matchedTerms: string[];
          evidenceTerm: string;
          excerpt: string;
          matchBodyCharStart: number;
          matchBodyCharEnd: number;
          locationMappingComplete: boolean;
          locationMappingFailure: string | null;
          pageReceipts: Array<{
            pageNumber: number;
            bodyCharStart: number;
            bodyCharEnd: number;
            matchCharStart: number;
            matchCharEnd: number;
            normalizedTextSha256: string;
            ocrCandidate: boolean;
            extractionStatus: string;
          }>;
        }>;
      };
      reviewer: string;
      reviewedAt: string;
      humanConfirmed: boolean;
      requiredReviewChecks: Array<{ text: string; confirmed: boolean }>;
    }>;
  };
};

async function loadReviewGateModule(): Promise<ReviewGateModule> {
  const sourcePath = path.resolve("scripts", "kosha_exact_promotion_review_gate.mjs");
  const temporaryPath = path.join(
    os.tmpdir(),
    `kosha-review-gate-module-${process.pid}-${Date.now()}.mjs`,
  );
  fs.writeFileSync(
    temporaryPath,
    fs.readFileSync(sourcePath, "utf8").replaceAll("\r\n", "\n"),
    "utf8",
  );
  try {
    return await import(`${pathToFileURL(temporaryPath).href}?v=${Date.now()}`) as ReviewGateModule;
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function writeJson(root: string, relativePath: string, value: unknown): void {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function candidate(stableKey: string, index: number): Candidate {
  const version = `${stableKey}-2026`;
  const officialCurrentTitle = `${stableKey} official current title`;
  const title = `${version} ${officialCurrentTitle}`;
  return {
    order: index,
    stableKey,
    version,
    title,
    officialCurrentTitle,
    sourceTitle: index === 1 ? `${title} corpus source` : title,
    category: "KOSHA Guide",
    publishedAt: "2026-01-01",
    officialFileId: `FILE-${index}`,
    officialUrl: `https://kosha.example.test/${stableKey}.pdf`,
    bodySha256: `${index}`.repeat(64).slice(0, 64),
    pdfSha256: `${index + 1}`.repeat(64).slice(0, 64),
    normalizedCharCount: 1000 + index,
    pageCount: 20 + index,
    rationale: `Candidate ${stableKey} has stable official metadata and immutable hashes.`,
    requiredReviewChecks: [
      "official URL opens the expected KOSHA file for the selected stable key",
      "official file id, version, and publication date match metadata and body-corpus provenance",
      "body SHA-256 and PDF SHA-256 are rechecked against immutable acquisition evidence",
      "operator confirms lifecycle/current status and excludes stale superseded versions",
      "human confirmation is recorded before any exact-kosha registry JSON is created",
    ],
  };
}

function writeFixtureRoot(): { root: string; packetPath: string; reviewPath: string; candidates: Candidate[] } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kosha-review-gate-"));
  const candidates = [candidate("D-C-10", 1), candidate("A-G-15", 2)];
  const packetPath = "evaluation/kosha-exact-promotion-packet-2026-07-22/report.json";
  const reviewPath = "evaluation/kosha-exact-promotion-review-2026-07-22/review.json";
  writeJson(root, packetPath, {
    schemaVersion: "safeclaw-kosha-exact-promotion-packet/v1",
    verdict: "EXACT_PROMOTION_PACKET_READY_FOR_OPERATOR_REVIEW",
    mutationPerformed: false,
    dbMutationPerformed: false,
    embeddingGenerationPerformed: false,
    candidates,
  });
  writeJson(root, reviewPath, {
    schemaVersion: "safeclaw-kosha-exact-promotion-review/v1",
    candidateReviews: candidates.map((row) => ({
      stableKey: row.stableKey,
      version: row.version,
      officialCurrentTitle: row.officialCurrentTitle,
      sourceTitle: row.sourceTitle,
      officialFileId: row.officialFileId,
      bodySha256: row.bodySha256,
      pdfSha256: row.pdfSha256,
      reviewer: "operator@example.com",
      reviewedAt: "2026-07-22T00:00:00.000Z",
      humanConfirmed: true,
      requiredReviewChecks: row.requiredReviewChecks.map((text) => ({ text, confirmed: true })),
    })),
  });
  writeJson(root, "evaluation/kosha-exact-official-pdf-audit-2026-07-25/report.json", {
    schemaVersion: "safeclaw-kosha-exact-official-pdf-audit/v1",
    verdict: "PASS_OFFICIAL_PDF_AUTHENTICITY_BODY_PAIR_REVIEW_STILL_REQUIRED",
    exactPromotionPerformed: false,
    separatePromotionApprovalRequired: true,
    results: candidates.map((row) => ({
      stableKey: row.stableKey,
      version: row.version,
      officialFileId: row.officialFileId,
      bodySha256: row.bodySha256,
      pdfSha256: row.pdfSha256,
      machineVerificationPassed: true,
      humanLifecycleConfirmed: false,
      humanConfirmed: false,
    })),
  });
  writeJson(root, "evaluation/kosha-exact-official-lifecycle-audit-2026-07-25/report.json", {
    schemaVersion: "safeclaw-kosha-exact-official-lifecycle-audit/v1",
    verdict: "PASS_OFFICIAL_CURRENT_LIFECYCLE_MACHINE_SUPPORTED_HUMAN_REVIEW_REQUIRED",
    candidateCount: candidates.length,
    machineLifecycleSupportedCount: candidates.length,
    exactTitleIdentityMatchCount: candidates.length,
    failedCount: 0,
    titleVariantFindingCount: 0,
    exactPromotionPerformed: false,
    separatePromotionApprovalRequired: true,
    reviewChecklistImpact: {
      operatorLifecycleCurrentStatusConfirmed: false,
      humanConfirmationRecorded: false,
      reviewChecklistComplete: false,
    },
    results: candidates.map((row) => ({
      stableKey: row.stableKey,
      packetVersion: row.version,
      currentOfficialFileId: row.officialFileId,
      currentPublishedAt: row.publishedAt,
      officialTitleExactMatch: true,
      findings: [],
      machineLifecycleSupported: true,
      operatorLifecycleCurrentStatusConfirmed: false,
      humanConfirmed: false,
    })),
  });
  writeJson(root, "evaluation/kosha-exact-promotion-reviewer-support-2026-07-25/report.json", {
    schemaVersion: "safeclaw-kosha-exact-promotion-reviewer-support/v1",
    verdict: "PASS_MACHINE_REVIEWER_SUPPORT_HUMAN_CONFIRMATION_REQUIRED",
    candidateCount: candidates.length,
    machineSupportedCount: candidates.length,
    failedCount: 0,
    semanticGroupCount: candidates.length * 3,
    failedSemanticGroupCount: 0,
    pageReceiptCount: candidates.length * 3,
    semanticGroupsWithoutPageReceipt: 0,
    bodySnapshotId: "fixture-snapshot",
    bodySourceIdentitySha256: "c".repeat(64),
    reviewBoundary: {
      humanReviewCompleted: false,
      reviewChecklistComplete: false,
      machineEvidenceReplacesHumanReview: false,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      embeddingGenerated: false,
      vectorUploadPerformed: false,
      exactTrustRegistryMutationPerformed: false,
    },
    exactPromotionPerformed: false,
    exactRegistryWriteArtifactCreated: false,
    separatePromotionApprovalRequired: true,
    results: candidates.map((row) => ({
      stableKey: row.stableKey,
      version: row.version,
      semanticGroups: [1, 2, 3].map((group) => ({
        group,
        matchedTerms: [`term-${group}`],
        evidenceTerm: `term-${group}`,
        excerpt: `review context ${group}`,
        matchBodyCharStart: (group - 1) * 100 + 10,
        matchBodyCharEnd: (group - 1) * 100 + 20,
        locationMappingComplete: true,
        locationMappingFailure: null,
        pageReceipts: [{
          pageNumber: group,
          bodyCharStart: (group - 1) * 100,
          bodyCharEnd: group * 100,
          matchCharStart: (group - 1) * 100 + 10,
          matchCharEnd: (group - 1) * 100 + 20,
          normalizedTextSha256: "d".repeat(64),
          ocrCandidate: false,
          extractionStatus: "success",
        }],
        machineSupported: true,
      })),
      failedSemanticGroups: [],
      contentRationaleMachineSupported: true,
      humanReviewCompleted: false,
      humanConfirmed: false,
    })),
  });
  return { root, packetPath, reviewPath, candidates };
}

describe("KOSHA exact promotion review gate", () => {
  it("passes only a complete human review while still requiring separate approval", async () => {
    const { root, packetPath, reviewPath } = writeFixtureRoot();
    const module = await loadReviewGateModule();
    const report = module.buildKoshaExactPromotionReviewGate({
      rootDir: root,
      packetPath,
      reviewPath,
      generatedAt: "2026-07-22T00:00:00.000Z",
    });

    expect(report.verdict).toBe("HUMAN_REVIEW_COMPLETE_APPROVAL_REQUIRED_NO_MUTATION");
    expect(report.reviewChecklistComplete).toBe(true);
    expect(report.exactTrustPromotionBlockedUntilChecklistComplete).toBe(false);
    expect(report.exactTrustPromotionStillRequiresSeparateApproval).toBe(true);
    expect(report.approvalRequiredBeforeExactPromotion).toBe(true);
    expect(report.promotionApprovalInputProvided).toBe(false);
    expect(report.reviewCompletionIsPromotionApproval).toBe(false);
    expect(report.exactTrustPromotionApproved).toBe(false);
    expect(report.exactRegistryWriteArtifactCreated).toBe(false);
    expect(report.completedReviewCreatesRegistryArtifact).toBe(false);
    expect(report.exactRegistryWriteArtifactPath).toBeNull();
    expect(report.packetCandidateSetMatchesReview).toBe(true);
    expect(report.officialPdfAuditMachineVerified).toBe(true);
    expect(report.officialLifecycleAuditMachineSupported).toBe(true);
    expect(report.officialLifecycleTitleVariantFindingCount).toBe(0);
    expect(report.reviewerSupportMachineVerified).toBe(true);
    expect(report.reviewerSupportHumanReviewCompleted).toBe(false);
    expect(Object.values(report.failureSummary).every((value) => value === 0)).toBe(true);
    expect(report.candidateCount).toBe(2);
    expect(report.reviewedCandidateCount).toBe(2);
    expect(report.passedCandidateCount).toBe(2);
    expect(report.failures).toEqual([]);
    expect(report.mutationPerformed).toBe(false);
    expect(report.dbMutationPerformed).toBe(false);
    expect(report.embeddingGenerationPerformed).toBe(false);
    expect(report.exactPromotionPerformed).toBe(false);
    expect(report.providerDispatchLiveClaimed).toBe(false);
    expect(report.forbiddenClaims).toContain("Operator checklist completion alone approves exact-trust promotion.");
    expect(report.forbiddenClaims).toContain("Completed human review alone writes an exact-kosha registry artifact.");
  });

  it("fails closed when a required check is not confirmed", async () => {
    const { root, packetPath, reviewPath } = writeFixtureRoot();
    const review = JSON.parse(fs.readFileSync(path.join(root, reviewPath), "utf8")) as {
      candidateReviews: Array<{ requiredReviewChecks: Array<{ text: string; confirmed: boolean }> }>;
    };
    review.candidateReviews[0].requiredReviewChecks[2].confirmed = false;
    writeJson(root, reviewPath, review);
    const module = await loadReviewGateModule();
    const report = module.buildKoshaExactPromotionReviewGate({ rootDir: root, packetPath, reviewPath });

    expect(report.verdict).toBe("REVIEW_CHECKLIST_INCOMPLETE_BLOCKED");
    expect(report.reviewChecklistComplete).toBe(false);
    expect(report.exactTrustPromotionBlockedUntilChecklistComplete).toBe(true);
    expect(report.failures.some((failure) => failure.startsWith("unconfirmed-required-check:D-C-10"))).toBe(true);
    expect(report.failureSummary.unconfirmedRequiredChecks).toBe(1);
    expect(report.exactPromotionPerformed).toBe(false);
  });

  it("fails closed when the official PDF companion audit hash does not match the packet", async () => {
    const { root, packetPath, reviewPath } = writeFixtureRoot();
    const auditPath = path.join(root, "evaluation/kosha-exact-official-pdf-audit-2026-07-25/report.json");
    const officialPdfAudit = JSON.parse(fs.readFileSync(auditPath, "utf8")) as {
      results: Array<{ stableKey: string; pdfSha256: string }>;
    };
    const target = officialPdfAudit.results.find((row) => row.stableKey === "D-C-10");
    if (!target) throw new Error("fixture-missing-d-c-10-audit");
    target.pdfSha256 = "0".repeat(64);
    writeJson(root, "evaluation/kosha-exact-official-pdf-audit-2026-07-25/report.json", officialPdfAudit);

    const module = await loadReviewGateModule();
    const report = module.buildKoshaExactPromotionReviewGate({ rootDir: root, packetPath, reviewPath });

    expect(report.verdict).toBe("REVIEW_CHECKLIST_INCOMPLETE_BLOCKED");
    expect(report.reviewChecklistComplete).toBe(false);
    expect(report.officialPdfAuditMachineVerified).toBe(false);
    expect(report.failures).toContain("official-pdf-audit-metadata-mismatch:D-C-10:pdfSha256");
    expect(report.failures).toContain("official-pdf-audit-candidate-not-verified:D-C-10");
    expect(report.failureSummary.officialPdfAuditFailures).toBe(2);
    expect(report.exactPromotionPerformed).toBe(false);
  });

  it("fails closed when the official lifecycle companion audit claims a competing version", async () => {
    const { root, packetPath, reviewPath } = writeFixtureRoot();
    const auditPath = path.join(root, "evaluation/kosha-exact-official-lifecycle-audit-2026-07-25/report.json");
    const audit = JSON.parse(fs.readFileSync(auditPath, "utf8")) as {
      results: Array<{ stableKey: string; machineLifecycleSupported: boolean }>;
    };
    const target = audit.results.find((row) => row.stableKey === "D-C-10");
    if (!target) throw new Error("fixture-missing-d-c-10-lifecycle-audit");
    target.machineLifecycleSupported = false;
    writeJson(root, path.relative(root, auditPath), audit);

    const module = await loadReviewGateModule();
    const report = module.buildKoshaExactPromotionReviewGate({ rootDir: root, packetPath, reviewPath });

    expect(report.verdict).toBe("REVIEW_CHECKLIST_INCOMPLETE_BLOCKED");
    expect(report.officialLifecycleAuditMachineSupported).toBe(false);
    expect(report.failures).toContain("official-lifecycle-audit-candidate-not-supported:D-C-10");
    expect(report.failureSummary.officialLifecycleAuditFailures).toBe(1);
    expect(report.exactRegistryWriteArtifactCreated).toBe(false);
  });

  it("fails closed when reviewer support omits a bounded excerpt", async () => {
    const { root, packetPath, reviewPath } = writeFixtureRoot();
    const supportPath = path.join(root, "evaluation/kosha-exact-promotion-reviewer-support-2026-07-25/report.json");
    const support = JSON.parse(fs.readFileSync(supportPath, "utf8")) as {
      results: Array<{ stableKey: string; semanticGroups: Array<{ excerpt: string }> }>;
    };
    const target = support.results.find((row) => row.stableKey === "D-C-10");
    if (!target) throw new Error("fixture-missing-d-c-10-reviewer-support");
    target.semanticGroups[0].excerpt = "";
    writeJson(root, path.relative(root, supportPath), support);

    const module = await loadReviewGateModule();
    const report = module.buildKoshaExactPromotionReviewGate({ rootDir: root, packetPath, reviewPath });

    expect(report.verdict).toBe("REVIEW_CHECKLIST_INCOMPLETE_BLOCKED");
    expect(report.reviewerSupportMachineVerified).toBe(false);
    expect(report.failures).toContain("reviewer-support-candidate-not-supported:D-C-10");
    expect(report.exactPromotionPerformed).toBe(false);
    expect(() => module.buildKoshaExactPromotionReviewTemplate({ rootDir: root, packetPath })).toThrow(
      "kosha-review-template-reviewer-support-candidate-not-ready:D-C-10",
    );
  });

  it("fails closed when reviewer support omits a page receipt", async () => {
    const { root, packetPath, reviewPath } = writeFixtureRoot();
    const supportPath = path.join(root, "evaluation/kosha-exact-promotion-reviewer-support-2026-07-25/report.json");
    const support = JSON.parse(fs.readFileSync(supportPath, "utf8")) as {
      results: Array<{ stableKey: string; semanticGroups: Array<{ pageReceipts: unknown[] }> }>;
    };
    const target = support.results.find((row) => row.stableKey === "D-C-10");
    if (!target) throw new Error("fixture-missing-d-c-10-reviewer-support");
    target.semanticGroups[0].pageReceipts = [];
    writeJson(root, path.relative(root, supportPath), support);

    const module = await loadReviewGateModule();
    const report = module.buildKoshaExactPromotionReviewGate({ rootDir: root, packetPath, reviewPath });

    expect(report.verdict).toBe("REVIEW_CHECKLIST_INCOMPLETE_BLOCKED");
    expect(report.reviewerSupportMachineVerified).toBe(false);
    expect(report.failures).toContain("reviewer-support-candidate-not-supported:D-C-10");
    expect(() => module.buildKoshaExactPromotionReviewTemplate({ rootDir: root, packetPath })).toThrow(
      "kosha-review-template-reviewer-support-candidate-not-ready:D-C-10",
    );
  });

  it("fails closed when page receipts exist but location mapping is incomplete", async () => {
    const { root, packetPath, reviewPath } = writeFixtureRoot();
    const supportPath = path.join(root, "evaluation/kosha-exact-promotion-reviewer-support-2026-07-25/report.json");
    const support = JSON.parse(fs.readFileSync(supportPath, "utf8")) as {
      results: Array<{
        stableKey: string;
        semanticGroups: Array<{ locationMappingComplete: boolean; locationMappingFailure: string | null }>;
      }>;
    };
    const target = support.results.find((row) => row.stableKey === "D-C-10");
    if (!target) throw new Error("fixture-missing-d-c-10-reviewer-support");
    target.semanticGroups[0].locationMappingComplete = false;
    target.semanticGroups[0].locationMappingFailure = "semantic-match-non-whitespace-gap";
    writeJson(root, path.relative(root, supportPath), support);

    const module = await loadReviewGateModule();
    const report = module.buildKoshaExactPromotionReviewGate({ rootDir: root, packetPath, reviewPath });

    expect(report.verdict).toBe("REVIEW_CHECKLIST_INCOMPLETE_BLOCKED");
    expect(report.reviewerSupportMachineVerified).toBe(false);
    expect(report.failures).toContain("reviewer-support-candidate-not-supported:D-C-10");
    expect(() => module.buildKoshaExactPromotionReviewTemplate({ rootDir: root, packetPath })).toThrow(
      "kosha-review-template-reviewer-support-candidate-not-ready:D-C-10",
    );
  });

  it("fails closed when a review only fills shallow human confirmation fields", async () => {
    const { root, packetPath, reviewPath } = writeFixtureRoot();
    const review = JSON.parse(fs.readFileSync(path.join(root, reviewPath), "utf8")) as {
      candidateReviews: Array<{ requiredReviewChecks?: Array<{ text: string; confirmed: boolean }> }>;
    };
    for (const row of review.candidateReviews) {
      delete row.requiredReviewChecks;
    }
    writeJson(root, reviewPath, review);
    const module = await loadReviewGateModule();
    const report = module.buildKoshaExactPromotionReviewGate({ rootDir: root, packetPath, reviewPath });

    expect(report.verdict).toBe("REVIEW_CHECKLIST_INCOMPLETE_BLOCKED");
    expect(report.reviewChecklistComplete).toBe(false);
    expect(report.exactTrustPromotionBlockedUntilChecklistComplete).toBe(true);
    expect(report.failureSummary.missingRequiredChecks).toBe(10);
    expect(report.failureSummary.requiredCheckCountMismatches).toBe(2);
    expect(report.failureSummary.missingHumanConfirmations).toBe(0);
    expect(report.failureSummary.missingReviewers).toBe(0);
    expect(report.failureSummary.missingReviewedAt).toBe(0);
    expect(report.failures).toContain("missing-required-check:D-C-10:official URL opens the expected KOSHA file for the selected stable key");
    expect(report.exactPromotionPerformed).toBe(false);
    expect(report.exactTrustPromotionApproved).toBe(false);
    expect(report.exactRegistryWriteArtifactCreated).toBe(false);
  });

  it("fails closed when review metadata does not match the packet", async () => {
    const { root, packetPath, reviewPath } = writeFixtureRoot();
    const review = JSON.parse(fs.readFileSync(path.join(root, reviewPath), "utf8")) as {
      candidateReviews: Array<{ stableKey: string; bodySha256: string }>;
    };
    const target = review.candidateReviews.find((row) => row.stableKey === "A-G-15");
    if (!target) throw new Error("fixture-missing-a-g-15");
    target.bodySha256 = "0".repeat(64);
    writeJson(root, reviewPath, review);
    const module = await loadReviewGateModule();
    const report = module.buildKoshaExactPromotionReviewGate({ rootDir: root, packetPath, reviewPath });

    expect(report.verdict).toBe("REVIEW_CHECKLIST_INCOMPLETE_BLOCKED");
    expect(report.failures).toContain("review-metadata-mismatch:A-G-15:bodySha256");
    expect(report.failureSummary.metadataMismatches).toBe(1);
    expect(report.exactPromotionPerformed).toBe(false);
  });

  it("fails closed when exported review title provenance does not match the packet", async () => {
    const { root, packetPath, reviewPath } = writeFixtureRoot();
    const review = JSON.parse(fs.readFileSync(path.join(root, reviewPath), "utf8")) as {
      candidateReviews: Array<{ stableKey: string; officialCurrentTitle: string; sourceTitle: string }>;
    };
    const target = review.candidateReviews.find((row) => row.stableKey === "D-C-10");
    if (!target) throw new Error("fixture-missing-d-c-10");
    target.officialCurrentTitle = "forged official title";
    target.sourceTitle = "forged corpus title";
    writeJson(root, reviewPath, review);

    const module = await loadReviewGateModule();
    const report = module.buildKoshaExactPromotionReviewGate({ rootDir: root, packetPath, reviewPath });

    expect(report.verdict).toBe("REVIEW_CHECKLIST_INCOMPLETE_BLOCKED");
    expect(report.failures).toContain("review-metadata-mismatch:D-C-10:officialCurrentTitle");
    expect(report.failures).toContain("review-metadata-mismatch:D-C-10:sourceTitle");
    expect(report.failureSummary.metadataMismatches).toBe(2);
    expect(report.exactPromotionPerformed).toBe(false);
  });

  it("fails closed when reviewedAt is not an ISO timestamp", async () => {
    const { root, packetPath, reviewPath } = writeFixtureRoot();
    const review = JSON.parse(fs.readFileSync(path.join(root, reviewPath), "utf8")) as {
      candidateReviews: Array<{ stableKey: string; reviewedAt: string }>;
    };
    const target = review.candidateReviews.find((row) => row.stableKey === "D-C-10");
    if (!target) throw new Error("fixture-missing-d-c-10");
    target.reviewedAt = "operator said it was reviewed";
    writeJson(root, reviewPath, review);
    const module = await loadReviewGateModule();
    const report = module.buildKoshaExactPromotionReviewGate({ rootDir: root, packetPath, reviewPath });

    expect(report.verdict).toBe("REVIEW_CHECKLIST_INCOMPLETE_BLOCKED");
    expect(report.reviewChecklistComplete).toBe(false);
    expect(report.passedCandidateCount).toBe(1);
    expect(report.failures).toContain("invalid-reviewed-at:D-C-10");
    expect(report.failureSummary.invalidReviewedAt).toBe(1);
    expect(report.exactPromotionPerformed).toBe(false);
    expect(report.exactRegistryWriteArtifactCreated).toBe(false);
  });

  it.each([
    ["calendar rollover", "2026-02-31T00:00:00.000Z"],
    ["missing timezone", "2026-07-22T00:00:00.000"],
  ])("fails closed when reviewedAt has %s", async (_label, reviewedAt) => {
    const { root, packetPath, reviewPath } = writeFixtureRoot();
    const review = JSON.parse(fs.readFileSync(path.join(root, reviewPath), "utf8")) as {
      candidateReviews: Array<{ stableKey: string; reviewedAt: string }>;
    };
    const target = review.candidateReviews.find((row) => row.stableKey === "D-C-10");
    if (!target) throw new Error("fixture-missing-d-c-10");
    target.reviewedAt = reviewedAt;
    writeJson(root, reviewPath, review);
    const module = await loadReviewGateModule();
    const report = module.buildKoshaExactPromotionReviewGate({ rootDir: root, packetPath, reviewPath });

    expect(report.verdict).toBe("REVIEW_CHECKLIST_INCOMPLETE_BLOCKED");
    expect(report.reviewChecklistComplete).toBe(false);
    expect(report.failures).toContain("invalid-reviewed-at:D-C-10");
    expect(report.failureSummary.invalidReviewedAt).toBe(1);
    expect(report.exactPromotionPerformed).toBe(false);
    expect(report.exactRegistryWriteArtifactCreated).toBe(false);
    expect(report.completedReviewCreatesRegistryArtifact).toBe(false);
  });

  it("fails closed when review input includes a row outside the packet candidate set", async () => {
    const { root, packetPath, reviewPath, candidates } = writeFixtureRoot();
    const review = JSON.parse(fs.readFileSync(path.join(root, reviewPath), "utf8")) as {
      candidateReviews: Array<Record<string, unknown>>;
    };
    review.candidateReviews.push({
      stableKey: "EXTRA-1",
      version: "EXTRA-1-2026",
      officialFileId: "FILE-EXTRA",
      bodySha256: "e".repeat(64),
      pdfSha256: "f".repeat(64),
      reviewer: "operator@example.com",
      reviewedAt: "2026-07-22T00:00:00.000Z",
      humanConfirmed: true,
      requiredReviewChecks: candidates[0].requiredReviewChecks.map((text) => ({ text, confirmed: true })),
    });
    writeJson(root, reviewPath, review);
    const module = await loadReviewGateModule();
    const report = module.buildKoshaExactPromotionReviewGate({ rootDir: root, packetPath, reviewPath });

    expect(report.verdict).toBe("REVIEW_CHECKLIST_INCOMPLETE_BLOCKED");
    expect(report.reviewChecklistComplete).toBe(false);
    expect(report.failures).toContain("candidate-review-count-mismatch:3:2");
    expect(report.failures).toContain("unexpected-review:EXTRA-1");
    expect(report.packetCandidateSetMatchesReview).toBe(false);
    expect(report.failureSummary.candidateReviewCountMismatch).toBe(1);
    expect(report.failureSummary.unexpectedReviewRows).toBe(1);
    expect(report.exactPromotionPerformed).toBe(false);
  });

  it("fails closed when the review omits a packet candidate and substitutes a mismatched stable key", async () => {
    const { root, packetPath, reviewPath, candidates } = writeFixtureRoot();
    const review = JSON.parse(fs.readFileSync(path.join(root, reviewPath), "utf8")) as {
      candidateReviews: Array<Record<string, unknown>>;
    };
    const replacement = {
      ...review.candidateReviews[1],
      stableKey: "D-C-11",
      version: "D-C-11-2026",
      officialFileId: "FILE-D-C-11",
      bodySha256: "d".repeat(64),
      pdfSha256: "c".repeat(64),
      requiredReviewChecks: candidates[1].requiredReviewChecks.map((text) => ({ text, confirmed: true })),
    };
    review.candidateReviews[1] = replacement;
    writeJson(root, reviewPath, review);
    const module = await loadReviewGateModule();
    const report = module.buildKoshaExactPromotionReviewGate({ rootDir: root, packetPath, reviewPath });

    expect(report.verdict).toBe("REVIEW_CHECKLIST_INCOMPLETE_BLOCKED");
    expect(report.reviewChecklistComplete).toBe(false);
    expect(report.packetCandidateSetMatchesReview).toBe(false);
    expect(report.failures).toContain("missing-review:A-G-15");
    expect(report.failures).toContain("unexpected-review:D-C-11");
    expect(report.failureSummary.missingReviewRows).toBe(1);
    expect(report.failureSummary.unexpectedReviewRows).toBe(1);
    expect(report.failureSummary.candidateReviewCountMismatch).toBe(0);
    expect(report.exactPromotionPerformed).toBe(false);
    expect(report.exactRegistryWriteArtifactCreated).toBe(false);
  });

  it("fails closed and identifies duplicate stable keys in review rows", async () => {
    const { root, packetPath, reviewPath } = writeFixtureRoot();
    const review = JSON.parse(fs.readFileSync(path.join(root, reviewPath), "utf8")) as {
      candidateReviews: Array<Record<string, unknown>>;
    };
    review.candidateReviews[1] = {
      ...review.candidateReviews[1],
      stableKey: "D-C-10",
    };
    writeJson(root, reviewPath, review);
    const module = await loadReviewGateModule();
    const report = module.buildKoshaExactPromotionReviewGate({ rootDir: root, packetPath, reviewPath });

    expect(report.verdict).toBe("REVIEW_CHECKLIST_INCOMPLETE_BLOCKED");
    expect(report.reviewChecklistComplete).toBe(false);
    expect(report.packetCandidateSetMatchesReview).toBe(false);
    expect(report.failures).toContain("duplicate-review:D-C-10");
    expect(report.failures).toContain("missing-review:A-G-15");
    expect(report.failureSummary.duplicateReviewRows).toBe(1);
    expect(report.failureSummary.missingReviewRows).toBe(1);
    expect(report.exactPromotionPerformed).toBe(false);
    expect(report.exactRegistryWriteArtifactCreated).toBe(false);
  });

  it("writes only review reports for a completed review and never creates exact registry artifacts", () => {
    const { root, packetPath, reviewPath } = writeFixtureRoot();

    execFileSync("node", [
      path.resolve("scripts", "kosha_exact_promotion_review_gate.mjs"),
      "--root",
      root,
      "--packet",
      packetPath,
      "--review",
      reviewPath,
      "--output",
      "evaluation/kosha-exact-promotion-review-gate-2026-07-22/complete",
      "--generated-at",
      "2026-07-22T00:00:00.000Z",
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

    const outputDir = path.join(root, "evaluation/kosha-exact-promotion-review-gate-2026-07-22/complete");
    const outputFiles = fs.readdirSync(outputDir).sort();
    const report = JSON.parse(fs.readFileSync(path.join(outputDir, "report.json"), "utf8")) as ReviewGateReport;
    expect(report.verdict).toBe("HUMAN_REVIEW_COMPLETE_APPROVAL_REQUIRED_NO_MUTATION");
    expect(report.reviewChecklistComplete).toBe(true);
    expect(report.exactPromotionPerformed).toBe(false);
    expect(report.approvalRequiredBeforeExactPromotion).toBe(true);
    expect(report.promotionApprovalInputProvided).toBe(false);
    expect(report.reviewCompletionIsPromotionApproval).toBe(false);
    expect(report.exactTrustPromotionApproved).toBe(false);
    expect(report.exactRegistryWriteArtifactCreated).toBe(false);
    expect(report.completedReviewCreatesRegistryArtifact).toBe(false);
    expect(report.exactRegistryWriteArtifactPath).toBeNull();
    expect(outputFiles).toEqual(["report.json", "report.md"]);
    expect(outputFiles.some((file) => /exact|registry|promotion/i.test(file) && file !== "report.json" && file !== "report.md")).toBe(false);
  });

  it("fails closed when required check text does not match the packet", async () => {
    const { root, packetPath, reviewPath } = writeFixtureRoot();
    const review = JSON.parse(fs.readFileSync(path.join(root, reviewPath), "utf8")) as {
      candidateReviews: Array<{ stableKey: string; requiredReviewChecks: Array<{ text: string; confirmed: boolean }> }>;
    };
    const target = review.candidateReviews.find((row) => row.stableKey === "D-C-10");
    if (!target) throw new Error("fixture-missing-d-c-10");
    target.requiredReviewChecks[0].text = "shallow reviewer confirmation only";
    writeJson(root, reviewPath, review);
    const module = await loadReviewGateModule();
    const report = module.buildKoshaExactPromotionReviewGate({ rootDir: root, packetPath, reviewPath });

    expect(report.verdict).toBe("REVIEW_CHECKLIST_INCOMPLETE_BLOCKED");
    expect(report.reviewChecklistComplete).toBe(false);
    expect(report.failures.some((failure) => failure.startsWith("missing-required-check:D-C-10:official URL opens"))).toBe(true);
    expect(report.failures).toContain("unexpected-required-check:D-C-10:shallow reviewer confirmation only");
    expect(report.failureSummary.missingRequiredChecks).toBe(1);
    expect(report.failureSummary.unexpectedRequiredChecks).toBe(1);
    expect(report.exactPromotionPerformed).toBe(false);
  });

  it("writes a blocking report and returns a non-zero exit code for incomplete review input", () => {
    const { root, packetPath, reviewPath } = writeFixtureRoot();
    const review = JSON.parse(fs.readFileSync(path.join(root, reviewPath), "utf8")) as {
      candidateReviews: Array<{ humanConfirmed: boolean }>;
    };
    review.candidateReviews[1].humanConfirmed = false;
    writeJson(root, reviewPath, review);

    let exitStatus = 0;
    try {
      execFileSync("node", [
        path.resolve("scripts", "kosha_exact_promotion_review_gate.mjs"),
        "--root",
        root,
        "--packet",
        packetPath,
        "--review",
        reviewPath,
        "--output",
        "evaluation/kosha-exact-promotion-review-gate-2026-07-22",
        "--generated-at",
        "2026-07-22T00:00:00.000Z",
      ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") {
        exitStatus = error.status;
      } else {
        throw error;
      }
    }

    const report = JSON.parse(fs.readFileSync(
      path.join(root, "evaluation/kosha-exact-promotion-review-gate-2026-07-22/report.json"),
      "utf8",
    )) as ReviewGateReport;
    const markdown = fs.readFileSync(
      path.join(root, "evaluation/kosha-exact-promotion-review-gate-2026-07-22/report.md"),
      "utf8",
    );
    expect(exitStatus).toBe(2);
    expect(report.verdict).toBe("REVIEW_CHECKLIST_INCOMPLETE_BLOCKED");
    expect(report.failures).toContain("missing-human-confirmation:A-G-15");
    expect(report.failureSummary.missingHumanConfirmations).toBe(1);
    expect(markdown).toContain("Exact trust promotion still requires separate approval: `true`");
    expect(markdown).toContain("Review completion is promotion approval: `false`");
    expect(markdown).toContain("Promotion approval input provided: `false`");
    expect(markdown).toContain("Exact registry write artifact created: `false`");
    expect(markdown).toContain("Completed review creates registry artifact: `false`");
    expect(markdown).toContain("- missingHumanConfirmations: 1");
    expect(markdown).toContain("missing-human-confirmation:A-G-15");
  });

  it("writes a review template that is blocked by default until an operator fills it", async () => {
    const { root, packetPath } = writeFixtureRoot();
    const module = await loadReviewGateModule();
    const template = module.buildKoshaExactPromotionReviewTemplate({
      rootDir: root,
      packetPath,
      generatedAt: "2026-07-22T00:00:00.000Z",
    });

    expect(template.schemaVersion).toBe("safeclaw-kosha-exact-promotion-review/v1");
    expect(template.reviewTemplateOnly).toBe(true);
    expect(template.exactPromotionPerformed).toBe(false);
    expect(template.machineReviewerSupportIncluded).toBe(true);
    expect(template.machineEvidenceReplacesHumanReview).toBe(false);
    expect(template.bodySnapshotId).toBe("fixture-snapshot");
    expect(template.bodySourceIdentitySha256).toBe("c".repeat(64));
    expect(template.candidateReviews).toHaveLength(2);
    expect(template.candidateReviews[0].order).toBe(1);
    expect(template.candidateReviews[0].title).toBe("D-C-10-2026 D-C-10 official current title");
    expect(template.candidateReviews[0].officialCurrentTitle).toBe("D-C-10 official current title");
    expect(template.candidateReviews[0].sourceTitle).toBe("D-C-10-2026 D-C-10 official current title corpus source");
    expect(template.candidateReviews[0].titleReconciled).toBe(true);
    expect(template.candidateReviews[1].titleReconciled).toBe(false);
    expect(template.candidateReviews[0].category).toBe("KOSHA Guide");
    expect(template.candidateReviews[0].publishedAt).toBe("2026-01-01");
    expect(template.candidateReviews[0].officialUrl).toBe("https://kosha.example.test/D-C-10.pdf");
    expect(template.candidateReviews[0].normalizedCharCount).toBe(1001);
    expect(template.candidateReviews[0].pageCount).toBe(21);
    expect(template.candidateReviews[0].rationale).toContain("stable official metadata");
    expect(template.candidateReviews[0].machineReviewerSupport.machineEvidenceOnly).toBe(true);
    expect(template.candidateReviews[0].machineReviewerSupport.humanConfirmationRequired).toBe(true);
    expect(template.candidateReviews[0].machineReviewerSupport.semanticGroups).toHaveLength(3);
    expect(template.candidateReviews[0].machineReviewerSupport.semanticGroups.every((group) => group.excerpt.length > 0)).toBe(true);
    expect(template.candidateReviews[0].machineReviewerSupport.semanticGroups.every((group) => group.locationMappingComplete)).toBe(true);
    expect(template.candidateReviews[0].machineReviewerSupport.semanticGroups.every((group) => group.locationMappingFailure === null)).toBe(true);
    expect(template.candidateReviews[0].machineReviewerSupport.semanticGroups.every((group) => group.pageReceipts.length === 1)).toBe(true);
    expect(template.candidateReviews.every((row) => row.reviewer === "")).toBe(true);
    expect(template.candidateReviews.every((row) => row.reviewedAt === "")).toBe(true);
    expect(template.candidateReviews.every((row) => row.humanConfirmed === false)).toBe(true);
    expect(template.candidateReviews.every((row) => row.requiredReviewChecks.length === 5)).toBe(true);
    expect(template.candidateReviews.every((row) => row.requiredReviewChecks.every((check) => check.confirmed === false))).toBe(true);

    execFileSync("node", [
      path.resolve("scripts", "kosha_exact_promotion_review_gate.mjs"),
      "--root",
      root,
      "--packet",
      packetPath,
      "--output",
      "evaluation/kosha-exact-promotion-review-gate-2026-07-22",
      "--generated-at",
      "2026-07-22T00:00:00.000Z",
      "--write-template",
    ], { encoding: "utf8" });

    const templatePath = path.join(root, "evaluation/kosha-exact-promotion-review-gate-2026-07-22/review-template.json");
    expect(fs.existsSync(templatePath)).toBe(true);
    let exitStatus = 0;
    try {
      execFileSync("node", [
        path.resolve("scripts", "kosha_exact_promotion_review_gate.mjs"),
        "--root",
        root,
        "--packet",
        packetPath,
        "--review",
        "evaluation/kosha-exact-promotion-review-gate-2026-07-22/review-template.json",
        "--output",
        "evaluation/kosha-exact-promotion-review-gate-2026-07-22/blocked",
      ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") {
        exitStatus = error.status;
      } else {
        throw error;
      }
    }
    const report = JSON.parse(fs.readFileSync(
      path.join(root, "evaluation/kosha-exact-promotion-review-gate-2026-07-22/blocked/report.json"),
      "utf8",
    )) as ReviewGateReport;
    expect(exitStatus).toBe(2);
    expect(report.verdict).toBe("REVIEW_CHECKLIST_INCOMPLETE_BLOCKED");
    expect(report.failures).toContain("missing-human-confirmation:D-C-10");
    expect(report.failures.some((failure) => failure.startsWith("unconfirmed-required-check:D-C-10"))).toBe(true);
    expect(report.exactRegistryWriteArtifactCreated).toBe(false);
  });

  it("fails closed when packet display title is not version plus official current title", async () => {
    const { root, packetPath } = writeFixtureRoot();
    const packet = JSON.parse(fs.readFileSync(path.join(root, packetPath), "utf8")) as {
      candidates: Array<{ stableKey: string; title: string }>;
    };
    const target = packet.candidates.find((row) => row.stableKey === "D-C-10");
    if (!target) throw new Error("fixture-missing-d-c-10");
    target.title = "legacy corpus display title";
    writeJson(root, packetPath, packet);

    const module = await loadReviewGateModule();
    expect(() => module.buildKoshaExactPromotionReviewTemplate({ rootDir: root, packetPath })).toThrow(
      "kosha-review-template-reviewer-support-candidate-not-ready:D-C-10",
    );
  });
});
