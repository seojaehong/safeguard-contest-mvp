import type { AskResponse, IntegrationMode } from "@/lib/types";

export type AnswerPanelPublicStatusInput = {
  status: Pick<AskResponse["status"], "lawgo" | "weather" | "kosha" | "work24">;
  externalData: {
    safetyReference?: Pick<NonNullable<AskResponse["externalData"]["safetyReference"]>, "mode" | "count">;
  };
  dbHarness?: {
    summary: Pick<NonNullable<AskResponse["dbHarness"]>["summary"], "directEvidence" | "sifCases">;
  };
  qualityContract?: {
    summary: string;
  };
};

const GROUNDING_GROUP_LABELS: Readonly<Record<string, string>> = {
  deliverablesPipeline: "문서 생성 전체",
  riskAssessment: "위험성평가",
  workPlan: "작업계획서",
  workPlanStructured: "작업계획서",
  tbmBriefing: "TBM 브리핑",
  tbmBriefingStructured: "TBM 브리핑",
  tbmLog: "TBM 기록",
  tbmLogStructured: "TBM 기록",
  safetyEducation: "안전보건교육",
  educationRecordStructured: "안전보건교육 기록",
  permitInspection: "안전작업허가",
  structuredRiskRows: "위험성평가 행",
  free: "현장 요약·비상대응",
  foreign: "외국인 근로자 안내",
  tbmRiskLinks: "TBM 위험 연결"
};

const internalOperationalPattern = new RegExp([
  "OPENAI_API_KEY",
  "AI_MODE",
  "fallback",
  "timeout",
  "configured=",
  "Gemini",
  "Vertex",
  "OpenAI 응답",
  "graceful",
  "retry",
  "WORK24_AUTH_KEY",
  "DATA_GO_KR",
  "KOREAN_LAW_MCP",
  "korean-law-mcp",
  "structured rows",
  "TBM-risk"
].join("|"), "i");

function publicModeLabel(mode: IntegrationMode | "unconfigured") {
  if (mode === "live") return "연결됨";
  if (mode === "fallback") return "보조 근거로 표시";
  if (mode === "unconfigured") return "설정 필요";
  return "점검 필요";
}

export function sanitizeAnswerForDisplay(answer: string) {
  const blocks = answer
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block && !internalOperationalPattern.test(block));

  return blocks.length
    ? blocks.join("\n\n")
    : "근거 요약을 준비했습니다. 원문 근거와 현장 조건을 확인해 문서팩에 반영하세요.";
}

export function groundingFieldLabel(path: string): string {
  if (path.includes("workPlanStructured")) return "작업계획서";
  if (path.includes("tbmBriefingStructured")) return "TBM 브리핑";
  if (path.includes("tbmLogStructured")) return "TBM 기록";
  if (path.includes("educationRecordStructured")) return "안전보건교육 기록";
  if (path.includes("stopCriteria")) return "작업중지 기준";
  if (path.includes("firstAid")) return "응급조치";
  if (path.includes("workerConfirmations")) return "작업자 확인사항";
  if (path.includes("keyPoints")) return "교육 핵심내용";
  if (path.includes("completionChecks")) return "작업 완료 확인";
  if (path.includes("riskAssessmentDraft")) return "위험성평가 본문";
  return "안전조치 항목";
}

export function groundingGroupLabel(group: string): string {
  return GROUNDING_GROUP_LABELS[group] || "안전 문서";
}

export function buildAnswerPanelStatusNotes(data: AnswerPanelPublicStatusInput) {
  const notes = [
    `법령 근거: ${publicModeLabel(data.status.lawgo)}`,
    `기상 신호: ${publicModeLabel(data.status.weather)}`,
    `KOSHA 자료: ${publicModeLabel(data.status.kosha)}`,
    `후속 교육: ${publicModeLabel(data.status.work24)}`
  ];

  const safetyReference = data.externalData.safetyReference;
  if (safetyReference) {
    notes.push(
      safetyReference.count > 0
        ? `안전지식 DB: ${safetyReference.count.toLocaleString("ko-KR")}건 반영 후보`
        : `안전지식 DB: ${publicModeLabel(safetyReference.mode)}`
    );
  }

  if (data.dbHarness) {
    const summary = data.dbHarness.summary;
    notes.push(`DB 하네스: 직접 근거 ${summary.directEvidence}건 · SIF 사례 ${summary.sifCases}건`);
  }

  if (data.qualityContract) {
    notes.push(`품질 검수: ${data.qualityContract.summary}`);
  }

  return notes;
}
