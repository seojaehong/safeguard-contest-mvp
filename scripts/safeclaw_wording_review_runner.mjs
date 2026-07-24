#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const casesPath = path.resolve(
  process.env.SAFECLAW_WORDING_CASES_PATH
    || path.join(process.cwd(), "evaluation", "live-document-quality-stress-matrix-2026-07-24", "scenarios.json")
);
const outDir = path.resolve(
  process.env.SAFECLAW_WORDING_OUT_DIR
    || path.join(process.cwd(), "evaluation", "live-document-wording-review-2026-07-24")
);
const payloadsPath = process.env.SAFECLAW_WORDING_PAYLOADS_PATH
  ? path.resolve(process.env.SAFECLAW_WORDING_PAYLOADS_PATH)
  : "";
const baseUrl = process.env.SAFECLAW_WORDING_BASE_URL || "https://www.safeclaw.kr";
const liveEnabled = process.env.SAFECLAW_WORDING_LIVE === "1";
const timeoutMs = Number.parseInt(process.env.SAFECLAW_WORDING_TIMEOUT_MS || "60000", 10);
const localProduction = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(baseUrl);

const reviewedDocumentKeys = [
  "riskAssessmentDraft",
  "workPlanDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft"
];
const requiredRiskFields = [
  "hazard",
  "currentControls",
  "additionalControls",
  "owner",
  "due",
  "verification"
];
const uncertaintyTerms = ["현장 확인", "확인 필요", "미확정", "검토 필요"];
const actionTerms = [
  "확인",
  "점검",
  "중지",
  "통제",
  "분리",
  "설치",
  "배치",
  "착용",
  "교체",
  "보수",
  "기록",
  "보고",
  "복창",
  "교육",
  "측정",
  "차단",
  "잠금",
  "표시",
  "제거",
  "금지"
];
const vagueTerms = ["적절히", "철저히", "충분히", "주의한다", "유의한다", "필요시", "필요 시"];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value) {
  return text(value)
    .replace(/^[\s\-*•·\d.)\]]+/, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?。]+$/g, "")
    .trim()
    .toLowerCase();
}

function includesAny(value, terms) {
  const normalized = text(value).toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

function excerpt(value, limit = 160) {
  const normalized = text(value).replace(/\s+/g, " ");
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}

function buildCases(matrix) {
  const variants = asArray(matrix.variants);
  const baseScenarios = asArray(matrix.baseScenarios);
  if (!baseScenarios.length || !variants.length) {
    throw new Error("wording review requires baseScenarios and variants");
  }
  const fieldIsolationProfiles = baseScenarios.map((scenario) => ({
    id: scenario.id,
    terms: asArray(scenario.expected?.fieldIsolationExclusiveTerms).map(text).filter(Boolean)
  }));
  return baseScenarios.flatMap((scenario) => variants.map((variant) => ({
    id: `${scenario.id}__${variant.id}`,
    question: `${scenario.question} ${variant.promptSuffix || ""}`.replace(/\s+/g, " ").trim(),
    expected: {
      ...(scenario.expected || {}),
      ...(variant.expected || {}),
      requiredDocuments: [
        ...new Set([
          ...asArray(scenario.expected?.requiredDocuments),
          ...asArray(variant.expected?.requiredDocuments)
        ])
      ],
      fieldIsolationTerms: [
        ...new Set([
          ...asArray(scenario.expected?.fieldIsolationTerms),
          ...asArray(variant.expected?.fieldIsolationTerms)
        ].map(text).filter(Boolean))
      ],
      otherFieldIsolationProfiles: fieldIsolationProfiles.filter((profile) => profile.id !== scenario.id)
    }
  })));
}

function readRiskRows(payload) {
  const rows = payload?.structured?.riskAssessmentRows;
  return Array.isArray(rows) ? rows : [];
}

function readDocument(payload, key) {
  return text(payload?.deliverables?.[key]);
}

function findDuplicateValues(values) {
  const counts = new Map();
  for (const value of values.map(normalize).filter((item) => item.length >= 18)) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value, count]) => ({ value: excerpt(value), count }));
}

function documentLines(payload) {
  return reviewedDocumentKeys.flatMap((key) => (
    readDocument(payload, key)
      .split(/\r?\n/)
      .map((line) => ({ key, line: text(line) }))
      .filter((item) => normalize(item.line).length >= 18)
  ));
}

function isEvidenceMetadataLine(line) {
  return /^-\s*(?:KOSHA 사고사례|SIF 유사사례|법령 근거)\s*\/\s*반영 위치:/.test(text(line));
}

function checkDocumentUsability(payload) {
  const checks = [];
  for (const key of reviewedDocumentKeys) {
    const value = readDocument(payload, key);
    checks.push({
      id: `document:${key}:present`,
      ok: value.length >= 40,
      detail: value.length >= 40 ? "" : `${key} is missing or too short`
    });
  }

  const lines = documentLines(payload);
  const overlong = lines.filter(({ line }) => line.length > 220 && !isEvidenceMetadataLine(line));
  const duplicateLines = reviewedDocumentKeys
    .filter((key) => key !== "riskAssessmentDraft")
    .flatMap((key) => (
    findDuplicateValues(lines.filter((item) => item.key === key).map(({ line }) => line))
      .map((item) => ({ key, ...item }))
    ));
  checks.push({
    id: "documents:lineLength",
    ok: overlong.length === 0,
    detail: overlong.length ? `${overlong.length} line(s) exceed 220 characters` : "",
    samples: overlong.slice(0, 5).map(({ key, line }) => ({ key, text: excerpt(line) }))
  });
  checks.push({
    id: "documents:exactDuplicateLines",
    ok: duplicateLines.length === 0,
    detail: duplicateLines.length ? `${duplicateLines.length} actionable line(s) are repeated exactly` : "",
    samples: duplicateLines.slice(0, 5)
  });
  return checks;
}

function checkRiskRows(payload, expected, question) {
  const rows = readRiskRows(payload);
  const missingFields = [];
  const vagueControls = [];
  const fabricatedLocations = [];

  const leadingLocation = text(question).split(/\s+/)[0]?.replace(/[^가-힣A-Za-z0-9]/g, "") || "";
  const expectedLocationTerms = [leadingLocation, text(expected.region)].filter(Boolean);

  rows.forEach((row, index) => {
    for (const field of requiredRiskFields) {
      if (!text(row?.[field])) missingFields.push({ row: index, field });
    }
    for (const field of ["currentControls", "additionalControls"]) {
      const value = text(row?.[field]);
      if (
        value
        && includesAny(value, vagueTerms)
        && !includesAny(value, actionTerms)
        && !includesAny(value, uncertaintyTerms)
      ) {
        vagueControls.push({ row: index, field, text: excerpt(value) });
      }
    }

    const location = text(row?.location);
    if (
      location
      && expectedLocationTerms.length
      && !expectedLocationTerms.some((term) => location.includes(term))
      && !includesAny(location, uncertaintyTerms)
    ) {
      fabricatedLocations.push({ row: index, text: excerpt(location) });
    }
  });

  const duplicateControls = findDuplicateValues(rows.flatMap((row) => [
    text(row?.currentControls),
    text(row?.additionalControls)
  ]));
  const sameRowControls = rows.flatMap((row, index) => (
    normalize(row?.currentControls)
    && normalize(row?.currentControls) === normalize(row?.additionalControls)
      ? [index]
      : []
  ));

  return [
    {
      id: "riskRows:present",
      ok: rows.length > 0,
      detail: rows.length ? "" : "structured risk rows are missing"
    },
    {
      id: "riskRows:requiredFields",
      ok: rows.length > 0 && missingFields.length === 0,
      detail: missingFields.length ? `${missingFields.length} required risk field(s) are empty` : "",
      samples: missingFields.slice(0, 8)
    },
    {
      id: "riskRows:scenarioLocation",
      ok: rows.length > 0 && fabricatedLocations.length === 0,
      detail: fabricatedLocations.length
        ? `${fabricatedLocations.length} location field(s) contradict the requested region instead of staying unresolved`
        : "",
      samples: fabricatedLocations.slice(0, 5)
    },
    {
      id: "riskRows:distinctControls",
      ok: rows.length > 0 && sameRowControls.length === 0 && duplicateControls.length === 0,
      detail: sameRowControls.length || duplicateControls.length
        ? `duplicated controls found in ${sameRowControls.length} row(s) and ${duplicateControls.length} repeated value group(s)`
        : "",
      samples: duplicateControls.slice(0, 5)
    },
    {
      id: "riskRows:actionableControls",
      ok: rows.length > 0 && vagueControls.length === 0,
      detail: vagueControls.length ? `${vagueControls.length} control field(s) use vague wording without a concrete action` : "",
      samples: vagueControls.slice(0, 5)
    }
  ];
}

function checkScenarioFieldIsolation(payload, expected) {
  const rows = readRiskRows(payload);
  const fields = ["process", "task", "equipment"];
  const ownTerms = asArray(expected.fieldIsolationTerms).map(text).filter(Boolean);
  const otherProfiles = [
    ...asArray(expected.otherFieldIsolationProfiles),
    ...asArray(expected.forbiddenFieldTerms)
  ].map((profile, index) => ({
    id: text(profile?.id) || `forbidden-profile-${index + 1}`,
    terms: asArray(profile?.terms).map(text).filter(Boolean)
  }));
  const fieldValues = rows.flatMap((row, rowIndex) => fields.flatMap((field) => {
    const value = text(row?.[field]);
    return value ? [{ row: rowIndex, field, value }] : [];
  }));
  const ownTermMatches = ownTerms.filter((term) => fieldValues.some(({ value }) => includesAny(value, [term])));
  const leakageFlags = fieldValues.flatMap(({ row, field, value }) => otherProfiles.flatMap((profile) => (
    profile.terms
      .filter((term) => includesAny(value, [term]))
      .map((term) => ({
        row,
        field,
        value: excerpt(value),
        matchedProfile: profile.id,
        matchedTerm: term
      }))
  )));

  return {
    checks: [
      {
        id: "riskRows:scenarioFieldGrounding",
        ok: rows.length > 0 && ownTerms.length > 0 && ownTermMatches.length > 0,
        detail: ownTerms.length === 0
          ? "scenario field isolation terms are not configured"
          : ownTermMatches.length === 0
            ? "process/task/equipment fields do not reflect the requested scenario fingerprint"
            : "",
        samples: ownTerms.length && ownTermMatches.length === 0 ? ownTerms.slice(0, 8) : []
      },
      {
        id: "riskRows:crossScenarioFieldLeakage",
        ok: rows.length > 0 && leakageFlags.length === 0,
        detail: leakageFlags.length
          ? `${leakageFlags.length} process/task/equipment field value(s) contain another scenario fingerprint`
          : "",
        samples: leakageFlags.slice(0, 8)
      }
    ],
    metrics: {
      scenarioSnapshot: {
        region: text(expected.region),
        workType: text(expected.workType),
        fieldIsolationTerms: ownTerms,
        matchedFieldIsolationTerms: ownTermMatches
      },
      uniqueProcessValues: [...new Set(rows.map((row) => text(row?.process)).filter(Boolean))].slice(0, 12),
      uniqueEquipmentValues: [...new Set(rows.map((row) => text(row?.equipment)).filter(Boolean))].slice(0, 12),
      fieldLeakageFlags: leakageFlags.slice(0, 20)
    }
  };
}

export function reviewPayload(payload, expected, question = "") {
  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      checks: [{ id: "payload:object", ok: false, detail: "payload is not an object" }],
      metrics: { riskRowCount: 0, reviewedDocumentCount: 0 }
    };
  }
  const fieldIsolation = checkScenarioFieldIsolation(payload, expected);
  const checks = [
    ...checkDocumentUsability(payload),
    ...checkRiskRows(payload, expected, question),
    ...fieldIsolation.checks
  ];
  return {
    ok: checks.every((check) => check.ok),
    checks,
    metrics: {
      riskRowCount: readRiskRows(payload).length,
      reviewedDocumentCount: reviewedDocumentKeys.filter((key) => readDocument(payload, key).length >= 40).length,
      ...fieldIsolation.metrics
    }
  };
}

async function fetchPayload(testCase) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/g, "")}/api/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: testCase.question }),
      signal: controller.signal
    });
    const body = await response.text();
    let payload = null;
    try {
      payload = JSON.parse(body);
    } catch {
      payload = null;
    }
    return {
      payload,
      api: {
        status: response.status,
        ok: response.ok,
        elapsedMs: Date.now() - startedAt
      }
    };
  } finally {
    clearTimeout(timer);
  }
}

function writeJson(fileName, payload) {
  fs.writeFileSync(path.join(outDir, fileName), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readSourceHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8"
    }).trim();
  } catch {
    return "";
  }
}

async function readBuildInfo() {
  if (!liveEnabled) return null;
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/g, "")}/api/build-info?codexCacheBust=wording-review`);
    if (!response.ok) return { ok: false, status: response.status };
    return await response.json();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function writeMarkdown(report) {
  const rows = report.cases.map((item) => (
    `| ${item.id} | ${item.verdict} | ${item.metrics.riskRowCount} | ${item.metrics.reviewedDocumentCount} | ${item.failedChecks.map((check) => check.id).join(", ") || "-"} |`
  )).join("\n");
  const markdown = `# Live Document Wording Review

- Verdict: \`${report.verdict}\`
- Source mode: \`${report.mode}\`
- Base URL: \`${report.baseUrl || "fixture"}\`
- Source HEAD: \`${report.sourceHead || "unavailable"}\`
- Production commit: \`${report.productionBuild?.commitSha || "not measured"}\`
- Cases: ${report.total}, pass ${report.pass}, fail ${report.fail}
- DB mutation performed: \`false\`
- Share session created: \`false\`
- Provider dispatch called: \`false\`

| Case | Verdict | Risk rows | Reviewed docs | Failed checks |
|---|---:|---:|---:|---|
${rows}

## Boundary

This gate reviews synthetic document wording and field usability. It does not approve broad launch wording, create or mutate saved Share sessions, dispatch providers, or replace human review of production user documents.
`;
  fs.writeFileSync(path.join(outDir, "report.md"), markdown, "utf8");
}

async function main() {
  const matrix = readJson(casesPath);
  const cases = buildCases(matrix);
  const fixtures = payloadsPath ? readJson(payloadsPath) : {};
  if (!liveEnabled && !payloadsPath) {
    throw new Error("set SAFECLAW_WORDING_LIVE=1 or provide SAFECLAW_WORDING_PAYLOADS_PATH");
  }

  fs.mkdirSync(outDir, { recursive: true });
  const startedAt = Date.now();
  const sourceHead = readSourceHead();
  const productionBuild = await readBuildInfo();
  const results = [];
  for (const testCase of cases) {
    const caseStartedAt = Date.now();
    let api = null;
    let payload = fixtures[testCase.id] || null;
    let runnerError = "";
    try {
      if (liveEnabled) {
        const fetched = await fetchPayload(testCase);
        payload = fetched.payload;
        api = fetched.api;
      }
    } catch (error) {
      runnerError = error instanceof Error ? error.message : String(error);
    }
    const reviewed = runnerError
      ? {
        ok: false,
        checks: [{ id: "runner:error", ok: false, detail: runnerError }],
        metrics: { riskRowCount: 0, reviewedDocumentCount: 0 }
      }
      : reviewPayload(payload, testCase.expected, testCase.question);
    if (api && !api.ok) {
      reviewed.ok = false;
      reviewed.checks.unshift({
        id: "api:/api/ask",
        ok: false,
        detail: `API returned ${api.status}`
      });
    }
    results.push({
      id: testCase.id,
      verdict: reviewed.ok ? "PASS" : "RED",
      elapsedMs: Date.now() - caseStartedAt,
      api,
      metrics: reviewed.metrics,
      failedChecks: reviewed.checks.filter((check) => !check.ok)
    });
  }

  const pass = results.filter((item) => item.verdict === "PASS").length;
  const report = {
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    verdict: pass === results.length
      ? liveEnabled
        ? localProduction
          ? "PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_SYNTHETIC_WORDING_REVIEW"
          : "PASS_LIVE_PRODUCTION_SYNTHETIC_WORDING_REVIEW"
        : "PASS_FIXTURE_SYNTHETIC_WORDING_REVIEW"
      : liveEnabled
        ? localProduction
          ? "RED_CURRENT_SOURCE_LOCAL_PRODUCTION_SYNTHETIC_WORDING_REVIEW"
          : "RED_LIVE_PRODUCTION_SYNTHETIC_WORDING_REVIEW"
        : "RED_FIXTURE_SYNTHETIC_WORDING_REVIEW",
    mode: liveEnabled ? localProduction ? "current-source-local-production" : "live-production" : "fixture",
    baseUrl: liveEnabled ? baseUrl : null,
    sourceHead,
    productionBuild,
    total: results.length,
    pass,
    fail: results.length - pass,
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false
    },
    cases: results
  };
  writeJson("report.json", report);
  writeJson("details.json", results);
  writeMarkdown(report);
  console.log(JSON.stringify({
    verdict: report.verdict,
    total: report.total,
    pass: report.pass,
    fail: report.fail,
    outDir: path.relative(process.cwd(), outDir)
  }, null, 2));
  process.exitCode = report.fail === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await main();
}
