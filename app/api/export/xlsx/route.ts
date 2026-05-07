import { NextRequest, NextResponse } from "next/server";
import { buildXlsxForDocument, buildWorkpackXlsx } from "@/lib/xlsx-builder";

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
      modes: ["single", "workpack"],
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

export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

  try {
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
