import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

type CockpitModule = {
  buildReviewerCockpit: (
    template: Record<string, unknown>,
    pdfAudit: Record<string, unknown>,
    lifecycleAudit: Record<string, unknown>,
  ) => {
    html: string;
    payload: {
      candidateCount: number;
      semanticGroupCount: number;
      checklistInputCount: number;
      boundary: Record<string, boolean>;
    };
  };
};

async function loadModule(): Promise<CockpitModule> {
  const sourcePath = path.resolve("scripts", "kosha_exact_promotion_reviewer_cockpit.mjs");
  const temporaryPath = path.join(
    os.tmpdir(),
    `kosha-reviewer-cockpit-${process.pid}-${Date.now()}.mjs`,
  );
  fs.copyFileSync(sourcePath, temporaryPath);
  return await import(`${pathToFileURL(temporaryPath).href}?v=${Date.now()}`) as CockpitModule;
}

function fixture() {
  const candidates = Array.from({ length: 8 }, (_, index) => {
    const stableKey = `D-C-${index + 1}`;
    const version = `${stableKey}-2026`;
    return {
      order: index + 1,
      stableKey,
      version,
      title: `${version} 검토 대상`,
      category: "건설안전분야",
      publishedAt: "2026-01-30",
      officialFileId: `FILE-${index + 1}`,
      officialUrl: `https://portal.kosha.or.kr/openapi/v1/file/down/FILE-${index + 1}/1`,
      bodySha256: "a".repeat(64),
      pdfSha256: "b".repeat(64),
      pageCount: 10,
      rationale: "bounded reviewer rationale",
      machineReviewerSupport: {
        contentRationaleMachineSupported: true,
        semanticGroups: Array.from({ length: 3 }, (_, groupIndex) => ({
          group: groupIndex + 1,
          requiredAny: [`term-${groupIndex + 1}`],
          matchedTerms: [`term-${groupIndex + 1}`],
          excerpt: `reviewer excerpt ${groupIndex + 1}`,
        })),
      },
      requiredReviewChecks: Array.from({ length: 5 }, (_, checkIndex) => ({
        text: `required check ${checkIndex + 1}`,
        confirmed: false,
      })),
      reviewer: "",
      reviewedAt: "",
      humanConfirmed: false,
    };
  });
  return {
    template: {
      schemaVersion: "safeclaw-kosha-exact-promotion-review/v1",
      reviewTemplateOnly: true,
      exactPromotionPerformed: false,
      candidateReviews: candidates,
    },
    pdfAudit: {
      verdict: "PASS_OFFICIAL_PDF_AUTHENTICITY_BODY_PAIR_REVIEW_STILL_REQUIRED",
      results: candidates.map((candidate) => ({
        stableKey: candidate.stableKey,
        version: candidate.version,
        machineVerificationPassed: true,
      })),
    },
    lifecycleAudit: {
      verdict: "PASS_OFFICIAL_CURRENT_LIFECYCLE_MACHINE_SUPPORTED_HUMAN_REVIEW_REQUIRED",
      results: candidates.map((candidate) => ({
        stableKey: candidate.stableKey,
        packetVersion: candidate.version,
        currentStatusLabel: "개정",
        currentPublishedAt: candidate.publishedAt,
        currentVersions: [candidate.version],
        machineLifecycleSupported: true,
      })),
    },
  };
}

describe("KOSHA exact promotion reviewer cockpit", () => {
  it("renders eight candidates and keeps all human review inputs incomplete by default", async () => {
    const module = await loadModule();
    const data = fixture();
    const result = module.buildReviewerCockpit(data.template, data.pdfAudit, data.lifecycleAudit);

    expect(result.payload).toMatchObject({
      candidateCount: 8,
      semanticGroupCount: 24,
      checklistInputCount: 64,
      boundary: {
        localReviewOnly: true,
        dbMutationPerformed: false,
        exactRegistryWriteArtifactCreated: false,
        exactPromotionPerformed: false,
        machineEvidenceReplacesHumanReview: false,
        separatePromotionApprovalRequired: true,
      },
    });
    expect(result.html.match(/data-candidate-button=/g)).toHaveLength(8);
    expect(result.html.match(/<input type="checkbox" data-check=/g)).toHaveLength(40);
    expect(result.html).toContain("data-export disabled");
    expect(result.html).toContain("검토 JSON 내보내기 · 64개 입력 필요");
    expect(result.html).toContain("기계 근거는 검토를 돕지만 판단을 대신하지 않습니다.");
  });

  it("fails closed when a machine-supported semantic group has no reviewer excerpt", async () => {
    const module = await loadModule();
    const data = fixture();
    const candidates = data.template.candidateReviews as Array<Record<string, unknown>>;
    const support = candidates[0]?.machineReviewerSupport as {
      semanticGroups: Array<Record<string, unknown>>;
    };
    if (support.semanticGroups[0]) support.semanticGroups[0].excerpt = "";

    expect(() => module.buildReviewerCockpit(
      data.template,
      data.pdfAudit,
      data.lifecycleAudit,
    )).toThrow("kosha-reviewer-cockpit-candidate-not-ready:D-C-1");
  });

  it("fails closed when upstream PDF or lifecycle evidence is not ready", async () => {
    const module = await loadModule();
    const data = fixture();
    data.pdfAudit.verdict = "RED";
    expect(() => module.buildReviewerCockpit(
      data.template,
      data.pdfAudit,
      data.lifecycleAudit,
    )).toThrow("kosha-reviewer-cockpit-pdf-audit-not-ready");
  });
});
