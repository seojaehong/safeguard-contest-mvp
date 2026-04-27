"use client";

import { useMemo, useState } from "react";
import { AskResponse } from "@/lib/types";

type Channel = "email" | "sms" | "kakao" | "band";

type DispatchResult = {
  ok: boolean;
  configured: boolean;
  message: string;
  workflowRunId?: string;
  providerStatus?: string;
};

const channelOptions: Array<{ key: Channel; label: string; helper: string }> = [
  { key: "email", label: "메일", helper: "관리자·원청 보고" },
  { key: "sms", label: "문자", helper: "작업자 즉시 공지" },
  { key: "kakao", label: "카카오", helper: "채널/알림톡 연동" },
  { key: "band", label: "밴드", helper: "현장 팀 게시" }
];

function splitRecipients(value: string) {
  return value
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildBriefPayload(data: AskResponse) {
  return {
    companyName: data.scenario.companyName,
    siteName: data.scenario.siteName,
    workSummary: data.scenario.workSummary,
    riskLevel: data.riskSummary.riskLevel,
    topRisk: data.riskSummary.topRisk,
    immediateActions: data.riskSummary.immediateActions,
    message: data.deliverables.kakaoMessage,
    documents: {
      riskAssessmentDraft: data.deliverables.riskAssessmentDraft,
      tbmBriefing: data.deliverables.tbmBriefing,
      tbmLogDraft: data.deliverables.tbmLogDraft,
      safetyEducationRecordDraft: data.deliverables.safetyEducationRecordDraft,
      foreignWorkerBriefing: data.deliverables.foreignWorkerBriefing,
      foreignWorkerTransmission: data.deliverables.foreignWorkerTransmission
    },
    evidence: {
      citations: data.citations.slice(0, 5),
      weather: data.externalData.weather,
      training: data.externalData.training.recommendations.slice(0, 3),
      kosha: data.externalData.kosha.references.slice(0, 3),
      accidentCases: data.externalData.accidentCases.cases.slice(0, 3)
    },
    status: data.status
  };
}

export function WorkflowSharePanel({ data }: { data: AskResponse }) {
  const [selectedChannels, setSelectedChannels] = useState<Channel[]>(["email"]);
  const [recipients, setRecipients] = useState("");
  const [note, setNote] = useState("작업 전 TBM에서 공유하고, 교육 확인 서명까지 받은 뒤 보관해 주세요.");
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<DispatchResult | null>(null);

  const recipientList = useMemo(() => splitRecipients(recipients), [recipients]);

  function toggleChannel(channel: Channel) {
    setSelectedChannels((current) => (
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel]
    ));
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(data.deliverables.kakaoMessage);
      setResult({
        ok: true,
        configured: true,
        message: "공유 메시지를 클립보드에 복사했습니다."
      });
    } catch (error) {
      console.error("field message copy failed", error);
      setResult({
        ok: false,
        configured: true,
        message: "클립보드 복사에 실패했습니다. 아래 메시지를 직접 선택해 복사해 주세요."
      });
    }
  }

  async function dispatchWorkflow() {
    setIsSending(true);
    setResult(null);
    try {
      const response = await fetch("/api/workflow/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channels: selectedChannels,
          recipients: recipientList,
          operatorNote: note,
          workpack: buildBriefPayload(data)
        })
      });
      const payload = await response.json() as DispatchResult;
      setResult(payload);
    } catch (error) {
      console.error("workflow dispatch request failed", error);
      setResult({
        ok: false,
        configured: true,
        message: "전파 요청 중 오류가 발생했습니다. n8n 서버 또는 네트워크 상태를 확인해 주세요."
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <article className="share-panel workflow-panel">
      <div className="compact-head">
        <span className="eyebrow">Send</span>
        <strong>현장 전파</strong>
      </div>
      <p className="muted">
        Oracle n8n 웹훅을 연결하면 지금 보이는 문서팩을 메일, 문자, 카카오, 밴드로 자동 전송합니다.
      </p>

      <div className="channel-grid" aria-label="전파 채널 선택">
        {channelOptions.map((channel) => (
          <button
            key={channel.key}
            type="button"
            className={`channel-card ${selectedChannels.includes(channel.key) ? "active" : ""}`}
            onClick={() => toggleChannel(channel.key)}
          >
            <strong>{channel.label}</strong>
            <span>{channel.helper}</span>
          </button>
        ))}
      </div>

      <label className="field-label" htmlFor="workflow-recipients">받는 사람</label>
      <textarea
        id="workflow-recipients"
        className="textarea workflow-textarea"
        value={recipients}
        onChange={(event) => setRecipients(event.target.value)}
        placeholder="메일, 전화번호, 카카오/밴드 대상 식별자를 줄바꿈 또는 쉼표로 입력"
      />

      <label className="field-label" htmlFor="workflow-note">전달 메모</label>
      <input
        id="workflow-note"
        className="input"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      <div className="command-actions">
        <button
          type="button"
          className="button"
          onClick={dispatchWorkflow}
          disabled={isSending || selectedChannels.length === 0}
        >
          {isSending ? "전파 요청 중" : "자동 전파"}
        </button>
        <button type="button" className="button secondary" onClick={copyMessage}>메시지 복사</button>
      </div>

      {result ? (
        <p className={result.ok ? "workflow-result ok" : "workflow-result error"}>
          {result.message}
          {result.workflowRunId ? ` 실행 ID: ${result.workflowRunId}` : ""}
        </p>
      ) : null}

      <pre>{data.deliverables.kakaoMessage}</pre>
    </article>
  );
}
