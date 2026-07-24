import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT_PATH = path.resolve(process.cwd(), "scripts/safeclaw_quality_matrix_runner.mjs");

type MatrixRunReport = {
  total: number;
  pass: number;
  fail: number;
  failureSamples: Array<{
    failedChecks: Array<{ name: string; message: string }>;
  }>;
};

function runMatrix(requiredAnyGroups: string[][]): {
  status: number | null;
  report: MatrixRunReport;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-quality-matrix-"));
  const casesPath = path.join(root, "cases.json");
  const outputDir = path.join(root, "output");
  const matrix = {
    version: 1,
    variants: [{
      id: "contract",
      label: "contract",
      expected: { requiredDocuments: [] },
    }],
    baseScenarios: [{
      id: "sds-contract",
      question: "화학물질 세척 작업",
      expected: {
        region: "울산",
        industry: "제조",
        workType: "화학물질 세척",
        hazards: ["SDS", "환기"],
        workerSignals: [],
        weatherSignals: [],
        foreignLanguageSignals: [],
        requiredDocuments: ["riskAssessmentDraft"],
        contentContracts: [{
          id: "sds",
          documents: ["riskAssessmentDraft"],
          requiredAnyGroups,
          forbiddenAny: ["법적 의무로 확정"],
        }],
      },
    }],
  };
  fs.writeFileSync(casesPath, `${JSON.stringify(matrix, null, 2)}\n`, "utf8");
  const result = spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SAFECLAW_MATRIX_CASES_PATH: casesPath,
      SAFECLAW_MATRIX_OUT_DIR: outputDir,
    },
    encoding: "utf8",
  });
  const report = JSON.parse(
    fs.readFileSync(path.join(outputDir, "report.json"), "utf8"),
  ) as MatrixRunReport;
  fs.rmSync(root, { recursive: true, force: true });
  return { status: result.status, report };
}

describe("SafeClaw quality matrix content contracts", () => {
  it("passes required semantic groups reflected in the selected documents", () => {
    const result = runMatrix([["SDS", "물질안전보건자료"], ["환기"]]);

    expect(result.status).toBe(0);
    expect(result.report).toMatchObject({ total: 1, pass: 1, fail: 0 });
  });

  it("fails closed when a required semantic group is absent", () => {
    const result = runMatrix([["존재하지 않는 확인 문구"]]);

    expect(result.status).toBe(1);
    expect(result.report).toMatchObject({ total: 1, pass: 0, fail: 1 });
    expect(result.report.failureSamples[0]?.failedChecks).toContainEqual(expect.objectContaining({
      name: "contract:sds:required:0",
      message: expect.stringContaining("missing required semantic group"),
    }));
  });
});
