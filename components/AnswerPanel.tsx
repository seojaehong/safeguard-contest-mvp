import { AskResponse } from "@/lib/types";

export function AnswerPanel({ data }: { data: AskResponse }) {
  const modeLabel =
    data.mode === "live" ? "근거 연결됨" : data.mode === "fallback" ? "일부 근거 보류" : "연결 점검 필요";

  return (
    <div className="card list">
      <div className="row">
      <div className="h3">문서팩 판단 요약</div>
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
