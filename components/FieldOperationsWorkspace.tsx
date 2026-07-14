"use client";

import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { CitationList } from "@/components/CitationList";
import { ClawChat } from "@/components/ClawChat";
import {
  createClawContextRequestSession,
  reportClawContextLoadFailure,
  resolveClawContextViewState,
  type ClawContextRequestSession,
  type ClawContextSiteOption as ClawSiteOption,
  type ClawContextStatus,
  type ClawContextViewState,
} from "@/lib/claw-chat-session";
import { OperationMemoryGraphViewer } from "@/components/OperationMemoryPreview";
import { WorkflowSharePanel } from "@/components/WorkflowSharePanel";
import {
  WorkpackEditor,
  type DocumentKey,
  type WorkpackDeliverablesChange,
  type WorkpackDocumentValues
} from "@/components/WorkpackEditor";
import {
  buildWorkpackGenerationFingerprint,
  buildStoredCurrentWorkpack,
  CURRENT_WORKPACK_STORAGE_KEY,
  parseStoredCurrentWorkpack,
  type CurrentDispatchSnapshot,
  type CurrentWorkerSnapshot
} from "@/lib/current-workpack";
import type { PhaseAPlanBinding } from "@/lib/ontology/evidence-chain";
import {
  buildPhaseAReviewUiState,
  isPhaseAReviewReadyForConfirmation,
  parsePhaseAReview
} from "@/lib/phase-a-review";
import type { AskResponse } from "@/lib/types";
import type { OperationMemoryGraph } from "@/lib/ontology/operation-memory";
import { applyWorkpackDeliverablesChange, type WorkpackReadiness } from "@/lib/workpack-readiness";
import { buildWorkspaceOperationMemoryGraph } from "@/lib/workspace-operation-graph";
import { resolveSavedWorkerIds } from "@/lib/workflow-share-client";
import {
  createBoundRequestGate,
  isAbortError,
  type BoundRequestHandle,
} from "@/lib/request-version-guard";
import {
  assessExactWorkpackConfirmation,
  createPendingWorkpackSaveBinding,
  inspectServerVerifiedWorkpackPayload,
  parsePhaseAWorkpackAuthority,
  parsePendingWorkpackSaveBinding,
  pendingWorkpackSaveMatches,
  PENDING_WORKPACK_SAVE_STORAGE_KEY,
  readPhaseAWorkpackGenerationSeal,
  type PhaseAWorkpackAuthority,
  type PhaseAWorkpackGenerationSeal,
  type PendingWorkpackSaveBinding,
  type WorkpackSaveLogicalContext,
} from "@/lib/workpack-authority";
import {
  buildDefaultWorkers,
  buildEducationRecordDrafts,
  buildRecipientSuggestions,
  buildWorkerDispatchTargets,
  maskPhone,
  summarizeWorkers,
  type EducationRecordDraft,
  type WorkerExperienceLevel,
  type WorkerProfile,
  type WorkerTrainingStatus
} from "@/lib/workspace";

type SaveResponse = {
  ok: boolean;
  configured: boolean;
  message: string;
  workpackId?: string | null;
  workerMap?: Record<string, string>;
  savedCount?: number;
  authority?: unknown;
  workpack?: unknown;
  created?: boolean;
  reopened?: boolean;
};

type StorageStatusLabel = "비회원 임시 저장" | "관리자 로그인 필요" | "관리자 이력 저장 완료" | "저장 실패";

type InitialWorkerState = {
  workers: WorkerProfile[];
  selectedWorkerIds: string[];
};

type WorkspaceSaveSnapshot = {
  ok: boolean;
  label: StorageStatusLabel;
  message: string;
  workpackId: string | null;
  savedAt: string | null;
  savedCount: number;
  workerMap: Record<string, string>;
  authority: PhaseAWorkpackAuthority | null;
  superseded?: boolean;
};

type ClawContextResponse = { sites?: ClawSiteOption[] };

type PhaseAConfirmationStatus =
  | "idle"
  | "saving"
  | "confirming"
  | "conflict"
  | "error"
  | "auth-expired"
  | "success";

type PhaseAConfirmationBinding = {
  authority: PhaseAWorkpackAuthority;
  generationFingerprint: string;
  generationSeal: PhaseAWorkpackGenerationSeal;
  question: string;
  chainId: PhaseAPlanBinding["chainId"];
  planDigest: string;
  sessionAccessToken: string;
  sessionUserId: string;
};

const PHASE_A_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readGenerationEvidenceUiBinding(data: AskResponse): PhaseAWorkpackGenerationSeal | null {
  const evidence: unknown = data.generationEvidence;
  if (!isRecord(evidence) || !isRecord(evidence.snapshot)) return null;
  if (
    typeof evidence.snapshot.question !== "string" ||
    evidence.snapshot.question !== data.question
  ) {
    return null;
  }
  return readPhaseAWorkpackGenerationSeal({
    version: evidence.version,
    algorithm: evidence.algorithm,
    signature: evidence.signature,
    generatedAt: evidence.snapshot.generatedAt,
    responseContentDigest: evidence.snapshot.responseContentDigest,
  });
}

function generationSealsMatch(
  actual: PhaseAWorkpackGenerationSeal,
  expected: PhaseAWorkpackGenerationSeal,
): boolean {
  return actual.version === expected.version
    && actual.algorithm === expected.algorithm
    && actual.signature === expected.signature
    && actual.generatedAt === expected.generatedAt
    && actual.responseContentDigest === expected.responseContentDigest;
}

async function readApiRecord(response: Response): Promise<Record<string, unknown>> {
  try {
    const payload: unknown = await response.json();
    return isRecord(payload) ? payload : {};
  } catch (error) {
    console.error("phase a confirmation response parse failed", error);
    return {};
  }
}

async function buildBrowserSessionFingerprint(accessToken: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("browser crypto is unavailable");
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(accessToken)
  );
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}

function parseApiWorkpack(value: unknown): AskResponse | null {
  if (!isRecord(value)) return null;
  const stored = parseStoredCurrentWorkpack(JSON.stringify({
    savedAt: new Date().toISOString(),
    source: "workspace",
    generationFingerprint: "server-verified",
    data: value,
  }));
  return stored?.data ?? null;
}

function parseServerSavedWorkpack(
  payload: SaveResponse,
  expectedGenerationSealAtCreate: PhaseAWorkpackGenerationSeal,
): { workpack: AskResponse; authority: PhaseAWorkpackAuthority } | null {
  const authority = parsePhaseAWorkpackAuthority(payload.authority);
  const workpack = parseApiWorkpack(payload.workpack);
  const currentSeal = workpack ? readGenerationEvidenceUiBinding(workpack) : null;
  if (
    payload.ok !== true
    || typeof payload.workpackId !== "string"
    || payload.workpackId !== authority?.workpackId
    || !workpack
    || !authority
    || !currentSeal
    || !generationSealsMatch(currentSeal, authority.generationSeal)
    || !generationSealsMatch(
      authority.idempotency.generationSealAtCreate,
      expectedGenerationSealAtCreate,
    )
  ) {
    return null;
  }
  return { workpack, authority };
}

async function parseServerConfirmedWorkpack(
  payload: Record<string, unknown>,
  binding: PhaseAConfirmationBinding,
  expectedConfirmationId?: string
): Promise<{ workpack: AskResponse; authority: PhaseAWorkpackAuthority } | null> {
  if (
    payload.ok !== true ||
    typeof payload.confirmationId !== "string" ||
    !PHASE_A_UUID_PATTERN.test(payload.confirmationId) ||
    !isRecord(payload.workpack)
  ) {
    return null;
  }
  if (expectedConfirmationId && payload.confirmationId !== expectedConfirmationId) return null;

  const workpack = parseApiWorkpack(payload.workpack);
  const authority = parsePhaseAWorkpackAuthority(payload.authority);
  if (!workpack || !authority) return null;
  const review = parsePhaseAReview(workpack.phaseAReview);
  const evidenceBinding = readGenerationEvidenceUiBinding(workpack);
  if (!review || !evidenceBinding || review.humanConfirmation.status !== "confirmed") return null;
  const confirmation = review.humanConfirmation;
  const sessionFingerprint = await buildBrowserSessionFingerprint(binding.sessionAccessToken);
  if (
    confirmation.confirmationId !== payload.confirmationId ||
    confirmation.workpackId !== binding.authority.workpackId ||
    confirmation.chainId !== binding.chainId ||
    confirmation.planDigest !== binding.planDigest ||
    confirmation.reviewer.userId !== binding.sessionUserId ||
    confirmation.reviewer.sessionFingerprint !== sessionFingerprint ||
    workpack.question !== binding.question ||
    evidenceBinding.generatedAt !== binding.generationSeal.generatedAt ||
    authority.workpackId !== binding.authority.workpackId ||
    authority.idempotency.version !== binding.authority.idempotency.version ||
    authority.idempotency.deterministicId !== binding.authority.idempotency.deterministicId ||
    authority.idempotency.scopeDigest !== binding.authority.idempotency.scopeDigest ||
    !generationSealsMatch(
      authority.idempotency.generationSealAtCreate,
      binding.authority.idempotency.generationSealAtCreate,
    ) ||
    Date.parse(authority.revision) < Date.parse(binding.authority.revision) ||
    !generationSealsMatch(evidenceBinding, authority.generationSeal)
  ) {
    return null;
  }
  return { workpack: { ...workpack, phaseAReview: review }, authority };
}

function resolveInitialWorkerState(data: AskResponse, generationFingerprint?: string): InitialWorkerState {
  const fallbackWorkers = buildDefaultWorkers(data);
  const fallback = {
    workers: fallbackWorkers,
    selectedWorkerIds: fallbackWorkers.map((worker) => worker.id)
  };
  if (typeof window === "undefined") return fallback;

  const stored = parseStoredCurrentWorkpack(window.localStorage.getItem(CURRENT_WORKPACK_STORAGE_KEY));
  const sameGeneration = stored && generationFingerprint
    ? stored.generationFingerprint === generationFingerprint
    : stored?.data.question === data.question;
  if (!stored?.workerSnapshot || !sameGeneration) return fallback;

  return {
    workers: stored.workerSnapshot.workers,
    selectedWorkerIds: stored.workerSnapshot.selectedWorkerIds
  };
}

type LearningExportFormat = "markdown" | "jsonl" | "obsidian";

type OperationGraphResponse = {
  ok: boolean;
  configured: boolean;
  graph?: OperationMemoryGraph;
  source?: {
    referenceCount: number;
    improvementCount: number;
    confirmationCount: number;
    retrievalMode: string;
  } | "unconfigured";
  message?: string;
};

type WorkerDraft = {
  displayName: string;
  role: string;
  joinedAt: string;
  experienceLevel: WorkerExperienceLevel;
  nationality: string;
  languageLabel: string;
  isForeignWorker: boolean;
  phone: string;
  email: string;
  consent: boolean;
};

type LanguageOption = {
  code: string;
  label: string;
};

const workerRoleOptions = ["작업자", "현장관리자", "작업반장", "신호수", "장비기사", "안전관리자"] as const;
const nationalityOptions = ["대한민국", "베트남", "중국", "몽골", "태국", "필리핀", "우즈베키스탄", "캄보디아", "인도네시아", "네팔", "확인 필요"] as const;
const languageOptions: LanguageOption[] = [
  { code: "ko", label: "한국어" },
  { code: "vi", label: "베트남어" },
  { code: "zh", label: "중국어" },
  { code: "mn", label: "몽골어" },
  { code: "th", label: "태국어" },
  { code: "tl", label: "타갈로그어" },
  { code: "uz", label: "우즈베크어" },
  { code: "km", label: "크메르어" },
  { code: "id", label: "인도네시아어" },
  { code: "ne", label: "네팔어" }
];

function readDownloadFileName(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch (error) {
      console.warn("learning export filename decode failed", error);
    }
  }
  return disposition.match(/filename="?([^";]+)"?/i)?.[1] || fallback;
}

let supabaseBrowserClient: SupabaseClient | null = null;

function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (!supabaseBrowserClient) {
    supabaseBrowserClient = createClient(url, anonKey);
  }
  return supabaseBrowserClient;
}

function buildInitialWorkerDraft(): WorkerDraft {
  return {
    displayName: "",
    role: "작업자",
    joinedAt: "2026-04-28",
    experienceLevel: "중간",
    nationality: "대한민국",
    languageLabel: "한국어",
    isForeignWorker: false,
    phone: "",
    email: "",
    consent: false
  };
}

function inferLanguageCode(nationality: string, languageLabel: string) {
  const selected = languageOptions.find((option) => option.label === languageLabel);
  if (selected) return selected.code;
  const combined = `${nationality} ${languageLabel}`.toLowerCase();
  if (/베트남|vietnam|tiếng/.test(combined)) return "vi";
  if (/중국|china|中文|중국어/.test(combined)) return "zh";
  if (/몽골|mongol|монгол/.test(combined)) return "mn";
  if (/태국|thai|ไทย/.test(combined)) return "th";
  if (/필리핀|tagalog|filipino/.test(combined)) return "tl";
  if (/우즈베키스탄|uzbek/.test(combined)) return "uz";
  if (/캄보디아|khmer|ភាសាខ្មែរ/.test(combined)) return "km";
  if (/인도네시아|indonesia|bahasa/.test(combined)) return "id";
  if (/네팔|nepal/.test(combined)) return "ne";
  return "ko";
}

function languageLabelFromCode(code: string) {
  return languageOptions.find((option) => option.code === code)?.label || "한국어";
}

function updateWorkerLanguage(worker: WorkerProfile, languageCode: string): WorkerProfile {
  const languageLabel = languageLabelFromCode(languageCode);
  return {
    ...worker,
    languageCode,
    languageLabel,
    trainingSummary: worker.trainingStatus === "이수"
      ? worker.trainingSummary
      : `${languageLabel} 안내와 작업 전 교육 확인 필요`
  };
}

function updateWorkerNationality(worker: WorkerProfile, nationality: string): WorkerProfile {
  return {
    ...worker,
    nationality,
    isForeignWorker: nationality !== "대한민국" && nationality !== "확인 필요"
  };
}

function AdminAccessPanel({
  session,
  storageSnapshot,
  onSessionChange
}: {
  session: Session | null;
  storageSnapshot: WorkspaceSaveSnapshot;
  onSessionChange: (session: Session | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const client = getSupabaseBrowserClient();

  useEffect(() => {
    if (!client) return;

    client.auth.getSession().then(({ data }) => {
      onSessionChange(data.session);
    }).catch((error: unknown) => {
      console.warn("supabase session load failed", error);
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      onSessionChange(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, [client, onSessionChange]);

  async function sendOtp() {
    if (!client || !email.trim()) return;
    setIsSending(true);
    setMessage("");
    try {
      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin }
      });
      if (error) throw error;
      setMessage("관리자 로그인 링크를 보냈습니다. 메일함에서 확인해 주세요.");
    } catch (error) {
      console.error("supabase otp send failed", error);
      setMessage("로그인 링크 발송에 실패했습니다. Supabase Auth 설정을 확인해 주세요.");
    } finally {
      setIsSending(false);
    }
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
    onSessionChange(null);
  }

  if (!client) {
    return (
      <article className="workspace-panel card">
        <div className="compact-head">
          <span className="eyebrow">이력 저장</span>
          <strong>{storageSnapshot.label}</strong>
        </div>
        <p className="muted small">PDF·XLS·HWPX 다운로드와 메일·문자 전파는 바로 사용할 수 있습니다. 관리자 로그인 시 작업자, 교육, 전파 이력이 저장됩니다.</p>
      </article>
    );
  }

  return (
    <article className="workspace-panel card">
      <div className="compact-head">
        <span className="eyebrow">관리자</span>
        <strong>{session ? storageSnapshot.label : "관리자 로그인"}</strong>
      </div>
      {session ? (
        <>
          <p className="muted small">{session.user.email || "관리자"} 계정으로 문서팩과 교육 이력을 저장합니다.</p>
          <div className="storage-status-grid" aria-label="저장 상태">
            <div><span>문서팩 ID</span><strong>{storageSnapshot.workpackId || "저장 전"}</strong></div>
            <div><span>저장 항목</span><strong>{storageSnapshot.savedCount}건</strong></div>
            <div><span>저장 시각</span><strong>{storageSnapshot.savedAt ? new Date(storageSnapshot.savedAt).toLocaleString("ko-KR") : "대기"}</strong></div>
          </div>
          <p className="muted small">{storageSnapshot.message}</p>
          <button type="button" className="button secondary full-button" onClick={signOut}>로그아웃</button>
        </>
      ) : (
        <>
          <input
            className="input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="관리자 이메일"
          />
          <button type="button" className="button full-button" onClick={sendOtp} disabled={isSending || !email.trim()}>
            {isSending ? "발송 중" : "로그인 링크 받기"}
          </button>
          {message ? <p className="muted small">{message}</p> : null}
        </>
      )}
    </article>
  );
}

function WorkerEducationPanel({
  workers,
  selectedWorkerIds,
  educationRecords,
  onToggleWorker,
  onUpdateWorker,
  onAddWorker
}: {
  workers: WorkerProfile[];
  selectedWorkerIds: string[];
  educationRecords: EducationRecordDraft[];
  onToggleWorker: (id: string) => void;
  onUpdateWorker: (worker: WorkerProfile) => void;
  onAddWorker: (draft: WorkerDraft) => void;
}) {
  const [draft, setDraft] = useState<WorkerDraft>(buildInitialWorkerDraft);
  const summary = summarizeWorkers(workers.filter((worker) => selectedWorkerIds.includes(worker.id)));

  function updateTrainingStatus(worker: WorkerProfile, trainingStatus: WorkerTrainingStatus) {
    onUpdateWorker({
      ...worker,
      trainingStatus,
      trainingSummary: trainingStatus === "이수" ? "당일 작업 전 교육 확인 완료" : worker.trainingSummary
    });
  }

  function addWorker() {
    if (!draft.displayName.trim()) return;
    onAddWorker(draft);
    setDraft(buildInitialWorkerDraft());
  }

  return (
    <article className="workspace-panel card worker-panel">
      <div className="compact-head">
        <span className="eyebrow">근로자</span>
        <strong>근로자·교육 확인</strong>
      </div>
      <div className="worker-summary-grid">
        <div><span>선택</span><strong>{summary.selectedCount}명</strong></div>
        <div><span>외국인</span><strong>{summary.foreignCount}명</strong></div>
        <div><span>신규</span><strong>{summary.newCount}명</strong></div>
        <div><span>교육확인</span><strong>{summary.educationPendingCount ? "필요" : "완료"}</strong></div>
      </div>

      <div className="worker-list">
        {workers.map((worker) => {
          const selected = selectedWorkerIds.includes(worker.id);
          const record = educationRecords.find((item) => item.workerId === worker.id);
          return (
            <div key={worker.id} className={`worker-card ${selected ? "selected" : ""}`}>
              <label className="worker-card-head">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleWorker(worker.id)}
                  aria-label={`${worker.displayName} 전파 대상 선택`}
                />
                <span>
                  <strong>{worker.displayName}</strong>
                  <small>{worker.role} · {worker.nationality} · {worker.languageLabel}</small>
                </span>
              </label>
              <div className="worker-facts">
                <span>투입일 {worker.joinedAt || "확인 필요"}</span>
                <span>{worker.experienceLevel}</span>
                <span>{worker.phone ? `문자 ${maskPhone(worker.phone)}` : "연락처 필요"}</span>
                <span>{worker.email ? "메일 가능" : "메일 필요"}</span>
              </div>
              <p className="muted small">{record?.memo || worker.trainingSummary}</p>
              <div className="worker-edit-grid" aria-label={`${worker.displayName} 기본정보 편집`}>
                <label>
                  <span>역할</span>
                  <select
                    className="input"
                    value={worker.role}
                    onChange={(event) => onUpdateWorker({ ...worker, role: event.target.value })}
                  >
                    {workerRoleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </label>
                <label>
                  <span>국적</span>
                  <select
                    className="input"
                    value={worker.nationality}
                    onChange={(event) => onUpdateWorker(updateWorkerNationality(worker, event.target.value))}
                  >
                    {nationalityOptions.map((nationality) => <option key={nationality} value={nationality}>{nationality}</option>)}
                  </select>
                </label>
                <label>
                  <span>언어</span>
                  <select
                    className="input"
                    value={worker.languageCode}
                    onChange={(event) => onUpdateWorker(updateWorkerLanguage(worker, event.target.value))}
                  >
                    {languageOptions.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>휴대폰</span>
                  <input
                    className="input"
                    value={worker.phone || ""}
                    onChange={(event) => onUpdateWorker({ ...worker, phone: event.target.value.trim() || undefined })}
                    placeholder="010-0000-0000"
                    inputMode="tel"
                  />
                </label>
                <label>
                  <span>이메일</span>
                  <input
                    className="input"
                    value={worker.email || ""}
                    onChange={(event) => onUpdateWorker({ ...worker, email: event.target.value.trim() || undefined })}
                    placeholder="worker@safeclaw.kr"
                    inputMode="email"
                  />
                </label>
              </div>
              <div className="worker-actions" role="radiogroup" aria-label={`${worker.displayName} 교육 확인 상태`}>
                {(["이수", "당일 교육 예정", "확인 필요"] as WorkerTrainingStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`status-chip ${worker.trainingStatus === status ? "active" : ""}`}
                    onClick={() => updateTrainingStatus(worker, status)}
                    role="radio"
                    aria-checked={worker.trainingStatus === status}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="worker-add-box">
        <strong>근로자 빠른 추가</strong>
        <input className="input" value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} placeholder="표시명" aria-label="근로자 표시명" />
        <div className="two-inputs">
          <select
            className="input"
            value={draft.role}
            onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))}
            aria-label="근로자 역할"
          >
            {workerRoleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <input
            className="input"
            value={draft.phone}
            onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
            placeholder="휴대폰(010-0000-0000)"
            aria-label="근로자 휴대폰 번호"
            inputMode="tel"
            pattern="^01[0-9]-?\\d{3,4}-?\\d{4}$"
          />
        </div>
        <div className="two-inputs">
          <select
            className="input"
            value={draft.nationality}
            onChange={(event) => setDraft((current) => ({
              ...current,
              nationality: event.target.value,
              isForeignWorker: event.target.value !== "대한민국" && event.target.value !== "확인 필요"
            }))}
            aria-label="근로자 국적"
          >
            {nationalityOptions.map((nationality) => <option key={nationality} value={nationality}>{nationality}</option>)}
          </select>
          <select
            className="input"
            value={inferLanguageCode(draft.nationality, draft.languageLabel)}
            onChange={(event) => setDraft((current) => ({
              ...current,
              languageLabel: languageLabelFromCode(event.target.value)
            }))}
            aria-label="근로자 주 사용 언어"
          >
            {languageOptions.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
          </select>
        </div>
        <input
          className="input"
          value={draft.email}
          onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
          placeholder="이메일(선택)"
          aria-label="근로자 이메일"
          inputMode="email"
        />
        <div className="consent-check">
          <input
            type="checkbox"
            aria-label="교육 확인 및 현장 전파 목적 개인정보 사용 동의"
            checked={draft.consent}
            onChange={(event) => setDraft((current) => ({ ...current, consent: event.target.checked }))}
          />
          <span>연락처·국적·언어 정보를 교육 확인과 현장 전파 목적으로 사용합니다.</span>
        </div>
        <button type="button" className="button secondary full-button" onClick={addWorker} disabled={!draft.displayName.trim() || !draft.consent}>명단에 추가</button>
      </div>
    </article>
  );
}

function EvidenceImpactPanel({ data }: { data: AskResponse }) {
  const phaseAState = buildPhaseAReviewUiState(data.phaseAReview);
  const koshaReferences = data.externalData.kosha.references.slice(0, 3);
  const accidentCases = data.externalData.accidentCases.cases.slice(0, 2);
  const safetyReferences = data.externalData.safetyReference?.items.slice(0, 3) || [];
  const hasEvidenceImpact = koshaReferences.length > 0 || accidentCases.length > 0 || safetyReferences.length > 0;
  const officialFallbackUrl = "https://www.kosha.or.kr/kosha/data/guidance.do";
  const safeExternalUrl = (url?: string) => (url && /^https?:\/\//.test(url) ? url : officialFallbackUrl);

  return (
    <section className="evidence-impact-grid workbench-evidence-rail" id="references">
      <article className="workspace-panel card">
        <div className="compact-head">
          <span className="eyebrow">{phaseAState.connectionLabel}</span>
          <strong>{phaseAState.evidenceHeading}</strong>
        </div>
        <div className="impact-list">
          {koshaReferences.map((item, index) => (
            <a
              key={`${item.title}-${index}`}
              href={safeExternalUrl(item.url)}
              target="_blank"
              rel="noreferrer"
              className="impact-card"
            >
              <strong>{item.title}</strong>
              <span>{item.agency || "KOSHA"} · {(item.appliesTo || item.appliedTo || ["위험성평가표"]).join(", ")}</span>
              <small>{item.summary}</small>
            </a>
          ))}
          {accidentCases.map((item, index) => (
            <a
              key={`${item.title}-${index}`}
              href={safeExternalUrl(item.sourceUrl)}
              target="_blank"
              rel="noreferrer"
              className="impact-card"
            >
              <strong>{item.title}</strong>
              <span>{phaseAState.authoritative ? "유사 재해사례 · TBM/교육 반영" : "유사 재해사례 · TBM/교육 검토 후보"}</span>
              <small>{item.preventionPoint}</small>
            </a>
          ))}
          {safetyReferences.map((item) => (
            <div key={item.id} className="impact-card">
              <strong>{item.displayTitle || item.title}</strong>
              <span>{item.sourceKindLabel || "안전 지식 DB"} · {(item.primaryDocuments || ["위험성평가표"]).join(", ")}</span>
              <small>{item.displaySummary || item.shortSummary || item.controls.slice(0, 2).join(", ")}</small>
            </div>
          ))}
          {!hasEvidenceImpact ? (
            <div className="impact-empty-state">
              <strong>공식자료 반영 대기</strong>
              <span>문서팩은 생성됐지만 KOSHA 자료 또는 재해사례 반영 근거가 아직 확인되지 않았습니다. 법령 근거와 현장 조치 문구는 계속 확인할 수 있습니다.</span>
            </div>
          ) : null}
        </div>
      </article>
      <CitationList citations={data.citations} question={data.question} phaseAReview={data.phaseAReview} />
    </section>
  );
}

function WorkpackHistoryPanel({
  session,
  storageSnapshot,
  onSaveWorkspace
}: {
  session: Session | null;
  storageSnapshot: WorkspaceSaveSnapshot;
  onSaveWorkspace: () => Promise<WorkspaceSaveSnapshot>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<LearningExportFormat | null>(null);
  const [downloadMessage, setDownloadMessage] = useState("");

  async function saveWorkspace() {
    setIsSaving(true);
    try {
      await onSaveWorkspace();
    } catch (error) {
      console.error("workspace save failed", error);
    } finally {
      setIsSaving(false);
    }
  }

  async function downloadLearningExport(format: LearningExportFormat) {
    if (!session || !storageSnapshot.workpackId) {
      setDownloadMessage("관리자 로그인 후 작업공간을 저장하면 현장 개선 메모리를 내려받을 수 있습니다.");
      return;
    }

    setDownloadingFormat(format);
    setDownloadMessage("");
    try {
      const response = await fetch(`/api/workpacks/${encodeURIComponent(storageSnapshot.workpackId)}/learning-export?format=${format}`, {
        headers: { authorization: `Bearer ${session.access_token}` }
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch((): unknown => null);
        const message = typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
          ? payload.message
          : "현장 개선 메모리 다운로드에 실패했습니다.";
        throw new Error(message);
      }

      const blob = await response.blob();
      const extension = format === "jsonl" ? "jsonl" : "md";
      const fileName = readDownloadFileName(
        response.headers.get("content-disposition"),
        `safeclaw-${storageSnapshot.workpackId}-learning.${extension}`
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      if (format === "jsonl") {
        setDownloadMessage("JSONL 운영 메모리를 내려받았습니다.");
      } else if (format === "obsidian") {
        setDownloadMessage("Obsidian용 작업 그래프 Markdown을 내려받았습니다.");
      } else {
        setDownloadMessage("Markdown 개선 메모리를 내려받았습니다.");
      }
    } catch (error) {
      console.error("learning export download failed", error);
      setDownloadMessage(error instanceof Error ? error.message : "현장 개선 메모리 다운로드 중 오류가 발생했습니다.");
    } finally {
      setDownloadingFormat(null);
    }
  }

  return (
    <article className="workspace-panel card" id="history">
      <div className="compact-head">
          <span className="eyebrow">이력</span>
        <strong>문서팩·교육 이력</strong>
      </div>
      <p className="muted small">작업자 배치, 교육 확인, 근거 요약, 문서팩 산출물을 같은 이력으로 저장합니다.</p>
      <div className="history-save-card">
        <span>{storageSnapshot.label}</span>
        <strong>{storageSnapshot.workpackId || "저장 전"}</strong>
        <small>{storageSnapshot.message}</small>
      </div>
      <button type="button" className="button full-button" onClick={saveWorkspace} disabled={isSaving}>
        {isSaving ? "저장 중" : session ? "작업공간 저장" : "관리자 로그인 후 저장"}
      </button>
      <div className="learning-export-actions" aria-label="현장 개선 메모리 다운로드">
        <button
          type="button"
          className="button secondary"
          onClick={() => downloadLearningExport("markdown")}
          disabled={!session || !storageSnapshot.workpackId || downloadingFormat !== null}
        >
          {downloadingFormat === "markdown" ? "내려받는 중" : "작업 이력 MD"}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => downloadLearningExport("jsonl")}
          disabled={!session || !storageSnapshot.workpackId || downloadingFormat !== null}
        >
          {downloadingFormat === "jsonl" ? "내려받는 중" : "하네스 JSONL"}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => downloadLearningExport("obsidian")}
          disabled={!session || !storageSnapshot.workpackId || downloadingFormat !== null}
        >
          {downloadingFormat === "obsidian" ? "내려받는 중" : "Obsidian MD"}
        </button>
      </div>
      <p className="muted small">
        저장된 작업팩만 다운로드됩니다. 개선사항, 근거 검색 출처, 열람 확인 이력을 관리자 검토용 운영 메모리 후보로 보관합니다.
      </p>
      {downloadMessage ? <p className="muted small">{downloadMessage}</p> : null}
    </article>
  );
}

function WorkspaceOperationGraphPanel({
  data,
  session,
  storageSnapshot
}: {
  data: AskResponse;
  session: Session | null;
  storageSnapshot: WorkspaceSaveSnapshot;
}) {
  const [generatedAt] = useState(() => new Date().toISOString());
  const [serverGraph, setServerGraph] = useState<OperationMemoryGraph | null>(null);
  const [graphMessage, setGraphMessage] = useState("");
  const authToken = session?.access_token || "";
  const workpackId = storageSnapshot.workpackId;
  const localGraph = useMemo(
    () => buildWorkspaceOperationMemoryGraph(data, {
      workpackId,
      generatedAt
    }),
    [data, generatedAt, workpackId]
  );

  useEffect(() => {
    if (!authToken || !workpackId) {
      setServerGraph(null);
      setGraphMessage("저장 전에는 현재 생성 결과와 DB 하네스 패킷으로 작업 이력 그래프를 임시 구성합니다.");
      return;
    }

    let cancelled = false;
    fetch(`/api/workpacks/${encodeURIComponent(workpackId)}/operation-graph`, {
      headers: { authorization: `Bearer ${authToken}` }
    }).then(async (response) => {
      const payload = await response.json().catch((): OperationGraphResponse => ({
        ok: false,
        configured: false,
        message: "작업 이력 그래프 응답을 읽지 못했습니다."
      })) as OperationGraphResponse;
      if (!response.ok || !payload.ok || !payload.graph) {
        throw new Error(payload.message || "저장된 작업 이력 그래프를 불러오지 못했습니다.");
      }
      if (cancelled) return;
      setServerGraph(payload.graph);
      setGraphMessage(typeof payload.source === "object"
        ? "저장된 작업팩, 개선사항, 열람 확인 이력을 Supabase에서 다시 구성했습니다."
        : "현재 생성 결과와 DB 하네스 패킷으로 작업 이력 그래프를 구성했습니다."
      );
    }).catch((error: unknown) => {
      if (cancelled) return;
      console.warn("workspace operation graph load failed", error);
      setServerGraph(null);
      setGraphMessage("저장 그래프 조회가 불안정해 현재 생성 결과 기준으로 표시합니다.");
    });

    return () => {
      cancelled = true;
    };
  }, [authToken, workpackId]);

  const graph = serverGraph || localGraph;
  const ackMessage = graph.summary.ackCount
    ? `열람 확인 ${graph.summary.ackCount}건이 Ack 노드로 연결됐습니다.`
    : "공유 후 작업자가 확인하면 Ack 노드가 채워집니다.";

  return (
    <OperationMemoryGraphViewer
      graph={graph}
      eyebrow="Operation Ontology"
      title="작업 이력 그래프"
      className="workspace-operation-memory"
      description={(
        <>
          오늘 문서팩이 사용한 DB 하네스 근거, 유사 과거 작업, 위험요인, 감소대책, 사진 개선사항, 열람 확인을 한 화면에서 연결합니다.{" "}
          {ackMessage}
        </>
      )}
      statusMessage={graphMessage}
    />
  );
}

export function FieldOperationsWorkspace({
  data,
  generationFingerprint,
  editorFocusToken = 0,
  requestedDocumentKey,
  readiness,
  initialWorkpackId = null,
  initialWorkpackAuthority = null,
  onDeliverablesChange,
  onWorkpackStateChange,
  surface = "full"
}: {
  data: AskResponse;
  generationFingerprint?: string;
  editorFocusToken?: number;
  requestedDocumentKey?: DocumentKey;
  readiness?: WorkpackReadiness;
  initialWorkpackId?: string | null;
  initialWorkpackAuthority?: PhaseAWorkpackAuthority | null;
  onDeliverablesChange?: (values: WorkpackDocumentValues, change: WorkpackDeliverablesChange) => void;
  onWorkpackStateChange?: (data: AskResponse, authority: PhaseAWorkpackAuthority) => void;
  surface?: "full" | "share" | "editor";
}) {
  const [initialWorkerState] = useState(() => resolveInitialWorkerState(data, generationFingerprint));
  const [editedDeliverables, setEditedDeliverables] = useState<WorkpackDocumentValues | null>(null);
  const dataRef = useRef(data);
  const onDeliverablesChangeRef = useRef(onDeliverablesChange);
  const onWorkpackStateChangeRef = useRef(onWorkpackStateChange);
  const lastEditorValuesRef = useRef<WorkpackDocumentValues | null>(null);
  const saveRequestGateRef = useRef(createBoundRequestGate<string>());
  const confirmationRequestGateRef = useRef(createBoundRequestGate<string>());
  const currentOperationBindingRef = useRef("");
  const requestInvalidationEpochRef = useRef(0);
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const activeClawAuthToken = session?.access_token;
  const [clawContextState, setClawContextState] = useState<ClawContextViewState>({
    authToken: null,
    siteOptions: [],
    selectedSiteId: null,
    status: "login-required",
  });
  const clawContextRequestSessionRef = useRef<ClawContextRequestSession | null>(null);
  if (!clawContextRequestSessionRef.current) {
    clawContextRequestSessionRef.current = createClawContextRequestSession();
  }
  const clawContextRequestSession = clawContextRequestSessionRef.current;
  const activeClawContext = resolveClawContextViewState(activeClawAuthToken, clawContextState);
  const clawSiteOptions = activeClawContext.siteOptions;
  const selectedClawSiteId = activeClawContext.selectedSiteId;
  const clawContextStatus: ClawContextStatus = activeClawContext.status;
  const [workers, setWorkers] = useState<WorkerProfile[]>(initialWorkerState.workers);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>(initialWorkerState.selectedWorkerIds);
  const [savedWorkpackId, setSavedWorkpackId] = useState<string | null>(null);
  const [savedWorkpackAuthority, setSavedWorkpackAuthority] = useState<PhaseAWorkpackAuthority | null>(null);
  const [savedWorkerMap, setSavedWorkerMap] = useState<Record<string, string>>({});
  const [pendingWorkpackSave, setPendingWorkpackSave] = useState<PendingWorkpackSaveBinding | null>(() => (
    typeof window === "undefined"
      ? null
      : parsePendingWorkpackSaveBinding(window.localStorage.getItem(PENDING_WORKPACK_SAVE_STORAGE_KEY))
  ));
  const [phaseAConfirmationBinding, setPhaseAConfirmationBinding] = useState<PhaseAConfirmationBinding | null>(null);
  const [phaseAConfirmationStatus, setPhaseAConfirmationStatus] = useState<PhaseAConfirmationStatus>("idle");
  const [phaseAConfirmationMessage, setPhaseAConfirmationMessage] = useState("");
  const [phaseAConfirmationRetryId, setPhaseAConfirmationRetryId] = useState<string | null>(null);
  const [storageSnapshot, setStorageSnapshot] = useState<WorkspaceSaveSnapshot>({
    ok: false,
    label: "비회원 임시 저장",
    message: "문서 편집 내용은 이 브라우저에 임시 저장됩니다. 관리자 로그인 후 이력을 저장할 수 있습니다.",
    workpackId: null,
    savedAt: null,
    savedCount: 0,
    workerMap: {},
    authority: null,
  });

  useEffect(() => {
    const token = activeClawAuthToken;
    if (!token) {
      setClawContextState({
        authToken: null,
        siteOptions: [],
        selectedSiteId: null,
        status: "login-required",
      });
      return;
    }

    const contextRequest = clawContextRequestSession.begin(token);
    setClawContextState({
      authToken: token,
      siteOptions: [],
      selectedSiteId: null,
      status: "loading",
    });
    fetch("/api/agent/context", {
      headers: { authorization: `Bearer ${token}` },
      signal: contextRequest.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`agent context request failed (${response.status})`);
        return await response.json() as ClawContextResponse;
      })
      .then((payload) => {
        const sites = Array.isArray(payload.sites)
          ? payload.sites.filter((site): site is ClawSiteOption => (
            typeof site?.id === "string" && typeof site.name === "string"
          ))
          : [];
        clawContextRequestSession.commit(contextRequest, () => {
          setClawContextState({
            authToken: token,
            siteOptions: sites,
            selectedSiteId: sites[0]?.id ?? null,
            status: sites.length > 0 ? "ready" : "unavailable",
          });
        });
      })
      .catch(() => {
        if (contextRequest.signal.aborted) return;
        clawContextRequestSession.commit(contextRequest, () => {
          reportClawContextLoadFailure();
          setClawContextState({
            authToken: token,
            siteOptions: [],
            selectedSiteId: null,
            status: "unavailable",
          });
        });
      });

    return () => clawContextRequestSession.cancel(contextRequest);
  }, [activeClawAuthToken, clawContextRequestSession]);
  useEffect(() => () => clawContextRequestSession.dispose(), [clawContextRequestSession]);

  const selectClawSite = useCallback((siteId: string) => {
    setClawContextState((current) => {
      const active = resolveClawContextViewState(activeClawAuthToken, current);
      return { ...active, selectedSiteId: siteId };
    });
  }, [activeClawAuthToken]);
  const workspaceData = useMemo<AskResponse>(() => (
    editedDeliverables
      ? { ...data, deliverables: { ...data.deliverables, ...editedDeliverables } }
      : data
  ), [data, editedDeliverables]);
  const parsedPhaseAReview = useMemo(
    () => parsePhaseAReview(workspaceData.phaseAReview),
    [workspaceData.phaseAReview]
  );
  const phaseAPlanBinding = parsedPhaseAReview?.planBinding ?? null;
  const generationEvidenceBinding = useMemo(
    () => readGenerationEvidenceUiBinding(workspaceData),
    [workspaceData]
  );
  const currentGenerationFingerprint = useMemo(
    () => buildWorkpackGenerationFingerprint(workspaceData),
    [workspaceData]
  );
  const generationBindingMatches = Boolean(
    generationFingerprint && currentGenerationFingerprint === generationFingerprint
  );
  const phaseAReadyForConfirmation = Boolean(
    parsedPhaseAReview && isPhaseAReviewReadyForConfirmation(parsedPhaseAReview)
  );
  const restoredConfirmedWorkpackAuthority = initialWorkpackId
    && initialWorkpackAuthority
    && initialWorkpackAuthority.workpackId === initialWorkpackId
    && generationEvidenceBinding
    && generationSealsMatch(initialWorkpackAuthority.generationSeal, generationEvidenceBinding)
    && assessExactWorkpackConfirmation(parsedPhaseAReview ?? undefined, initialWorkpackId).ok
    ? initialWorkpackAuthority
    : null;
  const restoredConfirmedWorkpackId = restoredConfirmedWorkpackAuthority?.workpackId ?? null;
  const effectiveSavedWorkpackId = savedWorkpackId ?? restoredConfirmedWorkpackId;
  const effectiveSavedWorkpackAuthority = savedWorkpackAuthority ?? restoredConfirmedWorkpackAuthority;
  const confirmationBindingIsCurrent = Boolean(
    phaseAConfirmationBinding &&
    savedWorkpackId === phaseAConfirmationBinding.authority.workpackId &&
    savedWorkpackAuthority?.revision === phaseAConfirmationBinding.authority.revision &&
    generationFingerprint === phaseAConfirmationBinding.generationFingerprint &&
    currentGenerationFingerprint === phaseAConfirmationBinding.generationFingerprint &&
    generationEvidenceBinding &&
    generationSealsMatch(generationEvidenceBinding, phaseAConfirmationBinding.generationSeal) &&
    workspaceData.question === phaseAConfirmationBinding.question &&
    phaseAPlanBinding?.chainId === phaseAConfirmationBinding.chainId &&
    phaseAPlanBinding.planDigest === phaseAConfirmationBinding.planDigest &&
    session?.access_token === phaseAConfirmationBinding.sessionAccessToken &&
    session.user.id === phaseAConfirmationBinding.sessionUserId
  );
  const workpackOperationBinding = useMemo(() => JSON.stringify({
    generationFingerprint: generationFingerprint ?? null,
    currentGenerationFingerprint,
    generationSeal: generationEvidenceBinding,
    question: workspaceData.question,
    planBinding: phaseAPlanBinding,
    sessionUserId: session?.user.id ?? null,
    sessionAccessToken: session?.access_token ?? null,
    workers,
    selectedWorkerIds,
  }), [
    currentGenerationFingerprint,
    generationEvidenceBinding,
    generationFingerprint,
    phaseAPlanBinding,
    selectedWorkerIds,
    session?.access_token,
    session?.user.id,
    workers,
    workspaceData.question,
  ]);
  currentOperationBindingRef.current = workpackOperationBinding;

  useEffect(() => {
    saveRequestGateRef.current.abortCurrent();
    confirmationRequestGateRef.current.abortCurrent();
    setPhaseAConfirmationStatus((current) => (
      current === "saving" || current === "confirming" ? "idle" : current
    ));
  }, [workpackOperationBinding]);

  useEffect(() => () => {
    saveRequestGateRef.current.abortCurrent();
    confirmationRequestGateRef.current.abortCurrent();
  }, []);

  const invalidateWorkspaceRequests = useCallback(() => {
    requestInvalidationEpochRef.current += 1;
    currentOperationBindingRef.current = `invalidated:${requestInvalidationEpochRef.current}`;
    saveRequestGateRef.current.abortCurrent();
    confirmationRequestGateRef.current.abortCurrent();
  }, []);
  const applySession = useCallback((nextSession: Session | null) => {
    const current = sessionRef.current;
    if (
      current?.access_token === nextSession?.access_token
      && current?.user.id === nextSession?.user.id
    ) {
      return;
    }
    sessionRef.current = nextSession;
    invalidateWorkspaceRequests();
    setSession(nextSession);
  }, [invalidateWorkspaceRequests]);
  const selectedWorkers = useMemo(
    () => workers.filter((worker) => selectedWorkerIds.includes(worker.id)),
    [selectedWorkerIds, workers]
  );
  const educationRecords = useMemo(
    () => buildEducationRecordDrafts(workers, data.scenario.workSummary),
    [data.scenario.workSummary, workers]
  );
  const recipientSuggestions = useMemo(
    () => buildRecipientSuggestions(selectedWorkers),
    [selectedWorkers]
  );
  const targetWorkers = useMemo(
    () => buildWorkerDispatchTargets(selectedWorkers),
    [selectedWorkers]
  );
  const savedWorkerIds = useMemo(() => {
    if (!effectiveSavedWorkpackId || !selectedWorkerIds.length) return [];
    if (selectedWorkerIds.some((workerId) => !savedWorkerMap[workerId])) return [];
    try {
      return resolveSavedWorkerIds(savedWorkerMap, selectedWorkerIds);
    } catch (error) {
      console.warn("saved worker UUID resolution failed", error);
      return [];
    }
  }, [effectiveSavedWorkpackId, savedWorkerMap, selectedWorkerIds]);
  const workerSnapshot = useMemo<CurrentWorkerSnapshot>(() => ({
    savedAt: new Date().toISOString(),
    source: "workspace",
    workers,
    selectedWorkerIds
  }), [selectedWorkerIds, workers]);
  const dispatchSnapshot = useMemo<CurrentDispatchSnapshot>(() => ({
    savedAt: new Date().toISOString(),
    source: "workspace",
    recipientSuggestions,
    targetWorkers
  }), [recipientSuggestions, targetWorkers]);
  const workerSnapshotRef = useRef(workerSnapshot);
  const dispatchSnapshotRef = useRef(dispatchSnapshot);

  useEffect(() => {
    if (surface !== "share") return;
    const client = getSupabaseBrowserClient();
    if (!client) return;

    client.auth.getSession().then(({ data: sessionData }) => {
      applySession(sessionData.session);
    }).catch((error: unknown) => {
      console.warn("supabase share session load failed", error);
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, [applySession, surface]);

  useEffect(() => {
    dataRef.current = data;
    onDeliverablesChangeRef.current = onDeliverablesChange;
    onWorkpackStateChangeRef.current = onWorkpackStateChange;
    workerSnapshotRef.current = workerSnapshot;
    dispatchSnapshotRef.current = dispatchSnapshot;
  }, [data, dispatchSnapshot, onDeliverablesChange, onWorkpackStateChange, workerSnapshot]);

  useEffect(() => {
    setEditedDeliverables(null);
    lastEditorValuesRef.current = null;
  }, [generationFingerprint, invalidateWorkspaceRequests]);

  const handleDeliverablesChange = useCallback((values: WorkpackDocumentValues, change: WorkpackDeliverablesChange) => {
    const previousValues = lastEditorValuesRef.current;
    const documentKeys = Object.keys(values) as DocumentKey[];
    if (previousValues && documentKeys.every((key) => previousValues[key] === values[key])) return;
    lastEditorValuesRef.current = values;
    setEditedDeliverables((current) => {
      const currentDocuments: Partial<Record<DocumentKey, string>> = current ?? dataRef.current.deliverables;
      return documentKeys.every((key) => currentDocuments[key] === values[key]) ? current : values;
    });
    if (change.requiresRevalidation) {
      invalidateWorkspaceRequests();
      setSavedWorkpackId(null);
      setSavedWorkpackAuthority(null);
      setSavedWorkerMap({});
      clearPendingWorkpackSave();
      setPhaseAConfirmationBinding(null);
      setPhaseAConfirmationRetryId(null);
      setPhaseAConfirmationStatus("idle");
      setPhaseAConfirmationMessage("편집 내용을 반영한 뒤 근거를 다시 검수하고 현재 작업팩을 저장해 주세요.");
      setStorageSnapshot({
        ok: false,
        label: "비회원 임시 저장",
        message: "편집으로 기존 서버 확인이 무효화되었습니다. 재검수 후 현재 작업팩을 다시 저장해 주세요.",
        workpackId: null,
        savedAt: null,
        savedCount: 0,
        workerMap: {},
        authority: null,
      });
    }
    onDeliverablesChangeRef.current?.(values, change);
    if (typeof window === "undefined") return;
    const currentData = dataRef.current;
    const nextData = applyWorkpackDeliverablesChange(currentData, values, change);
    try {
      window.localStorage.setItem(
        CURRENT_WORKPACK_STORAGE_KEY,
        JSON.stringify(buildStoredCurrentWorkpack(nextData, {
          generationFingerprint,
          workerSnapshot: workerSnapshotRef.current,
          dispatchSnapshot: dispatchSnapshotRef.current
        }))
      );
    } catch (error) {
      console.warn("safeclaw current workpack update failed", error);
    }
  }, [generationFingerprint]);
  const workerSummary = summarizeWorkers(selectedWorkers);
  const pilotChecklist = [
    ["PLAN", "계획", `${workspaceData.citations.length}건 근거 · 위험성평가·작업계획`],
    ["DO", "실행", `TBM·교육 · ${workerSummary.selectedCount}명 대상`],
    ["CHECK", "확인", `교육확인 ${workerSummary.educationPendingCount ? "필요" : "완료"} · 증빙 보관`],
    ["ACT", "개선", session ? "이력 저장·후속조치" : "다운로드 후 현장 확인"],
    ["ISO", "운영체계", "법규·문서관리·감사추적"]
  ] as const;

  function canCommitWorkspaceRequest(request: BoundRequestHandle<string>): boolean {
    return saveRequestGateRef.current.canCommit(request, currentOperationBindingRef.current);
  }

  function canCommitConfirmationRequest(request: BoundRequestHandle<string>): boolean {
    return confirmationRequestGateRef.current.canCommit(request, currentOperationBindingRef.current);
  }

  async function postJson<TResponse>(
    url: string,
    body: unknown,
    signal: AbortSignal,
  ): Promise<TResponse> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${session?.access_token || ""}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      signal,
    });
    return await response.json() as TResponse;
  }

  function persistPendingWorkpackSave(binding: PendingWorkpackSaveBinding | null) {
    setPendingWorkpackSave(binding);
    if (typeof window === "undefined") return;
    try {
      if (binding) {
        window.localStorage.setItem(PENDING_WORKPACK_SAVE_STORAGE_KEY, JSON.stringify(binding));
      } else {
        window.localStorage.removeItem(PENDING_WORKPACK_SAVE_STORAGE_KEY);
      }
    } catch (error) {
      console.warn("pending workpack save binding persistence failed", error);
    }
  }

  function clearPendingWorkpackSave() {
    persistPendingWorkpackSave(null);
  }

  function buildSaveLogicalContext(): WorkpackSaveLogicalContext | null {
    if (!session || !generationFingerprint) return null;
    return {
      generationFingerprint,
      sessionUserId: session.user.id,
      workers,
      selectedWorkerIds,
    };
  }

  async function resolveCurrentWorkerMap(request: BoundRequestHandle<string>): Promise<SaveResponse> {
    const workerResponse = await postJson<SaveResponse>("/api/workers", {
      scenario: workspaceData.scenario,
      workers,
    }, request.signal);
    if (!canCommitWorkspaceRequest(request)) {
      return { ok: false, configured: true, message: "저장 요청이 새 작업 상태로 대체되었습니다." };
    }
    if (!workerResponse.ok) return workerResponse;
    const workerMap = workerResponse.workerMap || {};
    try {
      resolveSavedWorkerIds(workerMap, selectedWorkerIds);
    } catch (error) {
      console.warn("server worker mapping validation failed", error);
      return {
        ok: false,
        configured: workerResponse.configured,
        message: error instanceof Error ? error.message : "선택한 작업자의 서버 저장 ID를 확인하지 못했습니다.",
        workerMap,
      };
    }
    return { ...workerResponse, workerMap };
  }

  function supersededSaveSnapshot(): WorkspaceSaveSnapshot {
    return {
      ...storageSnapshot,
      ok: false,
      message: "저장 요청이 새 작업 상태로 대체되었습니다.",
      superseded: true,
    };
  }

  function setStorageFailure(
    message: string,
    partial = pendingWorkpackSave,
    request?: BoundRequestHandle<string>,
  ) {
    if (request && !canCommitWorkspaceRequest(request)) return supersededSaveSnapshot();
    const snapshot: WorkspaceSaveSnapshot = {
      ok: false,
      label: "저장 실패",
      message,
      workpackId: partial?.workpackId ?? effectiveSavedWorkpackId,
      savedAt: null,
      savedCount: 0,
      workerMap: partial?.workerMap ?? savedWorkerMap,
      authority: effectiveSavedWorkpackAuthority,
    };
    setStorageSnapshot(snapshot);
    return snapshot;
  }

  async function saveWorkspaceToSupabase(): Promise<WorkspaceSaveSnapshot> {
    if (!session) {
      const snapshot: WorkspaceSaveSnapshot = {
        ok: false,
        label: "관리자 로그인 필요",
        message: "관리자 로그인 후 문서팩, 작업자, 교육 확인, 전파 이력을 저장할 수 있습니다.",
        workpackId: effectiveSavedWorkpackId,
        savedAt: null,
        savedCount: 0,
        workerMap: savedWorkerMap,
        authority: effectiveSavedWorkpackAuthority,
      };
      setStorageSnapshot(snapshot);
      return snapshot;
    }

    if (!selectedWorkerIds.length) {
      return setStorageFailure("저장할 작업자를 한 명 이상 선택해 주세요.", null);
    }
    const logicalContext = buildSaveLogicalContext();
    if (!logicalContext) {
      return setStorageFailure("현재 생성본의 저장 바인딩을 확인할 수 없습니다. 문서를 다시 생성해 주세요.", null);
    }
    if (!generationEvidenceBinding) {
      return setStorageFailure("현재 생성본의 서버 생성 봉인을 확인할 수 없습니다. 문서를 다시 생성해 주세요.", null);
    }

    const request = saveRequestGateRef.current.begin(currentOperationBindingRef.current);
    confirmationRequestGateRef.current.abortCurrent();

    try {
      let partial = pendingWorkpackSave;
      if (!partial && typeof window !== "undefined") {
        partial = parsePendingWorkpackSaveBinding(
          window.localStorage.getItem(PENDING_WORKPACK_SAVE_STORAGE_KEY),
        );
      }
      if (partial && !pendingWorkpackSaveMatches(partial, logicalContext)) {
        clearPendingWorkpackSave();
        partial = null;
      }

      const reusableAuthorityCandidate = effectiveSavedWorkpackId
        && effectiveSavedWorkpackAuthority?.workpackId === effectiveSavedWorkpackId
        && generationSealsMatch(effectiveSavedWorkpackAuthority.generationSeal, generationEvidenceBinding)
        ? effectiveSavedWorkpackAuthority
        : null;
      const confirmedWorkspace = parsedPhaseAReview?.humanConfirmation.status === "confirmed";
      if (confirmedWorkspace && !reusableAuthorityCandidate) {
        return setStorageFailure(
          "확인 완료 작업팩은 정확한 서버 행 authority를 다시 검증해야 저장을 계속할 수 있습니다.",
          null,
          request,
        );
      }

      let workpackMessage = "현재 서버 작업팩의 ID, revision, 생성 봉인을 재사용했습니다.";
      let reusableServerSaved: { workpack: AskResponse; authority: PhaseAWorkpackAuthority } | null = null;
      if (confirmedWorkspace && reusableAuthorityCandidate) {
        const response = await fetch(
          `/api/workpacks/${encodeURIComponent(reusableAuthorityCandidate.workpackId)}`,
          {
            headers: { authorization: `Bearer ${session.access_token}` },
            signal: request.signal,
          },
        );
        if (!canCommitWorkspaceRequest(request)) return supersededSaveSnapshot();
        const payload = await readApiRecord(response);
        if (!canCommitWorkspaceRequest(request)) return supersededSaveSnapshot();
        const verified = response.ok
          ? inspectServerVerifiedWorkpackPayload(payload, reusableAuthorityCandidate.workpackId)
          : null;
        if (
          !verified
          || !assessExactWorkpackConfirmation(verified.workpack.data.phaseAReview, verified.id).ok
          || verified.authority.idempotency.scopeDigest !== reusableAuthorityCandidate.idempotency.scopeDigest
          || !generationSealsMatch(
            verified.authority.idempotency.generationSealAtCreate,
            reusableAuthorityCandidate.idempotency.generationSealAtCreate,
          )
        ) {
          return setStorageFailure(
            "확인 완료 작업팩의 서버 ID, revision, 생성 봉인 또는 정확한 확인을 재검증하지 못했습니다.",
            null,
            request,
          );
        }
        reusableServerSaved = {
          workpack: verified.workpack.data,
          authority: verified.authority,
        };
        workpackMessage = "확인 완료 서버 작업팩의 ID, revision, 생성 봉인을 다시 검증했습니다.";
      }

      const workerResponse = await resolveCurrentWorkerMap(request);
      if (!canCommitWorkspaceRequest(request)) return supersededSaveSnapshot();
      if (!workerResponse.ok) return setStorageFailure(workerResponse.message, null, request);
      const workerMap = workerResponse.workerMap || {};

      let serverSaved = reusableServerSaved;
      if (!serverSaved) {
        const workpackResponse = await postJson<SaveResponse>("/api/workpacks", {
          data: workspaceData,
          workerSummary: {
            ...summarizeWorkers(selectedWorkers),
            selectedWorkers: buildWorkerDispatchTargets(selectedWorkers),
          },
        }, request.signal);
        if (!canCommitWorkspaceRequest(request)) return supersededSaveSnapshot();
        if (!workpackResponse.ok || !workpackResponse.workpackId) {
          return setStorageFailure(workpackResponse.message, null, request);
        }
        serverSaved = parseServerSavedWorkpack(workpackResponse, generationEvidenceBinding);
        if (!serverSaved) {
          console.error("workpack save response authority validation failed");
          return setStorageFailure(
            "서버 작업팩의 ID, revision 또는 생성 봉인을 검증하지 못했습니다.",
            null,
            request,
          );
        }
        workpackMessage = workpackResponse.message;
      }
      partial = createPendingWorkpackSaveBinding({
        context: logicalContext,
        workpackId: serverSaved.authority.workpackId,
        workerMap,
      });
      persistPendingWorkpackSave(partial);

      const workpackId = serverSaved.authority.workpackId;

      const selectedEducationRecords = educationRecords.filter((record) => (
        selectedWorkers.some((worker) => worker.id === record.workerId)
      ));
      const educationResponse = await postJson<SaveResponse>("/api/education-records", {
        scenario: workspaceData.scenario,
        workpackId,
        workerMap,
        workers,
        records: selectedEducationRecords
      }, request.signal);
      if (!canCommitWorkspaceRequest(request)) return supersededSaveSnapshot();
      if (!educationResponse.ok) return setStorageFailure(educationResponse.message, partial, request);

      setSavedWorkpackId(workpackId);
      setSavedWorkpackAuthority(serverSaved.authority);
      setSavedWorkerMap(workerMap);
      clearPendingWorkpackSave();
      const serverReview = parsePhaseAReview(serverSaved.workpack.phaseAReview);
      const serverGenerationSeal = readGenerationEvidenceUiBinding(serverSaved.workpack);
      const serverFingerprint = buildWorkpackGenerationFingerprint(serverSaved.workpack);
      if (
        serverReview &&
        isPhaseAReviewReadyForConfirmation(serverReview) &&
        serverReview.planBinding &&
        serverFingerprint === generationFingerprint &&
        generationFingerprint &&
        serverGenerationSeal
      ) {
        setPhaseAConfirmationBinding({
          authority: serverSaved.authority,
          generationFingerprint,
          generationSeal: serverGenerationSeal,
          question: serverSaved.workpack.question,
          chainId: serverReview.planBinding.chainId,
          planDigest: serverReview.planBinding.planDigest,
          sessionAccessToken: session.access_token,
          sessionUserId: session.user.id,
        });
        setPhaseAConfirmationRetryId(null);
        setPhaseAConfirmationMessage("현재 생성 근거와 계획에 묶인 작업팩을 저장했습니다. 서버 확인을 진행할 수 있습니다.");
      } else {
        setPhaseAConfirmationBinding(null);
        if (assessExactWorkpackConfirmation(serverReview ?? undefined, workpackId).ok) {
          setPhaseAConfirmationStatus("success");
          setPhaseAConfirmationMessage("기존 서버 작업팩의 Phase A 확인과 생성 봉인을 재검증해 다시 열었습니다.");
        }
      }

      const savedCount = 1 + workers.length + (educationResponse.savedCount || selectedEducationRecords.length);
      const snapshot: WorkspaceSaveSnapshot = {
        ok: true,
        label: "관리자 이력 저장 완료",
        message: `${workpackMessage} ${workerResponse.message} ${educationResponse.message}`,
        workpackId,
        savedAt: serverSaved.authority.updatedAt,
        savedCount,
        workerMap,
        authority: serverSaved.authority,
      };
      setStorageSnapshot(snapshot);
      if (serverFingerprint !== currentGenerationFingerprint) {
        dataRef.current = serverSaved.workpack;
        setEditedDeliverables(null);
        lastEditorValuesRef.current = null;
        onWorkpackStateChangeRef.current?.(serverSaved.workpack, serverSaved.authority);
      }
      return snapshot;
    } catch (error) {
      if (!canCommitWorkspaceRequest(request) || isAbortError(error)) {
        return supersededSaveSnapshot();
      }
      console.error("workspace save failed", error);
      return setStorageFailure(
        "작업공간 저장 중 오류가 발생했습니다. Supabase 설정과 로그인 상태를 확인해 주세요.",
        undefined,
        request,
      );
    } finally {
      saveRequestGateRef.current.finish(request);
    }
  }

  async function ensureWorkpackSaved() {
    if (
      effectiveSavedWorkpackId
      && effectiveSavedWorkpackAuthority?.workpackId === effectiveSavedWorkpackId
      && selectedWorkerIds.every((workerId) => Boolean(savedWorkerMap[workerId]))
    ) {
      return {
        workpackId: effectiveSavedWorkpackId,
        workerIds: resolveSavedWorkerIds(savedWorkerMap, selectedWorkerIds)
      };
    }
    const snapshot = await saveWorkspaceToSupabase();
    if (!snapshot.ok || !snapshot.workpackId) return null;
    return {
      workpackId: snapshot.workpackId,
      workerIds: resolveSavedWorkerIds(snapshot.workerMap, selectedWorkerIds)
    };
  }

  async function saveCurrentWorkpackForPhaseA() {
    if (!session) {
      setPhaseAConfirmationStatus("auth-expired");
      setPhaseAConfirmationMessage("관리자 로그인 후 현재 작업팩을 저장해 주세요.");
      return;
    }
    if (!phaseAReadyForConfirmation || !generationBindingMatches || !generationEvidenceBinding) {
      setPhaseAConfirmationStatus("error");
      setPhaseAConfirmationMessage("현재 문서의 근거 검수 또는 생성 근거 봉인이 유효하지 않습니다. 문서를 다시 검수해 주세요.");
      return;
    }
    setPhaseAConfirmationStatus("saving");
    setPhaseAConfirmationMessage("현재 생성 근거와 계획을 서버 작업팩에 저장하고 있습니다.");
    const requestBinding = currentOperationBindingRef.current;
    const snapshot = await saveWorkspaceToSupabase();
    if (snapshot.superseded || currentOperationBindingRef.current !== requestBinding) return;
    if (!snapshot.ok || !snapshot.workpackId) {
      setPhaseAConfirmationStatus("error");
      setPhaseAConfirmationMessage(snapshot.message);
      return;
    }
    setPhaseAConfirmationStatus("idle");
  }

  async function confirmCurrentPhaseAWorkpack() {
    const binding = phaseAConfirmationBinding;
    if (!session) {
      setPhaseAConfirmationStatus("auth-expired");
      setPhaseAConfirmationMessage("관리자 로그인 세션이 없습니다. 다시 로그인한 뒤 현재 작업팩을 저장해 주세요.");
      return;
    }
    if (!binding || !confirmationBindingIsCurrent || !phaseAReadyForConfirmation) {
      setPhaseAConfirmationBinding(null);
      setPhaseAConfirmationRetryId(null);
      setPhaseAConfirmationStatus("error");
      setPhaseAConfirmationMessage("현재 작업팩의 생성 근거, 계획 또는 로그인 바인딩이 달라졌습니다. 현재 작업팩을 다시 저장해 주세요.");
      return;
    }

    const request = confirmationRequestGateRef.current.begin(currentOperationBindingRef.current);
    const retryConfirmationId = phaseAConfirmationRetryId;
    setPhaseAConfirmationStatus("confirming");
    setPhaseAConfirmationMessage("서버에서 인증 세션과 작업팩 근거를 확인하고 있습니다.");
    try {
      const response = await fetch(
        `/api/workpacks/${encodeURIComponent(binding.authority.workpackId)}/phase-a-confirmation`,
        {
          method: "POST",
          headers: {
            "authorization": `Bearer ${session.access_token}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            chainId: binding.chainId,
            planDigest: binding.planDigest,
            revision: binding.authority.revision,
            ...(retryConfirmationId ? { confirmationId: retryConfirmationId } : {})
          }),
          signal: request.signal,
        }
      );
      if (!canCommitConfirmationRequest(request)) return;
      const payload = await readApiRecord(response);
      if (!canCommitConfirmationRequest(request)) return;
      const responseMessage = typeof payload.message === "string"
        ? payload.message
        : "Phase A 확인 요청을 처리하지 못했습니다.";

      if (response.status === 401) {
        setSavedWorkpackId(null);
        setSavedWorkpackAuthority(null);
        setSavedWorkerMap({});
        setPhaseAConfirmationBinding(null);
        setPhaseAConfirmationRetryId(null);
        setPhaseAConfirmationStatus("auth-expired");
        setPhaseAConfirmationMessage("로그인 세션이 만료되었습니다. 다시 로그인한 뒤 현재 작업팩을 저장해 주세요.");
        return;
      }

      if (response.status === 409) {
        const confirmationId = typeof payload.confirmationId === "string" && PHASE_A_UUID_PATTERN.test(payload.confirmationId)
          ? payload.confirmationId
          : null;
        if (confirmationId) {
          setPhaseAConfirmationRetryId(confirmationId);
          setPhaseAConfirmationStatus("conflict");
          setPhaseAConfirmationMessage(responseMessage);
          return;
        }
        setSavedWorkpackId(null);
        setSavedWorkpackAuthority(null);
        setSavedWorkerMap({});
        setPhaseAConfirmationBinding(null);
        setPhaseAConfirmationRetryId(null);
        setPhaseAConfirmationStatus("error");
        setPhaseAConfirmationMessage(`${responseMessage} 최신 작업팩을 다시 저장해 주세요.`);
        return;
      }

      if (!response.ok) {
        setPhaseAConfirmationStatus("error");
        setPhaseAConfirmationMessage(`${responseMessage} 잠시 후 다시 시도해 주세요.`);
        return;
      }

      const confirmed = await parseServerConfirmedWorkpack(
        payload,
        binding,
        retryConfirmationId ?? undefined
      );
      if (!canCommitConfirmationRequest(request)) return;
      if (!confirmed) {
        console.error("phase a confirmation response binding validation failed");
        setPhaseAConfirmationStatus("error");
        setPhaseAConfirmationMessage("서버 확인 결과의 작업팩 또는 바인딩을 검증하지 못했습니다. 현재 작업팩을 다시 저장해 주세요.");
        return;
      }

      dataRef.current = confirmed.workpack;
      setEditedDeliverables(null);
      lastEditorValuesRef.current = null;
      setSavedWorkpackId(confirmed.authority.workpackId);
      setSavedWorkpackAuthority(confirmed.authority);
      setPhaseAConfirmationBinding(null);
      setPhaseAConfirmationRetryId(null);
      setPhaseAConfirmationStatus("success");
      setPhaseAConfirmationMessage("서버 확인 완료. 서버가 반환한 작업팩과 근거 봉인을 현재 상태에 반영했습니다.");
      setStorageSnapshot((current) => ({
        ...current,
        ok: true,
        workpackId: confirmed.authority.workpackId,
        savedAt: confirmed.authority.updatedAt,
        authority: confirmed.authority,
      }));
      onWorkpackStateChangeRef.current?.(confirmed.workpack, confirmed.authority);
    } catch (error) {
      if (!canCommitConfirmationRequest(request) || isAbortError(error)) return;
      console.warn("phase a confirmation request failed", error);
      setPhaseAConfirmationStatus("error");
      setPhaseAConfirmationMessage("서버 확인 요청 중 오류가 발생했습니다. 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      confirmationRequestGateRef.current.finish(request);
    }
  }

  function toggleWorker(id: string) {
    invalidateWorkspaceRequests();
    startTransition(() => {
      setSelectedWorkerIds((current) => (
        current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id]
      ));
    });
  }

  function updateWorker(worker: WorkerProfile) {
    invalidateWorkspaceRequests();
    setWorkers((current) => current.map((item) => item.id === worker.id ? worker : item));
  }

  function addWorker(draft: WorkerDraft) {
    invalidateWorkspaceRequests();
    const id = `worker-${Date.now()}`;
    const nextWorker: WorkerProfile = {
      id,
      displayName: draft.displayName.trim(),
      role: draft.role.trim() || "작업자",
      joinedAt: draft.joinedAt,
      experienceLevel: draft.experienceLevel,
      experienceSummary: draft.experienceLevel === "신규" ? "우리 현장 신규 투입, 작업 전 교육 확인 필요" : "작업 배치 전 교육이수 상태 확인 필요",
      nationality: draft.nationality.trim() || "확인 필요",
      languageCode: inferLanguageCode(draft.nationality, draft.languageLabel),
      languageLabel: draft.languageLabel.trim() || "한국어",
      isNewWorker: draft.experienceLevel === "신규",
      isForeignWorker: draft.isForeignWorker || draft.nationality.trim() !== "대한민국",
      trainingStatus: "확인 필요",
      trainingSummary: "작업 전 교육이수와 TBM 이해 여부 확인 필요",
      phone: draft.phone.trim() || undefined,
      email: draft.email.trim() || undefined
    };
    setWorkers((current) => [...current, nextWorker]);
    setSelectedWorkerIds((current) => [...current, id]);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        CURRENT_WORKPACK_STORAGE_KEY,
        JSON.stringify(buildStoredCurrentWorkpack(workspaceData, {
          generationFingerprint,
          workerSnapshot,
          dispatchSnapshot
        }))
      );
    } catch (error) {
      console.warn("safeclaw current workpack snapshot update failed", error);
    }
  }, [dispatchSnapshot, generationFingerprint, workerSnapshot, workspaceData]);

  const phaseAUiState = buildPhaseAReviewUiState(parsedPhaseAReview ?? undefined);
  const phaseAAlreadyConfirmed = parsedPhaseAReview?.humanConfirmation.status === "confirmed";
  const phaseAConfirmationBusy = phaseAConfirmationStatus === "saving" || phaseAConfirmationStatus === "confirming";
  let phaseAConfirmationTitle = "현재 작업팩 저장 필요";
  let phaseAConfirmationCopy = "서버 확인 전에 현재 생성 근거와 계획에 묶인 작업팩을 저장해 주세요.";
  if (phaseAConfirmationStatus === "auth-expired") {
    phaseAConfirmationTitle = "로그인 다시 필요";
    phaseAConfirmationCopy = phaseAConfirmationMessage;
  } else if (phaseAConfirmationStatus === "conflict") {
    phaseAConfirmationTitle = "서버 확인 재시도 필요";
    phaseAConfirmationCopy = phaseAConfirmationMessage;
  } else if (phaseAConfirmationStatus === "error") {
    phaseAConfirmationTitle = "확인 진행 중 문제 발생";
    phaseAConfirmationCopy = phaseAConfirmationMessage;
  } else if (phaseAConfirmationStatus === "saving") {
    phaseAConfirmationTitle = "현재 작업팩 저장 중";
    phaseAConfirmationCopy = phaseAConfirmationMessage;
  } else if (phaseAConfirmationStatus === "confirming") {
    phaseAConfirmationTitle = "서버 확인 중";
    phaseAConfirmationCopy = phaseAConfirmationMessage;
  } else if (phaseAAlreadyConfirmed || phaseAConfirmationStatus === "success") {
    phaseAConfirmationTitle = "확인 완료";
    phaseAConfirmationCopy = phaseAConfirmationMessage || "서버가 인증 세션과 현재 작업팩의 근거 바인딩을 확인했습니다.";
  } else if (!session) {
    phaseAConfirmationTitle = "관리자 로그인 필요";
    phaseAConfirmationCopy = "관리자 로그인 후 현재 작업팩을 저장해야 서버 확인을 진행할 수 있습니다.";
  } else if (!phaseAReadyForConfirmation) {
    phaseAConfirmationTitle = "근거 재검수 필요";
    phaseAConfirmationCopy = "resolved grounding과 전체 materialization이 완료된 현재 문서만 서버 확인할 수 있습니다.";
  } else if (!generationEvidenceBinding) {
    phaseAConfirmationTitle = "생성 근거 봉인 필요";
    phaseAConfirmationCopy = "서버 생성 근거 봉인이 없는 문서는 확인할 수 없습니다. 문서를 다시 생성해 주세요.";
  } else if (!generationBindingMatches) {
    phaseAConfirmationTitle = "편집 후 재검수 필요";
    phaseAConfirmationCopy = "현재 문서가 검수된 생성본과 달라졌습니다. 편집 내용을 반영해 다시 검수해 주세요.";
  } else if (confirmationBindingIsCurrent) {
    phaseAConfirmationTitle = "서버 확인 준비 완료";
    phaseAConfirmationCopy = phaseAConfirmationMessage || "저장된 작업팩, 생성 근거, 계획, 로그인 세션이 현재 상태와 일치합니다.";
  }
  const showPhaseASaveAction = Boolean(
    session &&
    phaseAReadyForConfirmation &&
    generationEvidenceBinding &&
    generationBindingMatches &&
    !confirmationBindingIsCurrent &&
    phaseAConfirmationStatus !== "auth-expired" &&
    !phaseAConfirmationBusy
  );
  const phaseAConfirmButtonLabel = phaseAConfirmationStatus === "conflict"
    ? "서버 확인 다시 시도"
    : phaseAConfirmationStatus === "confirming"
      ? "서버 확인 중"
      : phaseAConfirmationStatus === "error" && confirmationBindingIsCurrent
        ? "Phase A 확인 다시 시도"
        : phaseAAlreadyConfirmed || phaseAConfirmationStatus === "success"
          ? "Phase A 확인 완료"
          : "Phase A 확인 저장";
  const phaseAConfirmDisabled = phaseAConfirmationBusy ||
    phaseAConfirmationStatus === "auth-expired" ||
    phaseAAlreadyConfirmed ||
    phaseAConfirmationStatus === "success" ||
    !confirmationBindingIsCurrent;

  if (surface === "share") {
    return (
      <section className="field-workspace field-workspace-share-only workbench-root">
        <WorkflowSharePanel
          data={workspaceData}
          recipientSuggestions={recipientSuggestions}
          targetWorkers={targetWorkers}
          authToken={session?.access_token}
          workpackId={effectiveSavedWorkpackId}
          workerIds={savedWorkerIds}
          ensureWorkpackSaved={ensureWorkpackSaved}
          readiness={readiness}
        />
      </section>
    );
  }

  const workspaceSide = (
    <aside className="workspace-side" id="workers">
      <ClawChat
        authToken={session?.access_token}
        siteOptions={clawSiteOptions}
        selectedSiteId={selectedClawSiteId}
        onSiteChange={selectClawSite}
        contextStatus={clawContextStatus}
      />
      <AdminAccessPanel
        session={session}
        storageSnapshot={storageSnapshot}
        onSessionChange={applySession}
      />
      <WorkerEducationPanel
        workers={workers}
        selectedWorkerIds={selectedWorkerIds}
        educationRecords={educationRecords}
        onToggleWorker={toggleWorker}
        onUpdateWorker={updateWorker}
        onAddWorker={addWorker}
      />
      <WorkflowSharePanel
        data={workspaceData}
        recipientSuggestions={recipientSuggestions}
        targetWorkers={targetWorkers}
        authToken={session?.access_token}
        workpackId={effectiveSavedWorkpackId}
        workerIds={savedWorkerIds}
        ensureWorkpackSaved={ensureWorkpackSaved}
        readiness={readiness}
      />
      <WorkpackHistoryPanel
        session={session}
        storageSnapshot={storageSnapshot}
        onSaveWorkspace={saveWorkspaceToSupabase}
      />
    </aside>
  );

  return (
    <section className={`field-workspace${surface === "editor" ? " field-workspace-editor-focus" : ""} workbench-root`} id="workpack">
      <aside className="workspace-rail card" aria-label="SafeClaw 파일럿 체크리스트">
        <div className="compact-head">
          <span className="eyebrow">운영 체크</span>
          <strong>파일럿 체크리스트</strong>
        </div>
        {pilotChecklist.map(([code, title, helper]) => (
          <div key={code} className="workspace-step">
            <span>{code}</span>
            <strong>{title}</strong>
            <small>{helper}</small>
          </div>
        ))}
      </aside>

      <div className="workspace-canvas">
        <WorkpackEditor
          data={workspaceData}
          generationFingerprint={generationFingerprint}
          focusToken={editorFocusToken}
          requestedDocumentKey={requestedDocumentKey}
          onDeliverablesChange={handleDeliverablesChange}
        />
        <section
          className={`phase-a-confirmation-panel${phaseAUiState.authoritative ? " is-ready" : " is-pending"}`}
          aria-label="Phase A 근거 확인"
        >
          <div className="phase-a-confirmation-copy">
            <span className="eyebrow">Phase A Review</span>
            <strong>{phaseAConfirmationTitle}</strong>
            <p aria-live="polite">{phaseAConfirmationCopy}</p>
            <small>
              근거 상태: {phaseAUiState.status} · 공유 준비: {readiness?.status === "ready" ? "준비됨" : "확인 필요"}
            </small>
          </div>
          <div className="phase-a-confirmation-actions">
            {showPhaseASaveAction ? (
              <button
                type="button"
                className="button secondary"
                onClick={() => void saveCurrentWorkpackForPhaseA()}
              >
                현재 작업팩 저장
              </button>
            ) : null}
            <button
              type="button"
              className="button"
              onClick={() => void confirmCurrentPhaseAWorkpack()}
              disabled={phaseAConfirmDisabled}
            >
              {phaseAConfirmButtonLabel}
            </button>
          </div>
        </section>
        <EvidenceImpactPanel data={workspaceData} />
        <WorkspaceOperationGraphPanel
          data={workspaceData}
          session={session}
          storageSnapshot={storageSnapshot}
        />
      </div>

      {surface === "editor" ? (
        <details className="editor-operations-disclosure">
          <summary>
            <span>운영 도구</span>
            <strong>작업자·교육·전파·이력 관리</strong>
          </summary>
          {workspaceSide}
        </details>
      ) : workspaceSide}
    </section>
  );
}
