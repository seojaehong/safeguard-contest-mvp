// Real .xlsx builder via ExcelJS (replaces HTML-as-.xls).
// Produces OOXML binary that opens cleanly in Excel/한셀 with no extension warning.

import ExcelJS from "exceljs";
import type { AskResponse } from "@/lib/types";
import {
  resolveRiskAssessmentRows,
  type StructuredRiskAssessmentRow
} from "@/lib/risk-assessment-renderer";

type SheetRow = {
  document: string;
  section: string;
  item: string;
  content: string;
};

type SafetyFormProfile = {
  code: string;
  subtitle: string;
  layout: "generic" | "risk" | "workPlan" | "permit" | "tbmBriefing" | "tbmLog" | "education" | "photo";
  primaryColumn: string;
  actionColumn: string;
  confirmationRows: string[];
  approvalLabels: string[];
};

const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF1F4D43" } };
const HEADER_FONT = { name: "Malgun Gothic", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
const META_LABEL_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF21594F" } };
const META_LABEL_FONT = { name: "Malgun Gothic", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
const SECTION_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE8F1ED" } };
const SECTION_FONT = { name: "Malgun Gothic", size: 11, bold: true, color: { argb: "FF1F4D43" } };
const COVER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE8F1ED" } };
const BORDER_THIN = { style: "thin" as const, color: { argb: "FF9AA4B2" } };
const ALL_BORDERS = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN };

function applyBorders(ws: ExcelJS.Worksheet, range: string) {
  ws.getCell(range); // ensure exists
  const [start, end] = range.split(":");
  if (!end) return;
  const startCell = ws.getCell(start);
  const endCell = ws.getCell(end);
  for (let r = startCell.row; r <= endCell.row; r += 1) {
    for (let c = startCell.col; c <= endCell.col; c += 1) {
      ws.getCell(r, c).border = ALL_BORDERS;
    }
  }
}

export type XlsxBuildInput = {
  title: string;
  rows: SheetRow[];
  profile: SafetyFormProfile;
  scenario: AskResponse["scenario"];
  structuredRiskRows?: StructuredRiskAssessmentRow[];
};

function applyRiskAssessmentColumns(ws: ExcelJS.Worksheet) {
  ws.columns = [
    { width: 6 },
    { width: 18 },
    { width: 26 },
    { width: 28 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 34 },
    { width: 14 },
    { width: 14 },
    { width: 12 }
  ];
}

function writeOfficialLikeRiskAssessmentTable(
  ws: ExcelJS.Worksheet,
  startRow: number,
  rows: StructuredRiskAssessmentRow[]
): number {
  let row = startRow;
  ws.mergeCells(row, 1, row, 11);
  ws.getCell(row, 1).value = "위험성평가표";
  ws.getCell(row, 1).font = { name: "Malgun Gothic", size: 12, bold: true };
  row += 1;

  const headers = [
    "No.",
    "세부작업",
    "유해·위험요인",
    "현재 안전보건조치",
    "가능성",
    "중대성",
    "위험성",
    "감소대책",
    "담당",
    "완료예정",
    "조치확인"
  ];
  headers.forEach((header, index) => {
    const cell = ws.getCell(row, index + 1);
    cell.value = header;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  applyBorders(ws, `A${row}:K${row}`);
  ws.getRow(row).height = 26;
  row += 1;

  rows.forEach((riskRow, index) => {
    const values = [
      riskRow.id || String(index + 1),
      riskRow.unitTask,
      riskRow.hazard,
      riskRow.currentControls || "현장 확인",
      riskRow.likelihood || "확인",
      riskRow.severity || "확인",
      riskRow.riskLevel || "확인",
      riskRow.additionalControls,
      riskRow.owner || "작업반장",
      riskRow.dueDate || "작업 전",
      riskRow.status || "□"
    ];
    values.forEach((value, columnIndex) => {
      const cell = ws.getCell(row, columnIndex + 1);
      cell.value = value;
      cell.alignment = {
        vertical: columnIndex === 2 || columnIndex === 3 || columnIndex === 7 ? "top" : "middle",
        horizontal: columnIndex === 0 || (columnIndex >= 4 && columnIndex <= 6) || columnIndex === 10 ? "center" : "left",
        wrapText: true
      };
    });
    applyBorders(ws, `A${row}:K${row}`);
    ws.getRow(row).height = 42;
    row += 1;
  });

  return row;
}

function deriveColumns(profile: SafetyFormProfile): string[] {
  switch (profile.layout) {
    case "risk":
      return ["No.", "구분", profile.primaryColumn || "유해·위험요인", profile.actionColumn || "감소대책", "확인", "담당"];
    case "workPlan":
      return ["순번", "구분", profile.primaryColumn || "작업개요", profile.actionColumn || "장비·인원", "확인", "담당"];
    case "permit":
      return ["순번", "구분", profile.primaryColumn || "허가항목", profile.actionColumn || "조건/조치", "확인", "담당"];
    case "tbmLog":
    case "tbmBriefing":
      return ["No.", "구분", profile.primaryColumn || "항목", profile.actionColumn || "전달 문구", "확인", "담당"];
    case "education":
      return ["No.", "구분", profile.primaryColumn || "교육항목", profile.actionColumn || "내용", "확인", "담당"];
    default:
      return ["No.", "구분", "항목", "내용", "확인", "담당"];
  }
}

/**
 * Build a real .xlsx workbook for a single document.
 * Sheet layout:
 *   1. Cover row (title)
 *   2. Meta grid (사업장/현장/작업/인원)
 *   3. Confirmation row (profile.confirmationRows)
 *   4. Section summary table (섹션, 항목수, 주요 항목)
 *   5. Main body table (No., 구분, 항목, 내용, 확인, 담당)
 *   6. Approval row (profile.approvalLabels + 보관위치)
 *   7. Note line
 * Returns a Buffer suitable for `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
 */
export async function buildXlsxForDocument(input: XlsxBuildInput): Promise<Buffer> {
  const { title, rows, profile, scenario, structuredRiskRows } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = "SafeClaw";
  wb.created = new Date();

  const ws = wb.addWorksheet(title.slice(0, 31), {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  const isStructuredRiskSheet = profile.layout === "risk" && Boolean(structuredRiskRows?.length);
  if (isStructuredRiskSheet) {
    applyRiskAssessmentColumns(ws);
  } else {
    ws.columns = [
      { width: 6 },
      { width: 16 },
      { width: 28 },
      { width: 50 },
      { width: 10 },
      { width: 14 }
    ];
  }

  let row = 1;

  // 1) Cover
  const lastColumn = isStructuredRiskSheet ? 11 : 6;
  const lastColumnLetter = isStructuredRiskSheet ? "K" : "F";

  ws.mergeCells(row, 1, row, lastColumn);
  const coverCell = ws.getCell(row, 1);
  coverCell.value = `${title}  ·  ${profile.subtitle}`;
  coverCell.font = { name: "Malgun Gothic", size: 16, bold: true, color: { argb: "FF1F4D43" } };
  coverCell.fill = COVER_FILL;
  coverCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(row).height = 32;
  applyBorders(ws, `A${row}:${lastColumnLetter}${row}`);
  row += 1;

  // 2) Meta grid (2 rows x 4 col-pairs)
  const metaRows = [
    [["사업장", scenario.companyName || ""], ["현장/공정", scenario.siteName || ""]],
    [["작업내용", scenario.workSummary || ""], ["인원/조건", `${scenario.workerCount ?? 0}명 · ${scenario.weatherNote || ""}`]]
  ];
  for (const pair of metaRows) {
    const [[lbl1, val1], [lbl2, val2]] = pair;
    ws.getCell(row, 1).value = lbl1;
    ws.mergeCells(row, 2, row, 3);
    ws.getCell(row, 2).value = val1;
    ws.getCell(row, 4).value = lbl2;
    ws.mergeCells(row, 5, row, lastColumn);
    ws.getCell(row, 5).value = val2;
    [1, 4].forEach((c) => {
      const cell = ws.getCell(row, c);
      cell.fill = META_LABEL_FILL;
      cell.font = META_LABEL_FONT;
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    [2, 5].forEach((c) => {
      ws.getCell(row, c).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    });
    applyBorders(ws, `A${row}:${lastColumnLetter}${row}`);
    row += 1;
  }

  // 3) Confirmation row
  if (profile.confirmationRows?.length) {
    const items = profile.confirmationRows.slice(0, 6);
    items.forEach((item, idx) => {
      ws.getCell(row, idx + 1).value = `□ ${item}`;
      ws.getCell(row, idx + 1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    applyBorders(ws, `A${row}:F${row}`);
    ws.getRow(row).height = 26;
    row += 1;
  }

  row += 1; // spacer

  if (isStructuredRiskSheet) {
    row += 1;
    const riskRows = resolveRiskAssessmentRows({ structuredRows: structuredRiskRows, fallbackRows: rows });
    row = writeOfficialLikeRiskAssessmentTable(ws, row, riskRows);
    row += 1;
    ws.mergeCells(row, 1, row, lastColumn);
    const note = ws.getCell(row, 1);
    note.value =
      "본 파일은 structured rows를 표준 위험성평가표에 매핑한 OOXML(.xlsx) 초안입니다. 발주처 지정 원본 양식과 평가척도는 현장 기준에 맞게 최종 확인하세요.";
    note.font = { name: "Malgun Gothic", size: 10, italic: true, color: { argb: "FF5E6677" } };
    note.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
    ws.pageSetup.printArea = `A1:${lastColumnLetter}${row}`;
    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  }

  // 4) Section summary
  const grouped = rows.reduce<Record<string, SheetRow[]>>((acc, r) => {
    acc[r.section] = [...(acc[r.section] || []), r];
    return acc;
  }, {});
  ws.mergeCells(row, 1, row, 6);
  ws.getCell(row, 1).value = "섹션 요약";
  ws.getCell(row, 1).font = { name: "Malgun Gothic", size: 12, bold: true };
  row += 1;

  const summaryHeader = ["섹션", "항목 수", "주요 항목"];
  ws.getCell(row, 1).value = summaryHeader[0];
  ws.mergeCells(row, 2, row, 3);
  ws.getCell(row, 2).value = summaryHeader[1];
  ws.mergeCells(row, 4, row, 6);
  ws.getCell(row, 4).value = summaryHeader[2];
  [1, 2, 4].forEach((c) => {
    ws.getCell(row, c).fill = HEADER_FILL;
    ws.getCell(row, c).font = HEADER_FONT;
    ws.getCell(row, c).alignment = { vertical: "middle", horizontal: "center" };
  });
  applyBorders(ws, `A${row}:F${row}`);
  row += 1;
  for (const [section, sectionRows] of Object.entries(grouped)) {
    ws.getCell(row, 1).value = section;
    ws.mergeCells(row, 2, row, 3);
    ws.getCell(row, 2).value = sectionRows.length;
    ws.getCell(row, 2).alignment = { vertical: "middle", horizontal: "center" };
    ws.mergeCells(row, 4, row, 6);
    ws.getCell(row, 4).value = sectionRows
      .slice(0, 3)
      .map((r) => r.item)
      .join(", ");
    ws.getCell(row, 4).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    applyBorders(ws, `A${row}:F${row}`);
    row += 1;
  }

  row += 1;

  // 5) Main body table
  const cols = deriveColumns(profile);
  ws.mergeCells(row, 1, row, 6);
  ws.getCell(row, 1).value = "본문 표";
  ws.getCell(row, 1).font = { name: "Malgun Gothic", size: 12, bold: true };
  row += 1;

  cols.forEach((col, idx) => {
    const cell = ws.getCell(row, idx + 1);
    cell.value = col;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  applyBorders(ws, `A${row}:F${row}`);
  ws.getRow(row).height = 22;
  row += 1;

  let no = 0;
  for (const [section, sectionRows] of Object.entries(grouped)) {
    // Section header row spanning all columns
    ws.mergeCells(row, 1, row, 6);
    const sCell = ws.getCell(row, 1);
    sCell.value = section;
    sCell.fill = SECTION_FILL;
    sCell.font = SECTION_FONT;
    sCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    applyBorders(ws, `A${row}:F${row}`);
    row += 1;

    for (const r of sectionRows) {
      no += 1;
      ws.getCell(row, 1).value = no;
      ws.getCell(row, 2).value = section;
      ws.getCell(row, 3).value = r.item;
      ws.getCell(row, 4).value = r.content;
      ws.getCell(row, 5).value = "□ 확인";
      ws.getCell(row, 6).value = "담당: ______";
      [1, 5].forEach((c) => {
        ws.getCell(row, c).alignment = { vertical: "middle", horizontal: "center" };
      });
      [2, 3, 4, 6].forEach((c) => {
        ws.getCell(row, c).alignment = { vertical: "top", horizontal: "left", wrapText: true };
      });
      applyBorders(ws, `A${row}:F${row}`);
      row += 1;
    }
  }

  row += 1;

  // 6) Approval row
  if (profile.approvalLabels?.length) {
    profile.approvalLabels.slice(0, 5).forEach((label, idx) => {
      ws.getCell(row, idx + 1).value = `${label}\n\n서명: ______`;
      ws.getCell(row, idx + 1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      ws.getCell(row, idx + 1).font = { name: "Malgun Gothic", size: 10, bold: true };
    });
    ws.getCell(row, 6).value = "보관 위치\n\n______";
    ws.getCell(row, 6).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    applyBorders(ws, `A${row}:F${row}`);
    ws.getRow(row).height = 50;
    row += 1;
  }

  // 7) Note
  ws.mergeCells(row, 1, row, 6);
  const note = ws.getCell(row, 1);
  note.value =
    "본 파일은 ExcelJS 기반 OOXML(.xlsx) 정식 양식입니다. 현장 검토 후 서명·확인 칸을 채워 사용하세요.";
  note.font = { name: "Malgun Gothic", size: 10, italic: true, color: { argb: "FF5E6677" } };
  note.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  // Print area
  ws.pageSetup.printArea = `A1:F${row}`;

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

/**
 * Build a multi-sheet "workpack" .xlsx with one sheet per document key.
 */
export async function buildWorkpackXlsx(
  scenario: AskResponse["scenario"],
  documents: Array<{ title: string; rows: SheetRow[]; profile: SafetyFormProfile; structuredRiskRows?: StructuredRiskAssessmentRow[] }>
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SafeClaw";
  wb.created = new Date();

  // Cover sheet
  const cover = wb.addWorksheet("표지", { pageSetup: { paperSize: 9, orientation: "landscape" } });
  cover.columns = [{ width: 18 }, { width: 60 }];
  cover.getCell(1, 1).value = "SafeClaw 안전 문서팩";
  cover.getCell(1, 1).font = { name: "Malgun Gothic", size: 18, bold: true, color: { argb: "FF1F4D43" } };
  cover.mergeCells(1, 1, 1, 2);
  const coverRows: Array<[string, string]> = [
    ["사업장", scenario.companyName || ""],
    ["현장/공정", scenario.siteName || ""],
    ["작업내용", scenario.workSummary || ""],
    ["인원/조건", `${scenario.workerCount ?? 0}명 · ${scenario.weatherNote || ""}`],
    ["생성", new Date().toISOString()]
  ];
  coverRows.forEach((pair, idx) => {
    const r = idx + 3;
    cover.getCell(r, 1).value = pair[0];
    cover.getCell(r, 1).fill = META_LABEL_FILL;
    cover.getCell(r, 1).font = META_LABEL_FONT;
    cover.getCell(r, 1).alignment = { vertical: "middle", horizontal: "center" };
    cover.getCell(r, 2).value = pair[1];
    cover.getCell(r, 2).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    applyBorders(cover, `A${r}:B${r}`);
  });

  // Document sheets
  for (const doc of documents) {
    const sheetName = doc.title.replace(/[\\/?*[\]]/g, "_").slice(0, 31);
    const ws = wb.addWorksheet(sheetName, {
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });
    const isStructuredRiskSheet = doc.profile.layout === "risk" && Boolean(doc.structuredRiskRows?.length);
    if (isStructuredRiskSheet) {
      applyRiskAssessmentColumns(ws);
    } else {
      ws.columns = [{ width: 6 }, { width: 16 }, { width: 28 }, { width: 50 }, { width: 10 }, { width: 14 }];
    }

    let row = 1;
    ws.mergeCells(row, 1, row, isStructuredRiskSheet ? 11 : 6);
    ws.getCell(row, 1).value = doc.title;
    ws.getCell(row, 1).font = { name: "Malgun Gothic", size: 14, bold: true, color: { argb: "FF1F4D43" } };
    ws.getRow(row).height = 26;
    row += 1;

    if (isStructuredRiskSheet) {
      const riskRows = resolveRiskAssessmentRows({ structuredRows: doc.structuredRiskRows, fallbackRows: doc.rows });
      writeOfficialLikeRiskAssessmentTable(ws, row, riskRows);
      continue;
    }

    const cols = deriveColumns(doc.profile);
    cols.forEach((col, idx) => {
      const cell = ws.getCell(row, idx + 1);
      cell.value = col;
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    applyBorders(ws, `A${row}:F${row}`);
    row += 1;

    let no = 0;
    const grouped = doc.rows.reduce<Record<string, SheetRow[]>>((acc, r) => {
      acc[r.section] = [...(acc[r.section] || []), r];
      return acc;
    }, {});
    for (const [section, sectionRows] of Object.entries(grouped)) {
      ws.mergeCells(row, 1, row, 6);
      const s = ws.getCell(row, 1);
      s.value = section;
      s.fill = SECTION_FILL;
      s.font = SECTION_FONT;
      applyBorders(ws, `A${row}:F${row}`);
      row += 1;
      for (const r of sectionRows) {
        no += 1;
        ws.getCell(row, 1).value = no;
        ws.getCell(row, 2).value = section;
        ws.getCell(row, 3).value = r.item;
        ws.getCell(row, 4).value = r.content;
        ws.getCell(row, 5).value = "□";
        ws.getCell(row, 6).value = "______";
        [4].forEach((c) => {
          ws.getCell(row, c).alignment = { vertical: "top", horizontal: "left", wrapText: true };
        });
        applyBorders(ws, `A${row}:F${row}`);
        row += 1;
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}
