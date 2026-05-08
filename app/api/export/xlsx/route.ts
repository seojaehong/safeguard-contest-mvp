import { NextRequest, NextResponse } from "next/server";
import { buildEducationRecordStructuredXlsx, buildTbmBriefingStructuredXlsx, buildWorkPlanStructuredXlsx, buildWorkpackXlsx, buildXlsxForDocument } from "@/lib/xlsx-builder";
import type { EducationRecordStructured, TbmBriefingStructured, WorkPlanStructured } from "@/lib/types";

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

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "/api/export/xlsx",
      methods: ["POST"],
      modes: ["single", "workpack", "workPlanStructured", "tbmBriefingStructured", "educationRecordStructured"],
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
        }
      }
    },
    { headers: { "cache-control": "no-store" } }
  );
}

function parseWorkPlanStructured(value: unknown): WorkPlanStructured | null {
  if (!isRecord(value)) return null;
  const overview = isRecord(value.workOverview) ? value.workOverview : null;
  const steps = Array.isArray(value.workSteps) ? value.workSteps : null;
  const stops = Array.isArray(value.stopCriteria) ? value.stopCriteria : null;
  const emergency = isRecord(value.emergencyResponse) ? value.emergencyResponse : null;
  const approvers = isRecord(value.approvers) ? value.approvers : null;
  if (!overview || !steps || !stops || !emergency || !approvers) return null;
  const contacts = Array.isArray(emergency.contacts) ? emergency.contacts : [];
  return {
    workOverview: {
      workName: readString(overview.workName, ""),
      description: readString(overview.description, ""),
      workerCount: readNumber(overview.workerCount, 0),
      location: readString(overview.location, ""),
      condition: readString(overview.condition, ""),
      equipment: Array.isArray(overview.equipment) ? overview.equipment.filter((e): e is string => typeof e === "string") : []
    },
    workSteps: steps.flatMap((s: unknown) => {
      if (!isRecord(s)) return [];
      return [{
        stepNo: readNumber(s.stepNo, 0),
        action: readString(s.action, ""),
        equipment: readString(s.equipment, ""),
        safetyMeasure: readString(s.safetyMeasure, ""),
        owner: readString(s.owner, "")
      }];
    }),
    stopCriteria: stops.filter((s): s is string => typeof s === "string"),
    emergencyResponse: {
      contacts: contacts.flatMap((c: unknown) => {
        if (!isRecord(c)) return [];
        return [{ role: readString(c.role, ""), phone: readString(c.phone, "") }];
      }),
      evacRoute: readString(emergency.evacRoute, ""),
      firstAid: readString(emergency.firstAid, "")
    },
    approvers: {
      author: readString(approvers.author, ""),
      reviewer: readString(approvers.reviewer, ""),
      approver: readString(approvers.approver, "")
    }
  };
}

function parseTbmBriefingStructured(value: unknown): TbmBriefingStructured | null {
  if (!isRecord(value)) return null;
  const meta = isRecord(value.meta) ? value.meta : null;
  const todayWork = isRecord(value.todayWork) ? value.todayWork : null;
  const hazards = Array.isArray(value.hazards) ? value.hazards : null;
  const measures = Array.isArray(value.measures) ? value.measures : null;
  const stopCriteria = Array.isArray(value.stopCriteria) ? value.stopCriteria : null;
  const confirmTopics = Array.isArray(value.confirmTopics) ? value.confirmTopics : null;
  if (!meta || !todayWork || !hazards || !measures || !stopCriteria || !confirmTopics) return null;
  const allowedCategory = ["Man", "Machine", "Media", "Management"];
  return {
    meta: {
      dateTime: readString(meta.dateTime, ""),
      location: readString(meta.location, ""),
      target: readString(meta.target, ""),
      attendees: readString(meta.attendees, "")
    },
    todayWork: {
      name: readString(todayWork.name, ""),
      location: readString(todayWork.location, ""),
      time: readString(todayWork.time, ""),
      equipment: Array.isArray(todayWork.equipment)
        ? todayWork.equipment.filter((e): e is string => typeof e === "string")
        : []
    },
    hazards: hazards.flatMap((h: unknown) => {
      if (!isRecord(h)) return [];
      const category = readString(h.category, "Man");
      return [{
        category: (allowedCategory.includes(category) ? category : "Man") as "Man" | "Machine" | "Media" | "Management",
        description: readString(h.description, "")
      }];
    }),
    measures: measures.flatMap((m: unknown) => {
      if (!isRecord(m)) return [];
      return [{
        hazardRef: readNumber(m.hazardRef, 0),
        action: readString(m.action, ""),
        owner: readString(m.owner, "")
      }];
    }),
    stopCriteria: stopCriteria.filter((s): s is string => typeof s === "string"),
    confirmTopics: confirmTopics.filter((s): s is string => typeof s === "string"),
    photoEvidenceLocation: readString(value.photoEvidenceLocation, "")
  };
}

function parseEducationRecordStructured(value: unknown): EducationRecordStructured | null {
  if (!isRecord(value)) return null;
  const curriculum = Array.isArray(value.curriculum) ? value.curriculum : null;
  if (!curriculum) return null;
  const allowedType = ["정기교육", "특별교육", "외국인교육", "신규자교육", "관리감독자교육", "기타"];
  const type = readString(value.type, "정기교육");
  return {
    educationName: readString(value.educationName, ""),
    type: (allowedType.includes(type) ? type : "정기교육") as EducationRecordStructured["type"],
    dateTime: readString(value.dateTime, ""),
    location: readString(value.location, ""),
    target: readString(value.target, ""),
    instructor: readString(value.instructor, ""),
    confirmer: readString(value.confirmer, ""),
    curriculum: curriculum.flatMap((c: unknown) => {
      if (!isRecord(c)) return [];
      return [{
        topic: readString(c.topic, ""),
        lawCitation: readString(c.lawCitation, ""),
        keyPoints: Array.isArray(c.keyPoints)
          ? c.keyPoints.filter((p): p is string => typeof p === "string")
          : []
      }];
    }),
    understandingCheck: readString(value.understandingCheck, ""),
    tbmLink: readString(value.tbmLink, ""),
    followupRecommendation: readString(value.followupRecommendation, "")
  };
}

export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

  try {
    // schema-first 작업계획서: AI가 셀 단위 객체로 반환한 workPlanStructured를 받아
    // parseSheetRows 우회하고 표 양식에 직접 매핑.
    if (mode === "workPlanStructured") {
      const structured = parseWorkPlanStructured(body.structured);
      if (!structured) {
        return NextResponse.json(
          { ok: false, error: "workPlanStructured payload invalid (workOverview/workSteps/stopCriteria/emergencyResponse/approvers required)" },
          { status: 400 }
        );
      }
      const buffer = await buildWorkPlanStructuredXlsx(scenario, structured);
      const fileName = `${sanitizeFileName(`${scenario.companyName}-작업계획서`)}.xlsx`;
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": `attachment; filename="safeclaw-workplan.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          "cache-control": "no-store"
        }
      });
    }

    // schema-first TBM 브리핑.
    if (mode === "tbmBriefingStructured") {
      const structured = parseTbmBriefingStructured(body.structured);
      if (!structured) {
        return NextResponse.json(
          { ok: false, error: "tbmBriefingStructured payload invalid (meta/todayWork/hazards/measures/stopCriteria/confirmTopics required)" },
          { status: 400 }
        );
      }
      const buffer = await buildTbmBriefingStructuredXlsx(scenario, structured);
      const fileName = `${sanitizeFileName(`${scenario.companyName}-TBM브리핑`)}.xlsx`;
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": `attachment; filename="safeclaw-tbm-briefing.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          "cache-control": "no-store"
        }
      });
    }

    // schema-first 안전보건교육 기록.
    if (mode === "educationRecordStructured") {
      const structured = parseEducationRecordStructured(body.structured);
      if (!structured) {
        return NextResponse.json(
          { ok: false, error: "educationRecordStructured payload invalid (educationName/curriculum required)" },
          { status: 400 }
        );
      }
      const buffer = await buildEducationRecordStructuredXlsx(scenario, structured);
      const fileName = `${sanitizeFileName(`${scenario.companyName}-안전보건교육`)}.xlsx`;
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": `attachment; filename="safeclaw-education-record.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          "cache-control": "no-store"
        }
      });
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
            profile: parseProfile(d.profile)
          };
        })
        .filter((d): d is { title: string; rows: SheetRow[]; profile: ReturnType<typeof parseProfile> } => Boolean(d));
      const buffer = await buildWorkpackXlsx(scenario, documents);
      const fileName = `${sanitizeFileName(`${scenario.companyName}-safeclaw-workpack`)}.xlsx`;
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": `attachment; filename="safeclaw-workpack.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          "cache-control": "no-store"
        }
      });
    }

    const title = readString(body.title, "SafeClaw 안전 문서");
    const rows = parseRows(body.rows, title);
    const profile = parseProfile(body.profile);
    const buffer = await buildXlsxForDocument({ title, rows, profile, scenario });
    const fileName = `${sanitizeFileName(`${scenario.companyName}-${title}`)}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="safeclaw-document.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "xlsx build failed" },
      { status: 500 }
    );
  }
}
