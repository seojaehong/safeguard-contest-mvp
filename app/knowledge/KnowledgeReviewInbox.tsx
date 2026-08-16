"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
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
  evidenceItems: ReviewEvidenceItem[];
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

type ReviewEvidenceItem = {
  id: string;
  authorityId: ReviewEvidenceAuthorityId;
  authorityLabel: string;
  sourceLabel: string;
  capturedAt: string;
  digest: string;
  metadata: Array<{ label: string; value: string }>;
  publicUrl: string | null;
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
const REVIEW_AUTHORITY_ROLE_BY_EVIDENCE: Record<ReviewEvidenceAuthorityId, ReviewAuthorityId> = {
  sif: "sifIncidentControlEvidence",
  kosha: "koshaTechnicalGuidance",
  law: "lawStatutorySource",
  organization_history: "organizationPrivateMemory",
  site_history: "sitePrivateMemory",
  external_context: "externalContext"
};
const PUBLIC_EVIDENCE_HOSTS = ["law.go.kr", "kosha.or.kr", "data.go.kr"] as const;

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

function readEvidenceItem(value: unknown): ReviewEvidenceItem | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id, 64);
  const authorityId = value.authorityId;
  const authorityLabel = readString(value.authorityLabel, 64);
  const sourceLabel = readString(value.sourceLabel, 160);
  const capturedAt = readString(value.capturedAt, 40);
  const digest = readString(value.digest, 32);
  if (!id
    || typeof authorityId !== "string"
    || !REVIEW_EVIDENCE_AUTHORITY_IDS.includes(authorityId as ReviewEvidenceAuthorityId)
    || !authorityLabel
    || !sourceLabel
    || !capturedAt
    || !/^sha256:[0-9a-f]{16}$/u.test(digest)) return null;

  const metadata = Array.isArray(value.metadata)
    ? value.metadata.flatMap((item) => {
        if (!isRecord(item)) return [];
        const label = readString(item.label, 32);
        const metadataValue = readString(item.value, 96);
        return label && metadataValue ? [{ label, value: metadataValue }] : [];
      }).slice(0, 4)
    : [];
  let publicUrl: string | null = null;
  if (typeof value.publicUrl === "string") {
    try {
      const parsed = new URL(value.publicUrl);
      const hostname = parsed.hostname.toLowerCase();
      if (parsed.protocol === "https:"
        && PUBLIC_EVIDENCE_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
        publicUrl = parsed.toString().slice(0, 500);
      }
    } catch {
      publicUrl = null;
    }
  }
  return { id, authorityId: authorityId as ReviewEvidenceAuthorityId, authorityLabel, sourceLabel, capturedAt, digest, metadata, publicUrl };
}

function evidenceMatchesReviewContract(
  evidenceItems: ReviewEvidenceItem[],
  reviewContract: NonNullable<ReviewInboxItem["reviewContract"]>
): boolean {
  const counts = Object.fromEntries(
    REVIEW_AUTHORITY_PRESENTATION.map(({ id }) => [id, 0])
  ) as Record<ReviewAuthorityId, number>;
  for (const evidence of evidenceItems) {
    counts[REVIEW_AUTHORITY_ROLE_BY_EVIDENCE[evidence.authorityId]] += 1;
  }
  return REVIEW_AUTHORITY_PRESENTATION.every(({ id }) => counts[id] === reviewContract.sourceRoleCounts[id]);
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
  const evidenceItems = Array.isArray(value.evidenceItems)
    ? value.evidenceItems.map(readEvidenceItem).filter((item): item is ReviewEvidenceItem => item !== null).slice(0, 20)
    : [];

  if (
    !candidateLabel
    || sourceEventCount === 0
    || (status === "review_required" && evidenceItems.length !== sourceEventCount)
    || matchedHazardCount < 0
    || (status === "review_required" && (!candidateText || !reviewContract))
    || (status === "review_required" && reviewContract && !evidenceMatchesReviewContract(evidenceItems, reviewContract))
  ) return null;
  return {
    runId,
    candidateLabel,
    status,
    providerLabel: typeof value.providerLabel === "string" ? value.providerLabel.slice(0, 96) : null,
    candidateText,
    sourceEventCount,
    matchedHazardCount,
    evidenceItems,
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
  const [compactViewport, setCompactViewport] = useState(false);
  const [activeReviewPane, setActiveReviewPane] = useState<"candidate" | "evidence">("candidate");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const sync = () => setCompactViewport(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const candidateButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const reviewPaneButtonRefs = useRef<Record<"candidate" | "evidence", HTMLButtonElement | null>>({
    candidate: null,
    evidence: null
  });

  const accessToken = session?.access_token ?? null;
  const selectedItem = items.find((item) => item.runId === selectedRunId) ?? items[0] ?? null;

  function selectCandidate(runId: string): void {
    setSelectedRunId(runId);
    setActiveReviewPane("candidate");
  }

  function moveCandidateSelection(index: number): void {
    const item = items[index];
    if (!item) return;
    selectCandidate(item.runId);
    candidateButtonRefs.current[index]?.focus();
  }

  function handleCandidateKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const lastIndex = items.length - 1;
    const targetByKey: Partial<Record<string, number>> = {
      ArrowDown: (index + 1) % items.length,
      ArrowRight: (index + 1) % items.length,
      ArrowUp: (index - 1 + items.length) % items.length,
      ArrowLeft: (index - 1 + items.length) % items.length,
      Home: 0,
      End: lastIndex
    };
    const target = targetByKey[event.key];
    if (target === undefined) return;
    event.preventDefault();
    moveCandidateSelection(target);
  }

  function selectReviewPane(pane: "candidate" | "evidence", moveFocus = false): void {
    setActiveReviewPane(pane);
    if (moveFocus) reviewPaneButtonRefs.current[pane]?.focus();
  }

  function handleReviewPaneKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    selectReviewPane(event.key === "ArrowRight" || event.key === "End" ? "evidence" : "candidate", true);
  }

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
    setMessage("검토 결과를 저장하는 중입니다.");
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
    setMessage("검토 후보를 준비하는 중입니다.");
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
            <ul
              className={styles.reviewList}
              role="tablist"
              aria-label="지식 후보"
              aria-orientation={compactViewport ? "horizontal" : "vertical"}
            >
              {items.map((item, index) => {
                const selected = selectedItem?.runId === item.runId;
                return (
                  <li key={item.runId} role="presentation">
                    <button
                      type="button"
                      role="tab"
                      id={`knowledge-review-candidate-tab-${index}`}
                      aria-controls={`knowledge-review-candidate-panel-${index}`}
                      className={styles.reviewCandidateButton}
                      aria-selected={selected}
                      tabIndex={selected ? 0 : -1}
                      ref={(node) => { candidateButtonRefs.current[index] = node; }}
                      onClick={() => selectCandidate(item.runId)}
                      onKeyDown={(event) => handleCandidateKeyDown(event, index)}
                    >
                      <span>{item.status === "review_required" ? "검토 대기" : "후보 준비 전"}</span>
                      <strong>{item.candidateLabel}</strong>
                      <small>근거 {item.sourceEventCount} · 위험 {item.matchedHazardCount}</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {selectedItem ? (() => {
            const item = selectedItem;
            const pending = pendingRunId !== null;
            const selectedIndex = items.findIndex((candidate) => candidate.runId === item.runId);
            const candidatePaneTabId = `knowledge-review-pane-tab-candidate-${selectedIndex}`;
            const evidencePaneTabId = `knowledge-review-pane-tab-evidence-${selectedIndex}`;
            return (
              <article
                className={styles.reviewItem}
                id={`knowledge-review-candidate-panel-${selectedIndex}`}
                role="tabpanel"
                aria-labelledby={`knowledge-review-candidate-tab-${selectedIndex}`}
                aria-busy={pending}
                data-review-run-status={item.status}
                data-selected-review-candidate="true"
                data-review-pending={pending ? "true" : "false"}
              >
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
                    <div className={styles.reviewPaneTabs} role={compactViewport ? "tablist" : undefined} aria-label={compactViewport ? "후보 검토 보기" : undefined}>
                      <button
                        type="button"
                        role={compactViewport ? "tab" : undefined}
                        id={candidatePaneTabId}
                        aria-controls={compactViewport ? `knowledge-review-pane-candidate-${selectedIndex}` : undefined}
                        aria-selected={compactViewport ? activeReviewPane === "candidate" : undefined}
                        tabIndex={compactViewport ? (activeReviewPane === "candidate" ? 0 : -1) : undefined}
                        ref={(node) => { reviewPaneButtonRefs.current.candidate = node; }}
                        onClick={() => selectReviewPane("candidate")}
                        onKeyDown={handleReviewPaneKeyDown}
                      >후보 문장</button>
                      <button
                        type="button"
                        role={compactViewport ? "tab" : undefined}
                        id={evidencePaneTabId}
                        aria-controls={compactViewport ? `knowledge-review-pane-evidence-${selectedIndex}` : undefined}
                        aria-selected={compactViewport ? activeReviewPane === "evidence" : undefined}
                        tabIndex={compactViewport ? (activeReviewPane === "evidence" ? 0 : -1) : undefined}
                        ref={(node) => { reviewPaneButtonRefs.current.evidence = node; }}
                        onClick={() => selectReviewPane("evidence")}
                        onKeyDown={handleReviewPaneKeyDown}
                      >근거 {item.evidenceItems.length}</button>
                    </div>
                    <div className={styles.reviewEvidenceWorkbench} data-review-evidence-workbench="true">
                      {!compactViewport || activeReviewPane === "candidate" ? (
                        <section
                          className={styles.candidatePane}
                          id={`knowledge-review-pane-candidate-${selectedIndex}`}
                          role={compactViewport ? "tabpanel" : undefined}
                          aria-labelledby={compactViewport ? candidatePaneTabId : undefined}
                          data-review-pane="candidate"
                        >
                          <span className={styles.reviewPaneLabel}>후보 문장</span>
                          <p className={styles.candidateText} data-selected-candidate-body="true">{item.candidateText}</p>
                        </section>
                      ) : null}
                      {!compactViewport || activeReviewPane === "evidence" ? (
                        <section
                          className={styles.evidencePane}
                          id={`knowledge-review-pane-evidence-${selectedIndex}`}
                          role={compactViewport ? "tabpanel" : undefined}
                          aria-labelledby={compactViewport ? evidencePaneTabId : undefined}
                          aria-label={!compactViewport ? "선택 후보 근거 목록" : undefined}
                          data-review-pane="evidence"
                        >
                          <div className={styles.evidencePaneHeader}>
                            <span className={styles.reviewPaneLabel}>검증 근거</span>
                            <small>최대 20건 · 원문 식별자 비공개</small>
                          </div>
                          <ol className={styles.evidenceList}>
                            {item.evidenceItems.map((evidence) => (
                              <li key={evidence.id} data-review-evidence-authority={evidence.authorityId}>
                                <div className={styles.evidenceIdentity}>
                                  <strong>{evidence.authorityLabel}</strong>
                                  <span>{evidence.sourceLabel}</span>
                                </div>
                                <dl className={styles.evidenceFacts}>
                                  <div><dt>수집</dt><dd><time dateTime={evidence.capturedAt}>{evidence.capturedAt.slice(0, 10)}</time></dd></div>
                                  <div><dt>검증</dt><dd>{evidence.digest}</dd></div>
                                  {evidence.metadata.map((entry) => (
                                    <div key={`${evidence.id}-${entry.label}`}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>
                                  ))}
                                </dl>
                                {evidence.publicUrl ? (
                                  <a href={evidence.publicUrl} target="_blank" rel="noreferrer">공식 원문 열기</a>
                                ) : (
                                  <span className={styles.privateEvidenceLabel}>검토 화면 내 비공개 근거</span>
                                )}
                              </li>
                            ))}
                          </ol>
                        </section>
                      ) : null}
                    </div>
                    <div className={styles.reviewMeta}>
                      <span>법적 확정 아님</span>
                      <span>온톨로지 미반영</span>
                      {item.providerLabel ? <span>{item.providerLabel}</span> : null}
                    </div>
                    <div className={styles.reviewActions} role="group" aria-label="검토 결정" aria-busy={pending}>
                      <button type="button" disabled={pending} onClick={() => void submit(item.runId, "approve_candidate")}>후보 승인</button>
                      <button type="button" disabled={pending} onClick={() => void submit(item.runId, "keep_site_only")}>현장 전용 유지</button>
                      <button type="button" disabled={pending} onClick={() => void submit(item.runId, "reject")}>반려</button>
                    </div>
                  </>
                ) : item.status === "draft" ? (
                  <button className={styles.prepareButton} type="button" disabled={pending} aria-busy={pending} onClick={() => void prepare(item.runId)}>
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
