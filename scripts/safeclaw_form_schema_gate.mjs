#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const outDir = path.resolve(process.env.SAFECLAW_FORM_GATE_OUT_DIR || path.join(process.cwd(), "evaluation", "2026-05-08-form-standard-review"));
const fixturesPath = path.resolve(process.env.SAFECLAW_FORM_GATE_FIXTURES || path.join(process.cwd(), "scripts", "safeclaw_form_schema_gate_fixtures.json"));

const fourMValues = ["Man", "Machine", "Media", "Management"];
const accidentTypeValues = [
  "fall",
  "slip",
  "struckBy",
  "caughtIn",
  "cut",
  "burn",
  "electricShock",
  "chemicalExposure",
  "asphyxiation",
  "heatIllness",
  "traffic",
  "collapse",
  "fireExplosion",
  "other"
];
const riskLevelValues = ["low", "medium", "high"];
const requiredFields = [
  "process",
  "task",
  "hazard",
  "fourM",
  "accidentType",
  "currentControls",
  "likelihood",
  "severity",
  "riskLevel",
  "additionalControls",
  "owner",
  "due",
  "verification",
  "whyLikelihood",
  "whySeverity",
  "evidenceRefs"
];
const stringFields = [
  "process",
  "task",
  "hazard",
  "currentControls",
  "additionalControls",
  "owner",
  "due",
  "verification",
  "whyLikelihood",
  "whySeverity"
];
const weatherLinkTerms = [
  "기상",
  "날씨",
  "강풍",
  "풍속",
  "우천",
  "비",
  "젖",
  "누수",
  "호우",
  "폭염",
  "고온",
  "한파",
  "결빙",
  "실내",
  "환기",
  "습기"
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return { readError: error instanceof Error ? error.message : String(error) };
  }
}

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isRiskScale(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

function expectedRiskLevel(likelihood, severity) {
  const value = likelihood * severity;
  if (value >= 10) return "high";
  if (value >= 5) return "medium";
  return "low";
}

function extractRows(value) {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  const rows = value.rows || value.riskAssessmentRows || value.structuredRiskRows;
  return Array.isArray(rows) ? rows : [];
}

function parseRows(value) {
  const inputRows = extractRows(value);
  const rows = [];
  const issues = [];

  inputRows.forEach((row, index) => {
    if (!isRecord(row)) {
      issues.push({ id: `schema:${index}:row`, severity: "blocker", rowIndex: index, field: "row", message: "row must be an object" });
      return;
    }

    for (const field of requiredFields) {
      if (!(field in row)) {
        issues.push({ id: `schema:${index}:${field}`, severity: "blocker", rowIndex: index, field, message: "required field is missing" });
      }
    }
    for (const field of stringFields) {
      if (!isNonEmptyString(row[field])) {
        issues.push({ id: `schema:${index}:${field}`, severity: "blocker", rowIndex: index, field, message: "must be a non-empty string" });
      }
    }
    if (!fourMValues.includes(row.fourM)) {
      issues.push({ id: `schema:${index}:fourM`, severity: "blocker", rowIndex: index, field: "fourM", message: `must be one of ${fourMValues.join(", ")}` });
    }
    if (!accidentTypeValues.includes(row.accidentType)) {
      issues.push({ id: `schema:${index}:accidentType`, severity: "blocker", rowIndex: index, field: "accidentType", message: "must be a supported accidentType" });
    }
    if (!isRiskScale(row.likelihood)) {
      issues.push({ id: `schema:${index}:likelihood`, severity: "blocker", rowIndex: index, field: "likelihood", message: "must be an integer from 1 to 5" });
    }
    if (!isRiskScale(row.severity)) {
      issues.push({ id: `schema:${index}:severity`, severity: "blocker", rowIndex: index, field: "severity", message: "must be an integer from 1 to 5" });
    }
    if (!riskLevelValues.includes(row.riskLevel)) {
      issues.push({ id: `schema:${index}:riskLevel`, severity: "blocker", rowIndex: index, field: "riskLevel", message: `must be one of ${riskLevelValues.join(", ")}` });
    }
    const evidenceRefs = Array.isArray(row.evidenceRefs)
      ? row.evidenceRefs.filter((item) => isNonEmptyString(item)).map((item) => item.trim())
      : [];
    if (!evidenceRefs.length) {
      issues.push({ id: `schema:${index}:evidenceRefs`, severity: "blocker", rowIndex: index, field: "evidenceRefs", message: "must include at least one non-empty string" });
    }
    if (isNonEmptyString(row.due) && !/^\d{4}-\d{2}-\d{2}$|^현장 확인$/.test(row.due.trim())) {
      issues.push({ id: `schema:${index}:due`, severity: "blocker", rowIndex: index, field: "due", message: "must be YYYY-MM-DD or 현장 확인" });
    }
    if (isRiskScale(row.likelihood) && isRiskScale(row.severity) && riskLevelValues.includes(row.riskLevel)) {
      const expected = expectedRiskLevel(row.likelihood, row.severity);
      if (row.riskLevel !== expected) {
        issues.push({ id: `risk-level-consistency:${index}`, severity: "blocker", rowIndex: index, field: "riskLevel", message: `must match likelihood and severity as ${expected}` });
      }
    }
    if (normalize(row.currentControls) && normalize(row.currentControls) === normalize(row.additionalControls)) {
      issues.push({ id: `controls-split:${index}`, severity: "blocker", rowIndex: index, field: "additionalControls", message: "currentControls and additionalControls must be split into distinct actions" });
    }

    const rowIssueCount = issues.filter((issue) => issue.rowIndex === index).length;
    if (rowIssueCount === 0) {
      rows.push({
        process: row.process.trim(),
        task: row.task.trim(),
        hazard: row.hazard.trim(),
        fourM: row.fourM,
        accidentType: row.accidentType,
        currentControls: row.currentControls.trim(),
        likelihood: row.likelihood,
        severity: row.severity,
        riskLevel: row.riskLevel,
        additionalControls: row.additionalControls.trim(),
        owner: row.owner.trim(),
        due: row.due.trim(),
        verification: row.verification.trim(),
        whyLikelihood: row.whyLikelihood.trim(),
        whySeverity: row.whySeverity.trim(),
        evidenceRefs
      });
    }
  });

  if (!inputRows.length) {
    issues.push({ id: "schema:-1:row", severity: "blocker", rowIndex: -1, field: "row", message: "risk assessment rows array is missing or empty" });
  }
  return { rows, issues, inputRowCount: inputRows.length };
}

function firstMeaningfulToken(value) {
  return String(value || "")
    .split(/[\s,./·()\-]+/)
    .map((item) => item.trim())
    .find((item) => item.length >= 2) || "";
}

function includesAny(text, terms) {
  const normalized = normalize(text);
  return terms.some((term) => normalized.includes(normalize(term)));
}

function rowSearchText(row) {
  return [
    row.process,
    row.task,
    row.hazard,
    row.currentControls,
    row.additionalControls,
    row.verification,
    row.whyLikelihood,
    row.whySeverity,
    ...row.evidenceRefs
  ].join(" ");
}

function isHazardLinkedToTbm(row, tbmText) {
  const normalizedTbm = normalize(tbmText);
  const hazard = normalize(row.hazard);
  const task = normalize(row.task);
  const token = firstMeaningfulToken(row.hazard);
  return Boolean(
    (hazard && normalizedTbm.includes(hazard))
    || (task && normalizedTbm.includes(task))
    || (token && normalizedTbm.includes(normalize(token)))
  );
}

function verdictFromIssues(issues) {
  if (issues.some((issue) => issue.severity === "blocker")) return "blocked";
  if (issues.some((issue) => issue.severity === "notice")) return "pass_with_notice";
  return "pass";
}

function evaluateCase(testCase, minimumHazardRows) {
  const parsed = parseRows(testCase.rows);
  const issues = [...parsed.issues];
  const rows = parsed.rows;

  if (rows.length < minimumHazardRows) {
    issues.push({ id: "hazard-row-count", severity: "blocker", field: "row", message: `risk assessment requires at least ${minimumHazardRows} complete hazard rows` });
  }

  const fourMCoverage = fourMValues.filter((value) => rows.some((row) => row.fourM === value));
  if (rows.length && fourMCoverage.length < Math.min(2, rows.length)) {
    issues.push({ id: "four-m-coverage", severity: "notice", field: "fourM", message: "4M mapping is present but too narrow for a multi-row assessment" });
  }

  const tbmText = [testCase.tbmBriefing || "", testCase.tbmLog || ""].join("\n");
  if (!normalize(tbmText)) {
    issues.push({ id: "tbm-linkage-missing", severity: "blocker", field: "tbm", message: "TBM briefing/log text is required to prove risk-to-TBM linkage" });
  } else {
    const linkedRows = rows.filter((row) => isHazardLinkedToTbm(row, tbmText));
    const minimumLinkedRows = Math.min(rows.length, minimumHazardRows);
    if (linkedRows.length < minimumLinkedRows) {
      issues.push({ id: "tbm-risk-row-linkage", severity: "blocker", field: "tbm", message: `TBM must reference at least ${minimumLinkedRows} risk rows` });
    }
  }

  if (normalize(testCase.weatherNote || testCase.weatherSummary || "")) {
    const rowWeatherLinked = rows.some((row) => includesAny(rowSearchText(row), weatherLinkTerms));
    const tbmWeatherLinked = includesAny(tbmText, weatherLinkTerms);
    if (!rowWeatherLinked || !tbmWeatherLinked) {
      issues.push({ id: "weather-linkage", severity: "blocker", field: "weather", message: "weather or site-condition evidence must be linked in both risk rows and TBM text" });
    }
  } else {
    issues.push({ id: "weather-context-not-provided", severity: "notice", field: "weather", message: "weatherSummary/weatherNote was not supplied, so weather linkage could not be proven" });
  }

  const verdict = verdictFromIssues(issues);
  return {
    id: testCase.id,
    title: testCase.title,
    question: testCase.question,
    expectedVerdict: testCase.expectedVerdict,
    verdict,
    expectationMet: verdict === testCase.expectedVerdict,
    rowCount: rows.length,
    inputRowCount: parsed.inputRowCount,
    fourMCoverage,
    blockerCount: issues.filter((issue) => issue.severity === "blocker").length,
    noticeCount: issues.filter((issue) => issue.severity === "notice").length,
    issues
  };
}

function summarizeCurrentSmoke() {
  const quality = readJsonIfExists(path.join(process.cwd(), "evaluation", "quality-matrix", "report.json"));
  const submission = readJsonIfExists(path.join(process.cwd(), "evaluation", "submission-readiness", "submission-readiness-summary.json"));
  const download = readJsonIfExists(path.join(process.cwd(), "evaluation", "2026-04-29-orchestration-download-smoke", "api-orchestration-download-smoke.json"));
  const formReview = fs.existsSync(path.join(outDir, "form-standard-review.md"))
    ? fs.readFileSync(path.join(outDir, "form-standard-review.md"), "utf8")
    : "";

  return {
    qualityMatrix: quality ? {
      generatedAt: quality.generatedAt || null,
      mode: quality.mode || null,
      total: quality.total ?? null,
      pass: quality.pass ?? null,
      fail: quality.fail ?? null,
      evidence: "keyword/document reflection matrix; row completeness is not checked"
    } : null,
    submissionSmoke: submission ? {
      generatedAt: submission.generatedAt || null,
      baseUrl: submission.baseUrl || null,
      overall: submission.overall || null,
      gates: Array.isArray(submission.gates) ? submission.gates.map((gate) => ({ name: gate.name, verdict: gate.verdict })) : [],
      evidence: "ask orchestration passed, but storage/auth or local Chrome format gate can block"
    } : null,
    downloadSmoke: download ? {
      generatedAt: download.generatedAt || null,
      baseUrl: download.baseUrl || null,
      ok: download.ok ?? null,
      downloadCount: Array.isArray(download.downloads) ? download.downloads.length : null,
      failCount: download.failCount ?? null,
      evidence: "download files were generated, but previous gate did not prove structured row completeness"
    } : null,
    formStandardReview: formReview ? {
      path: path.relative(process.cwd(), path.join(outDir, "form-standard-review.md")),
      finding: formReview.includes("blocked") ? "existing review already marks SaaS/submission-form standard as blocked" : "review file exists"
    } : null
  };
}

function buildMarkdown(report) {
  const lines = [
    "# SafeClaw Form Schema Gate",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Current Smoke Baseline",
    "",
    `- Quality matrix: ${report.currentSmoke.qualityMatrix ? `${report.currentSmoke.qualityMatrix.pass}/${report.currentSmoke.qualityMatrix.total} local deterministic pass (${report.currentSmoke.qualityMatrix.evidence})` : "not found"}`,
    `- Submission smoke: ${report.currentSmoke.submissionSmoke ? `${report.currentSmoke.submissionSmoke.overall} (${report.currentSmoke.submissionSmoke.evidence})` : "not found"}`,
    `- Download smoke: ${report.currentSmoke.downloadSmoke ? `${report.currentSmoke.downloadSmoke.ok ? "pass" : "blocked"} / downloads ${report.currentSmoke.downloadSmoke.downloadCount}, failures ${report.currentSmoke.downloadSmoke.failCount}` : "not found"}`,
    "",
    "## Gate Verdict",
    "",
    `- Overall: ${report.overall}`,
    `- Fixture expectations met: ${report.expectationPass}/${report.caseCount}`,
    `- Golden fixture pass: ${report.goldenPass}/${report.goldenCount}`,
    "",
    "## Golden Cases",
    "",
    "| Case | Verdict | Rows | 4M coverage | Issues |",
    "| --- | --- | ---: | --- | ---: |",
    ...report.cases.map((item) => `| ${item.id} | ${item.verdict} | ${item.rowCount} | ${item.fourMCoverage.join(", ") || "-"} | ${item.issues.length} |`),
    "",
    "## Defects This Validator Catches",
    "",
    "- Missing or empty structured hazard rows, even when free-text keywords are present.",
    "- Invalid 4M, accident type, likelihood/severity scale, due date, owner, verification, and evidenceRefs fields.",
    "- riskLevel values that do not match likelihood x severity.",
    "- currentControls and additionalControls collapsed into the same generic text.",
    "- TBM text that does not reference the risk rows.",
    "- Weather or site-condition evidence that is not connected to both risk rows and TBM.",
    "",
    "## Decision Evidence",
    "",
    `- Current baseline verdict: ${report.decision.currentBaselineVerdict}`,
    `- New row gate verdict: ${report.decision.newRowGateVerdict}`,
    `- Recommended decision: ${report.decision.recommendedDecision}`,
    "",
    "## Files",
    "",
    `- JSON: ${path.relative(process.cwd(), path.join(outDir, "form-schema-gate-report.json"))}`,
    `- Fixtures: ${path.relative(process.cwd(), fixturesPath)}`
  ];

  return `${lines.join("\n")}\n`;
}

ensureDir(outDir);

const startedAt = Date.now();
const fixtureBundle = JSON.parse(fs.readFileSync(fixturesPath, "utf8"));
const cases = Array.isArray(fixtureBundle.cases) ? fixtureBundle.cases : [];
const minimumHazardRows = Number.isInteger(fixtureBundle.minimumHazardRows) ? fixtureBundle.minimumHazardRows : 3;
const results = cases.map((testCase) => evaluateCase(testCase, minimumHazardRows));
const expectationPass = results.filter((item) => item.expectationMet).length;
const goldenCases = results.filter((item) => item.expectedVerdict === "pass");
const goldenPass = goldenCases.filter((item) => item.verdict === "pass").length;
const overall = expectationPass === results.length && goldenPass === goldenCases.length ? "pass_with_notice" : "blocked";
const currentSmoke = summarizeCurrentSmoke();

const report = {
  generatedAt: new Date().toISOString(),
  elapsedMs: Date.now() - startedAt,
  fixturesPath: path.relative(process.cwd(), fixturesPath),
  minimumHazardRows,
  caseCount: results.length,
  expectationPass,
  goldenCount: goldenCases.length,
  goldenPass,
  overall,
  currentSmoke,
  cases: results,
  decision: {
    currentBaselineVerdict: currentSmoke.submissionSmoke?.overall || "pass_with_notice",
    newRowGateVerdict: overall,
    recommendedDecision: overall === "blocked" ? "blocked" : "pass_with_notice"
  }
};

fs.writeFileSync(path.join(outDir, "form-schema-gate-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(outDir, "form-schema-gate-report.md"), buildMarkdown(report), "utf8");

console.log(JSON.stringify({
  overall,
  caseCount: report.caseCount,
  expectationPass,
  goldenPass,
  goldenCount: report.goldenCount,
  outDir: path.relative(process.cwd(), outDir)
}, null, 2));

process.exit(overall === "blocked" ? 1 : 0);
