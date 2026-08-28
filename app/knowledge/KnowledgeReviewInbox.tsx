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
  traceItems: ReviewTraceItem[];
  traceabilityComplete: boolean;
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
  contentReadiness: ReviewContentReadiness | null;
};

type ReviewContentReadiness = {
  contractVersion: "knowledge-candidate-content-readiness.v1";
  status: "ready_for_human_review" | "revision_required";
  requiredSectionCount: 4;
  presentSectionCount: number;
  nonEmptySectionCount: number;
  sections: Array<{
    id: "hazard_summary" | "document_targets" | "controls" | "review_items";
    label: string;
    present: boolean;
    nonEmpty: boolean;
  }>;
  placeholderFindingCount: number;
  legalOverclaimFindingCount: number;
  statutoryClaimDetected: boolean;
  lawProvenancePresent: boolean;
  sifProvenancePresent: boolean;
  sifEvidenceVisible: boolean;
  hazardGroundingPresent: boolean;
  unresolvedReviewItems: string[];
  humanReviewCompleted: false;
  publicationState: "unpublished";
  publishAllowed: false;
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
  reviewFacts: string[];
};

type ReviewTraceItem = {
  id: string;
  hazardId: string;
  hazardTitle: string;
  controls: string[];
  primaryDocuments: string[];
  evidenceIds: string[];
  resolved: boolean;
  unresolvedReviewItems: string[];
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
const MAX_REVIEW_FACTS = 4;
const MAX_REVIEW_FACT_LENGTH = 120;
const PRIVATE_REVIEW_FACT_PATTERNS = [
  /\b\d{6}-?\d{7}\b/u,
  /\b01[016789]-?\d{3,4}-?\d{4}\b/u,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  /https?:\/\//iu,
  /\b(?:token|secret|password|resident[-_ ]?id|private[-_ ]?key)\b/iu,
  /(?:주민번호|휴대폰|전화번호|이메일|비밀번호|비밀키)/u
] as const;
const EVENT_FACT_MARKER_PATTERN = /\s*\/\s*원본 이벤트 검토 사실:\s*([^\r\n]*)/u;
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

function readReviewFacts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const facts: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const fact = item.replace(/\s+/gu, " ").trim();
    if (!fact || fact.length > MAX_REVIEW_FACT_LENGTH) continue;
    if (PRIVATE_REVIEW_FACT_PATTERNS.some((pattern) => pattern.test(fact))) continue;
    if (!facts.includes(fact)) facts.push(fact);
    if (facts.length >= MAX_REVIEW_FACTS) break;
  }
  return facts;
}

function buildCandidatePresentation(candidateText: string, evidenceItems: ReviewEvidenceItem[]) {
  const eventFacts = readReviewFacts(evidenceItems.flatMap((evidence) => evidence.reviewFacts));
  const markerMatch = candidateText.match(EVENT_FACT_MARKER_PATTERN);
  const markerFacts = markerMatch ? readReviewFacts(markerMatch[1].split("·")) : [];
  const markerBoundToEvidence = markerFacts.length > 0
    && markerFacts.every((fact) => eventFacts.includes(fact));
  const body = markerBoundToEvidence ? candidateText.replace(EVENT_FACT_MARKER_PATTERN, "").trim() : candidateText;
  return {
    body,
    subject: body.split(/\r?\n/u).map((line) => line.trim()).find(Boolean) ?? "후보 문장 확인 필요",
    eventFacts
  };
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
  return {
    id,
    authorityId: authorityId as ReviewEvidenceAuthorityId,
    authorityLabel,
    sourceLabel,
    capturedAt,
    digest,
    metadata,
    publicUrl,
    reviewFacts: readReviewFacts(value.reviewFacts)
  };
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

function readTraceItem(value: unknown, evidenceIds: ReadonlySet<string>): ReviewTraceItem | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id, 160);
  const hazardId = readString(value.hazardId, 128);
  const hazardTitle = readString(value.hazardTitle, 160);
  const readList = (input: unknown, maxItems: number, maxLength: number): string[] => (
    Array.isArray(input)
      ? [...new Set(input.flatMap((item) => {
          const text = readString(item, maxLength);
          return text ? [text] : [];
        }))].slice(0, maxItems)
      : []
  );
  const controls = readList(value.controls, 12, 180);
  const primaryDocuments = readList(value.primaryDocuments, 12, 80);
  const traceEvidenceIds = readList(value.evidenceIds, 20, 160)
    .filter((evidenceId) => evidenceIds.has(evidenceId));
  const unresolvedReviewItems = readList(value.unresolvedReviewItems, 8, 96);
  const resolved = value.resolved === true
    && controls.length > 0
    && primaryDocuments.length > 0
    && traceEvidenceIds.length > 0
    && unresolvedReviewItems.length === 0;
  if (!id || !hazardId || !hazardTitle || typeof value.resolved !== "boolean") return null;
  return {
    id,
    hazardId,
    hazardTitle,
    controls,
    primaryDocuments,
    evidenceIds: traceEvidenceIds,
    resolved,
    unresolvedReviewItems: resolved ? [] : (unresolvedReviewItems.length > 0 ? unresolvedReviewItems : ["invalid_trace_binding"])
  };
}

function readContentReadiness(value: unknown): ReviewContentReadiness | null {
  if (!isRecord(value) || !Array.isArray(value.sections) || !Array.isArray(value.unresolvedReviewItems)) return null;
  const sectionIds = ["hazard_summary", "document_targets", "controls", "review_items"] as const;
  const sections = value.sections.flatMap((section) => {
    if (!isRecord(section)
      || typeof section.id !== "string"
      || !sectionIds.includes(section.id as typeof sectionIds[number])
      || typeof section.label !== "string"
      || typeof section.present !== "boolean"
      || typeof section.nonEmpty !== "boolean") return [];
    return [{
      id: section.id as typeof sectionIds[number],
      label: section.label.slice(0, 40),
      present: section.present,
      nonEmpty: section.nonEmpty
    }];
  });
  const counts = [
    value.presentSectionCount,
    value.nonEmptySectionCount,
    value.placeholderFindingCount,
    value.legalOverclaimFindingCount
  ];
  const valid = value.contractVersion === "knowledge-candidate-content-readiness.v1"
    && (value.status === "ready_for_human_review" || value.status === "revision_required")
    && value.requiredSectionCount === 4
    && sections.length === 4
    && new Set(sections.map((section) => section.id)).size === 4
    && counts.every((count) => typeof count === "number" && Number.isInteger(count) && count >= 0)
    && value.presentSectionCount === sections.filter((section) => section.present).length
    && value.nonEmptySectionCount === sections.filter((section) => section.nonEmpty).length
    && typeof value.statutoryClaimDetected === "boolean"
    && typeof value.lawProvenancePresent === "boolean"
    && typeof value.hazardGroundingPresent === "boolean"
    && value.unresolvedReviewItems.every((item) => typeof item === "string" && item.length <= 96)
    && value.humanReviewCompleted === false
    && value.publicationState === "unpublished"
    && value.publishAllowed === false;
  if (!valid) return null;
  return {
    contractVersion: "knowledge-candidate-content-readiness.v1",
    status: value.status as ReviewContentReadiness["status"],
    requiredSectionCount: 4,
    presentSectionCount: value.presentSectionCount as number,
    nonEmptySectionCount: value.nonEmptySectionCount as number,
    sections,
    placeholderFindingCount: value.placeholderFindingCount as number,
    legalOverclaimFindingCount: value.legalOverclaimFindingCount as number,
    statutoryClaimDetected: value.statutoryClaimDetected as boolean,
    lawProvenancePresent: value.lawProvenancePresent as boolean,
    sifProvenancePresent: value.sifProvenancePresent === true,
    sifEvidenceVisible: value.sifEvidenceVisible === true,
    hazardGroundingPresent: value.hazardGroundingPresent as boolean,
    unresolvedReviewItems: (value.unresolvedReviewItems as string[]).slice(0, 12),
    humanReviewCompleted: false,
    publicationState: "unpublished",
    publishAllowed: false
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
  const contentReadiness = status === "review_required" ? readContentReadiness(value.contentReadiness) : null;
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
  const evidenceIds = new Set(evidenceItems.map((item) => item.id));
  const traceItems = Array.isArray(value.traceItems)
    ? value.traceItems.map((item) => readTraceItem(item, evidenceIds)).filter((item): item is ReviewTraceItem => item !== null).slice(0, 20)
    : [];
  const traceabilityComplete = value.traceabilityComplete === true
    && traceItems.length === matchedHazardCount
    && traceItems.length > 0
    && traceItems.every((item) => item.resolved);

  if (
    !candidateLabel
    || sourceEventCount === 0
    || (status === "review_required" && evidenceItems.length !== sourceEventCount)
    || matchedHazardCount < 0
    || (status === "review_required" && (!candidateText || !reviewContract || !contentReadiness))
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
    traceItems,
    traceabilityComplete,
    reviewContract,
    contentReadiness
  };
}

function parseInboxResponse(value: unknown): ReviewInboxItem[] | null {
  if (!isRecord(value) || value.ok !== true || !Array.isArray(value.queue)) return null;
  return value.queue.map(parseInboxItem).filter((item): item is ReviewInboxItem => item !== null);
}

async function readJson(response: Response): Promise<unknown> {
  return await response.json().catch((): unknown => null);
}

export function resolveKnowledgePreparationFailureMessage(payload: unknown, status: number): string {
  const code = isRecord(payload) ? readString(payload.code, 80) : "";
  if (code === "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE") {
    return "AI 강화 후보 준비는 분산 보호 설정이 완료될 때까지 잠겨 있습니다. 기존 후보 검토와 미게시 경계는 그대로 유지됩니다.";
  }
  if (code === "PUBLIC_ASK_CONCURRENCY_LIMIT") {
    return "AI 후보 준비 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.";
  }
  if (status === 401) return "로그인 상태를 다시 확인해 주세요.";
  if (status === 503) return "검토 저장소 또는 AI 보호 설정을 확인해 주세요.";
  return "검토 후보를 준비하지 못했습니다.";
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
  const [reviewConfirmations, setReviewConfirmations] = useState<Record<string, boolean>>({});
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

  function setReviewConfirmation(runId: string, confirmed: boolean): void {
    setReviewConfirmations((current) => ({ ...current, [runId]: confirmed }));
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

  function handleHorizontalScrollKey(event: KeyboardEvent<HTMLElement>): void {
    const element = event.currentTarget;
    let left: number | null = null;
    if (event.key === "ArrowRight") left = Math.min(element.scrollLeft + 96, element.scrollWidth);
    if (event.key === "ArrowLeft") left = Math.max(element.scrollLeft - 96, 0);
    if (event.key === "Home") left = 0;
    if (event.key === "End") left = element.scrollWidth;
    if (left === null) return;
    event.preventDefault();
    element.scrollLeft = left;
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
        const failureMessage = resolveKnowledgePreparationFailureMessage(payload, response.status);
        console.warn("knowledge review candidate preparation rejected", {
          code: isRecord(payload) ? readString(payload.code, 80) : "",
          status: response.status
        });
        setMessage(failureMessage);
        return;
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

      {state === "loading" ? <p className={styles.reviewInboxState} data-knowledge-review-state>검토 대기 목록을 불러오는 중입니다.</p> : null}
      {state === "signed_out" ? <p className={styles.reviewInboxState} data-knowledge-review-state>로그인 후 검토 대기 후보를 확인할 수 있습니다.</p> : null}
      {state === "error" ? <p className={styles.reviewInboxState} data-knowledge-review-state>로그인 또는 검토 저장소 연결을 확인해 주세요.</p> : null}
      {state === "ready" && items.length === 0 ? (
        <p className={styles.reviewInboxState} data-knowledge-review-state>검토 대기 후보가 없습니다.</p>
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
                      data-review-candidate-position={`${index + 1}/${items.length}`}
                      tabIndex={selected ? 0 : -1}
                      ref={(node) => { candidateButtonRefs.current[index] = node; }}
                      onClick={() => selectCandidate(item.runId)}
                      onKeyDown={(event) => handleCandidateKeyDown(event, index)}
                    >
                      <span>
                        {item.status === "review_required" ? "검토 대기" : "후보 준비 전"}
                        {` · 후보 ${index + 1}/${items.length}`}
                      </span>
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
            const candidatePresentation = buildCandidatePresentation(item.candidateText, item.evidenceItems);
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
                    <div
                      className={styles.reviewDecisionRail}
                      role="group"
                      aria-label="검토 결정"
                      aria-busy={pending}
                      data-review-confirmation={reviewConfirmations[item.runId] ? "confirmed" : "required"}
                    >
                      <label className={styles.reviewConfirmation}>
                        <input
                          type="checkbox"
                          checked={reviewConfirmations[item.runId] === true}
                          disabled={pending}
                          onChange={(event) => setReviewConfirmation(item.runId, event.currentTarget.checked)}
                        />
                        <span>후보 문장·근거 확인</span>
                        <strong aria-live="polite">
                          {reviewConfirmations[item.runId] ? "결정 가능" : "확인 전"}
                        </strong>
                      </label>
                      <div className={styles.reviewActionButtons}>
                        <button
                          type="button"
                          disabled={pending
                            || reviewConfirmations[item.runId] !== true
                            || item.contentReadiness?.status !== "ready_for_human_review"
                            || !item.traceabilityComplete}
                          title={reviewConfirmations[item.runId] !== true
                            ? "후보 문장과 근거를 확인해야 합니다."
                            : !item.traceabilityComplete
                              ? "위험요인, 통제대책, 반영 문서와 근거 연결을 먼저 확인해야 합니다."
                              : item.contentReadiness?.status === "revision_required"
                                ? "필수 섹션과 근거 준비도를 먼저 보완해야 합니다."
                                : undefined}
                          onClick={() => void submit(item.runId, "approve_candidate")}
                        >후보 승인</button>
                        <button
                          type="button"
                          aria-label="현장 전용 유지"
                          disabled={pending || reviewConfirmations[item.runId] !== true}
                          title={reviewConfirmations[item.runId] !== true ? "후보 문장과 근거를 확인해야 합니다." : undefined}
                          onClick={() => void submit(item.runId, "keep_site_only")}
                        >현장 유지</button>
                        <button
                          type="button"
                          disabled={pending || reviewConfirmations[item.runId] !== true}
                          title={reviewConfirmations[item.runId] !== true ? "후보 문장과 근거를 확인해야 합니다." : undefined}
                          onClick={() => void submit(item.runId, "reject")}
                        >반려</button>
                      </div>
                    </div>
                    <section
                      className={styles.reviewAuthority}
                      aria-label="후보 근거와 적용 경계"
                      data-review-authority-contract="true"
                    >
                      <div className={styles.reviewAuthorityHeader}>
                        <strong>근거 구성</strong>
                        <span>사람 검토 필요</span>
                      </div>
                      <ul className={styles.reviewAuthorityCounts} tabIndex={0} aria-label="근거 구성 수량, 가로로 스크롤 가능" onKeyDown={handleHorizontalScrollKey}>
                        {REVIEW_AUTHORITY_PRESENTATION.map(({ id, label }) => (
                          <li key={id} data-review-authority-role={id}>
                            <span>{label}</span>
                            <strong>{item.reviewContract?.sourceRoleCounts[id] ?? 0}</strong>
                          </li>
                        ))}
                      </ul>
                      <div className={styles.reviewBoundary} role="region" tabIndex={0} aria-label="후보 적용 경계, 가로로 스크롤 가능" onKeyDown={handleHorizontalScrollKey}>
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
                          <p className={styles.candidateText} data-selected-candidate-body="true">{candidatePresentation.body}</p>
                          {item.contentReadiness ? (
                            <section
                              className={styles.reviewReadiness}
                              aria-label="후보 콘텐츠 검토 준비도"
                              data-review-content-readiness={item.contentReadiness.status}
                            >
                              <div>
                                <strong>검토 준비도</strong>
                                <span>{item.contentReadiness.status === "ready_for_human_review" ? "사람 검토 가능" : "수정 필요"}</span>
                              </div>
                              <ul aria-label="필수 섹션 상태">
                                {item.contentReadiness.sections.map((section) => (
                                  <li key={section.id} data-readiness-section={section.id} data-ready={section.nonEmpty ? "true" : "false"}>
                                    <span>{section.label}</span>
                                    <strong>{section.nonEmpty ? "확인" : "누락"}</strong>
                                  </li>
                                ))}
                              </ul>
                              <p>
                                placeholder {item.contentReadiness.placeholderFindingCount} · 법적 과장 {item.contentReadiness.legalOverclaimFindingCount}
                                {item.contentReadiness.statutoryClaimDetected ? ` · 법령 근거 ${item.contentReadiness.lawProvenancePresent ? "확인" : "누락"}` : ""}
                                {item.contentReadiness.sifProvenancePresent ? ` · SIF 근거 ${item.contentReadiness.sifEvidenceVisible ? "본문 확인" : "본문 누락"}` : ""}
                              </p>
                            </section>
                          ) : null}
                          <section
                            className={styles.reviewTraceability}
                            aria-label="위험요인 종단 추적"
                            data-review-traceability={item.traceabilityComplete ? "complete" : "incomplete"}
                          >
                            <div>
                              <strong>위험요인 종단 추적</strong>
                              <span>{item.traceabilityComplete ? "근거 연결 완료" : "승인 전 연결 필요"}</span>
                            </div>
                            {item.traceItems.length > 0 ? (
                              <ol>
                                {item.traceItems.map((trace) => (
                                  <li key={trace.id} data-review-trace={trace.resolved ? "resolved" : "unresolved"}>
                                    <strong>{trace.hazardTitle}</strong>
                                    <dl className={styles.reviewTraceLinks}>
                                      <div><dt>조치</dt><dd>{trace.controls.join(" · ") || "누락"}</dd></div>
                                      <div><dt>문서</dt><dd>{trace.primaryDocuments.join(" · ") || "누락"}</dd></div>
                                      <div>
                                        <dt>근거</dt>
                                        <dd>
                                          {trace.evidenceIds.map((evidenceId) => (
                                            item.evidenceItems.find((evidence) => evidence.id === evidenceId)?.sourceLabel
                                          )).filter(Boolean).join(" · ") || "미연결"}
                                        </dd>
                                      </div>
                                    </dl>
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <p data-review-trace="unresolved">연결된 위험요인 근거가 없습니다. 후보를 다시 준비해 주세요.</p>
                            )}
                          </section>
                          {candidatePresentation.eventFacts.length > 0 ? (
                            <section
                              className={styles.reviewEventFacts}
                              aria-label="원본 이벤트 검토 사실"
                              data-review-event-facts="true"
                            >
                              <div>
                                <strong>원본 이벤트 검토 사실</strong>
                                <span>각 근거행에서 출처 확인 · 사람 검증 필요</span>
                              </div>
                              <ul>
                                {candidatePresentation.eventFacts.map((fact) => (
                                  <li key={fact} data-review-event-fact>{fact}</li>
                                ))}
                              </ul>
                            </section>
                          ) : null}
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
                          <div className={styles.evidenceSubjectContext} data-review-evidence-subject-context="true">
                            <span>검토 대상</span>
                            <strong>{candidatePresentation.subject}</strong>
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
                                  <div><dt>검증</dt><dd data-review-evidence-digest>{evidence.digest}</dd></div>
                                  {evidence.metadata.map((entry) => (
                                    <div key={`${evidence.id}-${entry.label}`}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>
                                  ))}
                                </dl>
                                {evidence.reviewFacts.length > 0 ? (
                                  <ul className={styles.evidenceReviewFacts} aria-label={`${evidence.authorityLabel} 원본 이벤트 검토 사실`}>
                                    {evidence.reviewFacts.map((fact) => (
                                      <li key={`${evidence.id}-${fact}`} data-review-evidence-fact>{fact}</li>
                                    ))}
                                  </ul>
                                ) : null}
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
