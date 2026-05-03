"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { CitationList } from "@/components/CitationList";
import { WorkflowSharePanel } from "@/components/WorkflowSharePanel";
import { WorkpackEditor, type DocumentKey, type WorkpackDocumentValues } from "@/components/WorkpackEditor";
import {
  buildStoredCurrentWorkpack,
  CURRENT_WORKPACK_STORAGE_KEY,
  parseStoredCurrentWorkpack,
  type CurrentDispatchSnapshot,
  type CurrentWorkerSnapshot
} from "@/lib/current-workpack";
import type { AskResponse } from "@/lib/types";
import {
  buildDefaultWorkers,
  buildEducationRecordDrafts,
  buildRecipientSuggestions,
  buildWorkerDispatchTargets,
  maskPhone,
  summarizeWorkers,
  type RecipientSuggestion,
  type WorkerDispatchTarget,
  type WorkerProfile
} from "@/lib/workspace";

type CurrentWorkpackSnapshot = {
  data: AskResponse;
  isCurrent: boolean;
  savedAt: string | null;
  workerSnapshot?: CurrentWorkerSnapshot;
  dispatchSnapshot?: CurrentDispatchSnapshot;
};

type CurrentWorkpackState = CurrentWorkpackSnapshot & {
  updateData: (data: AskResponse) => void;
};

type LaunchDocument = {
  key: DocumentKey;
  title: string;
  tier: "핵심" | "제출" | "보조";
  owner: string;
  description: string;
};

type DeliverableDocumentKey = Extract<DocumentKey, keyof AskResponse["deliverables"]>;
type ArchiveWorkpack = {
  id: string;
  organizationName: string;
  siteName: string;
  industry: string | null;
  region: string | null;
  question: string;
  createdAt: string;
  updatedAt: string;
};
type ArchiveDispatchLog = {
  id: string;
  siteName: string;
  channel: string;
  targetLabel: string | null;
  languageCode: string | null;
  provider: string | null;
  providerStatus: string | null;
  workflowRunId: string | null;
  failureReason: string | null;
  createdAt: string;
};
type ServerArchiveState = {
  status: "idle" | "loading" | "ready" | "login-required" | "unconfigured" | "error";
  message: string;
  workpacks: ArchiveWorkpack[];
  dispatchLogs: ArchiveDispatchLog[];
};

const launchDocuments: LaunchDocument[] = [
  {
    key: "riskAssessmentDraft",
    title: "위험성평가표",
    tier: "핵심",
    owner: "작업 전 판단",
    description: "4M 위험요인과 감소대책을 먼저 확인합니다."
  },
  {
    key: "tbmBriefing",
    title: "TBM 브리핑",
    tier: "핵심",
    owner: "작업반장",
    description: "작업 전 읽고 확인 질문으로 전환합니다."
  },
  {
    key: "foreignWorkerTransmission",
    title: "외국인 전송본",
    tier: "핵심",
    owner: "현장 전파",
    description: "언어별 짧은 공지와 관리자 확인 문구를 씁니다."
  },
  {
    key: "workPlanDraft",
    title: "작업계획서",
    tier: "제출",
    owner: "관리감독자",
    description: "작업순서, 중지기준, 확인 근거를 묶습니다."
  },
  {
    key: "safetyEducationRecordDraft",
    title: "안전보건교육 기록",
    tier: "제출",
    owner: "교육 확인",
    description: "교육대상, 내용, 확인방법을 남깁니다."
  },
  {
    key: "tbmLogDraft",
    title: "TBM 기록",
    tier: "제출",
    owner: "기록 보관",
    description: "참석자, 보호구, 미조치 위험요인을 확인합니다."
  },
  {
    key: "workpackSummaryDraft",
    title: "점검결과 요약",
    tier: "보조",
    owner: "보고 요약",
    description: "오늘 문서팩의 핵심 판단을 한 장으로 압축합니다."
  },
  {
    key: "emergencyResponseDraft",
    title: "비상대응 절차",
    tier: "보조",
    owner: "사고 대응",
    description: "중지, 초기조치, 보고체계를 정리합니다."
  },
  {
    key: "photoEvidenceDraft",
    title: "사진·증빙",
    tier: "보조",
    owner: "증빙 보관",
    description: "촬영자, 확인자, 보관 위치를 남깁니다."
  }
];

function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

function readArchiveWorkpacks(value: unknown): ArchiveWorkpack[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ArchiveWorkpack[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    const siteName = typeof record.siteName === "string" ? record.siteName : "기본 현장";
    const question = typeof record.question === "string" ? record.question : "";
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : "";
    if (!id || !createdAt) return [];
    return [{
      id,
      organizationName: typeof record.organizationName === "string" ? record.organizationName : "SafeClaw Pilot",
      siteName,
      industry: typeof record.industry === "string" ? record.industry : null,
      region: typeof record.region === "string" ? record.region : null,
      question,
      createdAt,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : createdAt
    }];
  });
}

function readArchiveDispatchLogs(value: unknown): ArchiveDispatchLog[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ArchiveDispatchLog[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    const channel = typeof record.channel === "string" ? record.channel : "";
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : "";
    if (!id || !channel || !createdAt) return [];
    return [{
      id,
      siteName: typeof record.siteName === "string" ? record.siteName : "기본 현장",
      channel,
      targetLabel: typeof record.targetLabel === "string" ? record.targetLabel : null,
      languageCode: typeof record.languageCode === "string" ? record.languageCode : null,
      provider: typeof record.provider === "string" ? record.provider : null,
      providerStatus: typeof record.providerStatus === "string" ? record.providerStatus : null,
      workflowRunId: typeof record.workflowRunId === "string" ? record.workflowRunId : null,
      failureReason: typeof record.failureReason === "string" ? record.failureReason : null,
      createdAt
    }];
  });
}

async function readSession(): Promise<Session | null> {
  const client = createBrowserSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) {
    console.error("archive session read failed", error);
    return null;
  }
  return data.session;
}

function useCurrentWorkpack(sample: AskResponse): CurrentWorkpackState {
  const [state, setState] = useState<CurrentWorkpackSnapshot>({
    data: sample,
    isCurrent: false,
    savedAt: null
  });

  useEffect(() => {
    const stored = parseStoredCurrentWorkpack(window.localStorage.getItem(CURRENT_WORKPACK_STORAGE_KEY));
    if (stored) {
      setState({
        data: stored.data,
        isCurrent: true,
        savedAt: stored.savedAt,
        workerSnapshot: stored.workerSnapshot,
        dispatchSnapshot: stored.dispatchSnapshot
      });
    }
  }, []);

  const updateData = useCallback((nextData: AskResponse) => {
    setState((current) => ({
      ...current,
      data: nextData,
      isCurrent: true,
      savedAt: new Date().toISOString()
    }));
  }, []);

  return { ...state, updateData };
}

function isPlaceholderRecipient(value: string) {
  const normalized = value.trim().toLowerCase();
  const digits = normalized.replace(/[^0-9]/g, "");
  return normalized.endsWith("@safeguard.local") || /^0100+0[0-9]$/.test(digits) || /^0100000000[0-9]$/.test(digits);
}

function filterRealRecipientSuggestions(recipients: RecipientSuggestion[]) {
  return recipients.filter((recipient) => !isPlaceholderRecipient(recipient.value));
}

function filterRealDispatchTargets(targets: WorkerDispatchTarget[]) {
  return targets.filter((target) => Boolean(target.phoneMasked || target.emailMasked));
}

function selectedWorkerSnapshotWorkers(snapshot: CurrentWorkerSnapshot | undefined) {
  if (!snapshot) return [];
  if (!snapshot.selectedWorkerIds.length) return snapshot.workers;
  const selected = snapshot.workers.filter((worker) => snapshot.selectedWorkerIds.includes(worker.id));
  return selected.length ? selected : snapshot.workers;
}

function currentRouteWorkers(current: CurrentWorkpackState): WorkerProfile[] {
  const snapshotWorkers = selectedWorkerSnapshotWorkers(current.workerSnapshot);
  return snapshotWorkers.length ? snapshotWorkers : buildDefaultWorkers(current.data);
}

function formatSavedAt(savedAt: string | null) {
  if (!savedAt) return "";
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function CurrentWorkpackBanner({ isCurrent, savedAt }: { isCurrent: boolean; savedAt: string | null }) {
  return (
    <section className={`safeclaw-current-workpack ${isCurrent ? "live" : "sample"}`} aria-live="polite">
      <span>{isCurrent ? "현재 작업 연결" : "기본 예시 표시"}</span>
      <strong>
        {isCurrent
          ? `작업공간에서 생성한 최신 문서팩을 사용합니다${formatSavedAt(savedAt) ? ` · ${formatSavedAt(savedAt)}` : ""}.`
          : "아직 생성된 문서팩이 없어 기본 예시 데이터로 화면을 보여줍니다. 실제 저장·전파는 작업 입력 후 진행합니다."}
      </strong>
      <a href="/workspace">작업공간에서 새로 생성</a>
    </section>
  );
}

function excerpt(text: string, maxLength = 190) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}...`;
}

function hasDeliverableKey(key: DocumentKey): key is DeliverableDocumentKey {
  return key !== "workPermitDraft";
}

function buildDerivedDocumentText(data: AskResponse, key: DocumentKey) {
  if (hasDeliverableKey(key)) return data.deliverables[key];

  const actions = data.riskSummary.immediateActions.slice(0, 2).join(" / ");
  return `허가대상 작업: ${data.scenario.workSummary}. 핵심위험: ${data.riskSummary.topRisk}. 작업 전 허가조건: ${actions}`;
}

function buildDeliverablePatch(values: WorkpackDocumentValues) {
  const patch: Partial<AskResponse["deliverables"]> = {};
  (Object.keys(values) as DocumentKey[]).forEach((key) => {
    if (hasDeliverableKey(key)) {
      patch[key] = values[key];
    }
  });
  return patch;
}

function countDocuments(data: AskResponse) {
  return Object.values(data.deliverables).filter((value) => typeof value === "string" && value.trim()).length;
}

function countEvidence(data: AskResponse) {
  const kosha = data.externalData.kosha.references.length;
  const accident = data.externalData.accidentCases.cases.length;
  const openApi = data.externalData.koshaOpenApi?.references.length || 0;
  const knowledge = data.externalData.safetyKnowledge?.matches.length || 0;
  return data.citations.length + kosha + accident + openApi + knowledge;
}

function DocumentCockpit({ data, onSelectDocument }: { data: AskResponse; onSelectDocument: (key: DocumentKey) => void }) {
  const primaryDocuments = launchDocuments.filter((item) => item.tier === "핵심");

  return (
    <section className="safeclaw-document-cockpit" aria-label="문서팩 운영 요약">
      <aside className="safeclaw-doc-index">
        <span>문서 인덱스</span>
        <h2>3종 핵심. 6종 제출.</h2>
        <div className="safeclaw-doc-index-list">
          {launchDocuments.map((item, index) => (
            <button key={item.key} type="button" onClick={() => onSelectDocument(item.key)}>
              <small>{String(index + 1).padStart(2, "0")} · {item.tier}</small>
              <strong>{item.title}</strong>
              <em>{item.owner}</em>
            </button>
          ))}
        </div>
      </aside>

      <article className="safeclaw-doc-primary">
        <span>오늘 먼저 볼 문서</span>
        <h2>{data.scenario.siteName}</h2>
        <p>{data.scenario.workSummary}</p>
        <div className="safeclaw-doc-primary-grid">
          {primaryDocuments.map((item) => (
            <section key={item.key}>
              <small>{item.owner}</small>
              <strong>{item.title}</strong>
              <p>{excerpt(buildDerivedDocumentText(data, item.key))}</p>
            </section>
          ))}
        </div>
      </article>

      <aside className="safeclaw-doc-export">
        <span>제출 준비</span>
        <h2>{countDocuments(data)}종 작성.</h2>
        <dl>
          <div>
            <dt>위험도</dt>
            <dd>{data.riskSummary.riskLevel}</dd>
          </div>
          <div>
            <dt>근거 연결</dt>
            <dd>{countEvidence(data)}건</dd>
          </div>
          <div>
            <dt>정식 출력</dt>
            <dd>PDF · XLS · HWPX</dd>
          </div>
        </dl>
        <a href="/evidence">문서 반영 근거 확인</a>
        <a href="/dispatch">메일·문자 전파로 이동</a>
      </aside>
    </section>
  );
}

export function CurrentDocumentsModule({ sample }: { sample: AskResponse }) {
  const current = useCurrentWorkpack(sample);
  const [focusToken, setFocusToken] = useState(0);
  const [requestedDocumentKey, setRequestedDocumentKey] = useState<DocumentKey | undefined>();
  const updateCurrentDeliverables = useCallback((values: WorkpackDocumentValues) => {
    if (!current.isCurrent || typeof window === "undefined") return;

    const nextData: AskResponse = {
      ...current.data,
      deliverables: {
        ...current.data.deliverables,
        ...buildDeliverablePatch(values)
      }
    };

    window.localStorage.setItem(
      CURRENT_WORKPACK_STORAGE_KEY,
      JSON.stringify(buildStoredCurrentWorkpack(nextData, {
        workerSnapshot: current.workerSnapshot,
        dispatchSnapshot: current.dispatchSnapshot
      }))
    );
    current.updateData(nextData);
  }, [current.data, current.dispatchSnapshot, current.isCurrent, current.workerSnapshot]);

  function selectDocument(key: DocumentKey) {
    setRequestedDocumentKey(key);
    setFocusToken((value) => value + 1);
  }

  return (
    <>
      <CurrentWorkpackBanner isCurrent={current.isCurrent} savedAt={current.savedAt} />
      <DocumentCockpit data={current.data} onSelectDocument={selectDocument} />
      <WorkpackEditor
        data={current.data}
        focusToken={focusToken}
        requestedDocumentKey={requestedDocumentKey}
        onDeliverablesChange={updateCurrentDeliverables}
      />
    </>
  );
}

export function CurrentEvidenceModule({ sample }: { sample: AskResponse }) {
  const current = useCurrentWorkpack(sample);
  const koshaReferences = current.data.externalData.kosha.references.slice(0, 3);
  const accidentCases = current.data.externalData.accidentCases.cases.slice(0, 3);

  return (
    <>
      <CurrentWorkpackBanner isCurrent={current.isCurrent} savedAt={current.savedAt} />
      <section className="safeclaw-module-grid two">
        <article className="safeclaw-module-panel">
          <span>문서 반영 근거</span>
          <h2>KOSHA·재해사례</h2>
          <div className="safeclaw-module-list">
            {koshaReferences.length ? koshaReferences.map((item) => (
              <a key={item.title} href={item.url} target="_blank" rel="noreferrer">
                <strong>{item.title}</strong>
                <small>{item.summary}</small>
              </a>
            )) : (
              <a href="/knowledge">KOSHA 공식자료는 지식 DB와 작업공간 근거 패널에서 확인합니다.</a>
            )}
            {accidentCases.map((item) => (
              <a key={item.title} href={item.sourceUrl || "/knowledge"} target="_blank" rel="noreferrer">
                <strong>{item.title}</strong>
                <small>{item.preventionPoint}</small>
              </a>
            ))}
          </div>
        </article>
        <CitationList citations={current.data.citations} question={current.data.question} />
      </section>
    </>
  );
}

export function CurrentWorkersModule({ sample }: { sample: AskResponse }) {
  const current = useCurrentWorkpack(sample);
  const workers = currentRouteWorkers(current);
  const records = buildEducationRecordDrafts(workers, current.data.scenario.workSummary);
  const summary = summarizeWorkers(workers);
  const workerSourceLabel = current.workerSnapshot ? "현재 작업공간 snapshot" : current.isCurrent ? "현재 문서팩에서 기본 추정" : "기본 예시";

  return (
    <>
      <CurrentWorkpackBanner isCurrent={current.isCurrent} savedAt={current.savedAt} />
      <section className="safeclaw-module-grid four">
        <article><span>선택</span><strong>{summary.selectedCount}명</strong></article>
        <article><span>외국인</span><strong>{summary.foreignCount}명</strong></article>
        <article><span>신규</span><strong>{summary.newCount}명</strong></article>
        <article><span>교육 확인</span><strong>{summary.educationPendingCount ? "필요" : "완료"}</strong></article>
      </section>
      <section className="safeclaw-module-panel">
        <span>작업 투입 적합성 카드 · {workerSourceLabel}</span>
        <h2>{current.workerSnapshot ? "작업공간에서 편집한 명단입니다." : "저장된 명단이 없어 기본 명단으로 표시합니다."}</h2>
        <div className="safeclaw-worker-table">
          {workers.map((worker) => {
            const record = records.find((item) => item.workerId === worker.id);
            return (
              <article key={worker.id}>
                <strong>{worker.displayName}</strong>
                <p>{worker.role} · {worker.nationality} · {worker.languageLabel}</p>
                <small>{worker.phone ? `문자 가능 ${maskPhone(worker.phone)}` : "연락처 필요"} · {record?.memo || worker.trainingSummary}</small>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

export function CurrentDispatchModule({ sample }: { sample: AskResponse }) {
  const current = useCurrentWorkpack(sample);
  const workers = currentRouteWorkers(current);
  const recipientSuggestions = current.dispatchSnapshot?.recipientSuggestions.length
    ? filterRealRecipientSuggestions(current.dispatchSnapshot.recipientSuggestions)
    : filterRealRecipientSuggestions(buildRecipientSuggestions(workers));
  const targetWorkers = current.dispatchSnapshot?.targetWorkers.length
    ? filterRealDispatchTargets(current.dispatchSnapshot.targetWorkers)
    : recipientSuggestions.length ? filterRealDispatchTargets(buildWorkerDispatchTargets(workers)) : [];
  const dispatchSourceLabel = current.dispatchSnapshot ? "작업공간 전파 snapshot" : current.workerSnapshot ? "작업자 snapshot에서 재계산" : "기본 예시 기반";

  return (
    <>
      <CurrentWorkpackBanner isCurrent={current.isCurrent} savedAt={current.savedAt} />
      <section className="safeclaw-module-grid two">
        {current.isCurrent ? (
          <WorkflowSharePanel
            data={current.data}
            recipientSuggestions={recipientSuggestions}
            targetWorkers={targetWorkers}
          />
        ) : (
          <article className="safeclaw-module-panel">
            <span>전파 대기</span>
            <h2>작업 입력 후 실제 전파.</h2>
            <p>기본 예시 데이터는 메시지 형태만 확인합니다. 메일·문자 실발송은 작업공간에서 문서팩을 생성한 뒤 진행합니다.</p>
            <a href="/workspace">작업 입력으로 이동</a>
          </article>
        )}
        <article className="safeclaw-module-panel">
          <span>제출 기준 채널</span>
          <h2>메일·문자 우선.</h2>
          <p>전송 전 수신자, 채널, 언어, 메시지 미리보기를 확인한 뒤 provider 결과를 채널별로 표시합니다. 현재 대상 기준: {dispatchSourceLabel}.</p>
          {!recipientSuggestions.length ? (
            <p className="export-error">기본 예시 연락처는 실발송 대상에서 제외했습니다. 수신자를 직접 입력해야 전송할 수 있습니다.</p>
          ) : null}
          <ul>
            <li>메일: 관리자·원청 보고</li>
            <li>문자: 작업자 즉시 공지</li>
            <li>카카오·밴드: 승인 후 연결</li>
          </ul>
        </article>
      </section>
    </>
  );
}

export function CurrentArchiveModule({ sample }: { sample: AskResponse }) {
  const current = useCurrentWorkpack(sample);
  const [serverArchive, setServerArchive] = useState<ServerArchiveState>({
    status: "idle",
    message: "관리자 로그인 후 서버 이력을 조회합니다.",
    workpacks: [],
    dispatchLogs: []
  });
  const workers = currentRouteWorkers(current);
  const dispatchTargets = current.dispatchSnapshot?.targetWorkers.length
    ? current.dispatchSnapshot.targetWorkers
    : buildWorkerDispatchTargets(workers);
  const savedLabel = current.isCurrent ? formatSavedAt(current.savedAt) : "";
  const hasWorkerSnapshot = Boolean(current.workerSnapshot);
  const hasDispatchSnapshot = Boolean(current.dispatchSnapshot);
  const browserArchiveLabel = current.isCurrent ? "브라우저 current snapshot" : "브라우저 snapshot 없음";
  const supabaseLoginAvailable = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  async function loadServerArchive() {
    if (!supabaseLoginAvailable) {
      setServerArchive({
        status: "unconfigured",
        message: "Supabase URL과 anon key가 없어 서버 이력을 조회할 수 없습니다.",
        workpacks: [],
        dispatchLogs: []
      });
      return;
    }

    setServerArchive((currentState) => ({
      ...currentState,
      status: "loading",
      message: "관리자 서버 이력을 불러오는 중입니다."
    }));

    const session = await readSession();
    if (!session) {
      setServerArchive({
        status: "login-required",
        message: "관리자 로그인 후 workpacks와 dispatch_logs 이력을 불러올 수 있습니다.",
        workpacks: [],
        dispatchLogs: []
      });
      return;
    }

    try {
      const headers = { authorization: `Bearer ${session.access_token}` };
      const [workpackResponse, dispatchResponse] = await Promise.all([
        fetch("/api/workpacks?limit=12", { headers }),
        fetch("/api/dispatch-logs?limit=12", { headers })
      ]);
      const workpackPayload = await workpackResponse.json().catch((): unknown => ({}));
      const dispatchPayload = await dispatchResponse.json().catch((): unknown => ({}));
      const workpackRecord = workpackPayload && typeof workpackPayload === "object" && !Array.isArray(workpackPayload)
        ? workpackPayload as Record<string, unknown>
        : {};
      const dispatchRecord = dispatchPayload && typeof dispatchPayload === "object" && !Array.isArray(dispatchPayload)
        ? dispatchPayload as Record<string, unknown>
        : {};

      if (!workpackResponse.ok || !dispatchResponse.ok) {
        setServerArchive({
          status: "error",
          message: `${typeof workpackRecord.message === "string" ? workpackRecord.message : "문서팩 이력 조회 확인 필요"} / ${typeof dispatchRecord.message === "string" ? dispatchRecord.message : "전파 이력 조회 확인 필요"}`,
          workpacks: [],
          dispatchLogs: []
        });
        return;
      }

      setServerArchive({
        status: "ready",
        message: typeof workpackRecord.message === "string" ? workpackRecord.message : "관리자 서버 이력을 불러왔습니다.",
        workpacks: readArchiveWorkpacks(workpackRecord.workpacks),
        dispatchLogs: readArchiveDispatchLogs(dispatchRecord.logs)
      });
    } catch (error) {
      console.error("server archive fetch failed", error);
      setServerArchive({
        status: "error",
        message: "서버 이력 조회 중 오류가 발생했습니다.",
        workpacks: [],
        dispatchLogs: []
      });
    }
  }

  return (
    <>
      <CurrentWorkpackBanner isCurrent={current.isCurrent} savedAt={current.savedAt} />
      {!current.isCurrent ? (
        <section className="safeclaw-module-panel">
          <span>저장된 이력 없음</span>
          <h2>작업 입력 후 이력이 생깁니다.</h2>
          <p>아직 이 브라우저에 생성된 문서팩이 없습니다. 기본 예시의 숫자를 이력처럼 보여주지 않고, 실제 작업 생성 후 최신 스냅샷을 표시합니다.</p>
          <a href="/workspace">작업 입력으로 이동</a>
        </section>
      ) : (
      <>
      <section className="safeclaw-module-grid four">
        <article><span>로컬 상태</span><strong>{browserArchiveLabel}</strong></article>
        <article><span>작업자 snapshot</span><strong>{hasWorkerSnapshot ? `${workers.length}명` : "없음"}</strong></article>
        <article><span>Supabase 로그인</span><strong>{supabaseLoginAvailable ? "가능" : "설정 필요"}</strong></article>
        <article><span>서버 archive</span><strong>{serverArchive.status === "ready" ? `${serverArchive.workpacks.length}건` : "조회 대기"}</strong></article>
      </section>
      <section className="safeclaw-module-panel">
        <span>최근 작업 스냅샷 · 로컬</span>
        <h2>{current.data.scenario.siteName}</h2>
        <p>{current.data.riskSummary.topRisk}</p>
        <div className="safeclaw-archive-list">
          <article>
            <strong>문서팩 열기</strong>
            <code>/documents</code>
            <p>최신 작업의 편집, 정식 출력, 보완 제안을 이어서 처리합니다.</p>
          </article>
          <article>
            <strong>근거 확인</strong>
            <code>/evidence</code>
            <p>법령, KOSHA, 재해사례, 지식 DB 근거가 문서에 어떻게 반영됐는지 확인합니다.</p>
          </article>
          <article>
            <strong>서버 아카이브</strong>
            <code>workpacks · dispatch_logs</code>
            <p>관리자 로그인 세션이 있으면 Supabase에 저장된 문서팩과 전파 이력을 같은 화면에서 불러옵니다.</p>
          </article>
        </div>
        <p className="muted small">전파 대상 기준: {hasDispatchSnapshot ? `작업공간 전파 snapshot ${dispatchTargets.length}명` : "전파 snapshot 없음, 현재 작업자 명단에서 재계산"} · 갱신 시각: {savedLabel || "대기"}.</p>
        <p className="export-error">로컬 스냅샷과 서버 이력은 구분합니다. 제출 증빙은 관리자 로그인 후 저장된 서버 이력만 사용하세요.</p>
      </section>
      <section className="safeclaw-module-panel">
        <div className="compact-head">
          <div>
            <span>관리자 서버 이력</span>
            <h2>문서팩·전파 로그.</h2>
          </div>
          <button type="button" className="button secondary" onClick={loadServerArchive} disabled={serverArchive.status === "loading"}>
            {serverArchive.status === "loading" ? "조회 중" : "서버 이력 조회"}
          </button>
        </div>
        <p className={serverArchive.status === "error" || serverArchive.status === "login-required" ? "export-error" : "muted small"}>
          {serverArchive.message}
        </p>
        {serverArchive.status === "ready" ? (
          <div className="safeclaw-archive-list">
            {serverArchive.workpacks.length ? serverArchive.workpacks.map((item) => (
              <article key={item.id}>
                <strong>{item.siteName}</strong>
                <code>{new Date(item.createdAt).toLocaleString("ko-KR")}</code>
                <p>{excerpt(item.question, 150)}</p>
              </article>
            )) : (
              <article>
                <strong>문서팩 이력 없음</strong>
                <code>workpacks</code>
                <p>작업공간에서 문서팩을 저장하면 이 목록에 표시됩니다.</p>
              </article>
            )}
            {serverArchive.dispatchLogs.length ? serverArchive.dispatchLogs.slice(0, 6).map((log) => (
              <article key={log.id}>
                <strong>{log.channel} · {log.providerStatus || "상태 확인"}</strong>
                <code>{log.workflowRunId || log.provider || "dispatch_logs"}</code>
                <p>{log.targetLabel || "수신자"} · {log.siteName} · {new Date(log.createdAt).toLocaleString("ko-KR")}{log.failureReason ? ` · ${log.failureReason}` : ""}</p>
              </article>
            )) : null}
          </div>
        ) : null}
      </section>
      </>
      )}
    </>
  );
}
