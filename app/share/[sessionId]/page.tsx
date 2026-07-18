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
  documents: Array<{
    key: "riskAssessmentDraft" | "tbmBriefing" | "tbmLogDraft";
    title: string;
    body: string;
  }>;
  recipientMessage: {
    languageCode: string;
    title: string;
    body: string;
  } | null;
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

type RecipientPortalCopy = {
  skipLink: string;
  railAria: string;
  homeAria: string;
  menu: string;
  productSubtitle: string;
  mappedToLabel: string;
  decisionAria: string;
  siteContext: string;
  evidenceContext: string;
  weatherContext: string;
  themeAria: string;
  dayLabel: string;
  nightLabel: string;
  statusLiveLabel: string;
  statusPartialLabel: string;
  statusPlannedLabel: string;
  shellEyebrow: string;
  shellTitle: string;
  shellDescription: string;
  shellMappedTo: string;
  shellAction: string;
  reviewTitle: string;
  invitedSubtitle: string;
  anonymousSubtitle: string;
  currentTaskTitle: string;
  expiresPrefix: string;
  statusPrefix: string;
  statusActive: string;
  statusRevoked: string;
  statusExpired: string;
  scopePrefix: string;
  scopeOrganization: string;
  scopeInvited: string;
  emptySessionId: string;
  invalidSessionId: string;
  sessionLoadFailed: string;
  sessionVerified: string;
  fallbackQuestion: string;
  inactiveHelp: string;
  loading: string;
  workerNoticeNote: string;
  inviteInfoTitle: string;
  workerIdLabel: string;
  workerIdPlaceholder: string;
  missingInviteHint: string;
  confirmationTitle: string;
  displayNameLabel: string;
  displayNamePlaceholder: string;
  languageLabel: string;
  confirmButton: string;
  submittingButton: string;
  targetPrefix: string;
  anonymousGuideTitle: string;
  anonymousGuideBody: string;
  documentsTitle: string;
  documentsNote: string;
  documentsLoadingTitle: string;
  documentsLoadingBody: string;
  displayNameRequired: string;
  missingWorkerId: string;
  confirmationFailed: string;
  savedConfirmation: string;
  savedManagerHistory: string;
  alreadyConfirmed: string;
};

const RECIPIENT_PORTAL_COPY: Record<"ko" | "vi" | "en", RecipientPortalCopy> = {
  ko: {
    skipLink: "본문으로 건너뛰기",
    railAria: "SafeClaw 제품 메뉴",
    homeAria: "SafeClaw 홈",
    menu: "메뉴",
    productSubtitle: "현장 안전 문서팩",
    mappedToLabel: "업무 범위",
    decisionAria: "현재 모듈 결정",
    siteContext: "SITE 기본 현장",
    evidenceContext: "공공 근거",
    weatherContext: "기상청",
    themeAria: "화면 테마",
    dayLabel: "주간",
    nightLabel: "야간",
    statusLiveLabel: "바로 사용",
    statusPartialLabel: "연결 확인",
    statusPlannedLabel: "설정 필요",
    shellEyebrow: "작업자 열람",
    shellTitle: "문서팩 확인 화면",
    shellDescription: "전달받은 현장 안전 문서와 안내문을 확인하고 열람 확인을 남깁니다.",
    shellMappedTo: "공유 수신자 확인",
    shellAction: "작업공간으로",
    reviewTitle: "문서팩 검토",
    invitedSubtitle: "초대된 작업자에게만 열린 확인 화면입니다.",
    anonymousSubtitle: "문서팩을 확인한 뒤 표시명을 남겨 주세요.",
    currentTaskTitle: "현재 작업",
    expiresPrefix: "링크 만료",
    statusPrefix: "상태",
    statusActive: "공유 진행 중",
    statusRevoked: "회수됨",
    statusExpired: "만료됨",
    scopePrefix: "범위",
    scopeOrganization: "조직 공유",
    scopeInvited: "지정 작업자 공유",
    emptySessionId: "공유 세션 식별값이 비어 있습니다.",
    invalidSessionId: "공유 세션 식별값을 확인해 주세요.",
    sessionLoadFailed: "세션 정보를 불러오지 못했습니다.",
    sessionVerified: "열람 대상 공유 세션을 확인했습니다.",
    fallbackQuestion: "공유 중인 작업 상세가 아직 로드되지 않았습니다.",
    inactiveHelp: "현재 확인이 차단된 상태입니다. 관리자에게 세션 상태를 요청해 주세요.",
    loading: "세션 정보를 조회하는 중입니다...",
    workerNoticeNote: "작업자 언어 기준으로 생성된 현장 안내입니다.",
    inviteInfoTitle: "초대 정보 확인",
    workerIdLabel: "작업자 식별값",
    workerIdPlaceholder: "전달받은 링크의 작업자 식별값",
    missingInviteHint: "초대 정보가 누락된 경우 관리자에게 링크를 다시 요청해 주세요.",
    confirmationTitle: "열람 확인",
    displayNameLabel: "표시명",
    displayNamePlaceholder: "작업자 화면에 표시될 이름",
    languageLabel: "언어",
    confirmButton: "열람 확인",
    submittingButton: "확인 처리 중...",
    targetPrefix: "대상자",
    anonymousGuideTitle: "참여자 안내",
    anonymousGuideBody: "현재 페이지는 공동 열람 확인 저장을 지원합니다. 작업자 명단은 관리자 화면에서만 확인합니다.",
    documentsTitle: "문서팩 핵심 3종",
    documentsNote: "자세한 문서 본문은 필요할 때만 펼쳐 확인합니다.",
    documentsLoadingTitle: "문서팩 준비 중",
    documentsLoadingBody: "관리자가 공유한 문서 본문을 아직 불러오지 못했습니다. 작업 전 관리자에게 최신 문서팩을 확인해 주세요.",
    displayNameRequired: "작업자 표시명을 입력해 주세요.",
    missingWorkerId: "링크에 작업자 식별자가 없어서 확인할 수 없습니다.",
    confirmationFailed: "열람 확인 처리에 실패했습니다.",
    savedConfirmation: "작업자 열람 확인을 저장했습니다.",
    savedManagerHistory: "관리자 화면에 확인 이력이 저장되었습니다.",
    alreadyConfirmed: "이미 확인한 작업입니다."
  },
  vi: {
    skipLink: "Chuyển đến nội dung chính",
    railAria: "Menu sản phẩm SafeClaw",
    homeAria: "Trang chủ SafeClaw",
    menu: "Menu",
    productSubtitle: "Gói tài liệu an toàn hiện trường",
    mappedToLabel: "Phạm vi công việc",
    decisionAria: "Quyết định màn hình hiện tại",
    siteContext: "Hiện trường mặc định",
    evidenceContext: "Căn cứ chính thức",
    weatherContext: "KMA",
    themeAria: "Chủ đề màn hình",
    dayLabel: "Sáng",
    nightLabel: "Tối",
    statusLiveLabel: "Sẵn sàng dùng",
    statusPartialLabel: "Cần kiểm tra kết nối",
    statusPlannedLabel: "Cần thiết lập",
    shellEyebrow: "Công nhân xem",
    shellTitle: "Màn hình xác nhận tài liệu",
    shellDescription: "Kiểm tra tài liệu an toàn hiện trường và để lại xác nhận đã xem.",
    shellMappedTo: "Xác nhận người nhận",
    shellAction: "Về không gian làm việc",
    reviewTitle: "Kiểm tra gói tài liệu",
    invitedSubtitle: "Màn hình xác nhận chỉ dành cho công nhân được mời.",
    anonymousSubtitle: "Sau khi xem gói tài liệu, hãy nhập tên hiển thị.",
    currentTaskTitle: "Công việc hiện tại",
    expiresPrefix: "Liên kết hết hạn",
    statusPrefix: "Trạng thái",
    statusActive: "Đang chia sẻ",
    statusRevoked: "Đã thu hồi",
    statusExpired: "Đã hết hạn",
    scopePrefix: "Phạm vi",
    scopeOrganization: "Chia sẻ trong tổ chức",
    scopeInvited: "Chỉ công nhân được chỉ định",
    emptySessionId: "Thiếu mã phiên chia sẻ.",
    invalidSessionId: "Vui lòng kiểm tra mã phiên chia sẻ.",
    sessionLoadFailed: "Không thể tải thông tin phiên.",
    sessionVerified: "Đã xác nhận phiên chia sẻ cho người nhận.",
    fallbackQuestion: "Chưa tải được chi tiết công việc được chia sẻ.",
    inactiveHelp: "Hiện không thể xác nhận. Vui lòng hỏi quản lý về trạng thái phiên.",
    loading: "Đang tải thông tin phiên...",
    workerNoticeNote: "Thông báo hiện trường được tạo theo ngôn ngữ của công nhân.",
    inviteInfoTitle: "Kiểm tra thông tin mời",
    workerIdLabel: "Mã công nhân",
    workerIdPlaceholder: "Mã công nhân trong liên kết đã nhận",
    missingInviteHint: "Nếu thiếu thông tin mời, vui lòng yêu cầu quản lý gửi lại liên kết.",
    confirmationTitle: "Xác nhận đã xem",
    displayNameLabel: "Tên hiển thị",
    displayNamePlaceholder: "Tên sẽ hiển thị trên màn hình công nhân",
    languageLabel: "Ngôn ngữ",
    confirmButton: "Tôi đã xem",
    submittingButton: "Đang lưu xác nhận...",
    targetPrefix: "Người nhận",
    anonymousGuideTitle: "Hướng dẫn người tham gia",
    anonymousGuideBody: "Trang này hỗ trợ lưu xác nhận xem chung. Danh sách công nhân chỉ được quản lý xem.",
    documentsTitle: "3 tài liệu chính",
    documentsNote: "Chỉ mở nội dung chi tiết khi cần kiểm tra.",
    documentsLoadingTitle: "Đang chuẩn bị tài liệu",
    documentsLoadingBody: "Chưa tải được nội dung tài liệu do quản lý chia sẻ. Hãy xác nhận gói tài liệu mới nhất trước khi làm việc.",
    displayNameRequired: "Vui lòng nhập tên hiển thị của công nhân.",
    missingWorkerId: "Không có mã công nhân trong liên kết nên không thể xác nhận.",
    confirmationFailed: "Không thể lưu xác nhận xem.",
    savedConfirmation: "Đã lưu xác nhận xem tài liệu.",
    savedManagerHistory: "Lịch sử xác nhận đã được lưu cho quản lý.",
    alreadyConfirmed: "Công việc này đã được xác nhận."
  },
  en: {
    skipLink: "Skip to main content",
    railAria: "SafeClaw product menu",
    homeAria: "SafeClaw home",
    menu: "Menu",
    productSubtitle: "Site safety document pack",
    mappedToLabel: "Work scope",
    decisionAria: "Current module decision",
    siteContext: "Default site",
    evidenceContext: "Official sources",
    weatherContext: "KMA",
    themeAria: "Screen theme",
    dayLabel: "Day",
    nightLabel: "Night",
    statusLiveLabel: "Ready",
    statusPartialLabel: "Check connection",
    statusPlannedLabel: "Setup needed",
    shellEyebrow: "Worker view",
    shellTitle: "Document pack confirmation",
    shellDescription: "Review the shared site safety notice and leave a read confirmation.",
    shellMappedTo: "Share recipient confirmation",
    shellAction: "Back to workspace",
    reviewTitle: "Review document pack",
    invitedSubtitle: "This confirmation screen is only for invited workers.",
    anonymousSubtitle: "Review the document pack, then leave your display name.",
    currentTaskTitle: "Current task",
    expiresPrefix: "Link expires",
    statusPrefix: "Status",
    statusActive: "Sharing active",
    statusRevoked: "Revoked",
    statusExpired: "Expired",
    scopePrefix: "Scope",
    scopeOrganization: "Organization share",
    scopeInvited: "Selected workers only",
    emptySessionId: "The share session ID is empty.",
    invalidSessionId: "Please check the share session ID.",
    sessionLoadFailed: "Could not load the session.",
    sessionVerified: "Share session for this recipient verified.",
    fallbackQuestion: "Shared task details have not loaded yet.",
    inactiveHelp: "Confirmation is currently blocked. Ask the manager to check the session status.",
    loading: "Loading share session...",
    workerNoticeNote: "This site notice is generated for the worker language.",
    inviteInfoTitle: "Check invitation",
    workerIdLabel: "Worker ID",
    workerIdPlaceholder: "Worker ID from the received link",
    missingInviteHint: "If invitation details are missing, ask the manager to send the link again.",
    confirmationTitle: "Read confirmation",
    displayNameLabel: "Display name",
    displayNamePlaceholder: "Name shown on the worker screen",
    languageLabel: "Language",
    confirmButton: "I have reviewed it",
    submittingButton: "Saving confirmation...",
    targetPrefix: "Recipient",
    anonymousGuideTitle: "Participant guide",
    anonymousGuideBody: "This page stores shared read confirmations. The worker roster is visible only to managers.",
    documentsTitle: "Three core documents",
    documentsNote: "Open detailed document text only when needed.",
    documentsLoadingTitle: "Document pack preparing",
    documentsLoadingBody: "The shared document body could not be loaded yet. Confirm the latest document pack with the manager before work.",
    displayNameRequired: "Please enter the worker display name.",
    missingWorkerId: "This link has no worker identifier, so confirmation cannot be saved.",
    confirmationFailed: "Could not save the read confirmation.",
    savedConfirmation: "Read confirmation saved.",
    savedManagerHistory: "The confirmation history has been saved for the manager.",
    alreadyConfirmed: "This task was already confirmed."
  }
};

function resolveRecipientPortalCopy(languageCode: string): RecipientPortalCopy {
  const normalized = languageCode.trim().toLowerCase();
  if (normalized === "vi") return RECIPIENT_PORTAL_COPY.vi;
  if (normalized === "en") return RECIPIENT_PORTAL_COPY.en;
  return RECIPIENT_PORTAL_COPY.ko;
}

function resolveSupportedLanguageCode(languageCode: string | null): "ko" | "vi" | "en" {
  const normalized = languageCode?.trim().toLowerCase();
  if (normalized === "vi") return "vi";
  if (normalized === "en") return "en";
  return "ko";
}

function initialRecipientPortalLanguageCode(): "ko" | "vi" | "en" {
  if (typeof window === "undefined") return "ko";
  const params = new URLSearchParams(window.location.search);
  return resolveSupportedLanguageCode(params.get("lang") || params.get("language"));
}

function formatShareStatus(status: ShareSessionPayload["status"], copy: RecipientPortalCopy): string {
  if (status === "active") return copy.statusActive;
  if (status === "revoked") return copy.statusRevoked;
  return copy.statusExpired;
}

function buildPreviewText(value: string, maxLength = 700): string {
  const text = value.replace(/\r\n/g, "\n").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function isValidShareSessionId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

export default function ShareRecipientPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [sessionMessage, setSessionMessage] = useState("");
  const [sessionPayload, setSessionPayload] = useState<ShareSessionPayload | null>(null);
  const [queryWorkerId, setQueryWorkerId] = useState<string | null>(null);
  const [workerId, setWorkerId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [languageCode, setLanguageCode] = useState<string>(initialRecipientPortalLanguageCode);
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
    const params = new URLSearchParams(window.location.search);
    const nextWorkerId = params.get("workerId") || "";
    const requestedLanguage = resolveSupportedLanguageCode(params.get("lang") || params.get("language"));
    setQueryWorkerId(nextWorkerId);
    setLanguageCode((current) => current === "ko" ? requestedLanguage : current);
    if (nextWorkerId) {
      setWorkerId((current) => current || nextWorkerId);
    }
  }, []);

  const fetchSession = useCallback(async () => {
    const activeCopy = resolveRecipientPortalCopy(languageCode);
    if (queryWorkerId === null) return;
    if (!sessionId) {
      setSessionMessage(activeCopy.emptySessionId);
      setFetchState("error");
      return;
    }
    if (!isValidShareSessionId(sessionId)) {
      setSessionPayload(null);
      setSessionMessage(activeCopy.invalidSessionId);
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
      setSessionMessage(activeCopy.sessionLoadFailed);
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
    setSessionMessage(activeCopy.sessionVerified);
    setFetchState("idle");
  }, [displayName, sessionId, languageCode, queryWorkerId, workerId]);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  const copy = useMemo(() => resolveRecipientPortalCopy(languageCode), [languageCode]);

  const doConfirm = useCallback(async () => {
    if (!sessionPayload || !sessionId) return;
    const body = requestBody();
    if (!body.displayName && sessionPayload.accessPolicy.requireKnownWorkerSnapshot) {
      setConfirmationMessage(copy.displayNameRequired);
      return;
    }
    if (!sessionPayload.accessPolicy.anonymousAllowed && !body.workerId) {
      setConfirmationMessage(copy.missingWorkerId);
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
      setConfirmationMessage(payload.message || copy.confirmationFailed);
      setFetchState("error");
      return;
    }
    setConfirmationMessage(copy.savedConfirmation);
    setIsIdempotent(Boolean(payload.idempotent));
    setConfirmationToken(payload.confirmationId || null);
    setFetchState("success");
    await fetchSession();
  }, [copy, sessionPayload, sessionId, requestBody, fetchSession]);

  const question = sessionPayload?.question || copy.fallbackQuestion;
  const status = sessionPayload ? sessionPayload.status : "active";
  const documents = sessionPayload?.documents || [];
  const requiresKnownWorker = sessionPayload?.accessPolicy.requireKnownWorkerSnapshot ?? true;
  const isAnonymousOpenSession = Boolean(sessionPayload?.accessPolicy.anonymousAllowed && !requiresKnownWorker);
  const needsManualWorkerIdentity = Boolean(sessionPayload && !isAnonymousOpenSession && !selectedRecipient);
  const canSubmit = fetchState !== "loading"
    && status === "active"
    && (
      isAnonymousOpenSession
      || Boolean(workerId.trim())
    );

  return (
      <SafeClawModuleShell
        eyebrow={copy.shellEyebrow}
        title={copy.shellTitle}
        description={copy.shellDescription}
      status="live"
      mappedTo={copy.shellMappedTo}
      activeHref="/share"
      actions={<Link href="/workspace">{copy.shellAction}</Link>}
      chromeLabels={{
        skipLink: copy.skipLink,
        railAria: copy.railAria,
        homeAria: copy.homeAria,
        menu: copy.menu,
        productSubtitle: copy.productSubtitle,
        mappedTo: copy.mappedToLabel,
        decisionAria: copy.decisionAria,
        siteContext: copy.siteContext,
        evidenceContext: copy.evidenceContext,
        weatherContext: copy.weatherContext,
        themeAria: copy.themeAria,
        dayLabel: copy.dayLabel,
        nightLabel: copy.nightLabel,
        status: {
          live: copy.statusLiveLabel,
          partial: copy.statusPartialLabel,
          planned: copy.statusPlannedLabel
        }
      }}
    >
      <section className="safeclaw-share-recipient-page">
        <h2>{copy.reviewTitle}</h2>
        <p className="safeclaw-subtitle">
          {isAnonymousOpenSession ? copy.anonymousSubtitle : copy.invitedSubtitle}
        </p>
        <article className="safeclaw-share-recipient-card">
          <h3>{copy.currentTaskTitle}</h3>
          <p>{question}</p>
          {sessionPayload?.expiresAt ? <p>{copy.expiresPrefix}: {formatIsoTime(sessionPayload.expiresAt)}</p> : null}
          <p>
            {copy.statusPrefix}: {formatShareStatus(sessionPayload?.status || "active", copy)}
          </p>
          <p>{copy.scopePrefix}: {sessionPayload?.shareScope === "organization" ? copy.scopeOrganization : copy.scopeInvited}</p>
          {sessionPayload?.status !== "active" ? (
            <p>{copy.inactiveHelp}</p>
          ) : null}
        </article>

        {!sessionPayload || fetchState === "loading" ? (
          <p className="safeclaw-hint">{copy.loading}</p>
        ) : (
          <>
            {sessionPayload.recipientMessage ? (
              <article className="safeclaw-share-recipient-card safeclaw-share-recipient-card-emphasis">
                <h3>{sessionPayload.recipientMessage.title}</h3>
                <p className="safeclaw-note">{copy.workerNoticeNote}</p>
                <pre className="safeclaw-share-recipient-preview">{buildPreviewText(sessionPayload.recipientMessage.body, 900)}</pre>
              </article>
            ) : null}

            {needsManualWorkerIdentity ? (
              <article className="safeclaw-share-recipient-card">
                <h3>{copy.inviteInfoTitle}</h3>
                <label>
                  {copy.workerIdLabel}
                  <input
                    type="text"
                    value={workerId}
                    onChange={(event) => setWorkerId(event.target.value)}
                    placeholder={copy.workerIdPlaceholder}
                    className="safeclaw-input"
                  />
                </label>
                <p className="safeclaw-hint">
                  {copy.missingInviteHint}
                </p>
              </article>
            ) : null}

          <article className="safeclaw-share-recipient-card">
                <h3>{copy.confirmationTitle}</h3>
              <label>
                {copy.displayNameLabel}
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder={copy.displayNamePlaceholder}
                  className="safeclaw-input"
                />
              </label>
              {hasManualLanguageSelection && availableLanguages.length ? (
                <label>
                  {copy.languageLabel}
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
                {fetchState === "submitting" ? copy.submittingButton : copy.confirmButton}
              </button>
              {confirmationMessage ? <p className="safeclaw-note">{confirmationMessage}</p> : null}
                {isIdempotent ? <p className="safeclaw-note">{copy.alreadyConfirmed}</p> : null}
              {confirmationToken ? <p className="safeclaw-note">{copy.savedManagerHistory}</p> : null}
              {selectedRecipient ? (
                <p className="safeclaw-note">
                  {copy.targetPrefix}: {selectedRecipient.displayName} ({buildLanguageLabel(selectedRecipient.languageCode)})
                </p>
              ) : null}
            </article>
            {isAnonymousOpenSession ? (
              <article className="safeclaw-share-recipient-card">
                <h3>{copy.anonymousGuideTitle}</h3>
                <p>{copy.anonymousGuideBody}</p>
              </article>
            ) : null}

            {documents.length ? (
              <article className="safeclaw-share-recipient-card">
                <h3>{copy.documentsTitle}</h3>
                <p className="safeclaw-note">{copy.documentsNote}</p>
                <div className="safeclaw-share-recipient-documents">
                  {documents.map((document) => (
                    <details key={document.key} className="safeclaw-share-recipient-document">
                      <summary>{document.title}</summary>
                      <pre className="safeclaw-share-recipient-preview">{buildPreviewText(document.body)}</pre>
                    </details>
                  ))}
                </div>
              </article>
            ) : (
              <article className="safeclaw-share-recipient-card">
                <h3>{copy.documentsLoadingTitle}</h3>
                <p>{copy.documentsLoadingBody}</p>
              </article>
            )}
          </>
        )}
      </section>
    </SafeClawModuleShell>
  );
}
