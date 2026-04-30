"use client";

import { useMemo, useState } from "react";
import { AskResponse } from "@/lib/types";
import type { RecipientSuggestion, WorkerDispatchTarget } from "@/lib/workspace";

type Channel = "email" | "sms" | "kakao" | "band";
type MessageTarget = "manager" | `foreign:${string}`;

type DispatchResult = {
  ok: boolean;
  configured: boolean;
  message: string;
  workflowRunId?: string;
  providerStatus?: string;
  channelResults?: DispatchChannelResult[];
  summary?: {
    requested?: number;
    sent?: number;
    failed?: number;
    partial?: number;
    unconfigured?: number;
    skipped?: number;
  };
};

type DispatchChannelResult = {
  channel?: string;
  provider?: string;
  status?: string;
  message?: string;
  httpStatus?: number;
};

type WorkflowSharePanelProps = {
  data: AskResponse;
  recipientSuggestions?: RecipientSuggestion[];
  targetWorkers?: WorkerDispatchTarget[];
  authToken?: string;
  workpackId?: string | null;
  ensureWorkpackSaved?: () => Promise<string | null>;
};

const channelOptions: Array<{ key: Channel; label: string; helper: string; enabled: boolean }> = [
  { key: "email", label: "메일", helper: "관리자·원청 보고", enabled: true },
  { key: "sms", label: "문자", helper: "작업자 즉시 공지", enabled: true },
  { key: "kakao", label: "카카오", helper: "준비 중 · 승인 후 알림 신청", enabled: false },
  { key: "band", label: "밴드", helper: "준비 중 · 팀 채널 연결 대기", enabled: false }
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

function buildBriefPayload(
  data: AskResponse,
  selectedMessage: string,
  selectedTarget: MessageTarget,
  targetWorkers: WorkerDispatchTarget[]
) {
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
    targetWorkers,
    status: data.status
  };
}

function formatChannelName(channel?: string) {
  const option = channelOptions.find((item) => item.key === channel);
  return option?.label || channel || "채널";
}

function formatChannelStatus(status?: string) {
  if (status === "sent") return "전송 완료";
  if (status === "failed") return "전송 실패";
  if (status === "unconfigured") return "설정 필요";
  if (status === "skipped") return "보류";
  if (status === "partial") return "일부 전송";
  return status || "접수";
}

function formatChannelMeta(item: DispatchChannelResult) {
  const parts = [
    item.provider,
    typeof item.httpStatus === "number" ? `HTTP ${item.httpStatus}` : "",
    item.message
  ].filter((part): part is string => Boolean(part));

  return parts.join(" · ");
}

function previewLines(message: string) {
  const lines = message.split(/\r?\n/).filter(Boolean);
  return lines.slice(0, 8);
}

function formatMessageTargetLabel(data: AskResponse, selectedTarget: MessageTarget) {
  if (selectedTarget === "manager") return "관리자용 한국어";
  const languageCode = selectedTarget.replace("foreign:", "");
  const language = data.deliverables.foreignWorkerLanguages.find((item) => item.code === languageCode);
  return language ? `${language.label}(${language.nativeLabel})` : "외국인 근로자 전송본";
}

export function WorkflowSharePanel({
  data,
  recipientSuggestions = [],
  targetWorkers = [],
  authToken,
  workpackId,
  ensureWorkpackSaved
}: WorkflowSharePanelProps) {
  const [selectedChannels, setSelectedChannels] = useState<Channel[]>(["email", "sms"]);
  const [selectedMessageTarget, setSelectedMessageTarget] = useState<MessageTarget>("manager");
  const [recipients, setRecipients] = useState("");
  const [note, setNote] = useState("작업 전 TBM에서 공유하고, 교육 확인 서명까지 받은 뒤 보관해 주세요.");
  const [isSending, setIsSending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [result, setResult] = useState<DispatchResult | null>(null);

  const recipientList = useMemo(() => splitRecipients(recipients), [recipients]);
  const dispatchRecipients = useMemo(
    () => [...new Set([...recipientSuggestions.map((item) => item.value), ...recipientList])],
    [recipientList, recipientSuggestions]
  );
  const selectedMessage = useMemo(() => {
    if (selectedMessageTarget === "manager") {
      return data.deliverables.kakaoMessage;
    }

    return buildForeignLanguageMessage(data, selectedMessageTarget.replace("foreign:", ""));
  }, [data, selectedMessageTarget]);

  function toggleChannel(channel: Channel) {
    const option = channelOptions.find((item) => item.key === channel);
    if (!option?.enabled) return;

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

  async function saveDispatchLog(payload: DispatchResult, sentRecipients: string[], savedWorkpackId: string | null) {
    if (!authToken || !savedWorkpackId || !payload.channelResults?.length) return;

    const selectedLanguageCode = selectedMessageTarget.startsWith("foreign:")
      ? selectedMessageTarget.replace("foreign:", "")
      : "ko";

    try {
      await fetch("/api/dispatch-logs", {
        method: "POST",
        headers: {
          "authorization": `Bearer ${authToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          workpackId: savedWorkpackId,
          scenario: data.scenario,
          logs: payload.channelResults.map((item) => ({
            channel: item.channel || "unknown",
            targetLabel: targetWorkers.map((worker) => worker.displayName).join(", ") || "운영 기본 수신자",
            targetContact: sentRecipients.join(", "),
            languageCode: selectedLanguageCode,
            provider: item.provider,
            providerStatus: item.status,
            workflowRunId: payload.workflowRunId,
            failureReason: item.status === "failed" || item.status === "unconfigured" ? item.message : "",
            payload: item
          }))
        })
      });
    } catch (error) {
      console.warn("dispatch log save failed", error);
    }
  }

  async function dispatchWorkflow() {
    setIsSending(true);
    setIsConfirming(false);
    setResult(null);
    try {
      const savedWorkpackId = workpackId || await ensureWorkpackSaved?.() || null;
      const response = await fetch("/api/workflow/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channels: selectedChannels,
          recipients: dispatchRecipients,
          operatorNote: note,
          workpack: buildBriefPayload(data, selectedMessage, selectedMessageTarget, targetWorkers)
        })
      });
      const payload = await response.json() as DispatchResult;
      setResult(payload);
      await saveDispatchLog(payload, dispatchRecipients, savedWorkpackId);
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

  const channelLabel = selectedChannels.map((channel) => formatChannelName(channel)).join(", ");
  const recipientLabel = dispatchRecipients.length ? `${dispatchRecipients.length}건` : "운영 기본 수신자";
  const targetLabel = formatMessageTargetLabel(data, selectedMessageTarget);

  return (
    <article className="share-panel workflow-panel" id="dispatch">
      <div className="compact-head">
        <span className="eyebrow">전파</span>
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
            className={`channel-card ${selectedChannels.includes(channel.key) ? "active" : ""} ${channel.enabled ? "" : "disabled"}`}
            onClick={() => toggleChannel(channel.key)}
            disabled={!channel.enabled}
            aria-disabled={!channel.enabled}
            aria-pressed={selectedChannels.includes(channel.key)}
            aria-label={`${channel.label} 채널 ${selectedChannels.includes(channel.key) ? "선택됨" : "선택"}`}
          >
            <strong>{channel.label}</strong>
            <span>{channel.helper}</span>
            {!channel.enabled ? <em>준비 중</em> : null}
          </button>
        ))}
      </div>
      <p className="channel-readiness-note">
        현재 즉시 전송 채널은 메일·문자입니다. 카카오·밴드는 채널 승인이 끝나면 같은 전파 흐름에 연결됩니다.
      </p>

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
            aria-pressed={selectedMessageTarget === "manager"}
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
                aria-pressed={selectedMessageTarget === key}
                aria-label={`${language.label} 공유 메시지 선택`}
              >
                {language.label}
                <span>{language.nativeLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="recipient-section-head">
        <label className="field-label" htmlFor="workflow-recipients">수신자 추가/관리</label>
        <span>{recipientLabel}</span>
      </div>
      <textarea
        id="workflow-recipients"
        className="textarea workflow-textarea"
        value={recipients}
        onChange={(event) => setRecipients(event.target.value)}
        placeholder="예: safety@example.com, 010-1234-5678"
      />
      {recipientSuggestions.length ? (
        <div className="recipient-chip-list" aria-label="선택된 근로자 전파 대상">
          {recipientSuggestions.map((recipient) => (
            <span key={`${recipient.channel}-${recipient.value}`} className="recipient-chip">
              {recipient.label} · {recipient.languageLabel}
            </span>
          ))}
        </div>
      ) : null}
      <p className="muted small">
        선택된 근로자 연락처는 자동 포함됩니다. 메일·문자만 선택하면 위 수신자와 근로자 연락처로 실제 전송됩니다.
      </p>

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
          onClick={() => setIsConfirming(true)}
          disabled={isSending || selectedChannels.length === 0}
        >
          {isSending ? "전파 요청 중" : "전송 확인"}
        </button>
        <button type="button" className="button secondary" onClick={copyMessage}>메시지 복사</button>
      </div>

      {isConfirming ? (
        <div className="dispatch-confirm-panel" role="dialog" aria-modal="false" aria-label="현장 전파 전 확인">
          <div className="compact-head">
            <span className="eyebrow">전송 전 확인</span>
            <strong>{channelLabel || "채널 미선택"}</strong>
          </div>
          <div className="dispatch-confirm-grid">
            <div><span>수신</span><strong>{recipientLabel}</strong></div>
            <div><span>언어</span><strong>{targetLabel}</strong></div>
            <div><span>대상 작업자</span><strong>{targetWorkers.length ? `${targetWorkers.length}명` : "운영 기본"}</strong></div>
          </div>
          <p className="muted small">전송 후 provider 응답을 채널별로 표시하고, 관리자 로그인 상태에서는 전파 이력을 저장합니다.</p>
          <div className="command-actions">
            <button type="button" className="button" onClick={dispatchWorkflow} disabled={isSending}>
              {isSending ? "전파 요청 중" : "지금 전송"}
            </button>
            <button type="button" className="button secondary" onClick={() => setIsConfirming(false)} disabled={isSending}>
              취소
            </button>
          </div>
        </div>
      ) : null}

      <div className="message-preview-phone" aria-label="휴대폰 공유 메시지 미리보기">
        <div className="phone-shell">
          <div className="phone-status">SafeGuard 현장공지</div>
          <div className="phone-bubble">
            {previewLines(selectedMessage).map((line, index) => (
              <p key={`${line}-${index}`}>{line}</p>
            ))}
          </div>
        </div>
      </div>

      {result ? (
        <div className={result.ok ? "workflow-result ok" : "workflow-result error"}>
          <p>
            {result.message}
            {result.workflowRunId ? ` 실행 ID: ${result.workflowRunId}` : ""}
          </p>
          {result.channelResults?.length ? (
            <div className="workflow-channel-results" aria-label="채널별 전송 결과">
              {result.channelResults.map((item, index) => (
                <div
                  key={`${item.channel || "channel"}-${index}`}
                  className={`workflow-channel-result ${item.status || "received"}`}
                >
                  <strong>{formatChannelName(item.channel)}</strong>
                  <span>{formatChannelStatus(item.status)}</span>
                  {formatChannelMeta(item) ? <small>{formatChannelMeta(item)}</small> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <pre aria-label="선택한 공유 메시지 원문">{selectedMessage}</pre>
    </article>
  );
}
