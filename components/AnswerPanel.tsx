import { AskResponse } from "@/lib/types";

export function AnswerPanel({ data }: { data: AskResponse }) {
  const modeLabel =
    data.mode === "mock" ? "데모 모드" : data.mode === "fallback" ? "Fallback 모드" : "실데이터 모드";

  return (
    <div className="card list">
      <div className="row">
        <div className="h3">AI 답변</div>
        <span className="badge">{modeLabel}</span>
      </div>
      <p className="lead">{data.status.summary}</p>
      <p className="muted small">{data.status.detail}</p>
      <pre>{data.answer}</pre>
      <hr />
      <div className="h3">실무 체크포인트</div>
      <ul>
        {data.practicalPoints.map((p) => <li key={p}>{p}</li>)}
      </ul>
      {data.status.policyNote ? <p className="muted small">{data.status.policyNote}</p> : null}
    </div>
  );
}
