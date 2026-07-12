"use client";

import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  buildStoredCurrentWorkpack,
  CURRENT_WORKPACK_STORAGE_KEY,
  inspectStoredCurrentWorkpack,
  type StoredCurrentWorkpack
} from "@/lib/current-workpack";
import {
  OPERATION_IMPROVEMENTS_STORAGE_KEY,
  parseOperationImprovements,
  type OperationImprovement
} from "@/lib/operation-improvement-history";
import {
  buildReportCsv,
  buildReportJson,
  buildReportLearningJsonl,
  buildReportLearningMarkdown,
  buildReportMarkdown,
  buildReportSnapshot,
  inspectServerReportWorkpackPayload,
  resolveReportProvenancePresentation,
  resolveReportViewState,
  toggleReportPhotoApproval,
  type ReportDateRange,
  type ReportFilters,
  type ReportGroup,
  type ReportPeriod,
  type ReportPhotoApproval,
  type ReportSnapshot,
  type ReportSourceMode,
  type ServerReportWorkpack,
  type ReportViewState
} from "@/lib/reporting-downloads";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

const periodOptions: Array<{ value: ReportPeriod; label: string; detail: string }> = [
  { value: "daily", label: "오늘", detail: "당일" },
  { value: "weekly", label: "주간", detail: "이번 주" },
  { value: "monthly", label: "월간", detail: "이번 달" },
  { value: "custom", label: "사용자", detail: "직접 선택" }
];

type DownloadState = {
  status: "idle" | "preparing" | "ready" | "error";
  message: string;
};

type DownloadRequest = {
  fileName: string;
  contentType: string;
  buildContent: () => string;
};

type CurrentWorkpackReadResult =
  | { status: "ready"; workpack: StoredCurrentWorkpack }
  | { status: "missing" }
  | { status: "invalid"; reason: string };

type LocalWorkpackCandidate = {
  workpack: StoredCurrentWorkpack;
  improvements: OperationImprovement[];
};

const EMPTY_REPORT_FACETS: ReportSnapshot["facets"] = {
  processes: [],
  tasks: [],
  riskLevels: [],
  improvementStatuses: [],
  sites: [],
  assignees: []
};

const INITIAL_DOWNLOAD_STATE: DownloadState = {
  status: "idle",
  message: ""
};

const reportExportLabels = [
  "개선사항 포함 MD",
  "공정·작업 분류 CSV",
  "관리자 원본 JSON",
  "다음 생성용 MD",
  "하네스 JSONL"
] as const;

const preservedHistoryStatusLabelMap: Record<NonNullable<OperationImprovement["status"]>, string> = {
  candidate: "후보",
  approved: "승인됨",
  rejected: "반려됨",
  reflected: "반영됨",
  proposed: "제안됨",
  in_progress: "진행 중",
  on_hold: "보류됨",
  completed: "완료됨",
  verified: "검증됨"
};

const evidenceLabelMap: Record<string, string> = {
  workpackSummaryDraft: "요약",
  riskAssessmentDraft: "위험성평가",
  workPlanDraft: "작업계획",
  tbmBriefing: "TBM",
  tbmLogDraft: "TBM 기록",
  safetyEducationRecordDraft: "교육기록",
  emergencyResponseDraft: "비상대응",
  photoEvidenceDraft: "사진증빙",
  foreignWorkerBriefing: "외국인 안내",
  foreignWorkerTransmission: "외국인 전송",
  kakaoMessage: "전파 메시지"
};

function downloadTextFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul"
  }).format(date);
}

function compactText(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function shortPeriodLabel(period: ReportPeriod) {
  if (period === "daily") return "오늘";
  if (period === "weekly") return "주간";
  if (period === "monthly") return "월간";
  return "사용자 기간";
}

function shortReportTitle(snapshot: ReportSnapshot) {
  return `${compactText(snapshot.scenario.siteName, 14)} · ${shortPeriodLabel(snapshot.period)}`;
}

function shortEvidenceRef(ref: string) {
  return evidenceLabelMap[ref] || compactText(ref.replace(/Draft$/u, ""), 12);
}

function formatGroupMeta(group: ReportGroup) {
  return `위험 ${group.count} · 개선 ${group.improvementCount}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
}

function preservedHistoryStatusLabel(status?: OperationImprovement["status"]) {
  return status ? preservedHistoryStatusLabelMap[status] : "후보";
}

function preservedHistorySourceLabel(item: OperationImprovement) {
  if (item.sourceType === "photo_analysis") {
    return item.visionStatus === "analyzed" ? "실제 이력 · 사진 분석" : "실제 이력 · 사진 후보";
  }
  return "실제 이력 · 현장 메모";
}

function resolveReportPreviewImprovements(
  improvements: readonly OperationImprovement[],
  sourceMode: ReportSourceMode
): OperationImprovement[] {
  if (sourceMode !== "browser_local") return [];
  return [...improvements];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCurrentWorkpack(): CurrentWorkpackReadResult {
  const inspected = inspectStoredCurrentWorkpack(window.localStorage.getItem(CURRENT_WORKPACK_STORAGE_KEY));
  if (inspected.status === "valid") {
    return { status: "ready", workpack: inspected.workpack };
  }
  if (inspected.status === "invalid") {
    return { status: "invalid", reason: inspected.reason };
  }
  return { status: "missing" };
}

function readResponseMessage(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.message === "string" ? payload.message : fallback;
}

async function readReportAccessToken(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const client = createClient(url, anonKey);
  const { data, error } = await client.auth.getSession();
  if (error) {
    console.error("report session read failed", error);
    return null;
  }
  return data.session?.access_token || null;
}

async function fetchServerReportWorkpack(
  workpackId: string,
  signal?: AbortSignal
): Promise<ServerReportWorkpack> {
  const accessToken = await readReportAccessToken();
  if (!accessToken) {
    throw new Error("관리자 로그인 세션이 없어 서버 저장 작업팩을 열 수 없습니다.");
  }
  const response = await fetch(`/api/workpacks/${encodeURIComponent(workpackId)}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal
  });
  const payload: unknown = await response.json().catch((): unknown => ({}));
  if (!response.ok) {
    throw new Error(readResponseMessage(payload, "서버 저장 작업팩을 불러오지 못했습니다."));
  }
  const parsed = inspectServerReportWorkpackPayload(payload, workpackId);
  if (!parsed) {
    throw new Error("서버 저장 작업팩의 리포트 복원 데이터 또는 저장시각을 확인해야 합니다.");
  }
  return parsed;
}

function GroupList({ title, groups }: { title: string; groups: ReportGroup[] }) {
  return (
    <article className="safeclaw-report-group">
      <span>{title}</span>
      <div>
        {groups.length ? groups.slice(0, 5).map((group) => (
          <p key={group.label}>
            <strong>{compactText(group.label, 16)}</strong>
            <em>{formatGroupMeta(group)}</em>
          </p>
        )) : (
          <p>
            <strong>해당 항목 없음</strong>
            <em>연결 항목 없음</em>
          </p>
        )}
      </div>
    </article>
  );
}

function ReportProvenanceFacts({
  snapshot,
  label
}: {
  snapshot: ReportSnapshot;
  label: string;
}) {
  const provenance = resolveReportProvenancePresentation(snapshot.source);
  return (
    <div
      className="safeclaw-report-facts"
      aria-label={label}
      data-report-source-mode={snapshot.source.mode}
    >
      <p><strong>데이터 출처</strong><span>{provenance.label}</span></p>
      <p>
        <strong>{provenance.savedTimeLabel}</strong>
        <span><time dateTime={snapshot.source.workpackSavedAt}>{formatDate(snapshot.source.workpackSavedAt)}</time></span>
      </p>
      {snapshot.source.workpackGeneratedAt ? (
        <p>
          <strong>작업팩 생성</strong>
          <span><time dateTime={snapshot.source.workpackGeneratedAt}>{formatDate(snapshot.source.workpackGeneratedAt)}</time></span>
        </p>
      ) : null}
      <p>
        <strong>리포트 생성</strong>
        <span><time dateTime={snapshot.generatedAt}>{formatDate(snapshot.generatedAt)}</time></span>
      </p>
      {snapshot.source.workpackId ? (
        <p><strong>서버 문서팩</strong><span>{snapshot.source.workpackId}</span></p>
      ) : null}
    </div>
  );
}

function RequestedServerProvenance({ workpackId }: { workpackId: string }) {
  return (
    <div
      className="safeclaw-report-facts"
      aria-label="요청한 서버 작업팩 출처"
      data-report-source-mode="server_saved"
    >
      <p><strong>데이터 출처</strong><span>서버 저장 작업팩</span></p>
      <p><strong>서버 문서팩</strong><span>{workpackId}</span></p>
    </div>
  );
}

function BlockedDownloadActions({ detail }: { detail: string }) {
  return (
    <div className="safeclaw-download-actions" aria-label="리포트 다운로드">
      <p
        className="safeclaw-download-note"
        aria-label="다운로드 준비 상태"
        data-download-readiness="blocked"
      >
        <strong>다운로드 잠김</strong> · {detail}
      </p>
      {reportExportLabels.map((label, index) => (
        <button
          key={label}
          type="button"
          className={index === 0 ? "button" : "button secondary"}
          disabled
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function DownloadActions({
  snapshot,
  viewState,
  downloadState,
  onDownload
}: {
  snapshot: ReportSnapshot;
  viewState: ReportViewState;
  downloadState: DownloadState;
  onDownload: (request: DownloadRequest) => Promise<void>;
}) {
  const canDownload = viewState.canDownload;
  const disabled = !canDownload || downloadState.status === "preparing";

  return (
    <div className="safeclaw-download-actions" aria-label="리포트 다운로드">
      <p className="safeclaw-download-note">
        승인한 Before/After 사진만 포함해 개선 리포트와 운영 메모리를 분리합니다.
      </p>
      <p
        className={downloadState.status === "error" ? "export-error" : "safeclaw-download-note"}
        aria-label="다운로드 준비 상태"
        data-download-readiness={viewState.status}
        aria-live="polite"
      >
        <strong>{downloadState.message || viewState.title}</strong>
        {downloadState.message ? null : <> · {viewState.detail}</>}
      </p>
      <button
        type="button"
        className="button"
        disabled={disabled}
        onClick={() => void onDownload({
          fileName: `${snapshot.fileBaseName}.md`,
          contentType: "text/markdown;charset=utf-8",
          buildContent: () => buildReportMarkdown(snapshot)
        })}
      >
        개선사항 포함 MD
      </button>
      <button
        type="button"
        className="button secondary"
        disabled={disabled}
        onClick={() => void onDownload({
          fileName: `${snapshot.fileBaseName}.csv`,
          contentType: "text/csv;charset=utf-8",
          buildContent: () => buildReportCsv(snapshot)
        })}
      >
        공정·작업 분류 CSV
      </button>
      <button
        type="button"
        className="button secondary"
        disabled={disabled}
        onClick={() => void onDownload({
          fileName: `${snapshot.fileBaseName}.json`,
          contentType: "application/json;charset=utf-8",
          buildContent: () => buildReportJson(snapshot)
        })}
      >
        관리자 원본 JSON
      </button>
      <p className="safeclaw-download-note">
        아래 파일은 승인 전 지식 후보입니다. 사용자 근거처럼 바로 노출하지 않습니다.
      </p>
      <button
        type="button"
        className="button secondary"
        disabled={disabled}
        onClick={() => void onDownload({
          fileName: `${snapshot.fileBaseName}-corpus.md`,
          contentType: "text/markdown;charset=utf-8",
          buildContent: () => buildReportLearningMarkdown(snapshot)
        })}
      >
        다음 생성용 MD
      </button>
      <button
        type="button"
        className="button secondary"
        disabled={disabled}
        onClick={() => void onDownload({
          fileName: `${snapshot.fileBaseName}-corpus.jsonl`,
          contentType: "application/x-ndjson;charset=utf-8",
          buildContent: () => buildReportLearningJsonl(snapshot)
        })}
      >
        하네스 JSONL
      </button>
    </div>
  );
}

function EvidenceList({ refs }: { refs: string[] }) {
  return (
    <div className="safeclaw-workdoc-evidence">
      {refs.length ? refs.map((ref) => <code key={ref}>{shortEvidenceRef(ref)}</code>) : <code>현장 확인</code>}
    </div>
  );
}

function ReportStatePanel({ viewState }: { viewState: ReportViewState }) {
  return (
    <article className="safeclaw-workdoc" aria-label="리포트 상태">
      <header className="safeclaw-workdoc-header">
        <span>{viewState.status === "error" ? "오류" : "빈 상태"}</span>
        <h2>{viewState.title}</h2>
        <p>{viewState.detail}</p>
      </header>
      <section className="safeclaw-workdoc-section">
        <div className="safeclaw-workdoc-section-head">
          <span>01</span>
          <h3>선택 조건</h3>
        </div>
        <div className="safeclaw-report-notes">
          <p>우측에서 기간과 필터를 조정하면 리포트를 다시 준비합니다.</p>
          <p>사진 파일명은 Before/After 포함 승인 전까지 산출물에 들어가지 않습니다.</p>
        </div>
      </section>
    </article>
  );
}

function PreservedHistorySection({
  improvements,
  excludedFrom
}: {
  improvements: readonly OperationImprovement[];
  excludedFrom: "샘플" | "서버 저장 작업팩";
}) {
  return (
    <section aria-label="보존된 실제 개선 이력">
      <span>보존 이력</span>
      <p className="safeclaw-download-note">
        이 목록은 현재 브라우저에 저장된 실제 개선 이력입니다.
      </p>
      <p className="safeclaw-download-note">
        {excludedFrom} 리포트 본문과 증빙 다운로드에는 합치지 않습니다.
      </p>
      <div className="safeclaw-workdoc-list safeclaw-preserved-history-list">
        {improvements.map((item) => (
          <article key={item.id}>
            <div>
              <strong>{compactText(item.hazardLabel, 22)}</strong>
              <code>{preservedHistoryStatusLabel(item.status)} · {formatDate(item.createdAt)}</code>
            </div>
            <p>
              <b>현장</b>
              <span>{compactText(`${item.siteName} · ${item.workSummary}`, 48)}</span>
            </p>
            <p>
              <b>개선</b>
              <span>{compactText(item.improvementText, 72)}</span>
            </p>
            <span>{preservedHistorySourceLabel(item)}</span>
            <span>{item.reflectedDocuments.join(" · ") || "반영 문서 확인"}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReportDocument({
  snapshot,
  onTogglePhotoApproval
}: {
  snapshot: ReportSnapshot;
  onTogglePhotoApproval: (improvementId: string) => void;
}) {
  return (
    <article className="safeclaw-workdoc" aria-label="작업문서형 리포트">
      <header className="safeclaw-workdoc-header">
        <span>리포트</span>
        <h2>{shortReportTitle(snapshot)}</h2>
        <p>위험성평가와 개선사항을 한 문서에서 검토합니다. 외부 제출은 하지 않습니다.</p>
        <div className="safeclaw-workdoc-meta">
          <p><strong>현장</strong><span>{compactText(snapshot.scenario.siteName, 16)}</span></p>
          <p><strong>작업</strong><span>{compactText(snapshot.scenario.workSummary, 16)}</span></p>
          <p><strong>기간</strong><span>{shortPeriodLabel(snapshot.period)}</span></p>
          <p><strong>생성</strong><span>{formatDate(snapshot.generatedAt)}</span></p>
        </div>
        <ReportProvenanceFacts snapshot={snapshot} label="리포트 헤더 데이터 출처" />
      </header>

      <section className="safeclaw-workdoc-section">
        <div className="safeclaw-workdoc-section-head">
          <span>01</span>
          <h3>작업 기준</h3>
        </div>
        <div className="safeclaw-report-facts">
          <p><strong>회사</strong><span>{snapshot.scenario.companyName || "확인 필요"}</span></p>
          <p><strong>현장</strong><span>{snapshot.scenario.siteName}</span></p>
          <p><strong>작업</strong><span>{snapshot.scenario.workSummary}</span></p>
          <p><strong>인원</strong><span>{snapshot.scenario.workerCount}명</span></p>
          <p><strong>기상/조건</strong><span>{snapshot.scenario.weatherNote || "확인 필요"}</span></p>
        </div>
      </section>

      <section className="safeclaw-workdoc-section">
        <div className="safeclaw-workdoc-section-head">
          <span>02</span>
          <h3>위험 As-Is/To-Be</h3>
        </div>
        <div className="safeclaw-report-table" role="table" aria-label="위험성평가 리포트">
          <div role="row">
            <strong role="columnheader">작업</strong>
            <strong role="columnheader">위험</strong>
            <strong role="columnheader">현재</strong>
            <strong role="columnheader">개선</strong>
            <strong role="columnheader">근거</strong>
          </div>
          {snapshot.riskRows.map((row) => (
            <div key={`${row.index}-${row.hazard}`} role="row">
              <span role="cell" data-label="작업">
                {compactText(row.task, 18)}
                <em>{compactText(row.process, 12)} · {row.riskLevelLabel}</em>
              </span>
              <span role="cell" data-label="위험">{compactText(row.hazard, 24)}</span>
              <span role="cell" data-label="현재">{compactText(row.currentControls, 34)}</span>
              <span role="cell" data-label="개선">{compactText(row.additionalControls, 42)}</span>
              <span role="cell" data-label="근거">{row.evidenceRefs.map(shortEvidenceRef).join(" · ")}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="safeclaw-workdoc-section">
        <div className="safeclaw-workdoc-section-head">
          <span>03</span>
          <h3>개선사항</h3>
        </div>
        <div className="safeclaw-workdoc-list">
          {snapshot.improvements.length ? snapshot.improvements.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.hazardLabel}</strong>
                <code>{item.improvementStatusLabel} · {formatDate(item.createdAt)}</code>
              </div>
              <p><b>현재</b>{compactText(item.asIs, 44)}</p>
              <p><b>개선</b>{compactText(item.toBe, 62)}</p>
              <span>{item.reflectedDocuments.join(" · ") || "반영 문서 확인"}</span>
              {item.hasPhotoPair ? (
                <label>
                  <input
                    type="checkbox"
                    checked={item.photoApproved}
                    onChange={() => onTogglePhotoApproval(item.id)}
                  />
                  Before/After 사진 포함 승인
                </label>
              ) : null}
            </article>
          )) : (
            <article>
              <div>
                <strong>개선사항 없음</strong>
                <code>{snapshot.periodLabel}</code>
              </div>
              <p><b>다음</b>작업공간에서 개선 메모를 저장하면 표시됩니다.</p>
              <Link href="/workspace">개선사항 저장하기</Link>
            </article>
          )}
        </div>
      </section>

      <section className="safeclaw-workdoc-section">
        <div className="safeclaw-workdoc-section-head">
          <span>04</span>
          <h3>리포트 메모</h3>
        </div>
        <div className="safeclaw-report-notes">
          {snapshot.notes.map((note) => <p key={note}>{note}</p>)}
        </div>
      </section>
    </article>
  );
}

export function ReportsDownloadCenter({ serverWorkpackId }: { serverWorkpackId?: string }) {
  const [period, setPeriod] = useState<ReportPeriod>("weekly");
  const [dateRange, setDateRange] = useState<ReportDateRange>({ start: "", end: "" });
  const [filters, setFilters] = useState<ReportFilters>({});
  const [photoApprovals, setPhotoApprovals] = useState<ReportPhotoApproval[]>([]);
  const [workpack, setWorkpack] = useState<StoredCurrentWorkpack | null>(null);
  const [improvements, setImprovements] = useState<OperationImprovement[]>([]);
  const [sourceMode, setSourceMode] = useState<ReportSourceMode>("browser_local");
  const [sourceWorkpackId, setSourceWorkpackId] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [missingCurrent, setMissingCurrent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localSwitchCandidate, setLocalSwitchCandidate] = useState<LocalWorkpackCandidate | null>(null);
  const [downloadState, setDownloadState] = useState<DownloadState>(INITIAL_DOWNLOAD_STATE);
  const usingSample = sourceMode === "sample";

  function loadLocalState() {
    setPhotoApprovals([]);
    try {
      const localImprovements = parseOperationImprovements(
        window.localStorage.getItem(OPERATION_IMPROVEMENTS_STORAGE_KEY)
      );
      const current = readCurrentWorkpack();
      setImprovements(localImprovements);
      setSourceMode("browser_local");
      setSourceWorkpackId(undefined);
      setLocalSwitchCandidate(null);
      if (current.status === "ready") {
        setWorkpack(current.workpack);
        setMissingCurrent(false);
        setLoadError(null);
      } else if (current.status === "missing") {
        setWorkpack(null);
        setMissingCurrent(true);
        setLoadError(null);
      } else {
        setWorkpack(null);
        setMissingCurrent(false);
        setLoadError(current.reason);
      }
      setLoading(false);
      setDownloadState(INITIAL_DOWNLOAD_STATE);
    } catch (error) {
      console.error("safeclaw report state load failed", error);
      setWorkpack(null);
      setMissingCurrent(false);
      setLoadError("브라우저의 현재 작업 데이터를 불러오지 못했습니다.");
      setLocalSwitchCandidate(null);
      setLoading(false);
    }
  }

  async function loadRequestedState(signal?: AbortSignal) {
    if (!serverWorkpackId) {
      loadLocalState();
      return;
    }

    setLoading(true);
    setWorkpack(null);
    setSourceMode("server_saved");
    setSourceWorkpackId(serverWorkpackId);
    setLoadError(null);
    setMissingCurrent(false);
    setPhotoApprovals([]);
    setDownloadState(INITIAL_DOWNLOAD_STATE);
    let localImprovements: OperationImprovement[] = [];
    let candidate: LocalWorkpackCandidate | null = null;
    try {
      localImprovements = parseOperationImprovements(
        window.localStorage.getItem(OPERATION_IMPROVEMENTS_STORAGE_KEY)
      );
      const current = readCurrentWorkpack();
      if (current.status === "ready") {
        candidate = { workpack: current.workpack, improvements: localImprovements };
      }
    } catch (error) {
      console.error("local report switch candidate read failed", error);
    }
    setLocalSwitchCandidate(candidate);

    try {
      const server = await fetchServerReportWorkpack(serverWorkpackId, signal);
      if (signal?.aborted) return;
      setWorkpack(server.workpack);
      setImprovements(localImprovements);
      setSourceMode("server_saved");
      setSourceWorkpackId(server.id);
      setLocalSwitchCandidate(null);
      setLoading(false);
    } catch (error) {
      if (signal?.aborted) return;
      console.error("server report workpack load failed", error);
      setWorkpack(null);
      setImprovements(localImprovements);
      setSourceMode("server_saved");
      setSourceWorkpackId(serverWorkpackId);
      setLoadError(errorMessage(error));
      setMissingCurrent(false);
      setLocalSwitchCandidate(candidate);
      setLoading(false);
    }
  }

  function switchToLocalWorkpack() {
    if (!localSwitchCandidate) return;
    setPhotoApprovals([]);
    setWorkpack(localSwitchCandidate.workpack);
    setImprovements(localSwitchCandidate.improvements);
    setSourceMode("browser_local");
    setSourceWorkpackId(undefined);
    setLoadError(null);
    setMissingCurrent(false);
    setLocalSwitchCandidate(null);
    setLoading(false);
    setDownloadState(INITIAL_DOWNLOAD_STATE);
  }

  function loadSamplePreview() {
    setPhotoApprovals([]);
    setWorkpack(buildStoredCurrentWorkpack(buildSampleWorkpack()));
    setSourceMode("sample");
    setSourceWorkpackId(undefined);
    setMissingCurrent(false);
    setLoadError(null);
    setLocalSwitchCandidate(null);
    setLoading(false);
    setDownloadState(INITIAL_DOWNLOAD_STATE);
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadRequestedState(controller.signal);
    return () => controller.abort();
  }, [serverWorkpackId]);

  const preservedHistory = useMemo(
    () => [...improvements].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [improvements]
  );

  const reportResult = useMemo((): { snapshot: ReportSnapshot | null; error: string | null } => {
    if (!workpack) return { snapshot: null, error: null };
    const reportImprovements = resolveReportPreviewImprovements(preservedHistory, sourceMode);
    try {
      return {
        snapshot: buildReportSnapshot({
          workpack,
          improvements: reportImprovements,
          period,
          dateRange: period === "custom" ? dateRange : undefined,
          filters,
          photoApprovals,
          sourceMode,
          sourceWorkpackId
        }),
        error: null
      };
    } catch (error) {
      return { snapshot: null, error: errorMessage(error) };
    }
  }, [dateRange, filters, period, photoApprovals, preservedHistory, sourceMode, sourceWorkpackId, workpack]);
  const snapshot = reportResult.snapshot;
  const viewState = resolveReportViewState(snapshot, reportResult.error || loadError);
  const facets = snapshot?.facets || EMPTY_REPORT_FACETS;
  const evidenceRefs = useMemo(
    () => snapshot ? Array.from(new Set(snapshot.riskRows.flatMap((row) => row.evidenceRefs))).filter(Boolean) : [],
    [snapshot]
  );
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  useEffect(() => {
    setDownloadState(INITIAL_DOWNLOAD_STATE);
  }, [dateRange, filters, period, photoApprovals]);

  function togglePhotoApproval(improvementId: string) {
    setPhotoApprovals((current) => toggleReportPhotoApproval(current, improvements, improvementId));
  }

  async function handleDownload(request: DownloadRequest) {
    if (!viewState.canDownload) return;
    setDownloadState({ status: "preparing", message: "다운로드 준비 중" });
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      downloadTextFile(request.fileName, request.buildContent(), request.contentType);
      setDownloadState({ status: "ready", message: `다운로드 시작됨 · ${request.fileName}` });
    } catch (error) {
      console.error("safeclaw report download failed", error);
      setDownloadState({ status: "error", message: `다운로드 오류 · ${errorMessage(error)}` });
    }
  }

  if (!workpack) {
    if (loading) {
      return (
        <section className="safeclaw-module-panel" aria-label="리포트 데이터 확인 상태">
          <span>데이터 출처 확인</span>
          <h2>{serverWorkpackId ? "서버 저장 작업팩을 확인하고 있습니다." : "최근 작업팩을 확인하고 있습니다."}</h2>
          <p>리포트에 사용할 작업팩을 확인하는 중입니다.</p>
          {serverWorkpackId ? <RequestedServerProvenance workpackId={serverWorkpackId} /> : null}
        </section>
      );
    }
    if (serverWorkpackId && sourceMode === "server_saved" && loadError) {
      return (
        <section className="safeclaw-module-panel" aria-label="서버 작업팩 오류 상태">
          <span>서버 작업팩 오류</span>
          <h2>서버 저장 작업팩을 열지 못했습니다.</h2>
          <RequestedServerProvenance workpackId={serverWorkpackId} />
          <p>{loadError}</p>
          <BlockedDownloadActions detail="요청한 서버 작업팩을 확인하기 전에는 내보낼 수 없습니다." />
          <div className="safeclaw-workdoc-links">
            <button type="button" className="button secondary" onClick={() => void loadRequestedState()}>
              서버 작업팩 다시 시도
            </button>
            {localSwitchCandidate ? (
              <button type="button" className="button secondary" onClick={switchToLocalWorkpack}>
                브라우저 최근 작업팩으로 전환
              </button>
            ) : null}
          </div>
        </section>
      );
    }
    const isCalmEmpty = missingCurrent && !loadError;
    return (
      <section className="safeclaw-module-panel workbench-empty-state" aria-label={isCalmEmpty ? "리포트 빈 상태" : "리포트 데이터 오류"}>
        <span>{isCalmEmpty ? "데이터 출처 · 없음" : "리포트 오류"}</span>
        <h2>{isCalmEmpty ? "최근 작업팩이 없습니다." : "현재 작업을 불러오지 못했습니다."}</h2>
        <p>{isCalmEmpty ? "작업공간에서 문서팩을 만든 뒤 리포트로 돌아오세요." : loadError}</p>
        {improvements.length ? <p>보존된 개선 이력 {improvements.length}건은 유지됩니다.</p> : null}
        <div className="safeclaw-report-facts" aria-label="다운로드 준비 상태">
          <p>
            <strong>{isCalmEmpty ? "현재 작업팩 필요" : "다운로드 잠김"}</strong>
            <span>{isCalmEmpty ? "작업팩을 만든 뒤 다운로드를 준비할 수 있습니다." : "작업팩 데이터를 확인한 뒤 다시 시도하세요."}</span>
          </p>
        </div>
        <div className="safeclaw-workdoc-links">
          {isCalmEmpty ? <Link href="/workspace">작업공간에서 만들기</Link> : (
            <button type="button" className="button secondary" onClick={() => void loadRequestedState()}>다시 불러오기</button>
          )}
          <button type="button" className="button secondary" onClick={loadSamplePreview}>샘플 미리보기</button>
        </div>
      </section>
    );
  }

  const topProvenance = snapshot ? resolveReportProvenancePresentation(snapshot.source) : null;

  return (
    <>
      <section className={`safeclaw-current-workpack ${usingSample ? "sample" : "live"}`} aria-live="polite">
        <span>{usingSample ? "샘플 리포트" : "데이터 출처"}</span>
        <strong>
          {topProvenance
            ? `${topProvenance.label} · ${topProvenance.savedTimeLabel} ${formatDate(workpack.savedAt)}`
            : "리포트 데이터 확인 필요"}
        </strong>
        <button type="button" className="button secondary" onClick={() => void loadRequestedState()}>다시 불러오기</button>
      </section>

      <section className="safeclaw-workdoc-shell">
        {snapshot ? (
          <ReportDocument snapshot={snapshot} onTogglePhotoApproval={togglePhotoApproval} />
        ) : (
          <ReportStatePanel viewState={viewState} />
        )}
        <aside className="safeclaw-workdoc-rail" aria-label="작업문서 도구">
          {snapshot ? (
            <section>
              <span>데이터 출처</span>
              <ReportProvenanceFacts snapshot={snapshot} label="고정 리포트 데이터 출처" />
            </section>
          ) : null}
          <section>
            <span>기간</span>
            <div className="safeclaw-report-controls" aria-label="리포트 기간 선택">
              {periodOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={period === option.value ? "active" : ""}
                  onClick={() => setPeriod(option.value)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.detail}</span>
                </button>
              ))}
            </div>
            {period === "custom" ? (
              <div className="safeclaw-report-facts">
                <p>
                  <strong>시작</strong>
                  <input
                    type="date"
                    aria-label="사용자 기간 시작일"
                    value={dateRange.start}
                    max={dateRange.end || undefined}
                    onChange={(event) => setDateRange((current) => ({ ...current, start: event.target.value }))}
                  />
                </p>
                <p>
                  <strong>종료</strong>
                  <input
                    type="date"
                    aria-label="사용자 기간 종료일"
                    value={dateRange.end}
                    min={dateRange.start || undefined}
                    onChange={(event) => setDateRange((current) => ({ ...current, end: event.target.value }))}
                  />
                </p>
              </div>
            ) : null}
          </section>

          <section>
            <span>필터 {activeFilterCount ? `${activeFilterCount}` : ""}</span>
            <div className="safeclaw-report-facts workbench-report-filters" aria-label="리포트 필터">
              <p>
                <strong>공정</strong>
                <select
                  aria-label="공정 필터"
                  value={filters.process || ""}
                  onChange={(event) => setFilters((current) => ({ ...current, process: event.target.value || undefined }))}
                >
                  <option value="">전체</option>
                  {facets.processes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </p>
              <p>
                <strong>작업</strong>
                <select
                  aria-label="작업 필터"
                  value={filters.task || ""}
                  onChange={(event) => setFilters((current) => ({ ...current, task: event.target.value || undefined }))}
                >
                  <option value="">전체</option>
                  {facets.tasks.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </p>
              <p>
                <strong>위험등급</strong>
                <select
                  aria-label="위험등급 필터"
                  value={filters.riskLevel || ""}
                  onChange={(event) => setFilters((current) => ({
                    ...current,
                    riskLevel: event.target.value
                      ? event.target.value as NonNullable<ReportFilters["riskLevel"]>
                      : undefined
                  }))}
                >
                  <option value="">전체</option>
                  {facets.riskLevels.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </p>
              <p>
                <strong>개선상태</strong>
                <select
                  aria-label="개선상태 필터"
                  value={filters.improvementStatus || ""}
                  onChange={(event) => setFilters((current) => ({
                    ...current,
                    improvementStatus: event.target.value
                      ? event.target.value as NonNullable<ReportFilters["improvementStatus"]>
                      : undefined
                  }))}
                >
                  <option value="">전체</option>
                  {facets.improvementStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </p>
              <p>
                <strong>현장</strong>
                <select
                  aria-label="현장 필터"
                  value={filters.site || ""}
                  onChange={(event) => setFilters((current) => ({ ...current, site: event.target.value || undefined }))}
                >
                  <option value="">전체</option>
                  {facets.sites.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </p>
              <p>
                <strong>담당자</strong>
                <select
                  aria-label="담당자 필터"
                  value={filters.assignee || ""}
                  onChange={(event) => setFilters((current) => ({ ...current, assignee: event.target.value || undefined }))}
                >
                  <option value="">전체</option>
                  {facets.assignees.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </p>
            </div>
            <button
              type="button"
              className="button secondary"
              disabled={!activeFilterCount}
              onClick={() => setFilters({})}
            >
              필터 초기화
            </button>
          </section>

          <section>
            <span>다운로드</span>
            {snapshot ? (
              <DownloadActions
                snapshot={snapshot}
                viewState={viewState}
                downloadState={downloadState}
                onDownload={handleDownload}
              />
            ) : (
              <p
                className={viewState.status === "error" ? "export-error" : "safeclaw-download-note"}
                aria-label="다운로드 준비 상태"
              >
                <strong>{viewState.title}</strong> · {viewState.detail}
              </p>
            )}
          </section>

          <section>
            <span>요약</span>
            <div className="safeclaw-workdoc-stats">
              <p><strong>{snapshot?.summary.riskRows || 0}</strong><span>평가 행</span></p>
              <p><strong>{snapshot?.summary.highRiskRows || 0}</strong><span>고위험</span></p>
              <p><strong>{snapshot?.summary.improvements || 0}</strong><span>개선사항</span></p>
              <p><strong>{snapshot?.summary.photoCandidates || 0}</strong><span>사진 후보</span></p>
              <p><strong>{snapshot?.summary.photoImprovements || 0}</strong><span>승인 사진</span></p>
            </div>
          </section>

          {sourceMode !== "browser_local" && preservedHistory.length ? (
            <PreservedHistorySection
              improvements={preservedHistory}
              excludedFrom={usingSample ? "샘플" : "서버 저장 작업팩"}
            />
          ) : null}

          <section>
            <span>근거</span>
            <EvidenceList refs={evidenceRefs} />
          </section>

          <section>
            <span>분류</span>
            <div className="safeclaw-report-groups">
              <GroupList title="공정별" groups={snapshot?.groups.byProcess || []} />
              <GroupList title="작업별" groups={snapshot?.groups.byTask || []} />
              <GroupList title="위험등급별" groups={snapshot?.groups.byRiskLevel || []} />
              <GroupList title="문서반영별" groups={snapshot?.groups.byDocument || []} />
            </div>
          </section>

          <section>
            <span>다음</span>
            <div className="safeclaw-workdoc-links">
              <Link href="/documents">문서팩 편집</Link>
              <Link href="/workspace">개선사항 추가</Link>
            </div>
          </section>
        </aside>
      </section>
    </>
  );
}
