#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ExcelJS from "exceljs";

const repoRoot = process.cwd();
const outDir = path.resolve(process.env.SAFECLAW_OUTPUT_CONTRACT_OUT_DIR || path.join(repoRoot, "evaluation", "2026-05-08-output-contract-smoke"));
const filesDir = path.join(outDir, "files");
const baseUrl = process.env.SAFECLAW_OUTPUT_CONTRACT_BASE_URL || "http://127.0.0.1:3110";

fs.mkdirSync(filesDir, { recursive: true });

const expectedHeaders = [
  "작업장소",
  "공정",
  "세부작업",
  "장비·도구",
  "유해·위험요인",
  "4M",
  "재해유형",
  "현재 안전조치",
  "가능성",
  "중대성",
  "위험성",
  "감소대책",
  "담당자",
  "조치기한",
  "확인상태",
  "확인일",
  "확인자",
  "근거"
];

const structuredRiskRows = [
  {
    id: "1",
    location: "가온테크 협력사 1차 작업장",
    process: "설비 유지보수",
    task: "천장 배관 누설 점검",
    unitTask: "천장 배관 누설 점검",
    equipment: "사다리, 누설 점검기, 보안경",
    hazard: "천장 누수로 인한 미끄럼 및 감전 위험",
    fourM: "Media",
    accidentType: "slip",
    currentControls: "누수 지점 접근 전 차단표지 설치",
    likelihood: 4,
    severity: 5,
    riskLevel: "high",
    additionalControls: "전원 차단 확인 후 2인1조로 작업하고 젖은 바닥에 미끄럼 방지 매트를 설치한다.",
    owner: "작업반장",
    due: "2026-05-08",
    dueDate: "2026-05-08",
    verification: "작업 전 현장 확인",
    verificationStatus: "planned",
    verificationDate: "2026-05-08",
    verificationChecker: "관리감독자",
    whyLikelihood: "누수와 비정형 작업으로 접촉 가능성이 높습니다.",
    whySeverity: "감전 또는 추락으로 중대재해 가능성이 있습니다.",
    evidenceRefs: ["산업안전보건법", "KOSHA 위험성평가"]
  }
];

const payload = {
  title: "위험성평가표",
  profile: {
    id: "risk-assessment",
    title: "위험성평가표",
    subtitle: "KOSHA 구조화 출력 계약 검증",
    layout: "risk"
  },
  scenario: {
    companyName: "가온테크",
    siteName: "가온테크 협력사 1차 작업장",
    companyType: "제조업",
    workSummary: "천장 배관 누설 점검",
    workerCount: 2,
    weatherNote: "실내 습기, 누수"
  },
  structured: {
    riskAssessmentRows: structuredRiskRows
  },
  rows: []
};

async function postBuffer(pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const arrayBuffer = await response.arrayBuffer();
  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    buffer: Buffer.from(arrayBuffer)
  };
}

async function verifyXlsx() {
  const result = await postBuffer("/api/export/xlsx", payload);
  const filePath = path.join(filesDir, "risk-assessment-contract.xlsx");
  fs.writeFileSync(filePath, result.buffer);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);
  const worksheet = workbook.getWorksheet("위험성평가표") || workbook.worksheets[0];
  const allValues = [];
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      const value = cell.value;
      if (value !== null && value !== undefined) allValues.push(String(value));
    });
  });
  const missingHeaders = expectedHeaders.filter((header) => !allValues.includes(header));

  return {
    ok: result.ok && missingHeaders.length === 0,
    httpStatus: result.status,
    contentType: result.contentType,
    filePath,
    bytes: result.buffer.length,
    sheetName: worksheet.name,
    expectedHeaderCount: expectedHeaders.length,
    missingHeaders
  };
}

async function verifyPdf() {
  const result = await postBuffer("/api/export/pdf", payload);
  const filePath = path.join(filesDir, "risk-assessment-contract.pdf");
  fs.writeFileSync(filePath, result.buffer);
  const magic = result.buffer.subarray(0, 5).toString("utf8");
  const looksLikeHtml = result.buffer.subarray(0, 64).toString("utf8").toLowerCase().includes("<!doctype html");

  return {
    ok: result.ok && result.contentType.includes("application/pdf") && magic === "%PDF-" && !looksLikeHtml,
    httpStatus: result.status,
    contentType: result.contentType,
    filePath,
    bytes: result.buffer.length,
    magic,
    looksLikeHtml
  };
}

function verifySourceContracts() {
  const searchSource = fs.readFileSync(path.join(repoRoot, "lib", "search.ts"), "utf8");
  const typesSource = fs.readFileSync(path.join(repoRoot, "lib", "types.ts"), "utf8");
  const xlsxSource = fs.readFileSync(path.join(repoRoot, "lib", "xlsx-builder.ts"), "utf8");
  return {
    tbmRiskLinksGenerated: searchSource.includes("tbmRiskLinks = buildTbmRiskLinks"),
    tbmRiskLinksExposed: typesSource.includes("tbmRiskLinks?: TbmRiskLink[]"),
    xlsxUsesKoshasHeaders: expectedHeaders.every((header) => xlsxSource.includes(header))
  };
}

const startedAt = Date.now();
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  xlsx: await verifyXlsx(),
  pdf: await verifyPdf(),
  sourceContracts: verifySourceContracts(),
  elapsedMs: Date.now() - startedAt
};
report.overall = report.xlsx.ok && report.pdf.ok && Object.values(report.sourceContracts).every(Boolean) ? "pass" : "blocked";

fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

if (report.overall !== "pass") {
  process.exitCode = 1;
}
