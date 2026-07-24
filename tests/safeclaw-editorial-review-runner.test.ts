import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT_PATH = path.resolve(process.cwd(), "scripts/safeclaw_editorial_review_runner.mjs");

type EditorialReport = {
  pass: number;
  fail: number;
  reviewedDocumentSurfaceCount: number;
  humanReviewCompleted: boolean;
  placeholderFindingCount: number;
  legalOverclaimFindingCount: number;
  awkwardCompositionFindingCount: number;
  evidenceDomainMismatchCount: number;
  evidenceBoundary: {
    sixCoreWordingGateCombinedAsHumanPass: boolean;
    twelveDeliverablePresenceGateCombinedAsHumanPass: boolean;
    exactSavedShareVerdict: string;
  };
  cases: Array<{
    documents: Array<{
      key: string;
      excerpt: string;
      verdict: string;
      failures: string[];
      evidenceDomainMismatches: Array<{
        domain: string;
        requiredScenarioIdentity: string;
        scenarioIdentityMatched: boolean;
      }>;
    }>;
  }>;
};

function documentText(title: string): string {
  return `${title}\n울산 화학세척 작업의 위험과 통제 조치를 확인합니다. 관리감독자가 조치 완료 상태를 기록하고 작업자에게 설명합니다.`;
}

function buildDocuments(): Record<string, string> {
  return {
    workpackSummaryDraft: documentText("점검결과 요약"),
    riskAssessmentDraft: documentText("위험성평가표"),
    workPlanDraft: documentText("작업계획서"),
    workPermitDraft: documentText("안전작업허가 확인서"),
    tbmBriefing: documentText("TBM 브리핑"),
    tbmLogDraft: documentText("TBM 기록"),
    safetyEducationRecordDraft: documentText("안전보건교육 기록"),
    emergencyResponseDraft: documentText("비상대응 절차"),
    photoEvidenceDraft: documentText("사진·증빙"),
    foreignWorkerBriefing: documentText("외국인 근로자 출력본"),
    foreignWorkerTransmission: documentText("외국인 전송본"),
    kakaoMessage: documentText("현장 공유 메시지")
  };
}

function runFixture(question: string, documents: Record<string, string>): { status: number | null; report: EditorialReport } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-editorial-review-"));
  const casesPath = path.join(root, "cases.json");
  const payloadsPath = path.join(root, "payloads.json");
  const outDir = path.join(root, "output");
  fs.writeFileSync(casesPath, `${JSON.stringify({
    variants: [{ id: "review", expected: {} }],
    baseScenarios: [{ id: "editorial-case", question, expected: {} }]
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(payloadsPath, `${JSON.stringify({
    "editorial-case__review": { deliverables: documents }
  }, null, 2)}\n`, "utf8");
  const result = spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SAFECLAW_EDITORIAL_CASES_PATH: casesPath,
      SAFECLAW_EDITORIAL_PAYLOADS_PATH: payloadsPath,
      SAFECLAW_EDITORIAL_OUT_DIR: outDir
    },
    encoding: "utf8"
  });
  const report = JSON.parse(fs.readFileSync(path.join(outDir, "report.json"), "utf8")) as EditorialReport;
  fs.rmSync(root, { recursive: true, force: true });
  return { status: result.status, report };
}

describe("SafeClaw 12-deliverable editorial review", () => {
  it("records all 12 reviewer excerpts without claiming completed human review", () => {
    const result = runFixture("울산 화학세척 작업", buildDocuments());

    expect(result.status).toBe(0);
    expect(result.report).toMatchObject({
      pass: 1,
      fail: 0,
      reviewedDocumentSurfaceCount: 12,
      humanReviewCompleted: false,
      evidenceBoundary: {
        sixCoreWordingGateCombinedAsHumanPass: false,
        twelveDeliverablePresenceGateCombinedAsHumanPass: false,
        exactSavedShareVerdict: "MISSING_EVIDENCE"
      }
    });
    expect(result.report.cases[0]?.documents).toHaveLength(12);
    expect(result.report.cases[0]?.documents.every((document) => document.excerpt.length > 0)).toBe(true);
  });

  it("fails closed on one awkward completed-action question splice", () => {
    const documents = buildDocuments();
    documents.tbmBriefing += "\n보호구 확인 절차를 누가 확인했는가?";
    const result = runFixture("울산 화학세척 작업", documents);

    expect(result.status).toBe(1);
    expect(result.report.awkwardCompositionFindingCount).toBe(1);
    expect(result.report.cases[0]?.documents.find((document) => document.key === "tbmBriefing")).toMatchObject({
      verdict: "RED",
      failures: ["awkwardSentenceComposition"]
    });
  });

  it("fails closed on placeholder and legal-duty replacement wording", () => {
    const documents = buildDocuments();
    documents.photoEvidenceDraft += "\n사진 입력 필요";
    documents.safetyEducationRecordDraft += "\n이 교육은 법정 의무를 대체합니다.";
    const result = runFixture("울산 화학세척 작업", documents);

    expect(result.status).toBe(1);
    expect(result.report.placeholderFindingCount).toBe(1);
    expect(result.report.legalOverclaimFindingCount).toBe(1);
  });

  it("reports the evidence category mismatch when location-only overlap selects vehicle rollover evidence", () => {
    const documents = buildDocuments();
    documents.riskAssessmentDraft += [
      "",
      "[내부 안전지식 DB 반영]",
      "문서 문장: 덤프트럭·건설기계의 지반·경사 조건 불량에 따른 전도·전복 위험을 확인합니다."
    ].join("\n");
    const result = runFixture(
      "제주 리조트 심야 전기설비 긴급복구. 분전반 감전과 재통전 위험을 확인한다.",
      documents
    );

    expect(result.status).toBe(1);
    expect(result.report.evidenceDomainMismatchCount).toBe(1);
    expect(result.report.cases[0]?.documents.find((document) => document.key === "riskAssessmentDraft")).toMatchObject({
      verdict: "RED",
      failures: ["scenarioEvidenceDomainMismatch"],
      evidenceDomainMismatches: [{
        domain: "vehicle-rollover",
        requiredScenarioIdentity: "vehicle or mobile-equipment operation",
        scenarioIdentityMatched: false
      }]
    });
  });
});
