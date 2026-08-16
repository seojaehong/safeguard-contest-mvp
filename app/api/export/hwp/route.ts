import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
// Use the WASM init for server runtime. exportHwp() supports tables; exportHwpx() does NOT.
import { initSync, HwpDocument } from "@rhwp/core";
import {
  parseStructuredRiskAssessmentRows,
  resolveRiskAssessmentRows,
  type StructuredRiskAssessmentRow
} from "@/lib/risk-assessment-renderer";
import {
  assertDocumentExportInputBudget,
  assertDocumentExportOutputBudget,
  createDocumentExportInternalErrorPayload,
  DocumentExportLimitError,
  DocumentExportRequestError,
  readDocumentExportRequestJson
} from "@/lib/document-export-budget";
import { withPublicDocumentExportAdmission } from "@/lib/public-distributed-rate-limit";

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

function localizeRiskLevel(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "high") return "상";
  if (normalized === "medium") return "중";
  if (normalized === "low") return "하";
  return value?.trim() || "확인";
}

function localizeVerificationStatus(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "planned") return "조치 예정";
  if (normalized === "done") return "조치 완료";
  if (normalized === "needsreview") return "검토 필요";
  return value?.trim() || "확인";
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

function parseRiskRowsFromBody(body: Record<string, unknown>): StructuredRiskAssessmentRow[] {
  const candidates = [
    body.structuredRiskRows,
    body.riskAssessmentRows,
    body.structuredRows,
    body.canonicalRows
  ];
  for (const candidate of candidates) {
    const rows = parseStructuredRiskAssessmentRows(candidate);
    if (rows.length) return rows;
  }
  return [];
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
      return ["연번", profile.primaryColumn || "항목", profile.actionColumn || "전달 문구", "확인"];
    case "education":
      return ["연번", profile.primaryColumn || "교육항목", profile.actionColumn || "내용", "확인"];
    default:
      return ["연번", "항목", "내용", "확인"];
  }
}

function parseJsonResult(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function insertHwpTable(document: HwpDocument, paraIdx: number, rows: readonly (readonly string[])[], label: string): number {
  const colCount = rows[0]?.length ?? 0;
  if (!rows.length || !colCount || rows.some((row) => row.length !== colCount)) {
    throw new Error(`${label} 표 데이터가 올바르지 않습니다.`);
  }
  const table = parseJsonResult(document.createTable(0, paraIdx, 0, rows.length, colCount));
  if (!table?.ok || typeof table.paraIdx !== "number") {
    throw new Error(`${label} 표를 만들지 못했습니다.`);
  }
  const controlIdx = typeof table.controlIdx === "number" ? table.controlIdx : 0;
  rows.forEach((row, rIdx) => {
    row.forEach((value, cIdx) => {
      document.insertTextInCell(0, table.paraIdx as number, controlIdx, rIdx * colCount + cIdx, 0, 0, value);
    });
  });
  return document.getParagraphCount(0) - 1;
}

function buildHwpBuffer(args: {
  title: string;
  rows: SheetRow[];
  profile: SafetyFormProfile;
  scenario: ReturnType<typeof parseScenario>;
  structuredRiskRows?: StructuredRiskAssessmentRow[];
}): Buffer {
  ensureWasm();
  const { title, rows, profile, scenario, structuredRiskRows } = args;
  const document = HwpDocument.createEmpty();
  try {
    document.createBlankDocument();

    document.insertText(0, 0, 0, `${title}(공식자료 기반 표 양식)\nSafeClaw · 현장 검토 후 사용`);
    const titleLength = document.getParagraphLength(0, 0);
    document.splitParagraph(0, 0, titleLength);
    let nextParaIdx = document.getParagraphCount(0) - 1;

    // Metadata table (4 col x 2 row)
    {
      const meta: string[][] = [
        ["사업장", scenario.companyName, "현장/공정", scenario.siteName],
        ["작업내용", scenario.workSummary, "인원/조건", `${scenario.workerCount}명 · ${scenario.weatherNote}`]
      ];
      nextParaIdx = insertHwpTable(document, nextParaIdx, meta, "기본정보");
    }

    // Body table
    const riskRows = profile.layout === "risk" && structuredRiskRows?.length
      ? resolveRiskAssessmentRows({ structuredRows: structuredRiskRows, fallbackRows: rows })
      : [];
    const cols = riskRows.length
      ? ["세부작업", "유해·위험요인", "현재조치", "위험성", "감소대책", "담당/기한", "상태"]
      : deriveColumns(profile);
    const colCount = cols.length;
    const bodyRows: string[][] = riskRows.length
      ? riskRows.map((riskRow) => [
        riskRow.unitTask,
        riskRow.hazard,
        riskRow.currentControls || "현장 확인",
        localizeRiskLevel(riskRow.riskLevel),
        riskRow.additionalControls,
        `${riskRow.owner || "작업반장"} / ${riskRow.dueDate || "작업 전"}`,
        localizeVerificationStatus(riskRow.verificationStatus || riskRow.status)
      ])
      : rows.map((r, idx) => [
        profile.layout === "risk" ? (r.section || String(idx + 1)) : String(idx + 1),
        r.item || "",
        r.content || "",
        "□"
      ]);
    const allRows = [cols, ...bodyRows];
    nextParaIdx = insertHwpTable(document, nextParaIdx, allRows, "본문");

    document.insertText(0, nextParaIdx, 0, "확인 및 서명");
    const approvalLabelLength = document.getParagraphLength(0, nextParaIdx);
    document.splitParagraph(0, nextParaIdx, approvalLabelLength);
    nextParaIdx = document.getParagraphCount(0) - 1;
    const approvalRows = [
      ["작성자", "관리감독자", "교육/TBM 확인자", "확인일시"],
      ["성명/서명: ____________________", "성명/서명: ____________________", "성명/서명: ____________________", "____년 ____월 ____일 ____시 ____분"]
    ];
    insertHwpTable(document, nextParaIdx, approvalRows, "확인·서명");

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
      message: "POST 요청의 단일 문서 내용을 편집 가능한 한컴 HWP 표 양식으로 반환합니다.",
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

async function exportHwp(request: NextRequest) {
  try {
    const parsed = await readDocumentExportRequestJson(request);
    const body = isRecord(parsed) ? parsed : {};
    assertDocumentExportInputBudget(body);
    const title = readString(body.title, "SafeClaw 안전 문서");
    const rows = parseRows(body.rows, title);
    const profile = parseProfile(body.profile);
    const scenario = parseScenario(body.scenario);
    const structuredRiskRows = body.edited === true ? [] : parseRiskRowsFromBody(body);
    const buffer = buildHwpBuffer({ title, rows, profile, scenario, structuredRiskRows });
    assertDocumentExportOutputBudget(buffer);
    const fileName = `${sanitizeFileName(`${scenario.companyName}-${title}`)}.hwp`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/x-hwp",
        "content-disposition": `attachment; filename="safeclaw-document.hwp"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof DocumentExportRequestError) return error.response;
    if (error instanceof DocumentExportLimitError) {
      return NextResponse.json(
        {
          ok: false,
          code: "DOCUMENT_EXPORT_LIMIT_EXCEEDED",
          message: "문서 내보내기 요청이 허용된 크기 한도를 초과했습니다."
        },
        { status: 413, headers: { "cache-control": "no-store" } }
      );
    }
    return NextResponse.json(
      createDocumentExportInternalErrorPayload("HWP", error),
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  return withPublicDocumentExportAdmission(request, () => exportHwp(request));
}
