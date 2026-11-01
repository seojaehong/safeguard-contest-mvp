// 위험성평가표 내보내기 요청 본문 — 웹 편집기(components/WorkpackEditor.tsx)가 생성 직후(고치지 않은 상태)
// 「Excel 표 양식」「한글 표 양식」을 누를 때 /api/export/{xlsx,hwp} 에 보내는 본문과 같은 값을 만든다.
// MCP 도구(generate_risk_assessment)가 이 본문을 웹 라우트와 같은 렌더 함수(lib/document-export-*.ts)에 넣는다.
//
// - 양식 설정은 편집기 getSafetyFormProfile("riskAssessmentDraft") 와 같아야 한다(tests/mcp-risk-assessment.test.ts 가
//   편집기 원문과 대조한다).
// - 정본 행(structured.riskAssessmentRows)이 있으면 xlsx·hwp 는 rows(본문 글 파싱 행)를 쓰지 않으므로 빈 배열로 보낸다.
//   편집기는 이때 gateAskResponseUserOutput 을 지난 정본 행을 보내는데, runAsk 응답은 이미 같은 게이트를 지났고
//   라우트도 gateExportPayload 로 한 번 더 거르므로 값이 같다.
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

export function buildRiskAssessmentExportBody(
  response: AskResponse,
  format: RiskAssessmentExportFormat
): Record<string, unknown> {
  const reviewItems = response.structured?.riskReviewItems;
  return {
    ...(format === "xlsx" ? { mode: "single" } : {}),
    edited: false,
    title: RISK_ASSESSMENT_EXPORT_TITLE,
    rows: [],
    profile: {
      ...RISK_ASSESSMENT_FORM_PROFILE,
      confirmationRows: [...RISK_ASSESSMENT_FORM_PROFILE.confirmationRows],
      approvalLabels: [...RISK_ASSESSMENT_FORM_PROFILE.approvalLabels]
    },
    scenario: response.scenario,
    riskAssessmentRows: response.structured?.riskAssessmentRows,
    ...(reviewItems?.length ? { riskReviewItems: reviewItems } : {})
  };
}
