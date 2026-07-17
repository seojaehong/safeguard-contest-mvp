"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";

type ShareRecipientHint = {
  workerId: string;
  displayName: string;
  languageCode: string;
};

type ShareSessionPayload = {
  id: string;
  workpackId: string;
  shareScope: "invited" | "organization";
  question: string;
  status: "active" | "revoked" | "expired";
  expiresAt: string | null;
  accessPolicy: {
    anonymousAllowed: boolean;
    manualLanguageSwitchAllowed: boolean;
    requireKnownWorkerSnapshot: boolean;
  };
  recipients: ShareRecipientHint[];
};

type ShareSessionResponse = {
  ok: boolean;
  configured: boolean;
  session: ShareSessionPayload | null;
  confirmationId?: string | null;
  idempotent?: boolean;
  message: string;
};

type FetchState = "idle" | "loading" | "submitting" | "success" | "error";

function formatIsoTime(value: string | null): string {
  if (!value) return "만료일 미설정";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "만료일 계산 불가";
  return date.toLocaleString("ko-KR");
}

function buildLanguageLabel(code: string): string {
  const normalized = code.toLowerCase();
  if (normalized === "ko") return "한국어";
  if (normalized === "en") return "영어";
  if (normalized === "vi") return "베트남어";
  if (normalized === "zh") return "중국어";
  if (normalized === "th") return "태국어";
  if (normalized === "id") return "인도네시아어";
  if (normalized === "tl") return "필리핀어";
  if (normalized === "my") return "미얀마어";
  if (normalized === "km") return "크메르어";
  if (normalized === "uz") return "우즈베크어";
  if (normalized === "mn") return "몽골어";
  if (normalized === "ne") return "네팔어";
  return code || "자동감지";
}

export default function ShareRecipientPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [sessionMessage, setSessionMessage] = useState("");
  const [sessionPayload, setSessionPayload] = useState<ShareSessionPayload | null>(null);
  const [queryWorkerId, setQueryWorkerId] = useState<string | null>(null);
  const [workerId, setWorkerId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [languageCode, setLanguageCode] = useState("ko");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [isIdempotent, setIsIdempotent] = useState(false);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);

  const selectedRecipient = useMemo(() => sessionPayload?.recipients.find((recipient) => recipient.workerId === workerId) || null, [sessionPayload, workerId]);
  const availableLanguages = useMemo(() => {
    if (!sessionPayload?.recipients.length) return [] as string[];
    const languageSet = new Set<string>();
    for (const recipient of sessionPayload.recipients) {
      if (recipient.languageCode) {
        languageSet.add(recipient.languageCode);
      }
    }
    return [...languageSet];
  }, [sessionPayload]);

  useEffect(() => {
    if (!sessionPayload?.accessPolicy.manualLanguageSwitchAllowed) return;
    const normalizedLanguageCode = languageCode.trim().toLowerCase();
    const hasExistingSelection = normalizedLanguageCode ? availableLanguages.includes(normalizedLanguageCode) : false;
    if (selectedRecipient?.languageCode) {
      const recipientLanguage = selectedRecipient.languageCode.toLowerCase();
      if (languageCode !== recipientLanguage) {
        setLanguageCode(recipientLanguage);
      }
      return;
    }
    if (hasExistingSelection && languageCode && languageCode !== "ko") {
      return;
    }
    if (availableLanguages.includes("ko")) {
      setLanguageCode("ko");
      return;
    }
    const firstLanguage = availableLanguages[0];
    if (firstLanguage) {
      setLanguageCode(firstLanguage);
    }
  }, [availableLanguages, languageCode, selectedRecipient, sessionPayload]);

  const requestBody = useCallback(() => {
    const body: Record<string, string> = {};
    if (workerId.trim()) {
      body.workerId = workerId.trim();
    }
    if (displayName.trim()) {
      body.displayName = displayName.trim();
    }
    if (languageCode.trim()) {
      body.languageCode = languageCode.trim();
    }
    if (selectedRecipient?.displayName) {
      body.displayName = body.displayName || selectedRecipient.displayName;
    }
    return body;
  }, [workerId, displayName, languageCode, selectedRecipient]);

  const hasManualLanguageSelection = useMemo(() => {
    return sessionPayload?.accessPolicy.manualLanguageSwitchAllowed ?? false;
  }, [sessionPayload]);

  useEffect(() => {
    const nextWorkerId = new URLSearchParams(window.location.search).get("workerId") || "";
    setQueryWorkerId(nextWorkerId);
    if (nextWorkerId) {
      setWorkerId((current) => current || nextWorkerId);
    }
  }, []);

  const fetchSession = useCallback(async () => {
    if (queryWorkerId === null) return;
    if (!sessionId) {
      setSessionMessage("공유 세션 식별값이 비어 있습니다.");
      setFetchState("error");
      return;
    }
    setFetchState("loading");
    setSessionMessage("");
    const requestWorkerId = workerId || queryWorkerId;
    const query = requestWorkerId ? `?workerId=${encodeURIComponent(requestWorkerId)}` : "";
    const response = await fetch(`/api/share-sessions/${encodeURIComponent(sessionId)}${query}`, { cache: "no-store" });
    const payload = (await response.json()) as ShareSessionResponse;
    if (!payload.ok) {
      setSessionPayload(null);
      setSessionMessage(payload.message);
      setFetchState("error");
      return;
    }
    const nextPayload = payload.session;
    if (!nextPayload) {
      setSessionPayload(null);
      setSessionMessage("세션 정보를 불러오지 못했습니다.");
      setFetchState("error");
      return;
    }
    setSessionPayload(nextPayload);

    const recipientByQuery = nextPayload.recipients.find((recipient) => recipient.workerId === queryWorkerId);
    if (recipientByQuery) {
      setWorkerId(recipientByQuery.workerId);
      if (!displayName) setDisplayName(recipientByQuery.displayName || "");
      if (nextPayload.accessPolicy.manualLanguageSwitchAllowed) {
        setLanguageCode(recipientByQuery.languageCode || "ko");
      }
    } else if (nextPayload.accessPolicy.anonymousAllowed && nextPayload.recipients.length && !workerId) {
      setWorkerId(nextPayload.recipients[0]?.workerId || "");
      setDisplayName(nextPayload.recipients[0]?.displayName || "");
      if (nextPayload.accessPolicy.manualLanguageSwitchAllowed) {
        setLanguageCode(nextPayload.recipients[0]?.languageCode || "ko");
      }
    } else if (nextPayload.accessPolicy.manualLanguageSwitchAllowed && !nextPayload.recipients.length) {
      setLanguageCode(languageCode || "ko");
    }
    setSessionMessage("열람 대상 공유 세션을 확인했습니다.");
    setFetchState("idle");
  }, [displayName, sessionId, languageCode, queryWorkerId, workerId]);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  const doConfirm = useCallback(async () => {
    if (!sessionPayload || !sessionId) return;
    const body = requestBody();
    if (!body.displayName && sessionPayload.accessPolicy.requireKnownWorkerSnapshot) {
      setConfirmationMessage("작업자 표시명을 입력해 주세요.");
      return;
    }
    if (!sessionPayload.accessPolicy.anonymousAllowed && !body.workerId) {
      setConfirmationMessage("링크에 작업자 식별자가 없어서 확인할 수 없습니다.");
      return;
    }
    setFetchState("submitting");
    setConfirmationMessage("");
    setIsIdempotent(false);
    const response = await fetch(`/api/share-sessions/${encodeURIComponent(sessionPayload.id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = (await response.json()) as ShareSessionResponse;
    if (!payload.ok) {
      setConfirmationMessage(payload.message || "열람 확인 처리에 실패했습니다.");
      setFetchState("error");
      return;
    }
    setConfirmationMessage(payload.message || "열람 확인이 저장되었습니다.");
    setIsIdempotent(Boolean(payload.idempotent));
    setConfirmationToken(payload.confirmationId || null);
    setFetchState("success");
    await fetchSession();
  }, [sessionPayload, sessionId, requestBody, fetchSession]);

  const question = sessionPayload?.question || "공유 중인 작업 상세가 아직 로드되지 않았습니다.";
  const status = sessionPayload ? sessionPayload.status : "active";
  const canSubmit = fetchState !== "loading"
    && status === "active"
    && (
      Boolean(sessionPayload?.accessPolicy.anonymousAllowed)
      || Boolean(workerId.trim())
    );

  return (
      <SafeClawModuleShell
        eyebrow="작업자 열람"
        title="문서팩 확인 화면"
        description="문자/메시지로 전달된 링크에서 작업자가 열람 확인 버튼을 누르는 화면입니다."
      status="live"
      mappedTo="공유 수신자 확인"
      activeHref="/share"
      actions={<Link href="/workspace">작업공간으로</Link>}
    >
      <section className="safeclaw-share-recipient-page">
        <h2>문서팩 검토</h2>
        <p className="safeclaw-subtitle">공유 코드: {sessionId}</p>
        <article className="safeclaw-share-recipient-card">
          <h3>현재 작업</h3>
          <p>{question}</p>
          {sessionPayload?.expiresAt ? <p>링크 만료: {formatIsoTime(sessionPayload.expiresAt)}</p> : null}
          <p>
            상태: {sessionPayload?.status === "active" ? "공유 진행 중" : sessionPayload?.status === "revoked" ? "회수됨" : "만료됨"}
          </p>
          <p>범위: {sessionPayload?.shareScope === "organization" ? "조직 공유" : "지정 작업자 공유"}</p>
          {sessionPayload?.status !== "active" ? (
            <p>현재 확인이 차단된 상태입니다. 관리자에게 세션 상태를 요청해 주세요.</p>
          ) : null}
        </article>

        {!sessionPayload || fetchState === "loading" ? (
          <p className="safeclaw-hint">세션 정보를 조회하는 중입니다...</p>
        ) : (
          <>
            {sessionPayload.accessPolicy.anonymousAllowed ? null : (
              <article className="safeclaw-share-recipient-card">
                <h3>작업자 식별</h3>
                <label>
                  작업자 ID
                  <input
                    type="text"
                    value={workerId}
                    onChange={(event) => setWorkerId(event.target.value)}
                    placeholder="하이퍼링크에 포함된 workerId가 있으면 자동 입력됩니다."
                    className="safeclaw-input"
                  />
                </label>
                <p className="safeclaw-hint">
                  세션 방식이 invited(지정작업자)인 경우 작업자 ID가 필요합니다.
                </p>
              </article>
            )}

          <article className="safeclaw-share-recipient-card">
                <h3>확인자</h3>
              <label>
                표시명
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="작업자 화면에 표시될 이름"
                  className="safeclaw-input"
                />
              </label>
              {hasManualLanguageSelection && availableLanguages.length ? (
                <label>
                  언어
                  <select
                    value={languageCode}
                    onChange={(event) => setLanguageCode(event.target.value)}
                    className="safeclaw-select"
                  >
                    { [...availableLanguages].sort().length > 0 ? (
                      [...availableLanguages].sort().map((code) => (
                        <option key={code} value={code}>
                          {buildLanguageLabel(code)}
                        </option>
                      ))
                    ) : (
                      <option value={languageCode || "ko"}>{buildLanguageLabel(languageCode || "ko")}</option>
                    )}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                className="safeclaw-button safeclaw-button-primary"
                onClick={() => void doConfirm()}
                disabled={!canSubmit}
              >
                {fetchState === "submitting" ? "확인 처리 중..." : "열람 확인"}
              </button>
              {confirmationMessage ? <p className="safeclaw-note">{confirmationMessage}</p> : null}
                {isIdempotent ? <p className="safeclaw-note">이미 확인한 작업입니다.</p> : null}
              {confirmationToken ? <p className="safeclaw-note">확인 ID: {confirmationToken}</p> : null}
              {selectedRecipient ? (
                <p className="safeclaw-note">
                  대상자: {selectedRecipient.displayName} ({buildLanguageLabel(selectedRecipient.languageCode)})
                </p>
              ) : null}
            </article>
            {sessionPayload.accessPolicy.anonymousAllowed && sessionPayload.recipients.length ? (
              <article className="safeclaw-share-recipient-card">
                <h3>참여자 안내</h3>
                <p>현재 페이지는 초대된 사용자의 열람 확인 저장을 지원합니다.</p>
                <p>예시 대상: {sessionPayload.recipients.slice(0, 5).map((recipient) => recipient.displayName).join(", ")}</p>
              </article>
            ) : null}
          </>
        )}
      </section>
    </SafeClawModuleShell>
  );
}
