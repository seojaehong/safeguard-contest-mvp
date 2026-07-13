import { buildPhaseAReviewUiState } from "@/lib/phase-a-review";
import type { AskResponse, IntegrationMode, PhaseAReview } from "@/lib/types";

export type AnswerPanelPublicStatusInput = {
  phaseAReview?: PhaseAReview;
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

export function buildAnswerPanelStatusNotes(data: AnswerPanelPublicStatusInput) {
  const phaseAState = buildPhaseAReviewUiState(data.phaseAReview);
  const notes = [
    `법령 근거: ${phaseAState.authoritative ? publicModeLabel(data.status.lawgo) : phaseAState.directEvidenceLabel}`,
    `기상 신호: ${publicModeLabel(data.status.weather)}`,
    `KOSHA 자료: ${phaseAState.authoritative ? publicModeLabel(data.status.kosha) : phaseAState.directEvidenceLabel}`,
    `후속 교육: ${publicModeLabel(data.status.work24)}`
  ];

  const safetyReference = data.externalData.safetyReference;
  if (safetyReference) {
    notes.push(
      safetyReference.count > 0
        ? `안전지식 DB: ${safetyReference.count.toLocaleString("ko-KR")}건 ${phaseAState.authoritative ? "반영 후보" : "연결 후보"}`
        : `안전지식 DB: ${phaseAState.authoritative ? publicModeLabel(safetyReference.mode) : "검토 필요"}`
    );
  }

  if (data.dbHarness) {
    const summary = data.dbHarness.summary;
    notes.push(phaseAState.authoritative
      ? `DB 하네스: 직접 근거 ${summary.directEvidence}건 · SIF 사례 ${summary.sifCases}건`
      : `DB 하네스: ${phaseAState.directEvidenceLabel} ${summary.directEvidence}건 · SIF 위험 우선순위 후보 ${summary.sifCases}건`);
  }

  if (data.qualityContract) {
    notes.push(`품질 검수: ${phaseAState.authoritative ? data.qualityContract.summary : phaseAState.detail}`);
  }

  return notes;
}
