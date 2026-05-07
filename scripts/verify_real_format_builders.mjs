#!/usr/bin/env node
// Verifies the new real-format builders produce valid output by reproducing their core logic
// in plain Node JS (mirrors lib/xlsx-builder.ts + lib/hwp-table-builder.ts) and inspecting outputs.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { initSync, HwpDocument } from "@rhwp/core";

globalThis.measureTextWidth = (_font, text) => text.length * 12;

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(repoRoot, "evaluation", "2026-05-07-real-format-builders");
fs.mkdirSync(outDir, { recursive: true });
const wasmPath = path.join(repoRoot, "node_modules", "@rhwp", "core", "rhwp_bg.wasm");
initSync({ module: fs.readFileSync(wasmPath) });

const sampleScenario = {
  companyName: "세이프건설",
  siteName: "서울 성수동 근린생활시설",
  workSummary: "이동식 비계 외벽 도장",
  workerCount: 5,
  weatherNote: "오후 강풍 예보"
};

const sampleProfile = {
  code: "risk-assessment",
  subtitle: "위험성평가표",
  layout: "risk",
  primaryColumn: "유해·위험요인",
  actionColumn: "감소대책",
  confirmationRows: ["사전준비", "TBM", "보호구", "허가", "비상연락"],
  approvalLabels: ["작성자", "관리감독자", "현장소장"]
};

const sampleRows = [
  { document: "위험성평가표", section: "사전준비", item: "1", content: "기상 및 작업조건 확인 (강풍 예보)" },
  { document: "위험성평가표", section: "사전준비", item: "2", content: "이동식 비계 고정핀·바퀴잠금 점검" },
  { document: "위험성평가표", section: "유해·위험요인", item: "1", content: "비계 추락 위험" },
  { document: "위험성평가표", section: "유해·위험요인", item: "2", content: "강풍 시 비계 전도 위험" },
  { document: "위험성평가표", section: "감소대책", item: "1", content: "풍속 10m/s 초과 시 작업중지" },
  { document: "위험성평가표", section: "감소대책", item: "2", content: "안전대 부착·보호구 착용" }
];

// ============= XLSX =============
async function buildXlsxAndVerify() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SafeClaw";
  const ws = wb.addWorksheet("위험성평가표");
  ws.columns = [{ width: 6 }, { width: 16 }, { width: 28 }, { width: 50 }, { width: 10 }, { width: 14 }];

  ws.mergeCells("A1:F1");
  ws.getCell("A1").value = "위험성평가표 · " + sampleProfile.subtitle;
  ws.getCell("A1").font = { name: "Malgun Gothic", size: 14, bold: true };

  // Meta
  ws.getCell("A2").value = "사업장";
  ws.mergeCells("B2:C2");
  ws.getCell("B2").value = sampleScenario.companyName;
  ws.getCell("D2").value = "현장";
  ws.mergeCells("E2:F2");
  ws.getCell("E2").value = sampleScenario.siteName;

  // Header
  const cols = ["No.", "구분", "유해·위험요인", "감소대책", "확인", "담당"];
  cols.forEach((c, i) => {
    const cell = ws.getCell(4, i + 1);
    cell.value = c;
    cell.font = { name: "Malgun Gothic", bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4D43" } };
    cell.border = {
      top: { style: "thin", color: { argb: "FF9AA4B2" } },
      left: { style: "thin", color: { argb: "FF9AA4B2" } },
      bottom: { style: "thin", color: { argb: "FF9AA4B2" } },
      right: { style: "thin", color: { argb: "FF9AA4B2" } }
    };
  });

  // Body
  sampleRows.forEach((r, i) => {
    const row = 5 + i;
    ws.getCell(row, 1).value = i + 1;
    ws.getCell(row, 2).value = r.section;
    ws.getCell(row, 3).value = r.item;
    ws.getCell(row, 4).value = r.content;
    ws.getCell(row, 5).value = "□";
    ws.getCell(row, 6).value = "______";
  });

  const buffer = await wb.xlsx.writeBuffer();
  const outPath = path.join(outDir, "risk-assessment.xlsx");
  fs.writeFileSync(outPath, Buffer.from(buffer));

  // Re-open and verify
  const verify = new ExcelJS.Workbook();
  await verify.xlsx.load(buffer);
  const sheet = verify.getWorksheet("위험성평가표");
  const a1 = sheet?.getCell("A1").value;
  const c4 = sheet?.getCell("C4").value;
  const d5 = sheet?.getCell("D5").value;
  return {
    file: "risk-assessment.xlsx",
    bytes: buffer.byteLength,
    sheetCount: verify.worksheets.length,
    sheetNames: verify.worksheets.map((w) => w.name),
    a1: String(a1),
    c4_header: String(c4),
    d5_first_body: String(d5),
    a1_contains_title: String(a1).includes("위험성평가표"),
    c4_is_risk_header: String(c4) === "유해·위험요인",
    d5_is_first_content: String(d5).includes("기상")
  };
}

// ============= HWP =============
function buildHwpAndVerify() {
  const document = HwpDocument.createEmpty();
  let buffer;
  let tableInfo = [];
  try {
    document.createBlankDocument();
    document.insertText(0, 0, 0, "위험성평가표(공식자료 기반 표 양식)\nSafeClaw · 현장 검토 후 사용\n\n");

    // Meta table
    const meta = JSON.parse(document.createTable(0, 0, 0, 2, 4));
    if (meta.ok) {
      tableInfo.push({ kind: "meta", rows: 2, cols: 4, paraIdx: meta.paraIdx, controlIdx: meta.controlIdx });
      const metaRows = [
        ["사업장", sampleScenario.companyName, "현장", sampleScenario.siteName],
        ["작업", sampleScenario.workSummary, "인원", `${sampleScenario.workerCount}명`]
      ];
      metaRows.forEach((row, rIdx) => {
        row.forEach((v, cIdx) => {
          const cellIdx = rIdx * 4 + cIdx;
          document.insertTextInCell(0, meta.paraIdx, meta.controlIdx ?? 0, cellIdx, 0, 0, String(v));
        });
      });
    }
    document.insertText(0, 0, 0, "\n");

    // Body table
    const cols = ["구분", "유해·위험요인", "감소대책", "확인"];
    const allRows = [cols, ...sampleRows.map((r) => [r.section, r.item, r.content, "□"])];
    const body = JSON.parse(document.createTable(0, 0, 0, allRows.length, cols.length));
    if (body.ok) {
      tableInfo.push({ kind: "body", rows: allRows.length, cols: cols.length, paraIdx: body.paraIdx, controlIdx: body.controlIdx });
      allRows.forEach((row, rIdx) => {
        row.forEach((v, cIdx) => {
          const cellIdx = rIdx * cols.length + cIdx;
          document.insertTextInCell(0, body.paraIdx, body.controlIdx ?? 0, cellIdx, 0, 0, String(v));
        });
      });
    }

    document.insertText(0, 0, 0, "\n\n[확인/서명]\n작성자: ____________________\n관리감독자: ____________________");

    buffer = Buffer.from(document.exportHwp());
  } finally {
    document.free();
  }

  const outPath = path.join(outDir, "risk-assessment.hwp");
  fs.writeFileSync(outPath, buffer);

  // HWP files are CFBF (Compound File Binary Format) - magic D0 CF 11 E0 A1 B1 1A E1
  const magic = buffer.slice(0, 8);
  const expectedMagic = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
  return {
    file: "risk-assessment.hwp",
    bytes: buffer.length,
    cfbf_magic: magic.equals(expectedMagic),
    table_info: tableInfo,
    table_count: tableInfo.length,
    rows_with_content: sampleRows.length
  };
}

const xlsxResult = await buildXlsxAndVerify();
const hwpResult = buildHwpAndVerify();
const summary = {
  generatedAt: new Date().toISOString(),
  xlsx: xlsxResult,
  hwp: hwpResult
};
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
