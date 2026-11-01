// /api/export/{xlsx,hwp} 요청 본문 읽기. 두 렌더러(lib/document-export-xlsx.ts·document-export-hwp.ts)가 같은
// 파서를 쓴다(서식마다 본문을 다르게 읽지 않게). 본문은 렌더러가 gateExportPayload 를 지난 뒤 넘긴다.
import {
  parseStructuredRiskAssessmentRows,
  type StructuredRiskAssessmentRow
} from "@/lib/risk-assessment-renderer";

export type SheetRow = {
  document: string;
  section: string;
  item: string;
  content: string;
};

export type SafetyFormLayout = "generic" | "risk" | "workPlan" | "permit" | "tbmBriefing" | "tbmLog" | "education" | "photo";

export type SafetyFormProfile = {
  code: string;
  subtitle: string;
  layout: SafetyFormLayout;
  primaryColumn: string;
  actionColumn: string;
  confirmationRows: string[];
  approvalLabels: string[];
};

const SAFETY_FORM_LAYOUTS: readonly SafetyFormLayout[] = ["generic", "risk", "workPlan", "permit", "tbmBriefing", "tbmLog", "education", "photo"];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function sanitizeFileName(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "safeclaw-document";
}

export function parseScenario(value: unknown) {
  const r = isRecord(value) ? value : {};
  return {
    companyName: readString(r.companyName, ""),
    companyType: readString(r.companyType, ""),
    siteName: readString(r.siteName, "현장명 확인"),
    workSummary: readString(r.workSummary, "작업내용 확인"),
    workerCount: readNumber(r.workerCount, 0),
    weatherNote: readString(r.weatherNote, "")
  };
}

export type ExportScenario = ReturnType<typeof parseScenario>;

export function parseRows(value: unknown, fallbackDoc: string): SheetRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): SheetRow[] => {
    if (!isRecord(item)) return [];
    const content = readString(item.content);
    if (!content && readString(item.item) === "") return [];
    return [{
      document: readString(item.document, fallbackDoc),
      section: readString(item.section, "본문"),
      item: readString(item.item, "확인"),
      content
    }];
  });
}

export function parseProfile(value: unknown): SafetyFormProfile {
  const r = isRecord(value) ? value : {};
  const layout = readString(r.layout, "generic");
  return {
    code: readString(r.code, "generic"),
    subtitle: readString(r.subtitle, "SafeClaw 안전 양식"),
    layout: SAFETY_FORM_LAYOUTS.includes(layout as SafetyFormLayout) ? layout as SafetyFormLayout : "generic",
    primaryColumn: readString(r.primaryColumn, "항목"),
    actionColumn: readString(r.actionColumn, "내용"),
    confirmationRows: Array.isArray(r.confirmationRows)
      ? r.confirmationRows.filter((v): v is string => typeof v === "string")
      : [],
    approvalLabels: Array.isArray(r.approvalLabels)
      ? r.approvalLabels.filter((v): v is string => typeof v === "string")
      : []
  };
}

/** 본문에서 정본 위험성평가 행을 찾는다. 편집기·작업팩·응답 통째 본문이 행을 싣는 자리 8곳을 차례로 본다. */
export function parseRiskRowsFromBody(body: Record<string, unknown>): StructuredRiskAssessmentRow[] {
  const structured = isRecord(body.structured) ? body.structured : {};
  const response = isRecord(body.response) ? body.response : {};
  const responseStructured = isRecord(response.structured) ? response.structured : {};
  const candidates = [
    body.structuredRiskRows,
    body.riskAssessmentRows,
    body.structuredRows,
    body.canonicalRows,
    structured.riskAssessmentRows,
    structured.structuredRiskRows,
    responseStructured.riskAssessmentRows,
    responseStructured.structuredRiskRows
  ];
  for (const candidate of candidates) {
    const rows = parseStructuredRiskAssessmentRows(candidate);
    if (rows.length) return rows;
  }
  return [];
}
