import {
  buildAnswerPanelStatusNotes,
  sanitizeAnswerForDisplay
} from "@/lib/answer-panel-display";
import type { AskResponse } from "@/lib/types";

const GROUNDING_GROUP_LABELS: Readonly<Record<string, string>> = {
  deliverablesPipeline: "문서 생성 전체",
  riskAssessment: "위험성평가",
  workPlan: "작업계획서",
  tbmBriefing: "TBM 브리핑",
  tbmLog: "TBM 기록",
  safetyEducation: "안전보건교육",
  permitInspection: "안전작업허가",
  structuredRiskRows: "위험성평가 행",
  free: "현장 요약·비상대응",
  foreign: "외국인 근로자 안내",
  tbmRiskLinks: "TBM 위험 연결"
};

const GROUNDING_ISSUE_LABELS: Readonly<Record<string, string>> = {
  unknown_reference: "승인되지 않은 근거가 포함됨",
  control_provenance_missing: "조치의 연결 근거가 없음",
  control_claim_not_in_packet: "근거팩에 없는 조치가 포함됨"
};

function groundingGroupLabel(group: string): string {
  return GROUNDING_GROUP_LABELS[group] || "안전 문서";
}

function groundingFieldLabel(path: string): string {
  if (path.includes("stopCriteria")) return "작업중지 기준";
  if (path.includes("firstAid")) return "응급조치";
  if (path.includes("workerConfirmations")) return "작업자 확인사항";
  if (path.includes("keyPoints")) return "교육 핵심내용";
  if (path.includes("completionChecks")) return "작업 완료 확인";
  if (path.includes("riskAssessmentDraft")) return "위험성평가 본문";
  return "안전조치 항목";
}

export function AnswerPanel({ data }: { data: AskResponse }) {
  const modeLabel =
    data.mode === "live" ? "근거 연결됨" : data.mode === "fallback" ? "일부 근거 보류" : "연결 점검 필요";
  const statusNotes = buildAnswerPanelStatusNotes(data);
  const answerForDisplay = sanitizeAnswerForDisplay(data.answer);

  return (
    <div className="card list">
      <div className="row">
        <h2 className="h3">문서팩 판단 요약</h2>
        <span className="badge">{modeLabel}</span>
      </div>
      <p className="lead">{data.status.summary}</p>
      <ul className="answer-status-notes">
        {statusNotes.map((note) => <li key={note}>{note}</li>)}
      </ul>
      {data.groundingReview ? (
        <section aria-label="근거 생성 검토">
          <h3 className="h3">근거 생성 검토 필요</h3>
          <p className="muted small">근거 식별자 <code>{data.groundingReview.sourceIdentity}</code></p>
          {data.groundingReview.rejectedGroups.length ? (
            <p>다시 확인할 문서: {data.groundingReview.rejectedGroups.map(groundingGroupLabel).join(", ")}</p>
          ) : null}
          {data.groundingReview.violations.length ? (
            <ul aria-label="근거 검토 항목">
              {data.groundingReview.violations.map((violation, index) => (
                <li key={`${violation.group}-${violation.path}-${index}`}>
                  {groundingGroupLabel(violation.group)} · {groundingFieldLabel(violation.path)} · {GROUNDING_ISSUE_LABELS[violation.code]}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="muted small">승인된 조치 후보</p>
          <ul>
            {data.groundingReview.criticalControls.map((control) => <li key={control}>{control}</li>)}
          </ul>
        </section>
      ) : null}
      <pre>{answerForDisplay}</pre>
      <hr />
      <h2 className="h3">실무 체크포인트</h2>
      <ul>
        {data.practicalPoints.map((p) => <li key={p}>{p}</li>)}
      </ul>
      <p className="muted small">출력물은 현장 조건 확인 후 문서팩에 반영하세요.</p>
    </div>
  );
}
