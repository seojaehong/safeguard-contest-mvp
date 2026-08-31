"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type Session } from "@supabase/supabase-js";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { buildDemoEvidenceWorkpacks } from "@/lib/evidence-file-demo";
import { groupEvidenceByArticle, type EvidenceFileResult, type EvidenceFileWorkpack } from "@/lib/evidence-file";
import { getDocumentTitle } from "@/lib/document-titles";
import { formatEvidenceBadge } from "@/lib/smsa-mapping";
import { isRecord, readString } from "@/lib/workspace-api";
import { createSafeClawBrowserSupabaseClient } from "@/lib/supabase-browser-client";

type LoadStatus = "checking" | "ready" | "empty" | "login-required" | "unconfigured" | "error";

type LoadState = {
  status: LoadStatus;
  message: string;
  organizationName: string | null;
  siteName: string | null;
  workpacks: EvidenceFileWorkpack[];
  usingDemo: boolean;
};

function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createSafeClawBrowserSupabaseClient(url, anonKey);
}

async function readSession(): Promise<Session | null> {
  const client = createBrowserSupabaseClient();
  if (!client) return null;

  const { data, error } = await client.auth.getSession();
  if (error) {
    console.error("evidence-file session read failed", error);
    return null;
  }

  return data.session;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const payload = await response.json().catch((): unknown => ({}));
  return isRecord(payload) ? payload : {};
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readServerWorkpacks(value: unknown): { workpacks: EvidenceFileWorkpack[]; organizationName: string | null; siteName: string | null } {
  if (!Array.isArray(value)) return { workpacks: [], organizationName: null, siteName: null };

  let organizationName: string | null = null;
  let siteName: string | null = null;

  const workpacks = value.flatMap((item): EvidenceFileWorkpack[] => {
    if (!isRecord(item)) return [];
    const id = readString(item.id);
    const createdAt = readString(item.createdAt);
    if (!id || !createdAt) return [];

    const resolvedSiteName = readString(item.siteName, "기본 현장");
    if (!organizationName) organizationName = readString(item.organizationName) || null;
    if (!siteName) siteName = resolvedSiteName || null;

    return [{
      id,
      siteName: resolvedSiteName,
      question: readString(item.question, "저장된 문서팩"),
      createdAt,
      documentKeys: readStringArray(item.documentKeys),
      reopenHref: `/documents?workpackId=${encodeURIComponent(id)}`
    }];
  });

  return { workpacks, organizationName, siteName };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "날짜 확인 필요";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function excerpt(text: string, maxLength = 90) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}...`;
}

const DEMO_ORGANIZATION_NAME = "SafeClaw 데모 사업장";

export default function EvidenceFilePage() {
  const [state, setState] = useState<LoadState>({
    status: "checking",
    message: "저장된 문서팩 이력을 확인하고 있습니다.",
    organizationName: null,
    siteName: null,
    workpacks: [],
    usingDemo: false
  });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: "checking", message: "증빙 파일철을 불러오고 있습니다." }));

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setState({
        status: "unconfigured",
        message: "서버 저장소 연결 전입니다. 지금은 데모 문서팩으로 화면 구성을 확인할 수 있고, 로그인하면 실제 사업장 이력이 쌓입니다.",
        organizationName: DEMO_ORGANIZATION_NAME,
        siteName: null,
        workpacks: buildDemoEvidenceWorkpacks(),
        usingDemo: true
      });
      return;
    }

    const session = await readSession();
    if (!session) {
      setState({
        status: "login-required",
        message: "관리자 로그인 후에는 실제 사업장의 문서팩 이력이 항목별로 쌓입니다. 지금은 데모 문서팩으로 화면 구성을 확인할 수 있습니다.",
        organizationName: DEMO_ORGANIZATION_NAME,
        siteName: null,
        workpacks: buildDemoEvidenceWorkpacks(),
        usingDemo: true
      });
      return;
    }

    try {
      const response = await fetch("/api/workpacks?limit=50", {
        headers: { authorization: `Bearer ${session.access_token}` }
      });
      const payload = await readJson(response);

      if (!response.ok) {
        setState({
          status: "error",
          message: readString(payload.message, "문서팩 이력을 불러오지 못했습니다. 잠시 후 다시 조회해 주세요."),
          organizationName: DEMO_ORGANIZATION_NAME,
          siteName: null,
          workpacks: buildDemoEvidenceWorkpacks(),
          usingDemo: true
        });
        return;
      }

      const { workpacks, organizationName, siteName } = readServerWorkpacks(payload.workpacks);
      if (!workpacks.length) {
        setState({
          status: "empty",
          message: "아직 저장된 문서팩이 없습니다. 작업공간에서 문서팩을 생성·저장하면 이 화면에 자동으로 쌓입니다. 지금은 데모 문서팩으로 화면 구성을 확인할 수 있습니다.",
          organizationName: DEMO_ORGANIZATION_NAME,
          siteName: null,
          workpacks: buildDemoEvidenceWorkpacks(),
          usingDemo: true
        });
        return;
      }

      setState({
        status: "ready",
        message: `저장된 문서팩 ${workpacks.length}건으로 증빙 파일철을 구성했습니다.`,
        organizationName,
        siteName,
        workpacks,
        usingDemo: false
      });
    } catch (error) {
      console.error("evidence-file fetch failed", error);
      setState({
        status: "error",
        message: "증빙 파일철 저장소 응답을 확인하지 못했습니다. 지금은 데모 문서팩으로 화면 구성을 확인할 수 있습니다.",
        organizationName: DEMO_ORGANIZATION_NAME,
        siteName: null,
        workpacks: buildDemoEvidenceWorkpacks(),
        usingDemo: true
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const result: EvidenceFileResult = useMemo(() => groupEvidenceByArticle(state.workpacks), [state.workpacks]);
  const headerSiteName = state.organizationName || "사업장을 확인하는 중입니다";
  const totalEvidenceCount = result.sections.reduce((sum, section) => sum + section.count, 0);

  return (
    <SafeClawModuleShell
      eyebrow="경영책임자 방어 파일"
      title="중대재해처벌법 시행령 제4조 증빙 현황."
      description="수사·감독 대응 시 경영책임자가 바로 내밀 수 있도록, 생성된 문서팩을 시행령 제4조 항목별 증빙으로 자동 정리합니다."
      status={state.status === "ready" ? "live" : "partial"}
      mappedTo="시행령 제4조 1~9호 · 문서팩 생성 이력"
      activeHref="/evidence-file"
      actions={<Link href="/workspace">문서팩 새로 생성</Link>}
    >
      <section className="safeclaw-module-panel">
        <span>{headerSiteName}</span>
        <h2>중대재해처벌법 시행령 제4조 증빙 현황</h2>
        <p className={state.status === "error" ? "export-error" : "muted small"}>{state.message}</p>
        {state.usingDemo ? (
          <p className="muted small">지금 보이는 항목은 데모 문서팩입니다. 로그인하면 사업장 이력이 쌓입니다.</p>
        ) : null}
      </section>

      <section className="safeclaw-module-grid nine" aria-label="시행령 제4조 항목별 증빙 요약">
        {result.gridItems.map((item) => (
          <article key={item.article} className={item.count === 0 ? "zero" : undefined}>
            <span>{item.article.replace("중대재해처벌법 시행령 제4조 ", "")} · {item.title}</span>
            <strong>
              {item.count === 0 ? "증빙 없음 — 다음 생성 시 자동 축적" : `${item.count}건 · 최근 ${formatDate(item.latestAt as string)}`}
            </strong>
          </article>
        ))}
      </section>

      <section className="safeclaw-module-panel">
        <span>전체 증빙</span>
        <h2>{totalEvidenceCount.toLocaleString("ko-KR")}건이 문서 종류별로 쌓여 있습니다.</h2>
        <p>항목을 열면 해당 시행령 조항에 매핑된 문서를 생성일 최신순으로 확인하고 바로 다시 열 수 있습니다.</p>
      </section>

      <section className="safeclaw-module-panel">
        <span>항목별 증빙 문서</span>
        <h2>시행령 조항별 문서 목록.</h2>
        {result.sections.length ? (
          <div className="safeclaw-archive-list">
            {result.sections.map((section) => (
              <details key={section.article} className="advanced-downloads">
                <summary>
                  {formatEvidenceBadge(section.article)} · {section.count}건 · {section.purpose}
                </summary>
                <div className="advanced-download-grid">
                  {section.documents.map((doc) => (
                    <article key={`${doc.workpackId}-${doc.documentKey}`}>
                      <strong>{getDocumentTitle(doc.documentKey)}</strong>
                      <code>{formatDate(doc.createdAt)}</code>
                      <p>{doc.siteName} · {excerpt(doc.question)}</p>
                      <p className="muted small">{section.article}{section.related ? ` · 병기: ${section.related}` : ""}</p>
                      <span className="doc-card-evidence-badge">{state.usingDemo ? "데모" : "저장됨"}</span>
                      <a href={doc.reopenHref}>문서팩 열기</a>
                    </article>
                  ))}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <article>
            <strong>증빙 문서 없음</strong>
            <code>시행령 제4조</code>
            <p>문서팩을 생성하면 위험성평가·TBM·안전보건교육 등 시행령 제4조에 매핑되는 문서가 이곳에 자동으로 쌓입니다.</p>
            <Link href="/workspace">작업공간에서 첫 문서팩 생성</Link>
          </article>
        )}
      </section>

      <p className="muted small">
        이 파일철은 산업안전보건법·중대재해처벌법 대응 참고자료이며 법률 자문을 대체하지 않습니다.
      </p>
    </SafeClawModuleShell>
  );
}
