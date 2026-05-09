import { NextRequest, NextResponse } from "next/server";
import {
  buildEducationRecordStructuredXlsx,
  buildPermitInspectionStructuredXlsx,
  buildTbmBriefingStructuredXlsx,
  buildWorkpackXlsx,
  buildWorkPlanStructuredXlsx,
  buildXlsxForDocument
} from "@/lib/xlsx-builder";
import { parseStructuredRiskAssessmentRows } from "@/lib/risk-assessment-renderer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SheetRow = {
  document: string;
  section: string;
  item: string;
  content: string;
};

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

function xlsxResponse(buffer: Buffer, fileNameBase: string, fallbackName: string) {
  const fileName = `${sanitizeFileName(fileNameBase)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${fallbackName}.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "cache-control": "no-store"
    }
  });
}

function parseScenario(value: unknown) {
  const r = isRecord(value) ? value : {};
  return {
    companyName: readString(r.companyName, "SafeClaw 현장"),
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

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "/api/export/xlsx",
      methods: ["POST"],
      modes: ["single", "workpack", "workPlanStructured", "permitInspectionStructured", "tbmBriefingStructured", "educationRecordStructured"],
      message: "POST a single document spec or a workpack array. Returns OOXML .xlsx binary.",
      schema: {
        single: {
          mode: "single",
          title: "string",
          rows: "SheetRow[]",
          profile: "SafetyFormProfile",
          scenario: "AskScenario"
        },
        workpack: {
          mode: "workpack",
          scenario: "AskScenario",
          documents: "[{ title, rows, profile }]"
        },
        structured: {
          mode: "workPlanStructured | permitInspectionStructured | tbmBriefingStructured | educationRecordStructured",
          scenario: "AskScenario",
          structured: "Record<string, unknown>"
        }
      }
    },
    { headers: { "cache-control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

  try {
    if (mode === "workPlanStructured" || mode === "permitInspectionStructured" || mode === "tbmBriefingStructured" || mode === "educationRecordStructured") {
      if (!isRecord(body.structured)) {
        return NextResponse.json(
          { ok: false, error: "structured must be a non-array object for structured xlsx export" },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }

      if (mode === "workPlanStructured") {
        const buffer = await buildWorkPlanStructuredXlsx(scenario, body.structured);
        return xlsxResponse(buffer, `${scenario.companyName}-작업계획서`, "safeclaw-work-plan");
      }

      if (mode === "permitInspectionStructured") {
        const buffer = await buildPermitInspectionStructuredXlsx(scenario, body.structured);
        return xlsxResponse(buffer, `${scenario.companyName}-안전작업허가-확인서`, "safeclaw-work-permit");
      }

      if (mode === "tbmBriefingStructured") {
        const buffer = await buildTbmBriefingStructuredXlsx(scenario, body.structured);
        return xlsxResponse(buffer, `${scenario.companyName}-TBM-브리핑`, "safeclaw-tbm-briefing");
      }

      const buffer = await buildEducationRecordStructuredXlsx(scenario, body.structured);
      return xlsxResponse(buffer, `${scenario.companyName}-안전보건교육-기록`, "safeclaw-education-record");
    }

    if (mode === "workpack") {
      const docs = Array.isArray(body.documents) ? body.documents : [];
      const documents = docs
        .map((d) => {
          if (!isRecord(d)) return null;
          const title = readString(d.title);
          if (!title) return null;
          return {
            title,
            rows: parseRows(d.rows, title),
            profile: parseProfile(d.profile),
            structuredRiskRows: parseRiskRowsFromBody(d)
          };
        })
        .filter((d): d is {
          title: string;
          rows: SheetRow[];
          profile: ReturnType<typeof parseProfile>;
          structuredRiskRows: ReturnType<typeof parseRiskRowsFromBody>;
        } => Boolean(d));
      const buffer = await buildWorkpackXlsx(scenario, documents);
      return xlsxResponse(buffer, `${scenario.companyName}-safeclaw-workpack`, "safeclaw-workpack");
    }

    const title = readString(body.title, "SafeClaw 안전 문서");
    const rows = parseRows(body.rows, title);
    const profile = parseProfile(body.profile);
    const structuredRiskRows = parseRiskRowsFromBody(body);
    const buffer = await buildXlsxForDocument({ title, rows, profile, scenario, structuredRiskRows });
    return xlsxResponse(buffer, `${scenario.companyName}-${title}`, "safeclaw-document");
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "xlsx build failed" },
      { status: 500 }
    );
  }
}
