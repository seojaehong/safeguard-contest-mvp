"use client";

import { useMemo, useState } from "react";
import { AskResponse } from "@/lib/types";

type Channel = "email" | "sms" | "kakao" | "band";
type MessageTarget = "manager" | `foreign:${string}`;

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

function buildForeignLanguageMessage(data: AskResponse, languageCode: string) {
  const language = data.deliverables.foreignWorkerLanguages.find((item) => item.code === languageCode);
  if (!language) return data.deliverables.foreignWorkerTransmission;

  return [
    `[SafeGuard ${language.label} 안전공지] ${data.scenario.companyName}`,
    `현장: ${data.scenario.siteName}`,
    `작업: ${data.scenario.workSummary}`,
    `핵심 위험: ${data.riskSummary.topRisk}`,
    "",
    `${language.label}(${language.nativeLabel})`,
    ...language.lines.map((line) => `- ${line}`),
    "",
    "관리자 확인: 현장 통역 또는 해당 언어 가능자 확인 후 전송하세요."
  ].join("\n");
}

function splitRecipients(value: string) {
  return value
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildBriefPayload(data: AskResponse, selectedMessage: string, selectedTarget: MessageTarget) {
  const selectedLanguageCode = selectedTarget.startsWith("foreign:") ? selectedTarget.replace("foreign:", "") : "";
  const selectedLanguage = selectedLanguageCode
    ? data.deliverables.foreignWorkerLanguages.find((item) => item.code === selectedLanguageCode)
    : undefined;

  return {
    companyName: data.scenario.companyName,
    siteName: data.scenario.siteName,
    workSummary: data.scenario.workSummary,
    riskLevel: data.riskSummary.riskLevel,
    topRisk: data.riskSummary.topRisk,
    immediateActions: data.riskSummary.immediateActions,
    message: selectedMessage,
    messageTarget: selectedLanguage ? "foreign-worker" : "manager",
    messageLanguage: selectedLanguage ? {
      code: selectedLanguage.code,
      label: selectedLanguage.label,
      nativeLabel: selectedLanguage.nativeLabel
    } : {
      code: "ko",
      label: "한국어",
      nativeLabel: "한국어"
    },
    documents: {
      workpackSummaryDraft: data.deliverables.workpackSummaryDraft,
      riskAssessmentDraft: data.deliverables.riskAssessmentDraft,
      workPlanDraft: data.deliverables.workPlanDraft,
      tbmBriefing: data.deliverables.tbmBriefing,
      tbmLogDraft: data.deliverables.tbmLogDraft,
      safetyEducationRecordDraft: data.deliverables.safetyEducationRecordDraft,
      emergencyResponseDraft: data.deliverables.emergencyResponseDraft,
      photoEvidenceDraft: data.deliverables.photoEvidenceDraft,
      foreignWorkerBriefing: data.deliverables.foreignWorkerBriefing,
      foreignWorkerTransmission: data.deliverables.foreignWorkerTransmission,
      foreignWorkerLanguages: data.deliverables.foreignWorkerLanguages
    },
    evidence: {
      citations: data.citations.slice(0, 5),
      weather: data.externalData.weather,
      training: data.externalData.training.recommendations.slice(0, 3),
      koshaEducation: data.externalData.koshaEducation.recommendations.slice(0, 3),
      kosha: data.externalData.kosha.references.slice(0, 3),
      accidentCases: data.externalData.accidentCases.cases.slice(0, 3)
    },
    status: data.status
  };
}

export function WorkflowSharePanel({ data }: { data: AskResponse }) {
  const [selectedChannels, setSelectedChannels] = useState<Channel[]>(["email"]);
  const [selectedMessageTarget, setSelectedMessageTarget] = useState<MessageTarget>("manager");
  const [recipients, setRecipients] = useState("");
  const [note, setNote] = useState("작업 전 TBM에서 공유하고, 교육 확인 서명까지 받은 뒤 보관해 주세요.");
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<DispatchResult | null>(null);

  const recipientList = useMemo(() => splitRecipients(recipients), [recipients]);
  const selectedMessage = useMemo(() => {
    if (selectedMessageTarget === "manager") {
      return data.deliverables.kakaoMessage;
    }

    return buildForeignLanguageMessage(data, selectedMessageTarget.replace("foreign:", ""));
  }, [data, selectedMessageTarget]);

  function toggleChannel(channel: Channel) {
    setSelectedChannels((current) => (
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel]
    ));
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(selectedMessage);
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
          workpack: buildBriefPayload(data, selectedMessage, selectedMessageTarget)
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
        선택한 채널로 문서팩 요약과 현장 공유 메시지를 전송합니다. 채널별 연결 상태는 전송 결과에서 확인합니다.
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

      <div className="message-target-box">
        <div className="compact-head">
          <span className="eyebrow">Message</span>
          <strong>공유 메시지 선택</strong>
        </div>
        <p className="muted">
          관리자용 한국어를 기본으로 보내고, 외국인 작업자가 있으면 언어별 안전공지로 바꿔 전송합니다.
        </p>
        <div className="language-picker" aria-label="공유 메시지 언어 선택">
          <button
            type="button"
            className={`language-chip ${selectedMessageTarget === "manager" ? "active" : ""}`}
            onClick={() => setSelectedMessageTarget("manager")}
          >
            관리자용 한국어
          </button>
          {data.deliverables.foreignWorkerLanguages.map((language) => {
            const key = `foreign:${language.code}` as const;
            return (
              <button
                key={language.code}
                type="button"
                className={`language-chip ${selectedMessageTarget === key ? "active" : ""}`}
                onClick={() => setSelectedMessageTarget(key)}
                title={language.rationale}
              >
                {language.label}
                <span>{language.nativeLabel}</span>
              </button>
            );
          })}
        </div>
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

      <pre>{selectedMessage}</pre>
    </article>
  );
}
