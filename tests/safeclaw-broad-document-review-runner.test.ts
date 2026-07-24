import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT_PATH = path.resolve(process.cwd(), "scripts/safeclaw_broad_document_review_runner.mjs");

type BroadReport = {
  uiDocumentCount: number;
  integrityRequiredCount: number;
  reviewedDocumentCount: number;
  pass: number;
  fail: number;
  missingUnexpected: Array<{ caseId: string; key: string }>;
  explicitNotApplicable: Array<{ caseId: string; key: string; reason: string }>;
  secondaryGroundingReviewed: number;
  secondaryGroundingPassed: number;
  secondaryCrossScenarioLeakageCount: number;
  seedProfileLeakageCount: number;
  cases: Array<{
    permitRequired: boolean;
    documents: Array<{
      key: string;
      status: string;
      verdict: string;
      missingRequiredTerms: string[];
      matchedForbiddenDocumentFragments: string[];
      matchedScenarioTerms: string[];
      matchedSupportingScenarioTerms: string[];
      missingSemanticGroups: string[][];
      crossScenarioLeakage: Array<{ profileId: string; term: string }>;
    }>;
  }>;
};

function documentText(title: string): string {
  return `${title}\n작업 전 위험과 안전조치를 확인하고 관리감독자가 작업자에게 설명합니다. 확인 결과와 조치 상태를 현장 문서팩에 기록하고 보관합니다.`;
}

function buildDocuments(workPermitDraft: string, scenarioTerm = "화학세척"): Record<string, string> {
  return {
    workpackSummaryDraft: `${documentText("점검결과 요약")}\n${scenarioTerm} 작업의 위험과 통제 조치를 확인합니다.`,
    riskAssessmentDraft: documentText("위험성평가표"),
    workPlanDraft: documentText("작업계획서"),
    workPermitDraft,
    tbmBriefing: documentText("TBM 브리핑"),
    tbmLogDraft: documentText("TBM 기록"),
    safetyEducationRecordDraft: documentText("안전보건교육 기록"),
    emergencyResponseDraft: documentText("비상대응 절차"),
    photoEvidenceDraft: `${documentText("사진 증빙")}\n${scenarioTerm} 조치 전 사진과 조치 후 사진을 확인하여 보관합니다.`,
    foreignWorkerBriefing: `${documentText("외국인 근로자 브리핑")}\n${scenarioTerm} 위험 시 작업을 멈추고 보호구를 확인하는 쉬운 한국어 안내입니다.`,
    foreignWorkerTransmission: `${documentText("외국인 전송본")}\n외국인 안전공지: ${scenarioTerm} 위험 시 STOP, 작업을 중지하고 보호구를 확인합니다.`,
    kakaoMessage: `${documentText("현장 공유 메시지")}\n현장 ${scenarioTerm} 작업 위험을 확인하고 미조치 시 작업을 중지합니다.`
  };
}

function riskRow(region: string, process: string): Record<string, string> {
  return {
    location: `${region} 작업구역`,
    process,
    task: `${process} 작업 전 확인`,
    equipment: "작업도구와 보호구",
    hazard: "작업구역 접근과 보호구 미착용 위험",
    currentControls: "작업 전 보호구와 출입통제 상태를 확인한다.",
    additionalControls: "미확인 상태에서는 작업을 중지하고 관리감독자에게 보고한다.",
    owner: "작업반장",
    due: "작업 전",
    verification: "관리감독자가 현장 상태와 확인 기록을 점검한다."
  };
}

function runFixture(input: {
  question: string;
  fieldTerms: string[];
  hazards?: string[];
  workerSignals?: string[];
  forbiddenDocumentFragments?: string[];
  payload: Record<string, unknown>;
}): { status: number | null; report: BroadReport } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-broad-review-"));
  const casesPath = path.join(root, "cases.json");
  const payloadsPath = path.join(root, "payloads.json");
  const outDir = path.join(root, "output");
  const caseId = "broad-case__review";
  fs.writeFileSync(casesPath, `${JSON.stringify({
    variants: [{ id: "review", expected: {} }],
    baseScenarios: [{
      id: "broad-case",
      question: input.question,
      expected: {
        region: input.question.split(/\s+/u)[0],
        workType: input.fieldTerms[0],
        fieldIsolationTerms: input.fieldTerms,
        hazards: input.hazards ?? [],
        workerSignals: input.workerSignals ?? [],
        forbiddenDocumentFragments: input.forbiddenDocumentFragments ?? [],
        forbiddenFieldTerms: [{
          id: "other-exterior-work",
          terms: ["외벽도장", "이동식 비계", "성수동"]
        }]
      }
    }]
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(payloadsPath, `${JSON.stringify({ [caseId]: input.payload }, null, 2)}\n`, "utf8");

  const result = spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SAFECLAW_BROAD_DOCUMENT_CASES_PATH: casesPath,
      SAFECLAW_BROAD_DOCUMENT_PAYLOADS_PATH: payloadsPath,
      SAFECLAW_BROAD_DOCUMENT_OUT_DIR: outDir
    },
    encoding: "utf8"
  });
  const report = JSON.parse(fs.readFileSync(path.join(outDir, "report.json"), "utf8")) as BroadReport;
  fs.rmSync(root, { recursive: true, force: true });
  return { status: result.status, report };
}

describe("SafeClaw 12-deliverable broad review", () => {
  it("fails closed when a permit-required scenario has a blank workPermitDraft", () => {
    const result = runFixture({
      question: "울산 화학세척 SDS 확인 작업",
      fieldTerms: ["화학세척", "SDS"],
      payload: {
        deliverables: buildDocuments(""),
        structured: { riskAssessmentRows: [riskRow("울산", "화학세척 SDS 확인")] }
      }
    });

    expect(result.status).toBe(1);
    expect(result.report).toMatchObject({
      uiDocumentCount: 12,
      integrityRequiredCount: 12,
      reviewedDocumentCount: 12,
      pass: 0,
      fail: 1
    });
    expect(result.report.missingUnexpected).toContainEqual({
      caseId: "broad-case__review",
      key: "workPermitDraft"
    });
  });

  it("passes all 12 raw deliverables when a required permit contains the permit contract", () => {
    const permit = [
      "안전작업허가 확인서",
      "화학세척 SDS 작업",
      "허가구분: 화학물질 작업",
      "작업시간: 작업 시작 전부터 종료 확인까지",
      "격리 및 차단 상태를 관리감독자가 확인한다.",
      "SDS와 보호구를 확인하고 작업 종료 후 잔류 위험을 기록한다."
    ].join("\n");
    const result = runFixture({
      question: "울산 화학세척 SDS 확인 작업",
      fieldTerms: ["화학세척", "SDS"],
      payload: {
        deliverables: buildDocuments(permit),
        structured: { riskAssessmentRows: [riskRow("울산", "화학세척 SDS 확인")] }
      }
    });

    expect(result.status).toBe(0);
    expect(result.report).toMatchObject({ pass: 1, fail: 0 });
    expect(result.report).toMatchObject({
      secondaryGroundingReviewed: 6,
      secondaryGroundingPassed: 6,
      secondaryCrossScenarioLeakageCount: 0,
      seedProfileLeakageCount: 0
    });
    expect(result.report.cases[0]?.documents).toHaveLength(12);
    expect(result.report.cases[0]?.documents.find((item) => item.key === "workPermitDraft")).toMatchObject({
      status: "presentNonEmpty",
      verdict: "PASS",
      missingRequiredTerms: []
    });
  });

  it("accepts a visible not-applicable reason only for a non-permit scenario", () => {
    const reason = "해당 없음: 사무실 TBM 안내만 수행하여 별도 위험작업 허가 대상이 아닙니다.";
    const result = runFixture({
      question: "서울 사무실 문서정리 TBM 안내",
      fieldTerms: ["문서정리"],
      payload: {
        deliverables: buildDocuments(reason, "문서정리"),
        structured: { riskAssessmentRows: [riskRow("서울", "사무실 문서정리")] }
      }
    });

    expect(result.status).toBe(0);
    expect(result.report.cases[0]?.permitRequired).toBe(false);
    expect(result.report.explicitNotApplicable).toContainEqual({
      caseId: "broad-case__review",
      key: "workPermitDraft",
      reason: "사무실 TBM 안내만 수행하여 별도 위험작업 허가 대상이 아닙니다."
    });
  });

  it("fails closed when secondary documents contain another scenario fingerprint", () => {
    const permit = [
      "안전작업허가 확인서",
      "화학세척 SDS 작업",
      "허가 및 작업시간을 확인한다.",
      "격리와 차단 상태, 보호구를 확인하고 종료 후 기록한다."
    ].join("\n");
    const documents = buildDocuments(permit);
    documents.photoEvidenceDraft = `${documentText("사진 증빙")}\n외벽도장 이동식 비계 조치 전 사진과 조치 후 사진을 확인하여 보관합니다.`;
    const result = runFixture({
      question: "울산 화학세척 SDS 확인 작업",
      fieldTerms: ["화학세척", "SDS"],
      payload: {
        deliverables: documents,
        structured: { riskAssessmentRows: [riskRow("울산", "화학세척 SDS 확인")] }
      }
    });

    expect(result.status).toBe(1);
    const photo = result.report.cases[0]?.documents.find((item) => item.key === "photoEvidenceDraft");
    expect(photo).toMatchObject({
      verdict: "RED",
      matchedScenarioTerms: []
    });
    expect(photo?.missingSemanticGroups).toEqual([]);
    expect(photo?.crossScenarioLeakage).toContainEqual({
      profileId: "other-exterior-work",
      term: "외벽도장"
    });
    expect(photo?.crossScenarioLeakage).toContainEqual({
      profileId: "other-exterior-work",
      term: "이동식 비계"
    });
  });

  it("fails closed when one forbidden seed fragment remains in one deliverable", () => {
    const permit = [
      "안전작업허가 확인서",
      "화학세척 SDS 작업",
      "허가 및 작업시간을 확인한다.",
      "격리와 차단 상태, 보호구를 확인하고 종료 후 기록한다."
    ].join("\n");
    const documents = buildDocuments(permit);
    documents.workpackSummaryDraft += "\n작업조건: 우천 후 바닥 젖음";
    const result = runFixture({
      question: "울산 화학세척 SDS 확인 작업",
      fieldTerms: ["화학세척", "SDS"],
      forbiddenDocumentFragments: ["우천 후 바닥 젖음"],
      payload: {
        deliverables: documents,
        structured: { riskAssessmentRows: [riskRow("울산", "화학세척 SDS 확인")] }
      }
    });

    expect(result.status).toBe(1);
    expect(result.report.seedProfileLeakageCount).toBe(1);
    expect(result.report.cases[0]?.documents.find((item) => item.key === "workpackSummaryDraft")).toMatchObject({
      verdict: "RED",
      matchedForbiddenDocumentFragments: ["우천 후 바닥 젖음"]
    });
  });

  it("accepts two grounded supporting signals when the document uses a valid field synonym", () => {
    const permit = [
      "안전작업허가 확인서",
      "배전반 야간 감전 작업",
      "허가 및 작업시간을 확인한다.",
      "격리와 차단 상태, 보호구를 확인하고 종료 후 기록한다."
    ].join("\n");
    const result = runFixture({
      question: "제주 심야 전기설비 분전반 복구",
      fieldTerms: ["전기설비", "분전반", "심야 복구"],
      hazards: ["야간", "감전", "피로"],
      workerSignals: ["야간조", "인수인계"],
      payload: {
        deliverables: buildDocuments(permit, "배전반 야간 감전"),
        structured: { riskAssessmentRows: [riskRow("제주", "전기설비 분전반 복구")] }
      }
    });

    expect(result.status).toBe(0);
    expect(result.report).toMatchObject({
      pass: 1,
      fail: 0,
      secondaryGroundingPassed: 6
    });
    expect(result.report.cases[0]?.documents.find((item) => item.key === "workPermitDraft")).toMatchObject({
      matchedScenarioTerms: [],
      matchedSupportingScenarioTerms: ["야간", "감전"],
      verdict: "PASS"
    });
  });
});
