#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const baseUrl = process.env.SAFETYGUARD_BASE_URL || "http://127.0.0.1:3021";
const casesPath = process.env.SAFETYGUARD_CASES_PATH || path.join(process.cwd(), "scripts", "e2e_scenario_cases.json");
const outDir = process.env.SAFETYGUARD_OUT_DIR || path.join(process.cwd(), "evaluation", "2026-04-25-scenario-e2e");

fs.mkdirSync(outDir, { recursive: true });
const testCases = JSON.parse(fs.readFileSync(casesPath, "utf-8"));
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.SAFETYGUARD_E2E_TIMEOUT_MS || "45000", 10);

if (!Array.isArray(testCases) || testCases.length === 0) {
  throw new Error("No E2E scenario cases found");
}

const details = [];
let okCount = 0;
let failCount = 0;
let pageChecks = {
  homeStatus: null,
  askPageStatus: null,
  ok: false,
};

try {
  const [homeResponse, askPageResponse] = await Promise.all([
    fetchWithTimeout(`${baseUrl}/`),
    fetchWithTimeout(`${baseUrl}/ask?q=${encodeURIComponent(testCases[0]?.question || "")}`),
  ]);
  const [homeHtml, askHtml] = await Promise.all([homeResponse.text(), askPageResponse.text()]);
  pageChecks = {
    homeStatus: homeResponse.status,
    askPageStatus: askPageResponse.status,
    ok: homeResponse.ok && askPageResponse.ok && homeHtml.includes("공모전 골든패스") && askHtml.includes("질문형 확인 화면"),
  };
} catch (error) {
  pageChecks = {
    homeStatus: null,
    askPageStatus: null,
    ok: false,
  };
}

function fetchWithTimeout(url, init = {}) {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

for (const testCase of testCases) {
  const startedAt = Date.now();
  try {
    const apiAskResponse = await fetchWithTimeout(`${baseUrl}/api/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: testCase.question })
    });
    const apiSearchResponse = await fetchWithTimeout(`${baseUrl}/api/search?q=${encodeURIComponent(testCase.companyName)}`);

    const askJson = await apiAskResponse.json();
    const searchJson = await apiSearchResponse.json();
    const elapsedMs = Date.now() - startedAt;

    const hasDeliverables =
      typeof askJson?.deliverables?.riskAssessmentDraft === "string" &&
      typeof askJson?.deliverables?.tbmBriefing === "string" &&
      typeof askJson?.deliverables?.tbmLogDraft === "string" &&
      typeof askJson?.deliverables?.safetyEducationRecordDraft === "string";
    const companyMatched = askJson?.scenario?.companyName === testCase.companyName;
    const searchWorked = apiSearchResponse.ok && Array.isArray(searchJson?.results);

    const ok = Boolean(
      pageChecks.ok &&
      apiAskResponse.ok &&
      searchWorked &&
      hasDeliverables &&
      companyMatched
    );

    if (ok) okCount += 1;
    else failCount += 1;

    details.push({
      id: testCase.id,
      label: testCase.label,
      ok,
      elapsedMs,
      companyMatched,
      homeStatus: pageChecks.homeStatus,
      askPageStatus: pageChecks.askPageStatus,
      apiAskStatus: apiAskResponse.status,
      apiSearchStatus: apiSearchResponse.status,
      mode: askJson?.mode || null,
      companyName: askJson?.scenario?.companyName || null,
      companyType: askJson?.scenario?.companyType || null,
      searchCount: searchJson?.count ?? null,
      answerPreview: String(askJson?.answer || "").slice(0, 180)
    });
  } catch (error) {
    failCount += 1;
    details.push({
      id: testCase.id,
      label: testCase.label,
      ok: false,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

const elapsedList = details.map((item) => item.elapsedMs).sort((a, b) => a - b);
const avgMs = elapsedList.length ? Math.round(elapsedList.reduce((sum, value) => sum + value, 0) / elapsedList.length) : 0;
const p95Ms = elapsedList.length ? elapsedList[Math.min(elapsedList.length - 1, Math.floor(elapsedList.length * 0.95))] : 0;

const summary = {
  baseUrl,
  totalRuns: testCases.length,
  okCount,
  failCount,
  avgMs,
  p95Ms,
  generatedAt: new Date().toISOString()
};

const reportLines = [
  "# SafetyGuard scenario E2E report",
  "",
  `- generatedAt: ${summary.generatedAt}`,
  `- baseUrl: ${summary.baseUrl}`,
  `- totalRuns: ${summary.totalRuns}`,
  `- okCount: ${summary.okCount}`,
  `- failCount: ${summary.failCount}`,
  `- avgMs: ${summary.avgMs}`,
  `- p95Ms: ${summary.p95Ms}`,
  "",
  "## Results",
  "",
  ...details.map((item) => [
    `### ${item.label}`,
    `- id: ${item.id}`,
    `- ok: ${item.ok}`,
    `- companyName: ${item.companyName ?? "n/a"}`,
    `- companyType: ${item.companyType ?? "n/a"}`,
    `- mode: ${item.mode ?? "n/a"}`,
    `- elapsedMs: ${item.elapsedMs}`,
    `- searchCount: ${item.searchCount ?? "n/a"}`,
    item.error ? `- error: ${item.error}` : `- preview: ${item.answerPreview}`,
    ""
  ].join("\n"))
];

fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(outDir, "details.json"), JSON.stringify(details, null, 2));
fs.writeFileSync(path.join(outDir, "report.md"), reportLines.join("\n"));

console.log(JSON.stringify(summary, null, 2));
process.exit(failCount === 0 ? 0 : 1);
