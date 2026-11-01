// /api/export/hwp 의 본문 → 한컴 HWP(5.0 바이너리) 변환. 웹 라우트(app/api/export/hwp/route.ts)와
// MCP generate_risk_assessment 가 같은 함수를 쓴다(채널마다 서식 코드를 복제하지 않는다).
// 받은 본문은 여기서 PR-14 출력 게이트(gateExportPayload)와 입력·출력 예산을 지난다.
import fs from "node:fs";
import path from "node:path";
// Use the WASM init for server runtime. exportHwp() supports tables; exportHwpx() does NOT.
import { initSync, HwpDocument } from "@rhwp/core";
import { gateExportPayload } from "@/lib/user-output-gate";
import { companyFilePrefix, formatCompanyName, formatWorkerCount } from "@/lib/scenario-display";
import {
  resolveRiskAssessmentRows,
  type StructuredRiskAssessmentRow
} from "@/lib/risk-assessment-renderer";
import { RISK_RETENTION_NOTE, RISK_SCALE_LINES } from "@/lib/risk-labels";
import {
  displayEvidenceRefs,
  resolveRiskExportRows,
  RISK_APPROVAL_LABELS,
  RISK_ASSESSMENT_COLUMNS,
  RISK_RECORD_HEADER_SPANS,
  RISK_RECORD_ROW_HEADERS,
  RISK_REVIEW_LIST_NOTE,
  RISK_REVIEW_LIST_TITLE,
  RISK_REVIEW_ROW_SPANS,
  riskColumnWeights,
  riskRecordHeaderPairs,
  riskRecordRowCells,
  riskSpanWeights
} from "@/lib/risk-assessment-record";
import {
  assertDocumentExportInputBudget,
  assertDocumentExportOutputBudget
} from "@/lib/document-export-budget";
import {
  isRecord,
  parseProfile,
  parseRiskRowsFromBody,
  parseRows,
  parseScenario,
  readString,
  sanitizeFileName,
  type SafetyFormProfile,
  type SheetRow
} from "@/lib/document-export-request";

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

// 한글 단위(HWPUNIT, 1pt = 100). 본문 글자는 10pt 이고 한글 한 자 폭이 글자 크기와 같다.
const HWP_CHAR_WIDTH = 1000;
// rhwp 기본 칸 안쪽 여백(좌우 510씩)과 줄바꿈 여유.
const HWP_CELL_HORIZONTAL_PADDING = 1020 + 200;
// 긴 칸 글에서 한 줄에 지킬 낱말 길이 상한(긴 문장 칸은 비율로 넓힌다).
export const HWP_MIN_WORD_CHARS = 5;
// 위험성평가 용지 = 엑셀 내보내기와 같은 A3 가로(lib/xlsx-builder.ts finalizeWorksheet wide → paperSize 8).
// 한글 PageDef 는 세로 기준 너비·높이에 landscape 표시를 단다(너비·높이를 맞바꾸면 한글이 세로로 연다, 261101 실측).
// A4 가로(59528 × 84186)로 두면 13칸 최소 폭 합이 본문 폭 대부분을 써서 유해·위험요인 칸이 한 줄 약 6자가 된다.
const HWP_RISK_PAPER = { width: 84186, height: 119055 } as const; // A3 297mm × 420mm
// 좌우 여백 15mm(기본 30mm).
const HWP_WIDE_SIDE_MARGIN = 4252;

/** 열 비율(weights)로 나눌 표. headerRow 면 첫 행을 머리 행으로 두고 쪽마다 반복한다. */
type HwpTableLayout = { bodyWidth: number; weights: readonly number[]; headerRow?: boolean };

// 한글은 한국어를 낱말이 아니라 글자 단위로 줄바꿈한다(「현장 확/인」). 이 길이 이하의 짧은 칸 글은 통째로 한 줄에 둔다.
const HWP_SHORT_TEXT_CHARS = 6;

/** 칸 글이 한 줄에 들어가야 하는 글자 수. 머리 행과 짧은 칸(6자 이하)은 글 전체, 긴 칸은 가장 긴 낱말(최대 5자). */
export function hwpCellMinChars(text: string, isHeader: boolean): number {
  const length = [...text.trim()].length;
  if (isHeader || length <= HWP_SHORT_TEXT_CHARS) return length;
  const longest = Math.max(0, ...text.split(/\s+/u).map((word) => [...word].length));
  return Math.min(longest, HWP_MIN_WORD_CHARS);
}

/**
 * 열 너비를 엑셀 비율(weights)로 나누되, 칸마다 hwpCellMinChars 글자가 한 줄에 들어갈 폭은 지킨다.
 * 최소 폭을 채운 열을 고정하고 남은 폭을 나머지 열에 비율대로 다시 나눈다.
 */
export function fitHwpColumnWidths(rows: readonly (readonly string[])[], layout: HwpTableLayout): number[] {
  const colCount = layout.weights.length;
  const minimums = Array.from({ length: colCount }, (_x, col) => {
    const chars = Math.max(1, ...rows.map((row, rIdx) => hwpCellMinChars(row[col] || "", Boolean(layout.headerRow) && rIdx === 0)));
    return chars * HWP_CHAR_WIDTH + HWP_CELL_HORIZONTAL_PADDING;
  });
  const widths = new Array<number>(colCount).fill(0);
  const fixed = new Set<number>();
  for (let round = 0; round < colCount; round += 1) {
    const freeWidth = layout.bodyWidth - [...fixed].reduce((sum, col) => sum + widths[col], 0);
    const freeWeight = layout.weights.reduce((sum, weight, col) => (fixed.has(col) ? sum : sum + weight), 0);
    let changed = false;
    for (let col = 0; col < colCount; col += 1) {
      if (fixed.has(col)) continue;
      widths[col] = Math.floor((freeWidth * layout.weights[col]) / freeWeight);
      if (widths[col] < minimums[col]) {
        widths[col] = minimums[col];
        fixed.add(col);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return widths;
}

function insertHwpTable(
  document: HwpDocument,
  paraIdx: number,
  rows: readonly (readonly string[])[],
  label: string,
  layout?: HwpTableLayout
): number {
  const colCount = rows[0]?.length ?? 0;
  if (!rows.length || !colCount || rows.some((row) => row.length !== colCount)) {
    throw new Error(`${label} 표 데이터가 올바르지 않습니다.`);
  }
  if (layout && layout.weights.length !== colCount) throw new Error(`${label} 표 열 너비 수가 열 수와 다릅니다.`);
  const table = parseJsonResult(document.createTable(0, paraIdx, 0, rows.length, colCount));
  if (!table?.ok || typeof table.paraIdx !== "number") {
    throw new Error(`${label} 표를 만들지 못했습니다.`);
  }
  const controlIdx = typeof table.controlIdx === "number" ? table.controlIdx : 0;
  if (layout) {
    // rhwp 0.7.6 에서 한글이 제대로 여는 길은 칸마다 setCellProperties({width}) 뿐이다(261101 한글 렌더 실측).
    // createTableEx colWidths 는 「글자처럼 취급」 표에서만 먹어 쪽을 넘겨 나뉘지 않고,
    // resizeTableCells 는 한글에서 표가 사라지거나 오른쪽으로 밀린다. 본표가 여러 쪽이면 머리 행을 반복한다.
    const targets = fitHwpColumnWidths(rows, layout);
    rows.forEach((_row, rIdx) => targets.forEach((width, cIdx) => {
      const result = parseJsonResult(document.setCellProperties(0, table.paraIdx as number, controlIdx, rIdx * colCount + cIdx, JSON.stringify({ width })));
      if (!result.ok) throw new Error(`${label} 표 열 너비를 바꾸지 못했습니다.`);
    }));
    if (layout.headerRow && rows.length > 1) {
      for (let cIdx = 0; cIdx < colCount; cIdx += 1) {
        const header = parseJsonResult(document.setCellProperties(0, table.paraIdx as number, controlIdx, cIdx, JSON.stringify({ isHeader: true })));
        if (!header.ok) throw new Error(`${label} 표 머리 행을 표시하지 못했습니다.`);
      }
      const repeat = parseJsonResult(document.setTableProperties(0, table.paraIdx as number, controlIdx, JSON.stringify({ repeatHeader: true })));
      if (!repeat.ok) throw new Error(`${label} 표 머리 행 반복을 켜지 못했습니다.`);
    }
  }
  rows.forEach((row, rIdx) => {
    row.forEach((value, cIdx) => {
      document.insertTextInCell(0, table.paraIdx as number, controlIdx, rIdx * colCount + cIdx, 0, 0, value);
    });
  });
  return document.getParagraphCount(0) - 1;
}

function insertHwpParagraph(document: HwpDocument, paraIdx: number, text: string): number {
  document.insertText(0, paraIdx, 0, text);
  document.splitParagraph(0, paraIdx, document.getParagraphLength(0, paraIdx));
  return document.getParagraphCount(0) - 1;
}

function buildHwpBuffer(args: {
  title: string;
  rows: SheetRow[];
  profile: SafetyFormProfile;
  scenario: ReturnType<typeof parseScenario>;
  structuredRiskRows?: StructuredRiskAssessmentRow[];
  riskReviewItems?: StructuredRiskAssessmentRow[];
}): Buffer {
  ensureWasm();
  const { title, rows, profile, scenario, structuredRiskRows } = args;
  const isRisk = profile.layout === "risk";
  const riskRows = isRisk && structuredRiskRows?.length
    ? resolveRiskAssessmentRows({ structuredRows: structuredRiskRows, fallbackRows: rows })
    : [];
  const document = HwpDocument.createEmpty();
  try {
    document.createBlankDocument();

    // 위험성평가 본표(13칸)는 엑셀처럼 A3 가로에 엑셀 열 비율로 싣는다. 다른 문서는 세로 기본 그대로다.
    let wide: ((weights: readonly number[], headerRow?: boolean) => HwpTableLayout) | undefined;
    if (riskRows.length) {
      const pageDef = parseJsonResult(document.getPageDef(0));
      document.setPageDef(0, JSON.stringify({
        ...pageDef,
        ...HWP_RISK_PAPER,
        landscape: true,
        marginLeft: HWP_WIDE_SIDE_MARGIN,
        marginRight: HWP_WIDE_SIDE_MARGIN
      }));
      const page = parseJsonResult(document.getPageDef(0));
      const long = Math.max(Number(page.width) || 0, Number(page.height) || 0);
      const bodyWidth = long - (Number(page.marginLeft) || 0) - (Number(page.marginRight) || 0);
      wide = (weights, headerRow = false) => ({ bodyWidth, weights, headerRow });
    }

    document.insertText(0, 0, 0, `${title}(공식자료 기반 표 양식)\nSafeClaw · 현장 검토 후 사용`);
    const titleLength = document.getParagraphLength(0, 0);
    document.splitParagraph(0, 0, titleLength);
    let nextParaIdx = document.getParagraphCount(0) - 1;

    // Metadata table (4 col x 2 row)
    {
      const meta: string[][] = [
        ["사업장", formatCompanyName(scenario.companyName), "현장/공정", scenario.siteName],
        ["작업내용", scenario.workSummary, "인원/조건", `${formatWorkerCount(scenario.workerCount)} · ${scenario.weatherNote}`]
      ];
      nextParaIdx = insertHwpTable(document, nextParaIdx, meta, "기본정보", wide?.(riskSpanWeights(RISK_RECORD_HEADER_SPANS)));
    }

    // 위험성평가: 시행규칙 제37조의4 기록란과 위험성 결정 기준. 모르는 값은 빈칸이다.
    if (isRisk) {
      nextParaIdx = insertHwpParagraph(document, nextParaIdx, "평가 기록(산업안전보건법 시행규칙 제37조의4)");
      const pairs = riskRecordHeaderPairs(scenario);
      const recordRows: string[][] = [];
      for (let index = 0; index < pairs.length; index += 2) {
        const right = pairs[index + 1] || ["", ""];
        recordRows.push([pairs[index][0], pairs[index][1], right[0], right[1]]);
      }
      nextParaIdx = insertHwpTable(document, nextParaIdx, recordRows, "평가 기록", wide?.(riskSpanWeights(RISK_RECORD_HEADER_SPANS)));
      nextParaIdx = insertHwpParagraph(document, nextParaIdx, "위험성 결정 기준");
      // 라벨 칸은 기록란 라벨과 같은 묶음(엑셀 3열) 폭, 나머지는 기준 문장.
      nextParaIdx = insertHwpTable(
        document,
        nextParaIdx,
        RISK_SCALE_LINES.map((line) => ["결정 기준", line]),
        "위험성 결정 기준",
        wide?.(riskSpanWeights([RISK_RECORD_HEADER_SPANS[0], RISK_ASSESSMENT_COLUMNS.length]))
      );
    }

    // Body table
    // 정본 행을 그대로 싣는다. 모르는 값은 빈칸이다(「현장 확인」「작업반장」을 채우지 않는다).
    const cols = riskRows.length
      ? [...RISK_RECORD_ROW_HEADERS]
      : deriveColumns(profile);
    const bodyRows: string[][] = riskRows.length
      ? riskRows.map((riskRow, index) => riskRecordRowCells(riskRow, index))
      : rows.map((r, idx) => [
        profile.layout === "risk" ? (r.section || String(idx + 1)) : String(idx + 1),
        r.item || "",
        r.content || "",
        "□"
      ]);
    const allRows = [cols, ...bodyRows];
    nextParaIdx = insertHwpTable(document, nextParaIdx, allRows, "본문", riskRows.length ? wide?.(riskColumnWeights(cols), true) : undefined);

    // 「검토 필요:」 자리표시 행은 본표가 아니라 확인 필요 목록으로 싣는다(RA-11).
    const reviewItems = isRisk ? args.riskReviewItems || [] : [];
    if (reviewItems.length) {
      nextParaIdx = insertHwpParagraph(document, nextParaIdx, `${RISK_REVIEW_LIST_TITLE} — ${RISK_REVIEW_LIST_NOTE}`);
      nextParaIdx = insertHwpTable(document, nextParaIdx, [
        ["번호", "확인할 내용", "참고자료"],
        ...reviewItems.map((item, index) => [String(index + 1), item.hazard, displayEvidenceRefs(item.evidenceRefs).join(" / ")])
      ], "확인 필요 목록", wide?.(riskSpanWeights(RISK_REVIEW_ROW_SPANS)));
    }

    document.insertText(0, nextParaIdx, 0, "확인 및 서명");
    const approvalLabelLength = document.getParagraphLength(0, nextParaIdx);
    document.splitParagraph(0, nextParaIdx, approvalLabelLength);
    nextParaIdx = document.getParagraphCount(0) - 1;
    const approvalRows = isRisk
      ? [
        [...RISK_APPROVAL_LABELS],
        RISK_APPROVAL_LABELS.map(() => "성명/서명: ____________________")
      ]
      : [
        ["작성자", "관리감독자", "교육/TBM 확인자", "확인일시"],
        ["성명/서명: ____________________", "성명/서명: ____________________", "성명/서명: ____________________", "____년 ____월 ____일 ____시 ____분"]
      ];
    nextParaIdx = insertHwpTable(document, nextParaIdx, approvalRows, "확인·서명", wide?.(approvalRows[0].map(() => 1)));
    if (isRisk) document.insertText(0, nextParaIdx, 0, RISK_RETENTION_NOTE);

    return Buffer.from(document.exportHwp());
  } finally {
    document.free();
  }
}

export type HwpDocumentExportRender = { buffer: Buffer; fileName: string };

/** 내보내기 요청 본문(게이트 전 JSON)을 HWP 로 만든다. 예산 초과는 DocumentExportLimitError 를 던진다. */
export function renderHwpDocumentExport(payload: unknown): HwpDocumentExportRender {
  // PR-14: 받은 본문의 내부 문구·통째 enum 칸을 사용자용으로 거른 뒤 렌더한다.
  const parsed = gateExportPayload(payload);
  const body = isRecord(parsed) ? parsed : {};
  assertDocumentExportInputBudget(body);
  const title = readString(body.title, "SafeClaw 안전 문서");
  const rows = parseRows(body.rows, title);
  const profile = parseProfile(body.profile);
  const scenario = parseScenario(body.scenario);
  const riskExport = resolveRiskExportRows(body.edited === true ? [] : parseRiskRowsFromBody(body), body);
  const buffer = buildHwpBuffer({
    title,
    rows,
    profile,
    scenario,
    structuredRiskRows: riskExport.main,
    riskReviewItems: riskExport.review
  });
  assertDocumentExportOutputBudget(buffer);
  return { buffer, fileName: `${sanitizeFileName(companyFilePrefix(scenario.companyName, title))}.hwp` };
}
