// /api/export/xlsx 의 본문 → xlsx 버퍼 변환. 웹 라우트(app/api/export/xlsx/route.ts)와
// MCP generate_risk_assessment 가 같은 함수를 쓴다(채널마다 서식 코드를 복제하지 않는다).
// 받은 본문은 여기서 PR-14 출력 게이트(gateExportPayload)와 입력·출력 예산을 지난다.
import { gateExportPayload } from "@/lib/user-output-gate";
import {
  buildEducationRecordStructuredXlsx,
  buildPermitInspectionStructuredXlsx,
  buildTbmBriefingStructuredXlsx,
  buildTbmLogStructuredXlsx,
  buildWorkpackXlsx,
  buildWorkPlanStructuredXlsx,
  buildXlsxForDocument
} from "@/lib/xlsx-builder";
import {
  assertDocumentExportInputBudget,
  assertDocumentExportOutputBudget
} from "@/lib/document-export-budget";
import { parseStructuredRiskAssessmentRows } from "@/lib/risk-assessment-renderer";
import { resolveRiskExportRows } from "@/lib/risk-assessment-record";
import { companyFilePrefix } from "@/lib/scenario-display";

type SheetRow = {
  document: string;
  section: string;
  item: string;
  content: string;
};

export type XlsxDocumentExportRender =
  | { ok: true; buffer: Buffer; fileName: string; fallbackName: string }
  | { ok: false; status: 400; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "safeclaw-document";
}

function rendered(buffer: Buffer, fileNameBase: string, fallbackName: string): XlsxDocumentExportRender {
  assertDocumentExportOutputBudget(buffer);
  return { ok: true, buffer, fileName: `${sanitizeFileName(fileNameBase)}.xlsx`, fallbackName };
}

function parseScenario(value: unknown) {
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

function parseRows(value: unknown, fallbackDoc: string): SheetRow[] {
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

function parseProfile(value: unknown) {
  const r = isRecord(value) ? value : {};
  const layout = readString(r.layout, "generic");
  const allowed = ["generic", "risk", "workPlan", "permit", "tbmBriefing", "tbmLog", "education", "photo"];
  return {
    code: readString(r.code, "generic"),
    subtitle: readString(r.subtitle, "SafeClaw 안전 양식"),
    layout: (allowed.includes(layout) ? layout : "generic") as
      | "generic" | "risk" | "workPlan" | "permit" | "tbmBriefing" | "tbmLog" | "education" | "photo",
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

function parseRiskRowsFromBody(body: Record<string, unknown>) {
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

function structuredFallbackTitle(mode: string) {
  if (mode === "workPlanStructured") return "작업계획서";
  if (mode === "permitInspectionStructured") return "안전작업허가 확인서";
  if (mode === "tbmBriefingStructured") return "TBM 브리핑";
  if (mode === "tbmLogStructured") return "TBM 일지";
  if (mode === "educationRecordStructured") return "안전보건교육 기록";
  return "SafeClaw 안전 문서";
}

/**
 * 내보내기 요청 본문(게이트 전 JSON)을 xlsx 로 만든다. 예산 초과는 DocumentExportLimitError 를 던진다.
 * structured 모드에 structured 객체가 없으면 400 결과를 돌려준다.
 */
export async function renderXlsxDocumentExport(payload: unknown): Promise<XlsxDocumentExportRender> {
  // PR-14: 받은 본문의 내부 문구·통째 enum 칸을 사용자용으로 거른 뒤 렌더한다.
  const parsed = gateExportPayload(payload);
  const body = isRecord(parsed) ? parsed : {};
  assertDocumentExportInputBudget(body);
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

  if (mode === "workPlanStructured" || mode === "permitInspectionStructured" || mode === "tbmBriefingStructured" || mode === "tbmLogStructured" || mode === "educationRecordStructured") {
    if (!isRecord(body.structured)) {
      return { ok: false, status: 400, error: "structured must be a non-array object for structured xlsx export" };
    }
    const editedRows = body.edited === true
      ? parseRows(body.rows, structuredFallbackTitle(mode))
      : undefined;

    if (mode === "workPlanStructured") {
      const buffer = await buildWorkPlanStructuredXlsx(scenario, body.structured, { editedRows });
      return rendered(buffer, companyFilePrefix(scenario.companyName, "작업계획서"), "safeclaw-work-plan");
    }

    if (mode === "permitInspectionStructured") {
      const buffer = await buildPermitInspectionStructuredXlsx(scenario, body.structured, { editedRows });
      return rendered(buffer, companyFilePrefix(scenario.companyName, "안전작업허가-확인서"), "safeclaw-work-permit");
    }

    if (mode === "tbmBriefingStructured") {
      const buffer = await buildTbmBriefingStructuredXlsx(scenario, body.structured, { editedRows });
      return rendered(buffer, companyFilePrefix(scenario.companyName, "TBM-브리핑"), "safeclaw-tbm-briefing");
    }

    if (mode === "tbmLogStructured") {
      const buffer = await buildTbmLogStructuredXlsx(scenario, body.structured, { editedRows });
      return rendered(buffer, companyFilePrefix(scenario.companyName, "TBM-일지"), "safeclaw-tbm-log");
    }

    const buffer = await buildEducationRecordStructuredXlsx(scenario, body.structured, { editedRows });
    return rendered(buffer, companyFilePrefix(scenario.companyName, "안전보건교육-기록"), "safeclaw-education-record");
  }

  if (mode === "workpack") {
    const docs = Array.isArray(body.documents) ? body.documents : [];
    const documents = docs
      .map((d) => {
        if (!isRecord(d)) return null;
        const title = readString(d.title);
        if (!title) return null;
        const riskExport = resolveRiskExportRows(d.edited === true ? [] : parseRiskRowsFromBody(d), d);
        return {
          title,
          rows: parseRows(d.rows, title),
          profile: parseProfile(d.profile),
          structuredRiskRows: riskExport.main,
          riskReviewItems: riskExport.review
        };
      })
      .filter((d): d is {
        title: string;
        rows: SheetRow[];
        profile: ReturnType<typeof parseProfile>;
        structuredRiskRows: ReturnType<typeof parseRiskRowsFromBody>;
        riskReviewItems: ReturnType<typeof parseRiskRowsFromBody>;
      } => Boolean(d));
    const buffer = await buildWorkpackXlsx(scenario, documents);
    return rendered(buffer, companyFilePrefix(scenario.companyName, "safeclaw-workpack"), "safeclaw-workpack");
  }

  const title = readString(body.title, "SafeClaw 안전 문서");
  const rows = parseRows(body.rows, title);
  const profile = parseProfile(body.profile);
  const riskExport = resolveRiskExportRows(body.edited === true ? [] : parseRiskRowsFromBody(body), body);
  const buffer = await buildXlsxForDocument({
    title,
    rows,
    profile,
    scenario,
    structuredRiskRows: riskExport.main,
    riskReviewItems: riskExport.review
  });
  return rendered(buffer, companyFilePrefix(scenario.companyName, title), "safeclaw-document");
}
