// 위험성평가표 내보내기 요청 본문 — 웹 편집기(components/WorkpackEditor.tsx)가 「Excel 표 양식」「한글 표 양식」을
// 누를 때 /api/export/{xlsx,hwp} 에 보내는 본문을 만든다. 편집기와 MCP 도구(generate_risk_assessment)가 같은 함수를 쓴다.
// MCP 도구는 이 본문을 웹 라우트와 같은 렌더 함수(lib/document-export-*.ts)에 넣는다.
//
// - 양식 설정은 RISK_ASSESSMENT_FORM_PROFILE 하나다. 편집기 getSafetyFormProfile("riskAssessmentDraft") 가 이 값을 쓴다.
// - 정본 행(structured.riskAssessmentRows)이 있으면 xlsx·hwp 는 rows(본문 글 파싱 행)를 쓰지 않으므로 빈 배열로 보낸다.
//   편집기는 이때 gateAskResponseUserOutput 을 지난 정본 행을 보내는데, runAsk 응답은 이미 같은 게이트를 지났고
//   라우트도 gateExportPayload 로 한 번 더 거르므로 값이 같다.
// - 브라우저 번들에도 들어가므로 타입 말고는 가져오지 않는다(scripts/mcp_risk_assessment_live_check.mjs 도 이 파일을 바로 읽는다).
import type { AskResponse } from "@/lib/types";

export const RISK_ASSESSMENT_EXPORT_TITLE = "위험성평가표";

export const RISK_ASSESSMENT_FORM_PROFILE = {
  code: "SC-RISK-01",
  subtitle: "위험성평가 및 감소대책 확인서",
  layout: "risk",
  primaryColumn: "위험요인",
  actionColumn: "감소대책 / 잔여위험",
  confirmationRows: ["위험요인 확인", "감소대책 담당 지정", "작업 전 공유", "잔여위험 승인"],
  approvalLabels: ["작성", "검토", "승인"]
} as const;

export type RiskAssessmentExportFormat = "xlsx" | "hwp";

export type SingleDocumentExportInput<Row, Profile, Scenario, RiskRow, ReviewItem> = {
  format: RiskAssessmentExportFormat;
  edited: boolean;
  title: string;
  rows: Row[];
  profile: Profile;
  scenario: Scenario;
  riskAssessmentRows: RiskRow[] | undefined;
  riskReviewItems?: ReviewItem[] | undefined;
};

/** 편집기의 단일 문서 내보내기 본문(xlsx 는 mode:"single" 이 붙는다). 확인 필요 목록은 있을 때만 싣는다. */
export function buildSingleDocumentExportBody<Row, Profile, Scenario, RiskRow, ReviewItem>(
  input: SingleDocumentExportInput<Row, Profile, Scenario, RiskRow, ReviewItem>
): Record<string, unknown> {
  return {
    ...(input.format === "xlsx" ? { mode: "single" } : {}),
    edited: input.edited,
    title: input.title,
    rows: input.rows,
    profile: input.profile,
    scenario: input.scenario,
    riskAssessmentRows: input.riskAssessmentRows,
    ...(input.riskReviewItems?.length ? { riskReviewItems: input.riskReviewItems } : {})
  };
}

/** 위험성평가 양식 설정 사본(편집기·MCP 가 본문에 싣는 값). */
export function riskAssessmentFormProfile() {
  return {
    ...RISK_ASSESSMENT_FORM_PROFILE,
    confirmationRows: [...RISK_ASSESSMENT_FORM_PROFILE.confirmationRows],
    approvalLabels: [...RISK_ASSESSMENT_FORM_PROFILE.approvalLabels]
  };
}

/** 생성 직후(고치지 않은 상태) 편집기가 보내는 위험성평가 본문. */
export function buildRiskAssessmentExportBody(
  response: AskResponse,
  format: RiskAssessmentExportFormat
): Record<string, unknown> {
  return buildSingleDocumentExportBody({
    format,
    edited: false,
    title: RISK_ASSESSMENT_EXPORT_TITLE,
    rows: [],
    profile: riskAssessmentFormProfile(),
    scenario: response.scenario,
    riskAssessmentRows: response.structured?.riskAssessmentRows,
    riskReviewItems: response.structured?.riskReviewItems
  });
}
