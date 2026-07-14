"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import styles from "@/components/WorkflowSharePanel.module.css";
import {
  buildWorkflowShareRequestScopeKey,
  buildWorkflowShareTargetSignature,
  resolveShareProductPresentation,
  type ShareProductAuthorityStatus,
  type ShareProductChannelStatus,
  type ShareProductOutcome
} from "@/components/WorkflowSharePolicy";
import { buildWorkpackGenerationFingerprint } from "@/lib/current-workpack";
import { parseSupportedLanguageCode, type SupportedLanguageCode } from "@/lib/foreign-worker";
import type { AskResponse } from "@/lib/types";
import type { WorkpackReadiness } from "@/lib/workpack-readiness";
import type { WorkerDispatchTarget } from "@/lib/workspace";
import type { WorkspaceTheme } from "@/lib/workspace-pages";
import {
  createAuthenticatedShareSession,
  dispatchAuthenticatedShareSession,
  loadAuthenticatedShareAuthority,
  resolveAuthenticatedShareChannels,
  WorkflowShareRequestError,
  type AuthenticatedChannelResolution,
  type AuthenticatedShareAuthority,
  type LocalizedSharePreview,
  type WorkflowDispatchResult,
  type WorkflowShareChannel
} from "@/lib/workflow-share-client";

type WorkflowSharePanelProps = {
  data: AskResponse;
  targetWorkers?: WorkerDispatchTarget[];
  selectedWorkerKeys?: string[];
  authToken?: string;
  workpackId?: string | null;
  readiness?: WorkpackReadiness;
  requiresRevalidation?: boolean;
  workspaceTheme?: WorkspaceTheme;
};

type AuthorityViewState = {
  status: ShareProductAuthorityStatus;
  authority: AuthenticatedShareAuthority | null;
  validatedLanguage?: SupportedLanguageCode;
};

type ChannelViewState = {
  status: ShareProductChannelStatus;
  resolution: AuthenticatedChannelResolution | null;
};

type SendRequestLifecycle = {
  version: number;
  scopeKey: string;
  authToken: string | undefined;
};

const CHANNEL_OPTIONS: Array<{
  channel: WorkflowShareChannel;
  label: string;
  detail: string;
}> = [
  { channel: "email", label: "메일", detail: "관리자·원청 보고" },
  { channel: "sms", label: "문자", detail: "작업자 즉시 공지" },
  { channel: "kakao", label: "카카오", detail: "승인된 알림톡" }
];

const LANGUAGE_OPTIONS: Array<{
  code: SupportedLanguageCode;
  label: string;
  nativeLabel: string;
}> = [
  { code: "ko", label: "한국어", nativeLabel: "한국어" },
  { code: "vi", label: "베트남어", nativeLabel: "Tiếng Việt" },
  { code: "zh", label: "중국어", nativeLabel: "中文" },
  { code: "th", label: "태국어", nativeLabel: "ภาษาไทย" },
  { code: "uz", label: "우즈베크어", nativeLabel: "O'zbekcha" },
  { code: "mn", label: "몽골어", nativeLabel: "Монгол хэл" },
  { code: "ne", label: "네팔어", nativeLabel: "नेपाली" },
  { code: "km", label: "크메르어", nativeLabel: "ភាសាខ្មែរ" },
  { code: "id", label: "인도네시아어", nativeLabel: "Bahasa Indonesia" },
  { code: "my", label: "미얀마어", nativeLabel: "မြန်မာဘာသာ" },
  { code: "tl", label: "타갈로그어", nativeLabel: "Tagalog" },
  { code: "en", label: "영어", nativeLabel: "English" }
];

const STALE_REASON_CODES = new Set([
  "session_binding_missing_or_malformed",
  "session_identity_mismatch",
  "workpack_revision_or_digest_changed",
  "recipient_snapshot_changed",
  "channel_configuration_changed",
  "channel_unavailable",
  "availability_token_expired",
  "availability_token_invalid",
  "dispatch_gate_binding_mismatch"
]);

function languageLabel(code: SupportedLanguageCode): string {
  return LANGUAGE_OPTIONS.find((item) => item.code === code)?.label || code;
}

function uniqueChannels(channels: WorkflowShareChannel[]): WorkflowShareChannel[] {
  return CHANNEL_OPTIONS.map((option) => option.channel).filter((channel) => channels.includes(channel));
}

function classifyDispatchOutcome(result: WorkflowDispatchResult): ShareProductOutcome["stage"] {
  if (result.outcome === "accepted") return "accepted";
  if (result.outcome === "partial") return "partial";
  return "dispatch_failed";
}

function buildChannelOutcomes(result: WorkflowDispatchResult): NonNullable<ShareProductOutcome["channelOutcomes"]> {
  return (result.channelResults || []).flatMap((item): NonNullable<ShareProductOutcome["channelOutcomes"]> => {
    if (!item.channel) return [];
    const channelLabel = CHANNEL_OPTIONS.find((option) => option.channel === item.channel)?.label || item.channel;
    const outcome = item.status === "sent" ? "accepted" : item.status === "failed" ? "failed" : "unknown";
    return [{
      channel: item.channel,
      label: channelLabel,
      outcome,
      message: outcome === "accepted" ? "접수" : outcome === "failed" ? "실패" : "확인 필요"
    }];
  });
}

function PreviewSurface({ preview }: { preview: LocalizedSharePreview | null }) {
  if (!preview) {
    return <p className={styles.previewEmpty}>이 언어의 검토된 미리보기가 없습니다.</p>;
  }
  return (
    <>
      <strong className={styles.previewSubject}>{preview.subject}</strong>
      <dl className={styles.previewMetadata}>
        <div><dt>{preview.metadata.siteLabel}</dt><dd>{preview.metadata.siteValue}</dd></div>
        <div><dt>{preview.metadata.taskLabel}</dt><dd>{preview.metadata.taskValue}</dd></div>
        <div><dt>{preview.metadata.coreRiskLabel}</dt><dd>{preview.metadata.coreRiskValue}</dd></div>
      </dl>
      <div className={styles.previewBody}>
        {preview.bodyLines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
      </div>
      <ul className={styles.previewRisks} aria-label="안전 행동과 위험 신호">
        {preview.semanticRiskLabels.map((label, index) => <li key={`${label}-${index}`}>{label}</li>)}
      </ul>
    </>
  );
}

export function WorkflowSharePanel({
  data,
  targetWorkers = [],
  selectedWorkerKeys = [],
  authToken,
  workpackId = null,
  readiness,
  requiresRevalidation = false,
  workspaceTheme = "day"
}: WorkflowSharePanelProps) {
  const [selectedChannels, setSelectedChannels] = useState<WorkflowShareChannel[]>(["email", "sms"]);
  const [previewLanguage, setPreviewLanguage] = useState<SupportedLanguageCode>("ko");
  const [note, setNote] = useState("");
  const [online, setOnline] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<ShareProductOutcome | null>(null);
  const [staleReason, setStaleReason] = useState<string | null>(null);
  const [authorityView, setAuthorityView] = useState<AuthorityViewState>({
    status: "idle",
    authority: null
  });
  const [channelView, setChannelView] = useState<ChannelViewState>({
    status: "idle",
    resolution: null
  });
  const channelGroupRef = useRef<HTMLFieldSetElement>(null);
  const canShare = readiness?.canShare ?? true;
  const generationEvidenceSignature = data.generationEvidence?.signature || "";
  const workpackContentFingerprint = useMemo(
    () => buildWorkpackGenerationFingerprint(data),
    [data]
  );
  const targetSignature = useMemo(
    () => buildWorkflowShareTargetSignature(targetWorkers),
    [targetWorkers]
  );
  const authorityRequestWorkers = useMemo(() => (
    targetWorkers.map((worker, index) => ({
      externalKey: selectedWorkerKeys[index] || "",
      displayName: worker.displayName,
      languageCode: worker.languageCode
    }))
  ), [selectedWorkerKeys, targetWorkers]);
  const authorityScope = useMemo(() => JSON.stringify({
    workpackId,
    generationEvidenceSignature,
    workpackContentFingerprint,
    targetSignature,
    workers: authorityRequestWorkers
  }), [
    authorityRequestWorkers,
    generationEvidenceSignature,
    targetSignature,
    workpackContentFingerprint,
    workpackId
  ]);
  const sendRequestScopeKey = useMemo(() => buildWorkflowShareRequestScopeKey({
    authorityScope,
    eligible: !requiresRevalidation
      && canShare
      && online
      && targetWorkers.length > 0
      && Boolean(authToken),
    operatorNote: note.trim(),
    authority: authorityView.authority,
    selectedChannels,
    channelResolution: channelView.resolution
  }), [
    authToken,
    authorityScope,
    authorityView.authority,
    canShare,
    channelView.resolution,
    note,
    online,
    requiresRevalidation,
    selectedChannels,
    targetWorkers.length
  ]);
  const sendRequestLifecycleRef = useRef<SendRequestLifecycle>({
    version: 0,
    scopeKey: sendRequestScopeKey,
    authToken
  });
  const currentSendLifecycle = sendRequestLifecycleRef.current;
  if (
    currentSendLifecycle.scopeKey !== sendRequestScopeKey
    || currentSendLifecycle.authToken !== authToken
  ) {
    sendRequestLifecycleRef.current = {
      version: currentSendLifecycle.version + 1,
      scopeKey: sendRequestScopeKey,
      authToken
    };
  }

  useEffect(() => {
    setSending(false);
  }, [authToken, sendRequestScopeKey]);

  useEffect(() => {
    const updateOnline = () => setOnline(window.navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    setOutcome(null);
    setStaleReason(null);
    setChannelView({ status: "idle", resolution: null });
    if (
      requiresRevalidation
      || !canShare
      || !online
      || !targetWorkers.length
      || !authToken
    ) {
      setAuthorityView({ status: "idle", authority: null });
      return;
    }
    if (
      authorityRequestWorkers.length !== targetWorkers.length
      || authorityRequestWorkers.some((worker) => !worker.externalKey)
    ) {
      setAuthorityView({ status: "recipient_locale_invalid", authority: null });
      return;
    }
    let cancelled = false;
    setAuthorityView({ status: "loading", authority: null });
    void loadAuthenticatedShareAuthority(fetch, {
      authToken,
      knownWorkpackId: workpackId,
      question: data.question,
      generationEvidenceSignature,
      scenario: {
        companyName: data.scenario.companyName,
        siteName: data.scenario.siteName,
        companyType: data.scenario.companyType
      },
      selectedWorkers: authorityRequestWorkers
    }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setAuthorityView({
          status: result.reasonCode,
          authority: null,
          validatedLanguage: result.validatedSupportedCode
        });
        return;
      }
      setAuthorityView({ status: "ready", authority: result });
      setPreviewLanguage(result.recipientLocales[0] || "ko");
    }).catch((error: unknown) => {
      if (cancelled) return;
      console.error("Share authority resolution failed", error);
      setAuthorityView({ status: "workpack_revision_or_digest_changed", authority: null });
    });
    return () => {
      cancelled = true;
    };
  }, [
    authToken,
    authorityRequestWorkers,
    authorityScope,
    canShare,
    data.question,
    data.scenario.companyName,
    data.scenario.companyType,
    data.scenario.siteName,
    generationEvidenceSignature,
    online,
    refreshKey,
    requiresRevalidation,
    targetWorkers.length,
    workpackId
  ]);

  useEffect(() => {
    setOutcome(null);
    if (!selectedChannels.length) {
      setChannelView({ status: "empty", resolution: null });
      return;
    }
    if (!authToken || !online || authorityView.status !== "ready" || !authorityView.authority) {
      setChannelView({ status: "idle", resolution: null });
      return;
    }
    setStaleReason(null);
    let cancelled = false;
    setChannelView({ status: "loading", resolution: null });
    void resolveAuthenticatedShareChannels(fetch, {
      authToken,
      workpackId: authorityView.authority.workpackId,
      canonicalWorkpackRevision: authorityView.authority.canonicalWorkpackRevision,
      workerIds: authorityView.authority.workerIds,
      requestedChannels: selectedChannels
    }).then((resolution) => {
      if (cancelled) return;
      setChannelView({
        status: resolution.ready ? "ready" : "unavailable",
        resolution
      });
    }).catch((error: unknown) => {
      if (cancelled) return;
      console.error("Share channel resolution failed", error);
      if (!applyServerError(error)) setChannelView({ status: "error", resolution: null });
    });
    return () => {
      cancelled = true;
    };
  }, [authToken, authorityView, online, refreshKey, selectedChannels]);

  const presentation = resolveShareProductPresentation({
    theme: workspaceTheme,
    sending,
    outcome,
    staleReason,
    requiresRevalidation,
    readinessCanShare: canShare,
    online,
    targetCount: targetWorkers.length,
    authenticated: Boolean(authToken),
    authorityStatus: authorityView.status,
    channelStatus: channelView.status,
    validatedLanguage: authorityView.validatedLanguage
  });
  const preview = authorityView.authority?.previews[previewLanguage] || null;
  const automaticLanguages = authorityView.authority?.recipientLocales.length
    ? Array.from(new Set(authorityView.authority.recipientLocales)).map(languageLabel).join(" · ")
    : Array.from(new Set(targetWorkers.map((worker) => worker.languageLabel))).join(" · ") || "확인 대기";
  const selectedChannelLabel = selectedChannels.length
    ? selectedChannels.map((channel) => CHANNEL_OPTIONS.find((item) => item.channel === channel)?.label || channel).join(" · ")
    : "선택 안 함";

  function toggleChannel(channel: WorkflowShareChannel) {
    setSelectedChannels((current) => uniqueChannels(
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel]
    ));
  }

  function applyServerError(error: unknown): boolean {
    const requestError = error instanceof WorkflowShareRequestError ? error : null;
    const reasonCode = requestError?.reasonCode || null;
    if (!reasonCode) return false;
    const parsedLanguage = parseSupportedLanguageCode(requestError?.validatedLanguage);
    const validatedLanguage = parsedLanguage.status === "supported" ? parsedLanguage.locale : null;
    if (reasonCode === "recipient_locale_invalid") {
      setAuthorityView({
        status: "recipient_locale_invalid",
        authority: null,
        ...(validatedLanguage ? { validatedLanguage } : {})
      });
      setChannelView({ status: "idle", resolution: null });
      setOutcome(null);
      return true;
    }
    if (
      reasonCode === "translation_incomplete"
      || reasonCode === "translation_not_reviewed"
      || reasonCode === "translation_rejected"
    ) {
      setAuthorityView((current) => ({
        status: reasonCode,
        authority: null,
        validatedLanguage: validatedLanguage || current.validatedLanguage
      }));
      setChannelView({ status: "idle", resolution: null });
      setOutcome(null);
      return true;
    }
    if (STALE_REASON_CODES.has(reasonCode)) {
      setStaleReason(reasonCode);
      setAuthorityView((current) => ({
        status: reasonCode === "workpack_revision_or_digest_changed"
          ? "workpack_revision_or_digest_changed"
          : current.status,
        authority: null,
        validatedLanguage: validatedLanguage || current.validatedLanguage
      }));
      setChannelView({ status: "idle", resolution: null });
      setOutcome(null);
      return true;
    }
    if (reasonCode === "provider_adapter_unavailable") {
      setAuthorityView((current) => ({ ...current, authority: null }));
      setChannelView({ status: "unavailable", resolution: null });
      setOutcome(null);
      return true;
    }
    return false;
  }

  async function sendCurrentPack() {
    const authority = authorityView.authority;
    const channelResolution = channelView.resolution;
    if (
      sending
      || presentation.state !== "ready"
      || !authToken
      || !authority
      || !channelResolution
      || !channelResolution.ready
    ) return;
    const lifecycle = sendRequestLifecycleRef.current;
    const requestLifecycle: SendRequestLifecycle = {
      version: lifecycle.version + 1,
      scopeKey: lifecycle.scopeKey,
      authToken: lifecycle.authToken
    };
    sendRequestLifecycleRef.current = requestLifecycle;
    const requestChannels = [...selectedChannels];
    const requestNote = note.trim();
    const isCurrentRequest = (): boolean => {
      const current = sendRequestLifecycleRef.current;
      return current.version === requestLifecycle.version
        && current.scopeKey === requestLifecycle.scopeKey
        && current.authToken === requestLifecycle.authToken;
    };
    setSending(true);
    setOutcome(null);
    setStaleReason(null);
    try {
      let session: { shareSessionId: string; dispatchIdempotencyKey: string; expiresAt: string; message: string };
      try {
        session = await createAuthenticatedShareSession(fetch, {
          authToken,
          workpackId: authority.workpackId,
          workerIds: authority.workerIds,
          channels: requestChannels,
          canonicalWorkpackRevision: authority.canonicalWorkpackRevision,
          availabilityToken: channelResolution.availabilityToken
        });
      } catch (error) {
        if (!isCurrentRequest()) return;
        console.error("Share session creation failed", error);
        if (!applyServerError(error)) {
          setOutcome({ stage: "session_failed", logIds: [] });
        }
        return;
      }
      if (!isCurrentRequest()) return;

      let result: WorkflowDispatchResult;
      try {
        result = await dispatchAuthenticatedShareSession(fetch, {
          authToken,
          workpackId: authority.workpackId,
          shareSessionId: session.shareSessionId,
          idempotencyKey: session.dispatchIdempotencyKey,
          channels: requestChannels,
          operatorNote: requestNote
        });
      } catch (error) {
        if (!isCurrentRequest()) return;
        console.error("Share dispatch failed", error);
        if (!applyServerError(error)) {
          setOutcome({ stage: "dispatch_failed", logIds: [] });
        }
        return;
      }
      if (!isCurrentRequest()) return;

      const stage = classifyDispatchOutcome(result);
      const channelOutcomes = buildChannelOutcomes(result);
      setOutcome({ stage, logIds: result.logIds || [], channelOutcomes });
    } finally {
      if (isCurrentRequest()) setSending(false);
    }
  }

  function handlePrimaryAction() {
    if (outcome?.stage === "session_failed") {
      setOutcome(null);
      setStaleReason(null);
      setChannelView({ status: "idle", resolution: null });
      setRefreshKey((current) => current + 1);
      return;
    }
    if (presentation.primary.action === "send") {
      void sendCurrentPack();
      return;
    }
    if (channelView.status === "empty") {
      channelGroupRef.current?.querySelector<HTMLInputElement>("input")?.focus();
      return;
    }
    setRefreshKey((current) => current + 1);
  }

  return (
    <article
      className={styles.panel}
      id="dispatch"
      data-share-root
      data-share-owner="share"
      data-share-state={presentation.state}
      data-share-text-scale="100"
    >
      <header className={styles.header} data-share-owner="pack-status">
        <div>
          <span className={styles.eyebrow}>오늘 전송</span>
          <h1 data-share-title>오늘 문서팩 전송</h1>
          <p>{data.scenario.siteName} · {data.scenario.workSummary}</p>
        </div>
        <div className={`${styles.status} ${styles[presentation.state]}`} role="status" aria-live="polite">
          <span>{presentation.headline}</span>
          <strong>{readiness?.summary || data.status.summary}</strong>
          <p>{presentation.detail}</p>
        </div>
      </header>

      <div className={styles.sequence} data-share-region="body" data-share-owner="share-body">
        <section className={styles.section} aria-labelledby="share-target-heading" data-share-owner="targets">
          <div className={styles.sectionHeading}>
            <span>01</span>
            <div>
              <h2 id="share-target-heading">오늘 참여자</h2>
              <p>{targetWorkers.length ? `오늘 참여자 ${targetWorkers.length}명을 선택했습니다.` : "오늘 참여자가 없습니다."}</p>
            </div>
            {targetWorkers.length ? (
              <a className={styles.changeLink} href={`/workers?next=${encodeURIComponent(`/workspace?step=share&theme=${workspaceTheme}`)}`}>
                변경
              </a>
            ) : null}
          </div>
          {targetWorkers.length ? (
            <ul className={styles.recipientList} aria-label="오늘 참여자 목록">
              {targetWorkers.map((worker, index) => (
                <li key={`${selectedWorkerKeys[index] || worker.displayName}-${index}`}>
                  <strong>{worker.displayName}</strong>
                  <span>{worker.role} · {worker.languageLabel}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyCopy}>작업자 화면에서 오늘 참여자를 선택합니다.</p>
          )}
        </section>

        <section className={styles.section} aria-labelledby="share-channel-heading" data-share-owner="channels">
          <div className={styles.sectionHeading}>
            <span>02</span>
            <div>
              <h2 id="share-channel-heading">전송 채널</h2>
              <p>{selectedChannelLabel}</p>
            </div>
          </div>
          <fieldset className={styles.channelChoices} ref={channelGroupRef}>
            <legend className={styles.srOnly}>전송할 채널 선택</legend>
            {CHANNEL_OPTIONS.map((option) => (
              <label key={option.channel} className={selectedChannels.includes(option.channel) ? styles.choiceSelected : ""}>
                <input
                  type="checkbox"
                  checked={selectedChannels.includes(option.channel)}
                  onChange={() => toggleChannel(option.channel)}
                />
                <span><strong>{option.label}</strong><small>{option.detail}</small></span>
              </label>
            ))}
          </fieldset>
          {channelView.resolution?.channels.some((channel) => !channel.available) ? (
            <p className={styles.inlineWarning} role="status">
              {channelView.resolution.channels
                .filter((channel) => !channel.available)
                .map((channel) => `${CHANNEL_OPTIONS.find((item) => item.channel === channel.channel)?.label || channel.channel}: ${channel.reasonCode}`)
                .join(" · ")}
            </p>
          ) : null}
          {outcome?.channelOutcomes?.length ? (
            <div
              className={styles.channelOutcomePanel}
              data-share-result
              data-share-log-ids={outcome.logIds.join(",")}
            >
              <strong>채널 요청 결과</strong>
              <ul aria-label="채널 전송 요청 결과">
                {outcome.channelOutcomes.map((item) => (
                  <li
                    key={item.channel}
                    data-share-channel-outcome
                    data-channel={item.channel}
                    data-outcome={item.outcome}
                  >
                    <span>{item.label}</span>
                    <strong>{item.message}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className={styles.section} aria-labelledby="share-language-heading" data-share-owner="language-preview">
          <div className={styles.sectionHeading}>
            <span>03</span>
            <div>
              <h2 id="share-language-heading">언어와 미리보기</h2>
              <p>자동 언어 · {automaticLanguages}</p>
            </div>
          </div>
          <label className={styles.languageSelect}>
            <span>미리보기 언어</span>
            <select
              value={previewLanguage}
              onChange={(event) => setPreviewLanguage(event.target.value as SupportedLanguageCode)}
            >
              {LANGUAGE_OPTIONS.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label} · {language.nativeLabel}
                </option>
              ))}
            </select>
          </label>
          {authorityView.authority && presentation.state !== "stale" && presentation.state !== "blocked" ? (
            <div
              className={styles.preview}
              data-share-preview
              data-share-region="preview"
              data-share-owner="localized-preview"
              lang={previewLanguage}
            >
              <PreviewSurface preview={preview} />
            </div>
          ) : (
            <p className={styles.previewWithheld}>변경된 문서팩을 다시 확인하면 미리보기를 새로 불러옵니다.</p>
          )}
        </section>

        <section className={styles.section} aria-labelledby="share-note-heading" data-share-owner="memo">
          <div className={styles.sectionHeading}>
            <span>04</span>
            <div>
              <h2 id="share-note-heading">전달 메모</h2>
              <p>선택 입력</p>
            </div>
          </div>
          <textarea
            className={styles.memo}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            rows={2}
            aria-label="전달 메모"
          />
        </section>
      </div>

      <footer className={styles.footer} data-share-owner="primary-action">
        {presentation.primary.kind === "link" && presentation.primary.href ? (
          <a
            className={styles.primary}
            href={presentation.primary.href}
            data-share-primary
          >
            {presentation.primary.label}
          </a>
        ) : (
          <button
            type="button"
            className={styles.primary}
            data-share-primary
            disabled={presentation.primary.disabled}
            aria-busy={sending}
            onClick={handlePrimaryAction}
          >
            {presentation.primary.label}
          </button>
        )}
      </footer>
    </article>
  );
}
