#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  assertFinalOutputFileBudget,
  extractBudgetedHwpxText,
  extractBudgetedXlsxText
} from "./final_output_parser_safety.mjs";
import {
  fetchBufferWithBudget,
  spawnSyncWithBudget
} from "./operator_smoke_resource_budget.mjs";

const startedAt = Date.now();
const rootDir = process.cwd();
const baseUrl = process.env.SAFECLAW_OUTPUT_INTEGRITY_BASE_URL || "https://www.safeclaw.kr";
const outDir = path.resolve(process.env.SAFECLAW_OUTPUT_INTEGRITY_OUT_DIR || path.join(rootDir, "evaluation", "final-output-integrity-audit"));
const payloadDir = path.join(outDir, "ask-payloads");
const documentDir = path.join(outDir, "documents");
const formatDir = path.join(outDir, "formats");

const scenarios = [
  {
    id: "seoul-construction-windy",
    title: "서울 건설 강풍",
    question: "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보. 추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘.",
    scenarioTerms: ["세이프건설", "서울", "도장", "비계", "강풍"]
  },
  {
    id: "incheon-logistics-rain",
    title: "인천 물류 우천",
    question: "한빛로지스 인천 남동공단 물류센터 지게차 상하차 작업. 숙련 지게차 운전자 2명과 피킹 인력 6명, 우천 후 출입구 바닥 젖음, 보행 동선과 지게차 동선이 겹친다. 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘.",
    scenarioTerms: ["한빛로지스", "인천", "지게차", "우천", "보행"]
  },
  {
    id: "ansan-manufacturing-foreign-hotwork",
    title: "안산 제조 화기 외국인 포함",
    question: "그린메탈 경기 안산 공장 배관 용접·절단 화기작업. 외국인 근로자 2명과 신규 작업자 1명 포함, 작업자 6명, 실내 고온과 환기 불량, 가연물 인접. 화재감시자와 다국어 안전교육까지 반영해 위험성평가, TBM, 안전보건교육 기록을 만들어줘.",
    scenarioTerms: ["그린메탈", "안산", "용접", "외국인", "화재감시자"]
  }
];

const documentMeta = [
  ["workpackSummaryDraft", "점검결과 요약"],
  ["riskAssessmentDraft", "위험성평가표"],
  ["workPlanDraft", "작업계획서"],
  ["tbmBriefing", "TBM/작업 전 안전점검회의"],
  ["tbmLogDraft", "TBM 기록"],
  ["safetyEducationRecordDraft", "안전보건교육 기록"],
  ["emergencyResponseDraft", "비상대응 절차"],
  ["photoEvidenceDraft", "사진/증빙"],
  ["foreignWorkerBriefing", "외국인 근로자 출력본"],
  ["foreignWorkerTransmission", "외국인 근로자 전송본"],
  ["kakaoMessage", "현장 공유 메시지"]
];

const requiredTermsByKey = {
  workpackSummaryDraft: ["작업", "위험", "조치"],
  riskAssessmentDraft: ["위험성평가", "위험요인", "감소대책"],
  workPlanDraft: ["작업계획", "작업", "안전조치"],
  tbmBriefing: ["TBM", "위험", "확인"],
  tbmLogDraft: ["TBM", "참석", "확인"],
  safetyEducationRecordDraft: ["안전보건교육", "교육", "확인"],
  emergencyResponseDraft: ["비상", "연락", "대응"],
  photoEvidenceDraft: ["사진", "증빙", "확인"],
  foreignWorkerBriefing: ["외국인", "보호구", "확인"],
  foreignWorkerTransmission: ["외국인", "작업", "확인"],
  kakaoMessage: ["작업", "위험", "확인"]
};

const riskAssessmentHeaders = [
  "작업장소",
  "공정",
  "세부작업",
  "유해·위험요인",
  "가능성",
  "중대성",
  "위험성",
  "감소대책",
  "담당자",
  "확인상태",
  "근거"
];

const unresolvedPlaceholderPatterns = [
  /TODO/gi,
  /TBD/gi,
  /lorem ipsum/gi,
  /샘플/g,
  /예시/g,
  /dummy/gi,
  /placeholder/gi,
  /현장 확인 필요/g
];
const blankPattern = /____+/g;
const allowedBlankLinePattern = /(확인|서명|관리감독자|근로자|작성자|확인일시|일시|담당)/;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function safeFileName(value) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 100);
}

function countPlaceholders(text) {
  const unresolvedCount = unresolvedPlaceholderPatterns.reduce((count, pattern) => count + (text.match(pattern)?.length || 0), 0);
  const blankCount = text.split(/\r?\n/).reduce((count, line) => {
    if (/^[_\s]+$/.test(line)) return count;
    if (allowedBlankLinePattern.test(line)) return count;
    return count + (line.match(blankPattern)?.length || 0);
  }, 0);
  return unresolvedCount + blankCount;
}

function missingTerms(text, terms) {
  return terms.filter((term) => term && !text.includes(term));
}

function auditText({ key, title, text, requiredTerms, scenarioTerms, minChars = 80 }) {
  const body = typeof text === "string" ? text.trim() : "";
  const placeholderCount = countPlaceholders(body);
  const missingRequiredTerms = missingTerms(body, requiredTerms || []);
  const missingScenarioTerms = missingTerms(body, scenarioTerms || []);
  const issues = [];
  if (!body) issues.push({ code: "missing_document", detail: "문서 본문이 비어 있습니다." });
  if (body && body.length < minChars) issues.push({ code: "too_short", detail: `본문 길이 ${body.length}자가 최소 기준 ${minChars}자보다 짧습니다.` });
  if (placeholderCount >= 2) issues.push({ code: "placeholder_heavy", detail: `placeholder 또는 현장 확인 문구가 ${placeholderCount}개 남아 있습니다.` });
  if (missingRequiredTerms.length) issues.push({ code: "missing_required_term", detail: missingRequiredTerms.join(", ") });
  if (missingScenarioTerms.length) issues.push({ code: "missing_scenario_term", detail: missingScenarioTerms.join(", ") });
  return {
    key,
    title,
    verdict: issues.length ? "blocked" : "pass",
    charCount: body.length,
    placeholderCount,
    missingRequiredTerms,
    missingScenarioTerms,
    issues
  };
}

function summarize(items) {
  const blocked = items.filter((item) => item.verdict === "blocked");
  return {
    verdict: blocked.length ? "blocked" : "pass",
    totalCount: items.length,
    passCount: items.length - blocked.length,
    blockedCount: blocked.length
  };
}

async function fetchJson(route, init) {
  const started = Date.now();
  const { response, buffer } = await fetchBufferWithBudget(`${baseUrl}${route}`, init);
  const text = new TextDecoder().decode(buffer);
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    elapsedMs: Date.now() - started,
    parsed,
    rawPreview: text.slice(0, 500)
  };
}

async function runAskAudit(scenario) {
  const response = await fetchJson("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: scenario.question })
  });
  const payloadPath = path.join(payloadDir, `${scenario.id}.json`);
  writeJson(payloadPath, response.parsed || { status: response.status, rawPreview: response.rawPreview });

  const deliverables = response.parsed?.deliverables || {};
  const documentAudits = documentMeta.map(([key, title]) => {
    const text = deliverables[key];
    const audit = auditText({
      key,
      title,
      text,
      requiredTerms: requiredTermsByKey[key] || [],
      scenarioTerms: scenario.scenarioTerms,
      minChars: key === "kakaoMessage" ? 50 : 120
    });
    if (typeof text === "string") {
      fs.writeFileSync(path.join(documentDir, `${scenario.id}-${safeFileName(key)}.txt`), text, "utf8");
    }
    return audit;
  });
  return {
    id: scenario.id,
    title: scenario.title,
    status: response.status,
    elapsedMs: response.elapsedMs,
    payloadPath: path.relative(rootDir, payloadPath).replace(/\\/g, "/"),
    mode: response.parsed?.mode || "unknown",
    sourceMix: response.parsed?.sourceMix || null,
    summary: summarize(documentAudits),
    documents: documentAudits
  };
}

function extractTextFromJson(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return JSON.stringify(parsed, null, 2);
}

async function auditGeneratedFile(item, scenario) {
  const absolutePath = path.join(rootDir, item.file);
  const extension = path.extname(absolutePath).toLowerCase();
  const exists = fs.existsSync(absolutePath);
  const bytes = exists ? fs.statSync(absolutePath).size : 0;
  const issues = [];
  let text = "";
  let contentMode = "unread";

  if (!exists) {
    issues.push({ code: "missing_file", detail: "파일이 생성되지 않았습니다." });
  } else if (bytes < 100) {
    issues.push({ code: "too_small", detail: `파일 크기가 ${bytes} bytes입니다.` });
  }

  try {
    assertFinalOutputFileBudget(absolutePath);
    if ([".txt", ".csv", ".html", ".doc", ".xls"].includes(extension)) {
      text = fs.readFileSync(absolutePath, "utf8");
      contentMode = "text";
    } else if (extension === ".json") {
      text = extractTextFromJson(absolutePath);
      contentMode = "json";
    } else if (extension === ".hwpx") {
      text = extractBudgetedHwpxText(absolutePath);
      contentMode = "hwpx-xml";
    } else if (extension === ".xlsx") {
      text = await extractBudgetedXlsxText(absolutePath);
      contentMode = "xlsx-cells";
    } else if (extension === ".pdf") {
      const header = fs.readFileSync(absolutePath).subarray(0, 5).toString("utf8");
      contentMode = "binary-pdf";
      if (header !== "%PDF-") issues.push({ code: "bad_pdf_magic", detail: `PDF magic mismatch: ${header}` });
    } else if (extension === ".jpg" || extension === ".jpeg") {
      const header = fs.readFileSync(absolutePath).subarray(0, 3);
      contentMode = "binary-image";
      if (!(header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff)) issues.push({ code: "bad_jpg_magic", detail: "JPG magic mismatch" });
    } else if (extension === ".hwp") {
      const header = fs.readFileSync(absolutePath).subarray(0, 8);
      const expected = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
      contentMode = "binary-hwp";
      if (!header.equals(expected)) issues.push({ code: "bad_hwp_magic", detail: "HWP CFBF magic mismatch" });
    }
  } catch (error) {
    issues.push({ code: "parse_failed", detail: error instanceof Error ? error.message : String(error) });
  }

  if (text) {
    const requiredTerms = item.format === "ALL_TXT" || item.format === "ALL_CSV" || item.format === "ALL_XLS"
      ? ["위험성평가", "TBM", "안전보건교육"]
      : ["위험성평가", "감소대책"];
    const audit = auditText({
      key: item.format,
      title: item.file,
      text,
      requiredTerms,
      scenarioTerms: scenario.scenarioTerms,
      minChars: 120
    });
    issues.push(...audit.issues);
    if ((extension === ".xlsx" || extension === ".xls") && item.file.includes("risk-assessment")) {
      const missingHeaders = missingTerms(text, riskAssessmentHeaders);
      if (missingHeaders.length) issues.push({ code: "missing_risk_headers", detail: missingHeaders.join(", ") });
    }
  }

  return {
    format: item.format,
    file: item.file,
    bytes,
    contentMode,
    generatorOk: item.ok === true,
    verdict: item.ok === true && issues.length === 0 ? "pass" : "blocked",
    issues
  };
}

async function runFormatAudit(scenario) {
  const scenarioOut = path.join(formatDir, scenario.id);
  ensureDir(scenarioOut);
  const env = {
    ...process.env,
    SAFEGUARD_BASE_URL: baseUrl,
    SAFEGUARD_OUT_DIR: scenarioOut,
    SAFEGUARD_SMOKE_QUESTION: scenario.question
  };
  const result = spawnSyncWithBudget(process.execPath, ["./scripts/prod_orchestration_download_smoke.mjs"], {
    cwd: rootDir,
    env,
    encoding: "utf8",
  }, {
    timeoutMs: 180_000,
    maxBufferBytes: 20 * 1024 * 1024,
  });
  const logPath = path.join(scenarioOut, "download-smoke.log");
  fs.writeFileSync(logPath, [
    `exitCode: ${result.status ?? 1}`,
    "",
    "## stdout",
    result.stdout || "",
    "",
    "## stderr",
    result.stderr || "",
    "",
    "## error",
    result.error ? `${result.error.name}: ${result.error.message}` : ""
  ].join("\n"), "utf8");

  const reportPath = path.join(scenarioOut, "api-orchestration-download-smoke.json");
  if (!fs.existsSync(reportPath)) {
    return {
      id: scenario.id,
      title: scenario.title,
      exitCode: result.status ?? 1,
      logPath: path.relative(rootDir, logPath).replace(/\\/g, "/"),
      summary: { verdict: "blocked", totalCount: 0, passCount: 0, blockedCount: 1 },
      files: []
    };
  }
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const files = [];
  for (const item of report.downloads || []) {
    files.push(await auditGeneratedFile(item, scenario));
  }
  return {
    id: scenario.id,
    title: scenario.title,
    exitCode: result.status ?? 1,
    logPath: path.relative(rootDir, logPath).replace(/\\/g, "/"),
    reportPath: path.relative(rootDir, reportPath).replace(/\\/g, "/"),
    weather: report.weather,
    ask: report.ask,
    summary: summarize(files),
    files
  };
}

function renderMarkdown(payload) {
  const askRows = payload.askAudits
    .map((scenario) => `| ${scenario.title} | ${scenario.summary.verdict} | ${scenario.summary.passCount}/${scenario.summary.totalCount} | ${scenario.mode} | ${scenario.payloadPath} |`)
    .join("\n");
  const formatRows = payload.formatAudits
    .map((scenario) => `| ${scenario.title} | ${scenario.summary.verdict} | ${scenario.summary.passCount}/${scenario.summary.totalCount} | ${scenario.reportPath || ""} | ${scenario.logPath} |`)
    .join("\n");
  const blockedDocs = payload.askAudits.flatMap((scenario) =>
    scenario.documents
      .filter((doc) => doc.verdict === "blocked")
      .map((doc) => `- ${scenario.title} / ${doc.title}: ${doc.issues.map((issue) => `${issue.code}(${issue.detail})`).join("; ")}`)
  );
  const blockedFiles = payload.formatAudits.flatMap((scenario) =>
    scenario.files
      .filter((file) => file.verdict === "blocked")
      .map((file) => `- ${scenario.title} / ${file.format} / ${file.file}: ${file.issues.map((issue) => `${issue.code}(${issue.detail})`).join("; ")}`)
  );
  return `# SafeClaw Final Output Integrity Audit

Generated: ${payload.generatedAt}

Base URL: ${payload.baseUrl}

Verdict: **${payload.verdict}**

Elapsed: ${payload.elapsedMs} ms

## What Was Checked

- 3 representative production scenarios.
- 11 ask deliverables per scenario.
- Generated download files: text/json/csv/xls/doc/html/hwpx/hwp/xlsx/pdf/jpg and full workpack bundles.
- Placeholder residue, missing scenario terms, required safety terms, core risk-assessment headers, and binary file signatures.

## Ask Deliverables

| Scenario | Verdict | Passed | Mode | Payload |
| --- | --- | ---: | --- | --- |
${askRows}

## Generated Files

| Scenario | Verdict | Passed | Report | Log |
| --- | --- | ---: | --- | --- |
${formatRows}

## Blocked Documents

${blockedDocs.length ? blockedDocs.join("\n") : "- None."}

## Blocked Files

${blockedFiles.length ? blockedFiles.join("\n") : "- None."}
`;
}

async function main() {
  ensureDir(outDir);
  ensureDir(payloadDir);
  ensureDir(documentDir);
  ensureDir(formatDir);

  const askAudits = [];
  for (const scenario of scenarios) {
    askAudits.push(await runAskAudit(scenario));
  }

  const formatAudits = [];
  for (const scenario of scenarios) {
    formatAudits.push(await runFormatAudit(scenario));
  }

  const askSummary = summarize(askAudits.map((item) => ({ verdict: item.summary.verdict })));
  const formatSummary = summarize(formatAudits.map((item) => ({ verdict: item.summary.verdict })));
  const verdict = askSummary.verdict === "pass" && formatSummary.verdict === "pass" ? "pass" : "blocked";
  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    elapsedMs: Date.now() - startedAt,
    verdict,
    askSummary,
    formatSummary,
    askAudits,
    formatAudits
  };

  writeJson(path.join(outDir, "report.json"), payload);
  fs.writeFileSync(path.join(outDir, "report.md"), `${renderMarkdown(payload).trim()}\n`, "utf8");
  console.log(JSON.stringify({
    verdict,
    askSummary,
    formatSummary,
    outDir: path.relative(rootDir, outDir).replace(/\\/g, "/")
  }, null, 2));
  if (verdict !== "pass") process.exitCode = 1;
}

await main();
