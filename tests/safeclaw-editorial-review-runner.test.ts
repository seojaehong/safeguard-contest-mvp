import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
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
  scenarioIrrelevantContextFindingCount: number;
  evidenceDomainMismatchCount: number;
  genericTemplateOveruseCount: number;
  requestedAiMode: string;
  expectedProviderWorkUnit: number;
  providerGenerationRequested: boolean;
  exactLineOveruseCount: number;
  displayedExactLineOveruseCount: number;
  duplicateReviewCategoryCounts: {
    exact: Record<string, number>;
    near: Record<string, number>;
  };
  evidenceBoundary: {
    sixCoreWordingGateCombinedAsHumanPass: boolean;
    twelveDeliverablePresenceGateCombinedAsHumanPass: boolean;
    exactSavedShareVerdict: string;
  };
  cases: Array<{
    exactLineOveruse: Array<{
      line: string;
      reviewCategory: string;
      humanReviewRequired: boolean;
    }>;
    documents: Array<{
      key: string;
      excerpt: string;
      verdict: string;
      failures: string[];
      matchedForbiddenDocumentFragments: string[];
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

function runFixture(
  question: string,
  documents: Record<string, string>,
  expected: Record<string, unknown> = {}
): { status: number | null; report: EditorialReport } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-editorial-review-"));
  const casesPath = path.join(root, "cases.json");
  const payloadsPath = path.join(root, "payloads.json");
  const outDir = path.join(root, "output");
  fs.writeFileSync(casesPath, `${JSON.stringify({
    variants: [{ id: "review", expected }],
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
  it("requires live editorial review to use the zero-provider template contract", () => {
    const moduleUrl = pathToFileURL(SCRIPT_PATH).href;
    const source = `
      import { evaluateEditorialRuntimeContract } from ${JSON.stringify(moduleUrl)};
      const pass = evaluateEditorialRuntimeContract({ status: 200, aiMode: "template", workUnit: "0" });
      const providerMode = evaluateEditorialRuntimeContract({ status: 200, aiMode: "enhanced", workUnit: "2" });
      const missingHeaders = evaluateEditorialRuntimeContract({ status: 200 });
      process.stdout.write(JSON.stringify({ pass, providerMode, missingHeaders }));
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout) as Record<string, { ok: boolean }>;
    expect(output.pass?.ok).toBe(true);
    expect(output.providerMode?.ok).toBe(false);
    expect(output.missingHeaders?.ok).toBe(false);
  });

  it("separates distributed admission outages from document quality failures", () => {
    const moduleUrl = pathToFileURL(SCRIPT_PATH).href;
    const source = `
      import { classifyEditorialRuntimeBlock, summarizeEditorialExecution } from ${JSON.stringify(moduleUrl)};
      const distributed = classifyEditorialRuntimeBlock(
        { status: 503 },
        { code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE" },
      );
      const generationFailure = classifyEditorialRuntimeBlock(
        { status: 503 },
        { code: "DOCUMENT_GENERATION_FAILED" },
      );
      const summary = summarizeEditorialExecution(
        Array.from({ length: 5 }, () => ({
          verdict: "BLOCKED",
          runtimeBlockCode: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
        })),
        { liveEnabled: true, localProduction: false },
      );
      process.stdout.write(JSON.stringify({ distributed, generationFailure, summary }));
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout) as {
      distributed: { blocked: boolean; code: string };
      generationFailure: { blocked: boolean; code: string };
      summary: Record<string, unknown>;
    };
    expect(output.distributed).toEqual({
      blocked: true,
      code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
    });
    expect(output.generationFailure).toEqual({ blocked: false, code: "" });
    expect(output.summary).toEqual({
      blocked: 5,
      contentReviewExecutedCount: 0,
      fail: 0,
      pass: 0,
      runtimeBlockCodeCounts: { DISTRIBUTED_RATE_LIMIT_UNAVAILABLE: 5 },
      verdict: "BLOCKED_LIVE_PRODUCTION_EDITORIAL_REVIEW_RUNTIME_UNAVAILABLE",
    });
  });

  it("records all 12 reviewer excerpts without claiming completed human review", () => {
    const result = runFixture("울산 화학세척 작업", buildDocuments());

    expect(result.status).toBe(0);
    expect(result.report).toMatchObject({
      pass: 1,
      fail: 0,
      reviewedDocumentSurfaceCount: 12,
      humanReviewCompleted: false,
      requestedAiMode: "template",
      expectedProviderWorkUnit: 0,
      providerGenerationRequested: false,
      evidenceBoundary: {
        sixCoreWordingGateCombinedAsHumanPass: false,
        twelveDeliverablePresenceGateCombinedAsHumanPass: false,
        exactSavedShareVerdict: "MISSING_EVIDENCE"
      }
    });
    expect(result.report.cases[0]?.documents).toHaveLength(12);
    expect(result.report.cases[0]?.documents.every((document) => document.excerpt.length > 0)).toBe(true);
    expect(result.report.genericTemplateOveruseCount).toBe(0);
    expect(result.report.duplicateReviewCategoryCounts.exact["cross-document-control-consistency"]).toBeGreaterThan(0);
    expect(result.report.cases[0]?.exactLineOveruse.every((finding) => finding.humanReviewRequired)).toBe(true);
  });

  it("fails closed when one generic fallback is copied across independent documents", () => {
    const documents = buildDocuments();
    const repeatedFallback = "작업조건: 현장 조건 미지정, 작업 전 실제 환경 확인 필요";
    for (const key of ["workpackSummaryDraft", "workPlanDraft", "workPermitDraft", "emergencyResponseDraft"]) {
      documents[key] += `\n${repeatedFallback}`;
    }
    const result = runFixture("구미 설비 정비 작업", documents);

    expect(result.status).toBe(1);
    expect(result.report.genericTemplateOveruseCount).toBe(1);
    expect(result.report.duplicateReviewCategoryCounts.exact["generic-template-overuse"]).toBe(1);
    expect(result.report.cases[0]?.exactLineOveruse).toContainEqual(expect.objectContaining({
      line: repeatedFallback,
      reviewCategory: "generic-template-overuse",
      humanReviewRequired: true
    }));
  });

  it("fails closed when generic overuse appears after the display cap", () => {
    const documents = buildDocuments();
    const repeatedKeys = ["workpackSummaryDraft", "workPlanDraft", "workPermitDraft", "emergencyResponseDraft"];
    for (let index = 0; index < 21; index += 1) {
      const benignLine = `공통 안전조치 ${String(index + 1).padStart(2, "0")}: 작업 전 통제구역과 보호구 상태를 관리감독자가 확인하고 기록합니다.`;
      for (const key of repeatedKeys) documents[key] += `\n${benignLine}`;
    }
    const repeatedFallback = "작업조건: 현장 조건 미지정, 작업 전 실제 환경 확인 필요";
    for (const key of repeatedKeys) documents[key] += `\n${repeatedFallback}`;

    const result = runFixture("구미 설비 정비 작업", documents);

    expect(result.status).toBe(1);
    expect(result.report.exactLineOveruseCount).toBeGreaterThan(20);
    expect(result.report.displayedExactLineOveruseCount).toBe(20);
    expect(result.report.genericTemplateOveruseCount).toBe(1);
    expect(result.report.duplicateReviewCategoryCounts.exact["generic-template-overuse"]).toBe(1);
  });

  it("classifies role-specific near duplicates without hiding them", () => {
    const documents = buildDocuments();
    documents.workpackSummaryDraft += "\n작업조건 판단: 정전전로 인근 전기작업 조건과 잔류전하 상태 확인 필요";
    documents.foreignWorkerBriefing += "\n작업조건: 정전전로 인근 전기작업 조건과 잔류전하 상태 확인 필요";
    documents.riskAssessmentDraft += "\n유해·위험요인: 정전 범위 오인과 잔류전하 확인 미흡으로 인한 감전 위험";
    documents.photoEvidenceDraft += "\n위험요인 1: 정전 범위 오인과 잔류전하 확인 미흡으로 인한 감전 위험";
    documents.workPermitDraft += "\n안전조치 1: 전원 차단과 검전 후 잠금표지 상태를 관리감독자가 확인";
    documents.riskAssessmentDraft += "\n현재 안전조치: 전원 차단과 검전 후 잠금표지 상태를 관리감독자가 확인";

    const result = runFixture("제주 심야 전기설비 복구 작업", documents);

    expect(result.status).toBe(0);
    expect(result.report.duplicateReviewCategoryCounts.near).toMatchObject({
      "independent-document-context": 1,
      "cross-document-hazard-consistency": 1,
      "cross-document-control-consistency": 1
    });
    expect(result.report.cases[0]?.exactLineOveruse.every((finding) => finding.humanReviewRequired)).toBe(true);
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

  it("fails closed when one manifest-forbidden scenario fragment remains in a document", () => {
    const documents = buildDocuments();
    documents.foreignWorkerBriefing += "\n우천·젖은 바닥: 미끄럼과 보행 동선을 확인합니다.";
    const result = runFixture(
      "울산 화학세척 작업에서 SDS와 비산·피부접촉을 확인한다.",
      documents,
      { forbiddenDocumentFragments: ["우천·젖은 바닥"] }
    );

    expect(result.status).toBe(1);
    expect(result.report.scenarioIrrelevantContextFindingCount).toBe(1);
    expect(result.report.cases[0]?.documents.find(
      (document) => document.key === "foreignWorkerBriefing"
    )).toMatchObject({
      verdict: "RED",
      failures: ["scenarioIrrelevantContext"],
      matchedForbiddenDocumentFragments: ["우천·젖은 바닥"]
    });
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
