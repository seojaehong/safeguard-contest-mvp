"use client";

import { useMemo, useState } from "react";
import { AskResponse } from "@/lib/types";
import type { WorkpackReadiness } from "@/lib/workpack-readiness";
import {
  buildDisplayTargetWorkers,
  formatDisplayTargetCount,
  type RecipientSuggestion,
  type WorkerDispatchTarget
} from "@/lib/workspace";
import {
  createAuthenticatedShareSession,
  dispatchAuthenticatedShareSession,
  isProviderDispatchConfirmed,
  type WorkflowDispatchChannelResult,
  type WorkflowDispatchResult
} from "@/lib/workflow-share-client";

type Channel = "email" | "sms" | "kakao" | "band";
type ActiveChannel = Extract<Channel, "email" | "sms" | "kakao">;
type MessageTarget = "manager" | `foreign:${string}`;

type WorkflowSharePanelProps = {
  data: AskResponse;
  recipientSuggestions?: RecipientSuggestion[];
  targetWorkers?: WorkerDispatchTarget[];
  authToken?: string;
  workpackId?: string | null;
  workerIds?: string[];
  ensureWorkpackSaved?: () => Promise<{ workpackId: string; workerIds: string[] } | null>;
  readiness?: WorkpackReadiness;
};

const channelOptions: Array<{ key: Channel; label: string; helper: string; enabled: boolean }> = [
  { key: "email", label: "메일", helper: "관리자·원청 보고", enabled: true },
  { key: "sms", label: "문자", helper: "작업자 즉시 공지", enabled: true },
  { key: "kakao", label: "카카오", helper: "알림톡 · 승인 템플릿 필요", enabled: true },
  { key: "band", label: "밴드", helper: "잠김 · 팀 채널 승인 후 활성화", enabled: false }
];
const activeDispatchChannels: ActiveChannel[] = ["email", "sms", "kakao"];

function buildForeignLanguageMessage(data: AskResponse, languageCode: string) {
  const language = data.deliverables.foreignWorkerLanguages.find((item) => item.code === languageCode);
  if (!language) return data.deliverables.foreignWorkerTransmission;

  return [
    `[SafeClaw ${language.label} 안전공지] ${data.scenario.companyName}`,
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

function formatChannelName(channel?: string) {
  const option = channelOptions.find((item) => item.key === channel);
  return option?.label || channel || "채널";
}

function formatChannelStatus(status?: string, validationOnly = false) {
  if (validationOnly && status === "sent") return "검증 전용";
  if (status === "sent") return "전송 완료";
  if (status === "failed") return "전송 실패";
  if (status === "unconfigured") return "설정 필요";
  if (status === "skipped") return "보류";
  if (status === "partial") return "일부 전송";
  return status || "접수";
}

function formatChannelMeta(item: WorkflowDispatchChannelResult) {
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

function formatMessagePreviewHeading(data: AskResponse, selectedTarget: MessageTarget) {
  if (selectedTarget === "manager") return "관리자용 한국어 메시지 미리보기";
  return `외국인 근로자 전송본 · ${formatMessageTargetLabel(data, selectedTarget)}`;
}

export function WorkflowSharePanel({
  data,
  recipientSuggestions = [],
  targetWorkers = [],
  authToken,
  workpackId,
  workerIds = [],
  ensureWorkpackSaved,
  readiness
}: WorkflowSharePanelProps) {
  const [selectedChannels, setSelectedChannels] = useState<Channel[]>(["email", "sms"]);
  const [selectedMessageTarget, setSelectedMessageTarget] = useState<MessageTarget>("manager");
  const [note, setNote] = useState("작업 전 TBM에서 공유하고, 교육 확인 서명까지 받은 뒤 보관해 주세요.");
  const [isSending, setIsSending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [result, setResult] = useState<WorkflowDispatchResult | null>(null);
  const [shareSessionId, setShareSessionId] = useState<string | null>(null);
  const [shareSessionAuthorityKey, setShareSessionAuthorityKey] = useState("");
  const [confirmedAuthorityKey, setConfirmedAuthorityKey] = useState("");
  const [resultSource, setResultSource] = useState<"copy" | "dispatch" | null>(null);

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
      setResultSource("copy");
    } catch (error) {
      console.error("field message copy failed", error);
      setResult({
        ok: false,
        configured: true,
        message: "클립보드 복사에 실패했습니다. 아래 메시지를 직접 선택해 복사해 주세요."
      });
      setResultSource("copy");
    }
  }

  async function dispatchWorkflow() {
    const activeChannels = selectedChannels.filter((channel): channel is ActiveChannel => (
      activeDispatchChannels.includes(channel as ActiveChannel)
    ));
    if (!authToken) {
      setResult({
        ok: false,
        configured: true,
        message: "관리자 로그인 후 서버 공유 세션을 만들 수 있습니다. 비회원 초안은 서버 전파나 열람 확인으로 기록되지 않습니다."
      });
      setIsConfirming(false);
      return;
    }
    if (!targetWorkers.length) {
      setResult({ ok: false, configured: true, message: "공유할 작업자를 한 명 이상 선택해 주세요." });
      setIsConfirming(false);
      return;
    }
    if (!activeChannels.length) {
      setResult({
        ok: false,
        configured: true,
        message: "현재 활성 전파 채널은 메일·문자·카카오 알림톡입니다. 하나 이상의 채널을 선택해 주세요."
      });
      setIsConfirming(false);
      return;
    }
    setIsSending(true);
    setIsConfirming(false);
    setResult(null);
    setResultSource("dispatch");
    setConfirmedAuthorityKey("");
    try {
      const authority = workpackId && workerIds.length
        ? { workpackId, workerIds }
        : await ensureWorkpackSaved?.();
      if (!authority) {
        throw new Error("문서팩과 작업자 서버 저장이 완료되지 않아 공유 세션을 만들 수 없습니다.");
      }
      const authorityKey = `${authority.workpackId}:${authority.workerIds.join(",")}`;
      let activeShareSessionId = shareSessionAuthorityKey === authorityKey ? shareSessionId : null;
      if (!activeShareSessionId) {
        const session = await createAuthenticatedShareSession(fetch, {
          authToken,
          workpackId: authority.workpackId,
          workerIds: authority.workerIds
        });
        activeShareSessionId = session.shareSessionId;
        setShareSessionId(session.shareSessionId);
        setShareSessionAuthorityKey(authorityKey);
      }

      const payload = await dispatchAuthenticatedShareSession(fetch, {
        authToken,
        workpackId: authority.workpackId,
        shareSessionId: activeShareSessionId,
        channels: activeChannels,
        operatorNote: note
      });
      setResult(payload);
      if (isProviderDispatchConfirmed(payload)) setConfirmedAuthorityKey(authorityKey);
    } catch (error) {
      console.error("workflow dispatch request failed", error);
      setResult({
        ok: false,
        configured: true,
        message: error instanceof Error
          ? error.message
          : "전파 요청 중 알 수 없는 오류가 발생했습니다."
      });
    } finally {
      setIsSending(false);
    }
  }

  const channelLabel = selectedChannels.map((channel) => formatChannelName(channel)).join(", ");
  const recipientLabel = targetWorkers.length ? `${targetWorkers.length}명` : "작업자 선택 필요";
  const targetLabel = formatMessageTargetLabel(data, selectedMessageTarget);
  const authorityKey = workpackId && workerIds.length ? `${workpackId}:${workerIds.join(",")}` : "";
  const storageReady = Boolean(authToken && authorityKey);
  const sessionReady = Boolean(shareSessionId && authorityKey && shareSessionAuthorityKey === authorityKey);
  const dispatchConfirmed = Boolean(authorityKey && confirmedAuthorityKey === authorityKey);
  const validationOnlyResult = Boolean(
    resultSource === "dispatch" && result?.ok && !isProviderDispatchConfirmed(result)
  );
  const displayTargetWorkers = buildDisplayTargetWorkers(data, targetWorkers);
  const targetCountLabel = formatDisplayTargetCount(data, targetWorkers);
  const storageLabel = storageReady ? "workpack·worker UUID 연결" : "서버 저장 전";
  const storageDetail = storageReady
    ? `${workerIds.length}명의 서버 작업자 ID를 공유 권한에 사용`
    : "로그인 후 문서팩과 작업자를 저장해야 공유 세션을 만들 수 있음";
  const workerDisplayLabel = displayTargetWorkers.length
    ? displayTargetWorkers.map((worker) => worker.displayName).slice(0, 3).join(", ")
    : "관리자 입력 수신자";
  const activeChannelLabel = channelLabel || "채널 미선택";
  const previewItems = previewLines(selectedMessage);
  const acknowledgmentStatus = dispatchConfirmed
    ? "열람 확인 대기"
    : sessionReady
      ? "공유 세션 생성됨 · 전파 대기"
      : "서버 확인 전";
  const shareBlocked = Boolean(readiness && !readiness.canShare);
  const shareDisabledReason = readiness?.reasons.join(" · ") || "";

  return (
    <article className="share-panel workflow-panel" id="dispatch">
      <header className="share-workflow-header">
        <div>
          <span className="eyebrow">Share workflow</span>
          <strong>권한 있는 공유 세션</strong>
          <p>문서팩, 다국어 안내, 확인 상태, 저장 증빙을 한 번에 검토한 뒤 전송합니다.</p>
        </div>
        <div className="share-status-pill" aria-label="공유 워크플로 상태">
          <span>{storageReady ? "workpack linked" : "draft session"}</span>
          <strong>{shareBlocked ? readiness?.summary : acknowledgmentStatus}</strong>
        </div>
      </header>

      <div className="share-permission-grid" aria-label="공유 권한과 상태 요약">
        <section>
          <span>Permission</span>
          <strong>초대된 사람만 열람</strong>
          <p>관리자 편집, 작업자 열람 기준으로 공개 링크 없이 운영합니다.</p>
        </section>
        <section>
          <span>Recipients</span>
          <strong>{recipientLabel} · {targetCountLabel}</strong>
          <p>{workerDisplayLabel} 기준으로 수신자, 표시명, 언어를 확인합니다.</p>
        </section>
        <section>
          <span>Language preview</span>
          <strong>{targetLabel}</strong>
          <p>미리보기 언어 선택은 검토·복사용입니다. 실제 전파 언어와 메시지는 서버가 저장된 작업팩과 작업자 언어 스냅샷에서 생성합니다.</p>
        </section>
        <section>
          <span>Acknowledgment</span>
          <strong>{shareBlocked ? "공유 전 보완" : acknowledgmentStatus}</strong>
          <p>{shareBlocked ? "검수·근거·결재 상태를 먼저 정리한 뒤 전파합니다." : "열람·확인 기록은 TBM·교육 확인 후보로 보관합니다."}</p>
        </section>
      </div>

      <div className="share-form-shell">
        <section className="share-form-card" aria-labelledby="workflow-channel-heading">
          <div className="share-form-card-head">
            <span>01</span>
            <strong id="workflow-channel-heading">채널</strong>
          </div>
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
                {!channel.enabled ? <em>승인 대기</em> : null}
              </button>
            ))}
          </div>
          <p className="channel-readiness-note">
            카카오 알림톡은 승인 채널과 템플릿 설정이 없으면 채널별 결과에 설정 필요로 표시됩니다.
          </p>
        </section>

        <section className="share-form-card" aria-labelledby="workflow-language-heading">
          <div className="share-form-card-head">
            <span>02</span>
            <strong id="workflow-language-heading">미리보기 언어</strong>
          </div>
          <div className="language-picker" aria-label="공유 메시지 미리보기 언어 선택">
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
        </section>

        <section className="share-form-card share-recipient-card" aria-labelledby="workflow-recipient-heading">
          <div className="recipient-section-head">
            <span className="share-form-step">03</span>
            <span className="field-label" id="workflow-recipient-heading">수신자</span>
            <span>{recipientLabel}</span>
          </div>
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
            서버에 저장된 선택 작업자의 UUID와 연락처 스냅샷만 공유 세션에 포함됩니다. 직접 입력 수신자는 서버 확인 대상으로 간주하지 않습니다.
          </p>
        </section>

        <section className="share-form-card" aria-labelledby="workflow-note-heading">
          <div className="share-form-card-head">
            <span>04</span>
            <strong id="workflow-note-heading">전달 메모</strong>
          </div>
          <input
            id="workflow-note"
            className="input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </section>
      </div>

      {!authToken || !workpackId ? (
        <p className="share-inline-note">
          지금 화면은 공유 초안입니다. 관리자 로그인 전에는 서버 공유 세션이나 열람 확인 상태로 표시하지 않습니다.
        </p>
      ) : null}

      {shareBlocked ? (
        <p className="share-inline-note warn">
          {shareDisabledReason}
        </p>
      ) : null}

      <section className="acknowledgment-ledger" aria-label="확인 상태와 저장 증빙">
        <article>
          <span>확인 대상</span>
          <strong>{targetCountLabel}</strong>
          <small>{workerDisplayLabel} · 작업자 표시명 기준</small>
        </article>
        <article>
          <span>현재 상태</span>
          <strong>{shareBlocked ? readiness?.summary : acknowledgmentStatus}</strong>
          <small>{shareBlocked ? "검수 통과 전에는 일반 전송을 잠급니다." : "열람 확인은 전파 결과와 분리해 검토"}</small>
        </article>
        <article className={storageReady ? "ready" : "warn"}>
          <span>저장 증빙</span>
          <strong>{storageLabel}</strong>
          <small>{storageDetail}</small>
        </article>
      </section>

      <section className="message-preview-panel" aria-label={formatMessagePreviewHeading(data, selectedMessageTarget)}>
        <div className="compact-head">
          <span className="eyebrow">Preview</span>
          <strong>{formatMessagePreviewHeading(data, selectedMessageTarget)}</strong>
        </div>
        <div className="message-preview-lines">
          {previewItems.map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
        </div>
      </section>

      <div className="command-actions">
        <button
          type="button"
          className="button"
          onClick={() => setIsConfirming(true)}
          disabled={!authToken || shareBlocked || isSending || selectedChannels.length === 0 || targetWorkers.length === 0}
        >
          {isSending ? "전파 요청 중" : !authToken ? "관리자 로그인 필요" : shareBlocked ? "공유 전 보완 필요" : "전송 확인"}
        </button>
        <button type="button" className="button secondary" onClick={copyMessage}>메시지 복사</button>
      </div>

      {isConfirming ? (
        <div className="dispatch-confirm-panel" role="dialog" aria-modal="false" aria-label="현장 전파 전 확인">
          <div className="compact-head">
            <span className="eyebrow">전송 전 확인</span>
            <strong>{activeChannelLabel}</strong>
          </div>
          <div className="dispatch-confirm-grid">
            <div><span>수신</span><strong>{recipientLabel}</strong></div>
            <div><span>미리보기 언어</span><strong>{targetLabel}</strong></div>
            <div><span>대상 작업자</span><strong>{targetCountLabel}</strong></div>
          </div>
          <p className="muted small">전송 후 provider 응답을 채널별로 표시하고, 관리자 로그인 상태에서는 전파 이력을 저장합니다.</p>
          <div className="dispatch-evidence-ledger" aria-label="전송 후 저장될 이력">
            <article className={storageReady ? "ready" : "warn"}>
              <span>문서팩 저장</span>
              <strong>{storageReady ? "서버 workpack 연결" : "저장 전 후보"}</strong>
              <small>{storageReady ? "서버 작업자 UUID로 공유 세션을 생성합니다." : "로그인과 문서팩·작업자 저장이 먼저 필요합니다."}</small>
            </article>
            <article className="pending">
              <span>교육 확인</span>
              <strong>{dispatchConfirmed ? "열람 확인 대기" : "서버 확인 전"}</strong>
              <small>{dispatchConfirmed ? "성공한 공유 세션과 전파 요청에만 확인 이력을 연결합니다." : "세션 생성과 전파 성공 전에는 확인 준비 상태가 아닙니다."}</small>
            </article>
            <article className="ready">
              <span>전파 로그</span>
              <strong>dispatch_logs</strong>
              <small>provider 응답, 실패 사유, 실행 ID를 전송 로그로 분리 저장합니다.</small>
            </article>
          </div>
          <p className="channel-readiness-note">
            이 확인 단계에서 전송되는 채널은 {activeChannelLabel}입니다. 카카오 알림톡은 승인 채널과 템플릿 설정이 없으면 채널별 결과에 설정 필요로 표시됩니다.
          </p>
          {shareBlocked ? (
            <p className="channel-readiness-note">
              공유 전 보완 항목: {shareDisabledReason}
            </p>
          ) : null}
          {selectedMessageTarget !== "manager" ? (
            <p className="channel-readiness-note">
              외국어 미리보기는 현장 검토와 복사용입니다. 실제 provider 전파본은 저장된 작업팩과 작업자 언어 스냅샷을 서버가 조합합니다.
            </p>
          ) : null}
          <div className="command-actions">
            <button type="button" className="button" onClick={dispatchWorkflow} disabled={shareBlocked || isSending}>
              {isSending ? "전파 요청 중" : "지금 전송"}
            </button>
            <button type="button" className="button secondary" onClick={() => setIsConfirming(false)} disabled={isSending}>
              취소
            </button>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className={dispatchConfirmed || (result.ok && !validationOnlyResult) ? "workflow-result ok" : result.ok ? "workflow-result" : "workflow-result error"}>
          <p>
            {result.message}
            {result.workflowRunId ? ` 실행 ID: ${result.workflowRunId}` : ""}
          </p>
          {validationOnlyResult ? (
            <p>Fixture·검증 전용 응답입니다. 실제 provider 전송이나 열람 확인 준비로 간주하지 않습니다.</p>
          ) : null}
          {result.channelResults?.length ? (
            <div className="workflow-channel-results" aria-label="채널별 전송 결과">
              {result.channelResults.map((item, index) => (
                <div
                  key={`${item.channel || "channel"}-${index}`}
                  className={`workflow-channel-result ${validationOnlyResult ? "validation-only" : item.status || "received"}`}
                >
                  <strong>{formatChannelName(item.channel)}</strong>
                  <span>{formatChannelStatus(item.status, validationOnlyResult)}</span>
                  {formatChannelMeta(item) ? <small>{formatChannelMeta(item)}</small> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <details className="message-source-detail">
        <summary>전체 메시지 원문</summary>
        <pre aria-label="선택한 공유 메시지 원문">{selectedMessage}</pre>
      </details>
    </article>
  );
}
