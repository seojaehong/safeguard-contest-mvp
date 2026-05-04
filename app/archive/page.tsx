"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import {
  CURRENT_WORKPACK_STORAGE_KEY,
  parseStoredCurrentWorkpack,
  type StoredCurrentWorkpack
} from "@/lib/current-workpack";

type ArchiveStatus = "checking" | "ready" | "partial" | "empty" | "login-required" | "unconfigured" | "error";

type ArchiveWorkpack = {
  id: string;
  organizationName: string;
  siteName: string;
  industry: string | null;
  region: string | null;
  question: string;
  createdAt: string;
  updatedAt: string;
  lastGeneratedAt: string;
  reopenHref: string;
  editHref: string;
};

type ArchiveDispatchLog = {
  id: string;
  siteName: string;
  workpackId: string | null;
  channel: string;
  targetLabel: string | null;
  languageCode: string | null;
  provider: string | null;
  providerStatus: string | null;
  workflowRunId: string | null;
  failureReason: string | null;
  createdAt: string;
  reopenHref: string;
};

type ArchiveState = {
  status: ArchiveStatus;
  message: string;
  workpacks: ArchiveWorkpack[];
  dispatchLogs: ArchiveDispatchLog[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function readNullableString(value: unknown) {
  const text = readString(value);
  return text || null;
}

function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
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

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const payload = await response.json().catch((): unknown => ({}));
  return isRecord(payload) ? payload : {};
}

function readArchiveWorkpacks(value: unknown): ArchiveWorkpack[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): ArchiveWorkpack[] => {
    if (!isRecord(item)) return [];

    const id = readString(item.id);
    const createdAt = readString(item.createdAt);
    if (!id || !createdAt) return [];

    const updatedAt = readString(item.updatedAt, createdAt);

    return [{
      id,
      organizationName: readString(item.organizationName, "SafeClaw Pilot"),
      siteName: readString(item.siteName, "기본 현장"),
      industry: readNullableString(item.industry),
      region: readNullableString(item.region),
      question: readString(item.question, "저장된 문서팩"),
      createdAt,
      updatedAt,
      lastGeneratedAt: readString(item.lastGeneratedAt, updatedAt),
      reopenHref: readString(item.reopenHref, "/documents"),
      editHref: readString(item.editHref, "/workspace#history")
    }];
  });
}

function readArchiveDispatchLogs(value: unknown): ArchiveDispatchLog[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): ArchiveDispatchLog[] => {
    if (!isRecord(item)) return [];

    const id = readString(item.id);
    const channel = readString(item.channel);
    const createdAt = readString(item.createdAt);
    if (!id || !channel || !createdAt) return [];

    return [{
      id,
      siteName: readString(item.siteName, "기본 현장"),
      workpackId: readNullableString(item.workpackId),
      channel,
      targetLabel: readNullableString(item.targetLabel),
      languageCode: readNullableString(item.languageCode),
      provider: readNullableString(item.provider),
      providerStatus: readNullableString(item.providerStatus),
      workflowRunId: readNullableString(item.workflowRunId),
      failureReason: readNullableString(item.failureReason),
      createdAt,
      reopenHref: readString(item.reopenHref, "/dispatch")
    }];
  });
}

function formatArchiveTime(value: string | null | undefined) {
  if (!value) return "아직 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "시간 확인 필요";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function latestServerTime(workpacks: ArchiveWorkpack[], dispatchLogs: ArchiveDispatchLog[]) {
  const times = [
    ...workpacks.map((item) => item.lastGeneratedAt),
    ...dispatchLogs.map((item) => item.createdAt)
  ]
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (!times.length) return null;
  return new Date(Math.max(...times)).toISOString();
}

function excerpt(text: string, maxLength = 150) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}...`;
}

function buildArchiveMessage(status: ArchiveStatus, workpackMessage: string, dispatchMessage: string) {
  if (status === "partial") {
    return `${workpackMessage || "문서팩 이력 확인 완료"} · ${dispatchMessage || "전파 로그 확인 완료"}`;
  }
  if (workpackMessage && dispatchMessage && workpackMessage !== dispatchMessage) {
    return `${workpackMessage} · ${dispatchMessage}`;
  }
  return workpackMessage || dispatchMessage || "서버 아카이브를 확인했습니다.";
}

function localWorkerCount(workpack: StoredCurrentWorkpack | null) {
  if (!workpack?.workerSnapshot) return "미저장";
  return `${workpack.workerSnapshot.workers.length}명`;
}

function localDispatchCount(workpack: StoredCurrentWorkpack | null) {
  if (!workpack?.dispatchSnapshot) return "미저장";
  return `${workpack.dispatchSnapshot.targetWorkers.length}명`;
}

function statusTone(status: ArchiveStatus) {
  return status === "error" ? "export-error" : "muted small";
}

function ServerWorkpackList({ workpacks }: { workpacks: ArchiveWorkpack[] }) {
  if (!workpacks.length) {
    return (
      <article>
        <strong>저장된 문서팩 대기</strong>
        <code>workpacks</code>
        <p>작업공간에서 문서팩을 저장하면 현장, 생성 시각, 다시 열기 경로가 여기에 쌓입니다.</p>
        <Link href="/workspace">작업공간에서 첫 문서팩 저장</Link>
      </article>
    );
  }

  return (
    <>
      {workpacks.map((item) => (
        <article key={item.id}>
          <strong>{item.siteName}</strong>
          <code>{formatArchiveTime(item.lastGeneratedAt)}</code>
          <p>{excerpt(item.question)}</p>
          <p className="muted small">
            {item.organizationName}{item.region ? ` · ${item.region}` : ""}{item.industry ? ` · ${item.industry}` : ""}
          </p>
          <a href={item.reopenHref}>다시 열기</a>
          <a href={item.editHref}>작업공간에서 편집</a>
        </article>
      ))}
    </>
  );
}

function DispatchLogList({ logs }: { logs: ArchiveDispatchLog[] }) {
  if (!logs.length) {
    return (
      <article>
        <strong>전파 로그 대기</strong>
        <code>dispatch_logs</code>
        <p>메일·문자 전송 결과가 저장되면 채널, 수신자, provider 상태, 실패 사유를 같은 이력에서 확인합니다.</p>
        <Link href="/dispatch">전파 화면으로 이동</Link>
      </article>
    );
  }

  return (
    <>
      {logs.slice(0, 8).map((log) => (
        <article key={log.id}>
          <strong>{log.channel} · {log.providerStatus || "결과 확인"}</strong>
          <code>{formatArchiveTime(log.createdAt)}</code>
          <p>
            {log.targetLabel || "수신자"} · {log.siteName}
            {log.languageCode ? ` · ${log.languageCode}` : ""}
            {log.failureReason ? ` · ${log.failureReason}` : ""}
          </p>
          <p className="muted small">{log.workflowRunId || log.provider || "전파 기록"}</p>
          <a href={log.reopenHref}>전파 내역 다시 보기</a>
        </article>
      ))}
    </>
  );
}

export default function ArchivePage() {
  const [localWorkpack, setLocalWorkpack] = useState<StoredCurrentWorkpack | null>(null);
  const [archive, setArchive] = useState<ArchiveState>({
    status: "checking",
    message: "저장된 작업 이력을 확인하고 있습니다.",
    workpacks: [],
    dispatchLogs: []
  });

  const loadServerArchive = useCallback(async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setArchive({
        status: "unconfigured",
        message: "서버 아카이브 연결 전입니다. 지금은 이 브라우저의 최근 작업을 이어서 사용할 수 있고, 운영 저장소 연결 후 팀 이력이 자동으로 표시됩니다.",
        workpacks: [],
        dispatchLogs: []
      });
      return;
    }

    setArchive((current) => ({
      ...current,
      status: "checking",
      message: "저장된 문서팩과 전파 로그를 불러오고 있습니다."
    }));

    const session = await readSession();
    if (!session) {
      setArchive({
        status: "login-required",
        message: "관리자 세션이 확인되면 서버에 저장된 문서팩과 전파 로그를 불러옵니다. 지금은 로컬 최근 작업만 이어서 사용할 수 있습니다.",
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

      const [workpackPayload, dispatchPayload] = await Promise.all([
        readJson(workpackResponse),
        readJson(dispatchResponse)
      ]);
      const workpacks = workpackResponse.ok ? readArchiveWorkpacks(workpackPayload.workpacks) : [];
      const dispatchLogs = dispatchResponse.ok ? readArchiveDispatchLogs(dispatchPayload.logs) : [];
      const workpackMessage = readString(workpackPayload.message);
      const dispatchMessage = readString(dispatchPayload.message);

      let status: ArchiveStatus = "ready";
      if (!workpackResponse.ok && !dispatchResponse.ok) {
        status = "error";
      } else if (!workpackResponse.ok || !dispatchResponse.ok) {
        status = "partial";
      } else if (!workpacks.length && !dispatchLogs.length) {
        status = "empty";
      }

      setArchive({
        status,
        message: buildArchiveMessage(status, workpackMessage, dispatchMessage),
        workpacks,
        dispatchLogs
      });
    } catch (error) {
      console.error("archive API fetch failed", error);
      setArchive({
        status: "error",
        message: "아카이브 저장소 응답을 확인하지 못했습니다. 로컬 최근 작업은 계속 사용할 수 있으며, 잠시 후 다시 조회해 주세요.",
        workpacks: [],
        dispatchLogs: []
      });
    }
  }, []);

  useEffect(() => {
    setLocalWorkpack(parseStoredCurrentWorkpack(window.localStorage.getItem(CURRENT_WORKPACK_STORAGE_KEY)));
    void loadServerArchive();
  }, [loadServerArchive]);

  const serverLatestAt = latestServerTime(archive.workpacks, archive.dispatchLogs);
  const localSiteName = localWorkpack?.data.scenario.siteName || "최근 작업 없음";
  const localQuestion = localWorkpack?.data.question || "작업공간에서 문서팩을 생성하면 이 브라우저의 최신 작업으로 다시 열 수 있습니다.";
  const localRisk = localWorkpack?.data.riskSummary.topRisk || "저장된 로컬 작업이 없습니다.";
  const archiveReady = archive.status === "ready" || archive.status === "partial" || archive.status === "empty";

  return (
    <SafeClawModuleShell
      eyebrow="이력"
      title="아카이브·작업 이력."
      description="저장된 문서팩, 마지막 생성 시각, 현장 전파 로그를 한 곳에서 다시 열고 이어서 편집합니다."
      status={archive.status === "ready" ? "live" : "partial"}
      mappedTo="Saved workpacks · Last generated · Dispatch logs · Reopen/Edit"
      activeHref="/archive"
      actions={<Link href="/workspace#history">작업공간에서 저장</Link>}
    >
      <section className="safeclaw-module-grid four">
        <article><span>마지막 생성</span><strong>{formatArchiveTime(localWorkpack?.savedAt || serverLatestAt)}</strong></article>
        <article><span>저장 문서팩</span><strong>{archiveReady ? `${archive.workpacks.length}건` : "확인 대기"}</strong></article>
        <article><span>전파 로그</span><strong>{archiveReady ? `${archive.dispatchLogs.length}건` : "확인 대기"}</strong></article>
        <article><span>작업자 snapshot</span><strong>{localWorkerCount(localWorkpack)}</strong></article>
      </section>

      <section className={`safeclaw-current-workpack ${localWorkpack ? "live" : "sample"}`} aria-live="polite">
        <span>{localWorkpack ? "현재 작업 연결" : "로컬 작업 대기"}</span>
        <strong>
          {localWorkpack
            ? `${localSiteName} 문서팩을 이어서 편집할 수 있습니다.`
            : "이 브라우저에 저장된 최근 문서팩이 아직 없습니다."}
        </strong>
        <Link href={localWorkpack ? "/documents" : "/workspace"}>{localWorkpack ? "문서팩 다시 열기" : "작업 시작"}</Link>
      </section>

      <section className="safeclaw-module-grid two">
        <article className="safeclaw-module-panel">
          <span>최근 생성 · 로컬 workpack</span>
          <h2>{localSiteName}</h2>
          <p>{excerpt(localQuestion, 220)}</p>
          <div className="safeclaw-archive-list">
            <article>
              <strong>문서팩 다시 열기</strong>
              <code>/documents</code>
              <p>위험성평가표, TBM, 교육기록, 제출 문서 편집을 이어갑니다.</p>
              <Link href="/documents">문서팩 보기</Link>
            </article>
            <article>
              <strong>작업공간에서 재생성</strong>
              <code>/workspace#history</code>
              <p>현장 조건을 바꿔 다시 생성하거나 저장된 작업 흐름으로 복귀합니다.</p>
              <Link href="/workspace#history">작업공간 열기</Link>
            </article>
            <article>
              <strong>전파 상태</strong>
              <code>{localDispatchCount(localWorkpack)}</code>
              <p>{localRisk}</p>
              <Link href="/dispatch">전파 화면으로 이동</Link>
            </article>
          </div>
        </article>

        <article className="safeclaw-module-panel">
          <div className="compact-head">
            <div>
              <span>서버 아카이브 상태</span>
              <h2>팀 이력 저장소.</h2>
            </div>
            <button type="button" className="button secondary" onClick={loadServerArchive} disabled={archive.status === "checking"}>
              {archive.status === "checking" ? "조회 중" : "새로고침"}
            </button>
          </div>
          <p className={statusTone(archive.status)}>{archive.message}</p>
          <div className="safeclaw-archive-list">
            <article>
              <strong>저장 방식</strong>
              <code>workpacks</code>
              <p>문서팩 질문, 현장, 작업자 요약, 생성 상태를 서버에 보관하고 재사용 가능한 작업 단위로 표시합니다.</p>
            </article>
            <article>
              <strong>전파 증빙</strong>
              <code>dispatch_logs</code>
              <p>채널별 수신자, provider 결과, 실패 사유를 문서팩 이력과 함께 조회합니다.</p>
            </article>
            <article>
              <strong>권한 안내</strong>
              <code>{archive.status}</code>
              <p>관리자 세션이 없거나 저장소 연결 전이어도 개발자용 설정명 대신 운영 안내만 보여줍니다.</p>
            </article>
          </div>
        </article>
      </section>

      <section className="safeclaw-module-grid two">
        <article className="safeclaw-module-panel">
          <div className="compact-head">
            <div>
              <span>Saved workpacks</span>
              <h2>저장된 문서팩.</h2>
            </div>
            <Link href="/workspace">새 문서팩 생성</Link>
          </div>
          <div className="safeclaw-archive-list">
            <ServerWorkpackList workpacks={archive.workpacks} />
          </div>
        </article>

        <article className="safeclaw-module-panel">
          <div className="compact-head">
            <div>
              <span>Dispatch logs</span>
              <h2>전파 이력.</h2>
            </div>
            <Link href="/dispatch">전파 관리</Link>
          </div>
          <div className="safeclaw-archive-list">
            <DispatchLogList logs={archive.dispatchLogs} />
          </div>
        </article>
      </section>
    </SafeClawModuleShell>
  );
}
