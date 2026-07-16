"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import styles from "./KnowledgePage.module.css";

type ReviewAction = "approve_candidate" | "keep_site_only" | "reject";

type ReviewInboxItem = {
  runId: string;
  question: string;
  status: "draft" | "generated" | "review_required";
  provider: string | null;
  generatedText: string;
  matchedHazardIds: string[];
  eventCount: number;
};

const MAX_UI_TEXT_LENGTH = 12_000;
let browserClient: SupabaseClient | null = null;

function getBrowserSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (!browserClient) browserClient = createClient(url, anonKey);
  return browserClient;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseInboxItem(value: unknown): ReviewInboxItem | null {
  if (!isRecord(value) || !isRecord(value.run) || !Array.isArray(value.events)) return null;
  const runId = readString(value.run.id, 128);
  const status = value.run.status;
  if (!runId || (status !== "draft" && status !== "generated" && status !== "review_required")) {
    return null;
  }

  const output = isRecord(value.run.generatedOutput) ? value.run.generatedOutput : null;
  const candidate = output && isRecord(output.candidate) ? output.candidate : null;
  const generatedText = candidate ? readString(candidate.generatedText, MAX_UI_TEXT_LENGTH) : "";
  const candidateQuestion = candidate ? readString(candidate.question, 500) : "";
  const matchedHazardIds = candidate && Array.isArray(candidate.matchedHazardIds)
    ? candidate.matchedHazardIds
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 128))
        .filter(Boolean)
        .slice(0, 20)
    : [];

  if (status === "review_required" && (!generatedText || !candidateQuestion)) return null;
  return {
    runId,
    question: candidateQuestion || `원본 이벤트 ${Math.min(value.events.length, 20)}건 후보 준비`,
    status,
    provider: typeof value.run.provider === "string" ? value.run.provider.slice(0, 96) : null,
    generatedText,
    matchedHazardIds,
    eventCount: Math.min(value.events.length, 20)
  };
}

function parseInboxResponse(value: unknown): ReviewInboxItem[] | null {
  if (!isRecord(value) || value.ok !== true || !Array.isArray(value.queue)) return null;
  return value.queue.map(parseInboxItem).filter((item): item is ReviewInboxItem => item !== null);
}

async function readJson(response: Response): Promise<unknown> {
  return await response.json().catch((): unknown => null);
}

export function KnowledgeReviewInbox() {
  const [items, setItems] = useState<ReviewInboxItem[]>([]);
  const [state, setState] = useState<"loading" | "signed_out" | "ready" | "error">("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const accessToken = session?.access_token ?? null;

  const loadInbox = useCallback(async (token: string) => {
    try {
      const response = await fetch("/api/knowledge/review", {
        cache: "no-store",
        headers: { authorization: `Bearer ${token}` }
      });
      const payload = await readJson(response);
      const queue = parseInboxResponse(payload);
      if (!response.ok || !queue) throw new Error("Invalid review inbox response");
      setItems(queue);
      setState("ready");
    } catch (error) {
      console.error("knowledge review inbox load failed", error);
      setState("error");
    }
  }, []);

  useEffect(() => {
    const client = getBrowserSupabaseClient();
    if (!client) {
      setState("signed_out");
      return;
    }
    client.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch((error: unknown) => {
        console.warn("knowledge review session load failed", error);
        setState("error");
      });
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!accessToken) {
      setItems([]);
      setState("signed_out");
      return;
    }
    setState("loading");
    void loadInbox(accessToken);
  }, [accessToken, loadInbox]);

  async function submit(runId: string, action: ReviewAction): Promise<void> {
    if (!accessToken) return;
    setPendingRunId(runId);
    setMessage("");
    try {
      const response = await fetch("/api/knowledge/review", {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ runId, action })
      });
      const payload = await readJson(response);
      if (!response.ok || !isRecord(payload) || payload.ok !== true) {
        throw new Error("Review action failed");
      }
      setMessage(action === "reject" ? "후보를 반려했습니다." : "검토 결과를 저장했습니다. 게시되지는 않았습니다.");
      await loadInbox(accessToken);
    } catch (error) {
      console.error("knowledge review action failed", error);
      setMessage("검토 결과를 저장하지 못했습니다.");
    } finally {
      setPendingRunId(null);
    }
  }

  async function prepare(runId: string): Promise<void> {
    if (!accessToken) return;
    setPendingRunId(runId);
    setMessage("");
    try {
      const response = await fetch("/api/knowledge/review/prepare", {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ runId })
      });
      const payload = await readJson(response);
      if (!response.ok || !isRecord(payload) || payload.ok !== true) {
        throw new Error("Candidate preparation failed");
      }
      setMessage("검토 후보를 준비했습니다.");
      await loadInbox(accessToken);
    } catch (error) {
      console.error("knowledge review candidate preparation failed", error);
      setMessage("검토 후보를 준비하지 못했습니다.");
    } finally {
      setPendingRunId(null);
    }
  }

  return (
    <section className={styles.reviewInbox} aria-labelledby="knowledge-review-inbox-heading" data-knowledge-review-inbox="true">
      <header className={styles.reviewInboxHeader}>
        <div>
          <span className={styles.kicker}>사람 검토</span>
          <h3 id="knowledge-review-inbox-heading">지식 후보 검토함</h3>
        </div>
        <p>승인 결과도 미게시 상태로 보관되며 법적 확정 또는 온톨로지 반영으로 간주되지 않습니다.</p>
      </header>

      {state === "loading" ? <p className={styles.reviewInboxState}>검토 대기 목록을 불러오는 중입니다.</p> : null}
      {state === "signed_out" ? <p className={styles.reviewInboxState}>로그인 후 검토 대기 후보를 확인할 수 있습니다.</p> : null}
      {state === "error" ? <p className={styles.reviewInboxState}>로그인 또는 검토 저장소 연결을 확인해 주세요.</p> : null}
      {state === "ready" && items.length === 0 ? (
        <p className={styles.reviewInboxState}>검토 대기 후보가 없습니다.</p>
      ) : null}
      {message ? <p className={styles.reviewInboxMessage} role="status">{message}</p> : null}

      {items.length > 0 ? (
        <ul className={styles.reviewList}>
          {items.map((item) => {
            const pending = pendingRunId === item.runId;
            return (
              <li key={item.runId} className={styles.reviewItem} data-review-run-status={item.status}>
                <div className={styles.reviewItemHeading}>
                  <div>
                    <span>{item.status === "review_required" ? "검토 대기" : "후보 준비 전"}</span>
                    <h4>{item.question}</h4>
                  </div>
                  <dl>
                    <div><dt>근거</dt><dd>{item.eventCount}건</dd></div>
                    <div><dt>게시</dt><dd>미게시</dd></div>
                  </dl>
                </div>

                {item.status === "review_required" ? (
                  <>
                    <p className={styles.candidateText}>{item.generatedText}</p>
                    <div className={styles.reviewMeta}>
                      <span>법적 확정 아님</span>
                      <span>온톨로지 미반영</span>
                      {item.provider ? <span>{item.provider}</span> : null}
                    </div>
                    <div className={styles.reviewActions} role="group" aria-label="검토 결정">
                      <button type="button" disabled={pending} onClick={() => void submit(item.runId, "approve_candidate")}>후보 승인</button>
                      <button type="button" disabled={pending} onClick={() => void submit(item.runId, "keep_site_only")}>현장 전용 유지</button>
                      <button type="button" disabled={pending} onClick={() => void submit(item.runId, "reject")}>반려</button>
                    </div>
                  </>
                ) : (
                  <button className={styles.prepareButton} type="button" disabled={pending} onClick={() => void prepare(item.runId)}>
                    후보 준비
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
