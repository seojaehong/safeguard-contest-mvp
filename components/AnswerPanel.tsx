import { AskResponse } from "@/lib/types";

export function AnswerPanel({ data }: { data: AskResponse }) {
  return (
    <div className="card list">
      <div className="row">
        <div className="h3">AI 답변</div>
        <span className="badge">{data.mode === "mock" ? "데모 모드" : "실데이터 모드"}</span>
      </div>
      <pre>{data.answer}</pre>
      <hr />
      <div className="h3">실무 체크포인트</div>
      <ul>
        {data.practicalPoints.map((p) => <li key={p}>{p}</li>)}
      </ul>
    </div>
  );
}
