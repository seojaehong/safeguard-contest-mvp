import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

type Candidate = {
  stableKey: string;
  version: string;
  officialFileId: string;
  bodySha256: string;
  pdfSha256: string;
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
  failures: string[];
  forbiddenClaims: string[];
};

type ReviewGateModule = {
  buildKoshaExactPromotionReviewGate: (options: {
    rootDir: string;
    packetPath?: string;
    reviewPath: string;
    generatedAt?: string;
  }) => ReviewGateReport;
  buildKoshaExactPromotionReviewTemplate: (options: {
    rootDir: string;
    packetPath?: string;
    generatedAt?: string;
  }) => {
    schemaVersion: string;
    reviewTemplateOnly: boolean;
    exactPromotionPerformed: boolean;
    candidateReviews: Array<{
      stableKey: string;
      reviewer: string;
      reviewedAt: string;
      humanConfirmed: boolean;
      requiredReviewChecks: Array<{ text: string; confirmed: boolean }>;
    }>;
  };
};

async function loadReviewGateModule(): Promise<ReviewGateModule> {
  const sourcePath = path.resolve("scripts", "kosha_exact_promotion_review_gate.mjs");
  return await import(pathToFileURL(sourcePath).href) as ReviewGateModule;
}

function writeJson(root: string, relativePath: string, value: unknown): void {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function candidate(stableKey: string, index: number): Candidate {
  return {
    stableKey,
    version: `${stableKey}-2026`,
    officialFileId: `FILE-${index}`,
    bodySha256: `${index}`.repeat(64).slice(0, 64),
    pdfSha256: `${index + 1}`.repeat(64).slice(0, 64),
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
      officialFileId: row.officialFileId,
      bodySha256: row.bodySha256,
      pdfSha256: row.pdfSha256,
      reviewer: "operator@example.com",
      reviewedAt: "2026-07-22T00:00:00.000Z",
      humanConfirmed: true,
      requiredReviewChecks: row.requiredReviewChecks.map((text) => ({ text, confirmed: true })),
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

    expect(report.verdict).toBe("REVIEW_CHECKLIST_COMPLETE_READY_FOR_SEPARATE_APPROVAL");
    expect(report.reviewChecklistComplete).toBe(true);
    expect(report.exactTrustPromotionBlockedUntilChecklistComplete).toBe(false);
    expect(report.exactTrustPromotionStillRequiresSeparateApproval).toBe(true);
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
    expect(report.exactPromotionPerformed).toBe(false);
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
    expect(markdown).toContain("Exact trust promotion still requires separate approval: `true`");
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
    expect(template.candidateReviews).toHaveLength(2);
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
  });
});
