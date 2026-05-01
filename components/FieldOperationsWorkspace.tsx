"use client";

import { useEffect, useMemo, useState, startTransition } from "react";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { CitationList } from "@/components/CitationList";
import { WorkflowSharePanel } from "@/components/WorkflowSharePanel";
import { WorkpackEditor, type DocumentKey } from "@/components/WorkpackEditor";
import type { AskResponse } from "@/lib/types";
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
};

type StorageStatusLabel = "비회원 임시 저장" | "관리자 로그인 필요" | "관리자 이력 저장 완료" | "저장 실패";

type WorkspaceSaveSnapshot = {
  ok: boolean;
  label: StorageStatusLabel;
  message: string;
  workpackId: string | null;
  savedAt: string | null;
  savedCount: number;
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
  consent: boolean;
};

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
    consent: false
  };
}

function inferLanguageCode(nationality: string, languageLabel: string) {
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

function buildEvidenceSummary(data: AskResponse) {
  return {
    citations: data.citations.slice(0, 6).map((item) => ({
      type: item.type,
      title: item.title,
      sourceLabel: item.sourceLabel,
      sourceSystem: item.sourceSystem
    })),
    externalData: {
      weather: data.externalData.weather.mode,
      training: data.externalData.training.mode,
      koshaEducation: data.externalData.koshaEducation.mode,
      kosha: data.externalData.kosha.mode,
      accidentCases: data.externalData.accidentCases.mode
    }
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
              </div>
              <p className="muted small">{record?.memo || worker.trainingSummary}</p>
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
          <input className="input" value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))} placeholder="역할" aria-label="근로자 역할" />
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
          <input className="input" value={draft.nationality} onChange={(event) => setDraft((current) => ({ ...current, nationality: event.target.value }))} placeholder="국적" aria-label="근로자 국적" />
          <input className="input" value={draft.languageLabel} onChange={(event) => setDraft((current) => ({ ...current, languageLabel: event.target.value }))} placeholder="주 사용 언어" aria-label="근로자 주 사용 언어" />
        </div>
        <label className="consent-check">
          <input
            type="checkbox"
            checked={draft.consent}
            onChange={(event) => setDraft((current) => ({ ...current, consent: event.target.checked }))}
          />
          <span>연락처·국적·언어 정보를 교육 확인과 현장 전파 목적으로 사용합니다.</span>
        </label>
        <button type="button" className="button secondary full-button" onClick={addWorker} disabled={!draft.displayName.trim() || !draft.consent}>명단에 추가</button>
      </div>
    </article>
  );
}

function EvidenceImpactPanel({ data }: { data: AskResponse }) {
  const koshaReferences = data.externalData.kosha.references.slice(0, 3);
  const accidentCases = data.externalData.accidentCases.cases.slice(0, 2);
  const hasEvidenceImpact = koshaReferences.length > 0 || accidentCases.length > 0;
  const officialFallbackUrl = "https://www.kosha.or.kr/kosha/data/guidance.do";
  const safeExternalUrl = (url?: string) => (url && /^https?:\/\//.test(url) ? url : officialFallbackUrl);

  return (
    <section className="evidence-impact-grid" id="references">
      <article className="workspace-panel card">
        <div className="compact-head">
          <span className="eyebrow">근거</span>
          <strong>문서 반영 근거</strong>
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
              <span>유사 재해사례 · TBM/교육 반영</span>
              <small>{item.preventionPoint}</small>
            </a>
          ))}
          {!hasEvidenceImpact ? (
            <div className="impact-empty-state">
              <strong>공식자료 반영 대기</strong>
              <span>문서팩은 생성됐지만 KOSHA 자료 또는 재해사례 반영 근거가 아직 확인되지 않았습니다. 법령 근거와 현장 조치 문구는 계속 확인할 수 있습니다.</span>
            </div>
          ) : null}
        </div>
      </article>
      <CitationList citations={data.citations} question={data.question} />
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
    </article>
  );
}

export function FieldOperationsWorkspace({
  data,
  editorFocusToken = 0,
  requestedDocumentKey
}: {
  data: AskResponse;
  editorFocusToken?: number;
  requestedDocumentKey?: DocumentKey;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [workers, setWorkers] = useState<WorkerProfile[]>(() => buildDefaultWorkers(data));
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>(() => buildDefaultWorkers(data).map((worker) => worker.id));
  const [savedWorkpackId, setSavedWorkpackId] = useState<string | null>(null);
  const [storageSnapshot, setStorageSnapshot] = useState<WorkspaceSaveSnapshot>({
    ok: false,
    label: "비회원 임시 저장",
    message: "문서 편집 내용은 이 브라우저에 임시 저장됩니다. 관리자 로그인 후 이력을 저장할 수 있습니다.",
    workpackId: null,
    savedAt: null,
    savedCount: 0
  });

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
  const workerSummary = summarizeWorkers(selectedWorkers);
  const pilotChecklist = [
    ["PLAN", "계획", `${data.citations.length}건 근거 · 위험성평가·작업계획`],
    ["DO", "실행", `TBM·교육 · ${workerSummary.selectedCount}명 대상`],
    ["CHECK", "확인", `교육확인 ${workerSummary.educationPendingCount ? "필요" : "완료"} · 증빙 보관`],
    ["ACT", "개선", session ? "이력 저장·후속조치" : "다운로드 후 현장 확인"],
    ["ISO", "운영체계", "법규·문서관리·감사추적"]
  ] as const;

  async function postJson<TResponse>(url: string, body: unknown): Promise<TResponse> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${session?.access_token || ""}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
    return await response.json() as TResponse;
  }

  function setStorageFailure(message: string) {
    const snapshot: WorkspaceSaveSnapshot = {
      ok: false,
      label: "저장 실패",
      message,
      workpackId: savedWorkpackId,
      savedAt: null,
      savedCount: 0
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
        workpackId: savedWorkpackId,
        savedAt: null,
        savedCount: 0
      };
      setStorageSnapshot(snapshot);
      return snapshot;
    }

    try {
      const workerResponse = await postJson<SaveResponse>("/api/workers", {
        scenario: data.scenario,
        workers
      });
      if (!workerResponse.ok) return setStorageFailure(workerResponse.message);

      const workpackResponse = await postJson<SaveResponse>("/api/workpacks", {
        question: data.question,
        scenario: data.scenario,
        deliverables: data.deliverables,
        evidenceSummary: buildEvidenceSummary(data),
        workerSummary: {
          ...summarizeWorkers(selectedWorkers),
          selectedWorkers: buildWorkerDispatchTargets(selectedWorkers)
        },
        status: data.status
      });
      if (!workpackResponse.ok || !workpackResponse.workpackId) {
        return setStorageFailure(workpackResponse.message);
      }

      const selectedEducationRecords = educationRecords.filter((record) => (
        selectedWorkers.some((worker) => worker.id === record.workerId)
      ));
      const educationResponse = await postJson<SaveResponse>("/api/education-records", {
        scenario: data.scenario,
        workpackId: workpackResponse.workpackId,
        workerMap: workerResponse.workerMap || {},
        workers,
        records: selectedEducationRecords
      });
      if (!educationResponse.ok) return setStorageFailure(educationResponse.message);

      const savedCount = 1 + workers.length + (educationResponse.savedCount || selectedEducationRecords.length);
      const snapshot: WorkspaceSaveSnapshot = {
        ok: true,
        label: "관리자 이력 저장 완료",
        message: `${workpackResponse.message} ${workerResponse.message} ${educationResponse.message}`,
        workpackId: workpackResponse.workpackId,
        savedAt: new Date().toISOString(),
        savedCount
      };
      setSavedWorkpackId(workpackResponse.workpackId);
      setStorageSnapshot(snapshot);
      return snapshot;
    } catch (error) {
      console.error("workspace save failed", error);
      return setStorageFailure("작업공간 저장 중 오류가 발생했습니다. Supabase 설정과 로그인 상태를 확인해 주세요.");
    }
  }

  async function ensureWorkpackSaved() {
    if (savedWorkpackId) return savedWorkpackId;
    const snapshot = await saveWorkspaceToSupabase();
    return snapshot.workpackId;
  }

  function toggleWorker(id: string) {
    startTransition(() => {
      setSelectedWorkerIds((current) => (
        current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id]
      ));
    });
  }

  function updateWorker(worker: WorkerProfile) {
    setWorkers((current) => current.map((item) => item.id === worker.id ? worker : item));
  }

  function addWorker(draft: WorkerDraft) {
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
      phone: draft.phone.trim() || undefined
    };
    setWorkers((current) => [...current, nextWorker]);
    setSelectedWorkerIds((current) => [...current, id]);
  }

  return (
    <section className="field-workspace" id="workpack">
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

      <main className="workspace-canvas">
        <WorkpackEditor data={data} focusToken={editorFocusToken} requestedDocumentKey={requestedDocumentKey} />
        <EvidenceImpactPanel data={data} />
      </main>

      <aside className="workspace-side" id="workers">
        <AdminAccessPanel session={session} storageSnapshot={storageSnapshot} onSessionChange={setSession} />
        <WorkerEducationPanel
          workers={workers}
          selectedWorkerIds={selectedWorkerIds}
          educationRecords={educationRecords}
          onToggleWorker={toggleWorker}
          onUpdateWorker={updateWorker}
          onAddWorker={addWorker}
        />
        <WorkflowSharePanel
          data={data}
          recipientSuggestions={recipientSuggestions}
          targetWorkers={targetWorkers}
          authToken={session?.access_token}
          workpackId={savedWorkpackId}
          ensureWorkpackSaved={ensureWorkpackSaved}
        />
        <WorkpackHistoryPanel
          session={session}
          storageSnapshot={storageSnapshot}
          onSaveWorkspace={saveWorkspaceToSupabase}
        />
      </aside>
    </section>
  );
}
