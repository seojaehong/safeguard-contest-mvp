// Real .xlsx builder via ExcelJS (replaces HTML-as-.xls).
// Produces OOXML binary that opens cleanly in Excel/한셀 with no extension warning.

import ExcelJS from "exceljs";
import type { AskResponse, EducationRecordStructured, PermitInspectionStructured, TbmBriefingStructured, WorkPlanStructured } from "@/lib/types";
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
const RISK_ASSESSMENT_COLUMNS = [
  { header: "No.", width: 6 },
  { header: "작업장소", width: 20 },
  { header: "공정", width: 16 },
  { header: "세부작업", width: 24 },
  { header: "장비·도구", width: 20 },
  { header: "유해·위험요인", width: 30 },
  { header: "4M", width: 14 },
  { header: "재해유형", width: 16 },
  { header: "현재 안전조치", width: 30 },
  { header: "가능성", width: 10 },
  { header: "중대성", width: 10 },
  { header: "위험성", width: 12 },
  { header: "감소대책", width: 36 },
  { header: "담당자", width: 14 },
  { header: "조치기한", width: 14 },
  { header: "확인상태", width: 14 },
  { header: "확인일", width: 14 },
  { header: "확인자", width: 14 },
  { header: "근거", width: 28 }
] as const;

type Scenario = AskResponse["scenario"];
type StructuredRecord = Record<string, unknown>;

const STRUCTURED_DOC_COLUMNS = [
  { width: 8 },
  { width: 18 },
  { width: 32 },
  { width: 46 },
  { width: 18 },
  { width: 18 }
];

function isRecord(value: unknown): value is StructuredRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function columnLetter(column: number): string {
  let value = column;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

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
  ws.columns = RISK_ASSESSMENT_COLUMNS.map((column) => ({ width: column.width }));
}

function writeOfficialLikeRiskAssessmentTable(
  ws: ExcelJS.Worksheet,
  startRow: number,
  rows: StructuredRiskAssessmentRow[]
): number {
  let row = startRow;
  const lastColumn = RISK_ASSESSMENT_COLUMNS.length;
  const lastColumnLetter = columnLetter(lastColumn);
  ws.mergeCells(row, 1, row, lastColumn);
  ws.getCell(row, 1).value = "위험성평가표";
  ws.getCell(row, 1).font = { name: "Malgun Gothic", size: 12, bold: true };
  row += 1;

  RISK_ASSESSMENT_COLUMNS.forEach((column, index) => {
    const cell = ws.getCell(row, index + 1);
    cell.value = column.header;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  applyBorders(ws, `A${row}:${lastColumnLetter}${row}`);
  ws.getRow(row).height = 26;
  row += 1;

  // Index reference for alignment rules (0-based column index = headers index)
  const wrapColumns = new Set([5, 8, 12, 18]); // hazard, currentControls, additionalControls, 근거
  const centerColumns = new Set([0, 6, 9, 10, 11, 15, 16]); // No./4M/L/S/RL/확인상태/확인일

  rows.forEach((riskRow, index) => {
    const evidenceText = riskRow.evidenceRefsList && riskRow.evidenceRefsList.length
      ? riskRow.evidenceRefsList.join("\n")
      : (riskRow.evidence || riskRow.evidenceRefs?.join(", ") || "근거 확인");
    const values = [
      riskRow.id || String(index + 1),
      riskRow.location || "현장 확인",
      riskRow.process || riskRow.section || "위험성평가",
      riskRow.unitTask,
      riskRow.equipment || "장비·도구 확인",
      riskRow.hazard,
      riskRow.fourM || "Management",
      riskRow.accidentType || "other",
      riskRow.currentControls || "현장 확인",
      riskRow.likelihood || "확인",
      riskRow.severity || "확인",
      riskRow.riskLevel || "확인",
      riskRow.additionalControls,
      riskRow.owner || "작업반장",
      riskRow.dueDate || riskRow.due || "작업 전",
      riskRow.verificationStatus || riskRow.status || "planned",
      riskRow.verificationDate || "현장 확인",
      riskRow.verificationChecker || "관리감독자",
      evidenceText
    ];
    values.forEach((value, columnIndex) => {
      const cell = ws.getCell(row, columnIndex + 1);
      cell.value = value;
      cell.alignment = {
        vertical: wrapColumns.has(columnIndex) ? "top" : "middle",
        horizontal: centerColumns.has(columnIndex) ? "center" : "left",
        wrapText: true
      };
    });
    applyBorders(ws, `A${row}:${lastColumnLetter}${row}`);
    ws.getRow(row).height = 48;
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

function addStructuredTitle(ws: ExcelJS.Worksheet, row: number, title: string, scenario: Scenario): number {
  ws.mergeCells(row, 1, row, 6);
  const titleCell = ws.getCell(row, 1);
  titleCell.value = title;
  titleCell.font = { name: "Malgun Gothic", size: 18, bold: true, color: { argb: "FF1F4D43" } };
  titleCell.fill = COVER_FILL;
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(row).height = 34;
  applyBorders(ws, `A${row}:F${row}`);
  row += 1;

  const metaRows: Array<[[string, string], [string, string]]> = [
    [["사업장", scenario.companyName || "SafeClaw 현장"], ["현장", scenario.siteName || "현장 확인"]],
    [["작업내용", scenario.workSummary || "작업내용 확인"], ["인원/조건", `${scenario.workerCount ?? 0}명 · ${scenario.weatherNote || ""}`]]
  ];

  metaRows.forEach((pair) => {
    ws.getCell(row, 1).value = pair[0][0];
    ws.mergeCells(row, 2, row, 3);
    ws.getCell(row, 2).value = pair[0][1];
    ws.getCell(row, 4).value = pair[1][0];
    ws.mergeCells(row, 5, row, 6);
    ws.getCell(row, 5).value = pair[1][1];
    [1, 4].forEach((column) => {
      const cell = ws.getCell(row, column);
      cell.fill = META_LABEL_FILL;
      cell.font = META_LABEL_FONT;
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    [2, 5].forEach((column) => {
      ws.getCell(row, column).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    });
    applyBorders(ws, `A${row}:F${row}`);
    row += 1;
  });

  return row + 1;
}

function addSectionHeader(ws: ExcelJS.Worksheet, row: number, label: string): number {
  ws.mergeCells(row, 1, row, 6);
  const cell = ws.getCell(row, 1);
  cell.value = label;
  cell.fill = SECTION_FILL;
  cell.font = SECTION_FONT;
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  applyBorders(ws, `A${row}:F${row}`);
  return row + 1;
}

function addTableHeader(ws: ExcelJS.Worksheet, row: number, headers: string[]): number {
  headers.forEach((header, index) => {
    const cell = ws.getCell(row, index + 1);
    cell.value = header;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  applyBorders(ws, `A${row}:F${row}`);
  ws.getRow(row).height = 24;
  return row + 1;
}

function setRowValues(ws: ExcelJS.Worksheet, row: number, values: string[]): number {
  values.forEach((value, index) => {
    const cell = ws.getCell(row, index + 1);
    cell.value = value;
    cell.alignment = {
      vertical: index === 3 ? "top" : "middle",
      horizontal: index === 0 || index === 4 || index === 5 ? "center" : "left",
      wrapText: true
    };
  });
  applyBorders(ws, `A${row}:F${row}`);
  ws.getRow(row).height = 36;
  return row + 1;
}

function addKeyValueRows(ws: ExcelJS.Worksheet, row: number, rows: Array<[string, string]>): number {
  rows.forEach(([label, value]) => {
    ws.getCell(row, 1).value = label;
    ws.getCell(row, 1).fill = META_LABEL_FILL;
    ws.getCell(row, 1).font = META_LABEL_FONT;
    ws.getCell(row, 1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    ws.mergeCells(row, 2, row, 6);
    ws.getCell(row, 2).value = value;
    ws.getCell(row, 2).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    applyBorders(ws, `A${row}:F${row}`);
    row += 1;
  });
  return row;
}

function addApprovalRows(ws: ExcelJS.Worksheet, row: number, labels: string[]): number {
  row = addSectionHeader(ws, row, "확인 및 결재");
  labels.slice(0, 3).forEach((label, index) => {
    const startColumn = index * 2 + 1;
    ws.mergeCells(row, startColumn, row, startColumn + 1);
    const cell = ws.getCell(row, startColumn);
    cell.value = `${label}\n서명: ______`;
    cell.font = { name: "Malgun Gothic", size: 10, bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  applyBorders(ws, `A${row}:F${row}`);
  ws.getRow(row).height = 50;
  return row + 1;
}

function addWorkbookNote(ws: ExcelJS.Worksheet, row: number, note: string): void {
  ws.mergeCells(row, 1, row, 6);
  const cell = ws.getCell(row, 1);
  cell.value = note;
  cell.font = { name: "Malgun Gothic", size: 10, italic: true, color: { argb: "FF5E6677" } };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
  applyBorders(ws, `A${row}:F${row}`);
  ws.pageSetup.printArea = `A1:F${row}`;
}

function createStructuredWorkbook(sheetName: string): { wb: ExcelJS.Workbook; ws: ExcelJS.Worksheet } {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SafeClaw";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName.slice(0, 31), {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });
  ws.columns = STRUCTURED_DOC_COLUMNS;
  return { wb, ws };
}

function parseWorkPlanStructured(value: StructuredRecord): WorkPlanStructured {
  const overview = isRecord(value.workOverview) ? value.workOverview : {};
  const emergency = isRecord(value.emergencyResponse) ? value.emergencyResponse : {};
  const approvers = isRecord(value.approvers) ? value.approvers : {};
  const steps = Array.isArray(value.workSteps) ? value.workSteps : [];
  const contacts = Array.isArray(emergency.contacts) ? emergency.contacts : [];
  return {
    workOverview: {
      workName: readString(overview.workName, "작업명 확인"),
      description: readString(overview.description, "작업내용 확인"),
      workerCount: readNumber(overview.workerCount, 0),
      location: readString(overview.location, "작업장소 확인"),
      condition: readString(overview.condition, "작업조건 확인"),
      equipment: readStringArray(overview.equipment)
    },
    workSteps: steps.flatMap((item, index): WorkPlanStructured["workSteps"] => {
      if (!isRecord(item)) return [];
      return [{
        stepNo: readNumber(item.stepNo, index + 1),
        action: readString(item.action, "작업단계 확인"),
        equipment: readString(item.equipment, "장비 확인"),
        safetyMeasure: readString(item.safetyMeasure, "안전조치 확인"),
        owner: readString(item.owner, "담당자 확인")
      }];
    }),
    stopCriteria: readStringArray(value.stopCriteria),
    emergencyResponse: {
      contacts: contacts.flatMap((item): WorkPlanStructured["emergencyResponse"]["contacts"] => {
        if (!isRecord(item)) return [];
        return [{ role: readString(item.role, "역할 확인"), phone: readString(item.phone, "연락처 확인") }];
      }),
      evacRoute: readString(emergency.evacRoute, "대피경로 확인"),
      firstAid: readString(emergency.firstAid, "응급조치 확인")
    },
    approvers: {
      author: readString(approvers.author, "작성자"),
      reviewer: readString(approvers.reviewer, "검토자"),
      approver: readString(approvers.approver, "승인자")
    }
  };
}

function parseTbmBriefingStructured(value: StructuredRecord): TbmBriefingStructured {
  const meta = isRecord(value.meta) ? value.meta : {};
  const todayWork = isRecord(value.todayWork) ? value.todayWork : {};
  const hazards = Array.isArray(value.hazards) ? value.hazards : [];
  const measures = Array.isArray(value.measures) ? value.measures : [];
  return {
    meta: {
      dateTime: readString(meta.dateTime, "일시 확인"),
      location: readString(meta.location, "장소 확인"),
      target: readString(meta.target, "대상 확인"),
      attendees: readString(meta.attendees, "참석자 확인")
    },
    todayWork: {
      name: readString(todayWork.name, "작업명 확인"),
      location: readString(todayWork.location, "작업 위치 확인"),
      time: readString(todayWork.time, "작업 시간 확인"),
      equipment: readStringArray(todayWork.equipment)
    },
    hazards: hazards.flatMap((item): TbmBriefingStructured["hazards"] => {
      if (!isRecord(item)) return [];
      const category = readString(item.category, "Management");
      const safeCategory: TbmBriefingStructured["hazards"][number]["category"] =
        category === "Man" || category === "Machine" || category === "Media" || category === "Management"
          ? category
          : "Management";
      return [{ category: safeCategory, description: readString(item.description, "위험요인 확인") }];
    }),
    measures: measures.flatMap((item): TbmBriefingStructured["measures"] => {
      if (!isRecord(item)) return [];
      return [{
        hazardRef: readNumber(item.hazardRef, 0),
        action: readString(item.action, "안전대책 확인"),
        owner: readString(item.owner, "담당자 확인")
      }];
    }),
    stopCriteria: readStringArray(value.stopCriteria),
    confirmTopics: readStringArray(value.confirmTopics),
    photoEvidenceLocation: readString(value.photoEvidenceLocation, "사진증빙 위치 확인")
  };
}

function parseEducationRecordStructured(value: StructuredRecord): EducationRecordStructured {
  const curriculum = Array.isArray(value.curriculum) ? value.curriculum : [];
  const type = readString(value.type, "기타");
  const safeType: EducationRecordStructured["type"] =
    type === "정기교육" || type === "특별교육" || type === "외국인교육" || type === "신규자교육" || type === "관리감독자교육"
      ? type
      : "기타";
  return {
    educationName: readString(value.educationName, "안전보건교육"),
    type: safeType,
    dateTime: readString(value.dateTime, "일시 확인"),
    location: readString(value.location, "장소 확인"),
    target: readString(value.target, "교육대상 확인"),
    instructor: readString(value.instructor, "실시자 확인"),
    confirmer: readString(value.confirmer, "확인자 확인"),
    curriculum: curriculum.flatMap((item): EducationRecordStructured["curriculum"] => {
      if (!isRecord(item)) return [];
      return [{
        topic: readString(item.topic, "교육 주제 확인"),
        lawCitation: readString(item.lawCitation, "법령 조항 확인"),
        keyPoints: readStringArray(item.keyPoints)
      }];
    }),
    understandingCheck: readString(value.understandingCheck, "이해확인 방법 확인"),
    tbmLink: readString(value.tbmLink, "TBM 연계 확인"),
    followupRecommendation: readString(value.followupRecommendation, "후속 교육 확인")
  };
}

function readPermitType(value: unknown): PermitInspectionStructured["basicInfo"]["permitType"] {
  const text = readString(value, "일반 위험작업");
  const allowed: Array<PermitInspectionStructured["basicInfo"]["permitType"]> = [
    "고소작업",
    "화기작업",
    "밀폐공간",
    "전기작업",
    "중장비작업",
    "화학물질",
    "일반 위험작업"
  ];
  return allowed.includes(text as PermitInspectionStructured["basicInfo"]["permitType"])
    ? text as PermitInspectionStructured["basicInfo"]["permitType"]
    : "일반 위험작업";
}

function readPermitConditionCategory(value: unknown): PermitInspectionStructured["conditions"][number]["category"] {
  const text = readString(value, "작업구역");
  const allowed: Array<PermitInspectionStructured["conditions"][number]["category"]> = [
    "작업구역",
    "격리·차단",
    "화재·폭발",
    "질식·가스",
    "추락·낙하",
    "장비·동선",
    "보호구",
    "기상·환경",
    "교육·TBM"
  ];
  return allowed.includes(text as PermitInspectionStructured["conditions"][number]["category"])
    ? text as PermitInspectionStructured["conditions"][number]["category"]
    : "작업구역";
}

function readPermitConditionStatus(value: unknown): PermitInspectionStructured["conditions"][number]["status"] {
  const text = readString(value, "확인 전");
  return text === "적합" || text === "보완 필요" || text === "해당 없음" ? text : "확인 전";
}

function readAttachmentStatus(value: unknown): PermitInspectionStructured["attachments"][number]["status"] {
  const text = readString(value, "보완 필요");
  return text === "첨부" || text === "해당 없음" ? text : "보완 필요";
}

function readCompletionStatus(value: unknown): PermitInspectionStructured["completionChecks"][number]["status"] {
  const text = readString(value, "확인 전");
  return text === "완료" || text === "보완 필요" ? text : "확인 전";
}

function parsePermitInspectionStructured(value: StructuredRecord): PermitInspectionStructured {
  const basicInfo = isRecord(value.basicInfo) ? value.basicInfo : {};
  const conditions = Array.isArray(value.conditions) ? value.conditions : [];
  const attachments = Array.isArray(value.attachments) ? value.attachments : [];
  const completionChecks = Array.isArray(value.completionChecks) ? value.completionChecks : [];
  const approvers = isRecord(value.approvers) ? value.approvers : {};

  return {
    basicInfo: {
      permitNo: readString(basicInfo.permitNo, "현장 발급"),
      permitType: readPermitType(basicInfo.permitType),
      workName: readString(basicInfo.workName, "작업명 확인"),
      location: readString(basicInfo.location, "작업장소 확인"),
      workDate: readString(basicInfo.workDate, "작업일 확인"),
      workerCount: readNumber(basicInfo.workerCount, 0),
      requester: readString(basicInfo.requester, "작업반장"),
      approver: readString(basicInfo.approver, "관리감독자")
    },
    conditions: conditions.flatMap((item): PermitInspectionStructured["conditions"] => {
      if (!isRecord(item)) return [];
      return [{
        category: readPermitConditionCategory(item.category),
        requirement: readString(item.requirement, "허가조건 확인"),
        action: readString(item.action, "작업 전 조치 확인"),
        owner: readString(item.owner, "작업반장"),
        status: readPermitConditionStatus(item.status)
      }];
    }),
    attachments: attachments.flatMap((item): PermitInspectionStructured["attachments"] => {
      if (!isRecord(item)) return [];
      return [{
        name: readString(item.name, "첨부서류"),
        required: typeof item.required === "boolean" ? item.required : true,
        status: readAttachmentStatus(item.status),
        note: readString(item.note, "현장 확인")
      }];
    }),
    completionChecks: completionChecks.flatMap((item): PermitInspectionStructured["completionChecks"] => {
      if (!isRecord(item)) return [];
      return [{
        item: readString(item.item, "종료 확인 항목"),
        method: readString(item.method, "현장 확인"),
        owner: readString(item.owner, "종료 확인자"),
        status: readCompletionStatus(item.status)
      }];
    }),
    approvers: {
      requester: readString(approvers.requester, "신청자"),
      safetyManager: readString(approvers.safetyManager, "안전관리자"),
      siteManager: readString(approvers.siteManager, "현장소장"),
      completionChecker: readString(approvers.completionChecker, "종료 확인자")
    }
  };
}

export async function buildWorkPlanStructuredXlsx(
  scenario: Scenario,
  structured: StructuredRecord
): Promise<Buffer> {
  const data = parseWorkPlanStructured(structured);
  const { wb, ws } = createStructuredWorkbook("작업계획서");
  let row = addStructuredTitle(ws, 1, "작업계획서", scenario);

  row = addSectionHeader(ws, row, "작업개요");
  row = addKeyValueRows(ws, row, [
    ["작업명", data.workOverview.workName],
    ["작업내용", data.workOverview.description],
    ["작업장소", data.workOverview.location],
    ["작업인원", `${data.workOverview.workerCount || scenario.workerCount || 0}명`],
    ["작업조건", data.workOverview.condition],
    ["사용장비", data.workOverview.equipment.join(", ") || "장비 확인"]
  ]);

  row += 1;
  row = addSectionHeader(ws, row, "작업단계 및 안전조치");
  row = addTableHeader(ws, row, ["순번", "작업단계", "사용장비", "안전조치", "담당", "확인"]);
  data.workSteps.forEach((step) => {
    row = setRowValues(ws, row, [
      String(step.stepNo),
      step.action,
      step.equipment,
      step.safetyMeasure,
      step.owner,
      "□ 확인"
    ]);
  });

  row += 1;
  row = addSectionHeader(ws, row, "작업중지 기준");
  row = addTableHeader(ws, row, ["No.", "구분", "작업중지 기준", "조치", "담당", "확인"]);
  data.stopCriteria.forEach((criterion, index) => {
    row = setRowValues(ws, row, [String(index + 1), "중지기준", criterion, "작업중지 후 관리감독자 보고", "작업반장", "□ 확인"]);
  });

  row += 1;
  row = addSectionHeader(ws, row, "비상대응");
  row = addTableHeader(ws, row, ["No.", "역할", "연락처", "대응내용", "담당", "확인"]);
  data.emergencyResponse.contacts.forEach((contact, index) => {
    row = setRowValues(ws, row, [String(index + 1), contact.role, contact.phone, "비상상황 즉시 연락", contact.role, "□ 확인"]);
  });
  row = addKeyValueRows(ws, row, [
    ["대피경로", data.emergencyResponse.evacRoute],
    ["응급조치", data.emergencyResponse.firstAid]
  ]);

  row += 1;
  row = addApprovalRows(ws, row, [data.approvers.author, data.approvers.reviewer, data.approvers.approver]);
  addWorkbookNote(ws, row, "본 작업계획서는 structured JSON을 직접 매핑한 OOXML(.xlsx) 양식입니다. 현장 확인 후 결재 및 서명하세요.");

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

export async function buildPermitInspectionStructuredXlsx(
  scenario: Scenario,
  structured: StructuredRecord
): Promise<Buffer> {
  const data = parsePermitInspectionStructured(structured);
  const { wb, ws } = createStructuredWorkbook("작업허가 확인");
  let row = addStructuredTitle(ws, 1, "안전작업허가 확인서", scenario);

  row = addSectionHeader(ws, row, "허가 기본정보");
  row = addKeyValueRows(ws, row, [
    ["허가번호", data.basicInfo.permitNo],
    ["허가구분", data.basicInfo.permitType],
    ["작업명", data.basicInfo.workName],
    ["작업장소", data.basicInfo.location],
    ["작업일", data.basicInfo.workDate],
    ["작업인원", `${data.basicInfo.workerCount || scenario.workerCount || 0}명`],
    ["신청/허가", `${data.basicInfo.requester} / ${data.basicInfo.approver}`]
  ]);

  row += 1;
  row = addSectionHeader(ws, row, "작업 전 허가조건");
  row = addTableHeader(ws, row, ["No.", "구분", "허가조건", "조치내용", "담당", "상태"]);
  const conditions = data.conditions.length ? data.conditions : [{
    category: "작업구역" as const,
    requirement: "작업 전 허가조건 확인",
    action: "위험성평가와 작업계획서 첨부 후 현장 확인",
    owner: "작업반장",
    status: "확인 전" as const
  }];
  conditions.forEach((condition, index) => {
    row = setRowValues(ws, row, [
      String(index + 1),
      condition.category,
      condition.requirement,
      condition.action,
      condition.owner,
      `□ ${condition.status}`
    ]);
  });

  row += 1;
  row = addSectionHeader(ws, row, "첨부서류");
  row = addTableHeader(ws, row, ["No.", "첨부서류", "필수", "상태", "비고", "확인"]);
  const attachments = data.attachments.length ? data.attachments : [
    { name: "작업계획서", required: true, status: "보완 필요" as const, note: "작업순서·장비·인원 확인" },
    { name: "위험성평가표", required: true, status: "보완 필요" as const, note: "감소대책·잔여위험 확인" },
    { name: "TBM 참석명단", required: true, status: "보완 필요" as const, note: "작업 전 공유 확인" }
  ];
  attachments.forEach((attachment, index) => {
    row = setRowValues(ws, row, [
      String(index + 1),
      attachment.name,
      attachment.required ? "필수" : "조건부",
      `□ ${attachment.status}`,
      attachment.note,
      "□ 확인"
    ]);
  });

  row += 1;
  row = addSectionHeader(ws, row, "작업 종료 확인");
  row = addTableHeader(ws, row, ["No.", "종료 항목", "확인방법", "담당", "상태", "서명"]);
  const completionChecks = data.completionChecks.length ? data.completionChecks : [
    { item: "원상복구", method: "작업구역 정리와 잔류위험 확인", owner: "작업반장", status: "확인 전" as const },
    { item: "미조치사항", method: "미조치 위험요인 기록 및 후속 담당 지정", owner: "관리감독자", status: "확인 전" as const }
  ];
  completionChecks.forEach((check, index) => {
    row = setRowValues(ws, row, [
      String(index + 1),
      check.item,
      check.method,
      check.owner,
      `□ ${check.status}`,
      "서명: ______"
    ]);
  });

  row += 1;
  row = addSectionHeader(ws, row, "결재");
  row = addTableHeader(ws, row, ["구분", "신청자", "안전관리자", "현장소장", "종료 확인자", "확인"]);
  row = setRowValues(ws, row, [
    "성명/서명",
    data.approvers.requester,
    data.approvers.safetyManager,
    data.approvers.siteManager,
    data.approvers.completionChecker,
    "□ 확인"
  ]);
  addWorkbookNote(ws, row, "본 안전작업허가 확인서는 structured JSON을 직접 매핑한 OOXML(.xlsx) 양식입니다. 발주처 지정 허가번호·직인·결재선은 제출 전 원본 양식으로 확인하세요.");

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

export async function buildTbmBriefingStructuredXlsx(
  scenario: Scenario,
  structured: StructuredRecord
): Promise<Buffer> {
  const data = parseTbmBriefingStructured(structured);
  const { wb, ws } = createStructuredWorkbook("TBM 브리핑");
  let row = addStructuredTitle(ws, 1, "TBM 브리핑", scenario);

  row = addSectionHeader(ws, row, "TBM 기본정보");
  row = addKeyValueRows(ws, row, [
    ["일시", data.meta.dateTime],
    ["장소", data.meta.location],
    ["대상", data.meta.target],
    ["참석자 확인", data.meta.attendees],
    ["오늘 작업", data.todayWork.name],
    ["작업 위치", data.todayWork.location],
    ["작업 시간", data.todayWork.time],
    ["사용 장비", data.todayWork.equipment.join(", ") || "장비 확인"]
  ]);

  row += 1;
  row = addSectionHeader(ws, row, "위험요인");
  row = addTableHeader(ws, row, ["No.", "4M", "위험요인", "전달문구", "담당", "확인"]);
  data.hazards.forEach((hazard, index) => {
    row = setRowValues(ws, row, [String(index + 1), hazard.category, hazard.description, "작업 전 전원 공유", "TBM 리더", "□ 확인"]);
  });

  row += 1;
  row = addSectionHeader(ws, row, "안전대책");
  row = addTableHeader(ws, row, ["No.", "연계위험", "조치내용", "실행기준", "담당", "확인"]);
  data.measures.forEach((measure, index) => {
    row = setRowValues(ws, row, [String(index + 1), `위험 ${measure.hazardRef}`, measure.action, "작업 전 확인", measure.owner, "□ 확인"]);
  });

  row += 1;
  row = addSectionHeader(ws, row, "작업중지 기준");
  row = addTableHeader(ws, row, ["No.", "구분", "작업중지 기준", "조치", "담당", "확인"]);
  data.stopCriteria.forEach((criterion, index) => {
    row = setRowValues(ws, row, [String(index + 1), "중지기준", criterion, "중지·격리·보고", "관리감독자", "□ 확인"]);
  });

  row += 1;
  row = addSectionHeader(ws, row, "확인질문");
  row = addTableHeader(ws, row, ["No.", "구분", "확인질문", "응답기준", "담당", "확인"]);
  data.confirmTopics.forEach((topic, index) => {
    row = setRowValues(ws, row, [String(index + 1), "확인질문", topic, "작업자 구두 복창", "TBM 리더", "□ 확인"]);
  });
  row = addKeyValueRows(ws, row, [["사진증빙", data.photoEvidenceLocation]]);

  row += 1;
  row = addApprovalRows(ws, row, ["TBM 리더", "관리감독자", "참석자 대표"]);
  addWorkbookNote(ws, row, "본 TBM 브리핑은 structured JSON을 직접 매핑한 OOXML(.xlsx) 양식입니다. 브리핑 후 참석자 확인과 사진증빙을 보관하세요.");

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

export async function buildEducationRecordStructuredXlsx(
  scenario: Scenario,
  structured: StructuredRecord
): Promise<Buffer> {
  const data = parseEducationRecordStructured(structured);
  const { wb, ws } = createStructuredWorkbook("안전보건교육");
  let row = addStructuredTitle(ws, 1, "안전보건교육 기록", scenario);

  row = addSectionHeader(ws, row, "교육 기본정보");
  row = addKeyValueRows(ws, row, [
    ["교육명", data.educationName],
    ["교육유형", data.type],
    ["일시", data.dateTime],
    ["장소", data.location],
    ["교육대상", data.target],
    ["실시자", data.instructor],
    ["확인자", data.confirmer]
  ]);

  row += 1;
  row = addSectionHeader(ws, row, "교육내용");
  row = addTableHeader(ws, row, ["No.", "교육유형", "주제", "핵심내용", "법령근거", "확인"]);
  data.curriculum.forEach((item, index) => {
    row = setRowValues(ws, row, [
      String(index + 1),
      data.type,
      item.topic,
      item.keyPoints.join("\n") || "핵심내용 확인",
      item.lawCitation,
      "□ 확인"
    ]);
  });

  row += 1;
  row = addSectionHeader(ws, row, "이해확인 및 후속조치");
  row = addKeyValueRows(ws, row, [
    ["이해확인", data.understandingCheck],
    ["TBM 연계", data.tbmLink],
    ["후속 교육", data.followupRecommendation]
  ]);

  row += 1;
  row = addSectionHeader(ws, row, "참석자 확인");
  row = addTableHeader(ws, row, ["No.", "성명", "소속/직책", "이해확인", "서명", "비고"]);
  ["1", "2", "3", "4", "5"].forEach((no) => {
    row = setRowValues(ws, row, [no, "", "", "□ 이해함", "서명: ______", ""]);
  });

  row += 1;
  row = addApprovalRows(ws, row, [data.instructor, data.confirmer, "보관담당"]);
  addWorkbookNote(ws, row, "본 안전보건교육 기록은 structured JSON을 직접 매핑한 OOXML(.xlsx) 양식입니다. 교육 후 참석자 서명과 이해확인을 남기세요.");

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
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
  const lastColumn = isStructuredRiskSheet ? RISK_ASSESSMENT_COLUMNS.length : 6;
  const lastColumnLetter = columnLetter(lastColumn);

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
      "위험성평가표 — 작업장 환경에 맞게 평가척도(가능성·중대성)를 조정한 후 서명·확인란을 작성해 사용하세요.";
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
    "안전 문서 — 서명·확인란을 작성한 후 현장에 비치하거나 제출하세요.";
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
    ws.mergeCells(row, 1, row, isStructuredRiskSheet ? RISK_ASSESSMENT_COLUMNS.length : 6);
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
