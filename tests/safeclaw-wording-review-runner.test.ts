import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT_PATH = path.resolve(process.cwd(), "scripts/safeclaw_wording_review_runner.mjs");

type WordingReport = {
  pass: number;
  fail: number;
  cases: Array<{
    failedChecks: Array<{ id: string; detail: string }>;
    metrics: {
      fieldLeakageFlags: Array<{ field: string; matchedProfile: string }>;
    };
  }>;
};

function buildDocuments(): Record<string, string> {
  return {
    riskAssessmentDraft: "위험성평가표\n화학물질 비산과 피부 접촉 위험을 확인하고 작업 전 SDS와 GHS 경고표지를 점검한다.",
    workPlanDraft: "작업계획서\n작업구역을 분리하고 관리감독자가 작업 전 출입 통제 상태와 환기설비 작동 여부를 확인한다.",
    tbmBriefing: "TBM\n작업자는 비산 위험과 작업중지 기준을 복창하고 보호구를 착용한다.",
    tbmLogDraft: "TBM 기록\n참석자와 복창 결과를 기록하고 미조치 위험은 작업반장에게 보고한다.",
    safetyEducationRecordDraft: "교육 기록\nSDS 확인 절차와 보호구 착용 방법을 교육하고 이해 여부를 확인한다.",
    emergencyResponseDraft: "비상대응\n누출 시 작업을 중지하고 출입을 통제한 뒤 관리자에게 보고한다."
  };
}

function goodRow(): Record<string, unknown> {
  return {
    location: "울산 도금공장 세척 구역",
    process: "도금 탱크 외부 화학세척",
    task: "세척제 라벨과 SDS 확인 후 외부 세척",
    equipment: "국소배기장치와 내화학 보호구",
    hazard: "미확인 세척제 비산 및 피부 접촉",
    currentControls: "용기 라벨과 SDS를 작업 전 확인한다.",
    additionalControls: "물질 확인 전 사용을 금지하고 출입구를 통제한다.",
    owner: "작업반장",
    due: "작업 전",
    verification: "SDS 비치와 통제구역 사진을 관리감독자가 확인한다."
  };
}

function runFixture(payload: Record<string, unknown>): {
  status: number | null;
  report: WordingReport;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-wording-review-"));
  const casesPath = path.join(root, "cases.json");
  const payloadsPath = path.join(root, "payloads.json");
  const outDir = path.join(root, "output");
  const caseId = "ulsan-chemical__review";
  fs.writeFileSync(casesPath, `${JSON.stringify({
    variants: [{ id: "review", expected: { requiredDocuments: [] } }],
    baseScenarios: [{
      id: "ulsan-chemical",
      question: "울산 화학세척",
      expected: {
        region: "울산",
        workType: "화학세척",
        fieldIsolationTerms: ["화학세척", "세척제", "SDS"],
        forbiddenFieldTerms: [{
          id: "default-exterior-paint",
          terms: ["외벽 도장", "이동식 비계", "성수동"]
        }],
        requiredDocuments: []
      }
    }]
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(payloadsPath, `${JSON.stringify({ [caseId]: payload }, null, 2)}\n`, "utf8");

  const result = spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SAFECLAW_WORDING_CASES_PATH: casesPath,
      SAFECLAW_WORDING_PAYLOADS_PATH: payloadsPath,
      SAFECLAW_WORDING_OUT_DIR: outDir
    },
    encoding: "utf8"
  });
  const report = JSON.parse(fs.readFileSync(path.join(outDir, "report.json"), "utf8")) as WordingReport;
  fs.rmSync(root, { recursive: true, force: true });
  return { status: result.status, report };
}

describe("SafeClaw wording review runner", () => {
  it("passes concrete, scenario-grounded document fields", () => {
    const result = runFixture({
      deliverables: buildDocuments(),
      structured: { riskAssessmentRows: [goodRow()] }
    });

    expect(result.status).toBe(0);
    expect(result.report).toMatchObject({ pass: 1, fail: 0 });
  });

  it("fails closed on invented locations, repeated controls, and vague actions", () => {
    const repeated = "현장 안전수칙을 철저히 준수하고 작업 전반에 충분히 주의한다.";
    const result = runFixture({
      deliverables: {
        ...buildDocuments(),
        workPlanDraft: `작업계획서\n${repeated}\n${repeated}`
      },
      structured: {
        riskAssessmentRows: [{
          ...goodRow(),
          location: "광주 공장",
          process: "외벽 도장",
          task: "성수동 이동식 비계 작업",
          equipment: "이동식 비계",
          currentControls: repeated,
          additionalControls: repeated
        }]
      }
    });

    expect(result.status).toBe(1);
    expect(result.report).toMatchObject({ pass: 0, fail: 1 });
    const failedIds = result.report.cases[0]?.failedChecks.map((check) => check.id);
    expect(failedIds).toEqual(expect.arrayContaining([
      "documents:exactDuplicateLines",
      "riskRows:scenarioLocation",
      "riskRows:scenarioFieldGrounding",
      "riskRows:crossScenarioFieldLeakage",
      "riskRows:distinctControls",
      "riskRows:actionableControls"
    ]));
    expect(result.report.cases[0]?.metrics.fieldLeakageFlags).toEqual(expect.arrayContaining([
      expect.objectContaining({ matchedProfile: "default-exterior-paint" })
    ]));
  });
});
