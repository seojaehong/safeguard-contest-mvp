import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
// Use the WASM init for server runtime. exportHwp() supports tables; exportHwpx() does NOT.
import { initSync, HwpDocument } from "@rhwp/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

let wasmInitialized = false;

function ensureWasm() {
  if (wasmInitialized) return;
  (globalThis as unknown as { measureTextWidth?: (font: string, text: string) => number }).measureTextWidth = (_font, text) =>
    text.length * 12;
  // Vercel serverless does NOT bundle node_modules/@rhwp/core/rhwp_bg.wasm into
  // the function tracing graph (4MB binary, dynamic fs.readFileSync). The same
  // WASM is already published under public/rhwp_bg.wasm for the browser path.
  // public/ files DO get traced into the function bundle.
  const candidates = [
    path.join(process.cwd(), "public", "rhwp_bg.wasm"),
    path.join(process.cwd(), "node_modules", "@rhwp", "core", "rhwp_bg.wasm")
  ];
  let wasmBytes: Buffer | null = null;
  for (const candidate of candidates) {
    try {
      wasmBytes = fs.readFileSync(candidate);
      break;
    } catch {
      /* keep trying */
    }
  }
  if (!wasmBytes) {
    throw new Error(`rhwp WASM not found in any of: ${candidates.join(", ")}`);
  }
  initSync({ module: wasmBytes });
  wasmInitialized = true;
}

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

function parseProfile(value: unknown): SafetyFormProfile {
  const r = isRecord(value) ? value : {};
  const layout = readString(r.layout, "generic");
  const allowed = ["generic", "risk", "workPlan", "permit", "tbmBriefing", "tbmLog", "education", "photo"];
  return {
    code: readString(r.code, "generic"),
    subtitle: readString(r.subtitle, "SafeClaw 안전 양식"),
    layout: (allowed.includes(layout) ? layout : "generic") as SafetyFormProfile["layout"],
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

function deriveColumns(profile: SafetyFormProfile): string[] {
  switch (profile.layout) {
    case "risk":
      return ["구분", profile.primaryColumn || "유해·위험요인", profile.actionColumn || "감소대책", "확인"];
    case "workPlan":
      return ["순번", profile.primaryColumn || "작업개요", profile.actionColumn || "장비·인원", "확인"];
    case "permit":
      return ["순번", profile.primaryColumn || "허가항목", profile.actionColumn || "조건/조치", "확인"];
    case "tbmLog":
    case "tbmBriefing":
      return ["No.", profile.primaryColumn || "항목", profile.actionColumn || "전달 문구", "확인"];
    case "education":
      return ["No.", profile.primaryColumn || "교육항목", profile.actionColumn || "내용", "확인"];
    default:
      return ["No.", "항목", "내용", "확인"];
  }
}

function parseJsonResult(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function buildHwpBuffer(args: {
  title: string;
  rows: SheetRow[];
  profile: SafetyFormProfile;
  scenario: ReturnType<typeof parseScenario>;
}): Buffer {
  ensureWasm();
  const { title, rows, profile, scenario } = args;
  const document = HwpDocument.createEmpty();
  try {
    document.createBlankDocument();

    document.insertText(0, 0, 0, `${title}(공식자료 기반 표 양식)\nSafeClaw · 현장 검토 후 사용\n\n`);

    // Metadata table (4 col x 2 row)
    {
      const cols = 4;
      const rowCount = 2;
      const tbl = parseJsonResult(document.createTable(0, 0, 0, rowCount, cols));
      if (tbl?.ok && typeof tbl.paraIdx === "number") {
        const paraIdx = tbl.paraIdx;
        const controlIdx = typeof tbl.controlIdx === "number" ? tbl.controlIdx : 0;
        const meta: string[][] = [
          ["사업장", scenario.companyName, "현장/공정", scenario.siteName],
          ["작업내용", scenario.workSummary, "인원/조건", `${scenario.workerCount}명 · ${scenario.weatherNote}`]
        ];
        meta.forEach((row, rIdx) => {
          row.forEach((value, cIdx) => {
            const cellIdx = rIdx * cols + cIdx;
            document.insertTextInCell(0, paraIdx, controlIdx, cellIdx, 0, 0, String(value));
          });
        });
      }
    }

    document.insertText(0, 0, 0, "\n");

    // Body table
    const cols = deriveColumns(profile);
    const colCount = cols.length;
    const bodyRows: string[][] = rows.map((r, idx) => [
      r.section || String(idx + 1),
      r.item || "",
      r.content || "",
      "□"
    ]);
    const allRows = [cols, ...bodyRows];
    if (allRows.length >= 1 && colCount >= 1) {
      const tbl = parseJsonResult(document.createTable(0, 0, 0, allRows.length, colCount));
      if (tbl?.ok && typeof tbl.paraIdx === "number") {
        const paraIdx = tbl.paraIdx;
        const controlIdx = typeof tbl.controlIdx === "number" ? tbl.controlIdx : 0;
        allRows.forEach((row, rIdx) => {
          for (let cIdx = 0; cIdx < colCount; cIdx += 1) {
            const value = row[cIdx] ?? "";
            const cellIdx = rIdx * colCount + cIdx;
            document.insertTextInCell(0, paraIdx, controlIdx, cellIdx, 0, 0, String(value));
          }
        });
      }
    }

    document.insertText(
      0,
      0,
      0,
      "\n\n[확인/서명]\n작성자: ____________________\n관리감독자: ____________________\n교육/TBM 확인자: ____________________\n확인일시: ______년 ____월 ____일 ____시 ____분"
    );

    return Buffer.from(document.exportHwp());
  } finally {
    document.free();
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "/api/export/hwp",
      methods: ["POST"],
      message: "POST a single document spec. Returns binary .hwp with table grid (한컴 native).",
      schema: {
        title: "string",
        rows: "SheetRow[]",
        profile: "SafetyFormProfile",
        scenario: "AskScenario"
      }
    },
    { headers: { "cache-control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const title = readString(body.title, "SafeClaw 안전 문서");
  const rows = parseRows(body.rows, title);
  const profile = parseProfile(body.profile);
  const scenario = parseScenario(body.scenario);

  try {
    const buffer = buildHwpBuffer({ title, rows, profile, scenario });
    const fileName = `${sanitizeFileName(`${scenario.companyName}-${title}`)}.hwp`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/x-hwp",
        "content-disposition": `attachment; filename="safeclaw-document.hwp"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "hwp build failed" },
      { status: 500 }
    );
  }
}
