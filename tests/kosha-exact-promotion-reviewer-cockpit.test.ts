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
      pageReceiptCount: number;
      titleReconciledCandidateCount: number;
      checklistInputCount: number;
      bodySnapshotId: string;
      bodySourceIdentitySha256: string;
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
  const source = fs.readFileSync(sourcePath, "utf8").replace(/^#![^\r\n]*\r?\n/, "");
  fs.writeFileSync(temporaryPath, source, "utf8");
  return await import(`${pathToFileURL(temporaryPath).href}?v=${Date.now()}`) as CockpitModule;
}

function fixture() {
  const candidates = Array.from({ length: 8 }, (_, index) => {
    const stableKey = `D-C-${index + 1}`;
    const version = `${stableKey}-2026`;
    const officialCurrentTitle = `${stableKey} 공식 현재 제목`;
    const title = `${version} ${officialCurrentTitle}`;
    return {
      order: index + 1,
      stableKey,
      version,
      title,
      officialCurrentTitle,
      sourceTitle: index === 0 ? `${version} corpus 원본 제목` : title,
      titleReconciled: index === 0,
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
          evidenceTerm: `term-${groupIndex + 1}`,
          excerpt: `reviewer excerpt ${groupIndex + 1}`,
          matchBodyCharStart: groupIndex * 100 + 10,
          matchBodyCharEnd: groupIndex * 100 + 20,
          locationMappingComplete: true,
          locationMappingFailure: null,
          pageReceipts: [{
            pageNumber: groupIndex + 1,
            bodyCharStart: groupIndex * 100,
            bodyCharEnd: (groupIndex + 1) * 100,
            matchCharStart: groupIndex * 100 + 10,
            matchCharEnd: groupIndex * 100 + 20,
            normalizedTextSha256: "c".repeat(64),
            ocrCandidate: groupIndex === 2,
            extractionStatus: "success",
          }],
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
      bodySnapshotId: "fixture-snapshot",
      bodySourceIdentitySha256: "d".repeat(64),
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
      pageReceiptCount: 24,
      titleReconciledCandidateCount: 1,
      checklistInputCount: 64,
      bodySnapshotId: "fixture-snapshot",
      bodySourceIdentitySha256: "d".repeat(64),
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
    expect(result.html).toContain("D-C-1 · 후보 1/8");
    expect(result.html).toContain('role="tablist" aria-label="KOSHA 검토 후보" aria-orientation="vertical"');
    expect(result.html.match(/role="tab" id="candidate-tab-/g)).toHaveLength(8);
    expect(result.html.match(/role="tabpanel" aria-labelledby="candidate-tab-/g)).toHaveLength(8);
    expect(result.html).toContain('aria-controls="candidate-panel-0" aria-selected="true" tabindex="0"');
    expect(result.html).toContain('aria-controls="candidate-panel-1" aria-selected="false" tabindex="-1"');
    expect(result.html).toContain('role="status" aria-live="polite" data-progress-live');
    expect(result.html).toContain('data-candidate-context>후보 1/8 · 0/8 입력');
    expect(result.html).toContain('scroll-snap-type:x mandatory');
    expect(result.html).toContain('scrollIntoView({ block: "nearest", inline: "center" })');
    expect(result.html).toContain('candidateContext.textContent = "후보 "');
    expect(result.html).toContain('mobileBreakpoint.matches ? "horizontal" : "vertical"');
    expect(result.html).toContain('role="tablist" aria-label="D-C-1 검토 보기"');
    expect(result.html).toContain('aria-controls="review-pane-0" aria-selected="false" tabindex="-1"');
    expect(result.html).toContain('id="evidence-pane-0" data-mobile-pane="evidence"');
    expect(result.html).toContain('id="review-pane-0" data-mobile-pane="review"');
    expect(result.html).toContain('pane.setAttribute("role", "tabpanel")');
    expect(result.html).toContain('pane.removeAttribute("role")');
    expect(result.html).toContain('pane.hidden = paneMode !== selectedMode');
    expect(result.html).toContain('safeclaw-kosha-reviewer-cockpit-state/v4');
    expect(result.html).toContain('stored.candidateFingerprint === candidateFingerprint');
    expect(result.html).toContain('compatibleStoredRows(stored.rows)');
    expect(result.html).toContain('후보 구성이 변경되어 이전 검토 초안을 복원하지 않았습니다.');
    expect(result.html).toContain('ArrowDown: (index + 1) % buttons.length');
    expect(result.html).toContain('End: buttons.length - 1');
    expect(result.html.match(/<input type="checkbox" data-check=/g)).toHaveLength(40);
    expect(result.html.match(/data-evidence-receipt=/g)).toHaveLength(24);
    expect(result.html.match(/data-title-provenance=/g)).toHaveLength(8);
    expect(result.html).toContain("공식 현재 제목 · 건설안전분야");
    expect(result.html).toContain("D-C-1-2026 corpus 원본 제목");
    expect(result.html).toContain("표기 차이 있음");
    expect(result.html).toContain("표기 동일");
    expect(result.html).toContain("PDF 1쪽");
    expect(result.html).toContain("bodySnapshotId: payload.bodySnapshotId");
    expect(result.html).toContain("bodySourceIdentitySha256: payload.bodySourceIdentitySha256");
    expect(result.html).toContain("officialCurrentTitle: candidate.officialCurrentTitle");
    expect(result.html).toContain("sourceTitle: candidate.sourceTitle");
    expect(result.html).toContain("titleReconciled: candidate.titleReconciled");
    expect(result.html).toContain("evidenceReceipts: candidate.semanticGroups.map");
    expect(result.html).toContain("normalizedTextSha256: receipt.normalizedTextSha256");
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

  it("fails closed when a machine-supported semantic group has no page receipt", async () => {
    const module = await loadModule();
    const data = fixture();
    const candidates = data.template.candidateReviews as Array<Record<string, unknown>>;
    const support = candidates[0]?.machineReviewerSupport as {
      semanticGroups: Array<Record<string, unknown>>;
    };
    if (support.semanticGroups[0]) support.semanticGroups[0].pageReceipts = [];

    expect(() => module.buildReviewerCockpit(
      data.template,
      data.pdfAudit,
      data.lifecycleAudit,
    )).toThrow("kosha-reviewer-cockpit-invalid-page-receipts-D-C-1-1");
  });

  it("fails closed when page receipts exist but location mapping is incomplete", async () => {
    const module = await loadModule();
    const data = fixture();
    const candidates = data.template.candidateReviews as Array<Record<string, unknown>>;
    const support = candidates[0]?.machineReviewerSupport as {
      semanticGroups: Array<Record<string, unknown>>;
    };
    if (support.semanticGroups[0]) {
      support.semanticGroups[0].locationMappingComplete = false;
      support.semanticGroups[0].locationMappingFailure = "semantic-match-non-whitespace-gap";
    }

    expect(() => module.buildReviewerCockpit(
      data.template,
      data.pdfAudit,
      data.lifecycleAudit,
    )).toThrow("kosha-reviewer-cockpit-invalid-page-receipts-D-C-1-1");
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

  it("fails closed when title reconciliation provenance is inconsistent", async () => {
    const module = await loadModule();
    const data = fixture();
    const candidates = data.template.candidateReviews as Array<Record<string, unknown>>;
    candidates[0]!.titleReconciled = false;

    expect(() => module.buildReviewerCockpit(
      data.template,
      data.pdfAudit,
      data.lifecycleAudit,
    )).toThrow("kosha-reviewer-cockpit-candidate-not-ready:D-C-1");
  });

  it("fails closed when the display title is not derived from the official current title", async () => {
    const module = await loadModule();
    const data = fixture();
    const candidates = data.template.candidateReviews as Array<Record<string, unknown>>;
    candidates[0]!.title = "legacy corpus display title";

    expect(() => module.buildReviewerCockpit(
      data.template,
      data.pdfAudit,
      data.lifecycleAudit,
    )).toThrow("kosha-reviewer-cockpit-candidate-not-ready:D-C-1");
  });
});
