// 위험성평가 정본(structured.riskAssessmentRows) 하나에서 모든 출력물을 그리기 위한 공용 모듈.
// - 시행규칙 제37조의4(원문 확인 2026-10-25) 기록사항 칸: 실시 시기·담당자, 참여 근로자·근로자대표,
//   유해·위험요인, 위험성 수준 결정 결과, 개선대책 수립 내용·이행 결과(제37조의3제2호). 3년 보존.
// - 모르는 값은 빈칸으로 둔다. 참여자·참여 사실을 고정 문구로 채우지 않는다(RA-03).
// - 「검토 필요:」 자리표시 행은 본표에서 빼고 별도 확인 목록으로 보낸다(RA-11).
import type { AskResponse, TbmRiskLink } from "@/lib/types";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";
import { validateRiskAssessmentRows } from "@/lib/risk-assessment-schema";
import { evidenceRefsForDisplay } from "@/lib/document-display-labels";
import { gateUserOutputCell } from "@/lib/user-output-gate";
import { serializeRiskAssessmentRowsToDraft } from "@/components/workpack-editor-structure";
import {
  parseStructuredRiskAssessmentRows,
  type StructuredRiskAssessmentRow
} from "@/lib/risk-assessment-renderer";
import {
  accidentTypeLabel,
  RISK_RETENTION_NOTE,
  RISK_SCALE_LINES,
  riskLevelLabel,
  summarizeRiskLevel
} from "@/lib/risk-labels";

const REVIEW_PLACEHOLDER_PATTERN = /^\s*검토\s*필요\s*[:：]/u;

export function isRiskReviewPlaceholderRow(row: { hazard?: string }): boolean {
  return REVIEW_PLACEHOLDER_PATTERN.test(row.hazard || "");
}

export function splitRiskRowsForOutput<T extends { hazard?: string }>(rows: readonly T[]): { main: T[]; review: T[] } {
  const main: T[] = [];
  const review: T[] = [];
  rows.forEach((row) => (isRiskReviewPlaceholderRow(row) ? review : main).push(row));
  return { main, review };
}

// 장비 칸에 들어가면 안 되는 값: 사고사례 원천 분류(「518, 제조업」「아카이브(건설업)」)와 근거 없는 상투 문구.
const INTERNAL_EQUIPMENT_PATTERNS = [
  /^\s*\d+\s*[,·]/u,
  /아카이브\s*\(/u,
  /^(작업 장비·공구·보호구|현장 장비 및 보호구|장비·도구 확인)$/u
];

export function displayEquipment(value: string | undefined): string {
  const text = value?.trim() || "";
  if (!text) return "";
  return INTERNAL_EQUIPMENT_PATTERNS.some((pattern) => pattern.test(text)) ? "" : text;
}

// 근거 칸에서 내부 검색 표지·원천 분류·문서 키를 걸러 낸다(EXP-07).
const INTERNAL_EVIDENCE_PATTERNS = [
  /^검색\s*:/u,
  /^(DB 하네스|고정 근거)\s*(직접|보조)근거$/u,
  /^아카이브\s*\(/u,
  /^\d+\s*·/u,
  /^safety_reference_items$/u,
  /^(sif-case|kosha|law|riskAssessmentDraft|tbmBriefing|tbmLogDraft|workPlanDraft)$/u
];

export function displayEvidenceRefs(refs: readonly string[] | undefined): string[] {
  // PR-14 사전(문서 키 → 문서명, 내부 출처 표지 제거)을 먼저 거친 뒤 위험성평가 칸에 맞지 않는 원천 분류를 더 거른다.
  return evidenceRefsForDisplay(refs)
    .filter((ref) => !INTERNAL_EVIDENCE_PATTERNS.some((pattern) => pattern.test(ref)));
}

/** 머리 기록란. 평가 대상 외에는 전부 빈칸 또는 선택 상자다. */
export function riskRecordHeaderPairs(scenario: Pick<AskResponse["scenario"], "workSummary">): Array<[string, string]> {
  return [
    ["평가 대상 공정·작업", scenario.workSummary || ""],
    ["평가 실시 시기", "____년 ____월 ____일"],
    ["평가 담당자(성명)", ""],
    ["참여 근로자(성명)", ""],
    ["근로자대표 참여", "□ 참여(성명: __________)  □ 해당 없음"],
    ["참여 방법", "□ 사업장 순회 점검  □ 설문조사  □ 면담  □ 기타"]
  ];
}

export const RISK_RECORD_ROW_HEADERS = [
  "번호",
  "세부작업",
  "유해·위험요인",
  "재해유형",
  "현재 안전조치",
  "가능성",
  "중대성",
  "위험성",
  "감소대책",
  "담당자",
  "조치기한",
  "이행 결과",
  "잔여 위험성"
] as const;

export const RISK_APPROVAL_LABELS = ["작성", "검토", "승인"] as const;

export const RISK_REVIEW_LIST_TITLE = "확인 필요 목록(본표에 넣지 않음)";
export const RISK_REVIEW_LIST_NOTE = "아래 항목은 원인이나 현장 위험요인이 확정되지 않은 참고자료입니다. 현장에서 확인한 뒤 해당하면 본표에 행으로 옮겨 적습니다.";

export function toStructuredRiskRows(rows: readonly unknown[]): StructuredRiskAssessmentRow[] {
  return parseStructuredRiskAssessmentRows(rows as unknown[]);
}

/**
 * 내보내기 요청 본문에서 정본 행과 확인 필요 목록을 나눈다.
 * 예전 화면이 「검토 필요:」 행을 정본 행에 섞어 보내도 본표에는 싣지 않는다.
 */
export function resolveRiskExportRows(
  rows: readonly StructuredRiskAssessmentRow[],
  body: Record<string, unknown>
): { main: StructuredRiskAssessmentRow[]; review: StructuredRiskAssessmentRow[] } {
  const record = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const structured = record(body.structured);
  const responseStructured = record(record(body.response).structured);
  const explicitReview = [body.riskReviewItems, structured.riskReviewItems, responseStructured.riskReviewItems]
    .map((candidate) => parseStructuredRiskAssessmentRows(candidate))
    .find((parsed) => parsed.length) || [];
  const { main, review } = splitRiskRowsForOutput(rows);
  return { main, review: [...explicitReview, ...review] };
}

function residualLabel(row: StructuredRiskAssessmentRow): string {
  return riskLevelLabel(row.residualRiskLevel);
}

/** 본표 한 행을 출력 칸 순서대로 만든다. 행 값을 그대로 쓰고 모르는 값은 빈칸이다. */
export function riskRecordRowCells(row: StructuredRiskAssessmentRow, index: number): string[] {
  // 글 칸은 PR-14 출력 게이트를 한 번 더 거친다(편집기 인쇄처럼 서버 게이트를 거치지 않는 경로).
  return [
    String(index + 1),
    gateUserOutputCell(row.unitTask || ""),
    gateUserOutputCell(row.hazard || ""),
    accidentTypeLabel(row.accidentType),
    gateUserOutputCell(row.currentControls || ""),
    row.likelihood || "",
    row.severity || "",
    riskLevelLabel(row.riskLevel),
    gateUserOutputCell(row.additionalControls || ""),
    row.owner || "",
    row.dueDate || row.due || "",
    row.implementationResult || "",
    residualLabel(row)
  ];
}

function escapeRecordHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 인쇄·Word·JPG(편집 화면)와 서버 인쇄본(pdf html)이 같이 쓰는 위험성평가 기록 본문.
 * 행 값을 그대로 싣는다 — 키워드로 행을 고르거나 등급을 고정값으로 쓰지 않는다(COPY-01, D-4·D-7).
 * section(title, inner) 은 출력물마다 다른 절 껍데기(제목 태그·클래스)를 만든다.
 */
export function buildRiskAssessmentRecordHtml(args: {
  rows: readonly StructuredRiskAssessmentRow[];
  reviewRows?: readonly StructuredRiskAssessmentRow[];
  scenario: Pick<AskResponse["scenario"], "workSummary">;
  section: (title: string, inner: string) => string;
  tableClass?: string;
  metaTableClass?: string;
  /** 정본 행이 없을 때(본문을 직접 고친 경우) 3절 표 대신 싣는 본문. 편집한 행을 고르지 않고 전부 싣는다. */
  editedBodyHtml?: string;
}): string {
  const esc = escapeRecordHtml;
  const tableClass = args.tableClass ? ` class="${args.tableClass}"` : "";
  const metaClass = args.metaTableClass ? ` class="${args.metaTableClass}"` : "";
  const header = riskRecordHeaderPairs(args.scenario);
  const headerRows: string[] = [];
  for (let index = 0; index < header.length; index += 2) {
    const [leftLabel, leftValue] = header[index];
    const right = header[index + 1];
    headerRows.push(`<tr><th>${esc(leftLabel)}</th><td>${esc(leftValue)}</td>${right ? `<th>${esc(right[0])}</th><td>${esc(right[1])}</td>` : "<th></th><td></td>"}</tr>`);
  }
  const scale = RISK_SCALE_LINES.map((line) => `<li>${esc(line)}</li>`).join("");
  const body = args.rows.length
    ? args.rows.map((row, index) => `<tr data-risk-row="${index + 1}">${riskRecordRowCells(row, index).map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${RISK_RECORD_ROW_HEADERS.length}">평가표 행이 없습니다. 현장에서 유해·위험요인을 파악해 적습니다.</td></tr>`;
  const review = args.reviewRows?.length
    ? args.section(
        RISK_REVIEW_LIST_TITLE,
        `<p>${esc(RISK_REVIEW_LIST_NOTE)}</p><table${tableClass}><thead><tr><th>번호</th><th>확인할 내용</th><th>참고자료</th></tr></thead><tbody>${args.reviewRows.map((row, index) => `<tr><td>${index + 1}</td><td>${esc(row.hazard)}</td><td>${esc(displayEvidenceRefs(row.evidenceRefs).join(" / "))}</td></tr>`).join("")}</tbody></table>`
      )
    : "";
  const approval = `<table${metaClass}><tbody><tr>${RISK_APPROVAL_LABELS.map((label) => `<th>${esc(label)}</th><td>성명/서명:</td>`).join("")}</tr></tbody></table><p>${esc(RISK_RETENTION_NOTE)}</p>`;
  return [
    args.section("1. 평가 기록(시행규칙 제37조의4)", `<table${metaClass}><tbody>${headerRows.join("")}</tbody></table>`),
    args.section("2. 위험성 결정 기준", `<ul>${scale}</ul>`),
    args.section(
      "3. 유해·위험요인 파악·위험성 결정·감소대책",
      !args.rows.length && args.editedBodyHtml
        ? args.editedBodyHtml
        : `<table${tableClass}><thead><tr>${RISK_RECORD_ROW_HEADERS.map((label) => `<th>${esc(label)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`
    ),
    review,
    args.section("4. 확인 및 결재", approval)
  ].join("");
}

/** 정본화 전 행 번호 → 본표 행 번호. 본표에서 빠진 행은 대응표에 없다. */
function buildRiskRowIndexMap(rows: readonly RiskAssessmentRow[], main: readonly RiskAssessmentRow[]): Map<number, number> {
  const nextIndex = new Map<number, number>();
  rows.forEach((row, index) => {
    const mainIndex = main.indexOf(row);
    if (mainIndex >= 0) nextIndex.set(index, mainIndex);
  });
  return nextIndex;
}

function remapTbmRiskLinks(links: readonly TbmRiskLink[] | undefined, nextIndex: Map<number, number>): TbmRiskLink[] | undefined {
  if (!links) return undefined;
  return links.flatMap((link) => {
    const mapped = nextIndex.get(link.riskRowIndex);
    return mapped === undefined ? [] : [{ ...link, riskRowIndex: mapped }];
  });
}

/** 번호 하나를 본표 번호로 바꾼다. 빠진 행을 가리키면 칸을 지운다(「연결 위험 확인」으로 나간다). */
function remapSingleRiskRef<T extends { relatedRiskRowIndex?: number }>(item: T, nextIndex: Map<number, number>): T {
  if (typeof item.relatedRiskRowIndex !== "number") return item;
  const mapped = nextIndex.get(item.relatedRiskRowIndex);
  if (mapped === item.relatedRiskRowIndex) return item;
  if (mapped !== undefined) return { ...item, relatedRiskRowIndex: mapped };
  const rest = { ...item };
  delete rest.relatedRiskRowIndex;
  return rest;
}

/**
 * 작업계획서·허가서·TBM 일지 구조화본의 위험성평가 행 번호는 정본화 전 행 순서로 매겨져 있다(lib/search.ts
 * linkWorkPlanToRiskRows·linkPermitToRiskRows·buildTbmLogStructuredFromRiskRows). 본표에서 「검토 필요:」 행을
 * 빼면 같은 대응표로 다시 매긴다(PR109-B1).
 */
function remapLinkedDocumentRiskRefs(
  deliverables: AskResponse["deliverables"],
  nextIndex: Map<number, number>
): AskResponse["deliverables"] {
  const { workPlanStructured, permitInspectionStructured, tbmLogStructured } = deliverables;
  return {
    ...deliverables,
    ...(workPlanStructured?.workSteps
      ? {
          workPlanStructured: {
            ...workPlanStructured,
            workSteps: workPlanStructured.workSteps.map((step) => {
              if (!Array.isArray(step.relatedRiskRowIndex)) return step;
              const mapped = step.relatedRiskRowIndex.flatMap((ref) => {
                const next = nextIndex.get(ref);
                return next === undefined ? [] : [next];
              });
              return { ...step, relatedRiskRowIndex: [...new Set(mapped)] };
            })
          }
        }
      : {}),
    ...(permitInspectionStructured?.conditions
      ? {
          permitInspectionStructured: {
            ...permitInspectionStructured,
            conditions: permitInspectionStructured.conditions.map((condition) => remapSingleRiskRef(condition, nextIndex))
          }
        }
      : {}),
    ...(tbmLogStructured?.hazardsDiscussed
      ? {
          tbmLogStructured: {
            ...tbmLogStructured,
            hazardsDiscussed: tbmLogStructured.hazardsDiscussed.map((hazard) => remapSingleRiskRef(hazard, nextIndex))
          }
        }
      : {})
  };
}

// DB 하네스가 초안 맨 앞에 붙이는 「오늘 개선·이력 반영」 단락(사진 분석·개선 이력)은 표가 아니므로
// 정본 직렬화 앞에 그대로 둔다. 그 밖의 생성 문안(키워드가 다른 별도 표)은 정본 직렬화로 바꾼다.
const HARNESS_REFLECTION_HEADING = "[오늘 개선·이력 반영 - 위험성평가]";

function withHarnessReflection(previousDraft: string | undefined, serialized: string): string {
  const text = (previousDraft || "").trim();
  if (!text.startsWith(HARNESS_REFLECTION_HEADING)) return serialized;
  const end = text.search(/\r?\n\r?\n/u);
  if (end < 0) return serialized;
  return `${text.slice(0, end)}\n\n${serialized}`;
}

/**
 * 정본 행의 장비 칸에 들어온 사고사례 원천 분류(「518, 제조업」「아카이브(…)」)를 빈칸으로 바꾸고,
 * 판단근거 문장에 같은 값이 끼어 있으면 「장비」로 바꾼다(COPY-07). 다른 칸은 손대지 않는다.
 */
function cleanCanonicalRiskRow(row: RiskAssessmentRow): RiskAssessmentRow {
  const raw = row.equipment?.trim() || "";
  const equipment = displayEquipment(raw);
  if (!raw || equipment === raw) return row;
  return {
    ...row,
    equipment,
    whyLikelihood: row.whyLikelihood.split(raw).join("장비"),
    whySeverity: row.whySeverity.split(raw).join("장비")
  };
}

/**
 * 응답의 위험성평가를 정본 행 하나로 맞춘다.
 * - 「검토 필요:」 행은 structured.riskReviewItems 로 옮긴다.
 * - 화면 초안(deliverables.riskAssessmentDraft)은 정본 행을 직렬화한 글로 바꾼다(키워드 재파싱 없음).
 * - 요약 위험수준은 본표 최고 등급으로 맞춘다.
 * 정본 행이 없으면(작업 유형 보류 등) 손대지 않는다.
 */
export function canonicalizeRiskAssessmentResponse(response: AskResponse): AskResponse {
  const structured = response.structured;
  const rows = structured?.riskAssessmentRows || [];
  if (!structured || !rows.length) return response;
  const { main: rawMain, review } = splitRiskRowsForOutput(rows);
  const main = rawMain.map(cleanCanonicalRiskRow);
  const reviewItems = [...(structured.riskReviewItems || []), ...review];
  const validation = validateRiskAssessmentRows(main);
  const summaryLevel = summarizeRiskLevel(main);
  const nextIndex = buildRiskRowIndexMap(rows, rawMain);
  const linkedDeliverables = remapLinkedDocumentRiskRefs(response.deliverables, nextIndex);
  return {
    ...response,
    riskSummary: summaryLevel
      ? { ...response.riskSummary, riskLevel: summaryLevel }
      : response.riskSummary,
    deliverables: main.length
      ? { ...linkedDeliverables, riskAssessmentDraft: withHarnessReflection(response.deliverables.riskAssessmentDraft, serializeRiskAssessmentRowsToDraft(main)) }
      : linkedDeliverables,
    structured: {
      ...structured,
      riskAssessmentRows: main,
      ...(reviewItems.length ? { riskReviewItems: reviewItems } : {}),
      ...(structured.tbmRiskLinks ? { tbmRiskLinks: remapTbmRiskLinks(structured.tbmRiskLinks, nextIndex) } : {}),
      riskAssessmentValidation: {
        ok: main.length > 0 && validation.issues.length === 0,
        issueCount: validation.issues.length,
        issues: validation.issues
      }
    }
  };
}
