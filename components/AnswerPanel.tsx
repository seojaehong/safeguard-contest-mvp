import {
  buildAnswerPanelStatusNotes,
  sanitizeAnswerForDisplay
} from "@/lib/answer-panel-display";
import type { AskResponse } from "@/lib/types";

export function AnswerPanel({ data }: { data: AskResponse }) {
  const modeLabel =
    data.mode === "live" ? "근거 연결됨" : data.mode === "fallback" ? "일부 근거 보류" : "연결 점검 필요";
  const statusNotes = buildAnswerPanelStatusNotes(data);
  const answerForDisplay = sanitizeAnswerForDisplay(data.answer);

  return (
    <div className="card list">
      <div className="row">
      <div className="h3">문서팩 판단 요약</div>
        <span className="badge">{modeLabel}</span>
      </div>
      <p className="lead">{data.status.summary}</p>
      <ul className="answer-status-notes">
        {statusNotes.map((note) => <li key={note}>{note}</li>)}
      </ul>
      <pre>{answerForDisplay}</pre>
      <hr />
      <div className="h3">실무 체크포인트</div>
      <ul>
        {data.practicalPoints.map((p) => <li key={p}>{p}</li>)}
      </ul>
      <p className="muted small">출력물은 현장 조건 확인 후 문서팩에 반영하세요.</p>
    </div>
  );
}
