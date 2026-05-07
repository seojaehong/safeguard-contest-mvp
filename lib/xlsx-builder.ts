// Real .xlsx builder via ExcelJS (replaces HTML-as-.xls).
// Produces OOXML binary that opens cleanly in Excel/한셀 with no extension warning.

import ExcelJS from "exceljs";
import type { AskResponse, WorkPlanStructured } from "@/lib/types";

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
};

function deriveColumns(profile: SafetyFormProfile): string[] {
  // 사용자 검수: 한빛로지스 work-plan.xlsx의 "순번" 의미 불명. 1~21 row index는 양식 의미가 없음.
  // 모든 layout에서 통일하여 "No." 사용 — 그리고 buildXlsxForDocument에서 섹션별로 리셋되어
  // "이 섹션의 N번째 항목"이라는 의미를 갖게 한다.
  switch (profile.layout) {
    case "risk":
      return ["No.", "구분", profile.primaryColumn || "유해·위험요인", profile.actionColumn || "감소대책", "확인", "담당"];
    case "workPlan":
      return ["No.", "구분", profile.primaryColumn || "작업개요", profile.actionColumn || "장비·인원", "확인", "담당"];
    case "permit":
      return ["No.", "구분", profile.primaryColumn || "허가항목", profile.actionColumn || "조건/조치", "확인", "담당"];
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
  const { title, rows, profile, scenario } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = "SafeClaw";
  wb.created = new Date();

  const ws = wb.addWorksheet(title.slice(0, 31), {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  // Column widths
  ws.columns = [
    { width: 6 },
    { width: 16 },
    { width: 28 },
    { width: 50 },
    { width: 10 },
    { width: 14 }
  ];

  let row = 1;

  // 1) Cover
  ws.mergeCells(row, 1, row, 6);
  const coverCell = ws.getCell(row, 1);
  coverCell.value = `${title}  ·  ${profile.subtitle}`;
  coverCell.font = { name: "Malgun Gothic", size: 16, bold: true, color: { argb: "FF1F4D43" } };
  coverCell.fill = COVER_FILL;
  coverCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(row).height = 32;
  applyBorders(ws, `A${row}:F${row}`);
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
    ws.mergeCells(row, 5, row, 6);
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
    applyBorders(ws, `A${row}:F${row}`);
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

  // 4) Section summary
  const grouped = rows.reduce<Record<string, SheetRow[]>>((acc, r) => {
    acc[r.section] = [...(acc[r.section] || []), r];
    return acc;
  }, {});
  ws.mergeCells(row, 1, row, 6);
  ws.getCell(row, 1).value = "섹션 요약";
  ws.getCell(row, 1).font = { name: "Malgun Gothic", size: 12, bold: true };
  row += 1;

  // 섹션 요약 헤더: A열은 6 너비로 좁아 섹션명("옥외작업 폭염·자외선 위험 반영" 15자) 잘림.
  // A:C 머지로 섹션명 컬럼 확보(6+16+28=50 너비), D는 항목 수, E:F는 주요 항목.
  ws.mergeCells(row, 1, row, 3);
  ws.getCell(row, 1).value = "섹션";
  ws.getCell(row, 4).value = "항목 수";
  ws.mergeCells(row, 5, row, 6);
  ws.getCell(row, 5).value = "주요 항목";
  [1, 4, 5].forEach((c) => {
    ws.getCell(row, c).fill = HEADER_FILL;
    ws.getCell(row, c).font = HEADER_FONT;
    ws.getCell(row, c).alignment = { vertical: "middle", horizontal: "center" };
  });
  applyBorders(ws, `A${row}:F${row}`);
  row += 1;
  for (const [section, sectionRows] of Object.entries(grouped)) {
    ws.mergeCells(row, 1, row, 3);
    ws.getCell(row, 1).value = section;
    ws.getCell(row, 1).alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
    ws.getCell(row, 4).value = sectionRows.length;
    ws.getCell(row, 4).alignment = { vertical: "middle", horizontal: "center" };
    ws.mergeCells(row, 5, row, 6);
    ws.getCell(row, 5).value = sectionRows
      .slice(0, 3)
      .map((r) => r.item)
      .join(", ");
    ws.getCell(row, 5).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
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

    // 섹션별 No. 리셋: "1. 작업개요"의 1~4, "2. 작업순서"의 1~4 처럼 섹션-로컬 번호.
    // 이전 글로벌 1~21 방식은 사용자 검수에서 "순번 의미 불명" 지적 받음.
    let sectionNo = 0;
    for (const r of sectionRows) {
      sectionNo += 1;
      ws.getCell(row, 1).value = sectionNo;
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
  documents: Array<{ title: string; rows: SheetRow[]; profile: SafetyFormProfile }>
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
    ws.columns = [{ width: 6 }, { width: 16 }, { width: 28 }, { width: 50 }, { width: 10 }, { width: 14 }];

    let row = 1;
    ws.mergeCells(row, 1, row, 6);
    ws.getCell(row, 1).value = doc.title;
    ws.getCell(row, 1).font = { name: "Malgun Gothic", size: 14, bold: true, color: { argb: "FF1F4D43" } };
    ws.getRow(row).height = 26;
    row += 1;

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

/**
 * Schema-first 작업계획서 .xlsx 빌더.
 *
 * 기존 buildXlsxForDocument 경로는 AI가 만든 산문(workPlanDraft)을 parseSheetRows로 잘라
 * SheetRow[]로 변환 후 표에 박는 lossy 파이프라인. 행이 잘리거나 한 셀에 다 들어가는
 * 문제가 발생.
 *
 * 이 함수는 AiDeliverables.workPlanStructured를 받아 산문 파싱을 거치지 않고 한국 표준
 * 작업계획서 양식 5섹션(작업개요/작업순서/작업중지 기준/비상대응/확인란)에 셀 단위로
 * 직접 매핑한다. AI는 산문 작성자가 아닌 셀 채우기 보조자로만 동작.
 */
export async function buildWorkPlanStructuredXlsx(
  scenario: AskResponse["scenario"],
  structured: WorkPlanStructured
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SafeClaw";
  wb.created = new Date();

  const ws = wb.addWorksheet("작업계획서", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  ws.columns = [
    { width: 6 },   // No.
    { width: 18 },  // 구분
    { width: 36 },  // 항목
    { width: 50 },  // 내용
    { width: 12 },  // 확인
    { width: 14 }   // 담당
  ];

  let row = 1;

  // 1) Cover
  ws.mergeCells(row, 1, row, 6);
  const coverCell = ws.getCell(row, 1);
  coverCell.value = "작업계획서 (구조화 양식)";
  coverCell.font = { name: "Malgun Gothic", size: 16, bold: true, color: { argb: "FF1F4D43" } };
  coverCell.fill = COVER_FILL;
  coverCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(row).height = 32;
  applyBorders(ws, `A${row}:F${row}`);
  row += 1;

  // 2) Meta grid (사업장/현장 · 작업/인원)
  const metaRows = [
    [["사업장", scenario.companyName || ""], ["현장/공정", scenario.siteName || ""]],
    [["작업내용", structured.workOverview.description || scenario.workSummary || ""],
     ["인원/조건", `${structured.workOverview.workerCount || scenario.workerCount || 0}명 · ${structured.workOverview.condition || scenario.weatherNote || ""}`]]
  ];
  for (const pair of metaRows) {
    const [[lbl1, val1], [lbl2, val2]] = pair;
    ws.getCell(row, 1).value = lbl1;
    ws.mergeCells(row, 2, row, 3);
    ws.getCell(row, 2).value = val1;
    ws.getCell(row, 4).value = lbl2;
    ws.mergeCells(row, 5, row, 6);
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
    applyBorders(ws, `A${row}:F${row}`);
    row += 1;
  }

  row += 1;

  // 3) 1. 작업개요
  ws.mergeCells(row, 1, row, 6);
  ws.getCell(row, 1).value = "1. 작업개요";
  ws.getCell(row, 1).fill = SECTION_FILL;
  ws.getCell(row, 1).font = SECTION_FONT;
  ws.getCell(row, 1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  applyBorders(ws, `A${row}:F${row}`);
  row += 1;

  const overviewRows: Array<[string, string]> = [
    ["작업명", structured.workOverview.workName],
    ["작업장소", structured.workOverview.location],
    ["사용 장비", (structured.workOverview.equipment || []).join(", ")]
  ];
  for (const [label, value] of overviewRows) {
    ws.mergeCells(row, 1, row, 2);
    ws.getCell(row, 1).value = label;
    ws.getCell(row, 1).fill = META_LABEL_FILL;
    ws.getCell(row, 1).font = META_LABEL_FONT;
    ws.getCell(row, 1).alignment = { vertical: "middle", horizontal: "center" };
    ws.mergeCells(row, 3, row, 6);
    ws.getCell(row, 3).value = value;
    ws.getCell(row, 3).alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
    applyBorders(ws, `A${row}:F${row}`);
    row += 1;
  }

  row += 1;

  // 4) 2. 작업순서
  ws.mergeCells(row, 1, row, 6);
  ws.getCell(row, 1).value = "2. 작업순서";
  ws.getCell(row, 1).fill = SECTION_FILL;
  ws.getCell(row, 1).font = SECTION_FONT;
  ws.getCell(row, 1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  applyBorders(ws, `A${row}:F${row}`);
  row += 1;

  const stepHeaders = ["No.", "작업단계", "사용장비", "안전조치", "담당자", "확인"];
  stepHeaders.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  applyBorders(ws, `A${row}:F${row}`);
  ws.getRow(row).height = 22;
  row += 1;

  for (const step of structured.workSteps) {
    ws.getCell(row, 1).value = step.stepNo;
    ws.getCell(row, 2).value = step.action;
    ws.getCell(row, 3).value = step.equipment;
    ws.getCell(row, 4).value = step.safetyMeasure;
    ws.getCell(row, 5).value = step.owner;
    ws.getCell(row, 6).value = "□";
    [1, 6].forEach((c) => {
      ws.getCell(row, c).alignment = { vertical: "middle", horizontal: "center" };
    });
    [2, 3, 4, 5].forEach((c) => {
      ws.getCell(row, c).alignment = { vertical: "top", horizontal: "left", wrapText: true };
    });
    applyBorders(ws, `A${row}:F${row}`);
    row += 1;
  }

  row += 1;

  // 5) 3. 작업중지 기준
  ws.mergeCells(row, 1, row, 6);
  ws.getCell(row, 1).value = "3. 작업중지 기준";
  ws.getCell(row, 1).fill = SECTION_FILL;
  ws.getCell(row, 1).font = SECTION_FONT;
  ws.getCell(row, 1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  applyBorders(ws, `A${row}:F${row}`);
  row += 1;

  structured.stopCriteria.forEach((criterion, i) => {
    ws.getCell(row, 1).value = i + 1;
    ws.mergeCells(row, 2, row, 5);
    ws.getCell(row, 2).value = criterion;
    ws.getCell(row, 6).value = "□";
    ws.getCell(row, 1).alignment = { vertical: "middle", horizontal: "center" };
    ws.getCell(row, 2).alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
    ws.getCell(row, 6).alignment = { vertical: "middle", horizontal: "center" };
    applyBorders(ws, `A${row}:F${row}`);
    row += 1;
  });

  row += 1;

  // 6) 4. 비상대응
  ws.mergeCells(row, 1, row, 6);
  ws.getCell(row, 1).value = "4. 비상대응";
  ws.getCell(row, 1).fill = SECTION_FILL;
  ws.getCell(row, 1).font = SECTION_FONT;
  ws.getCell(row, 1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  applyBorders(ws, `A${row}:F${row}`);
  row += 1;

  for (const [label, value] of [
    ["대피경로", structured.emergencyResponse.evacRoute],
    ["응급조치", structured.emergencyResponse.firstAid]
  ] as const) {
    ws.mergeCells(row, 1, row, 2);
    ws.getCell(row, 1).value = label;
    ws.getCell(row, 1).fill = META_LABEL_FILL;
    ws.getCell(row, 1).font = META_LABEL_FONT;
    ws.getCell(row, 1).alignment = { vertical: "middle", horizontal: "center" };
    ws.mergeCells(row, 3, row, 6);
    ws.getCell(row, 3).value = value;
    ws.getCell(row, 3).alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
    applyBorders(ws, `A${row}:F${row}`);
    row += 1;
  }

  // 비상연락망 table
  ws.mergeCells(row, 1, row, 2);
  ws.getCell(row, 1).value = "비상연락망";
  ws.getCell(row, 1).fill = META_LABEL_FILL;
  ws.getCell(row, 1).font = META_LABEL_FONT;
  ws.getCell(row, 1).alignment = { vertical: "middle", horizontal: "center" };
  ws.mergeCells(row, 3, row, 4);
  ws.getCell(row, 3).value = "직책";
  ws.getCell(row, 3).fill = HEADER_FILL;
  ws.getCell(row, 3).font = HEADER_FONT;
  ws.getCell(row, 3).alignment = { vertical: "middle", horizontal: "center" };
  ws.mergeCells(row, 5, row, 6);
  ws.getCell(row, 5).value = "연락처";
  ws.getCell(row, 5).fill = HEADER_FILL;
  ws.getCell(row, 5).font = HEADER_FONT;
  ws.getCell(row, 5).alignment = { vertical: "middle", horizontal: "center" };
  applyBorders(ws, `A${row}:F${row}`);
  row += 1;
  for (const contact of structured.emergencyResponse.contacts) {
    ws.mergeCells(row, 1, row, 2);
    ws.getCell(row, 1).value = "";
    ws.mergeCells(row, 3, row, 4);
    ws.getCell(row, 3).value = contact.role;
    ws.getCell(row, 3).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.mergeCells(row, 5, row, 6);
    ws.getCell(row, 5).value = contact.phone;
    ws.getCell(row, 5).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    applyBorders(ws, `A${row}:F${row}`);
    row += 1;
  }

  row += 1;

  // 7) 5. 확인란
  ws.mergeCells(row, 1, row, 6);
  ws.getCell(row, 1).value = "5. 확인란";
  ws.getCell(row, 1).fill = SECTION_FILL;
  ws.getCell(row, 1).font = SECTION_FONT;
  ws.getCell(row, 1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  applyBorders(ws, `A${row}:F${row}`);
  row += 1;

  ws.mergeCells(row, 1, row, 2);
  ws.getCell(row, 1).value = `작성: ${structured.approvers.author}\n서명: ______`;
  ws.getCell(row, 1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  ws.getCell(row, 1).font = { name: "Malgun Gothic", size: 10, bold: true };
  ws.mergeCells(row, 3, row, 4);
  ws.getCell(row, 3).value = `검토: ${structured.approvers.reviewer}\n서명: ______`;
  ws.getCell(row, 3).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  ws.getCell(row, 3).font = { name: "Malgun Gothic", size: 10, bold: true };
  ws.mergeCells(row, 5, row, 6);
  ws.getCell(row, 5).value = `승인: ${structured.approvers.approver}\n서명: ______`;
  ws.getCell(row, 5).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  ws.getCell(row, 5).font = { name: "Malgun Gothic", size: 10, bold: true };
  applyBorders(ws, `A${row}:F${row}`);
  ws.getRow(row).height = 50;
  row += 1;

  ws.pageSetup.printArea = `A1:F${row}`;
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}
