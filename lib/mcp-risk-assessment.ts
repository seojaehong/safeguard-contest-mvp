// MCP generate_risk_assessment — 작업 설명 하나로 위험성평가표(본표 행 + 확인 필요 목록 + SIF 유사사례 +
// 웹 「위험성평가표 편집 → 내보내기」와 같은 서식 파일)를 돌려준다.
//
// 엔진·서식을 새로 만들지 않는다.
// - 생성: 웹 /api/ask 와 같은 runAsk(question, { aiMode }) (주입: generateResponse).
// - 행: runAsk 가 정본화한 structured.riskAssessmentRows / riskReviewItems 그대로. 칸은 riskRecordRowCells(파일 본표와 같은 함수).
// - 파일: 편집기와 같은 요청 본문(buildRiskAssessmentExportBody)을 웹 라우트와 같은 렌더 함수에 넣는다
//   (lib/document-export-xlsx.ts·document-export-hwp.ts, 주입: renderXlsx·renderHwp).
// - SIF: 같은 생성이 쓴 dbHarness.packet.sifCases·sifSelection(관련성 거름은 패킷 단계). 따로 검색·거르지 않는다(파일과 목록이 어긋나지 않게).
// 작업공간에 저장하지 않는다(읽기 전용 산출물). 결과는 toToolResult 의 256KB 상한을 그대로 따른다.
import { createHash } from "node:crypto";

import type { AiMode } from "@/lib/ai-deliverables";
import type { McpAuthContext } from "@/lib/mcp-auth";
import { toToolResult, type McpToolResult } from "@/lib/mcp-tools";
import {
  displayEvidenceRefs,
  RISK_APPROVAL_LABELS,
  RISK_RECORD_ROW_HEADERS,
  RISK_REVIEW_LIST_NOTE,
  RISK_REVIEW_LIST_TITLE,
  riskRecordHeaderPairs,
  riskRecordRowCells,
  toStructuredRiskRows
} from "@/lib/risk-assessment-record";
import type { StructuredRiskAssessmentRow } from "@/lib/risk-assessment-renderer";
import {
  buildRiskAssessmentExportBody,
  RISK_ASSESSMENT_EXPORT_TITLE,
  RISK_ASSESSMENT_FORM_PROFILE,
  type RiskAssessmentExportFormat
} from "@/lib/risk-assessment-export-body";
import type { XlsxDocumentExportRender } from "@/lib/document-export-xlsx";
import type { HwpDocumentExportRender } from "@/lib/document-export-hwp";
import type { SifRelevance } from "@/lib/sif-case-relevance";
import type { AskResponse } from "@/lib/types";

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
  /** 기준연도(publishedAt 의 연도). 공단 SIF 수치는 출처·연도마다 달라 함께 적는다. */
  baseYear: number | null;
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
  status: "ok" | "review_required";
  mode: AiMode;
  scenario: AskResponse["scenario"];
  riskSummary: { riskLevel: string; topRisk: string };
  riskAssessment: {
    title: string;
    formCode: string;
    headers: string[];
    rowCount: number;
    rows: Array<{
      cells: string[];
      whyLikelihood: string;
      whySeverity: string;
      evidenceRefs: string[];
    }>;
    approvalLabels: string[];
    /** 파일 본표가 쓴 정본 행 원본(structured.riskAssessmentRows). 다른 서식으로 다시 내보낼 때 쓴다. */
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
};

const MIME_TYPES: Record<RiskAssessmentExportFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  hwp: "application/x-hwp"
};

export const RISK_ASSESSMENT_RESPONSIBILITY_NOTE =
  "초안 작성 보조 결과입니다. 위험성평가 실시와 최종 판단 책임은 사업주에게 있습니다.";

// 안전 지식 DB 의 SIF 원천 자료(safety_reference_sources). 항목에는 출처 메타가 없어 source_id 로 찾는다.
// 값은 scripts/ingest_safety_reference_catalog.py 의 원천 정의와 같다.
const SIF_SOURCE_REGISTRY: Record<string, { agency: string; title: string; publishedAt: string | null }> = {
  "kosha-sif-archive-20260401": {
    agency: "한국산업안전보건공단",
    title: "산업재해 고위험요인(SIF) 아카이브",
    publishedAt: "2026-04-01"
  },
  "safeclaw-offline-sif-cases": {
    agency: "SafeClaw",
    title: "오프라인 SIF 유사사례(안전 지식 DB 미설정 시 대체 자료)",
    publishedAt: null
  }
};

function sifSourceOf(sourceId: string, url: string | null | undefined): RiskAssessmentSifSource {
  const known = SIF_SOURCE_REGISTRY[sourceId];
  const dated = sourceId.match(/-(\d{4})(\d{2})(\d{2})$/u);
  const publishedAt = known ? known.publishedAt : dated ? `${dated[1]}-${dated[2]}-${dated[3]}` : null;
  return {
    id: sourceId,
    agency: known?.agency ?? null,
    title: known?.title ?? null,
    publishedAt,
    baseYear: publishedAt ? Number(publishedAt.slice(0, 4)) : null,
    url: url ?? null
  };
}

/**
 * 생성에 쓰인 SIF 사례를 그대로 돌려준다. 작업·장소·기인물로 거르고 관련 순으로 세우는 일은 생성 입력
 * 단계(lib/db-harness.ts buildDbHarnessPacket → lib/sif-case-relevance.ts)가 이미 했다. 여기서 다시 거르면
 * 생성이 본 근거와 돌려주는 목록이 어긋나므로, 패킷의 sifCases 순서·relevance·excluded 를 옮겨 적기만 한다.
 */
function sifCasesOf(response: AskResponse): {
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
        source: sifSourceOf(item.source_id, item.source_url),
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
const ROW_PLACEHOLDERS = new Set(["유해·위험요인 확인", "감소대책 현장 확인", "세부작업 확인", "현장 확인"]);
const BLANK_PLACEHOLDER = /^[\s_□()（）:：년월일성명참여해당없음]*$/u;

function headerItemCheck(
  pairs: Array<[string, string]>,
  label: string,
  item: string,
  basis: string
): RiskRecordItemCheck {
  const value = pairs.find(([key]) => key === label)?.[1] ?? "";
  const filled = !BLANK_PLACEHOLDER.test(value);
  return {
    item,
    basis,
    status: filled ? "filled" : "blank",
    note: filled ? `「${label}」 칸에 적혀 있습니다.` : `「${label}」 칸이 빈칸입니다. 현장에서 적습니다.`
  };
}

function rowItemCheck(
  rows: readonly StructuredRiskAssessmentRow[],
  item: string,
  basis: string,
  column: string,
  has: (row: StructuredRiskAssessmentRow) => boolean
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

export function checkRiskRecordItems(
  scenario: AskResponse["scenario"],
  rows: readonly StructuredRiskAssessmentRow[]
): RiskAssessmentToolResult["recordItemsCheck"] {
  const pairs = riskRecordHeaderPairs(scenario);
  // 행 파서(parseStructuredRiskAssessmentRows)가 빈 칸에 넣는 자리표시 문구는 채운 것으로 세지 않는다.
  const text = (value: string | undefined) => {
    const trimmed = value?.trim() ?? "";
    return Boolean(trimmed) && !ROW_PLACEHOLDERS.has(trimmed);
  };
  const items: RiskRecordItemCheck[] = [
    headerItemCheck(pairs, "평가 실시 시기", "위험성평가 실시 시기", "제37조의4제1항제1호"),
    headerItemCheck(pairs, "평가 담당자(성명)", "위험성평가 담당자", "제37조의4제1항제1호"),
    headerItemCheck(pairs, "참여 근로자(성명)", "위험성평가에 참여한 근로자", "제37조의4제1항제2호"),
    headerItemCheck(pairs, "근로자대표 참여", "위험성평가에 참여한 근로자대표", "제37조의4제1항제2호"),
    rowItemCheck(rows, "파악한 유해·위험 요인", "제37조의4제1항제3호·제37조의3제2호", "유해·위험요인", (row) => text(row.hazard)),
    rowItemCheck(rows, "위험성 수준 결정 결과", "제37조의4제1항제3호·제37조의3제2호", "가능성·중대성·위험성",
      (row) => text(row.likelihood) && text(row.severity) && text(row.riskLevel)),
    rowItemCheck(rows, "개선대책 수립 내용", "제37조의4제1항제3호·제37조의3제2호", "감소대책", (row) => text(row.additionalControls)),
    rowItemCheck(rows, "개선대책 이행 결과", "제37조의4제1항제3호·제37조의3제2호", "이행 결과", (row) => text(row.implementationResult))
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

async function renderFile(
  dependencies: Dependencies,
  response: AskResponse,
  format: RiskAssessmentExportFormat
): Promise<NonNullable<RiskAssessmentToolResult["file"]>> {
  const body = buildRiskAssessmentExportBody(response, format);
  let buffer: Buffer;
  let fileName: string;
  if (format === "xlsx") {
    const rendered = await dependencies.renderXlsx(body);
    if (!rendered.ok) throw new Error(rendered.error);
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

export function createGenerateRiskAssessmentHandler(dependencies: Dependencies): GenerateRiskAssessmentHandler {
  return async ({ question, mode, format }, _authContext, execution) => {
    const signal = execution?.signal;
    signal?.throwIfAborted();
    const aiMode = mode ?? dependencies.defaultMode;
    const fileFormat = format ?? "xlsx";
    const response = await dependencies.generateResponse(question, aiMode, signal);
    signal?.throwIfAborted();

    const main = toStructuredRiskRows(response.structured?.riskAssessmentRows ?? []);
    const review = toStructuredRiskRows(response.structured?.riskReviewItems ?? []);
    const sif = sifCasesOf(response);
    const sifCases = sif.cases;
    const hasRows = main.length > 0;

    const result: RiskAssessmentToolResult = {
      engine: "safeclaw-runAsk",
      status: hasRows ? "ok" : "review_required",
      mode: aiMode,
      scenario: response.scenario,
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
        structuredRows: response.structured?.riskAssessmentRows ?? []
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
        structuredRows: response.structured?.riskReviewItems ?? []
      },
      recordItemsCheck: checkRiskRecordItems(response.scenario, main),
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
      result.file = await renderFile(dependencies, response, fileFormat);
    } else {
      result.fileUnavailableReason = response.scenario.taskClassification?.status === "review_required"
        ? `작업 유형을 확인하지 못해 위험성평가 행을 만들지 않았습니다(${response.scenario.taskClassification.reason}). 작업 내용을 더 구체적으로 적어 다시 호출하세요.`
        : "위험성평가 본표 행이 없어 서식 파일을 만들지 않았습니다. 작업 내용을 더 구체적으로 적어 다시 호출하세요.";
    }

    return toToolResult(result);
  };
}
