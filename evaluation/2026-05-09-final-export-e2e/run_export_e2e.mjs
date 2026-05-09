#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ExcelJS from "exceljs";

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, "evaluation", "2026-05-09-final-export-e2e");
const filesDir = path.join(outDir, "files");
const baseUrl = process.env.SAFECLAW_E2E_BASE_URL || "http://127.0.0.1:3110";
const question = process.env.SAFECLAW_E2E_QUESTION
  || "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보. 추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 작업계획서, TBM, 안전보건교육 기록을 만들어줘.";

fs.mkdirSync(filesDir, { recursive: true });

function safeFileName(value) {
  return String(value || "safeclaw")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 90);
}

async function fetchText(route, init) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${route}`, init);
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    elapsedMs: Date.now() - startedAt,
    headers: Object.fromEntries(response.headers.entries()),
    text
  };
}

async function fetchJson(route, init) {
  const result = await fetchText(route, init);
  let parsed = null;
  try {
    parsed = JSON.parse(result.text);
  } catch {
    parsed = null;
  }
  return { ...result, parsed };
}

async function fetchBuffer(route, body, fileName) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  const filePath = path.join(filesDir, fileName);
  fs.writeFileSync(filePath, buffer);
  return {
    ok: response.ok,
    status: response.status,
    elapsedMs: Date.now() - startedAt,
    contentType: response.headers.get("content-type") || "",
    filePath,
    bytes: buffer.length,
    buffer
  };
}

function buildRowsFromText(title, text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80)
    .map((line, index) => ({
      document: title,
      section: index === 0 ? "제목" : "본문",
      item: line.slice(0, 80),
      detail: line,
      action: index === 0 ? "현장 확인" : "확인",
      check: ""
    }));
}

function profile(layout, title, primaryColumn, actionColumn) {
  return {
    id: layout,
    title,
    subtitle: "SafeClaw 제출 보조 양식",
    layout,
    primaryColumn,
    actionColumn,
    confirmationRows: ["현장 확인", "관리감독자 확인", "작업자 공유"],
    approvalLabels: ["작성", "검토", "승인"]
  };
}

function buildDocumentSpecs(payload) {
  const deliverables = payload.deliverables || {};
  return [
    {
      id: "risk-assessment",
      title: "위험성평가표",
      fileBase: "risk-assessment",
      text: deliverables.riskAssessmentDraft,
      profile: profile("risk", "위험성평가표", "유해·위험요인", "감소대책"),
      riskAssessmentRows: payload.structured?.riskAssessmentRows || []
    },
    {
      id: "work-plan",
      title: "작업계획서",
      fileBase: "work-plan",
      text: deliverables.workPlanDraft,
      profile: profile("workPlan", "작업계획서", "작업개요", "장비·인원·안전조치")
    },
    {
      id: "tbm-briefing",
      title: "TBM 브리핑",
      fileBase: "tbm-briefing",
      text: deliverables.tbmBriefing,
      profile: profile("tbmBriefing", "TBM 브리핑", "위험요인", "확인 질문")
    },
    {
      id: "safety-education",
      title: "안전보건교육 기록",
      fileBase: "safety-education",
      text: deliverables.safetyEducationRecordDraft,
      profile: profile("education", "안전보건교육 기록", "교육내용", "이해확인")
    }
  ].map((document) => ({
    ...document,
    rows: buildRowsFromText(document.title, document.text)
  }));
}

async function inspectXlsx(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const strings = [];
  for (const worksheet of workbook.worksheets) {
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value !== null && cell.value !== undefined) strings.push(String(cell.value));
      });
    });
  }
  return {
    sheets: workbook.worksheets.map((sheet) => sheet.name),
    hasRiskHeaders: ["작업장소", "세부작업", "유해·위험요인", "감소대책", "확인상태", "근거"].every((term) => strings.includes(term)),
    hasWorkPlanTerms: ["작업개요", "작업단계", "작업중지 기준"].some((term) => strings.some((value) => value.includes(term))),
    hasTbmTerms: ["TBM", "위험요인", "확인질문"].some((term) => strings.some((value) => value.includes(term))),
    hasEducationTerms: ["안전보건교육", "교육내용", "이해확인"].some((term) => strings.some((value) => value.includes(term))),
    sample: strings.slice(0, 30)
  };
}

function inspectHwp(result) {
  const oleMagic = result.buffer.subarray(0, 8).toString("hex");
  const utf8Preview = result.buffer.toString("utf8", 0, Math.min(result.buffer.length, 512));
  return {
    contentType: result.contentType,
    bytes: result.bytes,
    oleMagic,
    looksLikeHwp: oleMagic.startsWith("d0cf11e0a1b11ae1"),
    looksLikeHtml: utf8Preview.toLowerCase().includes("<!doctype html")
  };
}

const startedAt = Date.now();
const weather = await fetchJson("/api/weather?location=%EC%84%9C%EC%9A%B8&lat=37.5&lon=127.0", { method: "GET" });
const ask = await fetchJson("/api/ask", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ question, aiMode: "full" })
});

if (!ask.ok || !ask.parsed) {
  throw new Error(`ask failed: ${ask.status} ${ask.text.slice(0, 200)}`);
}

const payload = ask.parsed;
const docs = buildDocumentSpecs(payload);
const companyName = safeFileName(payload.scenario?.companyName || "SafeClaw");
const exports = [];

const fullXlsx = await fetchBuffer("/api/export/xlsx", {
  mode: "workpack",
  scenario: payload.scenario,
  documents: docs.map((document) => ({
    title: document.title,
    rows: document.rows,
    profile: document.profile,
    riskAssessmentRows: document.riskAssessmentRows
  }))
}, `${companyName}-full-workpack.xlsx`);
exports.push({ id: "full-workpack-xlsx", kind: "xlsx", ...fullXlsx, buffer: undefined, inspection: await inspectXlsx(fullXlsx.filePath) });

for (const document of docs) {
  const xlsxMode =
    document.id === "work-plan" && payload.deliverables?.workPlanStructured ? "workPlanStructured"
      : document.id === "tbm-briefing" && payload.deliverables?.tbmBriefingStructured ? "tbmBriefingStructured"
        : document.id === "safety-education" && payload.deliverables?.educationRecordStructured ? "educationRecordStructured"
          : null;
  const xlsxBody = xlsxMode
    ? {
      mode: xlsxMode,
      scenario: payload.scenario,
      structured: xlsxMode === "workPlanStructured"
        ? payload.deliverables.workPlanStructured
        : xlsxMode === "tbmBriefingStructured"
          ? payload.deliverables.tbmBriefingStructured
          : payload.deliverables.educationRecordStructured
    }
    : {
      mode: "single",
      title: document.title,
      rows: document.rows,
      profile: document.profile,
      scenario: payload.scenario,
      riskAssessmentRows: document.riskAssessmentRows
    };
  const xlsx = await fetchBuffer("/api/export/xlsx", xlsxBody, `${companyName}-${document.fileBase}.xlsx`);
  exports.push({ id: `${document.id}-xlsx`, kind: "xlsx", ...xlsx, buffer: undefined, inspection: await inspectXlsx(xlsx.filePath) });

  const hwp = await fetchBuffer("/api/export/hwp", {
    title: document.title,
    rows: document.rows,
    profile: document.profile,
    scenario: payload.scenario,
    riskAssessmentRows: document.riskAssessmentRows
  }, `${companyName}-${document.fileBase}.hwp`);
  exports.push({ id: `${document.id}-hwp`, kind: "hwp", ...hwp, buffer: undefined, inspection: inspectHwp(hwp) });
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  elapsedMs: Date.now() - startedAt,
  commit: process.env.SAFECLAW_E2E_COMMIT || "",
  weather: {
    ok: weather.ok,
    status: weather.status,
    elapsedMs: weather.elapsedMs,
    query: weather.parsed?.query || null,
    message: weather.parsed?.message || null
  },
  ask: {
    ok: ask.ok,
    status: ask.status,
    elapsedMs: ask.elapsedMs,
    mode: payload.mode,
    riskAssessmentRows: Array.isArray(payload.structured?.riskAssessmentRows) ? payload.structured.riskAssessmentRows.length : 0,
    tbmRiskLinks: Array.isArray(payload.structured?.tbmRiskLinks) ? payload.structured.tbmRiskLinks.length : 0,
    documentKeys: Object.keys(payload.deliverables || {}).filter((key) => typeof payload.deliverables[key] === "string")
  },
  exports: exports.map((item) => ({
    id: item.id,
    kind: item.kind,
    ok: item.ok,
    status: item.status,
    contentType: item.contentType,
    filePath: item.filePath,
    bytes: item.bytes,
    elapsedMs: item.elapsedMs,
    inspection: item.inspection
  }))
};

report.overall = report.weather.ok
  && report.ask.ok
  && report.ask.riskAssessmentRows > 0
  && report.exports.every((item) => item.ok && item.bytes > 1000 && (item.kind !== "hwp" || item.inspection.looksLikeHwp))
  ? "pass"
  : "blocked";

fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
fs.writeFileSync(path.join(outDir, "ask-response.json"), JSON.stringify(payload, null, 2), "utf8");

console.log(JSON.stringify(report, null, 2));

if (report.overall !== "pass") {
  process.exitCode = 1;
}
