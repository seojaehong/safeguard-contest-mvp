// MCP generate_risk_assessment — 작업 설명 하나로 위험성평가표(본표 행 + 확인 필요 목록 + SIF 유사사례 +
// 웹 「위험성평가표 편집 → 내보내기」와 같은 서식 파일)를 돌려준다.
//
// 엔진·서식을 새로 만들지 않는다.
// - 생성: 웹 /api/ask 와 같은 runAsk(question, { aiMode }) (주입: generateResponse).
// - 행: runAsk 가 정본화한 structured.riskAssessmentRows / riskReviewItems 그대로. 칸은 riskRecordRowCells(파일 본표와 같은 함수).
// - 파일: 편집기와 같은 요청 본문(buildRiskAssessmentExportBody)을 웹 라우트와 같은 렌더 함수에 넣는다
//   (lib/document-export-xlsx.ts·document-export-hwp.ts, 주입: renderXlsx·renderHwp).
// - SIF: 같은 생성이 쓴 dbHarness.packet.sifCases. 따로 검색하지 않는다(파일과 목록이 어긋나지 않게).
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
  riskRecordRowCells,
  toStructuredRiskRows
} from "@/lib/risk-assessment-record";
import {
  buildRiskAssessmentExportBody,
  RISK_ASSESSMENT_EXPORT_TITLE,
  RISK_ASSESSMENT_FORM_PROFILE,
  type RiskAssessmentExportFormat
} from "@/lib/risk-assessment-export-body";
import type { XlsxDocumentExportRender } from "@/lib/document-export-xlsx";
import type { HwpDocumentExportRender } from "@/lib/document-export-hwp";
import type { AskResponse } from "@/lib/types";

export type GenerateRiskAssessmentInput = {
  question: string;
  mode?: AiMode;
  format?: RiskAssessmentExportFormat;
};

export type RiskAssessmentSifCase = {
  id: string;
  title: string;
  overview: string;
  sourceId: string;
  sourceUrl: string | null;
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
  sif: {
    count: number;
    cases: RiskAssessmentSifCase[];
    reason?: string;
  };
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

function sifCasesOf(response: AskResponse): RiskAssessmentSifCase[] {
  const items = response.dbHarness?.packet?.sifCases ?? [];
  return items.map((item) => ({
    id: item.id,
    title: item.display_title || item.title,
    overview: item.display_summary || item.short_summary || item.summary,
    sourceId: item.source_id,
    sourceUrl: item.source_url ?? null
  }));
}

function sifZeroReason(response: AskResponse, mode: AiMode): string {
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
    const sifCases = sifCasesOf(response);
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
      sif: sifCases.length
        ? { count: sifCases.length, cases: sifCases }
        : { count: 0, cases: [], reason: sifZeroReason(response, aiMode) },
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
