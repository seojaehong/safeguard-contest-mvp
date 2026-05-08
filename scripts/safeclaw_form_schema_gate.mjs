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
const verificationStatusValues = ["planned", "done", "needsReview"];
const requiredFields = [
  "location",
  "process",
  "task",
  "equipment",
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
  "verificationStatus",
  "verificationDate",
  "verificationChecker",
  "whyLikelihood",
  "whySeverity",
  "evidenceRefs"
];
const stringFields = [
  "location",
  "process",
  "task",
  "equipment",
  "hazard",
  "currentControls",
  "additionalControls",
  "owner",
  "due",
  "verification",
  "verificationDate",
  "verificationChecker",
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
const riskAssessmentColumnContract = [
  { field: "location", header: "작업장소", required: true },
  { field: "process", header: "공정", required: true },
  { field: "task", header: "세부작업", required: true },
  { field: "equipment", header: "장비·도구", required: true },
  { field: "hazard", header: "유해·위험요인", required: true },
  { field: "fourM", header: "4M", required: true },
  { field: "accidentType", header: "재해유형", required: true },
  { field: "currentControls", header: "현재 안전조치", required: true },
  { field: "likelihood", header: "가능성", required: true },
  { field: "severity", header: "중대성", required: true },
  { field: "riskLevel", header: "위험성", required: true },
  { field: "additionalControls", header: "감소대책", required: true },
  { field: "owner", header: "담당자", required: true },
  { field: "due", header: "조치기한", required: true },
  { field: "verificationStatus", header: "확인상태", required: true },
  { field: "verificationDate", header: "확인일", required: true },
  { field: "verificationChecker", header: "확인자", required: true },
  { field: "evidenceRefs", header: "근거", required: true }
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
    if (!verificationStatusValues.includes(row.verificationStatus)) {
      issues.push({ id: `schema:${index}:verificationStatus`, severity: "blocker", rowIndex: index, field: "verificationStatus", message: `must be one of ${verificationStatusValues.join(", ")}` });
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
    if (isNonEmptyString(row.verificationDate) && !/^\d{4}-\d{2}-\d{2}$|^현장 확인$/.test(row.verificationDate.trim())) {
      issues.push({ id: `schema:${index}:verificationDate`, severity: "blocker", rowIndex: index, field: "verificationDate", message: "must be YYYY-MM-DD or 현장 확인" });
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
        location: row.location.trim(),
        process: row.process.trim(),
        task: row.task.trim(),
        equipment: row.equipment.trim(),
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
        verificationStatus: row.verificationStatus,
        verificationDate: row.verificationDate.trim(),
        verificationChecker: row.verificationChecker.trim(),
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

function evaluateColumnContract(rows) {
  const missingRequiredFields = [];
  const fieldCoverage = riskAssessmentColumnContract.map((column) => {
    const coveredRows = rows.filter((row) => {
      const value = row[column.field];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "number") return Number.isFinite(value);
      return isNonEmptyString(value);
    }).length;
    if (column.required && coveredRows !== rows.length) {
      missingRequiredFields.push(column.field);
    }
    return {
      field: column.field,
      header: column.header,
      required: column.required,
      coveredRows,
      totalRows: rows.length,
      ok: coveredRows === rows.length
    };
  });

  return {
    expectedHeaders: riskAssessmentColumnContract.map((column) => column.header),
    fieldCoverage,
    missingRequiredFields: [...new Set(missingRequiredFields)],
    verdict: missingRequiredFields.length ? "blocked" : "pass"
  };
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
    row.location,
    row.process,
    row.task,
    row.equipment,
    row.hazard,
    row.currentControls,
    row.additionalControls,
    row.verification,
    row.whyLikelihood,
    row.whySeverity,
    ...row.evidenceRefs
  ].join(" ");
}

function validateTbmRiskLinks(testCase, rows) {
  const issues = [];
  const links = Array.isArray(testCase.tbmRiskLinks) ? testCase.tbmRiskLinks : [];
  const minimumLinks = Math.min(rows.length, Number.isInteger(testCase.minimumTbmRiskLinks) ? testCase.minimumTbmRiskLinks : 3);

  if (!links.length) {
    issues.push({ id: "tbm-schema:missing", severity: "blocker", field: "tbmRiskLinks", message: "TBM schema v0.5 requires tbmRiskLinks array" });
    return { verdict: "blocked", minimumLinks, linkCount: 0, issues };
  }

  links.forEach((link, index) => {
    if (!isRecord(link)) {
      issues.push({ id: `tbm-schema:${index}:row`, severity: "blocker", field: "tbmRiskLinks", message: "tbmRiskLink must be an object" });
      return;
    }
    const requiredLinkFields = ["riskRowIndex", "hazard", "control", "weatherSignal", "confirmQuestion", "owner", "verification", "evidenceRefs"];
    for (const field of requiredLinkFields) {
      const value = link[field];
      const ok = Array.isArray(value) ? value.some((item) => isNonEmptyString(item)) : (field === "riskRowIndex" ? Number.isInteger(value) : isNonEmptyString(value));
      if (!ok) {
        issues.push({ id: `tbm-schema:${index}:${field}`, severity: "blocker", field: "tbmRiskLinks", message: `${field} is required` });
      }
    }
    if (Number.isInteger(link.riskRowIndex) && (link.riskRowIndex < 0 || link.riskRowIndex >= rows.length)) {
      issues.push({ id: `tbm-schema:${index}:riskRowIndex`, severity: "blocker", field: "tbmRiskLinks", message: "riskRowIndex must point to a risk assessment row" });
    }
    const linkedRow = Number.isInteger(link.riskRowIndex) ? rows[link.riskRowIndex] : null;
    if (linkedRow && isNonEmptyString(link.hazard) && !normalize(link.hazard).includes(normalize(firstMeaningfulToken(linkedRow.hazard)))) {
      issues.push({ id: `tbm-schema:${index}:hazard-link`, severity: "notice", field: "tbmRiskLinks", message: "linked TBM hazard should reuse the risk row hazard language" });
    }
  });

  if (links.length < minimumLinks) {
    issues.push({ id: "tbm-schema:link-count", severity: "blocker", field: "tbmRiskLinks", message: `TBM schema v0.5 requires at least ${minimumLinks} linked risk rows` });
  }

  return {
    verdict: issues.some((issue) => issue.severity === "blocker") ? "blocked" : (issues.length ? "pass_with_notice" : "pass"),
    minimumLinks,
    linkCount: links.length,
    issues
  };
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

  const columnContract = evaluateColumnContract(rows);
  if (columnContract.verdict === "blocked") {
    issues.push({ id: "column-contract", severity: "blocker", field: "row", message: `risk assessment output is missing required form columns: ${columnContract.missingRequiredFields.join(", ")}` });
  }

  const tbmSchema = validateTbmRiskLinks(testCase, rows);
  issues.push(...tbmSchema.issues);

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
    columnContract,
    tbmSchema,
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
    "## Added Verification Gates",
    "",
    "- Risk assessment column contract now requires workplace location, equipment/tools, verification status, verification date, and checker fields.",
    "- TBM schema v0.5 now requires linked risk-row references instead of accepting generic TBM prose.",
    "- The gate still treats HWPX/PDF/XLS binary visual fidelity as a separate format smoke; this script proves the structured form contract before rendering.",
    "",
    "## Risk Assessment Column Contract",
    "",
    `- Expected headers: ${report.columnContract.expectedHeaders.join(" / ")}`,
    "",
    "## TBM Schema v0.5 Contract",
    "",
    "- Each golden case must provide `tbmRiskLinks[]` with riskRowIndex, hazard, control, weatherSignal, confirmQuestion, owner, verification, and evidenceRefs.",
    "",
    "## Defects This Validator Catches",
    "",
    "- Missing or empty structured hazard rows, even when free-text keywords are present.",
    "- Invalid 4M, accident type, likelihood/severity scale, due date, owner, verification, and evidenceRefs fields.",
    "- riskLevel values that do not match likelihood x severity.",
    "- currentControls and additionalControls collapsed into the same generic text.",
    "- TBM text that does not reference the risk rows.",
    "- Weather or site-condition evidence that is not connected to both risk rows and TBM.",
    "- TBM records that mention safety generally but do not reference structured risk rows.",
    "- Render inputs that cannot fill public-institution style columns such as 작업장소, 장비·도구, 확인상태, 확인일, 확인자.",
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
  columnContract: {
    expectedHeaders: riskAssessmentColumnContract.map((column) => column.header),
    fields: riskAssessmentColumnContract
  },
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
