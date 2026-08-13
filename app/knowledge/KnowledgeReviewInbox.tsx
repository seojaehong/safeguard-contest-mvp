"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import styles from "./KnowledgePage.module.css";

type ReviewAction = "approve_candidate" | "keep_site_only" | "reject";

type ReviewInboxItem = {
  runId: string;
  candidateLabel: string;
  status: "draft" | "generated" | "review_required";
  providerLabel: string | null;
  candidateText: string;
  sourceEventCount: number;
  matchedHazardCount: number;
  reviewContract: {
    contractVersion: "knowledge-candidate-review.v1";
    status: "human_review_required";
    presentAuthorityIds: ReviewEvidenceAuthorityId[];
    sourceRoleCounts: Record<ReviewAuthorityId, number>;
    statutoryClaimsRequireLawProvenance: true;
    tenantMemoryPublicPromotionAllowed: false;
    siteManagerAcceptanceRequiredBeforeWorkpackUse: true;
    publicationState: "unpublished";
    humanReviewRequired: true;
    machineEvidenceReplacesHumanReview: false;
  } | null;
};

type ReviewAuthorityId =
  | "sifIncidentControlEvidence"
  | "koshaTechnicalGuidance"
  | "lawStatutorySource"
  | "organizationPrivateMemory"
  | "sitePrivateMemory"
  | "externalContext";

type ReviewEvidenceAuthorityId =
  | "sif"
  | "kosha"
  | "law"
  | "organization_history"
  | "site_history"
  | "external_context";

const REVIEW_EVIDENCE_AUTHORITY_IDS: readonly ReviewEvidenceAuthorityId[] = [
  "sif",
  "kosha",
  "law",
  "organization_history",
  "site_history",
  "external_context"
];

const REVIEW_AUTHORITY_PRESENTATION: ReadonlyArray<{
  id: ReviewAuthorityId;
  label: string;
}> = [
  { id: "sifIncidentControlEvidence", label: "SIF 통제" },
  { id: "koshaTechnicalGuidance", label: "KOSHA 지침" },
  { id: "lawStatutorySource", label: "법령" },
  { id: "organizationPrivateMemory", label: "조직 이력" },
  { id: "sitePrivateMemory", label: "현장 이력" },
  { id: "externalContext", label: "외부 맥락" }
];

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

function readReviewContract(value: unknown): ReviewInboxItem["reviewContract"] {
  if (!isRecord(value) || !isRecord(value.sourceRoleCounts)) return null;
  const sourceRoleCounts = value.sourceRoleCounts;
  const roleCounts = Object.fromEntries(REVIEW_AUTHORITY_PRESENTATION.map(({ id }) => {
    const count = sourceRoleCounts[id];
    return [id, typeof count === "number" && Number.isInteger(count) && count >= 0 && count <= 20 ? count : -1];
  })) as Record<ReviewAuthorityId, number>;
  const presentAuthorityIds = Array.isArray(value.presentAuthorityIds)
    ? value.presentAuthorityIds.filter(
        (item): item is ReviewEvidenceAuthorityId => (
          typeof item === "string"
          && REVIEW_EVIDENCE_AUTHORITY_IDS.includes(item as ReviewEvidenceAuthorityId)
        )
      )
    : [];
  const contractValid = value.contractVersion === "knowledge-candidate-review.v1"
    && value.status === "human_review_required"
    && Object.values(roleCounts).every((count) => count >= 0)
    && value.statutoryClaimsRequireLawProvenance === true
    && value.tenantMemoryPublicPromotionAllowed === false
    && value.siteManagerAcceptanceRequiredBeforeWorkpackUse === true
    && value.publicationState === "unpublished"
    && value.humanReviewRequired === true
    && value.machineEvidenceReplacesHumanReview === false;
  if (!contractValid) return null;

  return {
    contractVersion: "knowledge-candidate-review.v1",
    status: "human_review_required",
    presentAuthorityIds,
    sourceRoleCounts: roleCounts,
    statutoryClaimsRequireLawProvenance: true,
    tenantMemoryPublicPromotionAllowed: false,
    siteManagerAcceptanceRequiredBeforeWorkpackUse: true,
    publicationState: "unpublished",
    humanReviewRequired: true,
    machineEvidenceReplacesHumanReview: false
  };
}

function parseInboxItem(value: unknown): ReviewInboxItem | null {
  if (!isRecord(value)) return null;
  const runId = readString(value.runId, 128);
  const status = value.status;
  if (!runId || (status !== "draft" && status !== "generated" && status !== "review_required")) {
    return null;
  }

  const candidateText = readString(value.candidateText, MAX_UI_TEXT_LENGTH);
  const candidateLabel = readString(value.candidateLabel, 500);
  const reviewContract = status === "review_required" ? readReviewContract(value.reviewContract) : null;
  const sourceEventCount = typeof value.sourceEventCount === "number"
    && Number.isInteger(value.sourceEventCount)
    && value.sourceEventCount > 0
    && value.sourceEventCount <= 20
    ? value.sourceEventCount
    : 0;
  const matchedHazardCount = typeof value.matchedHazardCount === "number"
    && Number.isInteger(value.matchedHazardCount)
    && value.matchedHazardCount >= 0
    && value.matchedHazardCount <= 20
    ? value.matchedHazardCount
    : -1;

  if (
    !candidateLabel
    || sourceEventCount === 0
    || matchedHazardCount < 0
    || (status === "review_required" && (!candidateText || !reviewContract))
  ) return null;
  return {
    runId,
    candidateLabel,
    status,
    providerLabel: typeof value.providerLabel === "string" ? value.providerLabel.slice(0, 96) : null,
    candidateText,
    sourceEventCount,
    matchedHazardCount,
    reviewContract
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
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const accessToken = session?.access_token ?? null;
  const selectedItem = items.find((item) => item.runId === selectedRunId) ?? items[0] ?? null;

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
        <div className={styles.reviewWorkbench} data-review-workbench="selected-only">
          <nav className={styles.reviewNavigator} aria-label="지식 후보 목록">
            <span className={styles.reviewNavigatorLabel}>검토 후보 {items.length}건</span>
            <ul className={styles.reviewList}>
              {items.map((item) => (
                <li key={item.runId}>
                  <button
                    type="button"
                    className={styles.reviewCandidateButton}
                    aria-pressed={selectedItem?.runId === item.runId}
                    onClick={() => setSelectedRunId(item.runId)}
                  >
                    <span>{item.status === "review_required" ? "검토 대기" : "후보 준비 전"}</span>
                    <strong>{item.candidateLabel}</strong>
                    <small>근거 {item.sourceEventCount} · 위험 {item.matchedHazardCount}</small>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {selectedItem ? (() => {
            const item = selectedItem;
            const pending = pendingRunId === item.runId;
            return (
              <article className={styles.reviewItem} data-review-run-status={item.status} data-selected-review-candidate="true">
                <div className={styles.reviewItemHeading}>
                  <div>
                    <span>{item.status === "review_required" ? "검토 대기" : "후보 준비 전"}</span>
                    <h4>{item.candidateLabel}</h4>
                  </div>
                  <dl>
                    <div><dt>근거</dt><dd>{item.sourceEventCount}건</dd></div>
                    <div><dt>위험</dt><dd>{item.matchedHazardCount}건</dd></div>
                    <div><dt>게시</dt><dd>미게시</dd></div>
                  </dl>
                </div>

                {item.status === "review_required" ? (
                  <>
                    <section
                      className={styles.reviewAuthority}
                      aria-label="후보 근거와 적용 경계"
                      data-review-authority-contract="true"
                    >
                      <div className={styles.reviewAuthorityHeader}>
                        <strong>근거 구성</strong>
                        <span>사람 검토 필요</span>
                      </div>
                      <ul className={styles.reviewAuthorityCounts}>
                        {REVIEW_AUTHORITY_PRESENTATION.map(({ id, label }) => (
                          <li key={id} data-review-authority-role={id}>
                            <span>{label}</span>
                            <strong>{item.reviewContract?.sourceRoleCounts[id] ?? 0}</strong>
                          </li>
                        ))}
                      </ul>
                      <div className={styles.reviewBoundary}>
                        <span>법적 의무는 법령 근거 확인</span>
                        <span>조직·현장 이력은 외부 승격 금지</span>
                        <span>작업팩 적용 전 현장 책임자 확인</span>
                      </div>
                    </section>
                    <p className={styles.candidateText} data-selected-candidate-body="true">{item.candidateText}</p>
                    <div className={styles.reviewMeta}>
                      <span>법적 확정 아님</span>
                      <span>온톨로지 미반영</span>
                      {item.providerLabel ? <span>{item.providerLabel}</span> : null}
                    </div>
                    <div className={styles.reviewActions} role="group" aria-label="검토 결정">
                      <button type="button" disabled={pending} onClick={() => void submit(item.runId, "approve_candidate")}>후보 승인</button>
                      <button type="button" disabled={pending} onClick={() => void submit(item.runId, "keep_site_only")}>현장 전용 유지</button>
                      <button type="button" disabled={pending} onClick={() => void submit(item.runId, "reject")}>반려</button>
                    </div>
                  </>
                ) : item.status === "draft" ? (
                  <button className={styles.prepareButton} type="button" disabled={pending} onClick={() => void prepare(item.runId)}>
                    후보 준비
                  </button>
                ) : null}
              </article>
            );
          })() : null}
        </div>
      ) : null}
    </section>
  );
}
