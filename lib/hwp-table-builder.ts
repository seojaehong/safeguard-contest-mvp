// HWP (.hwp binary) builder with real tables via @rhwp/core.
// Note: @rhwp/core's exportHwpx() does NOT serialize tables; only exportHwp() does.
// So this module produces the .hwp binary which 한컴 opens natively with table grids.

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

type RhwpModule = typeof import("@rhwp/core");

let rhwpModulePromise: Promise<RhwpModule> | null = null;

async function loadRhwp(): Promise<RhwpModule> {
  if (!rhwpModulePromise) {
    rhwpModulePromise = (async () => {
      let canvasContext: CanvasRenderingContext2D | null = null;
      let lastFont = "";
      globalThis.measureTextWidth = (font: string, text: string) => {
        if (typeof document === "undefined") return text.length * 12;
        if (!canvasContext) {
          canvasContext = document.createElement("canvas").getContext("2d");
        }
        if (!canvasContext) return text.length * 12;
        if (font !== lastFont) {
          canvasContext.font = font;
          lastFont = font;
        }
        return canvasContext.measureText(text).width;
      };

      const rhwp = await import("@rhwp/core");
      await rhwp.default({ module_or_path: "/rhwp_bg.wasm" });
      return rhwp;
    })();
  }
  return rhwpModulePromise;
}

function parseJsonResult(raw: string): { ok?: boolean; paraIdx?: number; controlIdx?: number; [k: string]: unknown } {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function deriveColumnsForLayout(profile: SafetyFormProfile, _rows: SheetRow[]): string[] {
  switch (profile.layout) {
    case "risk":
      return ["구분", profile.primaryColumn || "항목", profile.actionColumn || "내용", "확인"];
    case "workPlan":
      return ["순번", profile.primaryColumn || "항목", profile.actionColumn || "내용", "확인"];
    case "permit":
      return ["순번", profile.primaryColumn || "허가항목", profile.actionColumn || "조건/조치", "확인"];
    case "tbmLog":
      return ["No.", profile.primaryColumn || "항목", profile.actionColumn || "내용", "확인"];
    case "tbmBriefing":
      return ["No.", profile.primaryColumn || "항목", profile.actionColumn || "전달 문구", "확인"];
    case "education":
      return ["No.", profile.primaryColumn || "교육항목", profile.actionColumn || "내용", "확인"];
    default:
      return ["No.", "항목", "내용", "확인"];
  }
}

export type HwpBuildInput = {
  title: string;
  rows: SheetRow[];
  profile: SafetyFormProfile;
  scenario: AskResponse["scenario"];
  structuredRiskRows?: StructuredRiskAssessmentRow[];
};

/**
 * Build a .hwp binary with real table grids.
 * Layout per document:
 *   - Title text
 *   - Metadata table (사업장 / 현장 / 작업 / 인원/조건) — 4 col x 2 row
 *   - Main body table (sections grouped) — N col x M row
 *   - Footer text (signature lines)
 * Returns a Blob suitable for download as `${name}.hwp` (한컴 opens natively with table grid).
 */
export async function buildHwpWithTables(input: HwpBuildInput): Promise<Blob> {
  const { title, rows, profile, scenario, structuredRiskRows } = input;
  const { HwpDocument } = await loadRhwp();
  const document = HwpDocument.createEmpty();
  try {
    document.createBlankDocument();

    // 1) Title text
    document.insertText(0, 0, 0, `${title}(공식자료 기반 표 양식)\nSafeClaw · 현장 검토 후 사용\n\n`);

    // 2) Metadata table (4 col x 2 row)
    {
      const cols = 4;
      const rowCount = 2;
      const tableJson = parseJsonResult(document.createTable(0, 0, 0, rowCount, cols));
      if (tableJson.ok && typeof tableJson.paraIdx === "number") {
        const paraIdx = tableJson.paraIdx;
        const controlIdx = typeof tableJson.controlIdx === "number" ? tableJson.controlIdx : 0;
        const meta: string[][] = [
          ["사업장", scenario.companyName || "", "현장/공정", scenario.siteName || ""],
          [
            "작업내용",
            scenario.workSummary || "",
            "인원/조건",
            `${scenario.workerCount ?? 0}명 · ${scenario.weatherNote || ""}`
          ]
        ];
        meta.forEach((row, rIdx) => {
          row.forEach((value, cIdx) => {
            const cellIdx = rIdx * cols + cIdx;
            document.insertTextInCell(0, paraIdx, controlIdx, cellIdx, 0, 0, String(value));
          });
        });
      }
    }

    // Spacer
    document.insertText(0, 0, 0, "\n");

    // 3) Main body table — derive columns per layout
    const riskRows = profile.layout === "risk" && structuredRiskRows?.length
      ? resolveRiskAssessmentRows({ structuredRows: structuredRiskRows, fallbackRows: rows })
      : [];
    const cols = riskRows.length
      ? ["세부작업", "유해·위험요인", "현재조치", "위험성", "감소대책", "담당/기한"]
      : deriveColumnsForLayout(profile, rows);
    const colCount = cols.length;
    const bodyRows: string[][] = riskRows.length
      ? riskRows.map((riskRow) => [
        riskRow.unitTask,
        riskRow.hazard,
        riskRow.currentControls || "현장 확인",
        riskRow.riskLevel || "확인",
        riskRow.additionalControls,
        `${riskRow.owner || "작업반장"} / ${riskRow.dueDate || "작업 전"}`
      ])
      : rows.map((r, idx) => [
        r.section || String(idx + 1),
        r.item || "",
        r.content || "",
        "□"
      ]);
    const allRows: string[][] = [cols, ...bodyRows];
    if (allRows.length >= 1 && colCount >= 1) {
      const tableJson = parseJsonResult(document.createTable(0, 0, 0, allRows.length, colCount));
      if (tableJson.ok && typeof tableJson.paraIdx === "number") {
        const paraIdx = tableJson.paraIdx;
        const controlIdx = typeof tableJson.controlIdx === "number" ? tableJson.controlIdx : 0;
        allRows.forEach((row, rIdx) => {
          for (let cIdx = 0; cIdx < colCount; cIdx += 1) {
            const value = row[cIdx] ?? "";
            const cellIdx = rIdx * colCount + cIdx;
            document.insertTextInCell(0, paraIdx, controlIdx, cellIdx, 0, 0, String(value));
          }
        });
      }
    }

    // 4) Footer signature
    document.insertText(
      0,
      0,
      0,
      "\n\n[확인/서명]\n작성자: ____________________\n관리감독자: ____________________\n교육/TBM 확인자: ____________________\n확인일시: ______년 ____월 ____일 ____시 ____분"
    );

    const exported = document.exportHwp();
    const buffer = new ArrayBuffer(exported.byteLength);
    new Uint8Array(buffer).set(exported);
    return new Blob([buffer], { type: "application/x-hwp" });
  } finally {
    document.free();
  }
}
