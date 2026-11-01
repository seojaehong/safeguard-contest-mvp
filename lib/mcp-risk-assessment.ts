// MCP generate_risk_assessment — 작업 설명 하나로 위험성평가표(본표 행 + 확인 필요 목록 + SIF 유사사례 +
// 웹 「위험성평가표 편집 → 내보내기」와 같은 서식 파일)를 돌려준다.
//
// 엔진·서식을 새로 만들지 않는다.
// - 생성: 웹 /api/ask 와 같은 runAsk(question, { aiMode }) (주입: generateResponse).
// - 행: runAsk 가 정본화한 structured.riskAssessmentRows / riskReviewItems 그대로. 칸은 riskRecordRowCells(파일 본표와 같은 함수).
// - 파일: 편집기와 같은 요청 본문(buildRiskAssessmentExportBody)을 웹 라우트와 같은 렌더 함수에 넣는다
//   (lib/document-export-xlsx.ts·document-export-hwp.ts, 주입: renderXlsx·renderHwp).
// - SIF: 같은 생성이 쓴 dbHarness.packet.sifCases·sifSelection(관련성 거름은 패킷 단계). 따로 검색·거르지 않는다(파일과 목록이 어긋나지 않게).
// - 공개 표면: 웹 경로대로 /api/ask 정리 → 편집기 내보내기 본문 → 라우트와 같은 게이트를 본문에만 한 번 걸고(exportView),
//   JSON 의 행·칸·scenario 와 파일을 그 본문으로 만든다. evidenceRefs 만 runAsk 처럼 게이트 전 값.
// 작업공간에 저장하지 않는다(읽기 전용 산출물). 결과는 256KB 상한(MCP_TOOL_RESULT_MAX_BYTES) 안에서 들여쓰기 없는 JSON 으로 싣고, 넘으면 cells → file 순서로 뺀다(fitRiskAssessmentToolResult).
import { createHash } from "node:crypto";

import type { AiMode } from "@/lib/ai-deliverables";
import { sanitizeAskResponsePublicSurface } from "@/lib/ask-public-surface";
import type { McpAuthContext } from "@/lib/mcp-auth";
import { MCP_TOOL_RESULT_MAX_BYTES, toToolResult, type McpToolResult } from "@/lib/mcp-tools";
import { DocumentExportLimitError } from "@/lib/document-export-budget";
import {
  displayEvidenceRefs,
  RISK_APPROVAL_LABELS,
  RISK_RECORD_ROW_HEADERS,
  RISK_REVIEW_LIST_NOTE,
  RISK_REVIEW_LIST_TITLE,
  riskRecordRowCells,
  toStructuredRiskRows
} from "@/lib/risk-assessment-record";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";
import {
  buildRiskAssessmentExportBody,
  RISK_ASSESSMENT_EXPORT_TITLE,
  RISK_ASSESSMENT_FORM_PROFILE,
  type RiskAssessmentExportFormat
} from "@/lib/risk-assessment-export-body";
import type { XlsxDocumentExportRender } from "@/lib/document-export-xlsx";
import type { HwpDocumentExportRender } from "@/lib/document-export-hwp";
import type { SafetyReferenceSourceMeta } from "@/lib/safety-reference-catalog";
import type { SifRelevance } from "@/lib/sif-case-relevance";
import type { AskResponse } from "@/lib/types";
import { gateExportPayload } from "@/lib/user-output-gate";

export type GenerateRiskAssessmentInput = {
  question: string;
  mode?: AiMode;
  format?: RiskAssessmentExportFormat;
};

export type RiskAssessmentSifSource = {
  id: string;
  agency: string | null;
  title: string | null;
  /** 원천 자료 공개(수집) 기준일. 모르면 null. */
  publishedAt: string | null;
  /** 원천 자료 공개 연도(publishedAt 의 연도). 사례 발생 연도가 아니다. 공단 SIF 수치는 출처·연도마다 달라 함께 적는다. */
  sourcePublishedYear: number | null;
  url: string | null;
};

export type RiskAssessmentSifCase = {
  id: string;
  title: string;
  overview: string;
  source: RiskAssessmentSifSource;
  /** 이 작업과 겹친 작업·장소·기인물 묶음과 재해형태 묶음(lib/sif-case-relevance.ts). */
  relevance?: SifRelevance;
};

export type RiskAssessmentSifExcluded = { id: string; title: string; reason: string };

export type RiskRecordItemStatus = "filled" | "partial" | "blank";

export type RiskRecordItemCheck = {
  item: string;
  basis: string;
  status: RiskRecordItemStatus;
  filledRows?: number;
  totalRows?: number;
  note: string;
};

export type RiskAssessmentToolResult = {
  engine: "safeclaw-runAsk";
  /** ok_fallback = 행은 만들었지만 생성이 보조 응답(모델 대신 규칙 기반)으로 끝났다. generation 참고. */
  status: "ok" | "ok_fallback" | "review_required";
  mode: AiMode;
  /** 생성 품질 신호(runAsk generationTrace). fallbackUsed·answerProvider 가 null 이면 생성 기록이 없어 모른다는 뜻. */
  generation: {
    askMode: AiMode;
    fallbackUsed: boolean | null;
    answerProvider: string | null;
  };
  /** 웹 /api/ask 와 같은 시나리오(작업 분류 상태·작업 유형·이유 포함). */
  scenario: AskResponse["scenario"];
  riskSummary: { riskLevel: string; topRisk: string };
  riskAssessment: {
    title: string;
    formCode: string;
    /** 한글(hwp) 본표 13칸 머리(번호…잔여 위험성). 엑셀(xlsx) 서식은 21칸이고, 엑셀에만 있는 칸(4M·담당자·조치기한·확인상태 등)은 structuredRows 에 전부 있다. */
    headers: string[];
    rowCount: number;
    rows: Array<{
      /** headers 와 같은 13칸 값. 응답 크기 상한에 걸리면 맨 먼저 뺀다(structuredRows 로 다시 만들 수 있다). */
      cells: string[];
      whyLikelihood: string;
      whySeverity: string;
      evidenceRefs: string[];
    }>;
    approvalLabels: string[];
    /** 파일 본표가 쓴 정본 행 원본(structured.riskAssessmentRows). 엑셀 21칸·한글 13칸 모두 여기서 만든다. 다른 서식으로 다시 내보낼 때 쓴다. */
    structuredRows: NonNullable<AskResponse["structured"]>["riskAssessmentRows"];
  };
  reviewItems: {
    title: string;
    note: string;
    count: number;
    items: Array<{ number: number; content: string; references: string[] }>;
    structuredRows: NonNullable<AskResponse["structured"]>["riskAssessmentRows"];
  };
  recordItemsCheck: {
    basis: string;
    filled: number;
    partial: number;
    blank: number;
    items: RiskRecordItemCheck[];
    note: string;
  };
  sif: {
    count: number;
    cases: RiskAssessmentSifCase[];
    reason?: string;
    /** 안전 지식 DB 가 이 생성에 돌려준 사례 수(제외 전). */
    retrievedCount?: number;
    /** 작업·재해형태가 맞지 않아 뺀 사례. */
    excluded?: RiskAssessmentSifExcluded[];
    /** 관련성 거름을 걸었는가. false 면 cases 는 검색 순서 그대로이고 relevance 가 없다(relevanceNote 에 이유). */
    relevanceApplied: boolean;
    relevanceNote?: string;
  };
  responsibilityNote: string;
  file: {
    format: RiskAssessmentExportFormat;
    fileName: string;
    mimeType: string;
    byteLength: number;
    sha256: string;
    base64: string;
  } | null;
  fileUnavailableReason?: string;
  /** 응답 크기 상한 때문에 뺀 칸(차례대로). riskAssessment.rows[].cells → file. structuredRows 는 빼지 않는다. */
  trimmed?: string[];
  exportParity: string;
};

export type GenerateRiskAssessmentHandler = (
  input: GenerateRiskAssessmentInput,
  authContext: McpAuthContext,
  execution?: { signal: AbortSignal },
) => Promise<McpToolResult>;

type Dependencies = {
  defaultMode: AiMode;
  generateResponse: (question: string, mode: AiMode, signal?: AbortSignal) => Promise<AskResponse>;
  renderXlsx: (payload: unknown) => Promise<XlsxDocumentExportRender>;
  renderHwp: (payload: unknown) => HwpDocumentExportRender;
  /** 안전 지식 DB safety_reference_sources 에서 출처 메타를 읽는다. 없으면 오프라인 원천 말고는 출처를 null 로 둔다. */
  lookupSources?: (ids: readonly string[], signal?: AbortSignal) => Promise<Map<string, SafetyReferenceSourceMeta>>;
};

const MIME_TYPES: Record<RiskAssessmentExportFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  hwp: "application/x-hwp"
};

/** 기본 생성 깊이. 웹 /api/ask 기본값(resolveRunAskMode)과 같다. 입장 제어와 핸들러가 이 값 하나를 쓴다. */
export const GENERATE_RISK_ASSESSMENT_DEFAULT_MODE: AiMode = "enhanced";

export const RISK_ASSESSMENT_RESPONSIBILITY_NOTE =
  "초안 작성 보조 결과입니다. 위험성평가 실시와 최종 판단 책임은 사업주에게 있습니다.";

// SIF 사례 출처 메타는 안전 지식 DB safety_reference_sources 행(agency·title·published_at·origin_url)에서 읽는다.
// 코드에 남는 것은 DB 가 없을 때 쓰는 번들 오프라인 원천 하나뿐이다. DB 에 없는 원천은 출처·날짜를 지어내지 않는다.
const OFFLINE_SIF_SOURCE: SafetyReferenceSourceMeta = {
  id: "safeclaw-offline-sif-cases",
  agency: "SafeClaw",
  title: "오프라인 SIF 유사사례(안전 지식 DB 미설정 시 대체 자료)",
  publishedAt: null,
  originUrl: null
};

function sifSourceOf(sourceId: string, url: string | null | undefined, meta: SafetyReferenceSourceMeta | undefined): RiskAssessmentSifSource {
  const known = meta ?? (sourceId === OFFLINE_SIF_SOURCE.id ? OFFLINE_SIF_SOURCE : undefined);
  const publishedAt = known?.publishedAt ?? null;
  return {
    id: sourceId,
    agency: known?.agency ?? null,
    title: known?.title ?? null,
    publishedAt,
    sourcePublishedYear: publishedAt ? Number(publishedAt.slice(0, 4)) : null,
    url: url ?? known?.originUrl ?? null
  };
}

/**
 * 생성에 쓰인 SIF 사례를 그대로 돌려준다. 작업·장소·기인물로 거르고 관련 순으로 세우는 일은 생성 입력
 * 단계(lib/db-harness.ts buildDbHarnessPacket → lib/sif-case-relevance.ts)가 이미 했다. 여기서 다시 거르면
 * 생성이 본 근거와 돌려주는 목록이 어긋나므로, 패킷의 sifCases 순서·relevance·excluded 를 옮겨 적기만 한다.
 */
function sifCasesOf(response: AskResponse, sources: ReadonlyMap<string, SafetyReferenceSourceMeta>): {
  relevanceApplied: boolean;
  relevanceNote?: string;
  retrievedCount: number;
  cases: RiskAssessmentSifCase[];
  excluded: RiskAssessmentSifExcluded[];
} {
  const packet = response.dbHarness?.packet;
  const items = packet?.sifCases ?? [];
  const relevanceById = new Map((packet?.sifSelection?.relevance ?? []).map(({ id, relevance }) => [id, relevance]));
  const excluded = packet?.sifSelection?.excluded ?? [];
  return {
    relevanceApplied: packet?.sifSelection?.relevanceApplied ?? false,
    ...(packet?.sifSelection?.reason ? { relevanceNote: packet.sifSelection.reason } : {}),
    retrievedCount: packet?.sifSelection?.retrievedCount ?? items.length,
    cases: items.map((item) => {
      const relevance = relevanceById.get(item.id);
      return {
        id: item.id,
        title: item.display_title || item.title,
        overview: item.display_summary || item.short_summary || item.summary,
        source: sifSourceOf(item.source_id, item.source_url, sources.get(item.source_id)),
        ...(relevance ? { relevance } : {})
      };
    }),
    excluded: excluded.map(({ id, title, reason }) => ({ id, title, reason }))
  };
}

// ── 시행규칙 제37조의4제1항 기재 항목 충족 검사 ──────────────────────────
// 원문 확인: 산업안전보건법 시행규칙(2026-08-01 시행) 제37조의4①
//   1. 위험성평가 실시 시기 및 담당자  2. 참여한 근로자 및 근로자대표
//   3. 제37조의3제2호 — 파악한 유해·위험 요인, 위험성 수준 결정 결과, 개선대책 수립 내용 및 이행 결과
const RECORD_ITEMS_BASIS = "산업안전보건법 시행규칙 제37조의4제1항(2026-08-01 시행)";

// 머리 기록란 4항목(실시 시기·담당자·참여 근로자·근로자대표)은 생성 결과에 값이 없다. 파일에도 빈칸·선택 상자로만
// 나가므로(riskRecordHeaderPairs) 늘 빈칸(현장 기재)으로 둔다.
const HEADER_RECORD_ITEMS: ReadonlyArray<{ item: string; basis: string; label: string }> = [
  { item: "위험성평가 실시 시기", basis: "제37조의4제1항제1호", label: "평가 실시 시기" },
  { item: "위험성평가 담당자", basis: "제37조의4제1항제1호", label: "평가 담당자(성명)" },
  { item: "위험성평가에 참여한 근로자", basis: "제37조의4제1항제2호", label: "참여 근로자(성명)" },
  { item: "위험성평가에 참여한 근로자대표", basis: "제37조의4제1항제2호", label: "근로자대표 참여" }
];

function rowItemCheck(
  rows: readonly RiskAssessmentRow[],
  item: string,
  basis: string,
  column: string,
  has: (row: RiskAssessmentRow) => boolean
): RiskRecordItemCheck {
  const filledRows = rows.filter(has).length;
  const status: RiskRecordItemStatus = rows.length && filledRows === rows.length
    ? "filled"
    : filledRows > 0 ? "partial" : "blank";
  const note = status === "filled"
    ? `본표 ${rows.length}행 모두 「${column}」 칸이 채워져 있습니다.`
    : status === "partial"
      ? `본표 ${rows.length}행 중 ${filledRows}행만 「${column}」 칸이 채워져 있습니다.`
      : `본표 「${column}」 칸이 비어 있습니다. 현장에서 적습니다.`;
  return { item, basis, status, filledRows, totalRows: rows.length, note };
}

/** 정본 행 원본(structured.riskAssessmentRows)으로 센다. 표시용으로 다시 읽은 행의 자리표시 문구에 기대지 않는다. */
export function checkRiskRecordItems(rows: readonly RiskAssessmentRow[]): RiskAssessmentToolResult["recordItemsCheck"] {
  const text = (value: string | undefined) => Boolean(value?.trim());
  const grade = (value: number | undefined) => typeof value === "number" && value >= 1;
  const rowBasis = "제37조의4제1항제3호·제37조의3제2호";
  const items: RiskRecordItemCheck[] = [
    ...HEADER_RECORD_ITEMS.map(({ item, basis, label }): RiskRecordItemCheck => ({
      item,
      basis,
      status: "blank",
      note: `「${label}」 칸이 빈칸입니다. 현장에서 적습니다.`
    })),
    rowItemCheck(rows, "파악한 유해·위험 요인", rowBasis, "유해·위험요인", (row) => text(row.hazard)),
    rowItemCheck(rows, "위험성 수준 결정 결과", rowBasis, "가능성·중대성·위험성",
      (row) => grade(row.likelihood) && grade(row.severity) && text(row.riskLevel)),
    rowItemCheck(rows, "개선대책 수립 내용", rowBasis, "감소대책", (row) => text(row.additionalControls)),
    rowItemCheck(rows, "개선대책 이행 결과", rowBasis, "이행 결과", (row) => text(row.implementationResult))
  ];
  return {
    basis: RECORD_ITEMS_BASIS,
    filled: items.filter((entry) => entry.status === "filled").length,
    partial: items.filter((entry) => entry.status === "partial").length,
    blank: items.filter((entry) => entry.status === "blank").length,
    items,
    note: "빈칸·일부 항목은 현장에서 채운 뒤 기록합니다. 기록은 3년간 보존합니다(같은 조 제2항)."
  };
}

function sifZeroReason(response: AskResponse, mode: AiMode, excludedCount = 0): string {
  if (excludedCount) {
    return `안전 지식 DB가 돌려준 SIF 사례 ${excludedCount}건이 모두 이 작업의 작업·장소·기인물과 맞지 않아 붙이지 않았습니다(excluded 에 이유).`;
  }
  if (response.scenario.taskClassification?.status === "review_required") {
    return "작업 유형을 확인하지 못해 안전 지식 DB를 조회하지 않았습니다. 작업 내용을 더 구체적으로 적어 다시 호출하세요.";
  }
  if (mode === "template") {
    return "template 모드는 안전 지식 DB를 조회하지 않습니다. SIF 유사사례가 필요하면 mode=enhanced 또는 full 로 호출하세요.";
  }
  const retrieval = response.dbHarness?.packet?.retrievalContract;
  if (retrieval?.errorCode) {
    return `안전 지식 DB 검색이 실패해 SIF 유사사례를 붙이지 못했습니다(${retrieval.errorCode}).`;
  }
  return "안전 지식 DB에서 이 작업과 맞는 SIF 유사사례를 찾지 못했습니다.";
}

class RiskAssessmentRenderError extends Error {}

async function renderFile(
  dependencies: Dependencies,
  body: Record<string, unknown>,
  format: RiskAssessmentExportFormat
): Promise<NonNullable<RiskAssessmentToolResult["file"]>> {
  let buffer: Buffer;
  let fileName: string;
  if (format === "xlsx") {
    const rendered = await dependencies.renderXlsx(body);
    if (!rendered.ok) throw new RiskAssessmentRenderError(rendered.error);
    buffer = rendered.buffer;
    fileName = rendered.fileName;
  } else {
    const rendered = dependencies.renderHwp(body);
    buffer = rendered.buffer;
    fileName = rendered.fileName;
  }
  return {
    format,
    fileName,
    mimeType: MIME_TYPES[format],
    byteLength: buffer.byteLength,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    base64: buffer.toString("base64")
  };
}

type RiskRows = NonNullable<AskResponse["structured"]>["riskAssessmentRows"];

/** 게이트를 지난 행에 게이트 전 행의 evidenceRefs 를 돌려 넣는다(같은 순서, 게이트는 행을 빼거나 바꾸지 않는다). */
function withSourceEvidenceRefs(gated: unknown, source: RiskRows | undefined): RiskRows {
  return (Array.isArray(gated) ? gated as RiskRows : []).map((row, index) => ({ ...row, evidenceRefs: source?.[index]?.evidenceRefs ?? row.evidenceRefs }));
}

/**
 * 웹 경로를 그대로 따른다. ① /api/ask 공개 표면 정리(sanitizeAskResponsePublicSurface) → ② 편집기와 같은 내보내기 본문
 * (buildRiskAssessmentExportBody) → ③ /api/export 라우트와 같은 내보내기 게이트(gateExportPayload)를 본문에만 한 번.
 * 결과 JSON 의 본표 행·칸·확인 필요 목록·scenario 는 ③ 의 본문에서 꺼내 파일과 같은 값이다. 다만 evidenceRefs 는 runAsk
 * (gateAskResponseUserOutput)처럼 출처 추적 데이터라 게이트를 걸지 않은 ① 의 값을 둔다(웹 /api/ask 와 같다).
 * dbHarness 는 ① 이 건드리지 않는다(SIF 출처 id·주소를 바꾸지 않게).
 */
function exportView(response: AskResponse, format: RiskAssessmentExportFormat) {
  const publicResponse = sanitizeAskResponsePublicSurface(response);
  const body = gateExportPayload(buildRiskAssessmentExportBody(publicResponse, format));
  return {
    publicResponse,
    body,
    scenario: body.scenario as AskResponse["scenario"],
    mainRows: withSourceEvidenceRefs(body.riskAssessmentRows, publicResponse.structured?.riskAssessmentRows),
    reviewRows: withSourceEvidenceRefs(body.riskReviewItems, publicResponse.structured?.riskReviewItems)
  };
}

/** 서식 파일을 못 만든 이유. 렌더러 오류 문구(내부 경로가 섞일 수 있다)는 싣지 않는다. */
function renderFailureReason(error: unknown, format: RiskAssessmentExportFormat): string {
  const label = format === "xlsx" ? "Excel 표 양식(.xlsx)" : "한글 표 양식(.hwp)";
  if (error instanceof DocumentExportLimitError) {
    return `${label} 서식 파일을 만들지 못했습니다(내보내기 크기 상한 초과). 본표 행·structuredRows 는 그대로 돌려줍니다.`;
  }
  return `${label} 서식 파일을 만들지 못했습니다. 본표 행·structuredRows 로 웹 「위험성평가표 편집 → 내보내기」에서 다시 만드세요.`;
}

function toolResultBytes(text: string): number {
  return new TextEncoder().encode(JSON.stringify({ content: [{ type: "text", text }] })).byteLength;
}

/**
 * 결과를 들여쓰기 없는 JSON 한 덩이로 싣는다. 응답 크기 상한을 넘으면 결과를 버리지 않고
 * ① rows[].cells(structuredRows 로 다시 만들 수 있는 중복) ② file 순서로 빼고 trimmed 에 적는다.
 * 그래도 넘으면 toToolResult 의 크기 초과 오류를 낸다.
 */
export function fitRiskAssessmentToolResult(result: RiskAssessmentToolResult, maxBytes = MCP_TOOL_RESULT_MAX_BYTES): McpToolResult {
  const fits = (value: unknown) => {
    const text = JSON.stringify(value);
    return toolResultBytes(text) <= maxBytes ? text : null;
  };
  const full = fits(result);
  if (full !== null) return { content: [{ type: "text", text: full }] };

  const withoutCells = {
    ...result,
    riskAssessment: { ...result.riskAssessment, rows: result.riskAssessment.rows.map(({ cells: _cells, ...row }) => row) },
    trimmed: ["riskAssessment.rows[].cells"]
  };
  const lighter = fits(withoutCells);
  if (lighter !== null) return { content: [{ type: "text", text: lighter }] };

  const withoutFile = {
    ...withoutCells,
    file: null,
    fileUnavailableReason: "결과가 응답 크기 상한을 넘어 서식 파일을 뺐습니다. structuredRows 로 웹 「위험성평가표 편집 → 내보내기」에서 다시 만드세요.",
    trimmed: ["riskAssessment.rows[].cells", "file"]
  };
  const lightest = fits(withoutFile);
  if (lightest !== null) return { content: [{ type: "text", text: lightest }] };
  if (maxBytes === MCP_TOOL_RESULT_MAX_BYTES) return toToolResult(withoutFile);
  return {
    content: [{ type: "text", text: JSON.stringify({ code: "MCP_TOOL_RESULT_TOO_LARGE", error: "도구 결과가 UTF-8 응답 크기 제한을 초과해 반환되지 않았습니다.", limit: maxBytes }) }],
    isError: true
  };
}

export function createGenerateRiskAssessmentHandler(dependencies: Dependencies): GenerateRiskAssessmentHandler {
  return async ({ question, mode, format }, _authContext, execution) => {
    const signal = execution?.signal;
    signal?.throwIfAborted();
    const aiMode = mode ?? dependencies.defaultMode;
    const fileFormat = format ?? "xlsx";
    const view = exportView(await dependencies.generateResponse(question, aiMode, signal), fileFormat);
    const response = view.publicResponse;
    signal?.throwIfAborted();

    const main = toStructuredRiskRows(view.mainRows);
    const review = toStructuredRiskRows(view.reviewRows);
    const sifSourceIds = [...new Set((response.dbHarness?.packet?.sifCases ?? []).map((item) => item.source_id))];
    const sources = sifSourceIds.length && dependencies.lookupSources ? await dependencies.lookupSources(sifSourceIds, signal) : new Map<string, SafetyReferenceSourceMeta>();
    signal?.throwIfAborted();
    const sif = sifCasesOf(response, sources);
    const sifCases = sif.cases;
    const hasRows = main.length > 0;

    const trace = response.generationTrace;
    const generation: RiskAssessmentToolResult["generation"] = {
      askMode: trace?.askMode ?? aiMode,
      fallbackUsed: trace ? trace.fallbackUsed : null,
      answerProvider: trace?.answer.provider ?? null
    };

    const result: RiskAssessmentToolResult = {
      engine: "safeclaw-runAsk",
      status: !hasRows ? "review_required" : generation.fallbackUsed ? "ok_fallback" : "ok",
      mode: aiMode,
      generation,
      scenario: view.scenario,
      riskSummary: { riskLevel: response.riskSummary.riskLevel, topRisk: response.riskSummary.topRisk },
      riskAssessment: {
        title: RISK_ASSESSMENT_EXPORT_TITLE,
        formCode: RISK_ASSESSMENT_FORM_PROFILE.code,
        headers: [...RISK_RECORD_ROW_HEADERS],
        rowCount: main.length,
        rows: main.map((row, index) => ({
          cells: riskRecordRowCells(row, index),
          whyLikelihood: row.whyLikelihood || "",
          whySeverity: row.whySeverity || "",
          evidenceRefs: displayEvidenceRefs(row.evidenceRefs)
        })),
        approvalLabels: [...RISK_APPROVAL_LABELS],
        structuredRows: view.mainRows
      },
      reviewItems: {
        title: RISK_REVIEW_LIST_TITLE,
        note: RISK_REVIEW_LIST_NOTE,
        count: review.length,
        items: review.map((row, index) => ({
          number: index + 1,
          content: row.hazard,
          references: displayEvidenceRefs(row.evidenceRefs)
        })),
        structuredRows: view.reviewRows
      },
      recordItemsCheck: checkRiskRecordItems(view.mainRows),
      sif: {
        ...(sifCases.length
          ? { count: sifCases.length, cases: sifCases }
          : { count: 0, cases: [], reason: sifZeroReason(response, aiMode, sif.excluded.length) }),
        ...(sif.retrievedCount ? { retrievedCount: sif.retrievedCount } : {}),
        ...(sif.excluded.length ? { excluded: sif.excluded } : {}),
        relevanceApplied: sif.relevanceApplied,
        ...(sif.relevanceNote ? { relevanceNote: sif.relevanceNote } : {})
      },
      responsibilityNote: RISK_ASSESSMENT_RESPONSIBILITY_NOTE,
      file: null,
      exportParity: "file 은 웹 「위험성평가표 편집 → 내보내기」의 Excel 표 양식(.xlsx)·한글 표 양식(.hwp)과 같은 요청 본문·같은 렌더 함수로 만들었습니다. 현장에서 빈칸(실시 시기·담당자·참여 근로자·결재)을 채운 뒤 사용하세요."
    };

    if (hasRows) {
      signal?.throwIfAborted();
      try {
        result.file = await renderFile(dependencies, view.body, fileFormat);
      } catch (error) {
        // 호출 취소는 결과로 바꾸지 않는다. 그 밖의 렌더 실패는 파일만 빼고 본표 결과는 돌려준다.
        signal?.throwIfAborted();
        result.fileUnavailableReason = renderFailureReason(error, fileFormat);
      }
    } else {
      // 작업 분류의 내부 이유 문구는 그대로 옮기지 않는다(웹 화면용 문구라 도구 결과 금지 문구가 섞일 수 있다, 261101 run6 S4).
      result.fileUnavailableReason = view.scenario.taskClassification?.status === "review_required"
        ? "작업 유형을 확인하지 못해 위험성평가 행을 만들지 않았습니다. 작업 종류와 사용 장비를 더 구체적으로 적어 다시 호출하세요."
        : "위험성평가 본표 행이 없어 서식 파일을 만들지 않았습니다. 작업 내용을 더 구체적으로 적어 다시 호출하세요.";
    }

    return fitRiskAssessmentToolResult(result);
  };
}
