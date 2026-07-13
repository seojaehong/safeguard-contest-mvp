import {
  buildAnswerPanelStatusNotes,
  sanitizeAnswerForDisplay
} from "@/lib/answer-panel-display";
import { buildPhaseAReviewUiState } from "@/lib/phase-a-review";
import type { AskResponse } from "@/lib/types";

export function AnswerPanel({ data }: { data: AskResponse }) {
  const phaseAState = buildPhaseAReviewUiState(data.phaseAReview);
  const modeLabel = phaseAState.authoritative
    ? data.mode === "live"
      ? phaseAState.connectionLabel
      : data.mode === "fallback"
        ? "일부 근거 보류"
        : "연결 점검 필요"
    : phaseAState.connectionLabel;
  const statusNotes = buildAnswerPanelStatusNotes(data);
  const answerForDisplay = sanitizeAnswerForDisplay(data.answer);
  const statusSummary = phaseAState.authoritative ? data.status.summary : `${phaseAState.connectionLabel}: ${phaseAState.detail}`;

  return (
    <div className="card list">
      <div className="row">
        <h2 className="h3">문서팩 판단 요약</h2>
        <span className="badge">{modeLabel}</span>
      </div>
      <p className="lead">{statusSummary}</p>
      <ul className="answer-status-notes">
        {statusNotes.map((note) => <li key={note}>{note}</li>)}
      </ul>
      <pre>{answerForDisplay}</pre>
      <hr />
      <h2 className="h3">실무 체크포인트</h2>
      <ul>
        {data.practicalPoints.map((p) => <li key={p}>{p}</li>)}
      </ul>
      <p className="muted small">
        {phaseAState.authoritative
          ? "출력물은 현장 조건 확인 후 문서팩에 반영하세요."
          : "출력물은 Phase A 근거 및 현장 조건 확인 후 문서팩에 반영하세요."}
      </p>
    </div>
  );
}
